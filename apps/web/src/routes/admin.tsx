import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AdminLayout } from '#/components/layout/admin-layout'
import { getSessionSafe, isAdminRole } from '#/lib/auth'

export const Route = createFileRoute('/admin')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const session = await getSessionSafe()
    if (!session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.pathname },
      })
    }
    if (!isAdminRole(session.user.role)) {
      throw redirect({ to: '/dashboard' })
    }
    return { session }
  },
  component: AdminGroupLayout,
})

function AdminGroupLayout() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}
