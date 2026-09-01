import { Hono } from "hono";
import type { Context } from "hono";
import { createAuth } from "../auth";
import { createPrisma } from "../db";
import { MAX_ADMINS, ROLE, isAdminRole } from "../roles";
import type { Role } from "../roles";

type AdminContext = Context<{ Bindings: Env }>;

function parseAccountBody(raw: unknown): { name: string; email: string; password: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const { name, email, password } = raw as Record<string, unknown>;
  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") return null;
  if (!name.trim() || !email.includes("@") || password.length < 8) return null;
  return { name: name.trim(), email: email.trim(), password };
}

async function getSession(c: AdminContext) {
  return createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
}

async function createAccount(
  c: AdminContext,
  input: { name: string; email: string; password: string; role: Role },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const auth = createAuth(c.env);
    const result = await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
    });
    if (!result?.user?.id) return { ok: false, error: "Failed to create account" };

    const prisma = createPrisma(c.env.DATABASE_URL);
    await prisma.user.update({
      where: { id: result.user.id },
      data: { role: input.role },
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create account",
    };
  }
}

export const adminRouter = new Hono<{ Bindings: Env }>();

adminRouter.get("/signup-open", async (c) => {
  const prisma = createPrisma(c.env.DATABASE_URL);
  const superAdmin = await prisma.user.findFirst({
    where: { role: ROLE.superAdmin },
    select: { id: true },
  });
  return c.json({ open: !superAdmin });
});

adminRouter.post("/signup", async (c) => {
  const raw = await c.req.json().catch(() => null);
  const body = parseAccountBody(raw);
  const adminKey = raw && typeof raw === "object" ? (raw as Record<string, unknown>).adminKey : undefined;

  if (!c.env.ADMIN_KEY || typeof adminKey !== "string" || adminKey !== c.env.ADMIN_KEY) {
    return c.json({ error: "Invalid admin key" }, 403);
  }
  if (!body) {
    return c.json({ error: "Name, a valid email and a password of at least 8 characters are required" }, 400);
  }

  const prisma = createPrisma(c.env.DATABASE_URL);
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: ROLE.superAdmin },
    select: { id: true },
  });
  if (existingSuperAdmin) {
    return c.json({ error: "Admin signup is closed" }, 403);
  }

  const result = await createAccount(c, { ...body, role: ROLE.superAdmin });
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json({ ok: true });
});

adminRouter.post("/create", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  if (session.user.role !== ROLE.superAdmin) {
    return c.json({ error: "Only the super admin can create admins" }, 403);
  }

  const body = parseAccountBody(await c.req.json().catch(() => null));
  if (!body) {
    return c.json({ error: "Name, a valid email and a password of at least 8 characters are required" }, 400);
  }

  const prisma = createPrisma(c.env.DATABASE_URL);
  const adminCount = await prisma.user.count({ where: { role: ROLE.admin } });
  if (adminCount >= MAX_ADMINS) {
    return c.json({ error: `Admin limit reached (max ${MAX_ADMINS})` }, 403);
  }

  const result = await createAccount(c, { ...body, role: ROLE.admin });
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json({ ok: true });
});

adminRouter.get("/list", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  if (!isAdminRole(session.user.role)) return c.json({ error: "Forbidden" }, 403);

  const prisma = createPrisma(c.env.DATABASE_URL);
  const admins = await prisma.user.findMany({
    where: { role: { in: [ROLE.admin, ROLE.superAdmin] } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return c.json({ admins, maxAdmins: MAX_ADMINS });
});
