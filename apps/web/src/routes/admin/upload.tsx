import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ProductUpload } from '#/components/admin/product-upload'
import { UploadForm } from '#/components/admin/upload-form'
import { Container, PageHeader } from '#/components/ui/layout'
import { listProducts } from '#/lib/products'

interface UploadSearch {
  product?: string
}

export const Route = createFileRoute('/admin/upload')({
  head: () => ({ meta: [{ title: 'Upload product — liza-arch admin' }] }),
  validateSearch: (search: Record<string, unknown>): UploadSearch => ({
    product: typeof search.product === 'string' ? search.product : undefined,
  }),
  loader: () => listProducts(),
  component: AdminUploadPage,
})

function AdminUploadPage() {
  const router = useRouter()
  const { product: productId } = Route.useSearch()
  const { products } = Route.useLoaderData()
  const [selectedId, setSelectedId] = useState('')

  const retryTarget = productId ? products.find((product) => product.id === productId) : undefined

  return (
    <Container className="max-w-3xl py-8">
      <PageHeader
        title={retryTarget ? `Upload assets — ${retryTarget.name}` : 'Upload product'}
        subtitle={
          retryTarget
            ? 'Upload the missing assets for this product.'
            : 'Select a product type, fill in the details and upload the required assets.'
        }
      />

      <div className="mt-6">
        {retryTarget ? (
          <ProductUpload
            products={products}
            selectedId={selectedId || retryTarget.id}
            onSelect={setSelectedId}
            onUploaded={() => router.invalidate()}
          />
        ) : (
          <UploadForm />
        )}
      </div>
    </Container>
  )
}
