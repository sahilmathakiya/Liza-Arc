import { API_URL } from './api'
import type { AssetKind } from './products'
import { paidAssetUrl } from './products'

const FALLBACK_EXTENSION: Record<AssetKind, string> = {
  'floor-plan': '.pdf',
  elevation: '.jpg',
  preview: '.png',
  'working-drawing': '.zip',
}

export function paidAssetFallbackFilename(slug: string, kind: AssetKind): string {
  return `${slug}-${kind}${FALLBACK_EXTENSION[kind]}`
}

export function bundleFallbackFilename(slug: string): string {
  return `${slug}-bundle.zip`
}

function filenameFromDisposition(disposition: string | null): string | undefined {
  if (!disposition) return undefined
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  const filename = match?.[1]?.trim()
  return filename ? filename : undefined
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Defer revocation so the browser has time to start the download (needed
  // when several files are downloaded in quick succession).
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Downloads a protected asset through the authenticated API endpoint. The file
 * that reaches the browser is always the server-generated, watermarked copy.
 */
async function fetchAndSave(url: string, fallbackFilename: string): Promise<void> {
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error ?? `Download failed with status ${response.status}`)
  }
  const blob = await response.blob()
  const filename = filenameFromDisposition(response.headers.get('content-disposition'))
  saveBlob(blob, filename ?? fallbackFilename)
}

export function downloadPaidAsset(
  productId: string,
  kind: AssetKind,
  fallbackFilename: string,
): Promise<void> {
  return fetchAndSave(paidAssetUrl(productId, kind), fallbackFilename)
}

/** Downloads a floor plan + elevation as one watermarked ZIP. */
export function downloadBundle(productId: string, fallbackFilename: string): Promise<void> {
  return fetchAndSave(`${API_URL}/api/assets/products/${productId}/bundle`, fallbackFilename)
}
