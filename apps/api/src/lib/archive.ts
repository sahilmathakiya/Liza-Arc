import { zipSync } from "fflate";

export interface ArchiveEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Builds a store-only (uncompressed) ZIP. PDFs and images are already
 * compressed, so deflating them again only costs CPU.
 */
export function createZip(entries: ArchiveEntry[]): Uint8Array {
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const entry of entries) {
    files[entry.name] = [entry.data, { level: 0 }];
  }
  return zipSync(files);
}
