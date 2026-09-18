import { Hono } from "hono";
import type { Context } from "hono";
import { createAuth } from "../auth";
import type { Session } from "../auth";
import { createPrisma } from "../db";
import { createZip } from "../lib/archive";
import { detectFileKind } from "../lib/file-type";
import type { FileKind } from "../lib/file-type";
import {
  downloadResponseHeaders,
  interiorPreviewCardKey,
  interiorPreviewHeroKey,
  putAsset,
} from "../lib/r2";
import { isAdminRole } from "../roles";
import type { EntitlementType } from "../schema/enums";
import { hasEntitlement } from "../services/entitlements";
import { getDeliverableAsset, type PaidAssetKind } from "../services/products";
import {
  INTERIOR_PREVIEW_CARD_MAX_DIMENSION,
  INTERIOR_PREVIEW_HERO_MAX_DIMENSION,
  createResizedWebp,
} from "../services/thumbnail";
import { WatermarkError, createWatermarkedDownload } from "../services/watermark";

export const assetsRouter = new Hono<{ Bindings: Env }>();

const PAID_KINDS: readonly string[] = ["floor-plan", "elevation", "working-drawing"];
const BUNDLE_KIND = "bundle";
const ARCHIVE_CONTENT_TYPE = "application/zip";
const EXPIRED_ACCESS_MESSAGE =
  "Your access to this item has expired. Purchase it again to download.";

type AssetsContext = Context<{ Bindings: Env }>;
type Prisma = ReturnType<typeof createPrisma>;
type Identity = { name: string; email: string };

const EXTENSION_BY_KIND: Record<FileKind, string> = {
  pdf: ".pdf",
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
  zip: ".zip",
  unknown: "",
};

function withFileExtension(filename: string, extension: string): string {
  if (!extension) return filename;
  return `${filename.replace(/\.[^./\\]+$/, "")}${extension}`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

type PreviewSize = "card" | "hero";

function previewDerivativeKey(productId: string, size: PreviewSize): string {
  return size === "card" ? interiorPreviewCardKey(productId) : interiorPreviewHeroKey(productId);
}

/**
 * Returns the resized storefront preview derivative, generating and storing it
 * on first request so products uploaded before derivatives existed still get
 * optimized. Any failure is non-fatal: the caller falls back to the original.
 */
async function getOrCreatePreviewDerivative(
  c: AssetsContext,
  productId: string,
  sourceKey: string,
  size: PreviewSize,
): Promise<R2ObjectBody | null> {
  const derivativeKey = previewDerivativeKey(productId, size);
  const existing = await c.env.BUCKET.get(derivativeKey);
  if (existing) return existing;

  const sourceObject = await c.env.BUCKET.get(sourceKey);
  if (!sourceObject) return null;

  try {
    const bytes = new Uint8Array(await sourceObject.arrayBuffer());
    const maxDimension =
      size === "card"
        ? INTERIOR_PREVIEW_CARD_MAX_DIMENSION
        : INTERIOR_PREVIEW_HERO_MAX_DIMENSION;
    const derivative = createResizedWebp(bytes, detectFileKind(bytes), maxDimension);
    await putAsset(c.env.BUCKET, derivativeKey, derivative.bytes, derivative.contentType);
    return await c.env.BUCKET.get(derivativeKey);
  } catch (error) {
    console.error("Failed to generate interior preview derivative on demand", {
      productId,
      size,
      message: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }
}

function watermarkFailure(
  c: AssetsContext,
  productId: string,
  kind: string,
  error: unknown,
): Response {
  if (error instanceof WatermarkError && error.status !== 500) {
    return c.json({ error: error.message }, error.status);
  }
  console.error("Failed to prepare watermarked download", {
    productId,
    kind,
    message: error instanceof Error ? error.message : "unknown error",
  });
  return c.json({ error: "Unable to prepare the watermarked file." }, 500);
}

/** Returns a 403 response when the caller may not download the entitlement, else null. */
async function denyIfNotEntitled(
  c: AssetsContext,
  prisma: Prisma,
  session: Session,
  productId: string,
  entitlement: EntitlementType,
): Promise<Response | null> {
  if (isAdminRole(session.user.role)) return null;

  const entitled = await hasEntitlement(prisma, session.user.id, productId, entitlement);
  if (entitled) return null;

  const previous = await prisma.entitlement.findFirst({
    where: { userId: session.user.id, productId, type: entitlement },
    select: { id: true },
  });
  return c.json({ error: previous ? EXPIRED_ACCESS_MESSAGE : "You do not own this item" }, 403);
}

assetsRouter.get("/interior/:id/preview", async (c) => {
  const productId = c.req.param("id");
  const prisma = createPrisma(c.env.DATABASE_URL);
  const product = await prisma.product.findFirst({
    where: { id: productId, published: true, type: "INTERIOR_PLAN" },
    select: { interiorPlan: { select: { previewKey: true } } },
  });
  const key = product?.interiorPlan?.previewKey;
  if (!key) return c.json({ error: "Preview not found" }, 404);

  const size = c.req.query("size");
  // Prefer the resized derivative; fall back to the original upload when the
  // derivative cannot be produced (e.g. unreadable source image).
  const derivative =
    size === "card" || size === "hero"
      ? await getOrCreatePreviewDerivative(c, productId, key, size)
      : null;

  const object = derivative ?? (await c.env.BUCKET.get(key));
  if (!object) return c.json({ error: "Preview not found" }, 404);
  return c.body(object.body, 200, {
    "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
    "cache-control": "public, max-age=86400",
    etag: object.etag,
  });
});

assetsRouter.get("/floor-plan/:id/thumbnail", async (c) => {
  const prisma = createPrisma(c.env.DATABASE_URL);
  const product = await prisma.product.findFirst({
    where: { id: c.req.param("id"), published: true, type: "FLOOR_PLAN" },
    select: { floorPlan: { select: { elevationThumbKey: true } } },
  });
  const key = product?.floorPlan?.elevationThumbKey;
  if (!key) return c.json({ error: "Thumbnail not found" }, 404);

  const object = await c.env.BUCKET.get(key);
  if (!object) return c.json({ error: "Thumbnail not found" }, 404);
  return c.body(object.body, 200, {
    "content-type": object.httpMetadata?.contentType ?? "image/jpeg",
    "cache-control": "public, max-age=86400",
    etag: object.etag,
  });
});

assetsRouter.get("/products/:id/:kind", async (c) => {
  const kind = c.req.param("kind");
  const isBundle = kind === BUNDLE_KIND;
  if (!isBundle && !PAID_KINDS.includes(kind)) return c.json({ error: "Invalid asset kind" }, 400);

  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const productId = c.req.param("id");
  const prisma = createPrisma(c.env.DATABASE_URL);
  const identity: Identity = { name: session.user.name, email: session.user.email };

  if (isBundle) {
    const [floorPlan, elevation] = await Promise.all([
      getDeliverableAsset(prisma, productId, "floor-plan"),
      getDeliverableAsset(prisma, productId, "elevation"),
    ]);
    if (!floorPlan || !elevation) return c.json({ error: "Asset not found" }, 404);

    const denied =
      (await denyIfNotEntitled(c, prisma, session, productId, floorPlan.entitlement)) ??
      (await denyIfNotEntitled(c, prisma, session, productId, elevation.entitlement));
    if (denied) return denied;

    const [planObject, elevationObject] = await Promise.all([
      c.env.BUCKET.get(floorPlan.key),
      c.env.BUCKET.get(elevation.key),
    ]);
    if (!planObject || !elevationObject) return c.json({ error: "Asset not found" }, 404);

    try {
      const [planSource, elevationSource] = await Promise.all([
        planObject.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
        elevationObject.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
      ]);
      const [planFile, elevationFile] = await Promise.all([
        createWatermarkedDownload({ source: planSource, kind: detectFileKind(planSource), identity }),
        createWatermarkedDownload({
          source: elevationSource,
          kind: detectFileKind(elevationSource),
          identity,
        }),
      ]);

      const archive = createZip([
        { name: floorPlan.filename, data: planFile.bytes },
        { name: elevation.filename, data: elevationFile.bytes },
      ]);

      return c.body(
        toArrayBuffer(archive),
        200,
        downloadResponseHeaders({
          contentType: ARCHIVE_CONTENT_TYPE,
          size: archive.byteLength,
          filename: `${floorPlan.slug}-bundle.zip`,
        }),
      );
    } catch (error) {
      return watermarkFailure(c, productId, BUNDLE_KIND, error);
    }
  }

  const asset = await getDeliverableAsset(prisma, productId, kind as PaidAssetKind);
  if (!asset) return c.json({ error: "Asset not found" }, 404);

  const denied = await denyIfNotEntitled(c, prisma, session, productId, asset.entitlement);
  if (denied) return denied;

  const object = await c.env.BUCKET.get(asset.key);
  if (!object) return c.json({ error: "Asset not found" }, 404);

  const source = new Uint8Array(await object.arrayBuffer());
  const fileKind = detectFileKind(source);

  // Working drawings delivered as archives cannot be watermarked without
  // unpacking their contents. They stay entitlement-gated and are returned as
  // stored; every PDF/image download goes through the watermarker below.
  if (fileKind === "zip") {
    return c.body(
      toArrayBuffer(source),
      200,
      downloadResponseHeaders({
        contentType: object.httpMetadata?.contentType ?? ARCHIVE_CONTENT_TYPE,
        size: source.byteLength,
        filename: asset.filename,
      }),
    );
  }

  try {
    const watermarked = await createWatermarkedDownload({ source, kind: fileKind, identity });

    return c.body(
      toArrayBuffer(watermarked.bytes),
      200,
      downloadResponseHeaders({
        contentType: watermarked.contentType,
        size: watermarked.bytes.byteLength,
        filename: withFileExtension(asset.filename, EXTENSION_BY_KIND[fileKind]),
      }),
    );
  } catch (error) {
    return watermarkFailure(c, productId, kind, error);
  }
});
