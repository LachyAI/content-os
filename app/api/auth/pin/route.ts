import { NextResponse, type NextRequest } from "next/server";
import { isCorrectPin, sessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

// Per-instance only: it slows a brute force from one address, it does not stop one
// spread across many. The 6-digit PIN plus the delay is the real cost.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function recentFailures(ip: string): number[] {
  const now = Date.now();
  const list = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(ip, list);
  return list;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (recentFailures(ip).length >= MAX_FAILURES) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  let pin = "";
  try {
    const body = await req.json();
    pin = typeof body?.pin === "string" ? body.pin : "";
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const token = sessionToken();
  if (!token) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  if (!isCorrectPin(pin)) {
    recentFailures(ip).push(Date.now());
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ error: "wrong_pin" }, { status: 401 });
  }

  failures.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
