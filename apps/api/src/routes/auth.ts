import { Hono } from 'hono'
import { authFor } from '../lib/auth'
import type { Env } from '../lib/env'

export const authRoutes = new Hono<{ Bindings: Env }>()
authRoutes.on(['GET', 'POST'], '/*', (c) => authFor(c.env).handler(c.req.raw))

export const sessionRoutes = new Hono<{ Bindings: Env }>()
sessionRoutes.get('/me', async (c) => {
  const session = await authFor(c.env).api.getSession({ headers: c.req.raw.headers })
  return session ? c.json(session) : c.json({ user: null }, 401)
})
