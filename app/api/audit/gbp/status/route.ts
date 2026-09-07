import type { NextRequest } from "next/server";
import type { Gbp } from "@/lib/audit-types";

interface Place {
  searchString?: string;
  title?: string;
  categoryName?: string;
  categories?: string[];
  claimThisBusiness?: boolean;
  totalScore?: number;
  reviewsCount?: number;
  imagesCount?: number;
  address?: string;
  website?: string;
  phone?: string;
  openingHours?: unknown[];
  ownerDescription?: string;
  description?: string;
}

function toGbp(p: Place, query: string): Gbp {
  const address = p.address || "";
  return {
    query,
    found: true,
    title: p.title || "",
    category: p.categoryName || "",
    categories: p.categories || [],
    claimed: p.claimThisBusiness ? "Unclaimed" : "Claimed",
    rating: p.totalScore || 0,
    reviews: p.reviewsCount || 0,
    photos: p.imagesCount || 0,
    address,
    // A service-area business hides its street address; Google returns city only.
    serviceArea: !/\d/.test(address),
    website: p.website || "",
    phone: p.phone || "",
    hoursSet: Array.isArray(p.openingHours) && p.openingHours.length > 0,
    // The actor leaves `description` null and puts the owner blurb in ownerDescription.
    descriptionLen: (p.ownerDescription || p.description || "").length,
    error: "",
  };
}

// GET /api/audit/gbp/status?runId=xxx&queries=a|b|c
export async function GET(request: NextRequest) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return Response.json({ error: "APIFY_TOKEN not configured" }, { status: 500 });
  }

  const runId = request.nextUrl.searchParams.get("runId");
  if (!runId) {
    return Response.json({ error: "runId required" }, { status: 400 });
  }
  const queries = (request.nextUrl.searchParams.get("queries") || "").split("|").filter(Boolean);

  const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
  if (!statusRes.ok) {
    return Response.json({ error: `Failed to check run: ${statusRes.status}` }, { status: 502 });
  }

  const statusData = await statusRes.json();
  const status: string = statusData.data?.status ?? "UNKNOWN";

  if (status !== "SUCCEEDED") {
    const running = status === "RUNNING" || status === "READY";
    return Response.json({ status, done: false, failed: !running });
  }

  const datasetId = statusData.data?.defaultDatasetId;
  if (!datasetId) {
    return Response.json({ error: "No dataset found", status }, { status: 502 });
  }

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true`
  );
  if (!itemsRes.ok) {
    return Response.json({ error: `Failed to fetch dataset: ${itemsRes.status}` }, { status: 502 });
  }
  const items: Place[] = await itemsRes.json();

  // Map results back onto the queries that produced them. The actor echoes
  // searchString; fall back to positional order when it does not.
  const byQuery: Record<string, Gbp> = {};
  for (const q of queries) {
    const match = items.find((it) => it.searchString === q);
    if (match) byQuery[q] = toGbp(match, q);
  }
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    if (byQuery[q]) continue;
    const fallback = items[i];
    byQuery[q] = fallback
      ? toGbp(fallback, q)
      : {
          query: q, found: false, title: "", category: "", categories: [], claimed: "",
          rating: 0, reviews: 0, photos: 0, address: "", serviceArea: false, website: "",
          phone: "", hoursSet: false, descriptionLen: 0, error: "no GBP match",
        };
  }

  return Response.json({ status, done: true, gbp: byQuery });
}
