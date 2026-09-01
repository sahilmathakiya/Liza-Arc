import { createAuthClient } from 'better-auth/react'
import { API_URL } from './api'

export const authClient = createAuthClient({
  baseURL: API_URL,
})

export const ROLE = {
  user: 'user',
  admin: 'admin',
  superAdmin: 'super_admin',
} as const

export type Role = (typeof ROLE)[keyof typeof ROLE]

type BaseSession = NonNullable<Awaited<ReturnType<typeof authClient.getSession>>['data']>

export type AppSession = Omit<BaseSession, 'user'> & {
  user: BaseSession['user'] & { role: Role }
}

export function isAdminRole(role: string | null | undefined): role is Role {
  return role === ROLE.admin || role === ROLE.superAdmin
}

export async function getSessionSafe(): Promise<AppSession | null> {
  try {
    const { data } = await authClient.getSession()
    return (data as AppSession | null) ?? null
  } catch {
    return null
  }
}

export function signInWithGoogle() {
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: `${window.location.origin}/dashboard`,
    errorCallbackURL: `${window.location.origin}/login`,
  })
}
