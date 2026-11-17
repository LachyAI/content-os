'use client'

import { useEffect, useState } from "react";
import { Check, Copy, PenLine, RefreshCw } from "lucide-react";

interface Captions {
  facebook: string;
  linkedin: string;
}

// The last idea and result stay on this device, so switching to Facebook to paste and coming back loses nothing.
const STORAGE_KEY = "write-page-last";

function loadSaved(): { idea: string; captions: Captions | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as { idea: string; captions: Captions | null };
  } catch {}
  return { idea: "", captions: null };
}

function save(idea: string, captions: Captions | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ idea, captions }));
  } catch {}
}

function CaptionPanel({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    </div>
  );
}

export function WriteClient() {
  const [idea, setIdea] = useState("");
  const [captions, setCaptions] = useState<Captions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = loadSaved();
    setIdea(saved.idea);
    setCaptions(saved.captions);
  }, []);

  async function write() {
    if (!idea.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/write-captions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = (await res.json()) as Partial<Captions> & { error?: string };
      if (!res.ok || !data.facebook || !data.linkedin) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      const next = { facebook: data.facebook, linkedin: data.linkedin };
      setCaptions(next);
      save(idea, next);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Write</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Type or dictate an idea. You get a Facebook caption and a LinkedIn caption.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void write();
        }}
        className="space-y-3"
      >
        <textarea
          value={idea}
          onChange={(e) => {
            setIdea(e.target.value);
            save(e.target.value, captions);
          }}
          autoFocus
          rows={5}
          placeholder="What's the idea? A few lines is plenty."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!idea.trim() || loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {captions ? <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> : <PenLine size={14} />}
            {loading ? "Writing, about 30 seconds" : captions ? "Write again" : "Write captions"}
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </form>

      {captions && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CaptionPanel title="Facebook" text={captions.facebook} />
          <CaptionPanel title="LinkedIn" text={captions.linkedin} />
        </div>
      )}
    </div>
  );
}
