import type { NextRequest } from "next/server";

// GET /api/scrape/status?runId=xxx — check Apify run status, return posts when done
export async function GET(request: NextRequest) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return Response.json({ error: "APIFY_TOKEN not configured" }, { status: 500 });
  }

  const runId = request.nextUrl.searchParams.get("runId");
  if (!runId) {
    return Response.json({ error: "runId required" }, { status: 400 });
  }

  const statusRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
  );
  if (!statusRes.ok) {
    return Response.json({ error: `Failed to check run: ${statusRes.status}` }, { status: 502 });
  }

  const statusData = await statusRes.json();
  const status: string = statusData.data?.status ?? "UNKNOWN";

  if (status === "SUCCEEDED") {
    const datasetId = statusData.data?.defaultDatasetId;
    if (!datasetId) {
      return Response.json({ error: "No dataset found", status }, { status: 502 });
    }

    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`
    );
    if (!itemsRes.ok) {
      return Response.json({ error: `Failed to fetch dataset: ${itemsRes.status}` }, { status: 502 });
    }

    const items = await itemsRes.json();
    // Debug: log first item keys and media-related fields
    if (Array.isArray(items) && items.length > 0) {
      const sample = items[0];
      console.log("[scrape-status] Item keys:", Object.keys(sample));
      console.log("[scrape-status] Media fields:", {
        media_name: sample.media_name,
        type: sample.type,
        productType: sample.productType,
        mediaType: sample.mediaType,
        videoUrl: sample.videoUrl ? "present" : "absent",
        isVideo: sample.isVideo,
        __typename: sample.__typename,
      });
    }
    return Response.json({ status: "SUCCEEDED", count: items.length, posts: items });
  }

  if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
    return Response.json({ status, error: `Apify run ${status.toLowerCase()}` }, { status: 502 });
  }

  // Still running
  return Response.json({ status: "RUNNING" });
}
