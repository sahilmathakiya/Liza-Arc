import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'dark' | 'outline'

const TONES: Record<BadgeTone, string> = {
  neutral: 'border border-line bg-surface-muted text-ink-soft',
  dark: 'border border-line bg-brand/10 text-brand',
  outline: 'border border-line text-ink-soft',
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
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${TONES[tone]}`}
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
