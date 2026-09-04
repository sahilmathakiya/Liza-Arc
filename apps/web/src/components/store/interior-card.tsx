import { Link } from '@tanstack/react-router'
import type { InteriorPlanPublic } from '#/lib/products'
import { INTERIOR_CATEGORY_LABELS, formatPrice, interiorPreviewUrl } from '#/lib/products'

export function InteriorCard({ product }: { product: InteriorPlanPublic }) {
  return (
    <Link
      to="/interiors/$slug"
      params={{ slug: product.slug }}
      className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition hover:border-line-strong"
    >
      <div className="h-44 border-b border-line bg-surface-muted">
        {product.hasPreview ? (
          <img
            src={interiorPreviewUrl(product.id)}
            alt={`Preview of ${product.name}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            Preview coming soon
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          {INTERIOR_CATEGORY_LABELS[product.category]}
        </p>
        <p className="mt-1 font-medium text-ink group-hover:underline">{product.name}</p>
        <p className="mt-auto pt-4 text-sm text-ink-soft">
          Working drawing{' '}
          <span className="font-semibold text-ink">
            {formatPrice(product.workingDrawingPriceCents)}
          </span>
        </p>
      </div>
    </Link>
  )
}
