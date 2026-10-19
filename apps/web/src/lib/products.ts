import { API_URL, apiFetch, sleep } from './api'

export type ProductType = 'FLOOR_PLAN' | 'INTERIOR_PLAN'
export type DerivativeStatus = 'NONE' | 'PENDING' | 'READY' | 'FAILED'
export type InteriorCategory = 'KITCHEN' | 'HALL' | 'LIVING_ROOM' | 'BEDROOM'
export type AssetKind = 'floor-plan' | 'elevation' | 'preview' | 'working-drawing'

export interface FloorPlanDetails {
  lengthFt: number
  widthFt: number
  floorAreaSqFt: number
  bathrooms: number
  bedrooms: number
  floors: number
  floorPlanPriceCents: number
  elevationPriceCents: number
  bundlePriceCents: number | null
  floorPlanKey: string | null
  elevationKey: string | null
  elevationThumbKey: string | null
  thumbnailStatus: DerivativeStatus
}

export interface InteriorPlanDetails {
  category: InteriorCategory
  workingDrawingPriceCents: number
  previewKey: string | null
  workingDrawingKey: string | null
  previewCardKey: string | null
  previewHeroKey: string | null
  thumbnailStatus: DerivativeStatus
}

export interface Product {
  id: string
  slug: string
  name: string
  description: string | null
  type: ProductType
  published: boolean
  createdAt: string
  floorPlan: FloorPlanDetails | null
  interiorPlan: InteriorPlanDetails | null
}

export interface ProductListResponse {
  total: number
  page: number
  limit: number
  products: Product[]
}

export const PRODUCT_ASSET_KINDS: Record<ProductType, AssetKind[]> = {
  FLOOR_PLAN: ['floor-plan', 'elevation'],
  INTERIOR_PLAN: ['preview', 'working-drawing'],
}

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  'floor-plan': 'Floor plan (PDF)',
  elevation: 'Elevation image',
  preview: 'Preview image',
  'working-drawing': 'Working drawing (ZIP/PDF)',
}

export const INTERIOR_CATEGORY_LABELS: Record<InteriorCategory, string> = {
  KITCHEN: 'Kitchen',
  HALL: 'Hall',
  LIVING_ROOM: 'Living room',
  BEDROOM: 'Bedroom',
}

export function listProducts(page = 1, limit = 50) {
  return apiFetch<ProductListResponse>(`/api/admin/products?page=${page}&limit=${limit}`)
}

export function createProduct(input: unknown) {
  return apiFetch<{ product: Product }>('/api/admin/products', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateProduct(id: string, patch: unknown) {
  return apiFetch<{ product: Product }>(`/api/admin/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function deleteProduct(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/admin/products/${id}`, { method: 'DELETE' })
}

const MB = 1024 * 1024

/** Mirrors the API's MAX_UPLOAD_BYTES; checked before any network traffic. */
export const MAX_UPLOAD_BYTES: Record<AssetKind, number> = {
  'floor-plan': 100 * MB,
  elevation: 10 * MB,
  preview: 10 * MB,
  'working-drawing': 100 * MB,
}

export const ALLOWED_EXTENSIONS: Record<AssetKind, string[]> = {
  'floor-plan': ['.pdf'],
  elevation: ['.jpg', '.jpeg', '.png', '.webp'],
  preview: ['.jpg', '.jpeg', '.png', '.webp'],
  'working-drawing': ['.zip', '.pdf'],
}

/** Returns an error message if the file can be rejected client-side, else null. */
export function validateUploadFile(kind: AssetKind, file: File): string | null {
  const dot = file.name.lastIndexOf('.')
  const ext = dot === -1 ? '' : file.name.slice(dot).toLowerCase()
  if (!ALLOWED_EXTENSIONS[kind].includes(ext)) {
    return `${ASSET_KIND_LABELS[kind]}: allowed formats are ${ALLOWED_EXTENSIONS[kind].join(', ')}`
  }
  if (file.size === 0) return `${ASSET_KIND_LABELS[kind]}: the file is empty`
  if (file.size > MAX_UPLOAD_BYTES[kind]) {
    return `${ASSET_KIND_LABELS[kind]}: file is ${(file.size / MB).toFixed(1)}MB; the limit is ${MAX_UPLOAD_BYTES[kind] / MB}MB`
  }
  return null
}

export type UploadPhase = 'preparing' | 'uploading' | 'processing' | 'waiting'

export interface UploadProgress {
  phase: UploadPhase
  /** 0..1 while uploading */
  fraction?: number
  /** seconds, while waiting on a rate limit or retry */
  waitSeconds?: number
}

export interface UploadResult {
  key: string
  thumbnailStatus?: DerivativeStatus
  thumbnailKey?: string | null
  thumbnailError?: string
}

interface SignedUpload {
  uploadUrl: string
  uploadKey: string
  contentType: string
}

const UPLOAD_RATE_LIMIT_RETRY = { maxRateLimitWait: 65, maxRetries: 3 }
const PUT_MAX_ATTEMPTS = 3

class TransientUploadError extends Error {}

/** PUT straight to R2 via the presigned URL, reporting progress. */
function putToStorage(
  signed: SignedUpload,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signed.uploadUrl)
    xhr.setRequestHeader('Content-Type', signed.contentType)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else if (xhr.status >= 500 || xhr.status === 429) {
        reject(new TransientUploadError(`Storage responded ${xhr.status}`))
      } else reject(new Error(`Upload was rejected by storage (status ${xhr.status})`))
    }
    xhr.onerror = () => reject(new TransientUploadError('Network error while uploading'))
    xhr.ontimeout = () => reject(new TransientUploadError('Upload timed out'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(file)
  })
}

/**
 * Uploads an asset directly to storage:
 *   sign (API) -> PUT to R2 (progress, retried) -> complete (API verifies,
 *   stores and generates thumbnails). The API never streams the file itself.
 */
export async function uploadAsset(
  productId: string,
  kind: AssetKind,
  file: File,
  options: { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal } = {},
): Promise<UploadResult> {
  const { onProgress, signal } = options
  const invalid = validateUploadFile(kind, file)
  if (invalid) throw new Error(invalid)

  const retry = {
    ...UPLOAD_RATE_LIMIT_RETRY,
    onRateLimited: (seconds: number) => onProgress?.({ phase: 'waiting', waitSeconds: seconds }),
  }

  onProgress?.({ phase: 'preparing' })
  const signed = await apiFetch<SignedUpload>(
    `/api/admin/products/${productId}/uploads/sign`,
    { method: 'POST', body: JSON.stringify({ kind, filename: file.name, size: file.size }), signal },
    retry,
  )

  for (let attempt = 1; ; attempt++) {
    try {
      onProgress?.({ phase: 'uploading', fraction: 0 })
      await putToStorage(signed, file, (fraction) => onProgress?.({ phase: 'uploading', fraction }), signal)
      break
    } catch (error) {
      if (!(error instanceof TransientUploadError) || attempt >= PUT_MAX_ATTEMPTS) throw error
      const waitSeconds = 2 ** attempt
      onProgress?.({ phase: 'waiting', waitSeconds })
      await sleep(waitSeconds * 1000)
    }
  }

  onProgress?.({ phase: 'processing' })
  return apiFetch<UploadResult>(
    `/api/admin/products/${productId}/uploads/complete`,
    { method: 'POST', body: JSON.stringify({ kind, uploadKey: signed.uploadKey }), signal },
    retry,
  )
}

export function describeUploadProgress(progress: UploadProgress | null): string | null {
  if (!progress) return null
  switch (progress.phase) {
    case 'preparing':
      return 'Preparing upload…'
    case 'uploading':
      return `Uploading… ${Math.round((progress.fraction ?? 0) * 100)}%`
    case 'processing':
      return 'Verifying and generating previews…'
    case 'waiting':
      return `Server busy, retrying in ${progress.waitSeconds ?? 0}s…`
  }
}

export function regenerateThumbnail(productId: string, onRateLimited?: (seconds: number) => void) {
  return apiFetch<{ thumbnailKey: string; thumbnailStatus: DerivativeStatus }>(
    `/api/admin/products/${productId}/thumbnail`,
    { method: 'POST' },
    { maxRateLimitWait: 65, maxRetries: 1, onRateLimited },
  )
}

export function formatPrice(cents: number): string {
  return `₹${(cents / 100).toLocaleString('en-IN')}`
}

export function rupeesToCents(value: string): number {
  return Math.round(Number(value) * 100)
}

export type EntitlementType = 'FLOOR_PLAN' | 'ELEVATION_IMAGE' | 'WORKING_DRAWING'

export const ENTITLEMENT_TYPE_LABELS: Record<EntitlementType, string> = {
  FLOOR_PLAN: 'Floor plan PDF',
  ELEVATION_IMAGE: 'Elevation image',
  WORKING_DRAWING: 'Working drawing',
}

export interface FloorPlanSearch {
  q?: string
  minLengthFt?: string
  maxLengthFt?: string
  minWidthFt?: string
  maxWidthFt?: string
  minAreaSqFt?: string
  maxAreaSqFt?: string
  sort?: 'createdAt' | 'floorAreaSqFt' | 'lengthFt' | 'widthFt'
  order?: 'asc' | 'desc'
  page?: number
}

export interface InteriorPlanSearch {
  q?: string
  category?: InteriorCategory
  page?: number
}

export interface FloorPlanPublic {
  id: string
  slug: string
  name: string
  description: string | null
  lengthFt: number
  widthFt: number
  floorAreaSqFt: number
  bathrooms: number
  bedrooms: number
  floors: number
  floorPlanPriceCents: number
  elevationPriceCents: number
  bundlePriceCents: number | null
  hasFloorPlan: boolean
  hasElevation: boolean
  hasThumbnail: boolean
  thumbnailVersion: string | null
}

export interface InteriorPlanPublic {
  id: string
  slug: string
  name: string
  description: string | null
  category: InteriorCategory
  workingDrawingPriceCents: number
  hasPreview: boolean
  hasWorkingDrawing: boolean
  previewVersion: string | null
}

export interface CatalogResponse<T> {
  total: number
  page: number
  limit: number
  products: T[]
}

export interface ProductDetail {
  id: string
  slug: string
  name: string
  description: string | null
  type: ProductType
  createdAt: string
  owned: EntitlementType[]
  accessExpiries: { type: EntitlementType; expiresAt: string | null }[]
  expiredTypes: EntitlementType[]
  floorPlan: FloorPlanPublic | null
  interiorPlan: InteriorPlanPublic | null
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  return search.toString()
}

export function listPublicFloorPlans(search: Record<string, string | number | undefined>) {
  return apiFetch<CatalogResponse<FloorPlanPublic>>(
    `/api/products?${buildQueryString({ type: 'FLOOR_PLAN', ...search })}`,
  )
}

export function listPublicInteriorPlans(search: Record<string, string | number | undefined>) {
  return apiFetch<CatalogResponse<InteriorPlanPublic>>(
    `/api/products?${buildQueryString({ type: 'INTERIOR_PLAN', ...search })}`,
  )
}

export async function getProductBySlug(slug: string) {
  const { product } = await apiFetch<{ product: ProductDetail }>(`/api/products/${slug}`)
  return product
}

export type InteriorPreviewSize = 'card' | 'hero'

export function interiorPreviewUrl(
  productId: string,
  size: InteriorPreviewSize = 'hero',
  version?: string | null,
) {
  const base = `${API_URL}/api/assets/interior/${productId}/preview?size=${size}`
  return version ? `${base}&v=${encodeURIComponent(version)}` : base
}

export function floorPlanThumbnailUrl(productId: string, version?: string | null) {
  const base = `${API_URL}/api/assets/floor-plan/${productId}/thumbnail`
  return version ? `${base}?v=${encodeURIComponent(version)}` : base
}

export function paidAssetUrl(productId: string, kind: AssetKind) {
  return `${API_URL}/api/assets/products/${productId}/${kind}`
}
