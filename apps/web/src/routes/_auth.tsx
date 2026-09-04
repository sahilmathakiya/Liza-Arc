import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionSafe } from '#/lib/auth'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const session = await getSessionSafe()
    if (session) {
      throw redirect({ to: '/' })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}
