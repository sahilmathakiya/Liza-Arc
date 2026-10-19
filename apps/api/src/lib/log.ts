import type { Context } from "hono";

export function requestId(c: Context): string {
  return c.req.header("cf-ray") ?? c.req.header("x-request-id") ?? "local";
}

function errorFields(error: unknown) {
  if (error instanceof Error) return { error: error.message, errorName: error.name, stack: error.stack };
  return { error: String(error) };
}

/** Structured JSON log line; Workers Logs indexes the fields for querying. */
export function logError(c: Context | null, message: string, error?: unknown, extra?: Record<string, unknown>) {
  console.error(
    JSON.stringify({
      level: "error",
      message,
      ...(c && { requestId: requestId(c), method: c.req.method, path: c.req.path }),
      ...(error !== undefined && errorFields(error)),
      ...extra,
    }),
  );
}

export function logWarn(c: Context | null, message: string, extra?: Record<string, unknown>) {
  console.warn(
    JSON.stringify({
      level: "warn",
      message,
      ...(c && { requestId: requestId(c), method: c.req.method, path: c.req.path }),
      ...extra,
    }),
  );
}

/**
 * Runs best-effort work (e.g. deleting superseded R2 objects) after the
 * response is sent. Failures are logged, never surfaced to the client.
 */
export function defer(c: Context, label: string, task: () => Promise<unknown>) {
  const promise = task().catch((error) => logError(c, `Deferred task failed: ${label}`, error));
  try {
    c.executionCtx.waitUntil(promise);
  } catch {
    // No ExecutionContext (e.g. unit tests): the promise still runs.
  }
}
