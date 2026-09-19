import { Link, createFileRoute } from '@tanstack/react-router'
import { BuyBox } from '#/components/store/buy-box'
import { Container } from '#/components/ui/layout'
import type { AppSession } from '#/lib/auth'
import { getSessionSafe } from '#/lib/auth'
import { floorPlanThumbnailUrl, getProductBySlug } from '#/lib/products'

export const Route = createFileRoute('/_store/floor-plans/$slug')({
  head: () => ({
    meta: [{ title: 'Floor plan — liza-arch' }],
  }),
  loader: async ({ params }) => {
    const [product, session] = await Promise.all([
      getProductBySlug(params.slug),
      getSessionSafe(),
    ])
    return { product, session: session as AppSession | null }
  },
  component: FloorPlanDetailPage,
})

function FloorPlanDetailPage() {
  const { product, session } = Route.useLoaderData()
  const floorPlan = product.floorPlan

  if (!floorPlan) {
    return (
      <Container className="py-16">
        <p className="text-sm text-ink-soft">This product is not a floor plan.</p>
      </Container>
    )
  }

  const specs = [
    { label: 'Plot size', value: `${floorPlan.widthFt} × ${floorPlan.lengthFt} ft` },
    { label: 'Floor area', value: `${floorPlan.floorAreaSqFt} sqft` },
    { label: 'Bedrooms', value: String(floorPlan.bedrooms) },
    { label: 'Bathrooms', value: String(floorPlan.bathrooms) },
    { label: 'Floors', value: String(floorPlan.floors) },
  ]

  return (
    <Container className="py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link to="/floor-plans" className="transition hover:text-ink">
          Floor plans
        </Link>
        <span aria-hidden className="mx-2 text-ink-faint">
          /
        </span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-lg border border-line bg-surface-muted">
            {floorPlan.hasThumbnail ? (
              <img
                src={floorPlanThumbnailUrl(product.id, floorPlan.thumbnailVersion)}
                alt={`Elevation preview of ${product.name}`}
                decoding="async"
                fetchPriority="high"
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex h-72 items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-semibold tracking-tight text-ink">
                    {floorPlan.widthFt} × {floorPlan.lengthFt} ft
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">{floorPlan.floorAreaSqFt} sqft plot</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-line bg-surface p-6">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{product.name}</h1>
            {product.description && (
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{product.description}</p>
            )}
            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line-subtle sm:grid-cols-3">
              {specs.map((spec) => (
                <div key={spec.label} className="bg-surface p-3">
                  <dt className="text-xs uppercase tracking-wide text-ink-faint">{spec.label}</dt>
                  <dd className="mt-1 font-medium text-ink">{spec.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">
              The floor plan PDF and elevation image are sold separately or together as a bundle.
              Files are delivered instantly after purchase.
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
