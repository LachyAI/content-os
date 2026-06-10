import type { NextRequest } from "next/server";

export const maxDuration = 300;

const ACTOR_ID = "streamers~youtube-scraper";
const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = 240_000;

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

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`
  );
  if (!itemsRes.ok) {
    return Response.json(
      { error: `Failed to fetch dataset: ${itemsRes.status}` },
      { status: 502 }
    );
  }

  const rawItems = await itemsRes.json() as Record<string, unknown>[];

  // Normalise actor output to YouTubeVideo shape
  const videos = rawItems.map((item) => {
    // Duration may come as ISO 8601 (PT4M13S) or raw seconds
    let durationSeconds = 0;
    const rawDuration = item.duration ?? item.durationSeconds ?? item.lengthSeconds;
    if (typeof rawDuration === "number") {
      durationSeconds = rawDuration;
    } else if (typeof rawDuration === "string") {
      // Parse ISO 8601 duration: PT1H2M3S
      const match = rawDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        durationSeconds =
          (parseInt(match[1] ?? "0") * 3600) +
          (parseInt(match[2] ?? "0") * 60) +
          parseInt(match[3] ?? "0");
      }
    }

    const channelId =
      (item.channelId as string) ??
      (item.channel as Record<string, unknown>)?.id ??
      "";
    const channelName =
      (item.channelName as string) ??
      (item.author as string) ??
      (item.channel as Record<string, unknown>)?.name ??
      "";

    return {
      channelId: channelId as string,
      channelName: channelName as string,
      title: (item.title as string) ?? "",
      url: (item.url as string) ?? (item.videoUrl as string) ?? "",
      viewCount: ((item.viewCount as number) ?? (item.views as number) ?? 0),
      likeCount: ((item.likes as number) ?? (item.likeCount as number) ?? 0),
      commentCount: ((item.commentCount as number) ?? (item.comments as number) ?? 0),
      publishedAt: (item.date as string) ?? (item.publishedAt as string) ?? (item.uploadDate as string) ?? "",
      duration: durationSeconds,
      thumbnailUrl:
        (item.thumbnailUrl as string) ??
        (item.thumbnail as string) ??
        (((item.thumbnails as unknown[]) ?? [])[0] as Record<string, unknown>)?.url ??
        "",
    };
  });

  return Response.json({ count: videos.length, videos });
}
