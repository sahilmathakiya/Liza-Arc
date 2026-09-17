import { Link, createFileRoute } from '@tanstack/react-router'
import { FormError } from '#/components/auth/form-error'
import { Badge, statusTone } from '#/components/ui/badge'
import { Button, buttonClasses } from '#/components/ui/button'
import { EmptyState } from '#/components/ui/feedback'
import { Container, PageHeader } from '#/components/ui/layout'
import { usePaidDownload } from '#/hooks/use-paid-download'
import { paidAssetFallbackFilename } from '#/lib/download'
import { accessLabel, isExpired } from '#/lib/expiry'
import { listMyEntitlements, listMyOrders } from '#/lib/orders'
import { ENTITLEMENT_TYPE_LABELS, formatPrice } from '#/lib/products'

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
  const { download, pendingKey, error: downloadError } = usePaidDownload()

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <Container className="flex h-16 items-center justify-between">
           <Link to="/" className="flex items-center gap-2 text-sm font-black uppercase tracking-[1.4px] text-ink">
             <span className="h-2.5 w-2.5 bg-brand" aria-hidden /> liza-arch
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              to="/dashboard"
               className="rounded-[4px] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-soft transition hover:text-brand"
            >
              Account
            </Link>
            <Link
              to="/floor-plans"
               className="rounded-[4px] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-soft transition hover:text-brand"
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
                  <Link to="/floor-plans" className="inline-flex h-10 items-center rounded-[6px] border border-brand bg-brand px-4 text-xs font-bold uppercase tracking-wide !text-brand-foreground transition hover:bg-active">
                  Browse floor plans
                </Link>
              }
            />
          ) : (
             <ul className="divide-y divide-line rounded-[8px] border border-line bg-surface px-4">
              {entitlements.map((entitlement) => {
                const expiresAt = entitlement.expiresAt
                const expired = isExpired(expiresAt)
                const expiryLabel = accessLabel(expiresAt)
                const busy = pendingKey === entitlement.id

                return (
                  <li key={entitlement.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{entitlement.product.name}</p>
                      <p className="text-sm text-ink-soft">
                        {ENTITLEMENT_TYPE_LABELS[entitlement.type]} · purchased{' '}
                        {new Date(entitlement.createdAt).toLocaleDateString('en-IN')}
                      </p>
                      <p className="mt-1 text-xs text-ink-faint">{expiryLabel}</p>
                    </div>
                    {expired ? (
                      entitlement.product.type === 'FLOOR_PLAN' ? (
                        <Link
                          to="/floor-plans/$slug"
                          params={{ slug: entitlement.product.slug }}
                          className={buttonClasses('secondary', 'sm', 'shrink-0')}
                        >
                          Buy again
                        </Link>
                      ) : (
                        <Link
                          to="/interiors/$slug"
                          params={{ slug: entitlement.product.slug }}
                          className={buttonClasses('secondary', 'sm', 'shrink-0')}
                        >
                          Buy again
                        </Link>
                      )
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        className="shrink-0"
                        disabled={pendingKey !== null}
                        onClick={() =>
                          download(
                            entitlement.id,
                            entitlement.product.id,
                            entitlement.downloadKind,
                            paidAssetFallbackFilename(entitlement.product.slug, entitlement.downloadKind),
                          )
                        }
                      >
                        {busy ? 'Preparing…' : 'Download'}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <div className="mt-3">
            <FormError message={downloadError} />
          </div>
        </section>

        <section className="mt-8" aria-label="Order history">
          <h2 className="text-base font-semibold text-ink">Order history</h2>
          {orders.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No orders yet.</p>
          ) : (
             <ul className="mt-3 divide-y divide-line rounded-[8px] border border-line bg-surface px-4">
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
