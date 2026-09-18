import { Hono } from "hono";
import { z } from "zod";
import type { Session } from "../../auth";
import { createAuth } from "../../auth";
import { createPrisma } from "../../db";
import { zodErrorMessage } from "../../lib/zod";
import { isAdminRole } from "../../roles";
import { ORDER_STATUSES } from "../../schema/enums";
import { getAdminOrder, listAdminOrders, withAccessExpiry } from "../../services/orders";

const listQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminOrdersRouter = new Hono<{ Bindings: Env; Variables: { session: Session } }>();

adminOrdersRouter.use("*", async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  if (!isAdminRole(session.user.role)) return c.json({ error: "Forbidden" }, 403);
  c.set("session", session);
  await next();
});

adminOrdersRouter.get("/", async (c) => {
  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const prisma = createPrisma(c.env.DATABASE_URL);
  const result = await listAdminOrders(prisma, parsed.data);
  return c.json(result);
});

adminOrdersRouter.get("/:id", async (c) => {
  const prisma = createPrisma(c.env.DATABASE_URL);
  const order = await getAdminOrder(prisma, c.req.param("id"));
  if (!order) return c.json({ error: "Order not found" }, 404);
  return c.json({ order: withAccessExpiry(order) });
});
