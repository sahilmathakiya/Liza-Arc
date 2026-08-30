import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-8 text-center">
      <h1 className="text-4xl font-bold text-neutral-900">liza-arch</h1>
      <p className="mt-3 max-w-md text-neutral-500">
        Hono + Prisma + better-auth API on Cloudflare Workers, with a TanStack Start frontend.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          to="/login"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
        >
          Sign in
        </Link>
        <Link
          to="/signup"
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Sign up
        </Link>
        <Link
          to="/dashboard"
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Dashboard
        </Link>
      </div>
    </div>
  )
}
