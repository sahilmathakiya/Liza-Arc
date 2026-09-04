import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { FormError } from '#/components/auth/form-error'
import { FormField } from '#/components/auth/form-field'
import type { InteriorCategory, Product, ProductType } from '#/lib/products'
import { INTERIOR_CATEGORY_LABELS, createProduct, rupeesToCents } from '#/lib/products'

const selectClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200'

export function ProductForm({ onCreated }: { onCreated: (product: Product) => void }) {
  const [type, setType] = useState<ProductType>('FLOOR_PLAN')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)

    const name = String(formData.get('name') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const published = formData.get('published') === 'on'
    const base = { name, description: description || undefined, published }

    const payload =
      type === 'FLOOR_PLAN'
        ? {
            type,
            ...base,
            details: {
              lengthFt: Number(formData.get('lengthFt')),
              widthFt: Number(formData.get('widthFt')),
              floorAreaSqFt: Number(formData.get('floorAreaSqFt')),
              bathrooms: Number(formData.get('bathrooms')),
              bedrooms: Number(formData.get('bedrooms')),
              floors: Number(formData.get('floors')),
              floorPlanPriceCents: rupeesToCents(String(formData.get('floorPlanPrice'))),
              elevationPriceCents: rupeesToCents(String(formData.get('elevationPrice'))),
              bundlePriceCents: formData.get('bundlePrice')
                ? rupeesToCents(String(formData.get('bundlePrice')))
                : null,
            },
          }
        : {
            type,
            ...base,
            details: {
              category: String(formData.get('category')) as InteriorCategory,
              workingDrawingPriceCents: rupeesToCents(String(formData.get('workingDrawingPrice'))),
            },
          }

    startTransition(async () => {
      try {
        const { product } = await createProduct(payload)
        event.currentTarget.reset()
        onCreated(product)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">Create product</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="product-type" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Type
            </label>
            <select
              id="product-type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as ProductType)}
              className={selectClass}
            >
              <option value="FLOOR_PLAN">Floor plan</option>
              <option value="INTERIOR_PLAN">Interior plan</option>
            </select>
          </div>
          <FormField id="product-name" label="Name" name="name" required placeholder="40x60 Family Home" />
        </div>

        {type === 'FLOOR_PLAN' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="lengthFt" label="Length (ft)" name="lengthFt" type="number" min={1} required />
              <FormField id="widthFt" label="Width (ft)" name="widthFt" type="number" min={1} required />
              <FormField
                id="floorAreaSqFt"
                label="Floor area (sqft)"
                name="floorAreaSqFt"
                type="number"
                min={1}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="bedrooms" label="Bedrooms" name="bedrooms" type="number" min={0} required />
              <FormField id="bathrooms" label="Bathrooms" name="bathrooms" type="number" min={0} required />
              <FormField id="floors" label="Floors" name="floors" type="number" min={1} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                id="floorPlanPrice"
                label="Floor plan price (₹)"
                name="floorPlanPrice"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
              <FormField
                id="elevationPrice"
                label="Elevation price (₹)"
                name="elevationPrice"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
              <FormField
                id="bundlePrice"
                label="Bundle price (₹, optional)"
                name="bundlePrice"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Must be below combined price"
              />
            </div>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-neutral-700">
                Category
              </label>
              <select id="category" name="category" className={selectClass}>
                {Object.entries(INTERIOR_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <FormField
              id="workingDrawingPrice"
              label="Working drawing price (₹)"
              name="workingDrawingPrice"
              type="number"
              step="0.01"
              min="0.01"
              required
            />
          </div>
        )}

        <div>
          <label htmlFor="product-description" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Description (optional)
          </label>
          <textarea
            id="product-description"
            name="description"
            rows={2}
            className={selectClass}
            placeholder="Short description shown on the product page"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" name="published" className="h-4 w-4 rounded border-neutral-300" />
          Publish immediately
        </label>

        <FormError message={error} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Creating…' : 'Create product'}
        </button>
      </form>
    </div>
  )
}
