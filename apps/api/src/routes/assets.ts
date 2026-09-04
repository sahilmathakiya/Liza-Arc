import { Hono } from "hono";
import { createAuth } from "../auth";
import { createPrisma } from "../db";
import { assetResponseHeaders } from "../lib/r2";
import { isAdminRole } from "../roles";
import { hasEntitlement } from "../services/entitlements";
import { getDeliverableAsset, type PaidAssetKind } from "../services/products";

export const assetsRouter = new Hono<{ Bindings: Env }>();

const PAID_KINDS: readonly string[] = ["floor-plan", "elevation", "working-drawing"];

assetsRouter.get("/interior/:id/preview", async (c) => {
  const prisma = createPrisma(c.env.DATABASE_URL);
  const product = await prisma.product.findFirst({
    where: { id: c.req.param("id"), published: true, type: "INTERIOR_PLAN" },
    select: { interiorPlan: { select: { previewKey: true } } },
  });
  const key = product?.interiorPlan?.previewKey;
  if (!key) return c.json({ error: "Preview not found" }, 404);

  const object = await c.env.BUCKET.get(key);
  if (!object) return c.json({ error: "Preview not found" }, 404);
  return c.body(object.body, 200, {
    "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
    "cache-control": "public, max-age=86400",
    etag: object.etag,
  });
});

assetsRouter.get("/products/:id/:kind", async (c) => {
  const kind = c.req.param("kind");
  if (!PAID_KINDS.includes(kind)) return c.json({ error: "Invalid asset kind" }, 400);

  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const prisma = createPrisma(c.env.DATABASE_URL);
  const asset = await getDeliverableAsset(prisma, c.req.param("id"), kind as PaidAssetKind);
  if (!asset) return c.json({ error: "Asset not found" }, 404);

  if (!isAdminRole(session.user.role)) {
    const entitled = await hasEntitlement(prisma, session.user.id, c.req.param("id"), asset.entitlement);
    if (!entitled) return c.json({ error: "You do not own this item" }, 403);
  }

  const object = await c.env.BUCKET.get(asset.key);
  if (!object) return c.json({ error: "Asset not found" }, 404);
  return c.body(object.body, 200, assetResponseHeaders(object, { filename: asset.filename }));
});
