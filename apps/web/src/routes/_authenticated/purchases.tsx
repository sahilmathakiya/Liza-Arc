import { Link, createFileRoute } from '@tanstack/react-router'
import { Badge, statusTone } from '#/components/ui/badge'
import { EmptyState } from '#/components/ui/feedback'
import { Container, PageHeader } from '#/components/ui/layout'
import { listMyEntitlements, listMyOrders } from '#/lib/orders'
import { ENTITLEMENT_TYPE_LABELS, formatPrice, paidAssetUrl } from '#/lib/products'

export const Route = createFileRoute('/_authenticated/purchases')({
  head: () => ({ meta: [{ title: 'My purchases — liza-arch' }] }),
  loader: async () => {
    const [{ entitlements }, { orders }] = await Promise.all([
      listMyEntitlements(),
      listMyOrders(),
    ])
    return { entitlements, orders }
  },
  component: PurchasesPage,
})

function PurchasesPage() {
  const { entitlements, orders } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <Container className="flex h-16 items-center justify-between">
          <Link to="/" className="text-base font-semibold tracking-tight text-ink">
            liza-arch
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              to="/dashboard"
              className="rounded-md px-3 py-2 text-sm text-ink-soft transition hover:text-ink"
            >
              Account
            </Link>
            <Link
              to="/floor-plans"
              className="rounded-md px-3 py-2 text-sm text-ink-soft transition hover:text-ink"
            >
              Browse plans
            </Link>
          </nav>
        </Container>
      </header>

      <Container className="max-w-3xl py-10">
        <PageHeader
          title="My purchases"
          subtitle="Everything you have bought, with downloads."
        />

        <section className="mt-6" aria-label="Owned items">
          {entitlements.length === 0 ? (
            <EmptyState
              title="You have not purchased anything yet"
              message="Browse the catalog — anything you buy appears here with a download button."
              action={
                <Link to="/floor-plans" className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground transition hover:bg-brand/85">
                  Browse floor plans
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface px-4">
              {entitlements.map((entitlement) => (
                <li key={entitlement.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{entitlement.product.name}</p>
                    <p className="text-sm text-ink-soft">
                      {ENTITLEMENT_TYPE_LABELS[entitlement.type]} · purchased{' '}
                      {new Date(entitlement.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <a
                    href={paidAssetUrl(entitlement.product.id, entitlement.downloadKind)}
                    className="inline-flex h-9 shrink-0 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground transition hover:bg-brand/85"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8" aria-label="Order history">
          <h2 className="text-base font-semibold text-ink">Order history</h2>
          {orders.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No orders yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface px-4">
              {orders.map((order) => (
                <li key={order.id} className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-ink">{order.id}</p>
                      <p className="text-xs text-ink-soft">
                        {new Date(order.createdAt).toLocaleString('en-IN')} · {order.items.length} item
                        {order.items.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="font-medium text-ink">{formatPrice(order.totalCents)}</p>
                      <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {order.items.map((item) => (
                      <li key={item.id} className="text-xs text-ink-soft">
                        {item.product.name} — {ENTITLEMENT_TYPE_LABELS[item.entitlementType]}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Container>
    </div>
  )
}
