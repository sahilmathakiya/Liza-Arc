import { createFileRoute, isRedirect, redirect } from '@tanstack/react-router'
import { AuthCard } from '#/components/auth/auth-card'
import { FormError } from '#/components/auth/form-error'
import { FormField } from '#/components/auth/form-field'
import { SubmitButton } from '#/components/auth/submit-button'
import { useAuthForm } from '#/hooks/use-auth-form'
import { apiFetch } from '#/lib/api'

export const Route = createFileRoute('/moat/admin_signup')({
  beforeLoad: async () => {
    try {
      const { open } = await apiFetch<{ open: boolean }>('/api/admin/signup-open')
      if (!open) {
        throw redirect({ to: '/' })
      }
    } catch (error) {
      if (isRedirect(error)) throw error
    }
  },
  component: AdminSignupPage,
})

function AdminSignupPage() {
  const { error, pending, handleSubmit } = useAuthForm(async (formData) => {
    try {
      await apiFetch('/api/admin/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          password: formData.get('password'),
          adminKey: formData.get('adminKey'),
        }),
      })
      return { error: null }
    } catch (e) {
      return { error: { message: e instanceof Error ? e.message : 'Something went wrong' } }
    }
  }, '/login')

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm">
        <AuthCard
          title="Admin signup"
          description="Create the first admin account using the secret key."
          footer="This page is closed once the first admin exists."
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
              id="adminKey"
              label="Admin key"
              name="adminKey"
              type="password"
              required
              autoComplete="off"
              placeholder="Secret admin key"
            />
            <FormError message={error} />
            <SubmitButton pending={pending}>Create admin account</SubmitButton>
          </form>
        </AuthCard>
      </div>
    </div>
  )
}
