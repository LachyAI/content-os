'use client'

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { CompetitorSummary, Post, RawPost } from "@/lib/competitor-data";
import { getAllPosts, getCompetitors } from "@/lib/competitor-data";
import type { YouTubeVideo, YouTubeChannelSummary } from "@/lib/youtube-competitor-data";
import { DEFAULT_YT_CHANNELS, buildYouTubeSummaries } from "@/lib/youtube-competitor-data";
import { ArrowUpDown, Bookmark, ExternalLink, Loader2, PlusCircle, RefreshCw, Trash2, Zap } from "lucide-react";
import { usePinnedPosts } from "@/lib/use-pinned-posts";

// ─── IG Persistence Keys ──────────────────────────────────────────────────────

const IG_SCRAPED_KEY = "ig-scraped-data";
const IG_HANDLES_KEY = "ig-competitor-handles";

interface ScrapedEntry {
  username: string;
  scrapedAt: string; // ISO date
  posts: Post[];
}

function loadScrapedData(): ScrapedEntry[] {
  try {
    const raw = localStorage.getItem(IG_SCRAPED_KEY);
    return raw ? (JSON.parse(raw) as ScrapedEntry[]) : [];
  } catch {
    return [];
  }
}

function saveScrapedData(entries: ScrapedEntry[]) {
  try {
    localStorage.setItem(IG_SCRAPED_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota errors
  }
}

function loadStoredHandles(): string[] | null {
  try {
    const raw = localStorage.getItem(IG_HANDLES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function saveStoredHandles(handles: string[]) {
  try {
    localStorage.setItem(IG_HANDLES_KEY, JSON.stringify(handles));
  } catch {
    // ignore
  }
}

function extractUsernameFromLink(linkUser: string): string {
  const match = linkUser.match(/instagram\.com\/([^/?]+)/);
  return match ? match[1] : linkUser;
}

function extractHookFromText(text: string): string {
  const firstLine = text.split("\n")[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
}

// Merge static competitor summaries with any scraped-and-persisted data.
// Scraped entries take precedence for that username's posts.
function buildMergedCompetitors(
  staticCompetitors: CompetitorSummary[],
  scrapedEntries: ScrapedEntry[]
): { competitors: CompetitorSummary[]; scrapedMap: Map<string, string> } {
  const scrapedMap = new Map<string, string>(); // username -> scrapedAt ISO
  const byUser = new Map<string, Post[]>();

  // Start with static data
  for (const comp of staticCompetitors) {
    byUser.set(comp.username, comp.posts);
  }

  // Overlay scraped data (replace static posts for that user)
  for (const entry of scrapedEntries) {
    byUser.set(entry.username, entry.posts);
    scrapedMap.set(entry.username, entry.scrapedAt);
  }

  const result: CompetitorSummary[] = Array.from(byUser.entries()).map(([username, posts]) => {
    const avgLikes = posts.length > 0
      ? Math.round(posts.reduce((s, p) => s + p.like_count, 0) / posts.length)
      : 0;
    const avgComments = posts.length > 0
      ? Math.round(posts.reduce((s, p) => s + p.comment_count, 0) / posts.length)
      : 0;
    const formatCounts = { reel: 0, album: 0, post: 0 };
    for (const p of posts) {
      const fmt = p.media_name;
      if (fmt in formatCounts) formatCounts[fmt]++;
    }
    const topFormat = (Object.entries(formatCounts) as [Post["media_name"], number][])
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "post";
    const sortedPosts = [...posts].sort(
      (a, b) => new Date(b.taken_at_date).getTime() - new Date(a.taken_at_date).getTime()
    );
    return { username, postCount: posts.length, avgLikes, avgComments, topFormat, posts: sortedPosts };
  });

  return { competitors: result, scrapedMap };
}

// Convert raw API scrape response posts to our Post type.
// Defensive: Apify actors return inconsistent field names and sometimes
// null/missing engagement counts (e.g. accounts that hide likes — banks,
// businesses). Normalize everything here so the render layer never crashes.
function rawToPost(raw: RawPost): Post {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as any;

  // link_user / ownerUsername / username fallbacks
  const linkUser: string =
    r.link_user ||
    (r.ownerUsername ? `https://www.instagram.com/${r.ownerUsername}` : "") ||
    (r.username ? `https://www.instagram.com/${r.username}` : "") ||
    "";
  const username = extractUsernameFromLink(linkUser) || r.ownerUsername || r.username || "unknown";

  // Caption / text
  const text: string = r.text ?? r.caption ?? "";

  // Engagement counts (Apify uses likesCount/commentsCount; static uses like_count/comment_count)
  const likeCount: number = Number(r.like_count ?? r.likesCount ?? r.likes ?? 0) || 0;
  const commentCount: number = Number(r.comment_count ?? r.commentsCount ?? r.comments ?? 0) || 0;

  // media_name / type → reel | album | post
  const rawType: string = String(r.media_name ?? r.type ?? r.productType ?? "post").toLowerCase();
  let mediaName: "reel" | "album" | "post" = "post";
  if (rawType.includes("reel") || rawType === "video" || rawType === "clips") mediaName = "reel";
  else if (rawType.includes("sidecar") || rawType.includes("album") || rawType.includes("carousel")) mediaName = "album";
  else if (rawType.includes("image") || rawType.includes("photo") || rawType === "post") mediaName = "post";

  // Date — fallback to epoch so sorts don't NaN
  const takenAt: string =
    r.taken_at_date ??
    r.timestamp ??
    r.takenAt ??
    new Date(0).toISOString();

  // Shortcode + URL
  const sc: string | undefined = r.shortCode ?? r.shortcode ?? r.short_code ?? r.code ?? undefined;
  const directUrl: string | undefined = r.url;
  const postUrl = sc
    ? `https://www.instagram.com/p/${sc}/`
    : (directUrl && typeof directUrl === "string" && directUrl.includes("/p/"))
      ? directUrl
      : undefined;

  return {
    link_user: linkUser,
    text,
    like_count: likeCount,
    comment_count: commentCount,
    media_name: mediaName,
    taken_at_date: takenAt,
    username,
    hook: extractHookFromText(text),
    shortCode: typeof sc === "string" ? sc : undefined,
    postUrl,
  };
}

// Heal a Post that was persisted to localStorage before normalization existed.
// Same logic as rawToPost but operates on the stored Post shape.
function healPost(p: Post): Post {
  return rawToPost(p as unknown as RawPost);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = "taken_at_date" | "like_count" | "comment_count" | "engagement";
type SortDir = "asc" | "desc";
type FormatFilter = "all" | "reel" | "album" | "post";
type DateRange = "7" | "30" | "all";

// ─── Constants ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","can","shall",
  "to","of","in","for","on","with","at","by","from","as","into","through",
  "during","before","after","above","below","between","out","off","over","under",
  "again","further","then","once","here","there","when","where","why","how",
  "all","each","every","both","few","more","most","other","some","such","no",
  "nor","not","only","own","same","so","than","too","very","just","because",
  "but","and","or","if","while","about","against","it","its","this","that",
  "these","those","i","me","my","we","our","you","your","he","him","his","she",
  "her","they","them","their","what","which","who","whom","dont","youre","its",
  "youve","ive","weve","theyre","lets","im","id","well","get","use","using",
  "make","want","need","like","know","think","just","also","even","one","two",
  "new","now","way","up","down","right","left","back","still","without","with",
]);

const formatColors: Record<string, string> = {
  reel: "bg-primary/15 text-primary border-primary/20",
  album: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  post: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function extractKeywords(posts: Post[]): { word: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const post of posts) {
    const words = post.text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !w.startsWith("#"));
    for (const w of words) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function extractHashtags(posts: Post[]): { tag: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const post of posts) {
    const tags = post.text.match(/#[a-zA-Z0-9_]+/g) ?? [];
    for (const tag of tags) {
      const lower = tag.toLowerCase();
      freq.set(lower, (freq.get(lower) ?? 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

function bestPostingDays(posts: Post[]): { day: string; avgEngagement: number; count: number }[] {
  const dayData: { total: number; count: number }[] = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  for (const post of posts) {
    const d = new Date(post.taken_at_date).getDay();
    dayData[d].total += post.like_count + post.comment_count;
    dayData[d].count++;
  }
  return dayData
    .map((d, i) => ({
      day: DAY_NAMES[i],
      avgEngagement: d.count > 0 ? Math.round(d.total / d.count) : 0,
      count: d.count,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);
}

function formatPerformance(posts: Post[]): { format: string; avgLikes: number; count: number }[] {
  const data: Record<string, { total: number; count: number }> = {
    reel: { total: 0, count: 0 },
    album: { total: 0, count: 0 },
    post: { total: 0, count: 0 },
  };
  for (const post of posts) {
    data[post.media_name].total += post.like_count;
    data[post.media_name].count++;
  }
  return Object.entries(data)
    .map(([format, d]) => ({
      format,
      avgLikes: d.count > 0 ? Math.round(d.total / d.count) : 0,
      count: d.count,
    }))
    .sort((a, b) => b.avgLikes - a.avgLikes);
}

function ctaAnalysis(posts: Post[]): { hasCta: number; total: number; topCtaWords: string[] } {
  const ctaPattern = /comment\s+[""]?(\w+)[""]?/gi;
  const wordFreq = new Map<string, number>();
  let hasCta = 0;

  for (const post of posts) {
    const matches = [...post.text.matchAll(ctaPattern)];
    if (matches.length > 0) {
      hasCta++;
      for (const m of matches) {
        const w = m[1].toLowerCase();
        wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
      }
    }
  }

  const topCtaWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  return { hasCta, total: posts.length, topCtaWords };
}

function captionLengthInsights(posts: Post[]) {
  const sorted = [...posts].sort((a, b) => b.like_count - a.like_count);
  const topHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const bottomHalf = sorted.slice(Math.floor(sorted.length / 2));
  const avg = (arr: Post[]) =>
    arr.length > 0
      ? Math.round(arr.reduce((s, p) => s + p.text.length, 0) / arr.length)
      : 0;
  return { topAvg: avg(topHalf), bottomAvg: avg(bottomHalf) };
}

// ─── Analysis Tab ─────────────────────────────────────────────────────────────

function AnalysisTab({ allPosts }: { allPosts: Post[] }) {
  const keywords = useMemo(() => extractKeywords(allPosts), [allPosts]);
  const hashtags = useMemo(() => extractHashtags(allPosts), [allPosts]);
  const days = useMemo(() => bestPostingDays(allPosts), [allPosts]);
  const formats = useMemo(() => formatPerformance(allPosts), [allPosts]);
  const cta = useMemo(() => ctaAnalysis(allPosts), [allPosts]);
  const captionLen = useMemo(() => captionLengthInsights(allPosts), [allPosts]);

  const maxKw = keywords[0]?.count ?? 1;
  const maxDay = days[0]?.avgEngagement ?? 1;

  return (
    <div className="space-y-4">
      {/* Row 1: Keywords + Hashtags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top 20 Keywords</CardTitle>
            <p className="text-xs text-muted-foreground">Most used words across all captions</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {keywords.map(({ word, count }) => (
                <div key={word} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4 text-right">{count}</span>
                  <div className="flex-1 relative h-5 flex items-center">
                    <div
                      className="absolute left-0 h-full rounded-sm bg-primary/15"
                      style={{ width: `${(count / maxKw) * 100}%` }}
                    />
                    <span className="relative text-xs font-mono px-1.5">{word}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top 15 Hashtags</CardTitle>
            <p className="text-xs text-muted-foreground">Most frequently used hashtags</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {hashtags.map(({ tag, count }) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                >
                  {tag}
                  <span className="text-primary/60 text-[10px]">{count}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Best Day + Format Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Best Posting Days</CardTitle>
            <p className="text-xs text-muted-foreground">Average engagement (likes + comments) by day of week</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {days.map(({ day, avgEngagement, count }, i) => (
                <div key={day} className="flex items-center gap-3">
                  <span className={cn("text-xs font-medium w-6", i === 0 && "text-primary")}>{day}</span>
                  <div className="flex-1 h-5 relative flex items-center">
                    <div
                      className={cn("absolute left-0 h-full rounded-sm", i === 0 ? "bg-primary/30" : "bg-secondary")}
                      style={{ width: `${(avgEngagement / maxDay) * 100}%` }}
                    />
                    <span className="relative text-xs px-1.5">{avgEngagement.toLocaleString()}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground w-12 text-right">{count} posts</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Format Performance</CardTitle>
            <p className="text-xs text-muted-foreground">Average likes per format type</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {formats.map(({ format, avgLikes, count }) => (
                <div key={format} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-4 ${formatColors[format]}`}
                    >
                      {format}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{count} posts</span>
                  </div>
                  <span className="text-sm font-semibold">{avgLikes.toLocaleString()} avg likes</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: CTA Pattern + Caption Length */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Comment [WORD] CTA Pattern</CardTitle>
            <p className="text-xs text-muted-foreground">Posts using "Comment X to get Y" conversion tactic</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{cta.hasCta}</p>
                  <p className="text-xs text-muted-foreground">Posts with CTA</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{Math.round((cta.hasCta / cta.total) * 100)}%</p>
                  <p className="text-xs text-muted-foreground">Usage rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-muted-foreground">{cta.total - cta.hasCta}</p>
                  <p className="text-xs text-muted-foreground">Without CTA</p>
                </div>
              </div>
              {cta.topCtaWords.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Top trigger words:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cta.topCtaWords.map((w) => (
                      <span key={w} className="px-2 py-0.5 rounded-md bg-secondary text-xs font-mono">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Caption Length Insights</CardTitle>
            <p className="text-xs text-muted-foreground">Top 50% vs bottom 50% performers by likes</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-primary">{captionLen.topAvg.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Top performers avg chars</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">{captionLen.bottomAvg.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Bottom performers avg chars</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {captionLen.topAvg > captionLen.bottomAvg
                  ? `Top posts use ${(captionLen.topAvg - captionLen.bottomAvg).toLocaleString()} more characters on average — longer captions correlate with higher engagement.`
                  : captionLen.topAvg < captionLen.bottomAvg
                    ? `Top posts are shorter by ${(captionLen.bottomAvg - captionLen.topAvg).toLocaleString()} chars — concise captions correlate with higher engagement.`
                    : "Caption length shows no clear correlation with performance."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── All Posts Table ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

function AllPostsTable({ allPosts, competitors }: { allPosts: Post[]; competitors: CompetitorSummary[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("taken_at_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { isPinned, togglePin } = usePinnedPosts();

  const filteredPosts = useMemo(() => {
    const now = Date.now();
    const cutoff = dateRange === "7" ? now - 7 * 86400000
      : dateRange === "30" ? now - 30 * 86400000
      : 0;

    return allPosts.filter((p) => {
      if (creatorFilter !== "all" && p.username !== creatorFilter) return false;
      if (formatFilter !== "all" && p.media_name !== formatFilter) return false;
      if (cutoff > 0 && new Date(p.taken_at_date).getTime() < cutoff) return false;
      if (search && !p.text.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => {
      let aVal: number;
      let bVal: number;
      if (sortKey === "taken_at_date") {
        aVal = new Date(a.taken_at_date).getTime();
        bVal = new Date(b.taken_at_date).getTime();
      } else if (sortKey === "engagement") {
        aVal = a.like_count + a.comment_count;
        bVal = b.like_count + b.comment_count;
      } else {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [allPosts, sortKey, sortDir, creatorFilter, formatFilter, dateRange, search]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedPosts = filteredPosts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  }

  function handleFilterChange<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1); };
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={creatorFilter}
          onChange={(e) => handleFilterChange(setCreatorFilter)(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-md border border-border bg-secondary text-secondary-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="all">All creators</option>
          {competitors.map((c) => (
            <option key={c.username} value={c.username}>@{c.username}</option>
          ))}
        </select>

        <select
          value={formatFilter}
          onChange={(e) => handleFilterChange(setFormatFilter)(e.target.value as FormatFilter)}
          className="px-2 py-1.5 text-xs rounded-md border border-border bg-secondary text-secondary-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="all">All formats</option>
          <option value="reel">Reels</option>
          <option value="album">Albums</option>
          <option value="post">Posts</option>
        </select>

        <select
          value={dateRange}
          onChange={(e) => handleFilterChange(setDateRange)(e.target.value as DateRange)}
          className="px-2 py-1.5 text-xs rounded-md border border-border bg-secondary text-secondary-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="all">All time</option>
          <option value="30">Last 30 days</option>
          <option value="7">Last 7 days</option>
        </select>

        <select
          value={sortKey}
          onChange={(e) => { setSortKey(e.target.value as SortKey); setPage(1); }}
          className="px-2 py-1.5 text-xs rounded-md border border-border bg-secondary text-secondary-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="taken_at_date">Sort: Date (newest)</option>
          <option value="like_count">Sort: Likes</option>
          <option value="comment_count">Sort: Comments</option>
          <option value="engagement">Sort: Engagement</option>
        </select>

        <Input
          placeholder="Search captions..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="bg-input border-border text-xs h-7 w-48"
        />

        <span className="text-xs text-muted-foreground self-center ml-auto">
          {filteredPosts.length} posts
        </span>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs">Creator</TableHead>
              <TableHead
                className="text-xs cursor-pointer select-none"
                onClick={() => toggleSort("taken_at_date")}
              >
                <span className="flex items-center gap-1">Date <ArrowUpDown size={11} className="text-muted-foreground" /></span>
              </TableHead>
              <TableHead className="text-xs">Hook</TableHead>
              <TableHead className="text-xs">Format</TableHead>
              <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("like_count")}>
                <span className="flex items-center gap-1">Likes <ArrowUpDown size={11} className="text-muted-foreground" /></span>
              </TableHead>
              <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("comment_count")}>
                <span className="flex items-center gap-1">Comments <ArrowUpDown size={11} className="text-muted-foreground" /></span>
              </TableHead>
              <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("engagement")}>
                <span className="flex items-center gap-1">Eng. <ArrowUpDown size={11} className="text-muted-foreground" /></span>
              </TableHead>
              <TableHead className="text-xs w-10"></TableHead>
              <TableHead className="text-xs w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedPosts.map((post, i) => (
              <TableRow key={i} className="border-border hover:bg-secondary/30">
                <TableCell className="text-xs font-medium whitespace-nowrap">
                  <a href={`https://www.instagram.com/${post.username}/`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/70 hover:underline transition-colors">
                    @{post.username}
                  </a>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(post.taken_at_date)}
                </TableCell>
                <TableCell className="text-sm max-w-xs">
                  <p className="truncate text-foreground/80">{post.hook}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${formatColors[post.media_name]}`}>
                    {post.media_name}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-medium">{(post.like_count ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{post.comment_count ?? 0}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{((post.like_count ?? 0) + (post.comment_count ?? 0)).toLocaleString()}</TableCell>
                <TableCell>
                  <a href={post.postUrl ?? post.link_user} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title={post.postUrl ? "View post" : "View profile"}>
                    <ExternalLink size={13} />
                  </a>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => togglePin(post)}
                    title={isPinned(post) ? "Unpin post" : "Pin post"}
                    className={cn(
                      "transition-colors",
                      isPinned(post)
                        ? "text-primary hover:text-primary/70"
                        : "text-muted-foreground hover:text-primary"
                    )}
                  >
                    <Bookmark size={13} fill={isPinned(post) ? "currentColor" : "none"} />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {filteredPosts.length} posts total
          </span>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-2 py-1 rounded border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              &lt; Prev
            </button>
            <span className="text-muted-foreground px-1">
              Page {safePage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-2 py-1 rounded border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next &gt;
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Competitors Tab (original + enhancements) ────────────────────────────────

function CompetitorsTab({
  competitors,
  allPosts,
  scrapedMap,
  onScrapeSaved,
  onDeleteCompetitor,
}: {
  competitors: CompetitorSummary[];
  allPosts: Post[];
  scrapedMap: Map<string, string>;
  onScrapeSaved: (username: string, posts: Post[], scrapedAt: string) => void;
  onDeleteCompetitor: (username: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("taken_at_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [search, setSearch] = useState("");
  const [compPage, setCompPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [scraping, setScraping] = useState<string | null>(null);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"by-competitor" | "all-posts">("by-competitor");
  const { isPinned, togglePin } = usePinnedPosts();

  async function pollScrapeResult(runId: string, label: string, usernames: string[]) {
    const maxAttempts = 60; // 5 min max (5s intervals)
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch(`/api/scrape/status?runId=${runId}`);
        const data = await res.json();
        if (data.status === "SUCCEEDED") {
          const now = new Date().toISOString();
          const rawPosts = (data.posts ?? []) as RawPost[];
          const byUser = new Map<string, Post[]>();
          for (const raw of rawPosts) {
            const post = rawToPost(raw);
            const list = byUser.get(post.username) ?? [];
            list.push(post);
            byUser.set(post.username, list);
          }
          for (const [uname, posts] of byUser.entries()) {
            onScrapeSaved(uname, posts, now);
          }
          // Also save any usernames that returned 0 posts with updated timestamp
          for (const u of usernames) {
            if (!byUser.has(u)) onScrapeSaved(u, [], now);
          }
          setScrapeResult(`${data.count ?? rawPosts.length} posts scraped`);
          return;
        }
        if (data.status !== "RUNNING") {
          setScrapeResult(`Error: ${data.error ?? data.status}`);
          return;
        }
        setScrapeResult(`Scraping ${label}... (${i * 5}s)`);
      } catch (err) {
        setScrapeResult(`Error polling: ${String(err)}`);
        return;
      }
    }
    setScrapeResult("Scrape timed out after 5 minutes");
  }

  async function scrapeAll() {
    setScraping("all");
    setScrapeResult("Starting scrape...");
    try {
      const usernames = competitors.map((c) => c.username);
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScrapeResult(`Error: ${data.error ?? "Unknown error"}`);
        return;
      }
      await pollScrapeResult(data.runId, `${usernames.length} competitors`, usernames);
    } catch (err) {
      setScrapeResult(`Error: ${String(err)}`);
    } finally {
      setScraping(null);
    }
  }

  async function scrapeOne(username: string) {
    setScraping(username);
    setScrapeResult("Starting scrape...");
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScrapeResult(`Error: ${data.error ?? "Unknown error"}`);
        return;
      }
      await pollScrapeResult(data.runId, `@${username}`, [username]);
    } catch (err) {
      setScrapeResult(`Error: ${String(err)}`);
    } finally {
      setScraping(null);
    }
  }

  const selectedComp = competitors.find((c) => c.username === selected);

  const filteredSortedPosts = useMemo(() => {
    if (!selectedComp) return [];
    const now = Date.now();
    const cutoff = dateRange === "7" ? now - 7 * 86400000
      : dateRange === "30" ? now - 30 * 86400000
      : 0;

    return [...selectedComp.posts]
      .filter((p) => {
        if (formatFilter !== "all" && p.media_name !== formatFilter) return false;
        if (cutoff > 0 && p.taken_at_date && new Date(p.taken_at_date).getTime() < cutoff) return false;
        if (search && !(p.text ?? "").toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        let aVal: number;
        let bVal: number;
        if (sortKey === "taken_at_date") {
          aVal = new Date(a.taken_at_date).getTime();
          bVal = new Date(b.taken_at_date).getTime();
        } else if (sortKey === "engagement") {
          aVal = a.like_count + a.comment_count;
          bVal = b.like_count + b.comment_count;
        } else {
          aVal = a[sortKey as "like_count" | "comment_count"];
          bVal = b[sortKey as "like_count" | "comment_count"];
        }
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      });
  }, [selectedComp, sortKey, sortDir, formatFilter, dateRange, search]);

  const compTotalPages = Math.max(1, Math.ceil(filteredSortedPosts.length / PAGE_SIZE));
  const safeCompPage = Math.min(compPage, compTotalPages);
  const pagedCompPosts = filteredSortedPosts.slice((safeCompPage - 1) * PAGE_SIZE, safeCompPage * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
    setCompPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{competitors.length} competitors tracked</p>
          {scrapeResult && (
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full border",
              scrapeResult.startsWith("Error")
                ? "bg-destructive/15 text-destructive border-destructive/20"
                : "bg-primary/15 text-primary border-primary/20"
            )}>
              {scrapeResult}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-md border border-border overflow-hidden text-xs">
            <button
              onClick={() => setViewMode("by-competitor")}
              className={cn(
                "px-2.5 py-1.5 transition-colors",
                viewMode === "by-competitor"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              By Competitor
            </button>
            <button
              onClick={() => setViewMode("all-posts")}
              className={cn(
                "px-2.5 py-1.5 transition-colors",
                viewMode === "all-posts"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              All Posts
            </button>
          </div>
          <button
            onClick={scrapeAll}
            disabled={scraping !== null}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scraping === "all" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {scraping === "all" ? "Scraping..." : "Rescrape All"}
          </button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <PlusCircle size={14} />
              Add Competitor
            </DialogTrigger>
            <DialogContent className="bg-popover border-border">
              <DialogHeader>
                <DialogTitle>Add Competitor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Instagram Username</label>
                  <Input
                    placeholder="e.g. charlieautomates or instagram.com/charlieautomates"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const h = newUsername.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
                        if (h) onScrapeSaved(h, [], "");
                        setNewUsername("");
                        setAddOpen(false);
                      }
                    }}
                    className="bg-input border-border"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Add the username to track it. Scrape immediately or it will be included in the next Scrape All.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddOpen(false)} className="border-border">Cancel</Button>
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      const h = newUsername.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
                      if (h) onScrapeSaved(h, [], "");
                      setNewUsername("");
                      setAddOpen(false);
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Platform badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-pink-500/30 bg-pink-500/10 text-pink-400">
          Instagram
        </span>
      </div>

      {viewMode === "all-posts" ? (
        <AllPostsTable allPosts={allPosts} competitors={competitors} />
      ) : (
        <>
          {/* Competitor cards grid */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
            {competitors.map((comp) => {
              const scrapedAt = scrapedMap.get(comp.username);
              const isFresh = !!scrapedAt;
              return (
                <Card
                  key={comp.username}
                  onClick={() => setSelected(selected === comp.username ? null : comp.username)}
                  className={cn(
                    "bg-card border-border cursor-pointer transition-all hover:border-primary/40",
                    selected === comp.username && "border-primary ring-1 ring-primary/30",
                    isFresh && "border-primary/30"
                  )}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="mb-3">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium text-primary truncate">@{comp.username}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {isFresh && (
                            <Zap size={10} className="text-primary" />
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); scrapeOne(comp.username); }}
                            disabled={scraping !== null}
                            title={`Rescrape @${comp.username}`}
                            className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {scraping === comp.username
                              ? <Loader2 size={12} className="animate-spin" />
                              : <RefreshCw size={12} />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Remove @${comp.username} from tracking?`)) {
                                onDeleteCompetitor(comp.username);
                              }
                            }}
                            title={`Remove @${comp.username}`}
                            className="text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 ${formatColors[comp.topFormat]}`}
                        >
                          top: {comp.topFormat}
                        </Badge>
                        {isFresh && scrapedAt ? (
                          <span className="text-[10px] text-primary/70">
                            scraped {new Date(scrapedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60">static data</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Posts</span>
                        <span className="font-medium">{comp.postCount}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Avg likes</span>
                        <span className="font-medium">{comp.avgLikes.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Avg comments</span>
                        <span className="font-medium">{comp.avgComments}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Post table for selected competitor */}
          {selectedComp && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium">
                  Posts by <span className="text-primary">@{selectedComp.username}</span>
                  <span className="text-muted-foreground ml-2 font-normal">({selectedComp.postCount} posts)</span>
                </h2>
              </div>

              {/* Filters for competitor post table */}
              <div className="flex flex-wrap gap-2 mb-3">
                <select
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value as FormatFilter)}
                  className="px-2 py-1.5 text-xs rounded-md border border-border bg-secondary text-secondary-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="all">All formats</option>
                  <option value="reel">Reels</option>
                  <option value="album">Albums</option>
                  <option value="post">Posts</option>
                </select>

                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRange)}
                  className="px-2 py-1.5 text-xs rounded-md border border-border bg-secondary text-secondary-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="all">All time</option>
                  <option value="30">Last 30 days</option>
                  <option value="7">Last 7 days</option>
                </select>

                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="px-2 py-1.5 text-xs rounded-md border border-border bg-secondary text-secondary-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="taken_at_date">Sort: Date</option>
                  <option value="like_count">Sort: Likes</option>
                  <option value="comment_count">Sort: Comments</option>
                  <option value="engagement">Sort: Engagement</option>
                </select>

                <Input
                  placeholder="Search captions..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCompPage(1); }}
                  className="bg-input border-border text-xs h-7 w-48"
                />

                <span className="text-xs text-muted-foreground self-center ml-auto">
                  {filteredSortedPosts.length} posts
                </span>
              </div>

              <Card className="bg-card border-border overflow-hidden">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("taken_at_date")}>
                        <span className="flex items-center gap-1">Date <ArrowUpDown size={11} className="text-muted-foreground" /></span>
                      </TableHead>
                      <TableHead className="text-xs">Hook</TableHead>
                      <TableHead className="text-xs">Format</TableHead>
                      <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("like_count")}>
                        <span className="flex items-center gap-1">Likes <ArrowUpDown size={11} className="text-muted-foreground" /></span>
                      </TableHead>
                      <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("comment_count")}>
                        <span className="flex items-center gap-1">Comments <ArrowUpDown size={11} className="text-muted-foreground" /></span>
                      </TableHead>
                      <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("engagement")}>
                        <span className="flex items-center gap-1">Eng. <ArrowUpDown size={11} className="text-muted-foreground" /></span>
                      </TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedCompPosts.map((post, i) => (
                      <TableRow key={i} className="border-border hover:bg-secondary/30">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(post.taken_at_date)}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs">
                          <p className="truncate text-foreground/80">{post.hook}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${formatColors[post.media_name]}`}>
                            {post.media_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{(post.like_count ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{post.comment_count ?? 0}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{((post.like_count ?? 0) + (post.comment_count ?? 0)).toLocaleString()}</TableCell>
                        <TableCell>
                          <a href={post.postUrl ?? post.link_user} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title={post.postUrl ? "View post" : "View profile"}>
                            <ExternalLink size={13} />
                          </a>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => togglePin(post)}
                            title={isPinned(post) ? "Unpin post" : "Pin post"}
                            className={cn(
                              "transition-colors",
                              isPinned(post)
                                ? "text-primary hover:text-primary/70"
                                : "text-muted-foreground hover:text-primary"
                            )}
                          >
                            <Bookmark size={13} fill={isPinned(post) ? "currentColor" : "none"} />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {filteredSortedPosts.length} posts total
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => setCompPage((p) => Math.max(1, p - 1))}
                      disabled={safeCompPage <= 1}
                      className="px-2 py-1 rounded border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      &lt; Prev
                    </button>
                    <span className="text-muted-foreground px-1">
                      Page {safeCompPage} of {compTotalPages}
                    </span>
                    <button
                      onClick={() => setCompPage((p) => Math.min(compTotalPages, p + 1))}
                      disabled={safeCompPage >= compTotalPages}
                      className="px-2 py-1 rounded border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next &gt;
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── YouTube Analysis Helpers ─────────────────────────────────────────────────

const YT_STOP_WORDS = new Set([
  "the","a","an","is","are","was","were","be","been","have","has","do","does","to",
  "of","in","for","on","with","at","by","and","or","it","this","that","i","my","me",
  "we","our","you","your","he","him","she","her","they","them","what","how","when",
  "why","where","will","can","could","should","would","just","from","as","into","all",
  "out","up","but","if","so","more","no","not","only","get","use","make","want","know",
  "also","one","two","its","dont","im","via","new","now",
]);

const YT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ytExtractKeywords(videos: YouTubeVideo[]): { word: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const v of videos) {
    const words = v.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !YT_STOP_WORDS.has(w));
    for (const w of words) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function ytBestUploadDays(videos: YouTubeVideo[]): { day: string; avgViews: number; count: number }[] {
  const dayData: { total: number; count: number }[] = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  for (const v of videos) {
    if (!v.publishedAt) continue;
    const d = new Date(v.publishedAt).getDay();
    dayData[d].total += v.viewCount;
    dayData[d].count++;
  }
  return dayData
    .map((d, i) => ({
      day: YT_DAY_NAMES[i],
      avgViews: d.count > 0 ? Math.round(d.total / d.count) : 0,
      count: d.count,
    }))
    .sort((a, b) => b.avgViews - a.avgViews);
}

function ytFormatPerformance(videos: YouTubeVideo[]): { format: string; avgViews: number; avgLikes: number; count: number }[] {
  const data: Record<string, { views: number; likes: number; count: number }> = {
    shorts: { views: 0, likes: 0, count: 0 },
    long: { views: 0, likes: 0, count: 0 },
    live: { views: 0, likes: 0, count: 0 },
  };
  for (const v of videos) {
    const key = !v.duration ? "long" : v.duration < 60 ? "shorts" : "long";
    data[key].views += v.viewCount;
    data[key].likes += v.likeCount;
    data[key].count++;
  }
  return Object.entries(data)
    .map(([format, d]) => ({
      format,
      avgViews: d.count > 0 ? Math.round(d.views / d.count) : 0,
      avgLikes: d.count > 0 ? Math.round(d.likes / d.count) : 0,
      count: d.count,
    }))
    .sort((a, b) => b.avgViews - a.avgViews);
}

function ytTitleLengthInsights(videos: YouTubeVideo[]) {
  const sorted = [...videos].sort((a, b) => b.viewCount - a.viewCount);
  const topHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const bottomHalf = sorted.slice(Math.floor(sorted.length / 2));
  const avgLen = (arr: YouTubeVideo[]) =>
    arr.length > 0
      ? Math.round(arr.reduce((s, v) => s + v.title.length, 0) / arr.length)
      : 0;
  const avgViews = (arr: YouTubeVideo[]) =>
    arr.length > 0
      ? Math.round(arr.reduce((s, v) => s + v.viewCount, 0) / arr.length)
      : 0;
  return {
    topAvgLen: avgLen(topHalf),
    bottomAvgLen: avgLen(bottomHalf),
    topAvgViews: avgViews(topHalf),
    bottomAvgViews: avgViews(bottomHalf),
  };
}

// ─── YouTube Analysis Tab ──────────────────────────────────────────────────────

function YouTubeAnalysisTab({ videos, summaries }: { videos: YouTubeVideo[]; summaries: YouTubeChannelSummary[] }) {
  const keywords = useMemo(() => ytExtractKeywords(videos), [videos]);
  const days = useMemo(() => ytBestUploadDays(videos), [videos]);
  const formats = useMemo(() => ytFormatPerformance(videos), [videos]);
  const titleInsights = useMemo(() => ytTitleLengthInsights(videos), [videos]);

  const maxKw = keywords[0]?.count ?? 1;
  const maxDay = days[0]?.avgViews ?? 1;
  const maxFmtViews = formats[0]?.avgViews ?? 1;
  const maxChannelViews = Math.max(...summaries.map((s) => s.avgViews), 1);

  const ytFormatColors: Record<string, string> = {
    shorts: "bg-primary/15 text-primary border-primary/20",
    long: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    live: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  };

  if (videos.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No YouTube data yet — go to the Competitors tab and click Scrape All to fetch video data.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Row 1: Keywords */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Top 20 Keywords</CardTitle>
          <p className="text-xs text-muted-foreground">Most used words across all video titles</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {keywords.map(({ word, count }) => (
              <div key={word} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 text-right">{count}</span>
                <div className="flex-1 relative h-5 flex items-center">
                  <div
                    className="absolute left-0 h-full rounded-sm bg-red-500/20"
                    style={{ width: `${(count / maxKw) * 100}%` }}
                  />
                  <span className="relative text-xs font-mono px-1.5">{word}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Row 2: Best Upload Days + Format Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Best Upload Days</CardTitle>
            <p className="text-xs text-muted-foreground">Average views by day of week</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {days.map(({ day, avgViews, count }, i) => (
                <div key={day} className="flex items-center gap-3">
                  <span className={cn("text-xs font-medium w-6", i === 0 && "text-red-400")}>{day}</span>
                  <div className="flex-1 h-5 relative flex items-center">
                    <div
                      className={cn("absolute left-0 h-full rounded-sm", i === 0 ? "bg-red-500/30" : "bg-secondary")}
                      style={{ width: `${(avgViews / maxDay) * 100}%` }}
                    />
                    <span className="relative text-xs px-1.5">{avgViews.toLocaleString()}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground w-14 text-right">{count} videos</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Format Performance</CardTitle>
            <p className="text-xs text-muted-foreground">Avg views per format (Shorts &lt;60s / Long / Live)</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {formats.map(({ format, avgViews, avgLikes, count }) => (
                <div key={format}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 ${ytFormatColors[format] ?? ""}`}
                      >
                        {format}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{count} videos</span>
                    </div>
                    <span className="text-sm font-semibold">{avgViews.toLocaleString()} avg views</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-red-500/40"
                      style={{ width: `${(avgViews / maxFmtViews) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{avgLikes.toLocaleString()} avg likes</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Title Length Insights + Channel Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Title Length vs Views</CardTitle>
            <p className="text-xs text-muted-foreground">Top 50% vs bottom 50% performers by views</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-red-400">{titleInsights.topAvgLen}</p>
                  <p className="text-xs text-muted-foreground">Top performers avg title chars</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">{titleInsights.bottomAvgLen}</p>
                  <p className="text-xs text-muted-foreground">Bottom performers avg title chars</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {titleInsights.topAvgLen > titleInsights.bottomAvgLen
                  ? `Top videos use ${titleInsights.topAvgLen - titleInsights.bottomAvgLen} more title characters on average — longer titles correlate with higher views.`
                  : titleInsights.topAvgLen < titleInsights.bottomAvgLen
                    ? `Top videos have shorter titles by ${titleInsights.bottomAvgLen - titleInsights.topAvgLen} chars — concise titles correlate with higher views.`
                    : "Title length shows no clear correlation with view performance."}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border">
                <div>
                  <p className="text-sm font-semibold">{titleInsights.topAvgViews.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Avg views (top half)</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">{titleInsights.bottomAvgViews.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Avg views (bottom half)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Views per Channel</CardTitle>
            <p className="text-xs text-muted-foreground">Which competitor gets the most average views</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...summaries].sort((a, b) => b.avgViews - a.avgViews).map((s, i) => (
                <div key={s.channelId} className="flex items-center gap-3">
                  <span className={cn("text-xs font-medium w-28 truncate shrink-0", i === 0 ? "text-red-400" : "text-muted-foreground")}>
                    {s.channelName}
                  </span>
                  <div className="flex-1 h-5 relative flex items-center">
                    <div
                      className={cn("absolute left-0 h-full rounded-sm", i === 0 ? "bg-red-500/30" : "bg-secondary")}
                      style={{ width: `${(s.avgViews / maxChannelViews) * 100}%` }}
                    />
                    <span className="relative text-xs px-1.5">{s.avgViews.toLocaleString()}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0">{s.videoCount} vids</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── YouTube Tab ───────────────────────────────────────────────────────────────

const YT_STORAGE_KEY = "yt-scraped-data";
const YT_CHANNELS_KEY = "yt-competitor-channels";

type YTSortKey = "publishedAt" | "viewCount" | "likeCount" | "commentCount";
type YTSortDir = "asc" | "desc";

function YouTubeTab() {
  const [channels, setChannels] = useState<string[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newChannelId, setNewChannelId] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<YTSortKey>("viewCount");
  const [sortDir, setSortDir] = useState<YTSortDir>("desc");

  useEffect(() => {
    try {
      const defaults = DEFAULT_YT_CHANNELS.map((c) => c.channelId);
      const storedChannels = localStorage.getItem(YT_CHANNELS_KEY);
      const stored: string[] = storedChannels ? JSON.parse(storedChannels) : [];
      // Merge in any default channels the stored list is missing (e.g. new SEO
      // competitors added in code) without dropping the user's own additions.
      const merged = [...stored, ...defaults.filter((id) => !stored.includes(id))];
      setChannels(merged);
      if (merged.length !== stored.length) {
        localStorage.setItem(YT_CHANNELS_KEY, JSON.stringify(merged));
      }
      const storedVideos = localStorage.getItem(YT_STORAGE_KEY);
      if (storedVideos) setVideos(JSON.parse(storedVideos));
    } catch {
      setChannels(DEFAULT_YT_CHANNELS.map((c) => c.channelId));
    }
  }, []);

  function saveChannels(updated: string[]) {
    setChannels(updated);
    localStorage.setItem(YT_CHANNELS_KEY, JSON.stringify(updated));
  }

  function addChannel() {
    const id = newChannelId.trim();
    if (id && !channels.includes(id)) {
      saveChannels([...channels, id]);
    }
    setNewChannelId("");
    setAddOpen(false);
  }

  async function scrapeAll() {
    setScraping(true);
    setScrapeResult(null);
    try {
      const channelUrls = channels.map((id) =>
        id.startsWith("UC") ? `https://www.youtube.com/channel/${id}` : `https://www.youtube.com/@${id}`
      );
      const res = await fetch("/api/scrape-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelUrls }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScrapeResult(`Error: ${data.error ?? "Unknown error"}`);
      } else {
        const newVideos = data.videos as YouTubeVideo[];
        setVideos(newVideos);
        localStorage.setItem(YT_STORAGE_KEY, JSON.stringify(newVideos));
        setScrapeResult(`${data.count} videos scraped`);
      }
    } catch (err) {
      setScrapeResult(`Error: ${String(err)}`);
    } finally {
      setScraping(false);
    }
  }

  const summaries: YouTubeChannelSummary[] = useMemo(() => {
    const scraped = videos.length > 0 ? buildYouTubeSummaries(videos) : [];

    // Every tracked channel gets a card whether or not it has scraped videos yet.
    // buildYouTubeSummaries only knows about channels present in the scrape, so a
    // channel added since the last Scrape All would otherwise vanish from the page
    // entirely — which reads as "my change didn't ship", not "no data yet".
    // Videos may arrive without a channelId, so match on name as well as id.
    const covered = new Set<string>();
    for (const s of scraped) {
      covered.add(s.channelId);
      covered.add(s.channelName);
    }

    const placeholders = DEFAULT_YT_CHANNELS
      .filter((c) => !covered.has(c.channelId) && !covered.has(c.channelName))
      .map((c) => ({
        channelId: c.channelId,
        channelName: c.channelName,
        category: c.category,
        videoCount: 0,
        avgViews: 0,
        avgLikes: 0,
        avgComments: 0,
        videos: [],
      }));

    return [...scraped, ...placeholders];
  }, [videos]);

  const selectedSummary = summaries.find((s) => s.channelId === selectedChannel || s.channelName === selectedChannel);

  const channelVideos = useMemo(() => {
    if (!selectedSummary) return [];
    return [...selectedSummary.videos].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "publishedAt") {
        av = new Date(a.publishedAt).getTime();
        bv = new Date(b.publishedAt).getTime();
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [selectedSummary, sortKey, sortDir]);

  function toggleSort(key: YTSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // Two channels, two brands — keep the competitor sets visually separate.
  // knowledge/operational/youtube-channels.md is the source of truth for the split.
  const channelGroups = useMemo(() => {
    return [
      {
        key: "seo",
        title: "ClearScale — @lachlanSEO",
        note: "AU local SEO for tradies",
        items: summaries.filter((s) => s.category === "seo"),
      },
      {
        key: "ai",
        title: "LachlanCB — @Lachlan-AI",
        note: "AI automation for agency owners",
        items: summaries.filter((s) => s.category === "ai"),
      },
      {
        key: "other",
        title: "Unassigned",
        note: "Added by hand — no brand set",
        items: summaries.filter((s) => s.category !== "seo" && s.category !== "ai"),
      },
    ].filter((g) => g.items.length > 0);
  }, [summaries]);

  function formatDuration(seconds: number): string {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      return `${h}h ${m % 60}m`;
    }
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <Tabs defaultValue="competitors">
      <TabsList className="mb-6">
        <TabsTrigger value="competitors">Competitors</TabsTrigger>
        <TabsTrigger value="analysis">Analysis</TabsTrigger>
      </TabsList>

      <TabsContent value="analysis">
        <YouTubeAnalysisTab videos={videos} summaries={summaries} />
      </TabsContent>

      <TabsContent value="competitors">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{channels.length} channels tracked</p>
          {scrapeResult && (
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full border",
              scrapeResult.startsWith("Error")
                ? "bg-destructive/15 text-destructive border-destructive/20"
                : "bg-primary/15 text-primary border-primary/20"
            )}>
              {scrapeResult}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={scrapeAll}
            disabled={scraping}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scraping ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {scraping ? "Scraping..." : "Scrape All"}
          </button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <PlusCircle size={14} />
              Add Channel
            </DialogTrigger>
            <DialogContent className="bg-popover border-border">
              <DialogHeader>
                <DialogTitle>Add YouTube Channel</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Channel ID (starts with UC...)</label>
                  <Input
                    placeholder="e.g. UCbo-KbSjJDG6JWQ_MTZ_rNA"
                    value={newChannelId}
                    onChange={(e) => setNewChannelId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addChannel()}
                    className="bg-input border-border"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddOpen(false)} className="border-border">Cancel</Button>
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={addChannel}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Platform badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-red-500/30 bg-red-500/10 text-red-400">
          YouTube
        </span>
        {videos.length === 0 && (
          <span className="text-xs text-muted-foreground">No data yet — click Scrape All to fetch videos</span>
        )}
      </div>

      {/* Channel cards — split by brand */}
      <div className="space-y-6">
        {channelGroups.map((group) => (
          <div key={group.key}>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-medium">{group.title}</h2>
              <span className="text-xs text-muted-foreground">{group.note}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {group.items.length} {group.items.length === 1 ? "channel" : "channels"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              {group.items.map((s) => (
            <Card
              key={s.channelId}
              onClick={() => setSelectedChannel(selectedChannel === s.channelId ? null : s.channelId)}
              className={cn(
                "bg-card border-border cursor-pointer transition-all hover:border-primary/40",
                selectedChannel === s.channelId && "border-primary ring-1 ring-primary/30"
              )}
            >
              <CardContent className="pt-4 pb-4">
                <div className="mb-3">
                  <p className="text-sm font-medium text-primary truncate">{s.channelName}</p>
                  <div className="flex gap-1 mt-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 bg-red-500/10 text-red-400 border-red-500/20"
                    >
                      youtube
                    </Badge>
                    {s.category && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4",
                          s.category === "seo"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-sky-500/10 text-sky-400 border-sky-500/20"
                        )}
                      >
                        {s.category === "seo" ? "SEO" : "AI"}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Videos</span>
                    <span className="font-medium">{s.videoCount}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Avg views</span>
                    <span className="font-medium">{s.avgViews.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Avg likes</span>
                    <span className="font-medium">{s.avgLikes.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Video table for selected channel */}
      {selectedSummary && channelVideos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">
              Videos by <span className="text-primary">{selectedSummary.channelName}</span>
              <span className="text-muted-foreground ml-2 font-normal">({selectedSummary.videoCount} videos)</span>
            </h2>
          </div>
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-xs w-16">Thumb</TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("publishedAt")}>
                      <span className="flex items-center gap-1">Date <ArrowUpDown size={11} className="text-muted-foreground" /></span>
                    </TableHead>
                    <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("viewCount")}>
                      <span className="flex items-center gap-1">Views <ArrowUpDown size={11} className="text-muted-foreground" /></span>
                    </TableHead>
                    <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("likeCount")}>
                      <span className="flex items-center gap-1">Likes <ArrowUpDown size={11} className="text-muted-foreground" /></span>
                    </TableHead>
                    <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("commentCount")}>
                      <span className="flex items-center gap-1">Comments <ArrowUpDown size={11} className="text-muted-foreground" /></span>
                    </TableHead>
                    <TableHead className="text-xs">Duration</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelVideos.map((video, i) => (
                    <TableRow key={i} className="border-border hover:bg-secondary/30">
                      <TableCell className="py-1.5">
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            className="w-14 h-8 object-cover rounded"
                          />
                        ) : (
                          <div className="w-14 h-8 bg-secondary rounded" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs">
                        <p className="truncate text-foreground/80">{video.title}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{video.viewCount.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{video.likeCount.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{video.commentCount.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className={cn(
                          "px-1 py-0.5 rounded text-[10px]",
                          video.duration && video.duration < 60
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-muted-foreground"
                        )}>
                          {formatDuration(video.duration)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {video.url && (
                          <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {selectedSummary && selectedSummary.videos.length === 0 && (
        <p className="text-sm text-muted-foreground">No videos yet for {selectedSummary.channelName}. Run Scrape All to fetch data.</p>
      )}
    </div>
      </TabsContent>
    </Tabs>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface Props {
  competitors: CompetitorSummary[];
}

export function CompetitorsClient({ competitors: staticCompetitors }: Props) {
  const [scrapedEntries, setScrapedEntries] = useState<ScrapedEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount and self-heal stale entries.
  // Older scraped data may have null/missing engagement counts (e.g. accounts
  // that hide likes), which used to crash the post tables. healPost normalizes.
  useEffect(() => {
    const loaded = loadScrapedData();
    let dirty = false;
    const healed: ScrapedEntry[] = loaded.map((entry) => {
      const healedPosts = (entry.posts ?? []).map((p) => {
        const fixed = healPost(p);
        if (
          fixed.like_count !== p.like_count ||
          fixed.comment_count !== p.comment_count ||
          fixed.media_name !== p.media_name ||
          fixed.taken_at_date !== p.taken_at_date
        ) {
          dirty = true;
        }
        return fixed;
      });
      return { ...entry, posts: healedPosts };
    });
    if (dirty) saveScrapedData(healed);
    setScrapedEntries(healed);
    setMounted(true);
  }, []);

  const { competitors, scrapedMap } = useMemo(
    () => buildMergedCompetitors(staticCompetitors, scrapedEntries),
    [staticCompetitors, scrapedEntries]
  );

  const allPosts = useMemo(
    () => competitors.flatMap((c) => c.posts),
    [competitors]
  );

  function handleScrapeSaved(username: string, posts: Post[], scrapedAt: string) {
    // Deduplicate posts by shortCode or text
    const seen = new Set<string>();
    const dedupedPosts = posts.filter((p) => {
      const key = p.shortCode ?? p.hook ?? p.text?.slice(0, 80) ?? "";
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setScrapedEntries((prev) => {
      const filtered = prev.filter((e) => e.username !== username);
      const next = [...filtered];
      if (dedupedPosts.length > 0) {
        next.push({ username, posts: dedupedPosts, scrapedAt });
      } else {
        next.push({ username, posts: [], scrapedAt: "" });
      }
      saveScrapedData(next);
      return next;
    });
  }

  function handleDeleteCompetitor(username: string) {
    setScrapedEntries((prev) => {
      const next = prev.filter((e) => e.username !== username);
      saveScrapedData(next);
      return next;
    });
    try {
      const raw = localStorage.getItem(IG_HANDLES_KEY);
      if (raw) {
        const handles = (JSON.parse(raw) as string[]).filter((h) => h !== username);
        localStorage.setItem(IG_HANDLES_KEY, JSON.stringify(handles));
      }
    } catch { /* ignore */ }
  }

  if (!mounted) return null;

  return (
    <div className="p-4 md:p-6">
      {/* Platform tabs */}
      <Tabs defaultValue="instagram" className="mb-6">
        <TabsList>
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
        </TabsList>

        <TabsContent value="instagram" className="mt-6">
          <Tabs defaultValue="competitors">
            <TabsList className="mb-6">
              <TabsTrigger value="competitors">Competitors</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>
            <TabsContent value="competitors">
              <CompetitorsTab
                competitors={competitors}
                allPosts={allPosts}
                scrapedMap={scrapedMap}
                onScrapeSaved={handleScrapeSaved}
                onDeleteCompetitor={handleDeleteCompetitor}
              />
            </TabsContent>
            <TabsContent value="analysis">
              <AnalysisTab allPosts={allPosts} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="youtube" className="mt-6">
          <YouTubeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

