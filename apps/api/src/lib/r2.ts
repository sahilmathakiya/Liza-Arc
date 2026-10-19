import { AwsClient } from "aws4fetch";
import type { ProductType } from "../schema/enums";
import type { FileKind } from "./file-type";

export type AssetKind = "floor-plan" | "elevation" | "preview" | "working-drawing";

export const ASSET_KINDS = ["floor-plan", "elevation", "preview", "working-drawing"] as const satisfies readonly AssetKind[];

export const PRODUCT_ASSET_KINDS: Record<ProductType, readonly AssetKind[]> = {
  FLOOR_PLAN: ["floor-plan", "elevation"],
  INTERIOR_PLAN: ["preview", "working-drawing"],
};

export const IMAGE_ASSET_KINDS: readonly AssetKind[] = ["elevation", "preview"];

const MB = 1024 * 1024;

/**
 * Per-kind upload ceilings. Uploads go straight to R2 so the Worker never
 * holds these bytes; the document limit stays at 100MB because paid downloads
 * are still buffered by the Worker (see the downloads follow-up).
 */
export const MAX_UPLOAD_BYTES: Record<AssetKind, number> = {
  "floor-plan": 100 * MB,
  elevation: 10 * MB,
  preview: 10 * MB,
  "working-drawing": 100 * MB,
};

const ASSET_DIRS: Record<AssetKind, "floor-plans" | "interior-plans"> = {
  "floor-plan": "floor-plans",
  elevation: "floor-plans",
  preview: "interior-plans",
  "working-drawing": "interior-plans",
};

export const ALLOWED_EXTENSIONS: Record<AssetKind, readonly string[]> = {
  "floor-plan": [".pdf"],
  elevation: [".jpg", ".jpeg", ".png", ".webp"],
  preview: [".jpg", ".jpeg", ".png", ".webp"],
  "working-drawing": [".zip", ".pdf"],
};

/** File kinds (detected from magic bytes) accepted for each asset kind. */
const ALLOWED_FILE_KINDS: Record<AssetKind, readonly FileKind[]> = {
  "floor-plan": ["pdf"],
  elevation: ["jpeg", "png", "webp"],
  preview: ["jpeg", "png", "webp"],
  "working-drawing": ["zip", "pdf"],
};

const EXTENSION_FOR_FILE_KIND: Partial<Record<FileKind, string>> = {
  pdf: ".pdf",
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
  zip: ".zip",
};

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

/**
 * Returns the canonical extension for a file whose real type was sniffed, or
 * null when that type is not allowed for the asset kind (e.g. an .exe renamed
 * to .pdf).
 */
export function canonicalExtension(kind: AssetKind, fileKind: FileKind): string | null {
  if (!ALLOWED_FILE_KINDS[kind].includes(fileKind)) return null;
  return EXTENSION_FOR_FILE_KIND[fileKind] ?? null;
}

// ---- keys -----------------------------------------------------------------
// Every stored object gets a unique (uuid) key. Nothing is ever overwritten in
// place, so concurrent uploads cannot clobber each other and public URLs that
// embed the key are safely cacheable forever.

/**
 * Browser uploads land under staging/. A bucket lifecycle rule expires this
 * prefix after 1 day, so abandoned uploads clean themselves up.
 */
export function stagingKey(productId: string, kind: AssetKind, uploadId: string, ext: string): string {
  return `staging/${productId}/${kind}/${uploadId}${ext}`;
}

const STAGING_KEY_PATTERN =
  /^staging\/([A-Za-z0-9_-]{1,64})\/(floor-plan|elevation|preview|working-drawing)\/([0-9a-f-]{36})(\.[a-z]{3,4})$/;

export function parseStagingKey(
  key: string,
): { productId: string; kind: AssetKind; uploadId: string; ext: string } | null {
  const match = STAGING_KEY_PATTERN.exec(key);
  if (!match) return null;
  return { productId: match[1], kind: match[2] as AssetKind, uploadId: match[3], ext: match[4] };
}

export function assetKey(productId: string, kind: AssetKind, version: string, ext: string): string {
  return `${ASSET_DIRS[kind]}/${productId}/${kind}-${version}${ext}`;
}

export function elevationThumbKey(productId: string, version: string = crypto.randomUUID()): string {
  return `${ASSET_DIRS.elevation}/${productId}/elevation-thumb-${version}.jpg`;
}

export function interiorPreviewCardKey(productId: string, version: string = crypto.randomUUID()): string {
  return `${ASSET_DIRS.preview}/${productId}/preview-card-${version}.webp`;
}

export function interiorPreviewHeroKey(productId: string, version: string = crypto.randomUUID()): string {
  return `${ASSET_DIRS.preview}/${productId}/preview-hero-${version}.webp`;
}

/** Fixed-key derivatives written by the previous implementation. */
export function legacyPreviewDerivativeKeys(productId: string): string[] {
  return [
    `${ASSET_DIRS.preview}/${productId}/preview-card.webp`,
    `${ASSET_DIRS.preview}/${productId}/preview-hero.webp`,
  ];
}

export function contentTypeFor(ext: string): string {
  return CONTENT_TYPES[ext.toLowerCase()] ?? "application/octet-stream";
}

export function resolveUploadExtension(filename: string, kind: AssetKind): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return null;
  const ext = filename.slice(dot).toLowerCase();
  return ALLOWED_EXTENSIONS[kind].includes(ext) ? ext : null;
}

// ---- binding helpers ------------------------------------------------------

export async function putAsset(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream | ArrayBuffer | ArrayBufferView | Blob,
  contentType: string,
): Promise<string> {
  await bucket.put(key, body, { httpMetadata: { contentType } });
  return key;
}

export function getAsset(bucket: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}

export async function deleteAssets(bucket: R2Bucket, keys: (string | null | undefined)[]): Promise<void> {
  const existing = [...new Set(keys.filter((key): key is string => Boolean(key)))];
  if (existing.length === 0) return;
  await bucket.delete(existing);
}

// ---- S3 API (presigned uploads, server-side copy) -------------------------
// The R2 binding cannot mint presigned URLs or copy objects, so these go
// through R2's S3-compatible endpoint. Signing is a couple of HMACs (native
// WebCrypto) and the copy happens inside R2: no file bytes touch the Worker.

export function isDirectUploadConfigured(env: Env): boolean {
  return Boolean(env.CF_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME);
}

function s3Client(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
}

function s3ObjectUrl(env: Env, key: string): string {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${path}`;
}

/** Presigned PUT URL the browser uploads to directly. */
export async function presignPut(env: Env, key: string, expiresInSeconds: number): Promise<string> {
  const url = new URL(s3ObjectUrl(env, key));
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
  const signed = await s3Client(env).sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

/** Server-side copy within the bucket, replacing metadata with a trusted content type. */
export async function copyObject(env: Env, sourceKey: string, destKey: string, contentType: string): Promise<void> {
  const source = sourceKey.split("/").map(encodeURIComponent).join("/");
  const res = await s3Client(env).fetch(s3ObjectUrl(env, destKey), {
    method: "PUT",
    headers: {
      "x-amz-copy-source": `/${env.R2_BUCKET_NAME}/${source}`,
      "x-amz-metadata-directive": "REPLACE",
      "content-type": contentType,
    },
  });
  const body = await res.text();
  if (!res.ok || body.includes("<Error>")) {
    throw new Error(`R2 copy failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

// ---- downloads ------------------------------------------------------------

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w.\- ]+/g, "_");
}

/**
 * Headers for a personalized (watermarked) download. The response is
 * user-specific and must never be stored by a shared/CDN cache.
 */
export function downloadResponseHeaders(options: {
  contentType: string;
  size: number;
  filename: string;
}): Record<string, string> {
  return {
    "content-type": options.contentType,
    "content-length": String(options.size),
    "content-disposition": `attachment; filename="${sanitizeFilename(options.filename)}"`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  };
}
