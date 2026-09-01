import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { AdminList } from '#/components/admin/admin-list'
import { CreateAdminForm } from '#/components/admin/create-admin-form'
import type { AdminListResponse } from '#/lib/admin'
import { apiFetch } from '#/lib/api'
import { ROLE, getSessionSafe, isAdminRole } from '#/lib/auth'

export const Route = createFileRoute('/moat/')({
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
  loader: () => apiFetch<AdminListResponse>('/api/admin/list'),
  component: AdminDashboardPage,
})

function AdminDashboardPage() {
  const router = useRouter()
  const { session } = Route.useRouteContext()
  const { admins, maxAdmins } = Route.useLoaderData()
  const isSuperAdmin = session.user.role === ROLE.superAdmin
  const usedSlots = admins.filter((admin) => admin.role === ROLE.admin).length

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Admin dashboard</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Signed in as {session.user.name}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
              {isSuperAdmin ? 'Super admin' : 'Admin'}
            </span>
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Manage your team and account settings from this dashboard.
          </p>
        </div>

        {isSuperAdmin &&
          (usedSlots < maxAdmins ? (
            <CreateAdminForm onCreated={() => router.invalidate()} />
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
              Admin limit reached ({usedSlots}/{maxAdmins}).
            </div>
          ))}

        <AdminList admins={admins} />
      </div>
    </div>
  )
}
