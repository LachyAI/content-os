import type { NextRequest } from "next/server";

const ACTOR_ID = "streamers~youtube-scraper";

export async function POST(request: NextRequest) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return Response.json({ error: "APIFY_TOKEN not configured" }, { status: 500 });
  }

  let body: { channelUrls?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const channelUrls = body.channelUrls;
  if (!Array.isArray(channelUrls) || channelUrls.length === 0) {
    return Response.json({ error: "channelUrls array required" }, { status: 400 });
  }

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: channelUrls.map((url) => ({ url })),
        maxResultsShorts: 10,
        maxResultsStreams: 0,
        maxResults: 15,
      }),
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

  return Response.json({ runId });
}
