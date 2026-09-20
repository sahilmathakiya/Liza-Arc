import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
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
    exposeHeaders: ["Set-Cookie", "Content-Disposition"],
    credentials: true,
  }),
);

app.get("/", (c) => c.json({ name: "api", status: "ok" }));

app.on(["GET", "POST"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

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
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  return c.json(session);
});

export default app;
