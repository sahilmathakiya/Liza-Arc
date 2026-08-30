import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { authClient } from '#/lib/auth'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const { session } = Route.useRouteContext()

  async function handleSignOut() {
    await authClient.signOut()
    navigate({ to: '/' })
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">You are signed in.</p>

        <div className="mt-6 flex items-center gap-4">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name}
              className="h-12 w-12 rounded-full"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 text-lg font-semibold text-neutral-600">
              {session.user.name.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-semibold text-neutral-900">{session.user.name}</p>
            <p className="text-sm text-neutral-500">{session.user.email}</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="mt-8 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
