import type { ReactNode } from 'react'

interface AuthCardProps {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="w-full rounded-lg border border-line bg-surface p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{description}</p>
      <div className="mt-6">{children}</div>
      <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>
    </div>
  )
}
