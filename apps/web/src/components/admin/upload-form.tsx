import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { FormError } from '#/components/auth/form-error'
import { FormField } from '#/components/auth/form-field'
import { Button } from '#/components/ui/button'
import { Input, Label, Select, Textarea } from '#/components/ui/field'
import type { AssetKind, InteriorCategory, ProductType } from '#/lib/products'
import {
  ASSET_KIND_LABELS,
  INTERIOR_CATEGORY_LABELS,
  createProduct,
  rupeesToCents,
  uploadAsset,
} from '#/lib/products'

const FLOOR_PLAN_FILES: { kind: AssetKind; accept: string; image: boolean }[] = [
  { kind: 'floor-plan', accept: '.pdf', image: false },
  { kind: 'elevation', accept: '.jpg,.jpeg,.png,.webp', image: true },
]

const INTERIOR_FILES: { kind: AssetKind; accept: string; image: boolean }[] = [
  { kind: 'preview', accept: '.jpg,.jpeg,.png,.webp', image: true },
  { kind: 'working-drawing', accept: '.zip,.pdf', image: false },
]

function FilePicker({
  label,
  accept,
  showImagePreview,
  file,
  onChange,
}: {
  label: string
  accept: string
  showImagePreview: boolean
  file: File | null
  onChange: (file: File | null) => void
}) {
  const previewUrl = useMemo(
    () => (file && showImagePreview ? URL.createObjectURL(file) : null),
    [file, showImagePreview],
  )
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.files?.[0] ?? null)
  }

  return (
    <div className="rounded-lg border border-line bg-canvas p-4">
      <p className="text-sm font-medium text-ink">{label}</p>
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        className="mt-2 block w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-foreground hover:file:bg-brand/85"
      />
      {file ? (
        <div className="mt-3 flex items-center gap-3">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={file.name}
              className="h-16 w-16 rounded-md border border-line object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{file.name}</p>
            <p className="text-xs text-ink-soft">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-surface-muted"
          >
            Remove
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-ink-faint">Required — accepted formats: {accept}</p>
      )}
    </div>
  )
}

export function UploadForm() {
  const navigate = useNavigate()
  const [type, setType] = useState<ProductType>('FLOOR_PLAN')
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [files, setFiles] = useState<Record<AssetKind, File | null>>({
    'floor-plan': null,
    elevation: null,
    preview: null,
    'working-drawing': null,
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const area = useMemo(() => {
    const l = Number(length)
    const w = Number(width)
    if (!Number.isInteger(l) || !Number.isInteger(w) || l <= 0 || w <= 0) return null
    return l * w
  }, [length, width])

  const assetSpecs = type === 'FLOOR_PLAN' ? FLOOR_PLAN_FILES : INTERIOR_FILES
  const allFilesSelected = assetSpecs.every((spec) => files[spec.kind] != null)

  function switchType(next: ProductType) {
    setType(next)
    setFiles({ 'floor-plan': null, elevation: null, preview: null, 'working-drawing': null })
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!allFilesSelected || submitting) return
    setError(null)
    setSubmitting(true)
    const form = event.currentTarget
    const formData = new FormData(form)

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
              lengthFt: Number(length),
              widthFt: Number(width),
              floorAreaSqFt: area,
              floors: Number(formData.get('floors')),
              bathrooms: Number(formData.get('bathrooms')),
              bedrooms: Number(formData.get('bedrooms')),
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

    try {
      const { product } = await createProduct(payload)
      try {
        for (const spec of assetSpecs) {
          const file = files[spec.kind]
          if (file) await uploadAsset(product.id, spec.kind, file)
        }
        navigate({ to: '/admin/products' })
      } catch (e) {
        setError(
          `${e instanceof Error ? e.message : 'Upload failed'} — the product "${product.name}" was created; retry the missing uploads from the products page.`,
        )
        setSubmitting(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-lg border border-line bg-surface p-6">
        <h2 className="text-base font-semibold text-ink">1. Product type</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: 'FLOOR_PLAN', label: 'Floor plan', hint: 'Plan PDF + elevation image' },
              { value: 'INTERIOR_PLAN', label: 'Interior plan', hint: 'Preview image + working drawing' },
            ] as { value: ProductType; label: string; hint: string }[]
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={type === option.value}
              onClick={() => switchType(option.value)}
              className={
                type === option.value
                  ? 'rounded-lg border-2 border-ink bg-brand p-4 text-left text-brand-foreground'
                  : 'rounded-lg border-2 border-line bg-surface p-4 text-left transition hover:border-line-strong'
              }
            >
              <p className="font-semibold">{option.label}</p>
              <p
                className={
                  type === option.value ? 'mt-1 text-xs text-brand-foreground/70' : 'mt-1 text-xs text-ink-soft'
                }
              >
                {option.hint}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-6">
        <h2 className="text-base font-semibold text-ink">2. Details</h2>
        <div className="mt-4 space-y-4">
          <FormField id="product-name" label="Name" name="name" required placeholder="40x60 Family Home" />

          {type === 'FLOOR_PLAN' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="lengthFt">Plot length (ft)</Label>
                  <Input
                    id="lengthFt"
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="widthFt">Plot width (ft)</Label>
                  <Input
                    id="widthFt"
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="area">Plot area (sqft, auto)</Label>
                  <Input
                    id="area"
                    value={area ?? ''}
                    readOnly
                    placeholder="length × width"
                    className="cursor-not-allowed bg-surface-muted text-ink-soft"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField id="floors" label="Floors" name="floors" type="number" min={1} required />
                <FormField id="bathrooms" label="Bathrooms" name="bathrooms" type="number" min={0} required />
                <FormField id="bedrooms" label="Bedrooms" name="bedrooms" type="number" min={0} required />
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
                <Label htmlFor="category">Interior category</Label>
                <Select id="category" name="category">
                  {Object.entries(INTERIOR_CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
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
            <Label htmlFor="product-description">Description (optional)</Label>
            <Textarea
              id="product-description"
              name="description"
              rows={2}
              placeholder="Short description shown on the product page"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="published" className="h-4 w-4 rounded border-line accent-[var(--brand)]" />
            Publish immediately
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-6">
        <h2 className="text-base font-semibold text-ink">3. Assets</h2>
        <p className="mt-1 text-sm text-ink-soft">Both files are required before submitting.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {assetSpecs.map((spec) => (
            <FilePicker
              key={`${type}-${spec.kind}`}
              label={ASSET_KIND_LABELS[spec.kind]}
              accept={spec.accept}
              showImagePreview={spec.image}
              file={files[spec.kind]}
              onChange={(file) => setFiles((prev) => ({ ...prev, [spec.kind]: file }))}
            />
          ))}
        </div>
      </section>

      <FormError message={error} />
      <Button type="submit" size="lg" disabled={!allFilesSelected || submitting} className="w-full">
        {submitting ? 'Creating product & uploading assets…' : 'Submit product'}
      </Button>
    </form>
  )
}
