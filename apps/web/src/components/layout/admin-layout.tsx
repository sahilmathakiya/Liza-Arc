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
              'whitespace-nowrap border-l-2 border-active px-3 py-2 text-sm font-medium text-brand',
          }}
          inactiveProps={{
            className:
              'whitespace-nowrap px-3 py-2 text-sm text-ink-soft transition hover:text-ink',
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
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-r lg:border-line lg:bg-surface">
        <div className="border-b border-line px-4 py-5">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[1.4px] text-ink"><span className="h-2.5 w-2.5 bg-brand" aria-hidden />liza-arch</p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[1.2px] text-brand">Admin console</p>
        </div>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-2 p-4">
          <NavItems />
        </nav>
        <div className="border-t border-line p-3">
          <Link
            to="/"
            className="block px-3 py-2 text-sm text-ink-soft transition hover:text-ink"
          >
            View store
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-surface lg:hidden">
          <div className="flex items-center justify-between px-4 py-4">
            <p className="text-sm font-black uppercase tracking-[1.2px] text-ink">liza-arch <span className="text-brand">/ admin</span></p>
            <Link to="/" className="text-sm text-ink-soft transition hover:text-ink">
              View store
            </Link>
          </div>
          <nav
            aria-label="Admin"
            className="scrollbar-hidden flex gap-3 overflow-x-auto border-t border-line px-4 py-3"
          >
            <NavItems />
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
