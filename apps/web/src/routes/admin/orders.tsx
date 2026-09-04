import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/orders')({
  component: AdminOrdersLayout,
})

function AdminOrdersLayout() {
  return <Outlet />
}
