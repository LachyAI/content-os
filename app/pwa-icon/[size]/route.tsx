import type { NextRequest } from "next/server";
import { appIconResponse } from "@/lib/app-icon";

// The install icons the manifest points at: /pwa-icon/192 and /pwa-icon/512.
const SIZES = ["192", "512"];

export const dynamicParams = false;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await ctx.params;
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  return appIconResponse(Number(size), true);
}
