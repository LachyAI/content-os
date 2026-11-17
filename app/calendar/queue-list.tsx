'use client'

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { brandDot, todayChiangMai, useQueuePosts, type QueueCard } from "@/lib/use-queue-posts";
import { QueuePostDialog, formatDay } from "@/components/queue-post-dialog";

const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

// The posts going out soon, from the last batch sync. On a phone this is the main view.
export function QueueList({ days = 14 }: { days?: number }) {
  const { posts, mounted } = useQueuePosts();
  const [open, setOpen] = useState<QueueCard | null>(null);
  const [showAll, setShowAll] = useState(false);

  const today = todayChiangMai();
  const end = addDays(today, days);
  const upcoming = posts.filter((p) => p.date >= today && p.date < end);
  const byDay = upcoming.reduce<Record<string, QueueCard[]>>((acc, p) => {
    (acc[p.date] ??= []).push(p);
    return acc;
  }, {});
  const allDays = Object.keys(byDay).sort();
  // Desktop starts at the next 7 days; a phone shows all 14 (the month grid is secondary there).
  const weekEnd = addDays(today, 7);
  const hidden = showAll ? 0 : allDays.filter((d) => d >= weekEnd).length;

  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Going out in the next {days} days</h2>
        <span className="text-xs text-muted-foreground">
          {mounted ? `${upcoming.length} posts · updated after each batch` : "Loading"}
        </span>
      </div>

      {mounted && upcoming.length === 0 && (
        <p className="text-xs text-muted-foreground">Nothing queued. Posts show here after the next batch sync.</p>
      )}

      {allDays.map((day, idx) => (
        <div key={day} className={cn("space-y-1.5", !showAll && day >= weekEnd && "md:hidden", idx > 0 && "pt-1")}>
          <div className="text-xs font-medium text-muted-foreground">{formatDay(day)}</div>
          <Card className="divide-y divide-border bg-card border-border overflow-hidden py-0 gap-0">
            {byDay[day].map((p) => (
              <button
                key={p.id}
                onClick={() => setOpen(p)}
                className="flex w-full items-center gap-3 p-2.5 text-left hover:bg-secondary/40 transition-colors"
              >
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-12 w-12 shrink-0 rounded object-cover border border-border" />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded border border-border bg-secondary/50 flex items-center justify-center text-[10px] text-muted-foreground">
                    Text
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", brandDot(p.brand))} />
                    <span className="font-medium truncate">{p.platform}</span>
                    <span className="text-muted-foreground shrink-0">{p.time ?? "Facebook"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.label ?? p.text.split("\n")[0]}</div>
                </div>
              </button>
            ))}
          </Card>
        </div>
      ))}

      {!showAll && hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="hidden md:inline-flex text-xs text-primary hover:underline"
        >
          Show {hidden} more days
        </button>
      )}

      <QueuePostDialog post={open} open={open !== null} onOpenChange={(o) => !o && setOpen(null)} />
    </div>
  );
}
