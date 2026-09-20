import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { FormError } from '#/components/auth/form-error'
import type { AppSession } from '#/lib/auth'
import { createCheckout } from '#/lib/orders'
import { downloadBundle, downloadPaidAsset, bundleFallbackFilename, paidAssetFallbackFilename } from '#/lib/download'
import { accessLabel } from '#/lib/expiry'
import type { AssetKind, EntitlementType, ProductDetail } from '#/lib/products'
import { formatPrice } from '#/lib/products'
import { Button, buttonClasses } from '#/components/ui/button'

interface BuyOption {
  label: string
  priceCents: number
  entitlement: EntitlementType
  kind: AssetKind
  note?: string
  highlight?: boolean
  bundle?: boolean
  cta?: string
}

interface OptionError {
  key: string
  message: string
}

export function BuyBox({ product, session }: { product: ProductDetail; session: AppSession | null }) {
  const navigate = useNavigate()
  const [checkoutError, setCheckoutError] = useState<OptionError | null>(null)
  const [downloadError, setDownloadError] = useState<OptionError | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  async function buy(key: string, options: BuyOption[]) {
    setCheckoutError(null)
    setBusyKey(key)
    try {
      const items = options.map((option) => ({
        productId: product.id,
        entitlementType: option.entitlement,
      }))
      const response = await createCheckout(items)
      navigate({ to: '/checkout/$orderId', params: { orderId: response.orderId } })
    } catch (e) {
      setCheckoutError({ key, message: e instanceof Error ? e.message : 'Something went wrong' })
      setBusyKey(null)
    }
  }

  async function downloadOption(key: string, option: BuyOption) {
    setDownloadError(null)
    setBusyKey(key)
    try {
      if (option.bundle) {
        await downloadBundle(product.id, bundleFallbackFilename(product.slug))
      } else {
        await downloadPaidAsset(
          product.id,
          option.kind,
          paidAssetFallbackFilename(product.slug, option.kind),
        )
      }
    } catch (e) {
      setDownloadError({ key, message: e instanceof Error ? e.message : 'Something went wrong' })
    } finally {
      setBusyKey(null)
    }
  }

  const options: BuyOption[] = []
  const accessExpiries = product.accessExpiries ?? []
  const expiredTypes = product.expiredTypes ?? []

  if (product.floorPlan) {
    const floorPlan = product.floorPlan
    options.push(
      {
        label: 'Floor plan (PDF)',
        priceCents: floorPlan.floorPlanPriceCents,
        entitlement: 'FLOOR_PLAN',
        kind: 'floor-plan',
      },
      {
        label: 'Elevation image',
        priceCents: floorPlan.elevationPriceCents,
        entitlement: 'ELEVATION_IMAGE',
        kind: 'elevation',
      },
    )
    if (floorPlan.hasFloorPlan && floorPlan.hasElevation) {
      const combined = floorPlan.floorPlanPriceCents + floorPlan.elevationPriceCents
      const bundlePriceCents = floorPlan.bundlePriceCents
      options.push(
        bundlePriceCents != null
          ? {
              label: 'Bundle — plan + elevation',
              priceCents: bundlePriceCents,
              entitlement: 'FLOOR_PLAN',
              kind: 'floor-plan',
              note: `One order, both files — save ${formatPrice(combined - bundlePriceCents)}`,
              highlight: true,
              bundle: true,
              cta: 'Buy bundle',
            }
          : {
              label: 'Both — plan + elevation',
              priceCents: combined,
              entitlement: 'FLOOR_PLAN',
              kind: 'floor-plan',
              note: 'One order, both files',
              bundle: true,
              cta: 'Buy both',
            },
      )
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
    <div className="rounded-lg border border-line bg-surface p-6 shadow-card">
      <h2 className="text-lg font-semibold tracking-tight text-ink">Purchase</h2>
      <div className="mt-4 space-y-3">
        {options.map((option) => {
          const optionKey = `${option.entitlement}-${option.label}`
          const busy = busyKey === optionKey
          const ownsFloorPlan = product.owned.includes('FLOOR_PLAN')
          const ownsElevation = product.owned.includes('ELEVATION_IMAGE')
          const owned = option.bundle
            ? ownsFloorPlan && ownsElevation
            : product.owned.includes(option.entitlement)
          const bundleBlocked =
            Boolean(option.bundle) && !owned && (ownsFloorPlan || ownsElevation)
          const optionTargets = option.bundle ? options.filter((o) => !o.bundle) : [option]
          const expiry =
            (option.bundle
              ? accessExpiries.filter(
                  (entry) => entry.type === 'FLOOR_PLAN' || entry.type === 'ELEVATION_IMAGE',
                )
              : accessExpiries.filter((entry) => entry.type === option.entitlement)
            )
              .map((entry) => entry.expiresAt)
              .filter((value): value is string => value !== null)
              .sort()[0] ?? null
          const expired = option.bundle
            ? expiredTypes.includes('FLOOR_PLAN') && expiredTypes.includes('ELEVATION_IMAGE')
            : expiredTypes.includes(option.entitlement)
          return (
            <div
              key={optionKey}
               className={`rounded-lg border p-4 ${option.highlight ? 'border-active' : 'border-line'}`}
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
                    <p className="text-xs text-ink-faint" suppressHydrationWarning>
                      {accessLabel(expiry)}
                    </p>
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      disabled={busyKey !== null}
                      onClick={() => downloadOption(optionKey, option)}
                    >
                      {busy ? 'Preparing your download…' : 'Download'}
                    </Button>
                    {downloadError?.key === optionKey && (
                      <FormError message={downloadError.message} />
                    )}
                  </div>
                ) : bundleBlocked ? (
                  <p className="rounded-md border border-line bg-surface-muted px-3 py-2 text-xs text-ink-soft">
                    You already own one of these two items — purchase the remaining item on its own
                    instead.
                  </p>
                ) : !session ? (
                  <Link to="/login" className={buttonClasses('primary', 'md', 'w-full')}>
                    Sign in to purchase
                  </Link>
                ) : (
                  <div className="space-y-2">
                    {expired && (
                      <p className="rounded-md border border-line bg-surface-muted px-3 py-2 text-xs text-ink-soft">
                        Your previous access expired — buy again to download.
                      </p>
                    )}
                    <Button
                      onClick={() => buy(optionKey, optionTargets)}
                      disabled={busyKey !== null}
                      className="w-full"
                    >
                      {busy ? 'Preparing checkout…' : (option.cta ?? 'Buy')}
                    </Button>
                    {checkoutError?.key === optionKey && (
                      <FormError message={checkoutError.message} />
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-faint">
        Instant download after payment. Your files stay available in your purchases anytime.
      </p>
    </div>
  )
}
