import type { ReactNode } from 'react'

interface AuthCardProps {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="w-full rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
      <div className="mt-6">{children}</div>
      <div className="mt-6 text-center text-sm text-neutral-500">{footer}</div>
    </div>
  )
}
