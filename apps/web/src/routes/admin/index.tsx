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
            className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground transition hover:bg-brand/85"
          >
            Upload product
          </Link>
        }
      />

      <dl className="mt-6 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-surface p-5">
            <dt className="text-xs uppercase tracking-wide text-ink-faint">{tile.label}</dt>
            <dd className="mt-2 text-2xl font-semibold tracking-tight text-ink">{tile.value}</dd>
            {tile.note && <dd className="mt-1 text-xs text-ink-soft">{tile.note}</dd>}
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-lg border border-line bg-surface p-5 text-sm text-ink-soft">
        Manage everything from the sidebar: upload new plans, publish products, track orders and
        support customers with access grants.
      </div>
    </Container>
  )
}
