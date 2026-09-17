import { Link } from '@tanstack/react-router'
import type { FloorPlanPublic } from '#/lib/products'
import { floorPlanThumbnailUrl, formatPrice } from '#/lib/products'

export function FloorPlanCard({ product }: { product: FloorPlanPublic }) {
  const startingPrice = Math.min(product.floorPlanPriceCents, product.elevationPriceCents)
  return (
    <Link
      to="/floor-plans/$slug"
      params={{ slug: product.slug }}
      className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition hover:border-line-strong"
    >
      <div className="h-40 overflow-hidden border-b border-line bg-surface-muted">
        {product.hasThumbnail ? (
          <img
            src={floorPlanThumbnailUrl(product.id)}
            alt={`Elevation preview of ${product.name}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-semibold tracking-tight text-ink">
                {product.widthFt} × {product.lengthFt} ft
              </p>
              <p className="mt-1 text-sm text-ink-soft">{product.floorAreaSqFt} sqft plot</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="font-medium text-ink group-hover:underline">{product.name}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {product.bedrooms} bed · {product.bathrooms} bath · {product.floors} floor
          {product.floors > 1 ? 's' : ''}
        </p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <p className="text-sm text-ink-soft">
            From <span className="font-semibold text-ink">{formatPrice(startingPrice)}</span>
          </p>
          {product.bundlePriceCents != null && (
            <span className="text-xs font-medium text-ink-soft">Bundle available</span>
          )}
        </div>
      </div>
    </Link>
  )
}
