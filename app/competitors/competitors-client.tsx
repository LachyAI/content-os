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
import { ArrowUpDown, ExternalLink, Loader2, PlusCircle, RefreshCw, Trash2, Zap } from "lucide-react";

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
    for (const p of posts) formatCounts[p.media_name]++;
    const topFormat = (Object.entries(formatCounts) as [Post["media_name"], number][])
      .sort((a, b) => b[1] - a[1])[0][0];
    const sortedPosts = [...posts].sort(
      (a, b) => new Date(b.taken_at_date).getTime() - new Date(a.taken_at_date).getTime()
    );
    return { username, postCount: posts.length, avgLikes, avgComments, topFormat, posts: sortedPosts };
  });

  return { competitors: result, scrapedMap };
}

// Convert raw API scrape response posts to our Post type
function rawToPost(raw: RawPost): Post {
  const username = extractUsernameFromLink(raw.link_user);
  return { ...raw, username, hook: extractHookFromText(raw.text) };
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedPosts.map((post, i) => (
              <TableRow key={i} className="border-border hover:bg-secondary/30">
                <TableCell className="text-xs text-primary font-medium whitespace-nowrap">
                  @{post.username}
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
                <TableCell className="text-sm font-medium">{post.like_count.toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{post.comment_count}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{(post.like_count + post.comment_count).toLocaleString()}</TableCell>
                <TableCell>
                  <a href={post.link_user} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                    <ExternalLink size={13} />
                  </a>
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

  async function scrapeAll() {
    setScraping("all");
    setScrapeResult(null);
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
      } else {
        const now = new Date().toISOString();
        const rawPosts = (data.posts ?? []) as RawPost[];
        // Group by username and persist each
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
        setScrapeResult(`${data.count ?? rawPosts.length} posts scraped`);
      }
    } catch (err) {
      setScrapeResult(`Error: ${String(err)}`);
    } finally {
      setScraping(null);
    }
  }

  async function scrapeOne(username: string) {
    setScraping(username);
    setScrapeResult(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScrapeResult(`Error: ${data.error ?? "Unknown error"}`);
      } else {
        const now = new Date().toISOString();
        const rawPosts = (data.posts ?? []) as RawPost[];
        const posts = rawPosts.map(rawToPost);
        onScrapeSaved(username, posts, now);
        setScrapeResult(`${posts.length} posts scraped for @${username}`);
      }
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
        if (cutoff > 0 && new Date(p.taken_at_date).getTime() < cutoff) return false;
        if (search && !p.text.toLowerCase().includes(search.toLowerCase())) return false;
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
                    placeholder="e.g. charlieautomates"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const h = newUsername.trim().replace(/^@/, "");
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
                      const h = newUsername.trim().replace(/^@/, "");
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
                        {isFresh ? (
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
                        <TableCell className="text-sm font-medium">{post.like_count.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{post.comment_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{(post.like_count + post.comment_count).toLocaleString()}</TableCell>
                        <TableCell>
                          <a href={post.link_user} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                            <ExternalLink size={13} />
                          </a>
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
      const storedChannels = localStorage.getItem(YT_CHANNELS_KEY);
      setChannels(storedChannels ? JSON.parse(storedChannels) : DEFAULT_YT_CHANNELS.map((c) => c.channelId));
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
    if (videos.length > 0) return buildYouTubeSummaries(videos);
    return DEFAULT_YT_CHANNELS.map((c) => ({
      channelId: c.channelId,
      channelName: c.channelName,
      videoCount: 0,
      avgViews: 0,
      avgLikes: 0,
      avgComments: 0,
      videos: [],
    }));
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

      {/* Channel cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {summaries.map((s) => (
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
                <Badge
                  variant="outline"
                  className="text-[10px] mt-1.5 px-1.5 py-0 h-4 bg-red-500/10 text-red-400 border-red-500/20"
                >
                  youtube
                </Badge>
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
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface Props {
  competitors: CompetitorSummary[];
}

export function CompetitorsClient({ competitors: staticCompetitors }: Props) {
  const [scrapedEntries, setScrapedEntries] = useState<ScrapedEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setScrapedEntries(loadScrapedData());
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
    setScrapedEntries((prev) => {
      const filtered = prev.filter((e) => e.username !== username);
      const next = [...filtered];
      if (posts.length > 0) {
        next.push({ username, posts, scrapedAt });
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

