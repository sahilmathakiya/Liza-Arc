const DAY_IN_MS = 24 * 60 * 60 * 1000

export function isExpired(expiresAt: string | null): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() <= Date.now()
}

export function formatExpiryDate(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString('en-IN')
}

export function daysUntilExpiry(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_IN_MS))
}

/** Human-readable access window, e.g. "Access until 15 Mar 2027 · 180 days left". */
export function accessLabel(expiresAt: string | null): string {
  if (expiresAt === null) return 'Lifetime access'
  if (isExpired(expiresAt)) return `Expired ${formatExpiryDate(expiresAt)}`
  const days = daysUntilExpiry(expiresAt)
  return `Access until ${formatExpiryDate(expiresAt)} · ${days === 1 ? '1 day' : `${days} days`} left`
}
