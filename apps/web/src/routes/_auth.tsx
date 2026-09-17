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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-4">
      <div className="architectural-grid pointer-events-none absolute inset-0 opacity-25" aria-hidden />
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}
