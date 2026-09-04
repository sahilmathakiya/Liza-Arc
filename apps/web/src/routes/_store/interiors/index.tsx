import { Link, createFileRoute } from '@tanstack/react-router'
import { InteriorCard } from '#/components/store/interior-card'
import { EmptyState } from '#/components/ui/feedback'
import { Container, PageHeader } from '#/components/ui/layout'
import type { InteriorCategory } from '#/lib/products'
import { INTERIOR_CATEGORY_LABELS, listPublicInteriorPlans } from '#/lib/products'

interface InteriorsSearch {
  category?: InteriorCategory
  page?: number
}

const CATEGORIES = Object.entries(INTERIOR_CATEGORY_LABELS) as [InteriorCategory, string][]

function validateInteriorsSearch(search: Record<string, unknown>): InteriorsSearch {
  const category = search.category
  return {
    category:
      typeof category === 'string' && CATEGORIES.some(([value]) => value === category)
        ? (category as InteriorCategory)
        : undefined,
    page: typeof search.page === 'number' && search.page > 1 ? search.page : undefined,
  }
}

export const Route = createFileRoute('/_store/interiors/')({
  head: () => ({
    meta: [
      { title: 'Interior plans — liza-arch' },
      {
        name: 'description',
        content: 'Browse interior working drawings by room type. Free previews for every plan.',
      },
    ],
  }),
  validateSearch: validateInteriorsSearch,
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps: { search } }) => listPublicInteriorPlans(search),
  component: InteriorsPage,
})

function InteriorsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { products, total } = Route.useLoaderData()

  const chipClass = (active: boolean) =>
    active
      ? 'rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground'
      : 'rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink-soft transition hover:border-line-strong hover:text-ink'

  return (
    <Container className="py-10">
      <PageHeader
        title="Interior plans"
        subtitle={`${total} plan${total === 1 ? '' : 's'} — every preview is free to view; purchase the working drawing when you are ready.`}
        actions={
          <Link
            to="/floor-plans"
            className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink transition hover:bg-surface-muted"
          >
            Floor plans
          </Link>
        }
      />

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter by room type">
        <button type="button" onClick={() => navigate({ search: {} })} className={chipClass(!search.category)}>
          All rooms
        </button>
        {CATEGORIES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => navigate({ search: { category: value } })}
            className={chipClass(search.category === value)}
          >
            {label}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No interior plans here yet"
            message="Try another room type, or check back soon — new drawings are added regularly."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <InteriorCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </Container>
  )
}
