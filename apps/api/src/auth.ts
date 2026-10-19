import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createPrisma, getPrisma } from "./db";
import type { Prisma } from "./db";

export function createAuth(env: Env, prisma: Prisma = createPrisma(env.DATABASE_URL)) {
  const crossSiteCookies = env.BETTER_AUTH_URL.startsWith("https://");

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL, env.WEB_URL],
    advanced: {
      defaultCookieAttributes: crossSiteCookies
        ? { sameSite: "none", secure: true }
        : undefined,
    },
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "user",
          input: false,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

export type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

const authByRequest = new WeakMap<Request, Auth>();

/** One better-auth instance per request, sharing the request's Prisma client. */
export function getAuth(c: { env: Env; req: { raw: Request } }): Auth {
  let auth = authByRequest.get(c.req.raw);
  if (!auth) {
    auth = createAuth(c.env, getPrisma(c));
    authByRequest.set(c.req.raw, auth);
  }
  return auth;
}

export function getSession(c: { env: Env; req: { raw: Request } }) {
  return getAuth(c).api.getSession({ headers: c.req.raw.headers });
}
