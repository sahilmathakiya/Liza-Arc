import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { FormError } from '#/components/auth/form-error'
import { Badge, statusTone } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/ui/feedback'
import { Label, Select } from '#/components/ui/field'
import { Container } from '#/components/ui/layout'
import { getAdminCustomer, grantEntitlement, revokeEntitlement } from '#/lib/orders'
import { accessLabel } from '#/lib/expiry'
import type { EntitlementType } from '#/lib/products'
import { ENTITLEMENT_TYPE_LABELS, formatPrice, listProducts } from '#/lib/products'

export const Route = createFileRoute('/admin/customers/$id')({
  head: () => ({ meta: [{ title: 'Customer — liza-arch admin' }] }),
  loader: async ({ params }) => {
    const [{ customer }, { products }] = await Promise.all([
      getAdminCustomer(params.id),
      listProducts(1, 50),
    ])
    return { customer, products }
  },
  component: AdminCustomerDetailPage,
})

function AdminCustomerDetailPage() {
  const router = useRouter()
  const { customer, products } = Route.useLoaderData()
  const [productId, setProductId] = useState('')
  const [type, setType] = useState<EntitlementType>('FLOOR_PLAN')
  const [grantError, setGrantError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const selectedProduct = products.find((product) => product.id === productId)
  const allowedTypes = useMemo<EntitlementType[]>(() => {
    if (!selectedProduct) return []
    return selectedProduct.type === 'FLOOR_PLAN'
      ? ['FLOOR_PLAN', 'ELEVATION_IMAGE']
      : ['WORKING_DRAWING']
  }, [selectedProduct])

  async function handleGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!productId) return
    setGrantError(null)
    setPending(true)
    try {
      await grantEntitlement(customer.id, productId, type)
      await router.invalidate()
    } catch (e) {
      setGrantError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setPending(false)
    }
  }

  async function handleRevoke(entitlementId: string) {
    if (!window.confirm('Revoke this item from the customer?')) return
    setActionError(null)
    try {
      await revokeEntitlement(customer.id, entitlementId)
      await router.invalidate()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  return (
    <Container className="max-w-4xl py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <Link to="/admin/customers" className="transition hover:text-ink">
          Customers
        </Link>
        <span aria-hidden className="mx-2 text-ink-faint">
          /
        </span>
        <span className="text-ink">{customer.name}</span>
      </nav>

      <div className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-card">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{customer.name}</h1>
        <p className="mt-1 text-sm text-ink-soft">{customer.email}</p>
        <p className="mt-1 text-xs text-ink-faint">
          Joined {new Date(customer.createdAt).toLocaleDateString('en-IN')}
        </p>
      </div>

      <section className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-card" aria-label="Owned items">
        <h2 className="text-base font-semibold text-ink">Owned items</h2>
        {customer.entitlements.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No owned items" message="Grant access below or wait for a purchase." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {customer.entitlements.map((entitlement) => (
              <li key={entitlement.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{entitlement.product.name}</p>
                  <p className="text-sm text-ink-soft">
                    {ENTITLEMENT_TYPE_LABELS[entitlement.type]} ·{' '}
                    {new Date(entitlement.createdAt).toLocaleDateString('en-IN')}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">{accessLabel(entitlement.expiresAt)}</p>
                </div>
                <Button variant="danger" size="sm" onClick={() => handleRevoke(entitlement.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <FormError message={actionError} />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-card" aria-label="Grant access">
        <h2 className="text-base font-semibold text-ink">Grant item manually</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Give free access for promotions or customer support.
        </p>
        <form onSubmit={handleGrant} className="mt-4 grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label htmlFor="grant-product">Product</Label>
            <Select
              id="grant-product"
              value={productId}
              required
              onChange={(e) => {
                setProductId(e.target.value)
                const next = products.find((product) => product.id === e.target.value)
                setType(next?.type === 'INTERIOR_PLAN' ? 'WORKING_DRAWING' : 'FLOOR_PLAN')
              }}
            >
              <option value="" disabled>
                Select product
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.type === 'FLOOR_PLAN' ? 'Floor plan' : 'Interior'})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="grant-type">Item</Label>
            <Select
              id="grant-type"
              value={type}
              disabled={!productId}
              onChange={(e) => setType(e.target.value as EntitlementType)}
            >
              {allowedTypes.map((allowed) => (
                <option key={allowed} value={allowed}>
                  {ENTITLEMENT_TYPE_LABELS[allowed]}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={pending || !productId}>
            {pending ? 'Granting…' : 'Grant access'}
          </Button>
        </form>
        <div className="mt-3">
          <FormError message={grantError} />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-card" aria-label="Customer orders">
        <h2 className="text-base font-semibold text-ink">Orders</h2>
        {customer.orders.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No orders yet" />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {customer.orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <Link
                    to="/admin/orders/$id"
                    params={{ id: order.id }}
                    className="font-mono text-sm font-medium text-ink hover:underline"
                  >
                    {order.id.slice(0, 12)}…
                  </Link>
                  <p className="text-xs text-ink-soft">
                    {new Date(order.createdAt).toLocaleString('en-IN')} · {order.items.length} item
                    {order.items.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="font-medium text-ink">{formatPrice(order.totalCents)}</p>
                  <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  )
}
