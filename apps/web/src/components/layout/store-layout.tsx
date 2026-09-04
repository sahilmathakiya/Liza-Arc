import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Container } from '#/components/ui/layout'
import type { AppSession } from '#/lib/auth'
import { getSessionSafe } from '#/lib/auth'

const NAV_ITEMS = [
  { to: '/floor-plans', label: 'Floor plans' },
  { to: '/interiors', label: 'Interior plans' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
] as const

function Wordmark() {
  return (
    <Link to="/" className="text-base font-semibold tracking-tight text-ink">
      liza-arch
    </Link>
  )
}

function StoreHeader() {
  const [session, setSession] = useState<AppSession | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let active = true
    getSessionSafe().then((result) => {
      if (active) setSession(result)
    })
    return () => {
      active = false
    }
  }, [])

  const activeNavClass = 'rounded-md px-3 py-2 text-sm font-medium text-ink transition'
  const inactiveNavClass = 'rounded-md px-3 py-2 text-sm text-ink-soft transition hover:text-ink'

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Wordmark />
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: activeNavClass }}
                inactiveProps={{ className: inactiveNavClass }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          {session ? (
            <>
              <Link to="/purchases" activeProps={{ className: activeNavClass }} inactiveProps={{ className: inactiveNavClass }}>
                My purchases
              </Link>
              <Link to="/dashboard" activeProps={{ className: activeNavClass }} inactiveProps={{ className: inactiveNavClass }}>
                Account
              </Link>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition hover:bg-brand/85"
            >
              Sign in
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
          className="rounded-md p-2 text-ink transition hover:bg-surface-muted md:hidden"
        >
          <span aria-hidden className="block h-0.5 w-5 bg-ink" />
          <span aria-hidden className="mt-1 block h-0.5 w-5 bg-ink" />
          <span aria-hidden className="mt-1 block h-0.5 w-5 bg-ink" />
        </button>
      </Container>

      {menuOpen && (
        <nav aria-label="Mobile" className="border-t border-line bg-surface md:hidden">
          <Container className="flex flex-col py-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm text-ink-soft transition hover:bg-surface-muted hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-1 border-t border-line pt-2">
              {session ? (
                <>
                  <Link
                    to="/purchases"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-ink-soft transition hover:bg-surface-muted hover:text-ink"
                  >
                    My purchases
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-ink-soft transition hover:bg-surface-muted hover:text-ink"
                  >
                    Account
                  </Link>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-muted"
                >
                  Sign in
                </Link>
              )}
            </div>
          </Container>
        </nav>
      )}
    </header>
  )
}

function StoreFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="max-w-xs">
          <p className="text-base font-semibold tracking-tight text-ink">liza-arch</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Floor plans and interior plans, drawn by architects and delivered instantly as
            downloadable files.
          </p>
        </div>
        <nav aria-label="Browse">
          <p className="text-sm font-medium text-ink">Browse</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>
              <Link to="/floor-plans" className="transition hover:text-ink">
                Floor plans
              </Link>
            </li>
            <li>
              <Link to="/interiors" className="transition hover:text-ink">
                Interior plans
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Studio">
          <p className="text-sm font-medium text-ink">Studio</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>
              <Link to="/about" className="transition hover:text-ink">
                About us
              </Link>
            </li>
            <li>
              <Link to="/contact" className="transition hover:text-ink">
                Contact
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="text-sm font-medium text-ink">Get in touch</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>
              <a href="mailto:hello@lizaarch.in" className="transition hover:text-ink">
                hello@lizaarch.in
              </a>
            </li>
            <li>+91 98765 43210</li>
            <li>Bengaluru, India</li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-line">
        <Container className="flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-ink-faint">
          <p>© {new Date().getFullYear()} liza-arch. All rights reserved.</p>
          <p>Digital delivery — instant download after purchase.</p>
        </Container>
      </div>
    </footer>
  )
}

export function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <StoreHeader />
      <main className="flex-1">{children}</main>
      <StoreFooter />
    </div>
  )
}
