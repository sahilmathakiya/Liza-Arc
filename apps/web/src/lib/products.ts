import { API_URL, apiFetch } from './api'

export type ProductType = 'FLOOR_PLAN' | 'INTERIOR_PLAN'
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
}

export interface InteriorPlanDetails {
  category: InteriorCategory
  workingDrawingPriceCents: number
  previewKey: string | null
  workingDrawingKey: string | null
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

export async function uploadAsset(
  productId: string,
  kind: AssetKind,
  file: File,
): Promise<{ key: string; thumbnailKey: string | null }> {
  const form = new FormData()
  form.append('kind', kind)
  form.append('file', file)
  const res = await fetch(`${API_URL}/api/admin/products/${productId}/assets`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  })
  const data = (await res.json().catch(() => null)) as
    | { key?: string; thumbnailKey?: string | null; error?: string }
    | null
  if (!res.ok || !data?.key) {
    throw new Error(data?.error ?? `Upload failed with status ${res.status}`)
  }
  return { key: data.key, thumbnailKey: data.thumbnailKey ?? null }
}

export function regenerateThumbnail(productId: string) {
  return apiFetch<{ thumbnailKey: string }>(`/api/admin/products/${productId}/thumbnail`, {
    method: 'POST',
  })
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

export function interiorPreviewUrl(productId: string, size: InteriorPreviewSize = 'hero') {
  return `${API_URL}/api/assets/interior/${productId}/preview?size=${size}`
}

export function floorPlanThumbnailUrl(productId: string, version?: string | null) {
  const base = `${API_URL}/api/assets/floor-plan/${productId}/thumbnail`
  return version ? `${base}?v=${encodeURIComponent(version)}` : base
}

export function paidAssetUrl(productId: string, kind: AssetKind) {
  return `${API_URL}/api/assets/products/${productId}/${kind}`
}
