import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// audit.opscorescale.com serves the same app, but its root should land on the
// audit tool rather than the content dashboard. Rewrite, not redirect, so the
// URL stays clean. Every other path on the subdomain still resolves normally.
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("audit.") && request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/audit", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
