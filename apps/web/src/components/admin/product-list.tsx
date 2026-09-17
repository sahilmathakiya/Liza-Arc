import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { FormError } from '#/components/auth/form-error'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/ui/feedback'
import type { Product } from '#/lib/products'
import {
  INTERIOR_CATEGORY_LABELS,
  deleteProduct,
  floorPlanThumbnailUrl,
  formatPrice,
  interiorPreviewUrl,
  paidAssetUrl,
  regenerateThumbnail,
  updateProduct,
} from '#/lib/products'

function hasMissingAssets(product: Product): boolean {
  if (product.type === 'FLOOR_PLAN' && product.floorPlan) {
    return !product.floorPlan.floorPlanKey || !product.floorPlan.elevationKey
  }
  if (product.type === 'INTERIOR_PLAN' && product.interiorPlan) {
    return !product.interiorPlan.previewKey || !product.interiorPlan.workingDrawingKey
  }
  return true
}

function AssetDots({ items }: { items: { label: string; present: boolean; href?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) =>
        item.present && item.href ? (
          <a
            key={item.label}
            href={item.href}
            download
            title={`Download ${item.label.toLowerCase()}`}
            className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink underline-offset-2 transition hover:underline"
          >
            {item.label} ↓
          </a>
        ) : (
          <span
            key={item.label}
            title={item.present ? `${item.label} uploaded` : `${item.label} missing`}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              item.present ? 'bg-surface-muted text-ink' : 'border border-line text-ink-faint'
            }`}
          >
            {item.label}
          </span>
        ),
      )}
    </div>
  )
}

export function ProductList({ products }: { products: Product[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function togglePublished(product: Product) {
    setBusyId(product.id)
    setError(null)
    try {
      await updateProduct(product.id, { published: !product.published })
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRegenerateThumbnail(product: Product) {
    setBusyId(product.id)
    setError(null)
    setNotice(null)
    try {
      await regenerateThumbnail(product.id)
      setNotice(`Thumbnail regenerated for "${product.name}".`)
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    setBusyId(product.id)
    setError(null)
    try {
      await deleteProduct(product.id)
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusyId(null)
    }
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title="No products yet"
        message="Create your first floor plan or interior plan to see it here."
        action={
          <Link
            to="/admin/upload"
            className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground transition hover:bg-brand/85"
          >
            Upload product
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-faint">
              <th scope="col" className="px-4 py-3 font-medium">Product</th>
              <th scope="col" className="px-4 py-3 font-medium">Details</th>
              <th scope="col" className="px-4 py-3 font-medium">Prices</th>
              <th scope="col" className="px-4 py-3 font-medium">Assets</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((product) => {
              const floorPlan = product.floorPlan
              const interiorPlan = product.interiorPlan
              const busy = busyId === product.id
              return (
                <tr key={product.id}>
                  <td className="max-w-48 px-4 py-3">
                    <p className="truncate font-medium text-ink">{product.name}</p>
                    <p className="truncate text-xs text-ink-soft">/{product.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {floorPlan ? (
                      <>
                        <p>
                          {floorPlan.lengthFt}×{floorPlan.widthFt} ft · {floorPlan.floorAreaSqFt} sqft
                        </p>
                        <p className="text-xs text-ink-faint">
                          {floorPlan.bedrooms} bed · {floorPlan.bathrooms} bath · {floorPlan.floors}{' '}
                          floor{floorPlan.floors > 1 ? 's' : ''}
                        </p>
                      </>
                    ) : interiorPlan ? (
                      <p>{INTERIOR_CATEGORY_LABELS[interiorPlan.category]}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {floorPlan ? (
                      <>
                        <p>Plan {formatPrice(floorPlan.floorPlanPriceCents)}</p>
                        <p className="text-xs text-ink-faint">
                          Elevation {formatPrice(floorPlan.elevationPriceCents)}
                          {floorPlan.bundlePriceCents != null &&
                            ` · Bundle ${formatPrice(floorPlan.bundlePriceCents)}`}
                        </p>
                      </>
                    ) : interiorPlan ? (
                      <p>{formatPrice(interiorPlan.workingDrawingPriceCents)}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {floorPlan ? (
                      <AssetDots
                        items={[
                          {
                            label: 'Plan',
                            present: Boolean(floorPlan.floorPlanKey),
                            href: floorPlan.floorPlanKey ? paidAssetUrl(product.id, 'floor-plan') : undefined,
                          },
                          {
                            label: 'Elevation',
                            present: Boolean(floorPlan.elevationKey),
                            href: floorPlan.elevationKey ? paidAssetUrl(product.id, 'elevation') : undefined,
                          },
                          {
                            label: 'Thumb',
                            present: Boolean(floorPlan.elevationThumbKey),
                            href: floorPlan.elevationThumbKey
                              ? floorPlanThumbnailUrl(product.id, floorPlan.elevationThumbKey)
                              : undefined,
                          },
                        ]}
                      />
                    ) : interiorPlan ? (
                      <AssetDots
                        items={[
                          {
                            label: 'Preview',
                            present: Boolean(interiorPlan.previewKey),
                            href: interiorPlan.previewKey ? interiorPreviewUrl(product.id) : undefined,
                          },
                          {
                            label: 'Drawing',
                            present: Boolean(interiorPlan.workingDrawingKey),
                            href: interiorPlan.workingDrawingKey
                              ? paidAssetUrl(product.id, 'working-drawing')
                              : undefined,
                          },
                        ]}
                      />
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={product.published ? 'dark' : 'neutral'}>
                      {product.published ? 'Published' : 'Draft'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {hasMissingAssets(product) && (
                        <Link
                          to="/admin/upload"
                          search={{ product: product.id }}
                          className="inline-flex h-8 items-center rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink transition hover:bg-surface-muted"
                        >
                          Complete upload
                        </Link>
                      )}
                      {product.type === 'FLOOR_PLAN' && floorPlan?.elevationKey && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => handleRegenerateThumbnail(product)}
                        >
                          Regenerate thumb
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => togglePublished(product)}>
                        {product.published ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => handleDelete(product)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        {notice && <p className="mb-2 text-sm text-ink-soft">{notice}</p>}
        <FormError message={error} />
      </div>
    </div>
  )
}
