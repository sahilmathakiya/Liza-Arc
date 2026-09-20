import type { ReactNode } from 'react'

interface AuthCardProps {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="relative w-full rounded-[8px] border border-line bg-surface p-8 shadow-card">
      <div className="mb-8 flex items-center gap-2 text-xs font-black uppercase tracking-[1.4px] text-brand"><span className="h-2 w-2 bg-brand" aria-hidden /> liza-arch</div>
      <h1 className="text-3xl font-black tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>
      <div className="mt-6">{children}</div>
      <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>
    </div>
  )
}
