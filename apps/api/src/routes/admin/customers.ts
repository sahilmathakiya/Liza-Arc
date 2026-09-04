import { Hono } from "hono";
import { z } from "zod";
import type { Session } from "../../auth";
import { createAuth } from "../../auth";
import { createPrisma } from "../../db";
import { zodErrorMessage } from "../../lib/zod";
import { isAdminRole } from "../../roles";
import { ENTITLEMENT_TYPES } from "../../schema/enums";
import { grantEntitlement, revokeEntitlement } from "../../services/entitlements";
import { getAdminCustomer, listAdminCustomers } from "../../services/orders";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const grantSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(ENTITLEMENT_TYPES),
});

export const adminCustomersRouter = new Hono<{ Bindings: Env; Variables: { session: Session } }>();

adminCustomersRouter.use("*", async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  if (!isAdminRole(session.user.role)) return c.json({ error: "Forbidden" }, 403);
  c.set("session", session);
  await next();
});

adminCustomersRouter.get("/", async (c) => {
  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const prisma = createPrisma(c.env.DATABASE_URL);
  const result = await listAdminCustomers(prisma, parsed.data);
  return c.json(result);
});

adminCustomersRouter.get("/:id", async (c) => {
  const prisma = createPrisma(c.env.DATABASE_URL);
  const customer = await getAdminCustomer(prisma, c.req.param("id"));
  if (!customer) return c.json({ error: "Customer not found" }, 404);
  return c.json({ customer });
});

adminCustomersRouter.post("/:id/entitlements", async (c) => {
  const parsed = grantSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const prisma = createPrisma(c.env.DATABASE_URL);
  const result = await grantEntitlement(prisma, c.req.param("id"), parsed.data.productId, parsed.data.type);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ entitlement: result.entitlement }, 201);
});

adminCustomersRouter.delete("/:id/entitlements/:entitlementId", async (c) => {
  const prisma = createPrisma(c.env.DATABASE_URL);
  const result = await revokeEntitlement(prisma, c.req.param("id"), c.req.param("entitlementId"));
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ ok: true });
});
