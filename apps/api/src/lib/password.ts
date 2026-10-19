import { hexToBytes, bytesToHex } from "@noble/hashes/utils.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";

/**
 * Password hashing for better-auth.
 *
 * better-auth's default is pure-JS scrypt (N=16384, r=16), which needs
 * seconds of CPU and ~33-64MB of memory per hash. On the Workers Free plan
 * (10ms CPU) that makes sign-in fail under load, so passwords are hashed with
 * native WebCrypto PBKDF2 instead: single-digit milliseconds, tiny memory.
 *
 * 30k iterations is below standalone OWASP guidance for PBKDF2-SHA256, but
 * here brute force is primarily stopped by the auth rate limits (5 tries/min
 * per IP and per email). This only has to slow an attacker who stole the
 * database — and the 8+ character minimum still applies.
 *
 * Legacy scrypt hashes (bare "salt:key" format) keep verifying via the
 * original algorithm; they are only produced for pre-existing users and are
 * never rewritten (per project decision), so no account is locked out.
 */

const PBKDF2_ITERATIONS = 30_000;
const PBKDF2_PREFIX = "pbkdf2_sha256";
const KEY_BYTES = 32;

const SCRYPT_N = 16384;
const SCRYPT_R = 16;
const SCRYPT_P = 1;
const SCRYPT_DKLEN = 64;
const SCRYPT_MAXMEM = 128 * SCRYPT_N * SCRYPT_R * 2;

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function derivePbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(key)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length === 4 && parts[0] === PBKDF2_PREFIX) {
    const [, iterations, saltHex, keyHex] = parts;
    const parsedIterations = Number.isFinite(Number(iterations)) ? Number(iterations) : PBKDF2_ITERATIONS;
    const derived = await derivePbkdf2(password, hexToBytes(saltHex), parsedIterations);
    return constantTimeEqual(derived, hexToBytes(keyHex));
  }

  // Legacy better-auth scrypt format: "saltHex:keyHex" (dkLen 64)
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = await scryptAsync(password.normalize("NFKC"), salt, {
    N: SCRYPT_N,
    p: SCRYPT_P,
    r: SCRYPT_R,
    dkLen: SCRYPT_DKLEN,
    maxmem: SCRYPT_MAXMEM,
  });
  return constantTimeEqual(derived, hexToBytes(key));
}
