import { apiFetch } from './api'
import type { RazorpayHandlerResponse } from './razorpay'
import type { AssetKind, EntitlementType, ProductType } from './products'

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED'

export interface OrderProductRef {
  id: string
  slug: string
  name: string
  type: ProductType
}

export interface OrderItemView {
  id: string
  entitlementType: EntitlementType
  priceCents: number
  product: OrderProductRef
  accessExpiresAt: string | null
}

export interface OrderView {
  id: string
  status: OrderStatus
  subtotalCents: number
  totalCents: number
  currency: string
  paymentRef: string | null
  razorpayOrderId: string | null
  createdAt: string
  items: OrderItemView[]
}

export interface CheckoutResponse {
  orderId: string
  status: OrderStatus
  currency: string
  subtotalCents: number
  totalCents: number
  items: OrderItemView[]
}

export interface EntitlementView {
  id: string
  type: EntitlementType
  createdAt: string
  expiresAt: string | null
  downloadKind: AssetKind
  product: OrderProductRef
}

export interface AdminOrderRow {
  id: string
  status: OrderStatus
  subtotalCents: number
  totalCents: number
  currency: string
  paymentRef: string | null
  createdAt: string
  user: { id: string; name: string; email: string }
  items: { id: string }[]
}

export interface AdminCustomerRow {
  id: string
  name: string
  email: string
  createdAt: string
  orderCount: number
  entitlementCount: number
  spentCents: number
}

export interface AdminEntitlementRow {
  id: string
  type: EntitlementType
  createdAt: string
  expiresAt: string | null
  product: OrderProductRef
}

export interface AdminCustomerDetail {
  id: string
  name: string
  email: string
  createdAt: string
  orders: OrderView[]
  entitlements: AdminEntitlementRow[]
}

export interface CheckoutItemInput {
  productId: string
  entitlementType: EntitlementType
}

export function createCheckout(items: CheckoutItemInput[]) {
  return apiFetch<CheckoutResponse>('/api/checkout', {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}

export interface RazorpayOrderSession {
  orderId: string
  keyId: string
  razorpayOrderId: string
  amount: number
  currency: string
  prefill: { name: string; email: string }
}

export function createRazorpayOrder(orderId: string) {
  return apiFetch<RazorpayOrderSession>(`/api/checkout/${orderId}/pay`, {
    method: 'POST',
  })
}

export function verifyRazorpayPayment(orderId: string, payment: RazorpayHandlerResponse) {
  return apiFetch<{ orderId: string; status: OrderStatus }>(`/api/checkout/${orderId}/verify`, {
    method: 'POST',
    body: JSON.stringify({
      razorpayOrderId: payment.razorpay_order_id,
      razorpayPaymentId: payment.razorpay_payment_id,
      razorpaySignature: payment.razorpay_signature,
    }),
  })
}

export function listMyOrders() {
  return apiFetch<{ orders: OrderView[] }>('/api/checkout/orders')
}

export function getMyOrder(orderId: string) {
  return apiFetch<{ order: OrderView }>(`/api/checkout/orders/${orderId}`)
}

export function listMyEntitlements() {
  return apiFetch<{ entitlements: EntitlementView[] }>('/api/checkout/entitlements')
}

export interface AdminStats {
  productCount: number
  publishedCount: number
  orderCount: number
  pendingOrders: number
  revenueCents: number
  customerCount: number
  entitlementCount: number
}

export function getAdminStats() {
  return apiFetch<AdminStats>('/api/admin/stats')
}

export function listAdminOrders(search: { status?: OrderStatus; page?: number }) {
  const params = new URLSearchParams()
  if (search.status) params.set('status', search.status)
  if (search.page) params.set('page', String(search.page))
  return apiFetch<{ total: number; page: number; limit: number; orders: AdminOrderRow[] }>(
    `/api/admin/orders?${params}`,
  )
}

export function getAdminOrder(orderId: string) {
  return apiFetch<{ order: OrderView & { user: { id: string; name: string; email: string } } }>(
    `/api/admin/orders/${orderId}`,
  )
}

export function listAdminCustomers(page = 1) {
  return apiFetch<{ total: number; page: number; limit: number; customers: AdminCustomerRow[] }>(
    `/api/admin/customers?page=${page}`,
  )
}

export function getAdminCustomer(customerId: string) {
  return apiFetch<{ customer: AdminCustomerDetail }>(`/api/admin/customers/${customerId}`)
}

export function grantEntitlement(customerId: string, productId: string, type: EntitlementType) {
  return apiFetch<{ entitlement: { id: string } }>(`/api/admin/customers/${customerId}/entitlements`, {
    method: 'POST',
    body: JSON.stringify({ productId, type }),
  })
}

export function revokeEntitlement(customerId: string, entitlementId: string) {
  return apiFetch<{ ok: boolean }>(
    `/api/admin/customers/${customerId}/entitlements/${entitlementId}`,
    { method: 'DELETE' },
  )
}
