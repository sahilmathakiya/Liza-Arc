import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { hashPassword } from 'better-auth/crypto'
import { db } from './db'
import type { Env } from './env'

let auth: ReturnType<typeof betterAuth> | undefined

export function authFor(env: Env) {
  if (auth) return auth

  auth = betterAuth({
    database: prismaAdapter(db(env.DATABASE_URL), { provider: 'postgresql' }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN ?? 'http://localhost:3000'],
    emailAndPassword: { enabled: true },
    socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : undefined,
  }) as ReturnType<typeof betterAuth>

  return auth
}

export { hashPassword }

export function signUpRequest(request: Request, input: { name?: string; email?: string; password?: string }) {
  return new Request(new URL('/api/auth/sign-up/email', request.url), {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ name: input.name, email: input.email, password: input.password }),
  })
}
