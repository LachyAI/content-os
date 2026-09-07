import type { NextRequest } from "next/server";

const ACTOR_ID = "compass~crawler-google-places";

// POST { queries: string[] } -> { runId }
// Starts the run and returns immediately. Polling lives in ./status, because a
// run-sync call across several businesses blows the function timeout.
export async function POST(request: NextRequest) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return Response.json({ error: "APIFY_TOKEN not configured" }, { status: 500 });
  }

  let body: { queries?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const queries = (body.queries ?? []).filter(Boolean);
  if (!queries.length) {
    return Response.json({ error: "queries array required" }, { status: 400 });
  }

  const startRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      searchStringsArray: queries,
      maxCrawledPlacesPerSearch: 1,
      language: "en",
      skipClosedPlaces: false,
    }),
  });

  if (!startRes.ok) {
    const detail = await startRes.text();
    return Response.json(
      { error: `Apify start failed: ${startRes.status}`, detail: detail.slice(0, 300) },
      { status: 502 }
    );
  }

  const data = await startRes.json();
  const runId = data.data?.id;
  if (!runId) {
    return Response.json({ error: "No runId returned" }, { status: 502 });
  }

  return Response.json({ runId });
}
