import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { createAuth } from "../auth";
import { zodErrorMessage } from "../lib/zod";

export const accountRouter = new Hono<{ Bindings: Env }>();

const passwordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(100),
});

function errorMessage(error: unknown): { status: number; message: string } {
  const status =
    typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;
  const message =
    error instanceof Error && error.message ? error.message : "Failed to update password";
  return { status, message };
}

accountRouter.post("/password", async (c) => {
  const parsed = passwordSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);

  const auth = createAuth(c.env);
  try {
    const accounts = await auth.api.listUserAccounts({ headers: c.req.raw.headers });
    const hasPassword = accounts.some((account) => account.providerId === "credential");

    if (hasPassword) {
      if (!parsed.data.currentPassword) {
        return c.json({ error: "Current password is required" }, 400);
      }
      await auth.api.changePassword({
        headers: c.req.raw.headers,
        body: {
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.newPassword,
        },
      });
      return c.json({ ok: true });
    }

    await auth.api.setPassword({
      headers: c.req.raw.headers,
      body: { newPassword: parsed.data.newPassword },
    });
    return c.json({ ok: true });
  } catch (error) {
    const { status, message } = errorMessage(error);
    const safeStatus: ContentfulStatusCode =
      status >= 400 && status < 600 ? (status as ContentfulStatusCode) : 500;
    return c.json({ error: message }, safeStatus);
  }
});
