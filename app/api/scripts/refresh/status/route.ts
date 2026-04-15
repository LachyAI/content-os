import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const APIFY_TOKEN = process.env.APIFY_TOKEN || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function extractHook(text: string): string {
  if (!text) return "";
  const sentences = text.trim().split(/(?<=[.!?])\s+/);
  return sentences[0] || text.slice(0, 100);
}

function classifyHook(hook: string): string {
  const h = hook.toLowerCase();
  if (hook.includes("?")) return "question";
  if (["stop", "don't", "never", "wrong"].some((w) => h.includes(w))) return "contrarian";
  if (/how (i|to)|here's how/.test(h)) return "how-to";
  if (/\d+/.test(hook)) return "specificity";
  if (["if you", "for anyone", "this is for"].some((w) => h.includes(w))) return "identity";
  return "statement";
}

/**
 * GET /api/scripts/refresh/status?runId=xxx
 * Phase 2: Checks transcription run status. When done, stores results in Supabase.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");

  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const run = await res.json();
    const status = run.data.status as string;

    if (status === "RUNNING" || status === "READY") {
      return NextResponse.json({ status: "running" });
    }

    if (status !== "SUCCEEDED") {
      return NextResponse.json({ status: "failed", error: `Run ended with: ${status}` });
    }

    // Fetch transcription results
    const dsId = run.data.defaultDatasetId as string;
    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}`);
    const items = await itemsRes.json();

    if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL === "PLACEHOLDER_NEEDS_REAL_KEY") {
      return NextResponse.json({ status: "done", stored: 0, error: "Supabase not configured" });
    }

    // Store in Supabase
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    let stored = 0;

    for (const item of items) {
      const url = item.url || item.postUrl || "";
      const transcript = item.transcript || "";
      const caption = item.caption || item.text || "";
      const username = item.ownerUsername || item.username || "";
      const hook = extractHook(transcript || caption);
      const hookType = classifyHook(hook);

      const row = {
        username,
        post_url: url,
        caption,
        transcript,
        hook,
        hook_type: hookType,
        like_count: item.likesCount ?? 0,
        comment_count: item.commentsCount ?? 0,
        view_count: item.videoPlayCount ?? item.videoViewCount ?? 0,
        engagement_rate: 0,
        duration_seconds: Math.floor(Number(item.videoDuration || item.duration || 0)),
      };

      try {
        await sb.from("reel_scripts").upsert(row, { onConflict: "post_url" });
        stored++;
      } catch {
        // skip duplicates or errors
      }
    }

    const { count } = await sb.from("reel_scripts").select("*", { count: "exact", head: true });

    return NextResponse.json({
      status: "done",
      transcribed: items.filter((i: { transcript?: string }) => i.transcript).length,
      stored,
      totalInDb: count ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ status: "failed", error: String(err) }, { status: 500 });
  }
}
