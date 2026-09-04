import { Hono } from "hono";
import type { Session } from "../../auth";
import { createAuth } from "../../auth";
import { createPrisma, isPrismaError } from "../../db";
import {
  ALLOWED_EXTENSIONS,
  IMAGE_ASSET_KINDS,
  PRODUCT_ASSET_KINDS,
  assetKey,
  contentTypeFor,
  deleteAssets,
  putAsset,
  resolveUploadExtension,
  type AssetKind,
} from "../../lib/r2";
import { zodErrorMessage } from "../../lib/zod";
import { isAdminRole } from "../../roles";
import { PRODUCT_TYPES } from "../../schema/enums";
import {
  createProductSchema,
  updateFloorPlanProductSchema,
  updateInteriorPlanProductSchema,
} from "../../schema/product";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listAdminProducts,
  setAssetKey,
  updateFloorPlanProduct,
  updateInteriorPlanProduct,
} from "../../services/products";
import { z } from "zod";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;

const listQuerySchema = z.object({
  type: z.enum(PRODUCT_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminProductsRouter = new Hono<{ Bindings: Env; Variables: { session: Session } }>();

adminProductsRouter.use("*", async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  if (!isAdminRole(session.user.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  c.set("session", session);
  await next();
});

adminProductsRouter.get("/", async (c) => {
  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const prisma = createPrisma(c.env.DATABASE_URL);
  const result = await listAdminProducts(prisma, parsed.data);
  return c.json(result);
});

adminProductsRouter.post("/", async (c) => {
  const parsed = createProductSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const prisma = createPrisma(c.env.DATABASE_URL);
  try {
    const product = await createProduct(prisma, parsed.data);
    return c.json({ product }, 201);
  } catch (error) {
    if (isPrismaError(error, "P2002")) return c.json({ error: "Slug is already taken" }, 409);
    return c.json({ error: "Failed to create product" }, 500);
  }
});

adminProductsRouter.get("/:id", async (c) => {
  const prisma = createPrisma(c.env.DATABASE_URL);
  const product = await getProduct(prisma, c.req.param("id"));
  if (!product) return c.json({ error: "Product not found" }, 404);
  return c.json({ product });
});

adminProductsRouter.patch("/:id", async (c) => {
  const prisma = createPrisma(c.env.DATABASE_URL);
  const product = await getProduct(prisma, c.req.param("id"));
  if (!product) return c.json({ error: "Product not found" }, 404);

  const raw = await c.req.json().catch(() => null);
  try {
    if (product.type === "FLOOR_PLAN") {
      const parsed = updateFloorPlanProductSchema.safeParse(raw);
      if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
      return c.json({ product: await updateFloorPlanProduct(prisma, product, parsed.data) });
    }
    const parsed = updateInteriorPlanProductSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
    return c.json({ product: await updateInteriorPlanProduct(prisma, product, parsed.data) });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return c.json({ error: "Slug is already taken" }, 409);
    return c.json({ error: "Failed to update product" }, 500);
  }
});

adminProductsRouter.delete("/:id", async (c) => {
  const prisma = createPrisma(c.env.DATABASE_URL);
  const result = await deleteProduct(prisma, c.req.param("id"));
  if (!result.ok) {
    if (result.error === "not-found") return c.json({ error: "Product not found" }, 404);
    return c.json({ error: "Product has existing buyers; unpublish it instead" }, 409);
  }
  await deleteAssets(c.env.BUCKET, result.keys);
  return c.json({ ok: true });
});

adminProductsRouter.post("/:id/assets", async (c) => {
  const prisma = createPrisma(c.env.DATABASE_URL);
  const product = await getProduct(prisma, c.req.param("id"));
  if (!product) return c.json({ error: "Product not found" }, 404);

  const body = await c.req.parseBody().catch(() => null);
  const file = body?.file;
  if (!(file instanceof File)) return c.json({ error: "A file upload is required" }, 400);

  const kind = typeof body?.kind === "string" ? body.kind : "";
  if (!PRODUCT_ASSET_KINDS[product.type].includes(kind as AssetKind)) {
    return c.json(
      { error: `Invalid asset kind; expected one of: ${PRODUCT_ASSET_KINDS[product.type].join(", ")}` },
      400,
    );
  }
  const assetKind = kind as AssetKind;

  const ext = resolveUploadExtension(file.name, assetKind);
  if (!ext) {
    return c.json({ error: `Allowed formats: ${ALLOWED_EXTENSIONS[assetKind].join(", ")}` }, 400);
  }

  const maxBytes = IMAGE_ASSET_KINDS.includes(assetKind) ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (file.size > maxBytes) {
    return c.json({ error: `File exceeds the ${maxBytes / (1024 * 1024)}MB limit` }, 413);
  }

  const key = assetKey(product.id, assetKind, ext);
  try {
    await putAsset(c.env.BUCKET, key, file.stream(), contentTypeFor(ext));
    const oldKey = await setAssetKey(prisma, product, assetKind, key);
    if (oldKey && oldKey !== key) await deleteAssets(c.env.BUCKET, [oldKey]);
    return c.json({ key });
  } catch {
    return c.json({ error: "Failed to store the file" }, 500);
  }
});
