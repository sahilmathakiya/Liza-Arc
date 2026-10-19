import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { Context } from "hono";
import { z } from "zod";
import type { Session } from "../../auth";
import { getSession } from "../../auth";
import { getPrisma, isPrismaError } from "../../db";
import { JSON_MAX_BYTES } from "../../lib/body-limits";
import { detectFileKind, isImageFileKind } from "../../lib/file-type";
import { readImageDimensions } from "../../lib/image-meta";
import { defer, logError } from "../../lib/log";
import {
  ALLOWED_EXTENSIONS,
  ASSET_KINDS,
  IMAGE_ASSET_KINDS,
  MAX_UPLOAD_BYTES,
  PRODUCT_ASSET_KINDS,
  assetKey,
  canonicalExtension,
  contentTypeFor,
  copyObject,
  deleteAssets,
  isDirectUploadConfigured,
  parseStagingKey,
  presignPut,
  resolveUploadExtension,
  stagingKey,
  type AssetKind,
} from "../../lib/r2";
import { rateLimit } from "../../lib/rate-limit";
import { zodErrorMessage } from "../../lib/zod";
import { isAdminRole } from "../../roles";
import { PRODUCT_TYPES } from "../../schema/enums";
import {
  createProductSchema,
  updateFloorPlanProductSchema,
  updateInteriorPlanProductSchema,
} from "../../schema/product";
import { MAX_IMAGE_PIXELS, MAX_IMAGE_SIDE, generateDerivatives } from "../../services/derivatives";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listAdminProducts,
  swapAssetKey,
  updateFloorPlanProduct,
  updateInteriorPlanProduct,
} from "../../services/products";

type AdminEnv = { Bindings: Env; Variables: { session: Session } };
type AdminContext = Context<AdminEnv>;

/** Presigned upload URLs are valid for 10 minutes. */
const UPLOAD_URL_TTL_SECONDS = 600;
/** Bytes read from the start of an upload to verify its real type/dimensions. */
const SNIFF_BYTES = 128 * 1024;

const listQuerySchema = z.object({
  type: z.enum(PRODUCT_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const signUploadSchema = z.object({
  kind: z.enum(ASSET_KINDS),
  filename: z.string().min(1).max(255),
  size: z.number().int().positive(),
});

const completeUploadSchema = z.object({
  kind: z.enum(ASSET_KINDS),
  uploadKey: z.string().min(1).max(512),
});

export const adminProductsRouter = new Hono<AdminEnv>();

adminProductsRouter.use("*", async (c, next) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  if (!isAdminRole(session.user.role)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  c.set("session", session);
  await next();
});

adminProductsRouter.use("*", async (c, next) => {
  if (c.req.method !== "GET") {
    const limited = await rateLimit(c, "RL_ADMIN_WRITE", c.get("session").user.id);
    if (limited) return limited;
  }
  await next();
});

adminProductsRouter.get("/", async (c) => {
  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const result = await listAdminProducts(getPrisma(c), parsed.data);
  return c.json(result);
});

adminProductsRouter.post("/", bodyLimit({ maxSize: JSON_MAX_BYTES }), async (c) => {
  const parsed = createProductSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  try {
    const product = await createProduct(getPrisma(c), parsed.data);
    return c.json({ product }, 201);
  } catch (error) {
    if (isPrismaError(error, "P2002")) return c.json({ error: "Slug is already taken" }, 409);
    logError(c, "Failed to create product", error);
    return c.json({ error: "Failed to create product" }, 500);
  }
});

adminProductsRouter.get("/:id", async (c) => {
  const product = await getProduct(getPrisma(c), c.req.param("id"));
  if (!product) return c.json({ error: "Product not found" }, 404);
  return c.json({ product });
});

adminProductsRouter.patch("/:id", bodyLimit({ maxSize: JSON_MAX_BYTES }), async (c) => {
  const prisma = getPrisma(c);
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
    logError(c, "Failed to update product", error, { productId: product.id });
    return c.json({ error: "Failed to update product" }, 500);
  }
});

adminProductsRouter.delete("/:id", async (c) => {
  const result = await deleteProduct(getPrisma(c), c.req.param("id"));
  if (!result.ok) {
    if (result.error === "not-found") return c.json({ error: "Product not found" }, 404);
    if (result.error === "owned") {
      return c.json({ error: "Product has existing buyers; unpublish it instead" }, 409);
    }
    return c.json({ error: "Product appears in existing orders; unpublish it instead" }, 409);
  }
  defer(c, "delete product assets", () => deleteAssets(c.env.BUCKET, result.keys));
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Uploads: browser -> R2 directly. The Worker only validates, signs, verifies
// and records; it never buffers file bytes (beyond a 128KB header sniff).
//
//   1. POST /:id/uploads/sign      -> presigned PUT URL for staging/<uuid>
//   2. PUT  <uploadUrl>            -> browser uploads straight to R2
//   3. POST /:id/uploads/complete  -> verify, copy into place, swap DB key,
//                                     generate derivatives (Images binding)
// ---------------------------------------------------------------------------

function kindMismatch(c: AdminContext, type: keyof typeof PRODUCT_ASSET_KINDS) {
  return c.json(
    { error: `Invalid asset kind; expected one of: ${PRODUCT_ASSET_KINDS[type].join(", ")}` },
    400,
  );
}

function formatMb(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

adminProductsRouter.post("/:id/uploads/sign", bodyLimit({ maxSize: JSON_MAX_BYTES }), async (c) => {
  const limited = await rateLimit(c, "RL_UPLOAD", c.get("session").user.id);
  if (limited) return limited;

  if (!isDirectUploadConfigured(c.env)) {
    logError(c, "Direct uploads are not configured (missing R2 S3 credentials)");
    return c.json({ error: "Uploads are not configured on the server." }, 503);
  }

  const parsed = signUploadSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const { kind, filename, size } = parsed.data;

  const product = await getProduct(getPrisma(c), c.req.param("id"));
  if (!product) return c.json({ error: "Product not found" }, 404);
  if (!PRODUCT_ASSET_KINDS[product.type].includes(kind)) return kindMismatch(c, product.type);

  const ext = resolveUploadExtension(filename, kind);
  if (!ext) {
    return c.json({ error: `Allowed formats: ${ALLOWED_EXTENSIONS[kind].join(", ")}` }, 400);
  }
  const maxBytes = MAX_UPLOAD_BYTES[kind];
  if (size > maxBytes) {
    return c.json({ error: `File exceeds the ${formatMb(maxBytes)} limit` }, 413);
  }

  const uploadKey = stagingKey(product.id, kind, crypto.randomUUID(), ext);
  const uploadUrl = await presignPut(c.env, uploadKey, UPLOAD_URL_TTL_SECONDS);
  return c.json({
    uploadUrl,
    uploadKey,
    contentType: contentTypeFor(ext),
    maxBytes,
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  });
});

adminProductsRouter.post("/:id/uploads/complete", bodyLimit({ maxSize: JSON_MAX_BYTES }), async (c) => {
  const limited = await rateLimit(c, "RL_UPLOAD", c.get("session").user.id);
  if (limited) return limited;

  const parsed = completeUploadSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const { kind, uploadKey } = parsed.data;

  const prisma = getPrisma(c);
  const product = await getProduct(prisma, c.req.param("id"));
  if (!product) return c.json({ error: "Product not found" }, 404);
  if (!PRODUCT_ASSET_KINDS[product.type].includes(kind)) return kindMismatch(c, product.type);

  const staged = parseStagingKey(uploadKey);
  if (!staged || staged.productId !== product.id || staged.kind !== kind) {
    return c.json({ error: "Invalid upload reference" }, 400);
  }

  const bucket = c.env.BUCKET;
  const reject = (status: 400 | 413 | 415 | 422, error: string) => {
    defer(c, "delete rejected upload", () => deleteAssets(bucket, [uploadKey]));
    return c.json({ error }, status);
  };

  // 1. Size, from metadata only.
  const head = await bucket.head(uploadKey);
  if (!head) {
    return c.json({ error: "Upload not found or expired. Please upload the file again." }, 404);
  }
  if (head.size === 0) return reject(400, "The uploaded file is empty");
  if (head.size > MAX_UPLOAD_BYTES[kind]) {
    return reject(413, `File exceeds the ${formatMb(MAX_UPLOAD_BYTES[kind])} limit`);
  }

  // 2. Real type (and image dimensions) from the first 128KB only.
  const prefixObject = await bucket.get(uploadKey, {
    range: { offset: 0, length: Math.min(head.size, SNIFF_BYTES) },
  });
  if (!prefixObject) {
    return c.json({ error: "Upload not found or expired. Please upload the file again." }, 404);
  }
  const prefix = new Uint8Array(await prefixObject.arrayBuffer());
  const fileKind = detectFileKind(prefix);
  const ext = canonicalExtension(kind, fileKind);
  if (!ext) {
    return reject(415, `File contents do not match an allowed format (${ALLOWED_EXTENSIONS[kind].join(", ")})`);
  }

  if (isImageFileKind(fileKind)) {
    let dims = readImageDimensions(prefix, fileKind);
    if (!dims) {
      // Header not in the prefix (e.g. huge EXIF). Images.info is free and
      // runs outside the Worker; we only pipe the stream.
      const full = await bucket.get(uploadKey);
      const info = full ? await c.env.IMAGES.info(full.body).catch(() => null) : null;
      dims = info && "width" in info ? { width: info.width, height: info.height } : null;
    }
    if (!dims) return reject(422, "This image could not be read");
    if (
      dims.width > MAX_IMAGE_SIDE ||
      dims.height > MAX_IMAGE_SIDE ||
      dims.width * dims.height > MAX_IMAGE_PIXELS
    ) {
      return reject(
        413,
        `Image is ${dims.width}×${dims.height}px; the maximum is ${MAX_IMAGE_SIDE}px per side and ${MAX_IMAGE_PIXELS / 1_000_000} megapixels`,
      );
    }
  }

  // 3. Move into place (server-side copy inside R2, trusted content type).
  const finalKey = assetKey(product.id, kind, staged.uploadId, ext);
  try {
    await copyObject(c.env, uploadKey, finalKey, contentTypeFor(ext));
  } catch (error) {
    logError(c, "Failed to move upload into place", error, { productId: product.id, uploadKey });
    return c.json({ error: "Storage is temporarily unavailable. Please try again." }, 503);
  }
  defer(c, "delete staged upload", () => deleteAssets(bucket, [uploadKey]));

  // 4. Point the product at it (compare-and-set against concurrent uploads).
  const swap = await swapAssetKey(prisma, product, kind, finalKey);
  if (!swap.ok) {
    defer(c, "discard upload that lost a race", () => deleteAssets(bucket, [finalKey]));
    return c.json(
      { error: "This asset was replaced by another upload at the same time. Refresh and try again." },
      409,
    );
  }
  const oldKey = swap.oldKey;
  if (oldKey && oldKey !== finalKey) {
    defer(c, "delete replaced asset", () => deleteAssets(bucket, [oldKey]));
  }

  if (!IMAGE_ASSET_KINDS.includes(kind as AssetKind)) return c.json({ key: finalKey });

  // 5. Derivatives (Images binding: I/O wait, not Worker CPU).
  const derivatives = await generateDerivatives(c, prisma, product.id);
  return c.json({
    key: finalKey,
    // SUPERSEDED: a newer upload/regeneration owns the derivatives now.
    thumbnailStatus: derivatives.status === "SUPERSEDED" ? "PENDING" : derivatives.status,
    thumbnailKey: derivatives.status === "READY" ? derivatives.thumbnailKey : null,
    ...(derivatives.status === "FAILED" && { thumbnailError: derivatives.error }),
  });
});

/**
 * Regenerates storefront derivatives: the blurred elevation thumbnail for
 * floor plans, the card/hero previews for interior plans (also the backfill
 * path for products uploaded before versioned previews existed).
 */
adminProductsRouter.post("/:id/thumbnail", async (c) => {
  const productId = c.req.param("id");
  const limited =
    (await rateLimit(c, "RL_THUMB_USER", c.get("session").user.id)) ??
    (await rateLimit(c, "RL_THUMB_PRODUCT", productId));
  if (limited) return limited;

  const prisma = getPrisma(c);
  const product = await getProduct(prisma, productId);
  if (!product) return c.json({ error: "Product not found" }, 404);
  const sourceKey =
    product.type === "FLOOR_PLAN" ? product.floorPlan?.elevationKey : product.interiorPlan?.previewKey;
  if (!sourceKey) {
    return c.json(
      { error: product.type === "FLOOR_PLAN" ? "Upload an elevation image first" : "Upload a preview image first" },
      400,
    );
  }

  const result = await generateDerivatives(c, prisma, product.id);
  if (result.status === "FAILED") return c.json({ error: result.error, thumbnailStatus: "FAILED" }, 422);
  if (result.status === "SUPERSEDED") {
    return c.json({ error: "The image changed while regenerating. Refresh and try again." }, 409);
  }
  return c.json({ thumbnailKey: result.thumbnailKey, thumbnailStatus: "READY" });
});
