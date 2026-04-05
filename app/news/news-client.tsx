'use client'

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RefreshCw, Loader2, ExternalLink } from "lucide-react";

interface Article {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  sourceKey: string;
}

interface Source {
  key: string;
  label: string;
}

const SOURCE_COLORS: Record<string, string> = {
  anthropic: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  openai: "bg-green-500/15 text-green-400 border-green-500/20",
  verge: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  techcrunch: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  hn: "bg-yellow-500/15 text-yellow-500 border-yellow-500/20",
};

function formatRelativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NewsClient() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setArticles(data.articles ?? []);
      setSources(data.sources ?? []);
      if (data.lastFetched) setLastFetched(data.lastFetched);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const filterTabs = [{ key: "all", label: "All" }, ...sources];

  const filtered = activeFilter === "all"
    ? articles
    : articles.filter((a) => a.sourceKey === activeFilter);

  return (
    <div className="p-6 space-y-4">
      {/* Filter tabs + refresh */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md transition-colors font-medium",
                activeFilter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
              )}
            >
              {tab.label}
              {tab.key !== "all" && (
                <span className="ml-1.5 text-[10px] opacity-60">
                  {articles.filter((a) => a.sourceKey === tab.key).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {lastFetched && !loading && (
            <span className="text-[10px] text-muted-foreground">
              fetched {formatRelativeDate(lastFetched)}
            </span>
          )}
          <button
            onClick={fetchNews}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-secondary text-secondary-foreground hover:bg-secondary/70 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="bg-card border-border">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-destructive">Failed to load feeds: {error}</p>
            <button onClick={fetchNews} className="text-xs text-primary hover:underline mt-2">
              Try again
            </button>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="py-4 px-5">
                <div className="animate-pulse space-y-2">
                  <div className="h-3 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-full" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Articles */}
      {!loading && !error && filtered.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No articles found.</p>
          </CardContent>
        </Card>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((article, i) => (
            <a
              key={i}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <Card className="bg-card border-border hover:border-primary/40 transition-colors">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-4 shrink-0",
                            SOURCE_COLORS[article.sourceKey] ?? "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"
                          )}
                        >
                          {article.source}
                        </Badge>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatRelativeDate(article.pubDate)}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-1">
                        {article.title}
                      </p>
                      {article.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {article.description}
                        </p>
                      )}
                    </div>
                    <ExternalLink
                      size={13}
                      className="shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors mt-0.5"
                    />
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
