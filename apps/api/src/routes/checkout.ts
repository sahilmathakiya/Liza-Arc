import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createAuth } from "../auth";
import { createPrisma } from "../db";
import { JSON_MAX_BYTES } from "../lib/body-limits";
import { rateLimit } from "../lib/rate-limit";
import { createRazorpayOrder, getRazorpayOrder, verifyPaymentSignature } from "../lib/razorpay";
import { zodErrorMessage } from "../lib/zod";
import { checkoutSchema, razorpayVerifySchema } from "../schema/order";
import { listUserEntitlements } from "../services/entitlements";
import {
  ENTITLEMENT_DOWNLOAD_KIND,
  confirmPurchase,
  createCheckout,
  getUserOrder,
  listUserOrders,
  withAccessExpiry,
} from "../services/orders";

type CheckoutContext = Context<{ Bindings: Env }>;

function getSession(c: CheckoutContext) {
  return createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
}

export const checkoutRouter = new Hono<{ Bindings: Env }>();

checkoutRouter.use("*", bodyLimit({ maxSize: JSON_MAX_BYTES }));

checkoutRouter.post("/", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const limited = rateLimit(c, {
    scope: "checkout-create",
    max: 10,
    windowMs: 60_000,
    key: session.user.id,
  });
  if (limited) return limited;

  const parsed = checkoutSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);

  const prisma = createPrisma(c.env.DATABASE_URL);
  const result = await createCheckout(prisma, session.user.id, parsed.data.items);
  if (!result.ok) return c.json({ error: result.error }, result.status);

  const order = result.order;
  return c.json(
    {
      orderId: order.id,
      status: order.status,
      currency: order.currency,
      subtotalCents: order.subtotalCents,
      totalCents: order.totalCents,
      items: order.items.map((item) => ({
        id: item.id,
        entitlementType: item.entitlementType,
        priceCents: item.priceCents,
        product: item.product,
        accessExpiresAt: item.entitlement?.expiresAt ?? null,
      })),
    },
    201,
  );
});

checkoutRouter.post("/:orderId/pay", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const limited = rateLimit(c, {
    scope: "checkout-pay",
    max: 10,
    windowMs: 60_000,
    key: session.user.id,
  });
  if (limited) return limited;

  const prisma = createPrisma(c.env.DATABASE_URL);
  const orderId = c.req.param("orderId");
  const order = await getUserOrder(prisma, orderId, session.user.id);
  if (!order) return c.json({ error: "Order not found" }, 404);
  if (order.status === "PAID") {
    return c.json({ error: "Order has already been paid" }, 409);
  }
  if (order.status === "FAILED") {
    return c.json({ error: "This payment failed; please start a new checkout" }, 409);
  }

  const razorpayOrder = await createRazorpayOrder(c.env, {
    amountCents: order.totalCents,
    currency: order.currency,
    receipt: order.id,
    notes: { orderId: order.id },
  });
  if (!razorpayOrder) {
    return c.json({ error: "The payment gateway is unavailable, please try again" }, 502);
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { razorpayOrderId: razorpayOrder.id },
  });

  return c.json({
    orderId: order.id,
    keyId: c.env.RAZORPAY_KEY_ID,
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    prefill: { name: session.user.name, email: session.user.email },
  });
});

checkoutRouter.post("/:orderId/verify", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const limited = rateLimit(c, {
    scope: "checkout-verify",
    max: 20,
    windowMs: 60_000,
    key: session.user.id,
  });
  if (limited) return limited;

  const parsed = razorpayVerifySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);

  const prisma = createPrisma(c.env.DATABASE_URL);
  const orderId = c.req.param("orderId");
  const order = await getUserOrder(prisma, orderId, session.user.id);
  if (!order) return c.json({ error: "Order not found" }, 404);

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;
  const signatureValid = await verifyPaymentSignature(c.env.RAZORPAY_KEY_SECRET, {
    razorpayOrderId,
    razorpayPaymentId,
    signature: razorpaySignature,
  });
  if (!signatureValid) return c.json({ error: "Payment verification failed" }, 400);

  if (razorpayOrderId !== order.razorpayOrderId) {
    const razorpayOrder = await getRazorpayOrder(c.env, razorpayOrderId);
    if (
      !razorpayOrder ||
      razorpayOrder.receipt !== orderId ||
      razorpayOrder.amount !== order.totalCents ||
      razorpayOrder.currency !== order.currency
    ) {
      return c.json({ error: "Payment does not match this order" }, 400);
    }
  }

  const confirmed = await confirmPurchase(prisma, orderId, razorpayPaymentId);
  if (!confirmed.ok) return c.json({ error: confirmed.error }, confirmed.status);
  return c.json({ orderId, status: "PAID" });
});

checkoutRouter.get("/orders", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  const prisma = createPrisma(c.env.DATABASE_URL);
  const orders = await listUserOrders(prisma, session.user.id);
  return c.json({ orders: orders.map(withAccessExpiry) });
});

checkoutRouter.get("/orders/:id", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  const prisma = createPrisma(c.env.DATABASE_URL);
  const order = await getUserOrder(prisma, c.req.param("id"), session.user.id);
  if (!order) return c.json({ error: "Order not found" }, 404);
  return c.json({ order: withAccessExpiry(order) });
});

checkoutRouter.get("/entitlements", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  const prisma = createPrisma(c.env.DATABASE_URL);
  const rows = await listUserEntitlements(prisma, session.user.id);
  return c.json({
    entitlements: rows.map((row) => ({
      id: row.id,
      type: row.type,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      downloadKind: ENTITLEMENT_DOWNLOAD_KIND[row.type],
      product: row.product,
    })),
  });
});
