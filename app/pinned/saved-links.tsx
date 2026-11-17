'use client'

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Link2, Trash2 } from "lucide-react";
import { useSupabaseBoard, type BoardCard } from "@/lib/use-supabase-board";
import { detectPlatform, type LinkPlatform } from "@/lib/link-platform";

// Research links saved from any device (stored in Supabase, so a link saved on the phone shows on the laptop).
interface SavedLink extends BoardCard {
  status: "saved";
  url: string;
  platform: LinkPlatform;
}

export function SavedLinks() {
  const { cards, mounted, addCard, removeCard } = useSupabaseBoard<SavedLink>("saved-links", "link");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function save() {
    const parsed = detectPlatform(link);
    if (!parsed) {
      setError("That doesn't look like a link");
      return;
    }
    setError("");
    await addCard({ text: note.trim(), status: "saved", url: parsed.url, platform: parsed.platform });
    setLink("");
    setNote("");
  }

  const links = [...cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="mb-8 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Saved links</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Good posts to learn from. Paste the link, add a note if you like.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-2 rounded-lg border border-border bg-card p-3"
      >
        <input
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setError("");
          }}
          inputMode="url"
          placeholder="Paste a post link"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why it's good (optional)"
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!link.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Link2 size={12} />
            Save link
          </button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </form>

      {mounted && links.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {links.map((l) => (
            <div key={l.id} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{l.platform}</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(l.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open link"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    onClick={() => void removeCard(l.id)}
                    aria-label="Delete link"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-secondary transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {l.text && <p className="text-xs leading-relaxed">{l.text}</p>}
              <a href={l.url} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-muted-foreground hover:underline">
                {l.url}
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
