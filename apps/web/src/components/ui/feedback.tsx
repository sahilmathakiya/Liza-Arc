import type { ReactNode } from 'react'

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-ink-soft">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-active" />
      {label}…
    </span>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-[4px] bg-surface-muted ${className}`} />
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-[8px] border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {message && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-ink">
      {message}
    </p>
  )
}
