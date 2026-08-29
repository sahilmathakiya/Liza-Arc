import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './lib/env'
import { adminRoutes } from './routes/admin'
import { authRoutes, sessionRoutes } from './routes/auth'

export function app() {
  const api = new Hono<{ Bindings: Env }>()
  api.use('/api/*', (c, next) => cors({ origin: c.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true })(c, next))
  api.get('/', (c) => c.text('Hello Hono!'))
  api.route('/api/auth', authRoutes)
  api.route('/api', sessionRoutes)
  api.route('/api/admin', adminRoutes)
  return api
}
