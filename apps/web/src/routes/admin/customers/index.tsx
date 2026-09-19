import { Link, createFileRoute } from '@tanstack/react-router'
import { EmptyState } from '#/components/ui/feedback'
import { Container, PageHeader } from '#/components/ui/layout'
import { Pagination, totalPagesFor } from '#/components/ui/pagination'
import { listAdminCustomers } from '#/lib/orders'
import { formatPrice } from '#/lib/products'

interface AdminCustomersSearch {
  page?: number
}

function validateAdminCustomersSearch(search: Record<string, unknown>): AdminCustomersSearch {
  return {
    page: typeof search.page === 'number' && search.page > 1 ? search.page : undefined,
  }
}

export const Route = createFileRoute('/admin/customers/')({
  head: () => ({ meta: [{ title: 'Customers — liza-arch admin' }] }),
  validateSearch: validateAdminCustomersSearch,
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps: { search } }) => listAdminCustomers(search.page ?? 1),
  component: AdminCustomersPage,
})

function AdminCustomersPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { customers, total, limit } = Route.useLoaderData()
  const page = search.page ?? 1
  const totalPages = totalPagesFor(total, limit)

  return (
    <Container className="py-8">
      <PageHeader
        title="Customers"
        subtitle={`${total} customer${total === 1 ? '' : 's'} registered.`}
      />

      <div className="mt-6">
        {customers.length === 0 ? (
          <EmptyState
            title="No customers yet"
            message="Customers appear here once they sign up for an account."
          />
        ) : (
           <div className="sleek-scrollbar overflow-x-auto rounded-[8px] border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead>
                 <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-[1.2px] text-ink-faint">
                  <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium">Orders</th>
                  <th scope="col" className="px-4 py-3 font-medium">Owned items</th>
                  <th scope="col" className="px-4 py-3 font-medium">Total spent</th>
                  <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((customer) => (
                  <tr key={customer.id} className="transition hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <Link
                        to="/admin/customers/$id"
                        params={{ id: customer.id }}
                        className="font-medium text-ink hover:underline"
                      >
                        {customer.name}
                      </Link>
                      <p className="text-xs text-ink-soft">{customer.email}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{customer.orderCount}</td>
                    <td className="px-4 py-3 text-ink-soft">{customer.entitlementCount}</td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {formatPrice(customer.spentCents)}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      {new Date(customer.createdAt).toLocaleDateString('en-IN')}
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
