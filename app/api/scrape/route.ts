import type { NextRequest } from "next/server";

export const maxDuration = 120; // seconds — allows 2-min polling window on Vercel Pro+

const ACTOR_ID =
  "scraping_solutions~instagram-profile-posts-scraper-no-cookies";
const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 110_000; // slightly under maxDuration to return a clean error

export async function POST(request: NextRequest) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return Response.json({ error: "APIFY_TOKEN not configured" }, { status: 500 });
  }

  let body: { usernames?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const usernames = body.usernames;
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return Response.json({ error: "usernames array required" }, { status: 400 });
  }

  // Start the actor run
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Usernames: usernames, resultsLimit: 20 }),
    }
  );

  if (!startRes.ok) {
    const text = await startRes.text();
    return Response.json(
      { error: `Apify start failed: ${startRes.status}`, detail: text },
      { status: 502 }
    );
  }

  const startData = await startRes.json();
  const runId: string = startData.data?.id;
  if (!runId) {
    return Response.json({ error: "No runId in Apify response" }, { status: 502 });
  }

  // Poll until SUCCEEDED or FAILED
  const deadline = Date.now() + TIMEOUT_MS;
  let datasetId: string | null = null;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
    );
    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const status: string = statusData.data?.status;

    if (status === "SUCCEEDED") {
      datasetId = statusData.data?.defaultDatasetId ?? null;
      break;
    }
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      return Response.json(
        { error: `Apify run ${status.toLowerCase()}`, runId },
        { status: 502 }
      );
    }
  }

  if (!datasetId) {
    return Response.json(
      { error: "Timed out waiting for Apify run", runId },
      { status: 504 }
    );
  }

  // Fetch dataset items
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`
  );
  if (!itemsRes.ok) {
    return Response.json(
      { error: `Failed to fetch dataset: ${itemsRes.status}` },
      { status: 502 }
    );
  }

  const items = await itemsRes.json();
  return Response.json({ count: items.length, posts: items });
}
