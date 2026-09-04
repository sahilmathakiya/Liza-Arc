import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'dark' | 'outline'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-soft',
  dark: 'bg-brand text-brand-foreground',
  outline: 'border border-line-strong text-ink-soft',
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

export function statusTone(status: string): BadgeTone {
  if (status === 'PAID' || status === 'Published') return 'dark'
  if (status === 'FAILED') return 'outline'
  return 'neutral'
}
