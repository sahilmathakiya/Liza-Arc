import { Hono } from "hono";
import type { Context } from "hono";
import { getSession } from "../auth";
import type { Session } from "../auth";
import { getPrisma } from "../db";
import type { Prisma } from "../db";
import { createZip } from "../lib/archive";
import { detectFileKind } from "../lib/file-type";
import type { FileKind } from "../lib/file-type";
import { logError } from "../lib/log";
import { rateLimit } from "../lib/rate-limit";
import { downloadResponseHeaders } from "../lib/r2";
import { isAdminRole } from "../roles";
import type { EntitlementType } from "../schema/enums";
import { hasEntitlement } from "../services/entitlements";
import { getDeliverableAsset, previewVersion, type PaidAssetKind } from "../services/products";
import { WatermarkError, createWatermarkedDownload } from "../services/watermark";

export const assetsRouter = new Hono<{ Bindings: Env }>();

const PAID_KINDS: readonly string[] = ["floor-plan", "elevation", "working-drawing"];
const BUNDLE_KIND = "bundle";
const ARCHIVE_CONTENT_TYPE = "application/zip";
const EXPIRED_ACCESS_MESSAGE =
  "Your access to this item has expired. Purchase it again to download.";

type AssetsContext = Context<{ Bindings: Env }>;
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

/**
 * Streams a public storefront image straight from R2 (no processing, no
 * buffering). Versioned URLs (matching ?v=) are cached for a year; anything
 * else gets a short TTL. Conditional requests are answered with 304 by R2.
 */
async function servePublicImage(
  c: AssetsContext,
  key: string,
  versioned: boolean,
  fallbackContentType: string,
): Promise<Response> {
  const object = await c.env.BUCKET.get(key, { onlyIf: c.req.raw.headers });
  if (!object) return c.json({ error: "Image not found" }, 404);
  const cacheControl = versioned ? "public, max-age=31536000, immutable" : "public, max-age=300";
  if (!("body" in object)) {
    return c.body(null, 304, { etag: object.httpEtag, "cache-control": cacheControl });
  }
  return c.body(object.body, 200, {
    "content-type": object.httpMetadata?.contentType ?? fallbackContentType,
    "content-length": String(object.size),
    "cache-control": cacheControl,
    etag: object.httpEtag,
    "x-content-type-options": "nosniff",
  });
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
  logError(c, "Failed to prepare watermarked download", error, { productId, kind });
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

// Public storefront images. These only ever stream pre-generated objects:
// image processing happens at upload/regenerate time (admin-only, rate
// limited), never on a visitor's request.
assetsRouter.get("/interior/:id/preview", async (c) => {
  const limited = await rateLimit(c, "RL_PUBLIC_ASSETS");
  if (limited) return limited;

  const productId = c.req.param("id");
  const product = await getPrisma(c).product.findFirst({
    where: { id: productId, published: true, type: "INTERIOR_PLAN" },
    select: {
      interiorPlan: { select: { previewKey: true, previewCardKey: true, previewHeroKey: true } },
    },
  });
  const plan = product?.interiorPlan;
  if (!plan?.previewKey) return c.json({ error: "Preview not found" }, 404);

  // Derivatives missing (legacy product or generation failed): serve the
  // original rather than generating on demand.
  const size = c.req.query("size");
  const key =
    (size === "card" ? plan.previewCardKey : size === "hero" ? plan.previewHeroKey : null) ??
    plan.previewKey;
  const versioned = c.req.query("v") === previewVersion(plan);
  return servePublicImage(c, key, versioned, "application/octet-stream");
});

assetsRouter.get("/floor-plan/:id/thumbnail", async (c) => {
  const limited = await rateLimit(c, "RL_PUBLIC_ASSETS");
  if (limited) return limited;

  const product = await getPrisma(c).product.findFirst({
    where: { id: c.req.param("id"), published: true, type: "FLOOR_PLAN" },
    select: { floorPlan: { select: { elevationThumbKey: true } } },
  });
  const key = product?.floorPlan?.elevationThumbKey;
  if (!key) return c.json({ error: "Thumbnail not found" }, 404);
  return servePublicImage(c, key, c.req.query("v") === key, "image/jpeg");
});

assetsRouter.get("/products/:id/:kind", async (c) => {
  const kind = c.req.param("kind");
  const isBundle = kind === BUNDLE_KIND;
  if (!isBundle && !PAID_KINDS.includes(kind)) return c.json({ error: "Invalid asset kind" }, 400);

  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const limited = await rateLimit(c, "RL_DOWNLOAD", session.user.id);
  if (limited) return limited;

  const productId = c.req.param("id");
  const prisma = getPrisma(c);
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
