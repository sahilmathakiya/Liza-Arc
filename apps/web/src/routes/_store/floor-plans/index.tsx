import { Link, createFileRoute } from '@tanstack/react-router'
import { FloorPlanCard } from '#/components/store/floor-plan-card'
import { FloorPlanFilters } from '#/components/store/floor-plan-filters'
import { EmptyState } from '#/components/ui/feedback'
import { Container, PageHeader } from '#/components/ui/layout'
import type { FloorPlanSearch } from '#/lib/products'
import { listPublicFloorPlans } from '#/lib/products'

function validateFloorPlanSearch(search: Record<string, unknown>): FloorPlanSearch {
  const str = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value : undefined)
  const sort = str(search.sort)
  return {
    q: str(search.q),
    minLengthFt: str(search.minLengthFt),
    maxLengthFt: str(search.maxLengthFt),
    minWidthFt: str(search.minWidthFt),
    maxWidthFt: str(search.maxWidthFt),
    minAreaSqFt: str(search.minAreaSqFt),
    maxAreaSqFt: str(search.maxAreaSqFt),
    sort: sort === 'floorAreaSqFt' || sort === 'lengthFt' || sort === 'widthFt' ? sort : 'createdAt',
    order: search.order === 'asc' ? 'asc' : 'desc',
    page: typeof search.page === 'number' && search.page > 1 ? search.page : undefined,
  }
}

export const Route = createFileRoute('/_store/floor-plans/')({
  head: () => ({
    meta: [
      { title: 'Floor plans — liza-arch' },
      { name: 'description', content: 'Browse architect-drawn floor plans by plot size and floor area.' },
    ],
  }),
  validateSearch: validateFloorPlanSearch,
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps: { search } }) => listPublicFloorPlans(search),
  component: FloorPlansPage,
})

function FloorPlansPage() {
  const search = Route.useSearch()
  const { products, total } = Route.useLoaderData()

  return (
    <Container className="py-10">
      <PageHeader
        title="Floor plans"
        subtitle={`${total} plan${total === 1 ? '' : 's'} — floor plan PDFs and elevation images, downloadable instantly.`}
        actions={
          <Link
            to="/interiors"
            className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink transition hover:bg-surface-muted"
          >
            Interior plans
          </Link>
        }
      />

      <div className="mt-6">
        <FloorPlanFilters search={search} />
      </div>

      {products.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No floor plans match these filters"
            message="Try widening the dimension or area ranges, or reset the filters."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <FloorPlanCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </Container>
  )
}
