import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { FormError } from '#/components/auth/form-error'
import type { AppSession } from '#/lib/auth'
import { createCheckout } from '#/lib/orders'
import type { AssetKind, EntitlementType, ProductDetail } from '#/lib/products'
import { formatPrice, paidAssetUrl } from '#/lib/products'
import { Button, buttonClasses } from '#/components/ui/button'

interface BuyOption {
  label: string
  priceCents: number
  entitlement: EntitlementType
  kind: AssetKind
  note?: string
  highlight?: boolean
  bundle?: boolean
}

export function BuyBox({ product, session }: { product: ProductDetail; session: AppSession | null }) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function buy(options: BuyOption[]) {
    setError(null)
    setPending(true)
    try {
      const items = options.map((option) => ({
        productId: product.id,
        entitlementType: option.entitlement,
      }))
      const response = await createCheckout(items)
      navigate({ to: '/checkout/$orderId', params: { orderId: response.orderId } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setPending(false)
    }
  }

  const options: BuyOption[] = []

  if (product.floorPlan) {
    options.push(
      {
        label: 'Floor plan (PDF)',
        priceCents: product.floorPlan.floorPlanPriceCents,
        entitlement: 'FLOOR_PLAN',
        kind: 'floor-plan',
      },
      {
        label: 'Elevation image',
        priceCents: product.floorPlan.elevationPriceCents,
        entitlement: 'ELEVATION_IMAGE',
        kind: 'elevation',
      },
    )
    if (product.floorPlan.bundlePriceCents != null) {
      const combined = product.floorPlan.floorPlanPriceCents + product.floorPlan.elevationPriceCents
      options.push({
        label: 'Bundle — plan + elevation',
        priceCents: product.floorPlan.bundlePriceCents,
        entitlement: 'FLOOR_PLAN',
        kind: 'floor-plan',
        note: `Save ${formatPrice(combined - product.floorPlan.bundlePriceCents)}`,
        highlight: true,
        bundle: true,
      })
    }
  }

  if (product.interiorPlan) {
    options.push({
      label: 'Working drawing',
      priceCents: product.interiorPlan.workingDrawingPriceCents,
      entitlement: 'WORKING_DRAWING',
      kind: 'working-drawing',
    })
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold tracking-tight text-ink">Purchase</h2>
      <div className="mt-4 space-y-3">
        {options.map((option) => {
          const owned = option.bundle
            ? product.owned.includes('FLOOR_PLAN') && product.owned.includes('ELEVATION_IMAGE')
            : product.owned.includes(option.entitlement)
          const optionTargets = option.bundle ? options.filter((o) => o.bundle) : [option]
          return (
            <div
              key={`${option.entitlement}-${option.label}`}
              className={`rounded-lg border p-4 ${option.highlight ? 'border-ink' : 'border-line'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{option.label}</p>
                  {option.note && <p className="text-xs font-medium text-ink-soft">{option.note}</p>}
                </div>
                <p className="text-lg font-semibold text-ink">{formatPrice(option.priceCents)}</p>
              </div>
              <div className="mt-3">
                {owned ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-ink-soft">You own this item</p>
                    <a href={paidAssetUrl(product.id, option.kind)} className={buttonClasses('primary', 'md', 'w-full')}>
                      Download
                    </a>
                  </div>
                ) : !session ? (
                  <Link to="/login" className={buttonClasses('primary', 'md', 'w-full')}>
                    Sign in to purchase
                  </Link>
                ) : (
                  <Button
                    onClick={() => buy(optionTargets)}
                    disabled={pending}
                    className="w-full"
                  >
                    {pending ? 'Preparing checkout…' : option.bundle ? 'Buy bundle' : 'Buy'}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4">
        <FormError message={error} />
      </div>
      <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-faint">
        Instant download after payment. Your files stay available in your purchases anytime.
      </p>
    </div>
  )
}
