'use client'

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  BarChart2, Loader2, TrendingUp, Heart, MessageCircle, Star,
  Zap, Calendar, Film, Target, Lightbulb, RefreshCw, Eye, ThumbsUp,
} from "lucide-react";
import { getCompetitors, getAllPosts } from "@/lib/competitor-data";
import type { Post, CompetitorSummary } from "@/lib/competitor-data";
import type { YouTubeVideo, YouTubeChannelSummary } from "@/lib/youtube-competitor-data";
import { buildYouTubeSummaries, DEFAULT_YT_CHANNELS } from "@/lib/youtube-competitor-data";

const YT_SCRAPED_KEY = "yt-scraped-data";

// ─── YouTube Analytics ────────────────────────────────────────────────────────

function YouTubeAnalytics() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(YT_SCRAPED_KEY);
      if (raw) setVideos(JSON.parse(raw) as YouTubeVideo[]);
    } catch { /* ignore */ }
    setMounted(true);
  }, []);

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

  const allVideos = useMemo(() => videos, [videos]);

  const totalViews = useMemo(() => allVideos.reduce((s, v) => s + v.viewCount, 0), [allVideos]);
  const avgViews = allVideos.length > 0 ? Math.round(totalViews / allVideos.length) : 0;
  const avgLikes = allVideos.length > 0
    ? Math.round(allVideos.reduce((s, v) => s + v.likeCount, 0) / allVideos.length)
    : 0;
  const avgComments = allVideos.length > 0
    ? Math.round(allVideos.reduce((s, v) => s + v.commentCount, 0) / allVideos.length)
    : 0;

  const topVideos = useMemo(
    () => [...allVideos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 10),
    [allVideos]
  );

  // Views over time — group by month
  const viewsByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of allVideos) {
      if (!v.publishedAt) continue;
      const key = v.publishedAt.slice(0, 7); // YYYY-MM
      map.set(key, (map.get(key) ?? 0) + v.viewCount);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12);
  }, [allVideos]);

  // Format breakdown: shorts (<60s) vs long-form
  const formatBreakdown = useMemo(() => {
    const shorts = allVideos.filter((v) => v.duration > 0 && v.duration < 60);
    const longForm = allVideos.filter((v) => v.duration >= 60);
    const unknown = allVideos.filter((v) => !v.duration);
    return { shorts, longForm, unknown };
  }, [allVideos]);

  const maxMonthViews = viewsByMonth.reduce((m, [, v]) => Math.max(m, v), 1);
  const maxChannelViews = Math.max(...summaries.map((s) => s.avgViews), 1);

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

  if (!mounted) return null;

  if (allVideos.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <BarChart2 size={22} className="text-red-400/60" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              No YouTube data yet. Go to <span className="text-primary">Competitors → YouTube</span> and click Scrape All to fetch video data.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-red-500/15 flex items-center justify-center shrink-0">
                <Eye size={15} className="text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Views</p>
                <p className="text-xl font-semibold">{totalViews.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-red-500/15 flex items-center justify-center shrink-0">
                <TrendingUp size={15} className="text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Views/Video</p>
                <p className="text-xl font-semibold">{avgViews.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-red-500/15 flex items-center justify-center shrink-0">
                <ThumbsUp size={15} className="text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Likes</p>
                <p className="text-xl font-semibold">{avgLikes.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-red-500/15 flex items-center justify-center shrink-0">
                <MessageCircle size={15} className="text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Comments</p>
                <p className="text-xl font-semibold">{avgComments.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Views over time */}
      {viewsByMonth.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Views by Month (all competitors)</CardTitle>
            <p className="text-xs text-muted-foreground">Total views across all tracked channels, last 12 months</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-32">
              {viewsByMonth.map(([month, views]) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-muted-foreground/70">{views > 999 ? `${Math.round(views / 1000)}k` : views}</span>
                  <div
                    className="w-full rounded-t-sm bg-red-500/30"
                    style={{ height: `${Math.max(4, (views / maxMonthViews) * 96)}px` }}
                  />
                  <span className="text-[9px] text-muted-foreground rotate-45 origin-left translate-x-1 whitespace-nowrap overflow-hidden" style={{ maxWidth: "24px" }}>
                    {month.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Channel avg views bar chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Avg Views by Channel</CardTitle>
          <p className="text-xs text-muted-foreground">Average views per video, sorted highest to lowest</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...summaries].sort((a, b) => b.avgViews - a.avgViews).map((s) => (
              <div key={s.channelId} className="flex items-center gap-3">
                <span className="text-xs text-red-400 font-medium w-36 truncate shrink-0">{s.channelName}</span>
                <div className="flex-1 h-5 relative flex items-center">
                  <div
                    className="absolute left-0 h-full rounded-sm bg-red-500/25"
                    style={{ width: `${(s.avgViews / maxChannelViews) * 100}%` }}
                  />
                  <span className="relative text-xs px-1.5">{s.avgViews.toLocaleString()}</span>
                </div>
                <span className="text-xs text-muted-foreground w-16 text-right shrink-0">{s.videoCount} videos</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content format breakdown */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Content Format Breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">Shorts (&lt;60s) vs long-form across all competitors</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{formatBreakdown.shorts.length}</p>
              <p className="text-xs text-muted-foreground mb-1">Shorts (&lt;60s)</p>
              {formatBreakdown.shorts.length > 0 && (
                <p className="text-xs text-primary">
                  avg {Math.round(formatBreakdown.shorts.reduce((s, v) => s + v.viewCount, 0) / formatBreakdown.shorts.length).toLocaleString()} views
                </p>
              )}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{formatBreakdown.longForm.length}</p>
              <p className="text-xs text-muted-foreground mb-1">Long-form (≥60s)</p>
              {formatBreakdown.longForm.length > 0 && (
                <p className="text-xs text-blue-400">
                  avg {Math.round(formatBreakdown.longForm.reduce((s, v) => s + v.viewCount, 0) / formatBreakdown.longForm.length).toLocaleString()} views
                </p>
              )}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-muted-foreground">{formatBreakdown.unknown.length}</p>
              <p className="text-xs text-muted-foreground">Unknown duration</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top performing videos table */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Top 10 Performing Videos</CardTitle>
          <p className="text-xs text-muted-foreground">Ranked by view count across all tracked channels</p>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Title</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-medium">Channel</th>
                <th className="text-right px-4 py-2 text-muted-foreground font-medium">Views</th>
                <th className="text-right px-4 py-2 text-muted-foreground font-medium">Likes</th>
                <th className="text-right px-4 py-2 text-muted-foreground font-medium">Comments</th>
                <th className="text-right px-4 py-2 text-muted-foreground font-medium">Eng%</th>
                <th className="text-right px-4 py-2 text-muted-foreground font-medium">Duration</th>
                <th className="text-right px-4 py-2 text-muted-foreground font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {topVideos.map((v, i) => {
                const engRate = v.viewCount > 0
                  ? ((v.likeCount + v.commentCount) / v.viewCount * 100).toFixed(1)
                  : "—";
                const isShort = v.duration > 0 && v.duration < 60;
                return (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-2 max-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        {isShort && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary shrink-0">Short</span>
                        )}
                        <span className="truncate text-foreground/80">{v.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-red-400 font-medium whitespace-nowrap">{v.channelName}</td>
                    <td className="px-4 py-2 text-right font-semibold">{v.viewCount.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{v.likeCount.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{v.commentCount.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-primary font-medium">{engRate}%</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{formatDuration(v.duration)}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground whitespace-nowrap">
                      {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

const POSTS_STORAGE_KEY = "content-os-instagram-posts";

interface TrackedPost {
  id: string;
  title: string;
  caption: string;
  format: string;
  status: string;
  actual_likes?: number;
  actual_comments?: number;
  actual_saves?: number;
  actual_shares?: number;
  post_url?: string;
  performance_notes?: string;
}

const STORAGE_KEY = "content-os-analytics-username";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STOP_WORDS = new Set([
  "the","a","an","is","are","was","were","be","been","to","of","in","for","on",
  "with","at","by","and","or","it","this","that","you","i","my","me","we","our",
  "your","do","get","can","will","not","just","have","but","if","so","as","how",
  "what","when","where","use","using","make","way","know","like","all","more",
  "also","one","up","out","no","about","into","its","from","they","them","their",
  "dont","youre","ive","weve","theyre","im","well","want","need","think","even",
  "still","here","then","these","those","who","which","both","some","very","too",
]);

interface ScrapePost {
  hook: string;
  media_name: string;
  like_count: number;
  comment_count: number;
  taken_at_date: string;
  link_user?: string;
}

interface ScrapeResult {
  count: number;
  posts: ScrapePost[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function calcEngagement(post: ScrapePost, followerEst = 10000): number {
  return ((post.like_count + post.comment_count) / followerEst) * 100;
}

// ─── Competitor Intelligence calculations ────────────────────────────────────

function calcEngRate(posts: Post[]): number {
  if (!posts.length) return 0;
  const total = posts.reduce((s, p) => s + p.like_count + p.comment_count, 0);
  return total / posts.length;
}

function calcPostsPerWeek(posts: Post[]): number {
  if (posts.length < 2) return posts.length;
  const dates = posts.map((p) => new Date(p.taken_at_date).getTime()).sort((a, b) => a - b);
  const spanMs = dates[dates.length - 1] - dates[0];
  const weeks = spanMs / (7 * 86400000);
  return weeks > 0 ? Math.round((posts.length / weeks) * 10) / 10 : posts.length;
}

function mostActiveDay(posts: Post[]): string {
  if (!posts.length) return "—";
  const counts = new Array(7).fill(0);
  for (const p of posts) counts[new Date(p.taken_at_date).getDay()]++;
  const max = counts.indexOf(Math.max(...counts));
  return DAY_NAMES[max];
}

function topKeywordsFromPosts(posts: Post[], limit = 5): string[] {
  const freq = new Map<string, number>();
  for (const p of posts) {
    const words = p.text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

type HookType =
  | "comment_cta"
  | "challenge"
  | "disruption"
  | "show_tell"
  | "correction"
  | "tutorial"
  | "other";

function classifyHook(text: string): HookType {
  const t = text.toLowerCase();
  if (/comment\s+\w+\s+(for|to get|and)/i.test(t)) return "comment_cta";
  if (/you'?re?\s+(probably|still|already)|most\s+(people|creators|businesses)/i.test(t)) return "challenge";
  if (/(just replaced|is dead|is over|changed everything|will replace)/i.test(t)) return "disruption";
  if (/^(i built|i made|i created|i automated|i set up|built a|made a)/i.test(t)) return "show_tell";
  if (/^stop\s|(wrong|mistake|stop doing|stop using)/i.test(t)) return "correction";
  if (/^(here'?s? how|how (i|to)|the exact|step.by.step)/i.test(t)) return "tutorial";
  return "other";
}

const HOOK_LABELS: Record<HookType, string> = {
  comment_cta: '"Comment X for..."',
  challenge: '"You\'re probably..."',
  disruption: '"X just replaced..."',
  show_tell: '"I built/made..."',
  correction: '"Stop doing X..."',
  tutorial: '"Here\'s how..."',
  other: "Other",
};

interface HookStat {
  type: HookType;
  label: string;
  count: number;
  pct: number;
  avgEng: number;
}

function analyzeHooks(posts: Post[]): HookStat[] {
  const stats = new Map<HookType, { count: number; totalEng: number }>();
  const types: HookType[] = ["comment_cta", "challenge", "disruption", "show_tell", "correction", "tutorial", "other"];
  for (const t of types) stats.set(t, { count: 0, totalEng: 0 });
  for (const p of posts) {
    const type = classifyHook(p.hook);
    const s = stats.get(type)!;
    s.count++;
    s.totalEng += p.like_count + p.comment_count;
  }
  return types.map((type) => {
    const s = stats.get(type)!;
    return {
      type,
      label: HOOK_LABELS[type],
      count: s.count,
      pct: posts.length > 0 ? Math.round((s.count / posts.length) * 100) : 0,
      avgEng: s.count > 0 ? Math.round(s.totalEng / s.count) : 0,
    };
  }).sort((a, b) => b.count - a.count);
}

function analyzeFormats(posts: Post[]): { format: string; avgLikes: number; avgComments: number; count: number; engRate: number }[] {
  const data: Record<string, { likes: number; comments: number; count: number }> = {
    reel: { likes: 0, comments: 0, count: 0 },
    album: { likes: 0, comments: 0, count: 0 },
    post: { likes: 0, comments: 0, count: 0 },
  };
  for (const p of posts) {
    const d = data[p.media_name] ?? data.post;
    d.likes += p.like_count;
    d.comments += p.comment_count;
    d.count++;
  }
  return Object.entries(data)
    .map(([format, d]) => ({
      format,
      avgLikes: d.count > 0 ? Math.round(d.likes / d.count) : 0,
      avgComments: d.count > 0 ? Math.round(d.comments / d.count) : 0,
      count: d.count,
      engRate: d.count > 0 ? Math.round((d.likes + d.comments) / d.count) : 0,
    }))
    .sort((a, b) => b.engRate - a.engRate);
}

function analyzeCta(posts: Post[]): {
  ctaCount: number;
  nonCtaCount: number;
  ctaAvgComments: number;
  nonCtaAvgComments: number;
  topWords: string[];
} {
  const ctaPattern = /comment\s+[""]?(\w+)[""]?/gi;
  const wordFreq = new Map<string, number>();
  let ctaComments = 0;
  let nonCtaComments = 0;
  let ctaCount = 0;
  let nonCtaCount = 0;

  for (const p of posts) {
    const matches = [...p.text.matchAll(ctaPattern)];
    if (matches.length > 0) {
      ctaCount++;
      ctaComments += p.comment_count;
      for (const m of matches) {
        const w = m[1].toLowerCase();
        wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
      }
    } else {
      nonCtaCount++;
      nonCtaComments += p.comment_count;
    }
  }

  return {
    ctaCount,
    nonCtaCount,
    ctaAvgComments: ctaCount > 0 ? Math.round(ctaComments / ctaCount) : 0,
    nonCtaAvgComments: nonCtaCount > 0 ? Math.round(nonCtaComments / nonCtaCount) : 0,
    topWords: Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([w]) => w),
  };
}

function bestDayByEngagement(posts: Post[]): { day: string; avgEng: number; count: number }[] {
  const days = Array.from({ length: 7 }, (_, i) => ({ day: DAY_NAMES[i], total: 0, count: 0 }));
  for (const p of posts) {
    const d = new Date(p.taken_at_date).getDay();
    days[d].total += p.like_count + p.comment_count;
    days[d].count++;
  }
  return days
    .map((d) => ({ day: d.day, avgEng: d.count > 0 ? Math.round(d.total / d.count) : 0, count: d.count }))
    .sort((a, b) => b.avgEng - a.avgEng);
}

// ─── Recommendation engine ────────────────────────────────────────────────────

interface Recommendation {
  icon: string;
  title: string;
  detail: string;
}

function generateRecommendations(
  allPosts: Post[],
  formats: ReturnType<typeof analyzeFormats>,
  bestDay: { day: string; avgEng: number; count: number }[],
  ctaStats: ReturnType<typeof analyzeCta>,
  topTopics: string[]
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Format rec
  const topFormat = formats[0];
  const secondFormat = formats[1];
  if (topFormat && secondFormat && topFormat.count > 0 && secondFormat.count > 0) {
    const pct = secondFormat.engRate > 0
      ? Math.round(((topFormat.engRate - secondFormat.engRate) / secondFormat.engRate) * 100)
      : 0;
    if (pct > 5) {
      recs.push({
        icon: "film",
        title: `Post more ${topFormat.format}s`,
        detail: `${topFormat.format}s get ${pct}% more engagement than ${secondFormat.format}s on average across all competitors.`,
      });
    }
  }

  // Best day rec
  if (bestDay[0] && bestDay[0].count > 0) {
    recs.push({
      icon: "calendar",
      title: `Post on ${bestDay[0].day}`,
      detail: `${bestDay[0].day} shows the highest avg engagement (${bestDay[0].avgEng.toLocaleString()} likes+comments) across competitor posts.`,
    });
  }

  // CTA rec
  if (ctaStats.ctaAvgComments > ctaStats.nonCtaAvgComments && ctaStats.ctaCount > 3) {
    const boost = ctaStats.nonCtaAvgComments > 0
      ? Math.round(((ctaStats.ctaAvgComments - ctaStats.nonCtaAvgComments) / ctaStats.nonCtaAvgComments) * 100)
      : 0;
    const topWord = ctaStats.topWords[0] ?? "AI";
    recs.push({
      icon: "target",
      title: `Use "Comment ${topWord.toUpperCase()}" CTAs`,
      detail: `Posts with comment CTAs get ${boost > 0 ? `${boost}% more` : "significantly more"} comments. "${topWord.toUpperCase()}" is the top trigger word.`,
    });
  }

  // Top topic rec
  if (topTopics[0]) {
    const count = allPosts.filter((p) =>
      p.text.toLowerCase().includes(topTopics[0])
    ).length;
    recs.push({
      icon: "trending",
      title: `Trending topic: "${topTopics[0]}"`,
      detail: `"${topTopics[0]}" appears in ${count} of the top posts — high signal for what the algorithm is rewarding right now.`,
    });
  }

  return recs;
}

// ─── Format colors ────────────────────────────────────────────────────────────

const formatColors: Record<string, string> = {
  reel: "bg-primary/15 text-primary border-primary/20",
  album: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  post: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackedPosts, setTrackedPosts] = useState<TrackedPost[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(POSTS_STORAGE_KEY);
      if (stored) setTrackedPosts(JSON.parse(stored) as TrackedPost[]);
    } catch { /* ignore */ }
  }, []);

  // Persist username
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUsername(saved);
    } catch { /* ignore */ }
  }, []);

  async function fetchStats() {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      localStorage.setItem(STORAGE_KEY, username.trim());
    } catch { /* ignore */ }
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username.trim()] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Scrape failed");
      } else {
        const posts: ScrapePost[] = (data.posts ?? []).slice(0, 20);
        setResult({ count: posts.length, posts });
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  // Derived metrics for your account section
  const metrics = result && result.posts.length > 0 ? (() => {
    const posts = result.posts;
    const avgLikes = Math.round(posts.reduce((s, p) => s + p.like_count, 0) / posts.length);
    const avgComments = Math.round(posts.reduce((s, p) => s + p.comment_count, 0) / posts.length);
    const avgEng = (posts.reduce((s, p) => s + calcEngagement(p), 0) / posts.length).toFixed(2);
    const best = [...posts].sort((a, b) => b.like_count - a.like_count)[0];
    const dayTotals: Record<number, { likes: number; count: number }> = {};
    for (const p of posts) {
      const dow = new Date(p.taken_at_date).getDay();
      if (!dayTotals[dow]) dayTotals[dow] = { likes: 0, count: 0 };
      dayTotals[dow].likes += p.like_count;
      dayTotals[dow].count += 1;
    }
    let bestDayIdx = 0;
    let bestDayAvg = 0;
    for (const [dow, totals] of Object.entries(dayTotals)) {
      const avg = totals.likes / totals.count;
      if (avg > bestDayAvg) { bestDayAvg = avg; bestDayIdx = Number(dow); }
    }
    return { avgLikes, avgComments, avgEng, best, bestDay: DAY_NAMES[bestDayIdx] };
  })() : null;

  // ── Competitor Intelligence (merges static + scraped from localStorage) ──
  const [refreshKey, setRefreshKey] = useState(0);

  const { staticCompetitors, allCompPosts } = useMemo(() => {
    const base = getCompetitors();
    // Merge scraped data from localStorage (same pattern as competitors page)
    try {
      const raw = localStorage.getItem("ig-scraped-data");
      if (raw) {
        const scraped = JSON.parse(raw) as Array<{ username: string; posts: Post[] }>;
        const scrapedMap = new Map(scraped.filter(e => e.posts.length > 0).map(e => [e.username, e.posts]));
        const merged = base.map(c => {
          const fresh = scrapedMap.get(c.username);
          if (fresh && fresh.length > 0) return { ...c, posts: fresh };
          return c;
        });
        // Add any scraped competitors not in static data
        for (const e of scraped) {
          if (!base.some(c => c.username === e.username) && e.posts.length > 0) {
            const posts = e.posts;
            const likes = posts.map(p => p.like_count);
            const comments = posts.map(p => p.comment_count);
            const types = posts.map(p => p.media_name);
            const topFormat = (["reel", "album", "post"] as const).reduce((a, b) =>
              types.filter(t => t === b).length > types.filter(t => t === a).length ? b : a
            , "reel" as const);
            merged.push({
              username: e.username,
              posts,
              postCount: posts.length,
              avgLikes: Math.round(likes.reduce((a, b) => a + b, 0) / likes.length),
              avgComments: Math.round(comments.reduce((a, b) => a + b, 0) / comments.length),
              topFormat,
            });
          }
        }
        return { staticCompetitors: merged, allCompPosts: merged.flatMap(c => c.posts) };
      }
    } catch { /* ignore */ }
    return { staticCompetitors: base, allCompPosts: getAllPosts() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const engByCompetitor = useMemo(
    () =>
      [...staticCompetitors]
        .map((c) => ({ username: c.username, avgEng: Math.round(calcEngRate(c.posts)) }))
        .sort((a, b) => b.avgEng - a.avgEng),
    [staticCompetitors]
  );

  const freqTable = useMemo(
    () =>
      staticCompetitors.map((c) => ({
        username: c.username,
        postsPerWeek: calcPostsPerWeek(c.posts),
        bestDay: mostActiveDay(c.posts),
      })),
    [staticCompetitors]
  );

  const top20pctPosts = useMemo(() => {
    const sorted = [...allCompPosts].sort(
      (a, b) => b.like_count + b.comment_count - (a.like_count + a.comment_count)
    );
    return sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.2)));
  }, [allCompPosts]);

  const trendingTopics = useMemo(() => {
    const freq = new Map<string, number>();
    for (const p of top20pctPosts) {
      const words = p.text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
      for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count }));
  }, [top20pctPosts]);

  const hookStats = useMemo(() => analyzeHooks(allCompPosts), [allCompPosts]);
  const formatStats = useMemo(() => analyzeFormats(allCompPosts), [allCompPosts]);
  const ctaStats = useMemo(() => analyzeCta(allCompPosts), [allCompPosts]);
  const bestDayStats = useMemo(() => bestDayByEngagement(allCompPosts), [allCompPosts]);

  const maxEng = engByCompetitor[0]?.avgEng ?? 1;
  const maxHookEng = Math.max(...hookStats.map((h) => h.avgEng), 1);
  const maxDayEng = bestDayStats[0]?.avgEng ?? 1;

  const topTopics = useMemo(() => topKeywordsFromPosts(top20pctPosts, 5), [top20pctPosts]);

  const recommendations = useMemo(
    () => generateRecommendations(allCompPosts, formatStats, bestDayStats, ctaStats, topTopics),
    [allCompPosts, formatStats, bestDayStats, ctaStats, topTopics]
  );

  return (
    <div className="flex-1">
      <PageHeader title="Analytics" description="Performance metrics & competitor intelligence" />

      <div className="p-6 space-y-8">
        <Tabs defaultValue="instagram">
          <TabsList>
            <TabsTrigger value="instagram">Instagram</TabsTrigger>
            <TabsTrigger value="youtube">YouTube</TabsTrigger>
          </TabsList>
          <TabsContent value="youtube" className="mt-6">
            <YouTubeAnalytics />
          </TabsContent>
          <TabsContent value="instagram" className="mt-6">
        <div className="space-y-8">
        {/* Refresh button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey(k => k + 1)}
            className="gap-2"
          >
            <RefreshCw size={14} />
            Refresh Data
          </Button>
        </div>
        {/* ── Section 3: Content Recommendations (shown first as highlights) ─ */}
        {recommendations.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Content Recommendations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    {rec.icon === "film" && <Film size={13} className="text-primary shrink-0" />}
                    {rec.icon === "calendar" && <Calendar size={13} className="text-primary shrink-0" />}
                    {rec.icon === "target" && <Target size={13} className="text-primary shrink-0" />}
                    {rec.icon === "trending" && <TrendingUp size={13} className="text-primary shrink-0" />}
                    <p className="text-xs font-semibold text-primary">{rec.title}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{rec.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section 1: Your Account ──────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Your Account
          </h2>
          <Card className="bg-card border-border">
            <CardContent className="pt-5 space-y-3">
              <div className="flex gap-2 max-w-sm">
                <Input
                  placeholder="Instagram username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") fetchStats(); }}
                  className="bg-input border-border"
                />
                <Button
                  onClick={fetchStats}
                  disabled={loading || !username.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : "Fetch My Stats"}
                </Button>
              </div>
              {error && (
                <p className={cn(
                  "text-xs px-2 py-1 rounded border w-fit",
                  "bg-destructive/15 text-destructive border-destructive/20"
                )}>
                  {error}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Metric summary cards */}
          {metrics && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mt-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                      <Heart size={15} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Likes</p>
                      <p className="text-xl font-semibold">{metrics.avgLikes.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                      <MessageCircle size={15} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Comments</p>
                      <p className="text-xl font-semibold">{metrics.avgComments}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                      <TrendingUp size={15} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Engagement</p>
                      <p className="text-xl font-semibold">{metrics.avgEng}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                      <Star size={15} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Best Day</p>
                      <p className="text-xl font-semibold">{metrics.bestDay}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Best performing post */}
          {metrics?.best && (
            <Card className="bg-card border-border mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Best Performing Post
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground/80 line-clamp-2">{metrics.best.hook}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(metrics.best.taken_at_date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{metrics.best.like_count.toLocaleString()} likes</p>
                    <p className="text-xs text-muted-foreground">{metrics.best.comment_count} comments</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Posts table */}
          {result && result.posts.length > 0 && (
            <Card className="bg-card border-border overflow-hidden mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Last {result.posts.length} Posts — @{username}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {result.posts.map((post, i) => (
                    <div key={i} className="px-5 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] px-1.5 py-0 h-4", formatColors[post.media_name] ?? formatColors.post)}
                          >
                            {post.media_name}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(post.taken_at_date)}</span>
                        </div>
                        <p className="text-sm text-foreground/80 truncate">{post.hook}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium">{post.like_count.toLocaleString()} likes</p>
                        <p className="text-xs text-muted-foreground">{post.comment_count} comments</p>
                        <p className="text-xs text-muted-foreground">{calcEngagement(post).toFixed(1)}% eng</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!result && !loading && (
            <Card className="bg-card border-border mt-4">
              <CardContent className="py-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart2 size={22} className="text-primary/60" />
                </div>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Enter your username above to fetch your last 20 posts.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Section 2: Competitor Intelligence ───────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Competitor Intelligence
            <span className="ml-2 text-muted-foreground/50 normal-case font-normal">
              {staticCompetitors.length} accounts · {allCompPosts.length} posts
            </span>
          </h2>

          <div className="space-y-4">
            {/* Engagement bar chart */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Avg Engagement by Competitor</CardTitle>
                <p className="text-xs text-muted-foreground">Likes + comments per post, sorted highest to lowest</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {engByCompetitor.map(({ username: uname, avgEng }) => (
                    <div key={uname} className="flex items-center gap-3">
                      <span className="text-xs text-primary font-medium w-32 truncate shrink-0">@{uname}</span>
                      <div className="flex-1 h-5 relative flex items-center">
                        <div
                          className="absolute left-0 h-full rounded-sm bg-primary/25"
                          style={{ width: `${(avgEng / maxEng) * 100}%` }}
                        />
                        <span className="relative text-xs px-1.5">{avgEng.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Posting frequency table */}
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Posting Frequency</CardTitle>
                <p className="text-xs text-muted-foreground">How often each competitor posts</p>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 text-muted-foreground font-medium">Competitor</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">Posts/week</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">Most active day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freqTable.map(({ username: uname, postsPerWeek, bestDay }) => (
                      <tr key={uname} className="border-b border-border last:border-0 hover:bg-secondary/30">
                        <td className="px-4 py-2 text-primary font-medium">@{uname}</td>
                        <td className="px-4 py-2 text-right font-medium">{postsPerWeek}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{bestDay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Trending topics from top 20% */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Trending Topics in Top Posts</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Keywords from top 20% of posts ({top20pctPosts.length} posts) by engagement
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {trendingTopics.map(({ word, count }) => (
                    <span
                      key={word}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-medium"
                    >
                      {word}
                      <span className="text-primary/60 text-[10px]">{count}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Hook pattern analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Hook Pattern Distribution</CardTitle>
                  <p className="text-xs text-muted-foreground">% of all competitor posts by hook type</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {hookStats.filter((h) => h.count > 0).map((h) => (
                      <div key={h.type} className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground w-32 shrink-0 leading-tight">{h.label}</span>
                        <div className="flex-1 h-4 relative flex items-center">
                          <div
                            className="absolute left-0 h-full rounded-sm bg-primary/20"
                            style={{ width: `${h.pct}%` }}
                          />
                          <span className="relative text-[10px] px-1.5">{h.pct}%</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">{h.count} posts</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Hook Type vs Avg Engagement</CardTitle>
                  <p className="text-xs text-muted-foreground">Avg likes + comments per hook type</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[...hookStats]
                      .filter((h) => h.count > 0)
                      .sort((a, b) => b.avgEng - a.avgEng)
                      .map((h) => (
                        <div key={h.type} className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground w-32 shrink-0 leading-tight">{h.label}</span>
                          <div className="flex-1 h-4 relative flex items-center">
                            <div
                              className="absolute left-0 h-full rounded-sm bg-blue-500/20"
                              style={{ width: `${(h.avgEng / maxHookEng) * 100}%` }}
                            />
                            <span className="relative text-[10px] px-1.5">{h.avgEng.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Best day to post */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Best Day to Post</CardTitle>
                <p className="text-xs text-muted-foreground">Avg engagement by day of week across all competitor posts</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {bestDayStats.sort((a, b) => DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day)).map((d, i) => {
                    const isBest = d.day === bestDayStats[0].day;
                    return (
                      <div key={d.day} className="flex flex-col items-center gap-1.5">
                        <div className="relative w-full flex flex-col items-center">
                          <div
                            className={cn(
                              "w-full rounded-sm",
                              isBest ? "bg-primary/40" : "bg-secondary"
                            )}
                            style={{ height: `${Math.max(8, (d.avgEng / maxDayEng) * 60)}px` }}
                          />
                        </div>
                        <span className={cn("text-[10px] font-medium", isBest ? "text-primary" : "text-muted-foreground")}>
                          {d.day}
                          {isBest && " ★"}
                        </span>
                        <span className="text-[9px] text-muted-foreground/70">{d.avgEng > 0 ? d.avgEng.toLocaleString() : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Format deep dive */}
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Format Deep Dive</CardTitle>
                <p className="text-xs text-muted-foreground">Reel vs Album vs Post performance across all competitors</p>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 text-muted-foreground font-medium">Format</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">Posts</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">Avg Likes</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">Avg Comments</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">Avg Eng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formatStats.map(({ format, avgLikes, avgComments, count, engRate }) => (
                      <tr key={format} className="border-b border-border last:border-0 hover:bg-secondary/30">
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${formatColors[format] ?? formatColors.post}`}>
                            {format}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{count}</td>
                        <td className="px-4 py-2 text-right font-medium">{avgLikes.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{avgComments}</td>
                        <td className="px-4 py-2 text-right font-semibold text-primary">{engRate.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* CTA analysis */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">CTA Analysis</CardTitle>
                <p className="text-xs text-muted-foreground">Do "Comment X" CTAs actually drive more comments?</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{ctaStats.ctaCount}</p>
                    <p className="text-xs text-muted-foreground">Posts with CTA</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{ctaStats.ctaAvgComments}</p>
                    <p className="text-xs text-muted-foreground">Avg comments (CTA)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{ctaStats.nonCtaAvgComments}</p>
                    <p className="text-xs text-muted-foreground">Avg comments (no CTA)</p>
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      "text-2xl font-bold",
                      ctaStats.ctaAvgComments > ctaStats.nonCtaAvgComments ? "text-primary" : "text-muted-foreground"
                    )}>
                      {ctaStats.nonCtaAvgComments > 0
                        ? `${Math.round(((ctaStats.ctaAvgComments - ctaStats.nonCtaAvgComments) / ctaStats.nonCtaAvgComments) * 100)}%`
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">CTA comment boost</p>
                  </div>
                </div>
                {ctaStats.topWords.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Top trigger words:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ctaStats.topWords.map((w) => (
                        <span key={w} className="px-2 py-0.5 rounded-md bg-secondary text-xs font-mono uppercase">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Section 4: Your Posts Performance ───────────────────────────── */}
        {(() => {
          const postedPosts = trackedPosts.filter(
            (p) => p.status === "posted" && p.actual_likes !== undefined
          );
          if (postedPosts.length === 0) return null;

          const avgLikes = Math.round(
            postedPosts.reduce((s, p) => s + (p.actual_likes ?? 0), 0) / postedPosts.length
          );
          const avgComments = Math.round(
            postedPosts.reduce((s, p) => s + (p.actual_comments ?? 0), 0) / postedPosts.length
          );
          const avgSaves = Math.round(
            postedPosts.reduce((s, p) => s + (p.actual_saves ?? 0), 0) / postedPosts.length
          );
          const bestPost = [...postedPosts].sort(
            (a, b) => ((b.actual_likes ?? 0) + (b.actual_comments ?? 0)) - ((a.actual_likes ?? 0) + (a.actual_comments ?? 0))
          )[0];

          return (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Your Posts Performance
                <span className="ml-2 text-muted-foreground/50 normal-case font-normal">
                  {postedPosts.length} logged
                </span>
              </h2>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Card className="bg-card border-border">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                        <Heart size={13} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Likes</p>
                        <p className="text-lg font-semibold">{avgLikes.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                        <MessageCircle size={13} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Comments</p>
                        <p className="text-lg font-semibold">{avgComments}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                        <Star size={13} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Saves</p>
                        <p className="text-lg font-semibold">{avgSaves}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Best performing post highlight */}
              {bestPost && (
                <Card className="bg-primary/5 border-primary/20 mb-4">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-primary uppercase tracking-wider font-semibold mb-1">Best Performing Post</p>
                        <p className="text-sm font-medium leading-snug">{bestPost.title}</p>
                        {bestPost.post_url && (
                          <a
                            href={bestPost.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-primary/70 hover:text-primary underline mt-0.5 inline-block"
                          >
                            View post
                          </a>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-sm font-semibold">{(bestPost.actual_likes ?? 0).toLocaleString()} likes</p>
                        <p className="text-xs text-muted-foreground">{bestPost.actual_comments ?? 0} comments</p>
                        {bestPost.actual_saves !== undefined && (
                          <p className="text-xs text-muted-foreground">{bestPost.actual_saves} saves</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Full table */}
              <Card className="bg-card border-border overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">All Logged Posts</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-2 text-muted-foreground font-medium">Post</th>
                        <th className="text-right px-4 py-2 text-muted-foreground font-medium">Likes</th>
                        <th className="text-right px-4 py-2 text-muted-foreground font-medium">Comments</th>
                        <th className="text-right px-4 py-2 text-muted-foreground font-medium">Saves</th>
                        <th className="text-right px-4 py-2 text-muted-foreground font-medium">Shares</th>
                        <th className="text-right px-4 py-2 text-muted-foreground font-medium">Total Eng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...postedPosts]
                        .sort((a, b) => ((b.actual_likes ?? 0) + (b.actual_comments ?? 0)) - ((a.actual_likes ?? 0) + (a.actual_comments ?? 0)))
                        .map((post) => {
                          const totalEng = (post.actual_likes ?? 0) + (post.actual_comments ?? 0) + (post.actual_saves ?? 0);
                          return (
                            <tr key={post.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] px-1.5 py-0 h-4 shrink-0",
                                      post.format === "reel" ? "bg-primary/15 text-primary border-primary/20" :
                                      post.format === "album" ? "bg-blue-500/15 text-blue-400 border-blue-500/20" :
                                      "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"
                                    )}
                                  >
                                    {post.format}
                                  </Badge>
                                  <span className="font-medium truncate max-w-[200px]">{post.title}</span>
                                </div>
                                {post.performance_notes && (
                                  <p className="text-muted-foreground/60 mt-0.5 truncate max-w-[280px]">{post.performance_notes}</p>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right font-medium">{(post.actual_likes ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">{post.actual_comments ?? "—"}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">{post.actual_saves ?? "—"}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">{post.actual_shares ?? "—"}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-primary">{totalEng.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          );
        })()}
        </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
