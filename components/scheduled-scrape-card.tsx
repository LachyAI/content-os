'use client'

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

const LAST_SCRAPE_KEY = "scheduled-scrape-last-run";

export function ScheduledScrapeCard() {
  const [lastScrape, setLastScrape] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAST_SCRAPE_KEY);
      if (stored) setLastScrape(stored);
    } catch { /* ignore */ }
  }, []);

  const formattedDate = lastScrape
    ? new Date(lastScrape).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock size={14} className="text-muted-foreground" />
          Scheduled Scraping
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border border-zinc-700 bg-zinc-800 text-zinc-400">
            Auto-scrape: Not configured
          </span>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Run manually:</p>
          <code className="block bg-secondary/60 px-2 py-1.5 rounded text-[11px] font-mono text-foreground/80 select-all">
            npx tsx scripts/scheduled-scrape.ts
          </code>
          <p className="pt-1">Or set up a VPS cron job to run automatically.</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Last scrape:{" "}
          <span className={formattedDate ? "text-foreground" : "text-muted-foreground/60"}>
            {formattedDate ?? "Never"}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
