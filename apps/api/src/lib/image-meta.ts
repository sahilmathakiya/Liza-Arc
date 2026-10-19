import type { ImageFileKind } from "./file-type";

export interface ImageDimensions {
  width: number;
  height: number;
}

function be16(b: Uint8Array, i: number): number {
  return (b[i] << 8) | b[i + 1];
}

function be32(b: Uint8Array, i: number): number {
  return ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
}

function le24(b: Uint8Array, i: number): number {
  return b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
}

function png(b: Uint8Array): ImageDimensions | null {
  // 8-byte signature, then the IHDR chunk: length(4) "IHDR"(4) width(4) height(4)
  if (b.length < 24) return null;
  if (b[12] !== 0x49 || b[13] !== 0x48 || b[14] !== 0x44 || b[15] !== 0x52) return null;
  return { width: be32(b, 16), height: be32(b, 20) };
}

function isStartOfFrame(marker: number): boolean {
  return (
    marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
  );
}

function jpeg(b: Uint8Array): ImageDimensions | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2; // standalone markers carry no length
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // EOI / SOS before any SOF
    if (isStartOfFrame(marker)) {
      // FF Cx | length(2) | precision(1) | height(2) | width(2)
      return { height: be16(b, i + 5), width: be16(b, i + 7) };
    }
    i += 2 + be16(b, i + 2);
  }
  return null;
}

function webp(b: Uint8Array): ImageDimensions | null {
  if (b.length < 30) return null;
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (chunk === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) return null;
    return {
      width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
      height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
    };
  }
  if (chunk === "VP8X") {
    return { width: 1 + le24(b, 24), height: 1 + le24(b, 27) };
  }
  return null;
}

/**
 * Reads image dimensions from the file header only, without decoding pixels.
 * Returns null when the header is not inside the provided prefix (e.g. a JPEG
 * with very large EXIF blocks); callers then fall back to Images `info()`.
 */
export function readImageDimensions(prefix: Uint8Array, kind: ImageFileKind): ImageDimensions | null {
  const dims = kind === "png" ? png(prefix) : kind === "jpeg" ? jpeg(prefix) : webp(prefix);
  if (!dims || dims.width <= 0 || dims.height <= 0) return null;
  return dims;
}
