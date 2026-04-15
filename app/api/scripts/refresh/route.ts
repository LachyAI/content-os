import { NextResponse } from "next/server";

const APIFY_TOKEN = process.env.APIFY_TOKEN || "";
const SCRAPE_ACTOR = "scraping_solutions~instagram-profile-posts-scraper-no-cookies";
const TRANSCRIPT_ACTOR = "apify~instagram-reel-scraper";

const COMPETITORS = [
  "charlieautomates",
  "noevarner.ai",
  "nick_saraev",
  "itstylergermain",
  "simon.saysai",
  "nicholas.puru",
  "jens.heitmann",
  "tenfoldmarc",
];

export const maxDuration = 300;

interface ApifyItem {
  link_post?: string;
  link_user?: string;
  url?: string;
  postUrl?: string;
  text?: string;
  caption?: string;
  like_count?: number;
  likesCount?: number;
  comment_count?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  media_name?: string;
  type?: string;
  productType?: string;
  videoUrl?: string;
  isVideo?: boolean;
  username?: string;
  ownerUsername?: string;
}

async function apifyRun(actor: string, input: Record<string, unknown>): Promise<string> {
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/runs?token=${APIFY_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Apify start failed: ${res.status}`);
  const data = await res.json();
  return data.data.id as string;
}

async function apifyWait(runId: string, maxWait = 240): Promise<ApifyItem[]> {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxWait) {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const run = await res.json();
    const status = run.data.status as string;
    if (status === "SUCCEEDED") {
      const dsId = run.data.defaultDatasetId as string;
      const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}`);
      return (await itemsRes.json()) as ApifyItem[];
    }
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      throw new Error(`Apify run ${status}`);
    }
    await new Promise((r) => setTimeout(r, 8_000));
  }
  throw new Error("Apify run timeout");
}

/**
 * POST /api/scripts/refresh
 * Phase 1: Scrapes competitors, filters top 20%, kicks off transcription.
 * Returns { transcribeRunId, topCount, reelsScraped } for client to poll phase 2.
 */
export async function POST() {
  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_TOKEN not configured" }, { status: 503 });
  }

  try {
    // Scrape competitors
    const scrapeRunId = await apifyRun(SCRAPE_ACTOR, {
      Usernames: COMPETITORS,
      resultsLimit: 20,
    });
    const allItems = await apifyWait(scrapeRunId, 240);

    // Filter to reels
    const reels = allItems
      .filter((item) => {
        const media = item.media_name || item.type || item.productType || "";
        if (["reel", "reels", "clips"].includes(media)) return true;
        return !!(item.videoUrl || item.isVideo);
      })
      .map((item) => {
        const likes = item.like_count ?? item.likesCount ?? 0;
        const comments = item.comment_count ?? item.commentsCount ?? 0;
        const url = item.link_post || item.url || item.postUrl || "";
        let username = item.username || item.ownerUsername || "";
        if (!username && item.link_user) {
          username = item.link_user.replace(/\/$/, "").split("/").pop() || "";
        }
        return { username, post_url: url, engagement: likes + comments };
      });

    // Top 20%
    const sorted = [...reels].sort((a, b) => b.engagement - a.engagement);
    const cutoff = Math.max(1, Math.floor(sorted.length * 0.2));
    const topReels = sorted.slice(0, Math.min(cutoff, 30));
    const urls = topReels.map((r) => r.post_url).filter(Boolean);

    if (urls.length === 0) {
      return NextResponse.json({ error: "No reel URLs found", reelsScraped: reels.length });
    }

    // Kick off transcription (don't wait — client polls phase 2)
    const transcribeRunId = await apifyRun(TRANSCRIPT_ACTOR, {
      username: urls,
      includeTranscript: true,
    });

    return NextResponse.json({
      phase: 1,
      reelsScraped: reels.length,
      topCount: topReels.length,
      transcribeRunId,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
