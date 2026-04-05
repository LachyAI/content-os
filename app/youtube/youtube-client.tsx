'use client'

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  PlusCircle,
  GripVertical,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  BarChart2,
  Check,
  Copy,
} from "lucide-react";

type VideoFormat = "short" | "long" | "live";
type VideoStatus = "ideas" | "scripted" | "filming" | "published";

interface VideoCard {
  id: string;
  title: string;
  description: string;
  format: VideoFormat;
  status: VideoStatus;
  scheduledDate?: string;
  createdAt?: string;
  // Published performance
  views?: number;
  likes?: number;
  comments?: number;
  url?: string;
}

interface VideoIdea {
  title: string;
  hook: string;
  format: VideoFormat;
  angle: string;
  why: string;
}

interface ClaudeIdea {
  title: string;
  hook: string;
  scriptOutline: string;
  format: VideoFormat;
  reasoning: string;
}

const STORAGE_KEY = "content-os-youtube-posts";

const COLUMNS: { key: VideoStatus; label: string }[] = [
  { key: "ideas", label: "Ideas" },
  { key: "scripted", label: "Scripted" },
  { key: "filming", label: "Filming" },
  { key: "published", label: "Published" },
];

const formatColors: Record<VideoFormat, string> = {
  short: "bg-primary/15 text-primary border-primary/20",
  long: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  live: "bg-purple-500/15 text-purple-400 border-purple-500/20",
};

const SAMPLE_VIDEOS: VideoCard[] = [
  {
    id: "yt-1",
    title: "I built an AI agent that runs my entire agency",
    description: "Full breakdown of the n8n + Claude workflow I use to handle client onboarding, follow-ups, and reporting — zero manual work.",
    format: "long",
    status: "ideas",
  },
  {
    id: "yt-2",
    title: "Claude Code in 60 seconds — the only AI coding tool you need",
    description: "Quick demo of Claude Code's most powerful features that nobody talks about.",
    format: "short",
    status: "scripted",
  },
  {
    id: "yt-3",
    title: "How I make $10k/month with AI automation (full walkthrough)",
    description: "The exact system, clients, and workflow behind my agency. No fluff.",
    format: "long",
    status: "ideas",
    scheduledDate: "2026-04-15",
  },
];

function generateId() {
  return `yt-${Math.random().toString(36).slice(2, 9)}`;
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Script Guide ─────────────────────────────────────────────────────────────

function ScriptGuide() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors rounded-lg"
      >
        <span className="text-sm font-medium">YouTube Script Reference</span>
        {collapsed ? <ChevronDown size={15} className="text-muted-foreground" /> : <ChevronUp size={15} className="text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-5">
          {/* Long-form structure */}
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Long-form Structure</p>
            <div className="space-y-1.5">
              {[
                { time: "0-5s", label: "Hook", desc: "Pattern interrupt — bold claim, question, or visual shock. Must stop scroll." },
                { time: "5-30s", label: "Setup", desc: "Why they should care. What they'll gain by watching to the end." },
                { time: "30s-8m", label: "Body", desc: "Value delivery. Teach the thing. Show don't tell. Use chapters." },
                { time: "Last 15s", label: "CTA", desc: "Subscribe + next video recommendation. Keep it one action." },
              ].map(({ time, label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="text-[10px] font-mono text-muted-foreground/60 w-12 shrink-0 mt-0.5">{time}</span>
                  <span className="text-xs font-medium w-14 shrink-0 text-primary">{label}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Short structure */}
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Short Structure (&lt;60s)</p>
            <div className="space-y-1.5">
              {[
                { time: "0-3s", label: "Hook", desc: "Hard cut in. No intro. State the payoff immediately." },
                { time: "3-45s", label: "Content", desc: "One idea. Dense. Fast. Every second earns the next." },
                { time: "45-60s", label: "CTA", desc: 'Quick subscribe nudge. "Follow for more X" works.' },
              ].map(({ time, label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="text-[10px] font-mono text-muted-foreground/60 w-12 shrink-0 mt-0.5">{time}</span>
                  <span className="text-xs font-medium w-14 shrink-0 text-primary">{label}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hook patterns */}
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Hook Patterns</p>
            <div className="space-y-1">
              {[
                "I built a system that {outcome} while I {action}",
                "Nobody talks about this {tool/method}",
                "How I {big outcome} in {short time}",
                "{Tool} just changed everything — here's what happened",
                "Stop using {X}. Use this instead.",
                "The {thing} that took me from 0 to {result}",
              ].map((h) => (
                <p key={h} className="text-xs text-muted-foreground font-mono bg-secondary/50 px-2 py-1 rounded">
                  {h}
                </p>
              ))}
            </div>
          </div>

          {/* Thumbnail formula */}
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Thumbnail Formula</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>3 elements: <span className="text-foreground">Face reaction</span> + <span className="text-foreground">Bold text (3-4 words)</span> + <span className="text-foreground">Visual contrast</span></p>
              <p>Text must be readable at 100px width</p>
              <p>High contrast, dark background preferred for tech content</p>
              <p>Test click-through: would YOU click this?</p>
            </div>
          </div>

          {/* Retention tactics */}
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Retention Tactics</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Open loop every 2 minutes ("coming up in a moment...")</p>
              <p>Cut dead air mercilessly — edit to 80% of original length</p>
              <p>B-roll or screen recording breaks up talking-head fatigue</p>
              <p>First 30 seconds decide 80% of your retention</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Log Results Dialog ───────────────────────────────────────────────────────

function LogResultsDialog({
  video,
  onSave,
}: {
  video: VideoCard;
  onSave: (metrics: Partial<VideoCard>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    views: video.views?.toString() ?? "",
    likes: video.likes?.toString() ?? "",
    comments: video.comments?.toString() ?? "",
    url: video.url ?? "",
  });

  function handleSave() {
    onSave({
      views: form.views ? parseInt(form.views, 10) : undefined,
      likes: form.likes ? parseInt(form.likes, 10) : undefined,
      comments: form.comments ? parseInt(form.comments, 10) : undefined,
      url: form.url || undefined,
    });
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/15 transition-colors"
      >
        <BarChart2 size={9} />
        Log Results
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-popover border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Log Results — {video.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Views</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.views}
                  onChange={(e) => setForm((f) => ({ ...f, views: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Likes</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.likes}
                  onChange={(e) => setForm((f) => ({ ...f, likes: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Comments</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.comments}
                  onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Video URL</label>
              <Input
                placeholder="https://youtube.com/watch?v=..."
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="border-border h-7 text-xs px-3">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs px-3"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── AI Ideas Panel ───────────────────────────────────────────────────────────

function AiIdeasPanel({ onUseIdea }: { onUseIdea: (idea: VideoIdea) => void }) {
  const [open, setOpen] = useState(false);
  const [claudeIdeas, setClaudeIdeas] = useState<ClaudeIdea[]>([]);
  const [fallbackIdeas, setFallbackIdeas] = useState<VideoIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [usingClaude, setUsingClaude] = useState(false);
  const [previousTitles, setPreviousTitles] = useState<string[]>([]);

  const STATIC_IDEAS: VideoIdea[] = [
    {
      title: "I automated my entire agency with Claude Code — here's the full stack",
      hook: "I built a system that runs my agency on autopilot. No team. Just Claude Code + n8n.",
      format: "long",
      angle: "Authority / Behind the Scenes",
      why: "Full-stack automation content is high-retention. Showing real infrastructure builds serious trust.",
    },
    {
      title: "Claude Code vs ChatGPT — the honest comparison",
      hook: "I've used both for 6 months straight. Here's what nobody tells you.",
      format: "long",
      angle: "Comparison / Controversy",
      why: "Tool comparison videos rank well and drive high CTR. 'Nobody tells you' framing creates urgency.",
    },
    {
      title: "n8n automation in 60 seconds",
      hook: "This n8n workflow replaced 3 hours of manual work. Watch me build it live.",
      format: "short",
      angle: "Quick Demo",
      why: "Shorts with a live build format outperform talking-head shorts in the tech niche.",
    },
    {
      title: "How I went from 0 to $10k/month in 90 days — AI agency model",
      hook: "The exact system, clients, and results from building an AI agency from zero.",
      format: "long",
      angle: "Journey / Results",
      why: "Journey + results content with specific numbers drives massive CTR and watch time.",
    },
    {
      title: "Stop building AI agents the hard way",
      hook: "Stop writing 500 lines of Python for every agent. There's a better way.",
      format: "short",
      angle: "Correction / Anti-pattern",
      why: "\"Stop doing X\" hooks have above-average retention in the dev/AI niche.",
    },
  ];

  async function generate() {
    setLoading(true);
    setClaudeIdeas([]);
    setFallbackIdeas([]);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "youtube",
          competitorPosts: [],
          previousTitles,
          context: "YouTube channel about AI automation, Claude Code, n8n, and agency business. Creator: Lachy, 29, Chiang Mai-based solopreneur.",
        }),
      });
      if (res.ok) {
        const data = await res.json() as { ideas: ClaudeIdea[] };
        const newIdeas = data.ideas ?? [];
        setClaudeIdeas(newIdeas);
        setUsingClaude(true);
        setPreviousTitles((prev) => [...prev, ...newIdeas.map((i) => i.title)]);
      } else {
        setUsingClaude(false);
        setFallbackIdeas(STATIC_IDEAS);
      }
    } catch {
      setUsingClaude(false);
      setFallbackIdeas(STATIC_IDEAS);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    if (claudeIdeas.length === 0 && fallbackIdeas.length === 0) generate();
  }

  function useClaudeIdea(idea: ClaudeIdea) {
    onUseIdea({
      title: idea.title,
      hook: idea.hook,
      format: idea.format ?? "long",
      angle: "",
      why: idea.reasoning,
    });
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        <Sparkles size={14} />
        AI Suggest
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-popover border-border max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <DialogTitle>YouTube Video Ideas</DialogTitle>
                {usingClaude && !loading && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    Claude
                  </span>
                )}
              </div>
              <button
                onClick={generate}
                disabled={loading}
                className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              >
                {loading ? "Generating..." : "Regenerate"}
              </button>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Generating ideas with Claude...
            </div>
          ) : usingClaude && claudeIdeas.length > 0 ? (
            <div className="space-y-3 pt-2">
              {claudeIdeas.map((idea, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <p className="text-sm font-medium leading-snug">{idea.title}</p>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Hook</p>
                    <p className="text-xs text-foreground/80 bg-secondary/50 rounded px-2 py-1.5 font-mono leading-relaxed">
                      &ldquo;{idea.hook}&rdquo;
                    </p>
                  </div>
                  {idea.scriptOutline && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Script outline</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{idea.scriptOutline}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {idea.format ?? "long"}
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{idea.reasoning}</p>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => useClaudeIdea(idea)}
                      className="px-3 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Use This
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {(fallbackIdeas.length > 0 ? fallbackIdeas : STATIC_IDEAS).map((idea, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-snug">{idea.title}</p>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0", formatColors[idea.format])}
                    >
                      {idea.format}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground bg-secondary/50 rounded px-2 py-1.5 font-mono leading-relaxed">
                    &ldquo;{idea.hook}&rdquo;
                  </p>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                      {idea.angle}
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{idea.why}</p>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => { onUseIdea(idea); setOpen(false); }}
                      className="px-3 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Use This
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Video Card Component ─────────────────────────────────────────────────────

function VideoCardItem({
  video,
  index,
  onUpdate,
  onDelete,
}: {
  video: VideoCard;
  index: number;
  onUpdate: (id: string, updates: Partial<VideoCard>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Draggable draggableId={video.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "rounded-lg border border-border bg-card p-3 space-y-2 cursor-pointer select-none transition-shadow",
            snapshot.isDragging && "shadow-lg ring-1 ring-primary/30 opacity-90"
          )}
          onClick={() => setExpanded((e) => !e)}
        >
          {/* Drag handle + title row */}
          <div className="flex items-start gap-2">
            <div
              {...provided.dragHandleProps}
              className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug truncate">{video.title}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", formatColors[video.format])}>
                  {video.format}
                </Badge>
                {video.scheduledDate && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateShort(video.scheduledDate)}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(video.id); }}
              className="text-muted-foreground/30 hover:text-destructive transition-colors shrink-0 mt-0.5"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {/* Published metrics */}
          {video.status === "published" && (video.views !== undefined || video.likes !== undefined) && (
            <div className="flex items-center gap-3 text-xs border-t border-border pt-2">
              {video.views !== undefined && (
                <span className="text-muted-foreground">{video.views.toLocaleString()} views</span>
              )}
              {video.likes !== undefined && (
                <span className="text-muted-foreground">{video.likes.toLocaleString()} likes</span>
              )}
              {video.url && (
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline ml-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  Watch
                </a>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {video.status === "published" && (
              <LogResultsDialog video={video} onSave={(m) => onUpdate(video.id, m)} />
            )}
          </div>

          {/* Expanded description */}
          {expanded && video.description && (
            <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-2">
              {video.description}
            </p>
          )}
        </div>
      )}
    </Draggable>
  );
}

// ─── Add Video Dialog ─────────────────────────────────────────────────────────

function AddVideoDialog({ onAdd }: { onAdd: (video: VideoCard) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    format: "long" as VideoFormat,
    scheduledDate: "",
  });

  function handleAdd() {
    if (!form.title.trim()) return;
    onAdd({
      id: generateId(),
      title: form.title.trim(),
      description: form.description.trim(),
      format: form.format,
      status: "ideas",
      scheduledDate: form.scheduledDate || undefined,
      createdAt: new Date().toISOString(),
    });
    setForm({ title: "", description: "", format: "long", scheduledDate: "" });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
        <PlusCircle size={14} />
        Add Video
      </DialogTrigger>
      <DialogContent className="bg-popover border-border max-w-md">
        <DialogHeader>
          <DialogTitle>Add Video Idea</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Title</label>
            <Input
              placeholder="Video title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="bg-input border-border"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Description (optional)</label>
            <Textarea
              placeholder="What's this video about?"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="bg-input border-border resize-none"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Format</label>
              <Select
                value={form.format}
                onValueChange={(v) => setForm((f) => ({ ...f, format: v as VideoFormat }))}
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
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Scheduled Date</label>
              <Input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!form.title.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function YouTubeClient() {
  const [videos, setVideos] = useState<VideoCard[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setVideos(stored ? (JSON.parse(stored) as VideoCard[]) : SAMPLE_VIDEOS);
    } catch {
      setVideos(SAMPLE_VIDEOS);
    }
    setMounted(true);
  }, []);

  function persist(updated: VideoCard[]) {
    setVideos(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
  }

  function addVideo(video: VideoCard) {
    persist([video, ...videos]);
  }

  function updateVideo(id: string, updates: Partial<VideoCard>) {
    persist(videos.map((v) => (v.id === id ? { ...v, ...updates } : v)));
  }

  function deleteVideo(id: string) {
    persist(videos.filter((v) => v.id !== id));
  }

  function useIdea(idea: VideoIdea) {
    const video: VideoCard = {
      id: generateId(),
      title: idea.title,
      description: idea.hook,
      format: idea.format,
      status: "ideas",
      createdAt: new Date().toISOString(),
    };
    persist([video, ...videos]);
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;

    const srcCol = result.source.droppableId as VideoStatus;
    const dstCol = result.destination.droppableId as VideoStatus;
    const srcIdx = result.source.index;
    const dstIdx = result.destination.index;

    if (srcCol === dstCol && srcIdx === dstIdx) return;

    const colVideos = (col: VideoStatus) => videos.filter((v) => v.status === col);
    const others = videos.filter((v) => v.status !== srcCol && v.status !== dstCol);

    if (srcCol === dstCol) {
      const items = [...colVideos(srcCol)];
      const [moved] = items.splice(srcIdx, 1);
      items.splice(dstIdx, 0, moved);
      persist([...others, ...items]);
    } else {
      const srcItems = [...colVideos(srcCol)];
      const dstItems = [...colVideos(dstCol)];
      const [moved] = srcItems.splice(srcIdx, 1);
      const updated = { ...moved, status: dstCol };
      dstItems.splice(dstIdx, 0, updated);
      const colOrder: VideoStatus[] = ["ideas", "scripted", "filming", "published"];
      const rebuild: VideoCard[] = [];
      for (const col of colOrder) {
        if (col === srcCol) rebuild.push(...srcItems);
        else if (col === dstCol) rebuild.push(...dstItems);
        else rebuild.push(...videos.filter((v) => v.status === col));
      }
      persist(rebuild);
    }
  }

  if (!mounted) return null;

  const counts = COLUMNS.reduce((acc, col) => {
    acc[col.key] = videos.filter((v) => v.status === col.key).length;
    return acc;
  }, {} as Record<VideoStatus, number>);

  return (
    <div className="p-4 md:p-6">
      <Tabs defaultValue="board">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="script-guide">Script Guide</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <AiIdeasPanel onUseIdea={useIdea} />
            <AddVideoDialog onAdd={addVideo} />
          </div>
        </div>

        {/* Board tab */}
        <TabsContent value="board">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {COLUMNS.map((col) => {
                const colVideos = videos.filter((v) => v.status === col.key);
                return (
                  <div key={col.key} className="flex flex-col gap-3">
                    {/* Column header */}
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {col.label}
                      </h3>
                      <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                        {counts[col.key]}
                      </span>
                    </div>

                    {/* Droppable column */}
                    <Droppable droppableId={col.key}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "flex flex-col gap-2 min-h-[200px] rounded-lg p-2 transition-colors",
                            snapshot.isDraggingOver
                              ? "bg-primary/5 border border-dashed border-primary/30"
                              : "bg-secondary/20 border border-transparent"
                          )}
                        >
                          {colVideos.map((video, index) => (
                            <VideoCardItem
                              key={video.id}
                              video={video}
                              index={index}
                              onUpdate={updateVideo}
                              onDelete={deleteVideo}
                            />
                          ))}
                          {provided.placeholder}
                          {colVideos.length === 0 && (
                            <p className="text-xs text-muted-foreground/40 text-center py-6">
                              Drop here
                            </p>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        </TabsContent>

        {/* Script Guide tab */}
        <TabsContent value="script-guide">
          <div className="max-w-2xl">
            <ScriptGuide />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
