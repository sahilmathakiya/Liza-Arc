import { PhotonImage, SamplingFilter, gaussian_blur, resize } from "@cf-wasm/photon/workerd";
import { isImageFileKind } from "../lib/file-type";
import type { FileKind } from "../lib/file-type";

export interface ThumbnailFile {
  bytes: Uint8Array;
  contentType: string;
}

export class ThumbnailError extends Error {
  readonly status: 413 | 422 | 500;

  constructor(message: string, status: 413 | 422 | 500 = 500) {
    super(message);
    this.name = "ThumbnailError";
    this.status = status;
  }
}

const MAX_DIMENSION = 640;
const BLUR_RADIUS = 2;
const JPEG_QUALITY = 55;
const MAX_SOURCE_PIXELS = 8_000_000;

export const INTERIOR_PREVIEW_CARD_MAX_DIMENSION = 640;
export const INTERIOR_PREVIEW_HERO_MAX_DIMENSION = 1600;

function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Builds the public storefront thumbnail from an elevation image: downscaled so
 * it stays lightweight, blurred so measurements and fine detail cannot be read,
 * and re-encoded as JPEG (which also drops EXIF metadata).
 */
export function createBlurredThumbnail(source: Uint8Array, kind: FileKind): ThumbnailFile {
  if (!isImageFileKind(kind)) {
    throw new ThumbnailError("Only images can be turned into a thumbnail.", 422);
  }

  let image: PhotonImage | null = null;
  let resized: PhotonImage | null = null;

  try {
    image = PhotonImage.new_from_byteslice(source);
    const width = image.get_width();
    const height = image.get_height();

    if (width <= 0 || height <= 0) {
      throw new ThumbnailError("This image could not be processed.", 422);
    }
    if (width * height > MAX_SOURCE_PIXELS) {
      throw new ThumbnailError("This image is too large to process.", 413);
    }

    const target = fitWithin(width, height, MAX_DIMENSION);
    resized = resize(image, target.width, target.height, SamplingFilter.Triangle);
    gaussian_blur(resized, BLUR_RADIUS);

    return { bytes: resized.get_bytes_jpeg(JPEG_QUALITY), contentType: "image/jpeg" };
  } catch (error) {
    if (error instanceof ThumbnailError) throw error;
    throw new ThumbnailError("This image could not be processed.", 422);
  } finally {
    resized?.free();
    image?.free();
  }
}

/**
 * Downscales an image for delivery and re-encodes it as WebP. WebP keeps
 * transparency intact (unlike JPEG) and is far lighter than the original
 * upload, which is what the storefront actually needs for previews.
 */
export function createResizedWebp(
  source: Uint8Array,
  kind: FileKind,
  maxDimension: number,
): ThumbnailFile {
  if (!isImageFileKind(kind)) {
    throw new ThumbnailError("Only images can be resized.", 422);
  }

  let image: PhotonImage | null = null;
  let resized: PhotonImage | null = null;

  try {
    image = PhotonImage.new_from_byteslice(source);
    const width = image.get_width();
    const height = image.get_height();

    if (width <= 0 || height <= 0) {
      throw new ThumbnailError("This image could not be processed.", 422);
    }
    if (width * height > MAX_SOURCE_PIXELS) {
      throw new ThumbnailError("This image is too large to process.", 413);
    }

    const target = fitWithin(width, height, maxDimension);
    resized = resize(image, target.width, target.height, SamplingFilter.Triangle);

    return { bytes: resized.get_bytes_webp(), contentType: "image/webp" };
  } catch (error) {
    if (error instanceof ThumbnailError) throw error;
    throw new ThumbnailError("This image could not be processed.", 422);
  } finally {
    resized?.free();
    image?.free();
  }
}
