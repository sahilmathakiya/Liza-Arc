import { Hono } from 'hono'
import { authFor, hashPassword, signUpRequest } from '../lib/auth'
import { ADMIN, db, deleteAdmin, deleteUser, findUser, getAdminControl, credentialAccount, listAdmins, makeAdmin, makeSuperAdmin, updatePassword, updateUser, SUPER_ADMIN } from '../lib/db'
import type { Env } from '../lib/env'

export const adminRoutes = new Hono<{ Bindings: Env }>()
type Input = { name?: string; email?: string; password?: string }
type SignupResult = { user?: { id: string; name: string; email: string } }

function errorResponse(error: unknown) {
  const status = error instanceof AdminError ? error.status : 500
  if (!(error instanceof AdminError)) console.error(error)
  return Response.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status })
}

class AdminError extends Error {
  constructor(public status: 400 | 403 | 404 | 409 | 500, message: string) { super(message) }
}

async function adminUser(env: Env, headers: Headers) {
  const session = await authFor(env).api.getSession({ headers })
  if (!session) return null
  const user = await findUser(db(env.DATABASE_URL), session.user.id)
  return user && (user.role === ADMIN || user.role === SUPER_ADMIN) ? user : null
}

async function createAuthUser(env: Env, request: Request, input: Input) {
  if (!input.name || !input.email || !input.password) throw new AdminError(400, 'Name, email, and password are required')
  const response = await authFor(env).handler(signUpRequest(request, input))
  if (!response.ok) return { response }
  const result = (await response.clone().json()) as SignupResult
  if (!result.user) throw new AdminError(500, 'Could not create admin account')
  return { response, user: result.user }
}

adminRoutes.get('/me', async (c) => {
  try {
    const user = await adminUser(c.env, c.req.raw.headers)
    if (!user) throw new AdminError(403, 'Admin access required')
    const prisma = db(c.env.DATABASE_URL)
    const control = await getAdminControl(prisma)
    return c.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      adminCount: control?.adminCount ?? 0,
      canCreateAdmins: user.role === SUPER_ADMIN && (control?.adminCount ?? 3) < 3,
      admins: user.role === SUPER_ADMIN ? await listAdmins(prisma) : [],
    })
  } catch (error) { return errorResponse(error) }
})

adminRoutes.post('/bootstrap', async (c) => {
  try {
    const input = await c.req.json<Input & { adminKey?: string }>()
    if (!c.env.ADMIN_KEY || input.adminKey !== c.env.ADMIN_KEY) throw new AdminError(403, 'Invalid admin key')
    const prisma = db(c.env.DATABASE_URL)
    const control = await getAdminControl(prisma)
    if (!control || control.adminCount > 0 || control.superAdminId) throw new AdminError(409, 'Admin bootstrap is no longer available')
    const created = await createAuthUser(c.env, c.req.raw, input)
    if ('response' in created && !created.user) return created.response
    const claimed = await makeSuperAdmin(prisma, created.user!.id)
    if (!claimed) { await deleteUser(prisma, created.user!.id).catch(() => undefined); throw new AdminError(409, 'Admin bootstrap is no longer available') }
    return created.response
  } catch (error) { return errorResponse(error) }
})

adminRoutes.post('/admins', async (c) => {
  try {
    const user = await adminUser(c.env, c.req.raw.headers)
    if (!user || user.role !== SUPER_ADMIN) throw new AdminError(403, 'Only the super admin can create admins')
    const created = await createAuthUser(c.env, c.req.raw, await c.req.json<Input>())
    if ('response' in created && !created.user) return created.response
    const claimed = await makeAdmin(db(c.env.DATABASE_URL), created.user!.id)
    if (!claimed) { await deleteUser(db(c.env.DATABASE_URL), created.user!.id).catch(() => undefined); throw new AdminError(409, 'The maximum number of admins already exists') }
    return c.json({ user: created.user, role: ADMIN }, 201)
  } catch (error) { return errorResponse(error) }
})

adminRoutes.patch('/admins/:id', async (c) => {
  try {
    const user = await adminUser(c.env, c.req.raw.headers)
    if (!user || user.role !== SUPER_ADMIN) throw new AdminError(403, 'Only the super admin can edit admins')
    const input = await c.req.json<Input>()
    if (!input.name && !input.email && !input.password) throw new AdminError(400, 'Provide a name, email, or password to update')
    if (input.password && input.password.length < 8) throw new AdminError(400, 'Password must be at least 8 characters')
    const prisma = db(c.env.DATABASE_URL)
    const target = await findUser(prisma, c.req.param('id'))
    if (!target || target.role !== ADMIN) throw new AdminError(404, 'Admin not found')
    if (input.name || input.email) await updateUser(prisma, target.id, { ...(input.name ? { name: input.name } : {}), ...(input.email ? { email: input.email } : {}) })
    if (input.password) {
      const account = await credentialAccount(prisma, target.id)
      if (!account) throw new AdminError(404, 'Credential account not found')
      await updatePassword(prisma, account.id, await hashPassword(input.password))
    }
    return c.json({ ok: true })
  } catch (error) { return errorResponse(error) }
})

adminRoutes.delete('/admins/:id', async (c) => {
  try {
    const user = await adminUser(c.env, c.req.raw.headers)
    if (!user || user.role !== SUPER_ADMIN) throw new AdminError(403, 'Only the super admin can delete admins')
    const prisma = db(c.env.DATABASE_URL)
    const target = await findUser(prisma, c.req.param('id'))
    if (!target || target.role !== ADMIN) throw new AdminError(404, 'Admin not found')
    await deleteAdmin(prisma, target.id)
    return c.json({ ok: true })
  } catch (error) { return errorResponse(error) }
})
