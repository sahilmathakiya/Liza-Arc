import { useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'

type AuthResult = { error: { message?: string } | null }

export function useAuthForm(
  submit: (formData: FormData) => Promise<AuthResult>,
  redirectTo = '/dashboard',
) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await submit(formData)
      if (result?.error) {
        setError(result.error.message ?? 'Something went wrong. Please try again.')
        return
      }
      navigate({ to: redirectTo })
    })
  }

  return { error, pending, handleSubmit }
}
