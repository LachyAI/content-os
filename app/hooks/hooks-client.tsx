"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Zap,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  type SavedHook,
  getSavedHooks,
  saveHook,
  removeHook,
} from "@/lib/hook-patterns";

const PER_PAGE = 20;

interface HookEntry {
  id: string;
  hook: string;
  username: string;
  engagement: number;
  likeCount: number;
  postUrl?: string;
  saved: boolean;
}

function extractHooksFromStorage(): HookEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("ig-scraped-data");
    if (!raw) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = JSON.parse(raw) as Record<string, { posts?: any[]; scrapedAt?: string }>;
    const entries: HookEntry[] = [];

    for (const [username, val] of Object.entries(data)) {
      for (const post of val.posts ?? []) {
        const text = post.text ?? post.caption ?? "";
        const firstLine = text.split("\n")[0].trim();
        if (!firstLine || firstLine.length < 5) continue;

        const hook = firstLine.length > 120 ? firstLine.slice(0, 120) + "..." : firstLine;
        const engagement = (post.like_count ?? 0) + (post.comment_count ?? 0);

        entries.push({
          id: `${username}-${post.shortCode ?? post.shortcode ?? post.code ?? post.taken_at_date}`,
          hook,
          username,
          engagement,
          likeCount: post.like_count ?? 0,
          postUrl: post.postUrl,
          saved: false,
        });
      }
    }
    // Deduplicate by hook text + username
    const seen = new Set<string>();
    return entries.filter((e) => {
      const key = `${e.username}:${e.hook}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

export function HooksClient() {
  const [tab, setTab] = useState<"all" | "saved">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [allHooks, setAllHooks] = useState<HookEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hooks = extractHooksFromStorage();
    const saved = getSavedHooks();
    for (const h of hooks) {
      if (saved.some((s) => s.id === h.id)) h.saved = true;
    }
    setAllHooks(hooks);
  }, []);

  // Reset to page 0 whenever search or tab changes
  const searchLower = search.toLowerCase();
  const effectivePage = search || tab === "saved" ? 0 : page;
  const source = tab === "saved" ? allHooks.filter((h) => h.saved) : allHooks;
  const filteredHooks = searchLower
    ? source.filter((h) => h.hook.toLowerCase().includes(searchLower))
    : source;
  const sortedHooks = [...filteredHooks].sort((a, b) => b.engagement - a.engagement || a.id.localeCompare(b.id));
  const totalPages = Math.ceil(sortedHooks.length / PER_PAGE);
  const safePage = Math.min(effectivePage, Math.max(0, totalPages - 1));
  const pagedHooks = sortedHooks.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

  function toggleSave(entry: HookEntry) {
    if (entry.saved) {
      removeHook(entry.id);
    } else {
      saveHook({
        id: entry.id,
        hook: entry.hook,
        username: entry.username,
        engagement: entry.engagement,
        postUrl: entry.postUrl,
        savedAt: new Date().toISOString(),
      });
    }
    setAllHooks((prev) =>
      prev.map((h) => (h.id === entry.id ? { ...h, saved: !entry.saved } : h))
    );
  }

  if (!mounted) return null;

  const savedCount = allHooks.filter((h) => h.saved).length;

  return (
    <main className="flex-1 p-4 md:p-6 space-y-5 max-w-6xl">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Hook Library</h1>
          <span className="text-[10px] text-muted-foreground/50">v3</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Top hooks from competitor posts, sorted by engagement. Save the best ones — they feed into the script generator.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Zap size={12} /> Total Hooks
            </div>
            <p className="text-xl font-semibold">{allHooks.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <BookmarkCheck size={12} /> Saved
            </div>
            <p className="text-xl font-semibold">{savedCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp size={12} /> Avg Engagement
            </div>
            <p className="text-xl font-semibold">
              {allHooks.length > 0
                ? Math.round(allHooks.reduce((s, h) => s + h.engagement, 0) / allHooks.length).toLocaleString()
                : 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-muted/30 p-0.5 rounded-md">
          <button
            onClick={() => setTab("all")}
            className={cn(
              "px-3 py-1 text-xs rounded font-medium transition-colors",
              tab === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            All ({allHooks.length})
          </button>
          <button
            onClick={() => setTab("saved")}
            className={cn(
              "px-3 py-1 text-xs rounded font-medium transition-colors",
              tab === "saved" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Saved ({savedCount})
          </button>
        </div>

        <input
          type="text"
          placeholder="Search hooks or @username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-sm h-8 px-3 text-sm rounded-md border border-border bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {search
          ? `${sortedHooks.length} of ${allHooks.length} hooks match "${search}"`
          : `${sortedHooks.length} hooks`}
      </p>

      {/* Hook list */}
      <div className="space-y-2">
        {pagedHooks.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {allHooks.length === 0
                ? "No hooks yet. Scrape competitors first from the Competitors tab."
                : "No hooks match your search."}
            </CardContent>
          </Card>
        )}
        {pagedHooks.map((entry) => (
          <Card
            key={entry.id}
            className={cn("bg-card border-border transition-colors", entry.saved && "border-primary/20")}
          >
            <CardContent className="p-3 flex gap-3 items-start">
              <button
                onClick={() => toggleSave(entry)}
                className={cn(
                  "mt-0.5 shrink-0 transition-colors",
                  entry.saved ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {entry.saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              </button>

              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium leading-snug">&ldquo;{entry.hook}&rdquo;</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>@{entry.username}</span>
                  <span className="text-border">|</span>
                  <span>{entry.engagement.toLocaleString()} engagement</span>
                  {entry.postUrl && (
                    <>
                      <span className="text-border">|</span>
                      <a
                        href={entry.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                      >
                        <ExternalLink size={10} /> view
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{entry.likeCount.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">likes</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </main>
  );
}
