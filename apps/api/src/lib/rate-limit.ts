import type { Context } from "hono";

interface RateWindow {
  count: number;
  resetAt: number;
}

const MAX_TRACKED_KEYS = 100_000;

/**
 * Fixed-window limiter kept in module scope. Workers isolates restart
 * independently, so windows are per-isolate: bursts are caught reliably but
 * the global count is a lower bound, not an exact figure.
 */
const windows = new Map<string, RateWindow>();

function clientIp(c: Context) {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function sweep(now: number) {
  if (windows.size < MAX_TRACKED_KEYS) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export function rateLimit(
  c: Context,
  options: { scope: string; max: number; windowMs: number; key?: string },
): Response | null {
  const now = Date.now();
  sweep(now);

  const identity = options.key ?? clientIp(c);
  const mapKey = `${options.scope}:${identity}`;
  let window = windows.get(mapKey);
  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + options.windowMs };
    windows.set(mapKey, window);
  }

  window.count += 1;
  if (window.count <= options.max) return null;

  const retryAfter = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
  return c.json(
    { error: "Too many requests, please slow down and try again shortly" },
    429,
    { "retry-after": String(retryAfter) },
  );
}
