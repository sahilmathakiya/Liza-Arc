export type FileKind = "pdf" | "jpeg" | "png" | "webp" | "zip" | "unknown";

export type ImageFileKind = Extract<FileKind, "jpeg" | "png" | "webp">;

function matchesSignature(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
const ZIP_SIGNATURE = [0x50, 0x4b]; // "PK"

/**
 * Detects the real file type from the leading bytes of a file rather than
 * trusting a filename extension or a client-provided MIME type.
 */
export function detectFileKind(bytes: Uint8Array): FileKind {
  if (matchesSignature(bytes, PDF_SIGNATURE)) return "pdf";
  if (matchesSignature(bytes, PNG_SIGNATURE)) return "png";
  if (matchesSignature(bytes, JPEG_SIGNATURE)) return "jpeg";
  if (matchesSignature(bytes, RIFF_SIGNATURE) && matchesSignature(bytes, WEBP_SIGNATURE, 8)) {
    return "webp";
  }
  if (matchesSignature(bytes, ZIP_SIGNATURE)) return "zip";
  return "unknown";
}

export function isImageFileKind(kind: FileKind): kind is ImageFileKind {
  return kind === "jpeg" || kind === "png" || kind === "webp";
}
