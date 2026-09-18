import { Link, createFileRoute } from '@tanstack/react-router'
import { BuyBox } from '#/components/store/buy-box'
import { Container } from '#/components/ui/layout'
import type { AppSession } from '#/lib/auth'
import { getSessionSafe } from '#/lib/auth'
import { INTERIOR_CATEGORY_LABELS, getProductBySlug, interiorPreviewUrl } from '#/lib/products'

export const Route = createFileRoute('/_store/interiors/$slug')({
  head: () => ({
    meta: [{ title: 'Interior plan — liza-arch' }],
  }),
  loader: async ({ params }) => {
    const [product, session] = await Promise.all([
      getProductBySlug(params.slug),
      getSessionSafe(),
    ])
    return { product, session: session as AppSession | null }
  },
  component: InteriorDetailPage,
})

function InteriorDetailPage() {
  const { product, session } = Route.useLoaderData()
  const interiorPlan = product.interiorPlan

  if (!interiorPlan) {
    return (
      <Container className="py-16">
        <p className="text-sm text-ink-soft">This product is not an interior plan.</p>
      </Container>
    )
  }

  return (
    <Container className="py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link to="/interiors" className="transition hover:text-ink">
          Interior plans
        </Link>
        <span aria-hidden className="mx-2 text-ink-faint">
          /
        </span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-lg border border-line bg-surface-muted">
            {interiorPlan.hasPreview ? (
              <img
                src={interiorPreviewUrl(product.id, 'hero')}
                alt={`Preview of ${product.name}`}
                decoding="async"
                fetchPriority="high"
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-ink-faint">
                Preview coming soon
              </div>
            )}
          </div>

          <div className="rounded-lg border border-line bg-surface p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              {INTERIOR_CATEGORY_LABELS[interiorPlan.category]}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{product.name}</h1>
            {product.description && (
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{product.description}</p>
            )}
            <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-faint">
              The preview image above is free to view. Purchase to download the complete working
              drawing.
            </p>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <BuyBox product={product} session={session} />
        </div>
      </div>
    </Container>
  )
}
