import { useMemo, useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { FormError } from '#/components/auth/form-error'
import { Button } from '#/components/ui/button'
import { Label, Select } from '#/components/ui/field'
import { EmptyState } from '#/components/ui/feedback'
import type { AssetKind, Product } from '#/lib/products'
import { ASSET_KIND_LABELS, PRODUCT_ASSET_KINDS, uploadAsset } from '#/lib/products'

const KIND_ACCEPT: Record<AssetKind, string> = {
  'floor-plan': '.pdf',
  elevation: '.jpg,.jpeg,.png,.webp',
  preview: '.jpg,.jpeg,.png,.webp',
  'working-drawing': '.zip,.pdf',
}

export function ProductUpload({
  products,
  selectedId,
  onSelect,
  onUploaded,
}: {
  products: Product[]
  selectedId: string
  onSelect: (productId: string) => void
  onUploaded: () => void
}) {
  const selected = products.find((product) => product.id === selectedId) ?? null
  const kinds = selected ? PRODUCT_ASSET_KINDS[selected.type] : []
  const [kind, setKind] = useState<AssetKind | ''>('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const activeKind: AssetKind | null = kind && kinds.includes(kind) ? kind : (kinds[0] ?? null)

  const assetStatus = useMemo(() => {
    if (!selected) return []
    if (selected.type === 'FLOOR_PLAN' && selected.floorPlan) {
      return [
        { kind: 'floor-plan' as const, label: ASSET_KIND_LABELS['floor-plan'], key: selected.floorPlan.floorPlanKey },
        { kind: 'elevation' as const, label: ASSET_KIND_LABELS.elevation, key: selected.floorPlan.elevationKey },
        {
          kind: 'thumbnail' as const,
          label: 'Elevation thumbnail',
          key: selected.floorPlan.elevationThumbKey,
        },
      ]
    }
    if (selected.type === 'INTERIOR_PLAN' && selected.interiorPlan) {
      return [
        { kind: 'preview' as const, label: ASSET_KIND_LABELS.preview, key: selected.interiorPlan.previewKey },
        {
          kind: 'working-drawing' as const,
          label: ASSET_KIND_LABELS['working-drawing'],
          key: selected.interiorPlan.workingDrawingKey,
        },
      ]
    }
    return []
  }, [selected])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !activeKind) return
    const fileInput = event.currentTarget.elements.namedItem('file') as HTMLInputElement | null
    const file = fileInput?.files?.[0]
    setMessage(null)
    setError(null)
    if (!file) {
      setError('Choose a file to upload')
      return
    }
    startTransition(async () => {
      try {
        const { key, thumbnailKey } = await uploadAsset(selected.id, activeKind, file)
        setMessage(
          activeKind === 'elevation' && !thumbnailKey
            ? `Uploaded to ${key} — thumbnail generation failed; regenerate it from the products list.`
            : `Uploaded to ${key}`,
        )
        if (fileInput) fileInput.value = ''
        onUploaded()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-card">
      <h2 className="text-base font-semibold text-ink">Upload assets</h2>
      {products.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Create a product first"
            message="Assets attach to an existing product. Use the form above to create one."
          />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="upload-product">Product</Label>
            <Select
              id="upload-product"
              value={selectedId}
              onChange={(e) => {
                onSelect(e.target.value)
                setKind('')
              }}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.type === 'FLOOR_PLAN' ? 'Floor plan' : 'Interior plan'})
                </option>
              ))}
            </Select>
          </div>

          {assetStatus.length > 0 && (
            <ul className="space-y-1 rounded-md border border-line bg-canvas p-3 text-xs text-ink-soft">
              {assetStatus.map((asset) => (
                <li key={asset.kind} className="flex items-center justify-between gap-2">
                  <span>{asset.label}</span>
                  {asset.key ? (
                    <span className="truncate font-mono text-ink" title={asset.key}>
                      {asset.key}
                    </span>
                  ) : (
                    <span className="text-ink-faint">not uploaded</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="upload-kind">Asset</Label>
              <Select
                id="upload-kind"
                value={activeKind ?? ''}
                onChange={(e) => setKind(e.target.value as AssetKind)}
              >
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {ASSET_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="upload-file">File</Label>
              <input
                id="upload-file"
                name="file"
                type="file"
                required
                accept={activeKind ? KIND_ACCEPT[activeKind] : undefined}
                className="w-full rounded-[6px] border border-line bg-surface-muted px-3 py-2 text-sm text-ink-soft hover:border-line-strong file:mr-3 file:rounded-[6px] file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-medium file:!text-brand-foreground hover:file:bg-active"
              />
            </div>
          </div>

          {message && (
            <p className="rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-ink">{message}</p>
          )}
          <FormError message={error} />
          <Button type="submit" disabled={pending || !selected || !activeKind}>
            {pending ? 'Uploading…' : 'Upload'}
          </Button>
        </form>
      )}
    </div>
  )
}
