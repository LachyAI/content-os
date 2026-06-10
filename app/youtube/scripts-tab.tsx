'use client'

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, FileText, LayoutGrid, Loader2, Maximize2, Minimize2, PlusCircle, Search, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useYTScripts, type YTSavedScript, type YTScriptFormat, type YTScriptDraft } from "@/lib/use-yt-scripts";
import { ScriptEditor } from "../instagram/script-editor";
import { SCRIPTING_KNOWLEDGE } from "@/lib/scripting-knowledge";

// ─── Infographic Plan ──────────────────────────────────────────────────────────

interface InfographicItem {
  title: string;
  section: string;
  layout: string;
  tool: "infographic-creator" | "excalidraw-diagram";
}

interface InfographicPlan {
  scriptId: string;
  items: InfographicItem[];
  createdAt: string;
}

const INFOGRAPHIC_PLANS_KEY = "content-os-yt-infographic-plans";

function loadPlans(): Record<string, InfographicPlan> {
  try {
    const raw = localStorage.getItem(INFOGRAPHIC_PLANS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, InfographicPlan>) : {};
  } catch { return {}; }
}

function savePlan(plan: InfographicPlan) {
  const plans = loadPlans();
  plans[plan.scriptId] = plan;
  try { localStorage.setItem(INFOGRAPHIC_PLANS_KEY, JSON.stringify(plans)); } catch {}
}

// ─── Banned Phrases ────────────────────────────────────────────────────────────

const BANNED_PHRASES = [
  "I spent X hours so you don't have to",
  "Let me show you",
  "You won't believe",
  "Here's the thing",
  "Most people don't realize",
  "Stop scrolling",
  "Wait for it",
  "Game changer",
  "Mind blown",
  "This will change everything",
  "Listen up",
  "Pay attention",
  "Watch this",
  "Trust me",
  "I'm going to show you",
  "Smash that like button",
  "Don't forget to subscribe",
];

const formatColors: Record<YTScriptFormat, string> = {
  short: "bg-primary/15 text-primary border-primary/20",
  long: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  live: "bg-purple-500/15 text-purple-400 border-purple-500/20",
};

const formatLabels: Record<YTScriptFormat, string> = {
  short: "Short",
  long: "Long-form",
  live: "Live",
};

type DraftState = {
  id?: string;
  rawIdea: string;
  title: string;
  caption: string;
  script: string;
  notes: string;
  format: YTScriptFormat;
};

const EMPTY_DRAFT: DraftState = {
  rawIdea: "",
  title: "",
  caption: "",
  script: "",
  notes: "",
  format: "long",
};

export function YTScriptsTab() {
  const { scripts, upsert, remove, mounted } = useYTScripts();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [plans, setPlans] = useState<Record<string, InfographicPlan>>({});
  const [generatingPlan, setGeneratingPlan] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  // Load plans on mount
  useState(() => { setPlans(loadPlans()); });

  async function handleGeneratePlan(script: YTSavedScript) {
    if (!script.script.trim()) {
      setPlanError("Script is empty — write or generate a script first.");
      return;
    }
    setGeneratingPlan(script.id);
    setPlanError(null);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "script",
          platform: "youtube",
          context: `You are a visual content planner for YouTube videos. Given a video script, create an infographic plan.

The creator uses two tools:
1. "infographic-creator" — for polished explainers: comparisons, step-by-step processes, lists, timelines, checklists
2. "excalidraw-diagram" — for technical diagrams: system architecture, data flows, pipelines, concept maps, fan-out diagrams

SCRIPT:
${script.script}

Generate 5-10 infographic items. Each item should cover a specific section of the script that benefits from a visual.

Return ONLY a JSON array (no markdown, no explanation) with this exact format:
[
  {
    "title": "Short descriptive title for this visual",
    "section": "Which part of the script this covers",
    "layout": "Detailed layout description: what elements to show, visual hierarchy, arrangement",
    "tool": "infographic-creator" or "excalidraw-diagram"
  }
]

Rules:
- 5-10 items minimum
- Every major concept or section should have a visual
- Use infographic-creator for polished/marketing-style visuals
- Use excalidraw-diagram for technical architecture/flow visuals
- Layout descriptions should be specific enough to build from (mention exact elements, positions, groupings)
- Return ONLY the JSON array, nothing else`,
        }),
      });
      const data = await res.json() as { script?: string; error?: string };
      if (!res.ok || data.error) {
        setPlanError(data.error ?? `Error: ${res.status}`);
        return;
      }
      const raw = (data.script ?? "").trim();
      // Parse JSON from response (strip any markdown fences)
      const jsonStr = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      const items = JSON.parse(jsonStr) as InfographicItem[];
      if (!Array.isArray(items) || items.length === 0) {
        setPlanError("No infographic items returned. Try again.");
        return;
      }
      const plan: InfographicPlan = {
        scriptId: script.id,
        items,
        createdAt: new Date().toISOString(),
      };
      savePlan(plan);
      setPlans((prev) => ({ ...prev, [script.id]: plan }));
    } catch (err) {
      setPlanError(`Failed: ${String(err)}`);
    } finally {
      setGeneratingPlan(null);
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
      const formatLabel = formatLabels[draft.format];

      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate",
          context: draft.rawIdea,
          platform: "youtube",
          format: formatLabel,
          references: "(YouTube — no IG references)",
          hooks: "(none saved)",
          hookPatterns: [],
          bannedPhrases: BANNED_PHRASES,
          scriptingKnowledge: SCRIPTING_KNOWLEDGE,
          realScripts: "",
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
      const formatLabel = formatLabels[draft.format];
      const isShort = draft.format === "short";

      const prompt = `You are a top 0.1% YouTube script writer. You write for a creator (Lachy) whose voice is calm authority, grounded, INTJ — never hype, never cringe, never influencer-coded. He builds real automation systems (n8n, VPS, Claude Code, Docker, GHL) and shows the BACKEND, not surface-level demos.

Format: YouTube ${formatLabel}

═══════════════════════════════════════════════════════
THE DRAFT YOU MUST EXPAND
═══════════════════════════════════════════════════════

Title:   ${draft.title || "(no title)"}
Description: ${draft.caption || "(no description)"}
Script:  ${draft.script || "(empty — build from title/description)"}

═══════════════════════════════════════════════════════
STRICT REQUIREMENTS
═══════════════════════════════════════════════════════

KEEP THE TOPIC. Do not change the core idea. Make it sharper, not different.

HOOK RULES:
- Generate 3 alternative hooks, each using a different approach (question, bold claim, pattern interrupt).
- Each hook is one sentence, max 15 words.
- Must contain at least one of: a specific number, a contrarian claim, a named tool, a specific outcome, or tension.
- Must work as a standalone scroll-stopper.
- NEVER use any of these banned cliches:
${BANNED_PHRASES.map((p) => `  ✗ ${p}`).join("\n")}
- Pick the strongest and use it as the final HOOK.

${isShort ? `SHORT FORMAT (under 60s):
- HOOK: 0-3s — hard cut in, no intro
- BODY: 3-45s — 3-4 beats, each 8-12s, one concrete point per beat
- CTA: 45-60s — quick subscribe/follow nudge` : `LONG-FORM STRUCTURE:
- HOOK (0-5s): Pattern interrupt — bold claim, question, or visual shock
- SETUP (5-30s): Why they should care. What they gain by watching to the end
- BODY: 4-6 sections with headers, each with 2-4 bullet prompts (speaking cues, not full sentences)
- Each section should have a timestamp estimate
- CTA (last 15s): Subscribe + next video recommendation. One action.`}

VOICE GUARDRAILS:
- Calm, blunt, certain. No exclamation marks. No "literally". No "honestly".
- No emojis inside the script.
- Speak like someone who doesn't need to convince you because they know it works.

═══════════════════════════════════════════════════════
OUTPUT FORMAT (return EXACTLY this — no preamble, no explanation)
═══════════════════════════════════════════════════════

HOOK OPTIONS:
A. [Approach] "..."
B. [Approach] "..."
C. [Approach] "..."

CHOSEN HOOK: [letter] — [one-line reasoning, max 15 words]

═══ FINAL SCRIPT ═══

HOOK (0-${isShort ? "3" : "5"}s):
"<chosen hook>"

${isShort ? `BODY:
0:03-0:12 — <beat 1>
0:12-0:22 — <beat 2>
0:22-0:35 — <beat 3>
0:35-0:45 — <beat 4 if needed>

CTA (0:45-0:60):
"<cta line>"` : `SETUP (0:05-0:30):
"<setup paragraph>"

SECTION 1: [Header] (~Xm)
- bullet prompt
- bullet prompt
- bullet prompt

SECTION 2: [Header] (~Xm)
- bullet prompt
- bullet prompt
- bullet prompt

SECTION 3: [Header] (~Xm)
- bullet prompt
- bullet prompt

SECTION 4: [Header] (~Xm)
- bullet prompt
- bullet prompt

CTA (~15s):
"<cta line>"`}

NOTES FOR FILMING:
- <2-3 short bullets on shot list / b-roll>
`;

      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "script", context: prompt, platform: "youtube" }),
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

  function openEdit(s: YTSavedScript) {
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
      setFullscreen(false);
      setExpanding(false);
      setExpandError(null);
      setDeleteConfirm(false);
    }
  }

  function handleSave() {
    if (!draft.title.trim()) return;
    const payload: YTScriptDraft = {
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

  function copyScript(s: YTSavedScript) {
    const text = `${s.title}\n\n${s.caption}\n\n${s.script}${s.notes ? `\n\nNOTES:\n${s.notes}` : ""}`;
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Scripts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Save full scripts with title, description, and body. Reference them from the board.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                      {generating ? "Generating..." : "Generate Title + Description + Script"}
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
                    placeholder="e.g. I built an AI agent that runs my entire agency"
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    className="bg-input border-border"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Description</label>
                  <Textarea
                    placeholder="Video description that ships with the upload..."
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
                      title="AI-expand this script with structured sections"
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
                    placeholder="HOOK:\n&quot;...&quot;\n\nSECTION 1:\n- ...\n\nCTA:\n..."
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
                    placeholder="Filming ideas, shot planning, b-roll notes, thumbnail concepts..."
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
                    onValueChange={(v) => setDraft((d) => ({ ...d, format: v as YTScriptFormat }))}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="short">Short (&lt;60s)</SelectItem>
                      <SelectItem value="long">Long-form</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
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

      {/* Plan error */}
      {planError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          {planError}
          <button onClick={() => setPlanError(null)} className="ml-auto text-destructive/60 hover:text-destructive">dismiss</button>
        </div>
      )}

      {/* Empty state */}
      {scripts.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="py-14 flex flex-col items-center justify-center text-center gap-3">
            <FileText size={32} className="text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">No scripts yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Save full scripts here and reference them from the board when moving videos to Scripted.
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

                  {/* Infographic Plan */}
                  <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleGeneratePlan(s)}
                      disabled={generatingPlan === s.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/15 transition-colors disabled:opacity-50"
                    >
                      {generatingPlan === s.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <LayoutGrid size={10} />
                      )}
                      {generatingPlan === s.id ? "Planning..." : plans[s.id] ? `${plans[s.id].items.length} Infographics` : "Generate Plan"}
                    </button>
                  </div>

                  {plans[s.id] && (
                    <div className="space-y-1 pt-1 border-t border-border/50">
                      {plans[s.id].items.slice(0, 4).map((item, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[10px]">
                          <span className="text-muted-foreground/50 shrink-0">{i + 1}.</span>
                          <span className="text-muted-foreground truncate">{item.title}</span>
                          <span className={`shrink-0 px-1 rounded ${item.tool === "excalidraw-diagram" ? "bg-purple-500/10 text-purple-400" : "bg-cyan-500/10 text-cyan-400"}`}>
                            {item.tool === "excalidraw-diagram" ? "excalidraw" : "infographic"}
                          </span>
                        </div>
                      ))}
                      {plans[s.id].items.length > 4 && (
                        <p className="text-[10px] text-muted-foreground/40">+{plans[s.id].items.length - 4} more</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
