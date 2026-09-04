import { Link, createFileRoute } from '@tanstack/react-router'
import { AuthCard } from '#/components/auth/auth-card'
import { FormError } from '#/components/auth/form-error'
import { FormField } from '#/components/auth/form-field'
import { OAuthButtons } from '#/components/auth/oauth-buttons'
import { SubmitButton } from '#/components/auth/submit-button'
import { useAuthForm } from '#/hooks/use-auth-form'
import { authClient } from '#/lib/auth'

export const Route = createFileRoute('/_auth/signup')({
  head: () => ({ meta: [{ title: 'Sign up — liza-arch' }] }),
  component: SignupPage,
})

function SignupPage() {
  const { error, pending, handleSubmit } = useAuthForm(async (formData) => {
    const password = formData.get('password') as string
    if (password !== formData.get('confirmPassword')) {
      return { error: { message: 'Passwords do not match' } }
    }
    return authClient.signUp.email({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      password,
    })
  })

  return (
    <AuthCard
      title="Sign up"
      description="Create an account to get started."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-ink hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          id="name"
          label="Name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="Jane Doe"
        />
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
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <FormField
          id="confirmPassword"
          label="Confirm password"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Repeat your password"
        />
        <FormError message={error} />
        <SubmitButton pending={pending}>Create account</SubmitButton>
      </form>
      <div className="mt-4">
        <OAuthButtons />
      </div>
    </AuthCard>
  )
}
