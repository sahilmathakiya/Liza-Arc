import type { Context } from "hono";
import { logWarn } from "./log";

/**
 * Rate limits are enforced with Cloudflare's Rate Limiting binding, so the
 * counters are shared by every isolate in a Cloudflare location (the old
 * module-scope Map only counted per isolate, so bursts spread over isolates
 * were never limited).
 *
 * The limit/period values below MUST mirror the [[ratelimits]] entries in
 * wrangler.toml. They are used for the Retry-After header and for the
 * in-memory fallback when a binding is unavailable (tests, misconfiguration).
 */
export const RATE_LIMITS = {
  RL_AUTH: { limit: 5, period: 60 },
  RL_ADMIN_SIGNUP: { limit: 5, period: 60 },
  RL_ADMIN_WRITE: { limit: 60, period: 60 },
  RL_UPLOAD: { limit: 30, period: 60 },
  RL_THUMB_USER: { limit: 10, period: 60 },
  RL_THUMB_PRODUCT: { limit: 2, period: 60 },
  RL_PUBLIC_ASSETS: { limit: 300, period: 60 },
  RL_DOWNLOAD: { limit: 10, period: 60 },
  RL_CHECKOUT: { limit: 10, period: 60 },
  RL_CHECKOUT_VERIFY: { limit: 20, period: 60 },
  RL_ACCOUNT: { limit: 10, period: 60 },
  RL_WEBHOOK: { limit: 600, period: 60 },
  RL_CATALOG: { limit: 120, period: 60 },
} as const satisfies Record<string, { limit: number; period: 10 | 60 }>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export function clientIp(c: Context) {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// ---- in-memory fallback (per isolate) -------------------------------------
const MAX_TRACKED_KEYS = 50_000;
const windows = new Map<string, { count: number; resetAt: number }>();

function fallbackAllow(name: RateLimitName, key: string): boolean {
  const now = Date.now();
  if (windows.size >= MAX_TRACKED_KEYS) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
    if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
  }
  const { limit, period } = RATE_LIMITS[name];
  const mapKey = `${name}:${key}`;
  let window = windows.get(mapKey);
  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + period * 1000 };
    windows.set(mapKey, window);
  }
  window.count += 1;
  return window.count <= limit;
}

async function allow(c: Context<{ Bindings: Env }>, name: RateLimitName, key: string): Promise<boolean> {
  const binding = c.env[name] as RateLimit | undefined;
  if (!binding) return fallbackAllow(name, key);
  try {
    const { success } = await binding.limit({ key });
    return success;
  } catch (error) {
    logWarn(c, "Rate limit binding failed; using in-memory fallback", {
      binding: name,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallbackAllow(name, key);
  }
}

export function tooManyRequests(c: Context, retryAfterSeconds: number): Response {
  return c.json(
    { error: "Too many requests, please slow down and try again shortly", retryAfter: retryAfterSeconds },
    429,
    { "retry-after": String(retryAfterSeconds) },
  );
}

/**
 * Returns a 429 response when the caller exceeded the named limit, else null.
 * `key` defaults to the client IP; pass a user/product id for scoped limits.
 */
export async function rateLimit(
  c: Context<any>,
  name: RateLimitName,
  key: string = clientIp(c),
): Promise<Response | null> {
  if (await allow(c, name, key)) return null;
  return tooManyRequests(c, RATE_LIMITS[name].period);
}
