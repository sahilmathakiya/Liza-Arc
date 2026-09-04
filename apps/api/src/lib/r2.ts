import type { ProductType } from "../schema/enums";

export type AssetKind = "floor-plan" | "elevation" | "preview" | "working-drawing";

export const PRODUCT_ASSET_KINDS: Record<ProductType, readonly AssetKind[]> = {
  FLOOR_PLAN: ["floor-plan", "elevation"],
  INTERIOR_PLAN: ["preview", "working-drawing"],
};

export const IMAGE_ASSET_KINDS: readonly AssetKind[] = ["elevation", "preview"];

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

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

export function assetKey(productId: string, kind: AssetKind, ext: string): string {
  return `${ASSET_DIRS[kind]}/${productId}/${kind}${ext}`;
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

export async function putAsset(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream | ArrayBuffer | Blob,
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

export function assetResponseHeaders(object: R2Object, options?: { filename?: string }): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
    "content-length": String(object.size),
    etag: object.etag,
    "cache-control": "private, max-age=3600",
  };
  if (options?.filename) {
    const safe = options.filename.replace(/[^\w.\- ]+/g, "_");
    headers["content-disposition"] = `attachment; filename="${safe}"`;
  }
  return headers;
}
