import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createPrisma } from "../db";
import { WEBHOOK_MAX_BYTES } from "../lib/body-limits";
import { getRazorpayOrder, verifyWebhookSignature } from "../lib/razorpay";
import { rateLimit } from "../lib/rate-limit";
import {
  confirmPurchase,
  failPurchase,
  findOrderIdByRazorpayOrderId,
  findOrderIdByReceipt,
} from "../services/orders";

export const webhooksRouter = new Hono<{ Bindings: Env }>();

webhooksRouter.use("*", bodyLimit({ maxSize: WEBHOOK_MAX_BYTES }));

webhooksRouter.use("*", async (c, next) => {
  const limited = rateLimit(c, { scope: "razorpay-webhook", max: 600, windowMs: 60_000 });
  if (limited) return limited;
  await next();
});

interface RazorpayEntity {
  id?: string;
  order_id?: string;
}

interface RazorpayWebhookPayload {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    order?: { entity?: RazorpayEntity };
  };
}

async function resolveOrderId(env: Env, razorpayOrderId: string) {
  const prisma = createPrisma(env.DATABASE_URL);
  const order = await findOrderIdByRazorpayOrderId(prisma, razorpayOrderId);
  if (order) return { prisma, orderId: order.id };

  const razorpayOrder = await getRazorpayOrder(env, razorpayOrderId);
  if (razorpayOrder?.receipt) {
    const byReceipt = await findOrderIdByReceipt(prisma, razorpayOrder.receipt);
    if (byReceipt) return { prisma, orderId: byReceipt.id };
  }
  return { prisma, orderId: null };
}

webhooksRouter.post("/razorpay", async (c) => {
  if (!c.env.RAZORPAY_WEBHOOK_SECRET) {
    return c.json({ error: "Webhook is not configured" }, 503);
  }

  const signature = c.req.header("x-razorpay-signature");
  if (!signature) return c.json({ error: "Invalid signature" }, 400);

  const rawBody = await c.req.raw.text();
  const signatureValid = await verifyWebhookSignature(
    c.env.RAZORPAY_WEBHOOK_SECRET,
    rawBody,
    signature,
  );
  if (!signatureValid) return c.json({ error: "Invalid signature" }, 400);

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const payment = payload.payload?.payment?.entity;
  const razorpayOrderId = payment?.order_id ?? payload.payload?.order?.entity?.id;
  if (!razorpayOrderId) return c.json({ ok: true });

  if (payload.event === "payment.captured" || payload.event === "order.paid") {
    if (!payment?.id) return c.json({ ok: true });
    const { prisma, orderId } = await resolveOrderId(c.env, razorpayOrderId);
    if (orderId) await confirmPurchase(prisma, orderId, payment.id);
  } else if (payload.event === "payment.failed") {
    const { prisma, orderId } = await resolveOrderId(c.env, razorpayOrderId);
    if (orderId) await failPurchase(prisma, orderId);
  }

  return c.json({ ok: true });
});
