import { createHmac, timingSafeEqual } from "node:crypto";

// The PIN and the signing secret live only in server env (Vercel), never in page code.
// The cookie value is an HMAC of a fixed label, so rotating CONTENT_OS_SESSION_SECRET
// signs every device out at once.

export const SESSION_COOKIE = "cos_session";
// Chrome caps cookie lifetime at 400 days.
export const SESSION_MAX_AGE = 400 * 24 * 60 * 60;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function sessionToken(): string | null {
  const secret = process.env.CONTENT_OS_SESSION_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update("content-os-session-v1").digest("base64url");
}

export function isValidSession(value: string | undefined): boolean {
  const expected = sessionToken();
  return Boolean(value && expected && safeEqual(value, expected));
}

export function isCorrectPin(pin: string): boolean {
  const correct = process.env.CONTENT_OS_PIN;
  return Boolean(correct && safeEqual(pin, correct));
}
