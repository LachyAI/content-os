'use client'

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, PlusCircle, Download } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

type Format = "reel" | "post" | "album" | "story" | "yt-short" | "yt-long" | "yt-live" | "x-post" | "fb-post" | "li-post";
type Status = "ideas" | "scripted" | "filming" | "posted";
type DbStatus = "idea" | "scripted" | "filming" | "posted";

interface PostCard {
  id: string;
  title: string;
  caption: string;
  format: Format;
  status: Status;
  scheduledDate?: string;
  createdAt?: string;
  platform?: "instagram" | "youtube" | "x-threads" | "fb-groups" | "fb-personal" | "linkedin";
}

const IG_STORAGE_KEY = "content-os-instagram-posts";
const YT_STORAGE_KEY = "content-os-youtube-posts";
const X_BOARD_STORAGE_KEY = "content-os-x-board-posts";
const FB_BOARD_STORAGE_KEY = "content-os-fb-board-posts";
const FBP_BOARD_STORAGE_KEY = "content-os-fb-personal-board-posts";
const LI_BOARD_STORAGE_KEY = "content-os-linkedin-board-posts";
const STORAGE_KEY = IG_STORAGE_KEY;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatColors: Record<Format, string> = {
  reel: "bg-orange-500/80 text-white",
  album: "bg-blue-500/80 text-white",
  post: "bg-zinc-500/80 text-white",
  story: "bg-green-500/80 text-white",
  "yt-short": "bg-red-500/80 text-white",
  "yt-long": "bg-red-700/80 text-white",
  "yt-live": "bg-red-400/80 text-white",
  "x-post": "bg-sky-500/80 text-white",
  "fb-post": "bg-indigo-500/80 text-white",
  "li-post": "bg-blue-600/80 text-white",
};

const formatDotColors: Record<string, string> = {
  reel: "bg-orange-500",
  album: "bg-blue-500",
  post: "bg-zinc-500",
  story: "bg-green-500",
  "yt-short": "bg-red-500",
  "yt-long": "bg-red-700",
  "yt-live": "bg-red-400",
  "x-post": "bg-sky-500",
  "fb-post": "bg-indigo-500",
  "li-post": "bg-blue-600",
};

const formatBadgeColors: Record<string, string> = {
  reel: "bg-primary/15 text-primary border-primary/20",
  album: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  post: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  story: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "yt-short": "bg-red-500/15 text-red-400 border-red-500/20",
  "yt-long": "bg-red-700/15 text-red-300 border-red-700/20",
  "yt-live": "bg-red-400/15 text-red-300 border-red-400/20",
  "x-post": "bg-sky-500/15 text-sky-400 border-sky-500/20",
  "fb-post": "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  "li-post": "bg-blue-600/15 text-blue-300 border-blue-600/20",
};

function toDbStatus(status: Status): DbStatus {
  return status === "ideas" ? "idea" : status;
}

function fromDbStatus(status: string): Status {
  return status === "idea" ? "ideas" : (status as Status);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbRow(row: Record<string, any>): PostCard {
  return {
    id: row.id as string,
    title: row.title as string,
    caption: (row.caption as string) ?? "",
    format: row.format as Format,
    status: fromDbStatus(row.status as string),
    scheduledDate: row.scheduled_date as string | undefined,
    createdAt: row.created_at as string | undefined,
  };
}

function isSupabaseConfigured(): boolean {
  return (
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "PLACEHOLDER_NEEDS_REAL_KEY"
  );
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CalendarClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [useSupabase, setUseSupabase] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importDate, setImportDate] = useState("");
  const [form, setForm] = useState<{
    title: string;
    caption: string;
    format: Format;
    status: Status;
    scheduledDate: string;
  }>({ title: "", caption: "", format: "reel", status: "ideas", scheduledDate: "" });

  async function getSupabase() {
    const { supabase } = await import("@/lib/supabase");
    return supabase;
  }

  useEffect(() => {
    const configured = isSupabaseConfigured();
    setUseSupabase(configured);
    if (configured) {
      loadFromSupabase();
    } else {
      loadFromLocalStorage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadBoardPosts(): PostCard[] {
    const result: PostCard[] = [];
    try {
      const xStored = localStorage.getItem(X_BOARD_STORAGE_KEY);
      if (xStored) {
        const xCards = JSON.parse(xStored) as Record<string, unknown>[];
        for (const p of xCards) {
          if (!p.scheduledDate) continue;
          const text = (p.text as string) || "";
          result.push({
            id: p.id as string,
            title: text.slice(0, 80) + (text.length > 80 ? "…" : ""),
            caption: text,
            format: "x-post",
            status: (p.status === "published" ? "posted" : p.status === "scheduled" ? "scripted" : "ideas") as Status,
            scheduledDate: p.scheduledDate as string,
            createdAt: p.createdAt as string | undefined,
            platform: "x-threads",
          });
        }
      }
    } catch {}
    try {
      const fbStored = localStorage.getItem(FB_BOARD_STORAGE_KEY);
      if (fbStored) {
        const fbCards = JSON.parse(fbStored) as Record<string, unknown>[];
        for (const p of fbCards) {
          if (!p.scheduledDate) continue;
          const text = (p.text as string) || "";
          result.push({
            id: p.id as string,
            title: text.slice(0, 80) + (text.length > 80 ? "…" : ""),
            caption: text,
            format: "fb-post",
            status: (p.status === "published" ? "posted" : p.status === "scheduled" ? "scripted" : "ideas") as Status,
            scheduledDate: p.scheduledDate as string,
            createdAt: p.createdAt as string | undefined,
            platform: "fb-groups",
          });
        }
      }
    } catch {}
    try {
      const fbpStored = localStorage.getItem(FBP_BOARD_STORAGE_KEY);
      if (fbpStored) {
        const fbpCards = JSON.parse(fbpStored) as Record<string, unknown>[];
        for (const p of fbpCards) {
          if (!p.scheduledDate) continue;
          const text = (p.text as string) || "";
          result.push({
            id: p.id as string,
            title: text.slice(0, 80) + (text.length > 80 ? "…" : ""),
            caption: text,
            format: "fb-post",
            status: (p.status === "published" ? "posted" : p.status === "scheduled" ? "scripted" : "ideas") as Status,
            scheduledDate: p.scheduledDate as string,
            createdAt: p.createdAt as string | undefined,
            platform: "fb-personal",
          });
        }
      }
    } catch {}
    try {
      const liStored = localStorage.getItem(LI_BOARD_STORAGE_KEY);
      if (liStored) {
        const liCards = JSON.parse(liStored) as Record<string, unknown>[];
        for (const p of liCards) {
          if (!p.scheduledDate) continue;
          const text = (p.text as string) || "";
          result.push({
            id: p.id as string,
            title: text.slice(0, 80) + (text.length > 80 ? "…" : ""),
            caption: text,
            format: "li-post",
            status: (p.status === "published" ? "posted" : p.status === "scheduled" ? "scripted" : "ideas") as Status,
            scheduledDate: p.scheduledDate as string,
            createdAt: p.createdAt as string | undefined,
            platform: "linkedin",
          });
        }
      }
    } catch {}
    return result;
  }

  function loadFromLocalStorage() {
    try {
      const igStored = localStorage.getItem(IG_STORAGE_KEY);
      const ytStored = localStorage.getItem(YT_STORAGE_KEY);
      const igPosts: PostCard[] = igStored ? (JSON.parse(igStored) as PostCard[]).map(p => ({ ...p, platform: "instagram" as const })) : [];
      const ytPosts: PostCard[] = ytStored ? (JSON.parse(ytStored) as Record<string, unknown>[]).map((p) => ({
        id: p.id as string,
        title: p.title as string,
        caption: (p.description as string) || "",
        format: (p.format === "short" ? "yt-short" : p.format === "long" ? "yt-long" : p.format === "live" ? "yt-live" : "yt-long") as Format,
        status: p.status as Status,
        scheduledDate: p.scheduledDate as string | undefined,
        createdAt: p.createdAt as string | undefined,
        platform: "youtube" as const,
      })) : [];
      const boardPosts = loadBoardPosts();
      const merged = [...igPosts, ...ytPosts, ...boardPosts];
      if (merged.length > 0) {
        setPosts(merged);
      }
    } catch {
      // ignore
    }
  }

  async function loadFromSupabase() {
    try {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from("content_posts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sbPosts = data ? data.map((row: Record<string, any>) => fromDbRow(row)) : [];
      const boardPosts = loadBoardPosts();
      setPosts([...sbPosts, ...boardPosts]);
    } catch {
      loadFromLocalStorage();
    }
  }

  function saveToLocalStorage(updated: PostCard[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  async function handleAdd() {
    if (!form.title.trim()) return;

    if (useSupabase) {
      try {
        const sb = await getSupabase();
        const { data, error } = await sb
          .from("content_posts")
          .insert({
            title: form.title.trim(),
            caption: form.caption.trim(),
            format: form.format,
            status: toDbStatus(form.status),
            scheduled_date: form.scheduledDate || null,
          })
          .select()
          .single();
        if (error) throw error;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPosts((prev) => [...prev, fromDbRow(data as Record<string, any>)]);
      } catch {
        const newPost: PostCard = {
          id: generateId(),
          title: form.title.trim(),
          caption: form.caption.trim(),
          format: form.format,
          status: form.status,
          scheduledDate: form.scheduledDate || undefined,
        };
        const updated = [...posts, newPost];
        setPosts(updated);
        saveToLocalStorage(updated);
      }
    } else {
      const newPost: PostCard = {
        id: generateId(),
        title: form.title.trim(),
        caption: form.caption.trim(),
        format: form.format,
        status: form.status,
        scheduledDate: form.scheduledDate || undefined,
      };
      const updated = [...posts, newPost];
      setPosts(updated);
      saveToLocalStorage(updated);
    }

    setForm({ title: "", caption: "", format: "reel", status: "ideas", scheduledDate: "" });
    setAddOpen(false);
  }

  function openAddForDate(dateStr: string) {
    setAddDate(dateStr);
    setForm((f) => ({ ...f, scheduledDate: dateStr }));
    setAddOpen(true);
  }

  function openImportForDate(dateStr: string) {
    setImportDate(dateStr);
    setImportOpen(true);
  }

  // Show all non-posted posts in the import dialog
  const importablePosts = posts.filter((p) => p.status !== "posted");

  async function importIdeaToDate(post: PostCard, dateStr: string) {
    const updated = posts.map((p) =>
      p.id === post.id ? { ...p, scheduledDate: dateStr } : p
    );

    if (useSupabase) {
      try {
        const sb = await getSupabase();
        await sb
          .from("content_posts")
          .update({ scheduled_date: dateStr })
          .eq("id", post.id);
      } catch {
        // fall through to local update
      }
    }

    setPosts(updated);
    saveToLocalStorage(updated);
    setImportOpen(false);
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  function goToday() {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  }

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toLocalDateString(now);

  // Build grid cells: leading empty cells + day cells
  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: null, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr: ds });
  }

  // Posts indexed by date
  const postsByDate: Record<string, PostCard[]> = {};
  for (const post of posts) {
    if (post.scheduledDate) {
      if (!postsByDate[post.scheduledDate]) postsByDate[post.scheduledDate] = [];
      postsByDate[post.scheduledDate].push(post);
    }
  }

  const selectedPosts = selectedDate ? (postsByDate[selectedDate] ?? []) : [];

  const YEAR_RANGE = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="p-6 space-y-4">
      {/* Navigation bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-sm font-semibold min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs rounded-md border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Today
          </button>
          {/* Year selector */}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-2 py-1.5 text-xs rounded-md border border-border bg-secondary text-secondary-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {YEAR_RANGE.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Format legend */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        {(["reel", "album", "post", "story", "yt-short", "yt-long", "yt-live", "x-post", "fb-post", "li-post"] as Format[]).map((fmt) => (
          <span key={fmt} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", formatDotColors[fmt])} />
            {fmt}
          </span>
        ))}
      </div>

      <div className={cn("grid gap-4", selectedDate ? "grid-cols-[1fr_280px]" : "grid-cols-1")}>
        {/* Calendar grid */}
        <div>
          <Card className="bg-card border-border overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {DAY_HEADERS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {cells.map((cell, i) => {
                const isToday = cell.dateStr === todayStr;
                const isSelected = cell.dateStr === selectedDate;
                const dayPosts = cell.dateStr ? (postsByDate[cell.dateStr] ?? []) : [];

                return (
                  <div
                    key={i}
                    onClick={() => {
                      if (!cell.dateStr) return;
                      setSelectedDate(isSelected ? null : cell.dateStr);
                    }}
                    className={cn(
                      "min-h-[80px] p-1.5 border-b border-r border-border last:border-r-0 transition-colors",
                      cell.dateStr
                        ? "cursor-pointer hover:bg-secondary/40"
                        : "bg-background/20",
                      isSelected && "bg-primary/8 ring-inset ring-1 ring-primary/30",
                      // Remove right border on last column
                      (i + 1) % 7 === 0 && "border-r-0"
                    )}
                  >
                    {cell.day !== null && (
                      <>
                        <div className={cn(
                          "w-6 h-6 flex items-center justify-center rounded-full text-xs mb-1",
                          isToday
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-foreground/70"
                        )}>
                          {cell.day}
                        </div>

                        {/* Post dots */}
                        {dayPosts.length > 0 && (
                          <div className="flex flex-wrap gap-0.5">
                            {dayPosts.slice(0, 4).map((post) => (
                              <span
                                key={post.id}
                                className={cn("w-1.5 h-1.5 rounded-full", formatDotColors[post.format])}
                                title={post.title}
                              />
                            ))}
                            {dayPosts.length > 4 && (
                              <span className="text-[9px] text-muted-foreground leading-none mt-0.5">
                                +{dayPosts.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Side panel for selected date */}
        {selectedDate && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short", month: "short", day: "numeric",
                })}
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openImportForDate(selectedDate)}
                  title="Import Post"
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  <Download size={12} />
                  Import
                </button>
                <button
                  onClick={() => openAddForDate(selectedDate)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <PlusCircle size={12} />
                  Add
                </button>
              </div>
            </div>

            {selectedPosts.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-8 flex flex-col items-center justify-center text-center">
                  <p className="text-xs text-muted-foreground mb-3">No posts scheduled</p>
                  <button
                    onClick={() => openAddForDate(selectedDate)}
                    className="text-xs text-primary hover:underline"
                  >
                    Add one →
                  </button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {selectedPosts.map((post) => (
                  <Card key={post.id} className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-medium leading-snug">{post.title}</p>
                      </div>
                      {post.caption && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {post.caption}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0 h-4", formatBadgeColors[post.format])}
                        >
                          {post.format}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 border-zinc-700 text-zinc-400"
                        >
                          {post.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import Post dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="bg-popover border-border max-w-md">
          <DialogHeader>
            <DialogTitle>
              Import Post{importDate ? ` → ${new Date(importDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {importablePosts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No posts found. Add posts in the Instagram Manager.
              </p>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {importablePosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug truncate">{post.title}</p>
                      {post.caption && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{post.caption}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0 h-4", formatBadgeColors[post.format])}
                        >
                          {post.format}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 border-zinc-700 text-zinc-400"
                        >
                          {post.status}
                        </Badge>
                        {post.scheduledDate && (
                          <span className="text-[10px] text-muted-foreground">
                            currently: {new Date(post.scheduledDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => importIdeaToDate(post, importDate)}
                      className="shrink-0 px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Schedule
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button variant="outline" onClick={() => setImportOpen(false)} className="border-border">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add post dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setAddDate(""); }}>
        <DialogContent className="bg-popover border-border max-w-md">
          <DialogHeader>
            <DialogTitle>
              New Post{addDate ? ` — ${new Date(addDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Title</label>
              <Input
                placeholder="e.g. AI tools for handymen"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Caption / Hook</label>
              <Textarea
                placeholder="First line hook or full caption..."
                value={form.caption}
                onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
                className="bg-input border-border resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Format</label>
                <Select
                  value={form.format}
                  onValueChange={(v) => setForm((f) => ({ ...f, format: v as Format }))}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="reel">Reel</SelectItem>
                    <SelectItem value="post">Post</SelectItem>
                    <SelectItem value="album">Album</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as Status }))}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="ideas">Ideas</SelectItem>
                    <SelectItem value="scripted">Scripted</SelectItem>
                    <SelectItem value="filming">Filming</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Scheduled Date</label>
              <DatePicker
                value={form.scheduledDate}
                onChange={(v) => setForm((f) => ({ ...f, scheduledDate: v }))}
                className="bg-input border-border w-full"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setAddOpen(false)} className="border-border">
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleAdd}
                disabled={!form.title.trim()}
              >
                Add Post
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
