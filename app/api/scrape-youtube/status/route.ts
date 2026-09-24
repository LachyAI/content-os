import type { NextRequest } from "next/server";

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
      return Response.json(
        { error: `Failed to fetch dataset: ${itemsRes.status}` },
        { status: 502 }
      );
    }

    const rawItems = (await itemsRes.json()) as Record<string, unknown>[];

    const videos = rawItems.map((item) => {
      let durationSeconds = 0;
      const rawDuration = item.duration ?? item.durationSeconds ?? item.lengthSeconds;
      if (typeof rawDuration === "number") {
        durationSeconds = rawDuration;
      } else if (typeof rawDuration === "string") {
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
        viewCount: (item.viewCount as number) ?? (item.views as number) ?? 0,
        likeCount: (item.likes as number) ?? (item.likeCount as number) ?? 0,
        commentCount: (item.commentCount as number) ?? (item.comments as number) ?? 0,
        publishedAt: (item.date as string) ?? (item.publishedAt as string) ?? (item.uploadDate as string) ?? "",
        duration: durationSeconds,
        thumbnailUrl:
          (item.thumbnailUrl as string) ??
          (item.thumbnail as string) ??
          (((item.thumbnails as unknown[]) ?? [])[0] as Record<string, unknown>)?.url ??
          "",
      };
    });

    return Response.json({ status: "SUCCEEDED", count: videos.length, videos });
  }

  if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
    return Response.json({ status, error: `Apify run ${status.toLowerCase()}` }, { status: 502 });
  }

  return Response.json({ status: "RUNNING" });
}
