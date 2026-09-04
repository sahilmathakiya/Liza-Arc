import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { FormError } from '#/components/auth/form-error'
import { Button } from '#/components/ui/button'
import { Container } from '#/components/ui/layout'
import { getMyOrder, payOrder } from '#/lib/orders'
import { ENTITLEMENT_TYPE_LABELS, formatPrice, paidAssetUrl } from '#/lib/products'

const DOWNLOAD_KIND_BY_ENTITLEMENT = {
  FLOOR_PLAN: 'floor-plan',
  ELEVATION_IMAGE: 'elevation',
  WORKING_DRAWING: 'working-drawing',
} as const

export const Route = createFileRoute('/_authenticated/checkout/$orderId')({
  head: () => ({ meta: [{ title: 'Checkout — liza-arch' }] }),
  loader: async ({ params }) => {
    const { order } = await getMyOrder(params.orderId)
    return { order }
  },
  component: CheckoutPage,
})

function CheckoutPage() {
  const router = useRouter()
  const { order } = Route.useLoaderData()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'success' | 'fail' | null>(null)

  async function handlePay(result: 'success' | 'fail') {
    setError(null)
    setPending(result)
    try {
      await payOrder(order.id, result)
      await router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setPending(null)
    }
  }

  return (
    <Container className="max-w-xl py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link to="/purchases" className="transition hover:text-ink">
          My purchases
        </Link>
        <span aria-hidden className="mx-2 text-ink-faint">
          /
        </span>
        <span className="text-ink">Checkout</span>
      </nav>

      <div className="mt-6 rounded-lg border border-line bg-surface p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Checkout</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Order <span className="font-mono text-ink">{order.id}</span>
        </p>

        <ul className="mt-6 divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{item.product.name}</p>
                <p className="text-sm text-ink-soft">{ENTITLEMENT_TYPE_LABELS[item.entitlementType]}</p>
              </div>
              <p className="font-medium text-ink">{formatPrice(item.priceCents)}</p>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex items-center justify-between border-t border-line pt-4">
          <p className="font-medium text-ink">Total</p>
          <p className="text-xl font-semibold text-ink">{formatPrice(order.totalCents)}</p>
        </div>
      </div>

      {order.status === 'PENDING' && (
        <div className="mt-6 rounded-lg border border-line bg-surface p-6">
          <h2 className="text-base font-semibold text-ink">Mock payment</h2>
          <p className="mt-1 text-sm text-ink-soft">
            This is a placeholder gateway — a real payment provider will replace it later.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button onClick={() => handlePay('success')} disabled={pending !== null}>
              {pending === 'success' ? 'Processing…' : 'Pay now'}
            </Button>
            <Button onClick={() => handlePay('fail')} disabled={pending !== null} variant="danger">
              {pending === 'fail' ? 'Processing…' : 'Simulate failure'}
            </Button>
          </div>
          <div className="mt-3">
            <FormError message={error} />
          </div>
        </div>
      )}

      {order.status === 'PAID' && (
        <div className="mt-6 rounded-lg border border-line bg-surface p-6">
          <h2 className="text-base font-semibold text-ink">Payment successful</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Your items are unlocked — download them below or from your purchases page.
          </p>
          <ul className="mt-4 space-y-2">
            {order.items.map((item) => (
              <li key={item.id}>
                <a
                  href={paidAssetUrl(item.product.id, DOWNLOAD_KIND_BY_ENTITLEMENT[item.entitlementType])}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground transition hover:bg-brand/85"
                >
                  Download {ENTITLEMENT_TYPE_LABELS[item.entitlementType]} — {item.product.name}
                </a>
              </li>
            ))}
          </ul>
          <Link to="/purchases" className="mt-4 inline-block text-sm font-medium text-ink hover:underline">
            Go to my purchases →
          </Link>
        </div>
      )}

      {order.status === 'FAILED' && (
        <div className="mt-6 rounded-lg border border-line bg-surface p-6">
          <h2 className="text-base font-semibold text-ink">Payment failed</h2>
          <p className="mt-1 text-sm text-ink-soft">
            No money was charged. Please go back to the product and start a new checkout.
          </p>
        </div>
      )}
    </Container>
  )
}
