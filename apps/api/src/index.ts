import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { getAuth, getSession } from "./auth";
import { JSON_MAX_BYTES } from "./lib/body-limits";
import { logError, requestId } from "./lib/log";
import { rateLimit } from "./lib/rate-limit";
import { accountRouter } from "./routes/account";
import { adminRouter } from "./routes/admin";
import { adminCustomersRouter } from "./routes/admin/customers";
import { adminOrdersRouter } from "./routes/admin/orders";
import { adminProductsRouter } from "./routes/admin/products";
import { assetsRouter } from "./routes/assets";
import { checkoutRouter } from "./routes/checkout";
import { publicProductsRouter } from "./routes/products";
import { webhooksRouter } from "./routes/webhooks";

const app = new Hono<{ Bindings: Env }>();

function isAllowedOrigin(origin: string, webUrl: string): boolean {
  if (origin === "http://localhost:3000") return true;
  try {
    const webHost = new URL(webUrl).hostname;
    const originHost = new URL(origin).hostname;
    return originHost === webHost || originHost.endsWith(`.${webHost}`);
  } catch {
    return false;
  }
}

app.use(
  "*",
  cors({
    origin: (origin, c) => (isAllowedOrigin(origin, c.env.WEB_URL) ? origin : null),
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Set-Cookie", "Content-Disposition", "Retry-After"],
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const origin = c.req.header("origin");
    if (origin && !isAllowedOrigin(origin, c.env.WEB_URL)) {
      return c.json({ error: "Invalid origin" }, 403);
    }
  }
  return next();
});

app.use("/api/auth/*", bodyLimit({ maxSize: JSON_MAX_BYTES }));

// Password hashing is the most expensive thing the Worker does, and attackers
// use it for brute force: throttle per IP and per email. GET (session reads)
// is cheap, called on every page load, and left unthrottled. The body is read
// from a clone so the auth handler below still receives the original request.
app.use("/api/auth/*", async (c, next) => {
  if (c.req.method === "POST") {
    const limited = await rateLimit(c, "RL_AUTH");
    if (limited) return limited;

    try {
      const body = (await c.req.raw.clone().json()) as { email?: unknown } | null;
      const email = body && typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
      if (email) {
        const byEmail = await rateLimit(c, "RL_AUTH", `email:${email}`);
        if (byEmail) return byEmail;
      }
    } catch {
      // Not JSON (e.g. a future form-based auth flow): only the IP limit applies.
    }
  }
  return next();
});

app.get("/", (c) => c.json({ name: "api", status: "ok" }));

app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth(c).handler(c.req.raw));

app.route("/api/admin", adminRouter);

app.route("/api/admin/products", adminProductsRouter);

app.route("/api/admin/orders", adminOrdersRouter);

app.route("/api/admin/customers", adminCustomersRouter);

app.route("/api/products", publicProductsRouter);

app.route("/api/assets", assetsRouter);

app.route("/api/checkout", checkoutRouter);

app.route("/api/webhooks", webhooksRouter);

app.route("/api/account", accountRouter);

app.get("/api/me", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  return c.json(session);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

// Any unhandled throw lands here: always JSON, always logged with the cf-ray
// id so a user-reported error can be found in Workers Logs.
app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  const id = requestId(c);
  logError(c, "Unhandled error", error);
  return c.json({ error: "Something went wrong on our side. Please try again.", requestId: id }, 500);
});

export default app;
