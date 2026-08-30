import { Link, createFileRoute } from '@tanstack/react-router'
import { AuthCard } from '#/components/auth/auth-card'
import { FormError } from '#/components/auth/form-error'
import { FormField } from '#/components/auth/form-field'
import { OAuthButtons } from '#/components/auth/oauth-buttons'
import { SubmitButton } from '#/components/auth/submit-button'
import { useAuthForm } from '#/hooks/use-auth-form'
import { authClient } from '#/lib/auth'
import { sanitizeRedirect } from '#/lib/redirect'

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search): { redirect?: string } => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  const { error, pending, handleSubmit } = useAuthForm(
    (formData) =>
      authClient.signIn.email({
        email: formData.get('email') as string,
        password: formData.get('password') as string,
      }),
    redirect ?? '/dashboard',
  )

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back, sign in to your account."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-neutral-900 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          id="email"
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        <FormField
          id="password"
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
        <FormError message={error} />
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>
      <div className="mt-4">
        <OAuthButtons />
      </div>
    </AuthCard>
  )
}
