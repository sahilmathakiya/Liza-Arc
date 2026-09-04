import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', exact: true },
  { to: '/admin/upload', label: 'Upload product', exact: false },
  { to: '/admin/products', label: 'Products', exact: false },
  { to: '/admin/orders', label: 'Orders', exact: false },
  { to: '/admin/customers', label: 'Customers', exact: false },
  { to: '/moat', label: 'Team', exact: false },
] as const

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {ADMIN_NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          activeOptions={item.exact ? { exact: true } : undefined}
          activeProps={{
            className:
              'whitespace-nowrap rounded-md bg-surface-muted px-3 py-2 text-sm font-medium text-ink',
          }}
          inactiveProps={{
            className:
              'whitespace-nowrap rounded-md px-3 py-2 text-sm text-ink-soft transition hover:bg-surface-muted hover:text-ink',
          }}
        >
          {item.label}
        </Link>
      ))}
    </>
  )
}

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-56 lg:flex-col lg:border-r lg:border-line lg:bg-surface">
        <div className="border-b border-line px-4 py-5">
          <p className="text-sm font-semibold tracking-tight text-ink">liza-arch</p>
          <p className="mt-0.5 text-xs text-ink-faint">Admin console</p>
        </div>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 p-3">
          <NavItems />
        </nav>
        <div className="border-t border-line p-3">
          <Link
            to="/"
            className="block rounded-md px-3 py-2 text-sm text-ink-soft transition hover:bg-surface-muted hover:text-ink"
          >
            View store
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface lg:hidden">
          <div className="flex items-center justify-between px-4 pt-3">
            <p className="text-sm font-semibold tracking-tight text-ink">liza-arch admin</p>
            <Link to="/" className="text-xs text-ink-soft transition hover:text-ink">
              View store
            </Link>
          </div>
          <nav
            aria-label="Admin"
            className="flex gap-1 overflow-x-auto px-3 py-2"
          >
            <NavItems />
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
