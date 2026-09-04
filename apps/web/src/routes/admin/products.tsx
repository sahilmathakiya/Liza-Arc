import { createFileRoute } from '@tanstack/react-router'
import { ProductList } from '#/components/admin/product-list'
import { Container, PageHeader } from '#/components/ui/layout'
import { listProducts } from '#/lib/products'

export const Route = createFileRoute('/admin/products')({
  head: () => ({ meta: [{ title: 'Products — liza-arch admin' }] }),
  loader: () => listProducts(),
  component: AdminProductsPage,
})

function AdminProductsPage() {
  const { products, total } = Route.useLoaderData()

  return (
    <Container className="py-8">
      <PageHeader
        title="Products"
        subtitle={`${total} product${total === 1 ? '' : 's'} in the catalog.`}
      />
      <div className="mt-6">
        <ProductList products={products} />
      </div>
    </Container>
  )
}
