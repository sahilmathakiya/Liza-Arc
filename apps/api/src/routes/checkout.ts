import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { createAuth } from "../auth";
import { createPrisma } from "../db";
import { zodErrorMessage } from "../lib/zod";
import { checkoutSchema } from "../schema/order";
import { listUserEntitlements } from "../services/entitlements";
import {
  ENTITLEMENT_DOWNLOAD_KIND,
  confirmPurchase,
  createCheckout,
  failPurchase,
  getUserOrder,
  listUserOrders,
  withAccessExpiry,
} from "../services/orders";

type CheckoutContext = Context<{ Bindings: Env }>;

const paySchema = z.object({ result: z.enum(["success", "fail"]) });

function getSession(c: CheckoutContext) {
  return createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
}

export const checkoutRouter = new Hono<{ Bindings: Env }>();

checkoutRouter.post("/", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

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

  const prisma = createPrisma(c.env.DATABASE_URL);
  const orderId = c.req.param("orderId");
  const order = await getUserOrder(prisma, orderId, session.user.id);
  if (!order) return c.json({ error: "Order not found" }, 404);

  const parsed = paySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);

  if (parsed.data.result === "fail") {
    const failed = await failPurchase(prisma, orderId);
    if (!failed.ok) return c.json({ error: failed.error }, failed.status);
    return c.json({ orderId, status: "FAILED" });
  }

  const confirmed = await confirmPurchase(prisma, orderId, `mock-${orderId}`);
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
