import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { FormError } from '#/components/auth/form-error'
import { FormField } from '#/components/auth/form-field'
import { apiFetch } from '#/lib/api'

export function CreateAdminForm({ onCreated }: { onCreated: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setError(null)
    startTransition(async () => {
      try {
        await apiFetch('/api/admin/create', {
          method: 'POST',
          body: JSON.stringify({
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
          }),
        })
        form.reset()
        onCreated()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">Create admin</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Admins can view the dashboard but cannot create other admins.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <FormField
          id="admin-name"
          label="Name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder="Jane Doe"
        />
        <FormField
          id="admin-email"
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="admin@example.com"
        />
        <FormField
          id="admin-password"
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <FormError message={error} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Creating…' : 'Create admin'}
        </button>
      </form>
    </div>
  )
}
