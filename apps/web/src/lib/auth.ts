import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8787',
})

export function signInWithGoogle() {
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: `${window.location.origin}/dashboard`,
    errorCallbackURL: `${window.location.origin}/login`,
  })
}
