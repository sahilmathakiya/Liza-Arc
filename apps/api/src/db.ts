import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "./generated/prisma/client";

export function createPrisma(databaseUrl: string) {
  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export type Prisma = ReturnType<typeof createPrisma>;

/**
 * Workers forbid sharing I/O objects (DB sockets) across requests, so a client
 * cannot live at module scope. Instead every request gets exactly one client,
 * memoized on the incoming Request object, shared by auth and route handlers.
 */
const prismaByRequest = new WeakMap<Request, Prisma>();

export function getPrisma(c: { env: Env; req: { raw: Request } }): Prisma {
  let prisma = prismaByRequest.get(c.req.raw);
  if (!prisma) {
    prisma = createPrisma(c.env.DATABASE_URL);
    prismaByRequest.set(c.req.raw, prisma);
  }
  return prisma;
}

export function isPrismaError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === code;
}
