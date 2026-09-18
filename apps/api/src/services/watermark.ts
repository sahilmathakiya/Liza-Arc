import {
  PhotonImage,
  Rgba,
  draw_text_with_color,
  watermark as drawWatermark,
} from "@cf-wasm/photon/workerd";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { isImageFileKind } from "../lib/file-type";
import type { FileKind, ImageFileKind } from "../lib/file-type";

export interface WatermarkIdentity {
  name: string;
  email: string;
  phone?: string | null;
}

export interface WatermarkedFile {
  bytes: Uint8Array;
  contentType: string;
}

export class WatermarkError extends Error {
  readonly status: 413 | 422 | 500;

  constructor(message: string, status: 413 | 422 | 500 = 500) {
    super(message);
    this.name = "WatermarkError";
    this.status = status;
  }
}

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 8_000_000;

const BULLET = "\u2022";

export function buildWatermarkText(identity: WatermarkIdentity): string {
  const parts = [identity.name, identity.email, identity.phone]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());
  return `Downloaded by: ${parts.join(` ${BULLET} `)}`;
}

export function buildWatermarkFooter(identity: WatermarkIdentity): string {
  return `Licensed to ${identity.email}`;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const PDF_TEXT_COLOR = rgb(0.35, 0.35, 0.35);
const PDF_WATERMARK_OPACITY = 0.16;
const PDF_FOOTER_OPACITY = 0.5;
const PDF_ANGLE = 45;

/**
 * pdf-lib writes with the standard fonts, which only support WinAnsi (CP1252).
 * Replace anything outside that range so unusual names never break the export.
 */
function toWinAnsiSafe(text: string): string {
  let safe = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const encodable =
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa0 && code <= 0xff) ||
      code === 0x2022;
    safe += encodable ? char : "?";
  }
  return safe;
}

function fitFontSize(font: PDFFont, text: string, maxWidth: number, preferred: number): number {
  let size = preferred;
  while (size > 9 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

function drawDiagonalWatermarks(page: PDFPage, font: PDFFont, text: string): void {
  const { width, height } = page.getSize();
  const maxTextWidth = Math.hypot(width, height) * 0.5;
  const preferred = Math.min(44, Math.max(16, width / 12));
  const size = fitFontSize(font, text, maxTextWidth, preferred);
  const textWidth = font.widthOfTextAtSize(text, size);
  const textHeight = font.heightAtSize(size);
  const radians = (PDF_ANGLE * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rows = 3;

  for (let row = 1; row <= rows; row += 1) {
    const centerX = width / 2;
    const centerY = (height * row) / (rows + 1);
    const x = centerX - (cos * textWidth) / 2 + (sin * textHeight) / 2;
    const y = centerY - (sin * textWidth) / 2 - (cos * textHeight) / 2;
    page.drawText(text, {
      x,
      y,
      size,
      font,
      color: PDF_TEXT_COLOR,
      opacity: PDF_WATERMARK_OPACITY,
      rotate: degrees(PDF_ANGLE),
    });
  }
}

export async function watermarkPdf(
  source: Uint8Array,
  identity: WatermarkIdentity,
): Promise<Uint8Array> {
  if (source.byteLength > MAX_PDF_BYTES) {
    throw new WatermarkError("This PDF is too large to prepare for download.", 413);
  }

  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(source, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    throw new WatermarkError("This PDF could not be processed.", 422);
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const watermarkText = toWinAnsiSafe(buildWatermarkText(identity));
  const footerText = toWinAnsiSafe(buildWatermarkFooter(identity));

  for (const page of pdf.getPages()) {
    drawDiagonalWatermarks(page, font, watermarkText);
    page.drawText(footerText, {
      x: 24,
      y: 18,
      size: 7,
      font,
      color: PDF_TEXT_COLOR,
      opacity: PDF_FOOTER_OPACITY,
    });
  }

  return pdf.save();
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

interface ImageColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

const IMAGE_TEXT_COLOR: ImageColor = { r: 40, g: 40, b: 40, a: 80 };
const IMAGE_FOOTER_COLOR: ImageColor = { r: 40, g: 40, b: 40, a: 110 };
const IMAGE_CHAR_WIDTH_RATIO = 0.56;

function pickImageFontSize(width: number, height: number, textLength: number): number {
  const preferred = Math.round(Math.min(width, height) / 16);
  const byWidth = Math.floor((width * 0.8) / Math.max(1, textLength * IMAGE_CHAR_WIDTH_RATIO));
  return Math.max(12, Math.min(preferred, byWidth));
}

/**
 * Renders a single line of text onto its own small transparent layer. Keeping
 * the layer tight to the text avoids full-size intermediate buffers, which
 * matters on Workers' limited memory.
 */
function renderTextLayer(text: string, size: number, color: ImageColor): PhotonImage {
  const width = Math.max(8, Math.round(text.length * IMAGE_CHAR_WIDTH_RATIO * size) + 8);
  const height = Math.max(8, Math.round(size * 1.5));
  const layer = new PhotonImage(new Uint8Array(width * height * 4), width, height);
  try {
    // draw_text_with_color takes ownership of the Rgba and frees it, so a
    // fresh instance is required on every call (module-level reuse would pass
    // a dangling pointer on the next request).
    draw_text_with_color(layer, text, 0, size, size, new Rgba(color.r, color.g, color.b, color.a));
    return layer;
  } catch (error) {
    layer.free();
    throw error;
  }
}

export function watermarkImage(
  source: Uint8Array,
  format: ImageFileKind,
  identity: WatermarkIdentity,
): WatermarkedFile {
  let image: PhotonImage | null = null;
  let mainLayer: PhotonImage | null = null;
  let footerLayer: PhotonImage | null = null;

  try {
    image = PhotonImage.new_from_byteslice(source);
    const width = image.get_width();
    const height = image.get_height();

    if (width <= 0 || height <= 0) {
      throw new WatermarkError("This image could not be processed.", 422);
    }
    if (width * height > MAX_IMAGE_PIXELS) {
      throw new WatermarkError("This image is too large to prepare for download.", 413);
    }

    const text = buildWatermarkText(identity);
    const size = pickImageFontSize(width, height, text.length);
    const layerWidth = Math.round(text.length * IMAGE_CHAR_WIDTH_RATIO * size) + 8;
    const bandHeight = height / 4;

    mainLayer = renderTextLayer(text, size, IMAGE_TEXT_COLOR);
    for (let row = 1; row <= 3; row += 1) {
      const centeredX = Math.max(0, Math.round((width - layerWidth) / 2));
      const x = row % 2 === 1 ? centeredX : Math.max(0, centeredX - Math.round(width * 0.06));
      const y = Math.max(0, Math.round(bandHeight * row - size / 2));
      drawWatermark(image, mainLayer, BigInt(x), BigInt(y));
    }

    const footerSize = Math.max(9, Math.round(size * 0.5));
    footerLayer = renderTextLayer(buildWatermarkFooter(identity), footerSize, IMAGE_FOOTER_COLOR);
    drawWatermark(image, footerLayer, 12n, BigInt(Math.max(0, height - footerSize - 8)));

    if (format === "jpeg") {
      return { bytes: image.get_bytes_jpeg(85), contentType: "image/jpeg" };
    }
    if (format === "webp") {
      return { bytes: image.get_bytes_webp(), contentType: "image/webp" };
    }
    return { bytes: image.get_bytes(), contentType: "image/png" };
  } catch (error) {
    if (error instanceof WatermarkError) throw error;
    throw new WatermarkError("This image could not be processed.", 422);
  } finally {
    footerLayer?.free();
    mainLayer?.free();
    image?.free();
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function createWatermarkedDownload(input: {
  source: Uint8Array;
  kind: FileKind;
  identity: WatermarkIdentity;
}): Promise<WatermarkedFile> {
  const { source, kind, identity } = input;

  if (kind === "pdf") {
    return { bytes: await watermarkPdf(source, identity), contentType: "application/pdf" };
  }
  if (isImageFileKind(kind)) {
    return watermarkImage(source, kind, identity);
  }
  throw new WatermarkError("This file type cannot be prepared for download.", 422);
}
