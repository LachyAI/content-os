/**
 * Scheduled competitor scraper
 * Run: npx tsx scripts/scheduled-scrape.ts
 *
 * Reads competitor handles, calls Apify to scrape their IG posts,
 * saves results to output/scrape-YYYY-MM-DD.json
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const IG_HANDLES = [
  "charlieautomates",
  "noevarner.ai",
  "nick_saraev",
  "itstylergermain",
  "simon.saysai",
  "nicholas.puru",
  "jens.heitmann",
  "tenfoldmarc",
];

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = "apify~instagram-profile-scraper";
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 60; // 5 min max

interface ApifyRunResponse {
  data: { id: string; status: string };
}

interface ApifyDatasetResponse {
  data: {
    items: RawPost[];
  };
}

interface RawPost {
  url?: string;
  shortCode?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  timestamp?: string;
  type?: string;
  ownerUsername?: string;
}

interface ScrapeOutput {
  scrapedAt: string;
  handles: string[];
  totalPosts: number;
  byHandle: Record<string, RawPost[]>;
}

async function startRun(): Promise<string> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: IG_HANDLES,
        resultsLimit: 30,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to start Apify run: ${res.status} — ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as ApifyRunResponse;
  return data.data.id;
}

async function pollForCompletion(runId: string): Promise<string> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );

    if (!res.ok) {
      throw new Error(`Failed to poll run status: ${res.status}`);
    }

    const data = (await res.json()) as ApifyRunResponse;
    const status = data.data.status;

    console.log(`  [${i + 1}/${POLL_MAX_ATTEMPTS}] Status: ${status}`);

    if (status === "SUCCEEDED") {
      return runId;
    }
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ended with status: ${status}`);
    }
  }

  throw new Error("Timed out waiting for Apify run to complete");
}

async function fetchResults(runId: string): Promise<RawPost[]> {
  const res = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=1000`
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch results: ${res.status}`);
  }

  const data = (await res.json()) as ApifyDatasetResponse;
  return data.data.items;
}

function groupByHandle(posts: RawPost[]): Record<string, RawPost[]> {
  const result: Record<string, RawPost[]> = {};
  for (const handle of IG_HANDLES) {
    result[handle] = [];
  }
  for (const post of posts) {
    const handle = post.ownerUsername;
    if (handle) {
      if (!result[handle]) result[handle] = [];
      result[handle].push(post);
    }
  }
  return result;
}

async function main() {
  if (!APIFY_TOKEN) {
    console.error("Error: APIFY_TOKEN environment variable is not set.");
    console.error("Set it with: export APIFY_TOKEN=your_token_here");
    process.exit(1);
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const outputDir = join(process.cwd(), "output");
  const outputPath = join(outputDir, `scrape-${dateStr}.json`);

  console.log(`Starting scrape for ${IG_HANDLES.length} handles: ${IG_HANDLES.join(", ")}`);
  console.log();

  console.log("Starting Apify run...");
  const runId = await startRun();
  console.log(`Run started: ${runId}`);
  console.log("Polling for completion...");

  await pollForCompletion(runId);
  console.log("Run completed. Fetching results...");

  const posts = await fetchResults(runId);
  console.log(`Fetched ${posts.length} posts`);

  const byHandle = groupByHandle(posts);

  const output: ScrapeOutput = {
    scrapedAt: now.toISOString(),
    handles: IG_HANDLES,
    totalPosts: posts.length,
    byHandle,
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log();
  console.log(`Saved to: ${outputPath}`);
  console.log();
  console.log("Summary:");
  for (const handle of IG_HANDLES) {
    const count = byHandle[handle]?.length ?? 0;
    console.log(`  @${handle}: ${count} posts`);
  }
  console.log(`  Total: ${posts.length} posts`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
