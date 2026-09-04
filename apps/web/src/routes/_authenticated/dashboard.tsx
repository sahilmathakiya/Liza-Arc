import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { PasswordForm } from '#/components/account/password-form'
import { Button } from '#/components/ui/button'
import { Container } from '#/components/ui/layout'
import { authClient, isAdminRole } from '#/lib/auth'

export const Route = createFileRoute('/_authenticated/dashboard')({
  head: () => ({ meta: [{ title: 'Account — liza-arch' }] }),
  loader: async () => {
    const { data } = await authClient.listAccounts()
    const hasPassword = (data ?? []).some((account) => account.providerId === 'credential')
    return { hasPassword }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const { session } = Route.useRouteContext()
  const { hasPassword } = Route.useLoaderData()

  async function handleSignOut() {
    await authClient.signOut()
    navigate({ to: '/' })
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <Container className="flex h-16 items-center justify-between">
          <Link to="/" className="text-base font-semibold tracking-tight text-ink">
            liza-arch
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              to="/purchases"
              className="rounded-md px-3 py-2 text-sm text-ink-soft transition hover:text-ink"
            >
              My purchases
            </Link>
            <Link
              to="/floor-plans"
              className="rounded-md px-3 py-2 text-sm text-ink-soft transition hover:text-ink"
            >
              Browse plans
            </Link>
          </nav>
        </Container>
      </header>

      <Container className="max-w-2xl py-10">
        <div className="rounded-lg border border-line bg-surface p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Account</h1>
          <p className="mt-1 text-sm text-ink-soft">You are signed in.</p>

          <div className="mt-6 flex items-center gap-4">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name}
                className="h-12 w-12 rounded-full border border-line"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-lg font-semibold text-ink">
                {session.user.name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-medium text-ink">{session.user.name}</p>
              <p className="text-sm text-ink-soft">{session.user.email}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/purchases"
              className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground transition hover:bg-brand/85"
            >
              My purchases
            </Link>
            {isAdminRole(session.user.role) && (
              <Link
                to="/admin"
                className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink transition hover:bg-surface-muted"
              >
                Admin dashboard
              </Link>
            )}
            <Button variant="secondary" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-line bg-surface p-8">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {hasPassword ? 'Change password' : 'Set password'}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {hasPassword
              ? 'Update the password you use to sign in with your email.'
              : 'You currently sign in with Google. Set a password to also sign in with your email.'}
          </p>
          <PasswordForm hasPassword={hasPassword} />
        </div>
      </Container>
    </div>
  )
}
