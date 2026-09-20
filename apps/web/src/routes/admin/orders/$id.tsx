import { Link, createFileRoute } from '@tanstack/react-router'
import { Badge, statusTone } from '#/components/ui/badge'
import { Container } from '#/components/ui/layout'
import { getAdminOrder } from '#/lib/orders'
import { accessLabel } from '#/lib/expiry'
import { ENTITLEMENT_TYPE_LABELS, formatPrice } from '#/lib/products'

export const Route = createFileRoute('/admin/orders/$id')({
  head: () => ({ meta: [{ title: 'Order — liza-arch admin' }] }),
  loader: async ({ params }) => {
    const { order } = await getAdminOrder(params.id)
    return { order }
  },
  component: AdminOrderDetailPage,
})

function AdminOrderDetailPage() {
  const { order } = Route.useLoaderData()

  return (
    <Container className="max-w-3xl py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link to="/admin/orders" className="transition hover:text-ink">
          Orders
        </Link>
        <span aria-hidden className="mx-2 text-ink-faint">
          /
        </span>
        <span className="font-mono text-ink">{order.id.slice(0, 12)}…</span>
      </nav>

      <div className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-mono text-lg font-semibold text-ink">{order.id}</h1>
          <Badge tone={statusTone(order.status)}>{order.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Placed {new Date(order.createdAt).toLocaleString('en-IN')}
        </p>

        <dl className="mt-6 grid gap-px overflow-hidden rounded-md border border-line bg-line-subtle sm:grid-cols-2">
          <div className="bg-surface p-4">
            <dt className="text-xs uppercase tracking-wide text-ink-faint">Customer</dt>
            <dd className="mt-1 font-medium text-ink">{order.user.name}</dd>
            <dd className="text-sm text-ink-soft">{order.user.email}</dd>
          </div>
          <div className="bg-surface p-4">
            <dt className="text-xs uppercase tracking-wide text-ink-faint">Payment reference</dt>
            <dd className="mt-1 break-all font-mono text-sm text-ink">{order.paymentRef ?? '—'}</dd>
          </div>
          <div className="bg-surface p-4">
            <dt className="text-xs uppercase tracking-wide text-ink-faint">Razorpay order</dt>
            <dd className="mt-1 break-all font-mono text-sm text-ink">
              {order.razorpayOrderId ?? '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-card">
        <h2 className="text-base font-semibold text-ink">Items</h2>
        <ul className="mt-4 divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{item.product.name}</p>
                <p className="text-sm text-ink-soft">{ENTITLEMENT_TYPE_LABELS[item.entitlementType]}</p>
                <p className="mt-1 text-xs text-ink-faint">{accessLabel(item.accessExpiresAt)}</p>
              </div>
              <p className="font-medium text-ink">{formatPrice(item.priceCents)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <p className="font-medium text-ink">Total</p>
          <p className="text-lg font-semibold text-ink">{formatPrice(order.totalCents)}</p>
        </div>
      </div>
    </Container>
  )
}
