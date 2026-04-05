import { NextResponse } from "next/server";

interface Article {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  sourceKey: string;
}

const FEEDS: { key: string; label: string; url: string }[] = [
  {
    key: "googleai",
    label: "Google AI",
    url: "https://blog.google/technology/ai/rss/",
  },
  {
    key: "openai",
    label: "OpenAI",
    url: "https://openai.com/blog/rss.xml",
  },
  {
    key: "verge",
    label: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  },
  {
    key: "techcrunch",
    label: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    key: "hn",
    label: "Hacker News",
    url: "https://hnrss.org/newest?q=claude+OR+anthropic+OR+llm&count=10",
  },
  {
    key: "mit",
    label: "MIT Tech Review",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
  },
];

function extractText(xml: string, tag: string): string {
  // Handle CDATA and regular text
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const cdata = cdataRe.exec(xml);
  if (cdata) return cdata[1].trim();
  const plain = plainRe.exec(xml);
  if (plain) return plain[1].trim();
  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFeed(xml: string, sourceKey: string, sourceLabel: string): Article[] {
  const articles: Article[] = [];

  // Split on <item> or <entry> (Atom)
  const itemRe = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];

    const title = stripHtml(extractText(block, "title"));
    if (!title) continue;

    // link: try <link> or <link href="...">
    let link = extractText(block, "link");
    if (!link) {
      const hrefMatch = /href="([^"]+)"/.exec(block);
      if (hrefMatch) link = hrefMatch[1];
    }
    link = link.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();

    // date: pubDate or published or updated
    let pubDate =
      extractText(block, "pubDate") ||
      extractText(block, "published") ||
      extractText(block, "updated") ||
      "";

    // description: summary or content or description
    const rawDesc =
      extractText(block, "description") ||
      extractText(block, "summary") ||
      extractText(block, "content:encoded") ||
      "";

    const description = stripHtml(rawDesc).slice(0, 250);

    // Normalise date
    let parsedDate = "";
    try {
      parsedDate = new Date(pubDate).toISOString();
    } catch {
      parsedDate = new Date().toISOString();
    }

    if (title && link) {
      articles.push({
        title,
        link,
        pubDate: parsedDate,
        description,
        source: sourceLabel,
        sourceKey,
      });
    }
  }

  return articles;
}

const MAX_PER_SOURCE = 10;

async function fetchFeed(feed: { key: string; label: string; url: string }): Promise<{ articles: Article[]; error?: string }> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentOS/1.0)" },
      next: { revalidate: 1800 }, // cache 30 min
    });
    if (!res.ok) return { articles: [], error: `HTTP ${res.status}` };
    const xml = await res.text();
    const articles = parseFeed(xml, feed.key, feed.label).slice(0, MAX_PER_SOURCE);
    return { articles };
  } catch (err) {
    return { articles: [], error: String(err) };
  }
}

async function fetchAnthropicNews(): Promise<{ articles: Article[]; error?: string }> {
  // Anthropic has no RSS feed. Parse their sitemap for /news/ URLs with dates.
  try {
    const res = await fetch("https://www.anthropic.com/sitemap.xml", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentOS/1.0)" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return { articles: [], error: `Sitemap HTTP ${res.status}` };
    const xml = await res.text();

    // Extract /news/ URLs with lastmod dates
    const pattern = /<url>\s*<loc>(https:\/\/www\.anthropic\.com\/news\/[^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g;
    const entries: { url: string; date: string; slug: string }[] = [];
    let m: RegExpExecArray | null;

    while ((m = pattern.exec(xml)) !== null) {
      entries.push({ url: m[1], date: m[2], slug: m[1].split("/news/").pop() || "" });
    }

    // Sort by date descending, take top 10
    entries.sort((a, b) => b.date.localeCompare(a.date));
    const top = entries.slice(0, MAX_PER_SOURCE);

    const articles: Article[] = top.map((e) => ({
      title: e.slug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      link: e.url,
      pubDate: new Date(e.date).toISOString(),
      description: "",
      source: "Anthropic",
      sourceKey: "anthropic",
    }));

    if (articles.length > 0) return { articles };
    return { articles: [], error: "No /news/ URLs found in Anthropic sitemap" };
  } catch (err) {
    return { articles: [], error: `Sitemap fetch failed: ${String(err)}` };
  }
}

export async function GET() {
  const lastFetched = new Date().toISOString();

  const [anthropicResult, ...otherResults] = await Promise.allSettled([
    fetchAnthropicNews(),
    ...FEEDS.map(fetchFeed),
  ]);

  const allArticles: Article[] = [];
  const sourceErrors: Record<string, string> = {};

  // Anthropic
  if (anthropicResult.status === "fulfilled") {
    allArticles.push(...anthropicResult.value.articles);
    if (anthropicResult.value.error) sourceErrors["anthropic"] = anthropicResult.value.error;
  }

  // Other feeds
  for (let i = 0; i < otherResults.length; i++) {
    const result = otherResults[i];
    const feed = FEEDS[i];
    if (result.status === "fulfilled") {
      allArticles.push(...result.value.articles);
      if (result.value.error) sourceErrors[feed.key] = result.value.error;
    } else {
      sourceErrors[feed.key] = String(result.reason);
    }
  }

  // Sort by date descending
  allArticles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  const allSources = [
    { key: "anthropic", label: "Anthropic" },
    ...FEEDS.map((f) => ({ key: f.key, label: f.label })),
  ];

  return NextResponse.json({
    articles: allArticles,
    sources: allSources,
    lastFetched,
    sourceErrors: Object.keys(sourceErrors).length > 0 ? sourceErrors : undefined,
  });
}
