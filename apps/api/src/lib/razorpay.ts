const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

interface RazorpayKeyEnv {
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
}

function authorizationHeader(env: RazorpayKeyEnv) {
  return `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`;
}

export async function createRazorpayOrder(
  env: RazorpayKeyEnv,
  input: { amountCents: number; currency: string; receipt: string; notes: Record<string, string> },
): Promise<RazorpayOrder | null> {
  try {
    const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader(env),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountCents,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as RazorpayOrder;
  } catch {
    return null;
  }
}

export async function getRazorpayOrder(
  env: RazorpayKeyEnv,
  razorpayOrderId: string,
): Promise<RazorpayOrder | null> {
  try {
    const res = await fetch(`${RAZORPAY_API_BASE}/orders/${encodeURIComponent(razorpayOrderId)}`, {
      headers: { Authorization: authorizationHeader(env) },
    });
    if (!res.ok) return null;
    return (await res.json()) as RazorpayOrder;
  } catch {
    return null;
  }
}

async function hmacSha256Hex(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPaymentSignature(
  keySecret: string,
  payload: { razorpayOrderId: string; razorpayPaymentId: string; signature: string },
) {
  const expected = await hmacSha256Hex(
    keySecret,
    `${payload.razorpayOrderId}|${payload.razorpayPaymentId}`,
  );
  return timingSafeEqual(expected, payload.signature);
}

export async function verifyWebhookSignature(
  webhookSecret: string,
  rawBody: string,
  signature: string,
) {
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  return timingSafeEqual(expected, signature);
}
