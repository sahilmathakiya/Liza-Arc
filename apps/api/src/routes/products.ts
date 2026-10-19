import { Hono } from "hono";
import { getSession as getSessionFor } from "../auth";
import { getPrisma } from "../db";
import { rateLimit } from "../lib/rate-limit";
import { zodErrorMessage } from "../lib/zod";
import { floorPlanListQuerySchema, interiorPlanListQuerySchema } from "../schema/product";
import { getPublicProductBySlug, listPublicFloorPlans, listPublicInteriorPlans } from "../services/products";

export const publicProductsRouter = new Hono<{ Bindings: Env }>();

// Catalog endpoints hit the database and are unauthenticated: a per-IP limit
// keeps scraping/abuse from piling load onto Neon. 120/min is far above normal
// storefront browsing.
publicProductsRouter.use("*", async (c, next) => {
  const limited = await rateLimit(c, "RL_CATALOG");
  if (limited) return limited;
  return next();
});

publicProductsRouter.get("/", async (c) => {
  const prisma = getPrisma(c);
  const type = c.req.query("type");

  if (type === "FLOOR_PLAN") {
    const parsed = floorPlanListQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
    return c.json(await listPublicFloorPlans(prisma, parsed.data));
  }
  if (type === "INTERIOR_PLAN") {
    const parsed = interiorPlanListQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
    return c.json(await listPublicInteriorPlans(prisma, parsed.data));
  }
  return c.json({ error: "type must be FLOOR_PLAN or INTERIOR_PLAN" }, 400);
});

publicProductsRouter.get("/:slug", async (c) => {
  const session = await getSessionFor(c)
    .catch(() => null);
  const prisma = getPrisma(c);
  const product = await getPublicProductBySlug(prisma, c.req.param("slug"), session?.user.id);
  if (!product) return c.json({ error: "Product not found" }, 404);
  return c.json({ product });
});
