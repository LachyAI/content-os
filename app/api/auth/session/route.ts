import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";

export function GET(req: NextRequest) {
  const ok = isValidSession(req.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ ok }, { status: ok ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
