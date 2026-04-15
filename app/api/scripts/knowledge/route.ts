import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/scripts/knowledge
 * Returns top transcribed reel scripts from Supabase for use in the generator prompt.
 * Query params:
 *   limit (default 20) — how many scripts to return
 *   min_engagement (default 100) — minimum likes+comments
 */
export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url === "PLACEHOLDER_NEEDS_REAL_KEY") {
    return NextResponse.json({ scripts: [], source: "none" });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const minEngagement = parseInt(searchParams.get("min_engagement") || "100", 10);

  try {
    const sb = createClient(url, key);
    const { data, error } = await sb
      .from("reel_scripts")
      .select("username, caption, transcript, hook, hook_type, like_count, comment_count, view_count")
      .or(`like_count.gte.${minEngagement},comment_count.gte.${Math.floor(minEngagement / 10)}`)
      .not("transcript", "is", null)
      .not("transcript", "eq", "")
      .order("like_count", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Supabase error:", error.message);
      return NextResponse.json({ scripts: [], source: "error", error: error.message });
    }

    return NextResponse.json({ scripts: data || [], source: "supabase" });
  } catch (err) {
    console.error("Failed to fetch knowledge scripts:", err);
    return NextResponse.json({ scripts: [], source: "error" });
  }
}
