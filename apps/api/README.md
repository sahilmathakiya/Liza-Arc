```txt
npm install
npm run dev
```

```txt
npm run deploy
```

## Database and authentication

This API uses Supabase PostgreSQL with Prisma's standard PostgreSQL driver
adapter. Prisma CLI migrations use the direct Supabase connection string.

```txt
copy .env.example .env
npm run db:migrate:dev
npm run db:generate
```

Put the direct Supabase PostgreSQL URL in `apps/api/.env` as
`DIRECT_DATABASE_URL`. Put the Supabase Session Pooler URL in
`apps/api/.dev.vars` as `DATABASE_URL` for local Worker requests.
For production, set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and
`BETTER_AUTH_URL` with `wrangler secret put`.

Use the Session Pooler URL on port `5432` for the runtime. Do not use the
Transaction Pooler URL on port `6543` for Prisma migrations. The standard
`pg` adapter uses a TCP connection, so Cloudflare Workers deployment requires
Cloudflare Hyperdrive or another TCP bridge; local `wrangler dev` works with
the runtime URL directly.
Google OAuth is enabled when both `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` are set. The callback URL is
`<BETTER_AUTH_URL>/api/auth/callback/google`.

Better Auth is available under `/api/auth/*`; `/api/me` is a small authenticated
session example.

## Source layout

- `src/app.ts` creates the Hono application and mounts middleware and route groups.
- `src/routes/auth.ts` contains Better Auth and session endpoints.
- `src/routes/admin.ts` contains admin endpoints and their small business rules.
- `src/db.ts` creates the cached Prisma client and contains all database operations.
- `src/auth.ts` creates the cached Better Auth instance and shared auth helpers.
- `src/env.ts` contains the Worker environment type.

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
