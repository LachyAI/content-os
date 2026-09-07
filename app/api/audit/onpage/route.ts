import type { NextRequest } from "next/server";
import * as cheerio from "cheerio";
import type { Keywords, OnPage } from "@/lib/audit-types";

export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

// Text below this word count on a page that ships app-root markup means the
// HTML a crawler receives is effectively empty — usually the whole wedge.
const CSR_WORD_FLOOR = 120;

const LOCAL_SCHEMA = new Set([
  "localbusiness", "professionalservice", "homeandconstructionbusiness", "electrician",
  "plumber", "hvacbusiness", "roofingcontractor", "generalcontractor", "service",
  "locksmith", "movingcompany", "painter", "cleaningservice",
]);

const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();
const has = (hay: string, needle: string) =>
  Boolean(needle) && (hay || "").toLowerCase().includes(needle.toLowerCase());
const verdict = (hit: boolean, term: string) =>
  hit ? `Yes ("${term}")` : `No ("${term}" missing)`;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function density(text: string, phrase: string, totalWords: number): number {
  if (!phrase || totalWords <= 0) return 0;
  const hits = (text.toLowerCase().match(new RegExp(escapeRe(phrase.toLowerCase()), "g")) || []).length;
  const phraseWords = Math.max(1, phrase.split(/\s+/).length);
  return Math.round((hits * phraseWords / totalWords) * 10000) / 100;
}

function detectCms(html: string, poweredBy: string): string {
  const h = html.toLowerCase();
  const checks: [boolean, string][] = [
    [h.includes("wp-content") || h.includes("wp-includes"), "WordPress"],
    [h.includes("cdn.shopify.com") || poweredBy.includes("shopify"), "Shopify"],
    [h.includes("wix.com") || h.includes("wixstatic"), "Wix"],
    [h.includes("squarespace"), "Squarespace"],
    [h.includes("webflow"), "Webflow"],
    [h.includes("__next_data__") || h.includes("/_next/static"), "Next.js"],
    [h.includes("___gatsby"), "Gatsby"],
    [h.includes("dudamobile") || h.includes("duda"), "Duda"],
    [h.includes("hubspot"), "HubSpot CMS"],
    [h.includes("gohighlevel") || h.includes("msgsndr"), "GoHighLevel"],
  ];
  for (const [hit, name] of checks) if (hit) return name;
  const gen = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i);
  return gen ? norm(gen[1]).slice(0, 40) : "Unknown / custom";
}

function schemaTypes($: cheerio.CheerioAPI): string[] {
  const types: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text() || "";
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      types.push(...[...raw.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1]));
      return;
    }
    const stack: unknown[] = [data];
    while (stack.length) {
      const node = stack.pop();
      if (Array.isArray(node)) stack.push(...node);
      else if (node && typeof node === "object") {
        const rec = node as Record<string, unknown>;
        const t = rec["@type"];
        if (typeof t === "string") types.push(t);
        else if (Array.isArray(t)) types.push(...t.filter((x): x is string => typeof x === "string"));
        stack.push(...Object.values(rec).filter((v) => v && typeof v === "object"));
      }
    }
  });
  return [...new Set(types)];
}

async function countSitemap(baseUrl: string): Promise<number> {
  const origin = new URL(baseUrl).origin;
  const candidates: string[] = [];
  try {
    const robots = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": UA } });
    if (robots.ok) {
      const txt = await robots.text();
      candidates.push(...[...txt.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]));
    }
  } catch {
    // robots is optional
  }
  candidates.push(`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`);

  for (const sm of [...new Set(candidates)]) {
    try {
      const r = await fetch(sm, { headers: { "User-Agent": UA } });
      if (!r.ok) continue;
      const xml = await r.text();
      if (!xml.includes("<")) continue;
      const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1]);
      if (xml.toLowerCase().includes("<sitemapindex")) {
        let total = 0;
        for (const child of locs.slice(0, 10)) {
          try {
            const cr = await fetch(child, { headers: { "User-Agent": UA } });
            if (cr.ok) total += ((await cr.text()).match(/<loc>/gi) || []).length;
          } catch {
            // one broken child sitemap should not void the count
          }
        }
        return total || locs.length;
      }
      return locs.length;
    } catch {
      continue;
    }
  }
  return 0;
}

async function auditOne(url: string, kw: Keywords): Promise<OnPage> {
  const base: OnPage = {
    url, finalUrl: "", status: 0, metaTitle: "", titleLen: 0, keywordInTitle: "",
    h1: "", keywordInH1: "", h2Count: 0, keywordInH2s: "", wordCount: 0,
    keywordInContent: "", densityPrimary: 0, densityGeo: 0, densitySecondary: 0,
    metaDescription: "", metaDescLen: 0, rendering: "", schemaTypes: [],
    hasLocalBusinessSchema: false, sitemapUrls: -1, clickToCall: false,
    viewport: false, cms: "", error: "",
  };

  let res: Response;
  let html: string;
  try {
    res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    html = await res.text();
  } catch (e) {
    return { ...base, error: `unreachable: ${e instanceof Error ? e.message.slice(0, 60) : "fetch failed"}` };
  }

  base.status = res.status;
  base.finalUrl = res.url || url;

  const $ = cheerio.load(html);
  const $text = cheerio.load(html);
  $text("script, style, noscript, svg").remove();
  const text = norm($text.root().text());
  const words = (text.match(/[A-Za-z']{2,}/g) || []).length;
  base.wordCount = words;

  const { primary, geo, secondary } = kw;

  base.metaTitle = norm($("title").first().text());
  base.titleLen = base.metaTitle.length;
  base.keywordInTitle = verdict(has(base.metaTitle, primary), primary);

  base.h1 = norm($("h1").first().text());
  base.keywordInH1 = verdict(has(base.h1, primary), primary);

  const h2s = $("h2").map((_, el) => norm($(el).text())).get();
  base.h2Count = h2s.length;
  base.keywordInH2s = `${h2s.filter((h) => has(h, primary)).length} of ${h2s.length} H2s`;

  const contentHits = primary
    ? (text.toLowerCase().match(new RegExp(escapeRe(primary.toLowerCase()), "g")) || []).length
    : 0;
  base.keywordInContent = contentHits ? `Yes (${contentHits}x)` : "No";
  base.densityPrimary = density(text, primary, words);
  base.densityGeo = density(text, geo, words);
  base.densitySecondary =
    Math.round(secondary.reduce((sum, s) => sum + density(text, s, words), 0) * 100) / 100;

  base.metaDescription = norm($('meta[name="description"]').attr("content") || "");
  base.metaDescLen = base.metaDescription.length;

  const appRoot = $("#root, #app, #__next, [data-reactroot], [ng-app], [data-server-rendered]").length > 0;
  const heavyJs = (html.match(/<script/gi) || []).length >= 5;
  base.rendering =
    words < CSR_WORD_FLOOR && (appRoot || heavyJs)
      ? `Client-side (${words} words served)`
      : words < CSR_WORD_FLOOR
        ? `Thin (${words} words served)`
        : `Server-rendered (${words} words served)`;

  base.schemaTypes = schemaTypes($);
  base.hasLocalBusinessSchema = base.schemaTypes.some((t) => LOCAL_SCHEMA.has(t.toLowerCase()));
  base.clickToCall = $('a[href^="tel:"]').length > 0;
  base.viewport = $('meta[name="viewport"]').length > 0;
  base.cms = detectCms(html, (res.headers.get("x-powered-by") || "").toLowerCase());
  base.sitemapUrls = await countSitemap(base.finalUrl);

  return base;
}

// POST { businesses: [{id, url}], keywords } -> { onpage: { [id]: OnPage } }
export async function POST(request: NextRequest) {
  let body: { businesses?: { id: string; url: string }[]; keywords?: Keywords };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const businesses = body.businesses ?? [];
  const keywords = body.keywords ?? { primary: "", geo: "", secondary: [] };
  if (!businesses.length) {
    return Response.json({ error: "businesses array required" }, { status: 400 });
  }

  const results = await Promise.all(
    businesses.map(async (b) => [b.id, await auditOne(b.url, keywords)] as const)
  );

  return Response.json({ onpage: Object.fromEntries(results) });
}
