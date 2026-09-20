import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { AdminList } from '#/components/admin/admin-list'
import { CreateAdminForm } from '#/components/admin/create-admin-form'
import { AdminLayout } from '#/components/layout/admin-layout'
import type { AdminListResponse } from '#/lib/admin'
import { apiFetch } from '#/lib/api'
import { ROLE, getSessionSafe, isAdminRole } from '#/lib/auth'
import { Container, PageHeader } from '#/components/ui/layout'

export const Route = createFileRoute('/moat/')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Team — liza-arch admin' }] }),
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
    <AdminLayout>
      <Container className="max-w-3xl py-8">
        <PageHeader
          title="Team"
          subtitle={`Signed in as ${session.user.name} — ${isSuperAdmin ? 'super admin' : 'admin'}.`}
        />

        <div className="mt-6 space-y-6">
          {isSuperAdmin &&
            (usedSlots < maxAdmins ? (
              <CreateAdminForm onCreated={() => router.invalidate()} />
            ) : (
              <div className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-soft shadow-card">
                Admin limit reached ({usedSlots}/{maxAdmins}).
              </div>
            ))}

          <AdminList admins={admins} />
        </div>
      </Container>
    </AdminLayout>
  )
}
