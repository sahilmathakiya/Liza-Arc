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

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Set-Cookie"],
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

app.route("/api/account", accountRouter);

app.get("/api/me", async (c) => {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  return c.json(session);
});

export default app;
