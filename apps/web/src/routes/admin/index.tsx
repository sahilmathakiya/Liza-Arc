import { Link, createFileRoute } from '@tanstack/react-router'
import { Container, PageHeader } from '#/components/ui/layout'
import { getAdminStats } from '#/lib/orders'
import { formatPrice } from '#/lib/products'

export const Route = createFileRoute('/admin/')({
  loader: () => getAdminStats(),
  component: AdminHubPage,
})

function AdminHubPage() {
  const stats = Route.useLoaderData()
  const { session } = Route.useRouteContext()

  const tiles = [
    { label: 'Revenue (paid)', value: formatPrice(stats.revenueCents) },
    {
      label: 'Orders',
      value: String(stats.orderCount),
      note: stats.pendingOrders > 0 ? `${stats.pendingOrders} awaiting payment` : undefined,
    },
    { label: 'Customers', value: String(stats.customerCount) },
    {
      label: 'Products',
      value: String(stats.productCount),
      note: `${stats.publishedCount} published`,
    },
    { label: 'Items delivered', value: String(stats.entitlementCount) },
  ]

  return (
    <Container className="py-8">
      <PageHeader
        title="Dashboard"
        subtitle={`Store overview — signed in as ${session.user.name}.`}
        actions={
          <Link
            to="/admin/upload"
            className="inline-flex h-10 items-center rounded-[6px] border border-active bg-brand px-4 text-xs font-bold uppercase tracking-[1px] !text-brand-foreground transition hover:bg-active"
          >
            Upload product
          </Link>
        }
      />

      <dl className="mt-8 grid gap-px overflow-hidden rounded-[8px] border border-line bg-line-subtle shadow-card sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-surface p-5">
            <dt className="text-[11px] font-semibold uppercase tracking-[1.2px] text-ink-faint">{tile.label}</dt>
            <dd className="mt-3 text-3xl font-black tracking-tight text-brand">{tile.value}</dd>
            {tile.note && <dd className="mt-1 text-xs text-ink-soft">{tile.note}</dd>}
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-[8px] border border-line bg-surface p-5 text-sm leading-relaxed text-ink-soft shadow-card">
        Manage everything from the sidebar: upload new plans, publish products, track orders and
        support customers with access grants.
      </div>
    </Container>
  )
}
