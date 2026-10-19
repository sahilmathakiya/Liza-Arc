export const API_URL = import.meta.env.VITE_API_URL

export class ApiError extends Error {
  readonly status: number
  readonly retryAfter: number | null

  constructor(message: string, status: number, retryAfter: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface RetryOptions {
  /** Longest Retry-After (seconds) worth waiting for; 0 disables retrying. */
  maxRateLimitWait?: number
  /** Max number of 429 retries. */
  maxRetries?: number
  /** Called before waiting, e.g. to show "retrying in Ns". */
  onRateLimited?: (seconds: number) => void
}

function retryAfterSeconds(res: Response): number | null {
  const value = Number(res.headers.get('retry-after'))
  return Number.isFinite(value) && value > 0 ? value : null
}

/**
 * JSON fetch against the API. A 429 means the server did not process the
 * request, so it is always safe to wait for Retry-After and try again; callers
 * opt in via `retry` (used for uploads/regeneration bursts).
 */
export async function apiFetch<T>(path: string, init?: RequestInit, retry: RetryOptions = {}): Promise<T> {
  const { maxRateLimitWait = 0, maxRetries = 2, onRateLimited } = retry
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
    if (res.ok) return data as T

    const retryAfter = res.status === 429 ? (retryAfterSeconds(res) ?? 10) : null
    if (retryAfter !== null && attempt < maxRetries && retryAfter <= maxRateLimitWait) {
      onRateLimited?.(retryAfter)
      await sleep(retryAfter * 1000 + Math.random() * 1000)
      continue
    }
    throw new ApiError(data?.error ?? `Request failed with status ${res.status}`, res.status, retryAfter)
  }
}
