import { Link, createFileRoute } from '@tanstack/react-router'
import { Badge, statusTone } from '#/components/ui/badge'
import { EmptyState } from '#/components/ui/feedback'
import { Container, PageHeader } from '#/components/ui/layout'
import { Pagination, totalPagesFor } from '#/components/ui/pagination'
import { listAdminOrders } from '#/lib/orders'
import type { OrderStatus } from '#/lib/orders'
import { formatPrice } from '#/lib/products'

interface AdminOrdersSearch {
  status?: OrderStatus
  page?: number
}

const STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'FAILED']

function validateAdminOrdersSearch(search: Record<string, unknown>): AdminOrdersSearch {
  const status = search.status
  return {
    status: STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined,
    page: typeof search.page === 'number' && search.page > 1 ? search.page : undefined,
  }
}

export const Route = createFileRoute('/admin/orders/')({
  head: () => ({ meta: [{ title: 'Orders — liza-arch admin' }] }),
  validateSearch: validateAdminOrdersSearch,
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps: { search } }) => listAdminOrders(search),
  component: AdminOrdersPage,
})

function AdminOrdersPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { orders, total, limit } = Route.useLoaderData()
  const page = search.page ?? 1
  const totalPages = totalPagesFor(total, limit)

  const chipClass = (active: boolean) =>
       active
       ? 'rounded-full border border-active bg-brand/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand'
       : 'rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft transition hover:border-line-strong hover:text-brand'

  return (
    <Container className="py-8">
      <PageHeader title="Orders" subtitle={`${total} order${total === 1 ? '' : 's'} in total.`} />

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter orders by status">
        <button type="button" onClick={() => navigate({ search: {} })} className={chipClass(!search.status)}>
          All
        </button>
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => navigate({ search: { status } })}
            className={chipClass(search.status === status)}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {orders.length === 0 ? (
          <EmptyState title="No orders found" message="Orders will appear here as customers check out." />
        ) : (
            <div className="sleek-scrollbar overflow-x-auto rounded-[8px] border border-line bg-surface shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                 <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-[1.2px] text-ink-faint">
                  <th scope="col" className="px-4 py-3 font-medium">Order</th>
                  <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium">Items</th>
                  <th scope="col" className="px-4 py-3 font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr key={order.id} className="transition hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/orders/$id"
                        params={{ id: order.id }}
                        className="font-mono text-xs font-medium text-ink hover:underline"
                      >
                        {order.id.slice(0, 12)}…
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{order.user.name}</p>
                      <p className="text-xs text-ink-soft">{order.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{order.items.length}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatPrice(order.totalCents)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      {new Date(order.createdAt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        className="mt-6"
        page={page}
        totalPages={totalPages}
        onPageChange={(next) =>
          navigate({ search: (prev) => ({ ...prev, page: next > 1 ? next : undefined }) })
        }
      />
    </Container>
  )
}
