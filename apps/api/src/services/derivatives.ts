import type { Context } from "hono";
import type { Prisma } from "../db";
import { defer, logError } from "../lib/log";
import {
  deleteAssets,
  elevationThumbKey,
  interiorPreviewCardKey,
  interiorPreviewHeroKey,
  legacyPreviewDerivativeKeys,
} from "../lib/r2";
import {
  commitElevationThumb,
  commitPreviewDerivatives,
  getProduct,
  markDerivativesFailed,
} from "./products";

/**
 * Storefront image derivatives are produced by the Cloudflare Images binding.
 * The Worker only pipes an R2 stream into the binding and stores the (small)
 * result, so decoding/resizing/blurring never touches the Worker's 10ms CPU
 * or 128MB memory budget, no matter how large the source image is.
 */

export const MAX_IMAGE_SIDE = 12_000;
export const MAX_IMAGE_PIXELS = 50_000_000;

const THUMB_MAX_DIMENSION = 640;
const THUMB_BLUR_RADIUS = 2;
const THUMB_JPEG_QUALITY = 55;
const PREVIEW_CARD_MAX_DIMENSION = 640;
const PREVIEW_HERO_MAX_DIMENSION = 1600;
const PREVIEW_CARD_QUALITY = 80;
const PREVIEW_HERO_QUALITY = 85;

export class DerivativeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DerivativeError";
  }
}

async function transformToR2(
  env: Env,
  sourceKey: string,
  destKey: string,
  transforms: ImageTransform[],
  output: ImageOutputOptions,
): Promise<void> {
  const source = await env.BUCKET.get(sourceKey);
  if (!source) throw new DerivativeError("The source image is missing from storage.");

  let transformer = env.IMAGES.input(source.body);
  for (const transform of transforms) transformer = transformer.transform(transform);
  const result = await transformer.output(output);

  // Derivatives are small (tens to a few hundred KB); R2 needs a known length.
  const bytes = await result.response().arrayBuffer();
  await env.BUCKET.put(destKey, bytes, { httpMetadata: { contentType: result.contentType() } });
}

function friendlyMessage(error: unknown): string {
  if (error instanceof DerivativeError) return error.message;
  const code = (error as { code?: unknown })?.code;
  if (code === 9412) return "This file is not a readable image.";
  return "Image processing is temporarily unavailable. Try regenerating in a few minutes.";
}

export type DerivativeResult =
  | { status: "READY"; thumbnailKey: string }
  | { status: "FAILED"; error: string }
  | { status: "SUPERSEDED" };

/**
 * (Re)generates the storefront derivatives for a product from its *current*
 * source image and commits them with compare-and-set. Never throws: failures
 * mark the product FAILED (admin can retry) and are logged.
 */
export async function generateDerivatives(
  c: Context<any>,
  prisma: Prisma,
  productId: string,
): Promise<DerivativeResult> {
  const product = await getProduct(prisma, productId);
  if (!product) return { status: "FAILED", error: "Product not found" };
  const env = c.env as Env;

  if (product.type === "FLOOR_PLAN" && product.floorPlan?.elevationKey) {
    const sourceKey = product.floorPlan.elevationKey;
    const previousThumb = product.floorPlan.elevationThumbKey;
    const thumbKey = elevationThumbKey(product.id);
    try {
      await transformToR2(
        env,
        sourceKey,
        thumbKey,
        [
          { width: THUMB_MAX_DIMENSION, height: THUMB_MAX_DIMENSION, fit: "scale-down" },
          { blur: THUMB_BLUR_RADIUS },
        ],
        { format: "image/jpeg", quality: THUMB_JPEG_QUALITY, anim: false },
      );
      const committed = await commitElevationThumb(prisma, product.id, sourceKey, previousThumb, thumbKey);
      if (!committed) {
        // A newer elevation/thumbnail landed meanwhile; ours is stale.
        defer(c, "discard superseded thumbnail", () => deleteAssets(env.BUCKET, [thumbKey]));
        return { status: "SUPERSEDED" };
      }
      if (previousThumb) defer(c, "delete old thumbnail", () => deleteAssets(env.BUCKET, [previousThumb]));
      return { status: "READY", thumbnailKey: thumbKey };
    } catch (error) {
      logError(c, "Elevation thumbnail generation failed", error, { productId: product.id, sourceKey });
      defer(c, "discard partial thumbnail", () => deleteAssets(env.BUCKET, [thumbKey]));
      await markDerivativesFailed(prisma, product.type, product.id, sourceKey).catch((e) =>
        logError(c, "Failed to mark thumbnail FAILED", e, { productId: product.id }),
      );
      return { status: "FAILED", error: friendlyMessage(error) };
    }
  }

  if (product.type === "INTERIOR_PLAN" && product.interiorPlan?.previewKey) {
    const plan = product.interiorPlan;
    const sourceKey = plan.previewKey!;
    const version = crypto.randomUUID();
    const cardKey = interiorPreviewCardKey(product.id, version);
    const heroKey = interiorPreviewHeroKey(product.id, version);
    try {
      await Promise.all([
        transformToR2(
          env,
          sourceKey,
          cardKey,
          [{ width: PREVIEW_CARD_MAX_DIMENSION, height: PREVIEW_CARD_MAX_DIMENSION, fit: "scale-down" }],
          { format: "image/webp", quality: PREVIEW_CARD_QUALITY, anim: false },
        ),
        transformToR2(
          env,
          sourceKey,
          heroKey,
          [{ width: PREVIEW_HERO_MAX_DIMENSION, height: PREVIEW_HERO_MAX_DIMENSION, fit: "scale-down" }],
          { format: "image/webp", quality: PREVIEW_HERO_QUALITY, anim: false },
        ),
      ]);
      const committed = await commitPreviewDerivatives(
        prisma,
        product.id,
        sourceKey,
        { cardKey: plan.previewCardKey, heroKey: plan.previewHeroKey },
        { cardKey, heroKey },
      );
      if (!committed) {
        defer(c, "discard superseded previews", () => deleteAssets(env.BUCKET, [cardKey, heroKey]));
        return { status: "SUPERSEDED" };
      }
      defer(c, "delete old previews", () =>
        deleteAssets(env.BUCKET, [
          plan.previewCardKey,
          plan.previewHeroKey,
          ...legacyPreviewDerivativeKeys(product.id),
        ]),
      );
      return { status: "READY", thumbnailKey: cardKey };
    } catch (error) {
      logError(c, "Interior preview derivative generation failed", error, { productId: product.id, sourceKey });
      defer(c, "discard partial previews", () => deleteAssets(env.BUCKET, [cardKey, heroKey]));
      await markDerivativesFailed(prisma, product.type, product.id, sourceKey).catch((e) =>
        logError(c, "Failed to mark previews FAILED", e, { productId: product.id }),
      );
      return { status: "FAILED", error: friendlyMessage(error) };
    }
  }

  return {
    status: "FAILED",
    error: product.type === "FLOOR_PLAN" ? "Upload an elevation image first" : "Upload a preview image first",
  };
}
