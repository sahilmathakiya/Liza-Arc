import { createFileRoute } from '@tanstack/react-router'
import { ProductList } from '#/components/admin/product-list'
import { Container, PageHeader } from '#/components/ui/layout'
import { Pagination, totalPagesFor } from '#/components/ui/pagination'
import { listProducts } from '#/lib/products'

interface AdminProductsSearch {
  page?: number
}

function validateAdminProductsSearch(search: Record<string, unknown>): AdminProductsSearch {
  return {
    page: typeof search.page === 'number' && search.page > 1 ? search.page : undefined,
  }
}

export const Route = createFileRoute('/admin/products')({
  head: () => ({ meta: [{ title: 'Products — liza-arch admin' }] }),
  validateSearch: validateAdminProductsSearch,
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps: { search } }) => listProducts(search.page ?? 1),
  component: AdminProductsPage,
})

function AdminProductsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { products, total, limit } = Route.useLoaderData()
  const page = search.page ?? 1
  const totalPages = totalPagesFor(total, limit)

  return (
    <Container className="py-8">
      <PageHeader
        title="Products"
        subtitle={`${total} product${total === 1 ? '' : 's'} in the catalog.`}
      />
      <div className="mt-6">
        <ProductList products={products} />
      </div>

      <Pagination
        className="mt-6"
        page={page}
        totalPages={totalPages}
        onPageChange={(next) =>
          navigate({ search: (prev) => ({ ...prev, page: next > 1 ? next : undefined }) })
        }
      />
    </Container>
  )
}
