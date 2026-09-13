import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createPrisma } from "./db";

export function createAuth(env: Env) {
  const prisma = createPrisma(env.DATABASE_URL);
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
