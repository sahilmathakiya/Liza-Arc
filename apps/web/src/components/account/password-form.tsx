import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { FormError } from '#/components/auth/form-error'
import { FormField } from '#/components/auth/form-field'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const newPassword = String(formData.get('newPassword') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    setError(null)
    setSuccess(null)

    if (newPassword.length < 8) {
      setError('The new password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    startTransition(async () => {
      try {
        await apiFetch('/api/account/password', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: hasPassword ? formData.get('currentPassword') : undefined,
            newPassword,
          }),
        })
        form.reset()
        setSuccess(
          hasPassword
            ? 'Password changed successfully.'
            : 'Password set successfully — you can now sign in with your email too.',
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {hasPassword && (
        <FormField
          id="current-password"
          label="Current password"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Your current password"
        />
      )}
      <FormField
        id="new-password"
        label="New password"
        name="newPassword"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="At least 8 characters"
      />
      <FormField
        id="confirm-password"
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Repeat the new password"
      />
      <FormError message={error} />
      {success && (
        <p role="status" className="rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-ink">
          {success}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
      </Button>
    </form>
  )
}
