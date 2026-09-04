import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'liza-arch — Floor plans & interior plans',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  errorComponent: RootError,
  notFoundComponent: RootNotFound,
  pendingComponent: RootPending,
})

function RootPending() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <span role="status" className="inline-flex items-center gap-2 text-sm text-ink-soft">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
        Loading…
      </span>
    </div>
  )
}

function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-8 text-center">
      <h1 className="text-2xl font-bold text-neutral-900">Page not found</h1>
      <p className="mt-2 text-sm text-neutral-500">The page you are looking for does not exist.</p>
      <a
        href="/"
        className="mt-6 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        Go home
      </a>
    </div>
  )
}

function RootError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-8 text-center">
      <h1 className="text-2xl font-bold text-neutral-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-neutral-500">
        {error instanceof Error ? error.message : 'An unexpected error occurred.'}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        Reload page
      </button>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
