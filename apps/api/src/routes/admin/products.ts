import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Context } from "hono";
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
  elevationThumbKey,
  interiorPreviewCardKey,
  interiorPreviewHeroKey,
  putAsset,
  resolveUploadExtension,
  type AssetKind,
} from "../../lib/r2";
import { JSON_MAX_BYTES, UPLOAD_MAX_BYTES } from "../../lib/body-limits";
import { rateLimit } from "../../lib/rate-limit";
import { detectFileKind } from "../../lib/file-type";
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
  setElevationThumbKey,
  updateFloorPlanProduct,
  updateInteriorPlanProduct,
} from "../../services/products";
import type { ProductWithDetails } from "../../services/products";
import {
  INTERIOR_PREVIEW_CARD_MAX_DIMENSION,
  INTERIOR_PREVIEW_HERO_MAX_DIMENSION,
  ThumbnailError,
  createBlurredThumbnail,
  createResizedWebp,
} from "../../services/thumbnail";
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

adminProductsRouter.use("*", async (c, next) => {
  if (c.req.method !== "GET") {
    const limited = rateLimit(c, {
      scope: "admin-products",
      max: 60,
      windowMs: 60_000,
      key: c.get("session").user.id,
    });
    if (limited) return limited;
  }
  await next();
});

adminProductsRouter.get("/", async (c) => {
  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const prisma = createPrisma(c.env.DATABASE_URL);
  const result = await listAdminProducts(prisma, parsed.data);
  return c.json(result);
});

adminProductsRouter.post("/", bodyLimit({ maxSize: JSON_MAX_BYTES }), async (c) => {
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

adminProductsRouter.patch("/:id", bodyLimit({ maxSize: JSON_MAX_BYTES }), async (c) => {
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
    if (result.error === "owned") {
      return c.json({ error: "Product has existing buyers; unpublish it instead" }, 409);
    }
    return c.json({ error: "Product appears in existing orders; unpublish it instead" }, 409);
  }
  await deleteAssets(c.env.BUCKET, result.keys);
  return c.json({ ok: true });
});

adminProductsRouter.post(
  "/:id/assets",
  bodyLimit({
    maxSize: UPLOAD_MAX_BYTES,
    onError: (c) => c.json({ error: "Upload exceeds the 101MB limit" }, 413),
  }),
  async (c) => {
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

  if (assetKind === "elevation") {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await putAsset(c.env.BUCKET, key, bytes, contentTypeFor(ext));
      const oldKey = await setAssetKey(prisma, product, assetKind, key);
      if (oldKey && oldKey !== key) await deleteAssets(c.env.BUCKET, [oldKey]);

      const thumbnailKey = await generateElevationThumbnail(c, prisma, product, bytes);
      return c.json({ key, thumbnailKey });
    } catch {
      return c.json({ error: "Failed to store the file" }, 500);
    }
  }

  if (assetKind === "preview") {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await putAsset(c.env.BUCKET, key, bytes, contentTypeFor(ext));
      const oldKey = await setAssetKey(prisma, product, assetKind, key);
      if (oldKey && oldKey !== key) await deleteAssets(c.env.BUCKET, [oldKey]);

      await generateInteriorPreviewDerivatives(c, product, bytes);
      return c.json({ key });
    } catch {
      return c.json({ error: "Failed to store the file" }, 500);
    }
  }

  try {
    await putAsset(c.env.BUCKET, key, file.stream(), contentTypeFor(ext));
    const oldKey = await setAssetKey(prisma, product, assetKind, key);
    if (oldKey && oldKey !== key) await deleteAssets(c.env.BUCKET, [oldKey]);
    return c.json({ key });
  } catch {
    return c.json({ error: "Failed to store the file" }, 500);
  }
  },
);

/**
 * Generates and stores the blurred storefront thumbnail for an elevation image.
 * A failure here is non-fatal: the original upload stays valid and the admin
 * can retry with the regenerate endpoint.
 */
async function generateElevationThumbnail(
  c: Context<{ Bindings: Env; Variables: { session: Session } }>,
  prisma: ReturnType<typeof createPrisma>,
  product: ProductWithDetails,
  source: Uint8Array,
): Promise<string | null> {
  try {
    const thumbnail = createBlurredThumbnail(source, detectFileKind(source));
    const thumbKey = elevationThumbKey(product.id);
    await putAsset(c.env.BUCKET, thumbKey, thumbnail.bytes, thumbnail.contentType);
    const oldThumb = await setElevationThumbKey(prisma, product, thumbKey);
    if (oldThumb && oldThumb !== thumbKey) await deleteAssets(c.env.BUCKET, [oldThumb]);
    return thumbKey;
  } catch (error) {
    console.error("Failed to generate elevation thumbnail", {
      productId: product.id,
      message: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }
}

/**
 * Generates the resized storefront preview derivatives (card + hero) for an
 * interior plan preview image. Failures are non-fatal: the raw upload stays
 * valid and the asset endpoint falls back to it.
 */
async function generateInteriorPreviewDerivatives(
  c: Context<{ Bindings: Env; Variables: { session: Session } }>,
  product: ProductWithDetails,
  source: Uint8Array,
): Promise<void> {
  try {
    const kind = detectFileKind(source);
    const card = createResizedWebp(source, kind, INTERIOR_PREVIEW_CARD_MAX_DIMENSION);
    const hero = createResizedWebp(source, kind, INTERIOR_PREVIEW_HERO_MAX_DIMENSION);
    await Promise.all([
      putAsset(c.env.BUCKET, interiorPreviewCardKey(product.id), card.bytes, card.contentType),
      putAsset(c.env.BUCKET, interiorPreviewHeroKey(product.id), hero.bytes, hero.contentType),
    ]);
  } catch (error) {
    console.error("Failed to generate interior preview derivatives", {
      productId: product.id,
      message: error instanceof Error ? error.message : "unknown error",
    });
  }
}

adminProductsRouter.post("/:id/thumbnail", async (c) => {
  const prisma = createPrisma(c.env.DATABASE_URL);
  const product = await getProduct(prisma, c.req.param("id"));
  if (!product) return c.json({ error: "Product not found" }, 404);
  if (product.type !== "FLOOR_PLAN" || !product.floorPlan) {
    return c.json({ error: "Thumbnails only apply to floor plan products" }, 400);
  }

  const key = product.floorPlan.elevationKey;
  if (!key) return c.json({ error: "Upload an elevation image first" }, 400);

  const object = await c.env.BUCKET.get(key);
  if (!object) return c.json({ error: "Elevation asset not found" }, 404);

  const source = new Uint8Array(await object.arrayBuffer());
  let thumbnail;
  try {
    thumbnail = createBlurredThumbnail(source, detectFileKind(source));
  } catch (error) {
    if (error instanceof ThumbnailError && error.status !== 500) {
      return c.json({ error: error.message }, error.status);
    }
    console.error("Failed to regenerate elevation thumbnail", {
      productId: product.id,
      message: error instanceof Error ? error.message : "unknown error",
    });
    return c.json({ error: "Unable to generate the thumbnail." }, 500);
  }

  const thumbKey = elevationThumbKey(product.id);
  await putAsset(c.env.BUCKET, thumbKey, thumbnail.bytes, thumbnail.contentType);
  const oldThumb = await setElevationThumbKey(prisma, product, thumbKey);
  if (oldThumb && oldThumb !== thumbKey) await deleteAssets(c.env.BUCKET, [oldThumb]);
  return c.json({ thumbnailKey: thumbKey });
});
