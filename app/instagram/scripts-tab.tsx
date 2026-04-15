'use client'

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Database, FileText, Maximize2, Minimize2, PlusCircle, RefreshCw, Search, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useScripts, type SavedScript, type ScriptFormat, type ScriptDraft } from "@/lib/use-scripts";
import { getAllPosts, type Post } from "@/lib/competitor-data";
import { ScriptEditor } from "./script-editor";
import { getSavedHooks, HOOK_PATTERNS } from "@/lib/hook-patterns";
import { SCRIPTING_KNOWLEDGE } from "@/lib/scripting-knowledge";

// Pull top-performing reels from bundled static data + scraped localStorage (if present).
// Used as few-shot examples when AI-expanding a script.
function getTopReelReferences(limit = 20): Post[] {
  const bundled = getAllPosts();
  let scraped: Post[] = [];
  try {
    const raw = localStorage.getItem("ig-scraped-data");
    if (raw) {
      const entries = JSON.parse(raw) as { posts: Post[] }[];
      scraped = entries.flatMap((e) => e.posts ?? []);
    }
  } catch {
    // ignore
  }
  const all = [...bundled, ...scraped].filter((p) => p.media_name === "reel");
  return all
    .sort((a, b) => ((b.like_count ?? 0) + (b.comment_count ?? 0)) - ((a.like_count ?? 0) + (a.comment_count ?? 0)))
    .slice(0, limit);
}

// Banned cliches — Claude must not use any of these in the output
const BANNED_PHRASES = [
  "I spent X hours so you don't have to",
  "I spent [number] hours/days so you don't have to",
  "Let me show you",
  "You won't believe",
  "Here's the thing",
  "Most people don't realize",
  "Stop scrolling",
  "Wait for it",
  "POV:",
  "Tell me you're a [X] without telling me",
  "Game changer",
  "Mind blown",
  "This will change everything",
  "Listen up",
  "Pay attention",
  "Watch this",
  "Trust me",
  "I'm going to show you",
];

const formatColors: Record<ScriptFormat, string> = {
  reel: "bg-primary/15 text-primary border-primary/20",
  album: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  post: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  story: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "ig-pc": "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "ig-raw": "bg-orange-500/15 text-orange-400 border-orange-500/20",
};

const formatLabels: Record<ScriptFormat, string> = {
  reel: "Reel",
  album: "Album",
  post: "Post",
  story: "Story",
  "ig-pc": "IG - PC",
  "ig-raw": "IG - iOS/Raw",
};

type DraftState = {
  id?: string;
  rawIdea: string;
  title: string;
  caption: string;
  script: string;
  notes: string;
  format: ScriptFormat;
};

const EMPTY_DRAFT: DraftState = {
  rawIdea: "",
  title: "",
  caption: "",
  script: "",
  notes: "",
  format: "reel",
};

export function ScriptsTab() {
  const { scripts, upsert, remove, mounted } = useScripts();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);

  async function handleRefreshKnowledge() {
    setRefreshing(true);
    setRefreshStatus("Scraping competitor reels...");
    try {
      // Phase 1: Scrape + filter + kick off transcription
      const res = await fetch("/api/scripts/refresh", { method: "POST" });
      const data = await res.json() as { transcribeRunId?: string; reelsScraped?: number; topCount?: number; error?: string };
      if (!res.ok || data.error) {
        setRefreshStatus(`Error: ${data.error}`);
        setRefreshing(false);
        return;
      }
      setRefreshStatus(`Scraped ${data.reelsScraped} reels. Transcribing top ${data.topCount}...`);

      // Phase 2: Poll transcription status
      const runId = data.transcribeRunId;
      if (!runId) {
        setRefreshStatus("No transcription run started");
        setRefreshing(false);
        return;
      }

      const pollInterval = 10_000;
      const maxPolls = 90; // 15 minutes max
      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, pollInterval));
        const statusRes = await fetch(`/api/scripts/refresh/status?runId=${runId}`);
        const statusData = await statusRes.json() as { status: string; transcribed?: number; stored?: number; totalInDb?: number; error?: string };

        if (statusData.status === "done") {
          setRefreshStatus(`Done! ${statusData.transcribed} transcribed, ${statusData.totalInDb} total scripts in knowledge bank.`);
          setRefreshing(false);
          return;
        }
        if (statusData.status === "failed") {
          setRefreshStatus(`Failed: ${statusData.error}`);
          setRefreshing(false);
          return;
        }
        // Still running
        setRefreshStatus(`Transcribing... (${Math.floor((i + 1) * pollInterval / 1000)}s)`);
      }
      setRefreshStatus("Transcription timed out. Check Apify dashboard.");
    } catch (err) {
      setRefreshStatus(`Error: ${String(err)}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleGenerate() {
    if (!draft.rawIdea.trim()) {
      setExpandError("Type your raw idea first.");
      return;
    }
    setGenerating(true);
    setExpandError(null);
    try {
      const refs = getTopReelReferences(15);
      const refBlock = refs.length === 0
        ? "(no reference reels available)"
        : refs
            .map((r, i) => {
              const engagement = ((r.like_count ?? 0) + (r.comment_count ?? 0)).toLocaleString();
              const text = (r.text ?? "").replace(/\s+/g, " ").slice(0, 300);
              return `${i + 1}. @${r.username} (${engagement} eng)\n"${text}"`;
            })
            .join("\n\n");

      const savedHooks = getSavedHooks()
        .sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0))
        .slice(0, 20);
      const hookBlock = savedHooks.length === 0
        ? "(none saved)"
        : savedHooks
            .map((h, i) => `${i + 1}. "${h.hook.replace(/\s+/g, " ")}" — @${h.username}`)
            .join("\n");

      const formatLabel = draft.format === "reel" ? "Reel" : draft.format.charAt(0).toUpperCase() + draft.format.slice(1);

      // Fetch real transcribed scripts from Supabase knowledge bank
      let realScripts = "";
      try {
        const kbRes = await fetch("/api/scripts/knowledge?limit=15");
        const kbData = await kbRes.json() as { scripts: Array<{ username: string; transcript: string; hook: string; hook_type: string; like_count: number; comment_count: number }> };
        if (kbData.scripts?.length > 0) {
          realScripts = kbData.scripts
            .map((s, i) => {
              const eng = (s.like_count + s.comment_count).toLocaleString();
              return `${i + 1}. @${s.username} [${s.hook_type}] (${eng} eng)\nHook: "${s.hook}"\nFull script: "${s.transcript?.slice(0, 500)}"`;
            })
            .join("\n\n");
        }
      } catch {
        // Knowledge bank not available yet — continue without
      }

      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate",
          context: draft.rawIdea,
          platform: "instagram",
          format: formatLabel,
          references: refBlock,
          hooks: hookBlock,
          hookPatterns: HOOK_PATTERNS,
          bannedPhrases: BANNED_PHRASES,
          scriptingKnowledge: SCRIPTING_KNOWLEDGE,
          realScripts,
        }),
      });
      const data = await res.json() as { title?: string; caption?: string; script?: string; error?: string };
      if (!res.ok || data.error) {
        setExpandError(data.error ?? `Error: ${res.status}`);
        return;
      }
      setDraft((d) => ({
        ...d,
        title: data.title || d.title,
        caption: data.caption || d.caption,
        script: data.script || d.script,
      }));
    } catch (err) {
      setExpandError(`Request failed: ${String(err)}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleAiExpand() {
    if (!draft.title.trim() && !draft.script.trim() && !draft.caption.trim()) {
      setExpandError("Add a title, caption, or script first so I have something to expand.");
      return;
    }
    setExpanding(true);
    setExpandError(null);
    try {
      // ── Source 1: Top reels (full text) for body/pacing reference ──
      const refs = getTopReelReferences(20);
      const refBlock = refs.length === 0
        ? "(no reference reels available)"
        : refs
            .map((r, i) => {
              const engagement = ((r.like_count ?? 0) + (r.comment_count ?? 0)).toLocaleString();
              const text = (r.text ?? "").replace(/\s+/g, " ").slice(0, 400);
              return `${i + 1}. @${r.username} (${engagement} engagement)\n"${text}"`;
            })
            .join("\n\n");

      // ── Source 2: Saved hooks from user's Hook Library ──
      const savedHooks = getSavedHooks()
        .sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0))
        .slice(0, 30);
      const hookBlock = savedHooks.length === 0
        ? "(no saved hooks — use the hook formulas below to invent ones grounded in the user's draft)"
        : savedHooks
            .map((h, i) => {
              const pat = h.pattern ? ` [${h.pattern}]` : "";
              return `${i + 1}.${pat} "${h.hook.replace(/\s+/g, " ")}" — @${h.username}, ${h.engagement.toLocaleString()} eng`;
            })
            .join("\n");

      // ── Source 3: Extract just the first lines of top reels as raw hook samples ──
      const topHookSamples = refs
        .slice(0, 12)
        .map((r) => (r.text ?? "").split("\n")[0].trim())
        .filter((s) => s.length > 6 && s.length < 200)
        .map((s, i) => `${i + 1}. "${s}"`)
        .join("\n");

      const formatLabel = draft.format === "reel" ? "Reel" : draft.format.charAt(0).toUpperCase() + draft.format.slice(1);

      const prompt = `You are a top 0.1% short-form video copywriter for Instagram ${formatLabel}s. You write for a creator (Lachy) whose voice is calm authority, grounded, INTJ — never hype, never cringe, never influencer-coded. He builds real automation systems (n8n, VPS, Claude Code, Docker, GHL) and shows the BACKEND, not surface-level demos.

═══════════════════════════════════════════════════════
PART 1 — REFERENCE LIBRARY (study, do not copy)
═══════════════════════════════════════════════════════

A) THE USER'S CURATED HOOK LIBRARY (${savedHooks.length} hooks the creator has already saved as great):
${hookBlock}

B) RAW TOP-ENGAGEMENT HOOKS (first lines of top-performing reels in this niche):
${topHookSamples || "(none)"}

C) FULL TOP-PERFORMING REELS (study pacing, sentence rhythm, body structure, CTAs):
${refBlock}

D) HOOK PATTERN VOCABULARY (the 7 patterns the creator uses):
${HOOK_PATTERNS.map((p, i) => `${i + 1}. ${p}`).join("\n")}

═══════════════════════════════════════════════════════
PART 2 — THE DRAFT YOU MUST EXPAND
═══════════════════════════════════════════════════════

Title:   ${draft.title || "(no title)"}
Caption: ${draft.caption || "(no caption)"}
Script:  ${draft.script || "(empty — build from title/caption)"}

═══════════════════════════════════════════════════════
PART 3 — STRICT REQUIREMENTS
═══════════════════════════════════════════════════════

KEEP THE TOPIC. Do not change Lachy's core idea. Make it sharper, not different.

HOOK RULES (most important — get this right or the whole script fails):
- Generate 3 alternative hooks first, each using a DIFFERENT pattern from Part 1D.
- Each hook is one sentence, max 12 words, written in quotes.
- Must contain at least one of: a specific number, a contrarian claim, a named tool, a specific outcome, or a tension/stakes line.
- Must work as a standalone scroll-stopper — readable in 1 second.
- NEVER use any of these banned cliches or paraphrases of them:
${BANNED_PHRASES.map((p) => `  ✗ ${p}`).join("\n")}
- Then pick the strongest of the 3 and use it as the final HOOK.

BODY RULES:
- 4-6 beats, each labeled with a timestamp (0:03-0:08, 0:08-0:13, etc.)
- Each beat = one specific, named, concrete action or claim. NO generic advice.
- Reference specific tools, file paths, exact numbers, named workflows when appropriate.
- Each beat sentence: 10-18 words. Punchy, declarative, no fluff.
- Show, don't list. Each beat should map to a real shot the creator can film (over-shoulder of screen, talking head, terminal close-up, etc.).
- Build tension or escalation across beats — don't just enumerate.

CTA RULES:
- 3-7 seconds max.
- Use one of: comment a specific keyword (uppercase, easy to type), DM a keyword, save this for later, follow for the breakdown.
- Must feel earned by the body, not bolted on.

VOICE GUARDRAILS:
- Calm, blunt, certain. No exclamation marks. No "literally". No "honestly". No "real talk".
- No emojis. No hashtags inside the script.
- British/Australian-leaning sensibility — understated.
- Speak like someone who doesn't need to convince you because they know it works.

═══════════════════════════════════════════════════════
OUTPUT FORMAT (return EXACTLY this — no preamble, no explanation)
═══════════════════════════════════════════════════════

HOOK OPTIONS:
A. [Pattern name] "..."
B. [Pattern name] "..."
C. [Pattern name] "..."

CHOSEN HOOK: [letter] — [one-line reasoning, max 15 words]

═══ FINAL SCRIPT ═══

HOOK (0-3s):
"<chosen hook>"

BODY:
0:03-0:08 — <beat 1>
0:08-0:13 — <beat 2>
0:13-0:18 — <beat 3>
0:18-0:23 — <beat 4>
0:23-0:28 — <beat 5 if needed>

CTA (0:28-0:33):
"<cta line>"

NOTES FOR FILMING:
- <2-3 short bullets on shot list / b-roll>
`;

      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "script", context: prompt, platform: "instagram" }),
      });
      const data = await res.json() as { script?: string; error?: string };
      if (!res.ok || data.error) {
        setExpandError(data.error ?? `Error: ${res.status}`);
        return;
      }
      const expanded = (data.script ?? "").trim();
      if (!expanded) {
        setExpandError("Claude returned an empty response. Try again.");
        return;
      }
      setDraft((d) => ({ ...d, script: expanded }));
    } catch (err) {
      setExpandError(`Request failed: ${String(err)}`);
    } finally {
      setExpanding(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return scripts;
    const q = search.toLowerCase();
    return scripts.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.caption.toLowerCase().includes(q) ||
        s.script.toLowerCase().includes(q)
    );
  }, [scripts, search]);

  function openNew() {
    setDraft(EMPTY_DRAFT);
    setDeleteConfirm(false);
    setExpandError(null);
    setOpen(true);
  }

  function openEdit(s: SavedScript) {
    setDraft({
      id: s.id,
      rawIdea: "",
      title: s.title,
      caption: s.caption,
      script: s.script,
      notes: s.notes || "",
      format: s.format,
    });
    setDeleteConfirm(false);
    setExpandError(null);
    setOpen(true);
  }

  function handleDialogChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset transient state on close
      setFullscreen(false);
      setExpanding(false);
      setExpandError(null);
      setDeleteConfirm(false);
    }
  }

  function handleSave() {
    if (!draft.title.trim()) return;
    const payload: ScriptDraft = {
      id: draft.id,
      title: draft.title.trim(),
      caption: draft.caption,
      script: draft.script,
      notes: draft.notes,
      format: draft.format,
    };
    const saved = upsert(payload);
    setJustSaved(saved.id);
    setTimeout(() => setJustSaved(null), 1500);
    setOpen(false);
    setDraft(EMPTY_DRAFT);
  }

  function handleDelete() {
    if (!draft.id) return;
    remove(draft.id);
    setOpen(false);
    setDeleteConfirm(false);
    setDraft(EMPTY_DRAFT);
  }

  function copyScript(s: SavedScript) {
    const text = `${s.title}\n\n${s.caption}\n\n${s.script}${s.notes ? `\n\nNOTES:\n${s.notes}` : ""}`;
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      {/* Refresh status */}
      {refreshStatus && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/50 border border-border text-xs">
          {refreshing && <RefreshCw size={12} className="animate-spin text-primary shrink-0" />}
          <span className={refreshing ? "text-muted-foreground" : "text-foreground"}>{refreshStatus}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Scripts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Save full scripts with title, caption, and body. Reference them from the board.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleRefreshKnowledge}
            disabled={refreshing}
            title="Scrape + transcribe top competitor reels into knowledge bank"
            className="h-8 text-xs px-3 bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 disabled:opacity-50"
          >
            <Database size={12} className={`mr-1.5 ${refreshing ? "animate-pulse" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh Knowledge"}
          </Button>
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search scripts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-input border-border text-xs h-8 pl-7 w-56"
            />
          </div>
          <Dialog open={open} onOpenChange={handleDialogChange}>
            <DialogTrigger
              onClick={openNew}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <PlusCircle size={14} />
              New Script
            </DialogTrigger>

            <DialogContent
              className={
                fullscreen
                  ? "bg-popover border-border !max-w-none w-[98vw] h-[96vh] overflow-y-auto"
                  : "bg-popover border-border w-full max-w-3xl mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto"
              }
            >
              <DialogHeader>
                <DialogTitle>{draft.id ? "Edit Script" : "New Script"}</DialogTitle>
              </DialogHeader>
              {/* Fullscreen toggle — positioned to the left of the built-in close X */}
              <button
                type="button"
                onClick={() => setFullscreen((f) => !f)}
                title={fullscreen ? "Exit full screen" : "Full screen"}
                className="absolute top-2 right-9 text-muted-foreground hover:text-primary transition-colors p-1 rounded"
              >
                {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>

              <div className="space-y-4 pt-2">
                {/* Raw idea → Generate all */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-primary">Raw Idea</label>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleGenerate}
                      disabled={generating || !draft.rawIdea.trim()}
                      className="h-7 text-[11px] px-3 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Wand2 size={11} className={`mr-1 ${generating ? "animate-pulse" : ""}`} />
                      {generating ? "Generating..." : "Generate Title + Caption + Script"}
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Dump your idea here in any form — a sentence, bullet points, voice-to-text ramble. Hit Generate and it fills everything below."
                    value={draft.rawIdea}
                    onChange={(e) => setDraft((d) => ({ ...d, rawIdea: e.target.value }))}
                    className="bg-input border-border text-sm resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Title</label>
                  <Input
                    placeholder="e.g. 3-step automation that books handyman jobs on autopilot"
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    className="bg-input border-border"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Caption</label>
                  <Textarea
                    placeholder="Final caption that ships with the post..."
                    value={draft.caption}
                    onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
                    className="bg-input border-border resize-none"
                    rows={4}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-muted-foreground">Full Script</label>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAiExpand}
                      disabled={expanding}
                      title="AI-expand this script using top-performing reel patterns"
                      className="h-7 text-[11px] px-2 bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 disabled:opacity-50"
                    >
                      <Sparkles size={11} className={`mr-1 ${expanding ? "animate-pulse" : ""}`} />
                      {expanding ? "Expanding..." : "AI Expand"}
                    </Button>
                  </div>
                  <ScriptEditor
                    value={draft.script}
                    onChange={(val) => setDraft((d) => ({ ...d, script: val }))}
                    fullscreen={fullscreen}
                    placeholder="HOOK:\n&quot;...&quot;\n\nTALKING POINTS:\n1. ...\n2. ...\n\nCTA:\n..."
                  />
                  <div className="flex items-center justify-end mt-1">
                    {expandError && (
                      <p className="text-[11px] text-destructive">{expandError}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Personal Notes</label>
                  <Textarea
                    placeholder="Your filming ideas, shot planning, what to show in each section, reminders..."
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    className="bg-input border-border border-dashed resize-none text-sm"
                    rows={4}
                  />
                </div>

                <div className="w-full sm:w-48">
                  <label className="text-xs text-muted-foreground mb-1.5 block">Format</label>
                  <Select
                    value={draft.format}
                    onValueChange={(v) => setDraft((d) => ({ ...d, format: v as ScriptFormat }))}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="reel">Reel</SelectItem>
                      <SelectItem value="ig-pc">IG - PC</SelectItem>
                      <SelectItem value="ig-raw">IG - iOS/Raw</SelectItem>
                      <SelectItem value="post">Post</SelectItem>
                      <SelectItem value="album">Album</SelectItem>
                      <SelectItem value="story">Story</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  {draft.id ? (
                    deleteConfirm ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-destructive">Delete this script?</span>
                        <Button size="sm" variant="destructive" onClick={handleDelete} className="h-7 text-xs px-2">
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteConfirm(false)}
                          className="h-7 text-xs px-2 border-border"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirm(true)}
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={12} className="mr-1" />
                        Delete
                      </Button>
                    )
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOpen(false)}
                      className="border-border h-7 text-xs px-3"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs px-3"
                      onClick={handleSave}
                      disabled={!draft.title.trim()}
                    >
                      {draft.id ? "Save changes" : "Save script"}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Empty state */}
      {scripts.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="py-14 flex flex-col items-center justify-center text-center gap-3">
            <FileText size={32} className="text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">No scripts yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Save full scripts here and reference them from the board when moving posts to Scripted.
              </p>
            </div>
            <Button
              onClick={openNew}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs px-3"
            >
              <PlusCircle size={12} className="mr-1" />
              Create first script
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const preview = s.script.split("\n").slice(0, 6).join("\n");
            const scriptLines = s.script.split("\n").length;
            const flash = justSaved === s.id;
            return (
              <Card
                key={s.id}
                onClick={() => openEdit(s)}
                className={`bg-card border-border cursor-pointer transition-all hover:border-primary/40 ${flash ? "ring-1 ring-primary/50" : ""}`}
              >
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Updated {new Date(s.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" · "}
                        {scriptLines} lines · {s.script.split(/\s+/).filter(Boolean).length} words
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${formatColors[s.format]}`}>
                        {formatLabels[s.format] || s.format}
                      </Badge>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyScript(s); }}
                        title="Copy full script"
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>

                  {s.caption && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{s.caption}</p>
                  )}

                  <pre className="text-[11px] font-mono text-foreground/70 whitespace-pre-wrap line-clamp-6 bg-secondary/30 rounded-md p-2 border border-border/50">
                    {preview || "(empty)"}
                  </pre>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
