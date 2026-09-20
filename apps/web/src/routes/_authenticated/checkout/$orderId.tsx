import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { FormError } from '#/components/auth/form-error'
import { Button } from '#/components/ui/button'
import { Container } from '#/components/ui/layout'
import { usePaidDownload } from '#/hooks/use-paid-download'
import { paidAssetFallbackFilename } from '#/lib/download'
import { accessLabel, isExpired } from '#/lib/expiry'
import { createRazorpayOrder, getMyOrder, verifyRazorpayPayment } from '#/lib/orders'
import { loadRazorpayCheckout } from '#/lib/razorpay'
import { ENTITLEMENT_TYPE_LABELS, formatPrice } from '#/lib/products'

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
  const [paying, setPaying] = useState(false)
  const { download, pendingKey, error: downloadError } = usePaidDownload()

  async function handlePay() {
    setError(null)
    setPaying(true)
    try {
      const session = await createRazorpayOrder(order.id)
      await loadRazorpayCheckout()
      const Razorpay = window.Razorpay
      if (!Razorpay) throw new Error('The payment window is unavailable — please try again')
      const checkout = new Razorpay({
        key: session.keyId,
        order_id: session.razorpayOrderId,
        amount: session.amount,
        currency: session.currency,
        name: 'liza-arch',
        description:
          order.items.length === 1
            ? order.items[0].product.name
            : `${order.items.length} purchased items`,
        prefill: session.prefill,
        theme: { color: '#ffbf00' },
        handler: async (response) => {
          try {
            await verifyRazorpayPayment(order.id, response)
            await router.invalidate()
          } catch {
            setError(
              'Your payment went through but could not be confirmed instantly. Refresh this page in a minute — it will also appear in your purchases.',
            )
          } finally {
            setPaying(false)
          }
        },
        modal: {
          ondismiss: () => {
            setError(
              'Checkout was closed before the payment completed. You can try again — if an amount was deducted, it will be confirmed here automatically or refunded by Razorpay.',
            )
            setPaying(false)
          },
        },
      })
      checkout.open()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setPaying(false)
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

      <div className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-card shadow-card sm:p-8">
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
        <div className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-card">
          <h2 className="text-base font-semibold text-ink">Payment</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Pay securely via Razorpay — UPI, cards, netbanking and wallets supported. Your files
            unlock immediately after payment.
          </p>
          <div className="mt-4">
            <Button onClick={handlePay} disabled={paying}>
              {paying ? 'Opening payment…' : `Pay ${formatPrice(order.totalCents)}`}
            </Button>
          </div>
          <div className="mt-3">
            <FormError message={error} />
          </div>
        </div>
      )}

      {order.status === 'PAID' && (
        <div className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-card">
          <h2 className="text-base font-semibold text-ink">Payment successful</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Your items are unlocked — download them below or from your purchases page.
          </p>
          <ul className="mt-4 space-y-2">
            {order.items.map((item) => {
              const kind = DOWNLOAD_KIND_BY_ENTITLEMENT[item.entitlementType]
              const expiresAt = item.accessExpiresAt
              const busy = pendingKey === item.id

              if (isExpired(expiresAt)) {
                return (
                  <li key={item.id} className="text-sm text-ink-soft">
                    <span className="font-medium text-ink">{item.product.name}</span> —{' '}
                    {accessLabel(expiresAt)}.{' '}
                    {item.product.type === 'FLOOR_PLAN' ? (
                      <Link
                        to="/floor-plans/$slug"
                        params={{ slug: item.product.slug }}
                        className="font-medium text-ink hover:underline"
                      >
                        Buy again
                      </Link>
                    ) : (
                      <Link
                        to="/interiors/$slug"
                        params={{ slug: item.product.slug }}
                        className="font-medium text-ink hover:underline"
                      >
                        Buy again
                      </Link>
                    )}
                  </li>
                )
              }

              return (
                <li key={item.id} className="space-y-1">
                  <Button
                    variant="primary"
                    size="md"
                    disabled={pendingKey !== null}
                    onClick={() =>
                      download(item.id, item.product.id, kind, paidAssetFallbackFilename(item.product.slug, kind))
                    }
                  >
                    {busy
                      ? 'Preparing your download…'
                      : `Download ${ENTITLEMENT_TYPE_LABELS[item.entitlementType]} — ${item.product.name}`}
                  </Button>
                  <p className="text-xs text-ink-faint">{accessLabel(expiresAt)}</p>
                </li>
              )
            })}
          </ul>
          <div className="mt-3">
            <FormError message={downloadError} />
          </div>
          <Link to="/purchases" className="mt-4 inline-block text-sm font-medium text-ink hover:underline">
            Go to my purchases →
          </Link>
        </div>
      )}

      {order.status === 'FAILED' && (
        <div className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-card">
          <h2 className="text-base font-semibold text-ink">Payment failed</h2>
          <p className="mt-1 text-sm text-ink-soft">
            The payment didn't go through and nothing was charged. Please go back to the product and
            start a new checkout.
          </p>
        </div>
      )}
    </Container>
  )
}
