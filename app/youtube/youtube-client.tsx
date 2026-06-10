'use client'

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CalendarDays,
  Check,
  Copy,
  CopyPlus,
} from "lucide-react";
import { DuplicateToDialog } from "@/components/duplicate-to-dialog";
import type { YouTubeVideo } from "@/lib/youtube-competitor-data";
import { YTScriptsTab } from "./scripts-tab";

type VideoFormat = "short" | "long" | "live";
type VideoStatus = "ideas" | "scripted" | "infographics" | "filming" | "published";

interface VideoCard {
  id: string;
  title: string;
  description: string;
  format: VideoFormat;
  status: VideoStatus;
  scheduledDate?: string;
  createdAt?: string;
  infographicCount?: number;
  // Published performance
  views?: number;
  likes?: number;
  comments?: number;
  url?: string;
  archived?: boolean;
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
  { key: "infographics", label: "Infographics" },
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
  const [editOpen, setEditOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [form, setForm] = useState({ ...video });

  function handleSave() {
    onUpdate(video.id, {
      title: form.title,
      description: form.description,
      format: form.format,
      scheduledDate: form.scheduledDate,
      url: form.url,
    });
    setEditOpen(false);
  }

  // Sync form when video prop changes (e.g. after drag)
  useEffect(() => {
    if (!editOpen) setForm({ ...video });
  }, [video, editOpen]);

  return (
    <Draggable draggableId={video.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
        >
          <Card
            className={cn(
              "bg-card border-border group cursor-pointer transition-all duration-150",
              video.scheduledDate && "ring-2 ring-orange-400",
              snapshot.isDragging && "opacity-80 shadow-lg ring-1 ring-primary/30 rotate-[0.5deg]"
            )}
            onClick={() => setEditOpen(true)}
          >
            <CardContent className="p-3 max-h-[200px] overflow-hidden">
              {/* Drag handle + title row */}
              <div className="flex items-start gap-2 mb-2">
                <div
                  {...provided.dragHandleProps}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing"
                >
                  <GripVertical
                    size={13}
                    className="text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors"
                  />
                </div>
                <p className="text-sm font-medium leading-snug flex-1 line-clamp-2">{video.title}</p>
              </div>

              {video.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2 ml-5">
                  {video.description}
                </p>
              )}

              <div className="flex items-center justify-between ml-5 mb-2">
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 h-4", formatColors[video.format])}
                  >
                    {video.format}
                  </Badge>
                  {video.infographicCount !== undefined && video.infographicCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0 h-4 inline-flex items-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
                      {video.infographicCount} diagrams
                    </span>
                  )}
                </div>
                {video.scheduledDate && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateShort(video.scheduledDate)}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center flex-wrap gap-1.5 ml-5" onClick={(e) => e.stopPropagation()}>
                {video.status === "published" && (
                  <LogResultsDialog video={video} onSave={(m) => onUpdate(video.id, m)} />
                )}
              </div>

              {/* Published metrics */}
              {video.status === "published" && video.views !== undefined && (
                <div className="ml-5 mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{video.views?.toLocaleString()} views</span>
                  {video.likes !== undefined && (
                    <span>{video.likes.toLocaleString()} likes</span>
                  )}
                  {video.comments !== undefined && (
                    <span>{video.comments} comments</span>
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
            </CardContent>
          </Card>

          {/* Edit Dialog */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-md bg-card border-border" onClick={(e) => e.stopPropagation()}>
              <DialogHeader>
                <DialogTitle className="text-sm">Edit Video</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-background border-border text-sm"
                />
                <Textarea
                  placeholder="Description / script notes"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className="bg-background border-border text-sm resize-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v as VideoFormat })}>
                    <SelectTrigger className="bg-background border-border text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short</SelectItem>
                      <SelectItem value="long">Long</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={form.scheduledDate || ""}
                    onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                    className="bg-background border-border text-sm h-9"
                  />
                </div>
                {video.status === "published" && (
                  <Input
                    placeholder="YouTube URL"
                    value={form.url || ""}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    className="bg-background border-border text-sm"
                  />
                )}
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground"
                    onClick={() => setDuplicateOpen(true)}
                  >
                    <CopyPlus size={12} className="mr-1" />
                    Duplicate to...
                  </Button>
                  <div className="flex items-center justify-between gap-2 flex-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("gap-1.5 text-xs", video.archived ? "text-orange-400" : "text-muted-foreground")}
                      onClick={() => {
                        onUpdate(video.id, { archived: !video.archived });
                        setEditOpen(false);
                      }}
                    >
                      {video.archived ? "Unarchive" : "Archive"}
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditOpen(false)} className="border-border">Cancel</Button>
                      <Button size="sm" onClick={handleSave}>Save</Button>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <DuplicateToDialog
            open={duplicateOpen}
            onOpenChange={setDuplicateOpen}
            text={video.title + (video.description ? "\n\n" + video.description : "")}
            currentBoard="youtube"
          />
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

// ─── Script Generator ─────────────────────────────────────────────────────────

type ContentPillar = "Authority" | "Tutorial" | "Behind the Scenes" | "Case Study";

interface ScriptResult {
  topic: string;
  format: VideoFormat;
  pillar: ContentPillar;
  script: string;
}

function ScriptGenerator({ onAddToBoard }: { onAddToBoard: (title: string, script: string, format: VideoFormat) => void }) {
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<VideoFormat>("long");
  const [pillar, setPillar] = useState<ContentPillar>("Authority");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true);
    setResult(null);

    const prompt = `You are a YouTube script architect. Generate a structured script outline for a ${format} video.

Topic: ${topic}
Content Pillar: ${pillar}
Format: ${format === "short" ? "YouTube Short (<60 seconds)" : format === "long" ? "Long-form YouTube video" : "Live stream"}

Output EXACTLY this format (no markdown headers, no bold, plain text only):

HOOK (word-for-word, 5-7 seconds):
"[Exact opening line the creator will say]"

SECTION 1: [Header] (~[X] seconds)
- bullet prompt
- bullet prompt
- bullet prompt

SECTION 2: [Header] (~[X] seconds)
- bullet prompt
- bullet prompt
- bullet prompt

SECTION 3: [Header] (~[X] seconds)
- bullet prompt
- bullet prompt

CTA (~15 seconds):
- bullet prompt
- bullet prompt

${format === "short" ? "For a Short: 3 sections max, total ~45 seconds of content." : "For long-form: 4-6 sections, natural chapter flow."}
Keep section bullet prompts concise — these are speaking cues, not full sentences.`;

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "youtube",
          competitorPosts: [],
          previousTitles: [],
          context: prompt,
          mode: "script",
        }),
      });

      if (res.ok) {
        const data = await res.json() as { ideas?: { scriptOutline?: string; title?: string }[]; script?: string; raw?: string };
        // Try to extract script from various response shapes
        const scriptText =
          data.script ??
          data.raw ??
          data.ideas?.[0]?.scriptOutline ??
          JSON.stringify(data, null, 2);
        setResult({ topic: topic.trim(), format, pillar, script: scriptText });
      } else {
        setResult({
          topic: topic.trim(),
          format,
          pillar,
          script: `HOOK (word-for-word, 5-7 seconds):\n"[Could not generate — check API connection]"\n\nSECTION 1: [Your first section] (~60 seconds)\n- Your main point\n- Supporting detail\n\nCTA (~15 seconds):\n- Subscribe for more\n- Comment your thoughts`,
        });
      }
    } catch {
      setResult({
        topic: topic.trim(),
        format,
        pillar,
        script: `HOOK (word-for-word, 5-7 seconds):\n"[Could not generate — check API connection]"\n\nCTA (~15 seconds):\n- Subscribe for more`,
      });
    } finally {
      setLoading(false);
    }
  }

  function copyScript() {
    if (!result?.script) return;
    navigator.clipboard.writeText(result.script).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function addToBoard() {
    if (!result) return;
    onAddToBoard(result.topic, result.script, result.format);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Generate Script Structure</CardTitle>
          <p className="text-xs text-muted-foreground">Hook (word-for-word) + bullet-prompt sections — you fill in the details live</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Video Topic / Title</label>
            <Input
              placeholder="e.g. I built an AI agent that runs my entire agency"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate()}
              className="bg-input border-border"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Format</label>
              <Select value={format} onValueChange={(v) => setFormat(v as VideoFormat)}>
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
              <label className="text-xs text-muted-foreground mb-1.5 block">Content Pillar</label>
              <Select value={pillar} onValueChange={(v) => setPillar(v as ContentPillar)}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="Authority">Authority</SelectItem>
                  <SelectItem value="Tutorial">Tutorial</SelectItem>
                  <SelectItem value="Behind the Scenes">Behind the Scenes</SelectItem>
                  <SelectItem value="Case Study">Case Study</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={generate}
            disabled={loading || !topic.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={14} className="mr-2" />
                Generate Script Structure
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-medium">{result.topic}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    result.format === "short" ? "bg-primary/10 text-primary border-primary/20" :
                    result.format === "long" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                    "bg-purple-500/10 text-purple-400 border-purple-500/20"
                  }`}>
                    {result.format}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{result.pillar}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={copyScript}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={addToBoard}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <PlusCircle size={12} />
                  Add to Board
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono bg-secondary/30 rounded-lg p-4 overflow-x-auto">
              {result.script}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Recent Competitor Videos ─────────────────────────────────────────────────

function RecentYTVideos() {
  const [collapsed, setCollapsed] = useState(true);
  const [videos, setRecentVideos] = useState<YouTubeVideo[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("yt-scraped-data");
      if (!raw) return;
      const all = JSON.parse(raw) as YouTubeVideo[];
      const sorted = [...all]
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 10);
      setRecentVideos(sorted);
    } catch { /* ignore */ }
  }, []);

  if (videos.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-border bg-card">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors rounded-lg"
      >
        <span className="text-sm font-medium text-muted-foreground">
          Recent Competitor Videos ({videos.length})
        </span>
        {collapsed
          ? <ChevronDown size={15} className="text-muted-foreground" />
          : <ChevronUp size={15} className="text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {videos.map((video, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
              {video.thumbnailUrl && (
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className="w-20 h-12 object-cover rounded-md shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium line-clamp-1 leading-snug">{video.title}</p>
                <p className="text-[10px] text-red-400 mt-0.5">{video.channelName}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span>{video.viewCount.toLocaleString()} views</span>
                  {video.publishedAt && (
                    <span>
                      {new Date(video.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              {video.url && (
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline shrink-0 mt-0.5"
                >
                  Watch
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tags Manager (IG-style pillar-based with AI generation) ─────────────────

const YT_TAGS_KEY = "content-os-youtube-tags-v2";

const DEFAULT_YT_TAG_SETS: Record<string, string[]> = {
  "AI Automation": [
    "ai automation", "n8n", "claude", "ai tools", "automation workflow",
    "no-code automation", "business automation", "ai agent", "workflow automation",
    "claude code",
  ],
  "Business & Agency": [
    "online business", "solopreneur", "agency", "digital marketing",
    "passive income", "entrepreneurship", "business systems", "make money online",
    "ai agency", "saas",
  ],
  "Tech & Development": [
    "coding", "developer tools", "ai coding", "python", "typescript",
    "docker", "vps", "api", "programming", "tech tutorial",
  ],
};

function TagsManager() {
  const [sets, setSets] = useState<Record<string, string[]>>(DEFAULT_YT_TAG_SETS);
  const [editingPillar, setEditingPillar] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(YT_TAGS_KEY);
      if (stored) setSets(JSON.parse(stored) as Record<string, string[]>);
    } catch { /* ignore */ }
  }, []);

  function saveSets(updated: Record<string, string[]>) {
    setSets(updated);
    try {
      localStorage.setItem(YT_TAGS_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
  }

  function startEdit(pillar: string) {
    setEditingPillar(pillar);
    setEditValue((sets[pillar] ?? []).join(", "));
  }

  function saveEdit(pillar: string) {
    const tags = editValue
      .split(/[\n,]+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    saveSets({ ...sets, [pillar]: tags });
    setEditingPillar(null);
  }

  async function copySet(pillar: string) {
    try {
      await navigator.clipboard.writeText((sets[pillar] ?? []).join(", "));
      setCopied(pillar);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  }

  async function copyAll() {
    const allTags = Object.values(sets).flat().join(", ");
    try {
      await navigator.clipboard.writeText(allTags);
      setCopied("all");
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  }

  async function generateForPillar(pillar: string) {
    setGenerating(pillar);
    setGenError(null);
    try {
      const res = await fetch("/api/hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillar,
          currentHashtags: sets[pillar],
          platform: "youtube",
        }),
      });
      const data = await res.json() as { hashtags?: string[]; error?: string };
      if (!res.ok || data.error) {
        setGenError(data.error ?? "Failed to generate tags");
      } else if (data.hashtags) {
        // Strip # prefix for YouTube tags
        const cleaned = data.hashtags.map((t: string) => t.replace(/^#/, "").toLowerCase());
        saveSets({ ...sets, [pillar]: cleaned });
      }
    } catch (err) {
      setGenError(String(err));
    } finally {
      setGenerating(null);
    }
  }

  const totalTags = Object.values(sets).flat().length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {totalTags} total tags across {Object.keys(sets).length} pillars
            {totalTags > 500 && (
              <span className="ml-2 text-yellow-500">YouTube allows up to 500 characters of tags</span>
            )}
          </p>
        </div>
        <button
          onClick={copyAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-secondary hover:bg-secondary/70 transition-colors"
        >
          {copied === "all" ? <Check size={12} /> : <Copy size={12} />}
          {copied === "all" ? "Copied All" : "Copy All"}
        </button>
      </div>

      {genError && (
        <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{genError}</p>
      )}

      {Object.entries(sets).map(([pillar, tags]) => (
        <div key={pillar} className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{pillar}</p>
              <p className="text-[11px] text-muted-foreground">{tags.length} tags</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => generateForPillar(pillar)}
                disabled={generating === pillar}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border border-primary/20 bg-primary/5 text-primary hover:bg-primary/15 transition-colors disabled:opacity-50"
              >
                {generating === pillar ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Sparkles size={11} />
                )}
                Generate
              </button>
              <button
                onClick={() => copySet(pillar)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border border-border bg-secondary hover:bg-secondary/70 transition-colors"
              >
                {copied === pillar ? <Check size={11} /> : <Copy size={11} />}
                {copied === pillar ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() => editingPillar === pillar ? saveEdit(pillar) : startEdit(pillar)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {editingPillar === pillar ? "Save" : "Edit"}
              </button>
            </div>
          </div>

          {editingPillar === pillar ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="bg-input border-border resize-none font-mono text-xs"
              rows={5}
              placeholder="Comma-separated tags"
            />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function YouTubeClient() {
  const [videos, setVideos] = useState<VideoCard[]>([]);
  const [mounted, setMounted] = useState(false);
  const [groupByDate, setGroupByDate] = useState(false);
  const [dateFilter, setDateFilter] = useState<"all" | "dated" | "undated" | "archived">("all");

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

  function sortByScheduled<T extends { scheduledDate?: string }>(items: T[]): T[] {
    if (!groupByDate) return items;
    const scheduled = items.filter((c) => c.scheduledDate);
    const unscheduled = items.filter((c) => !c.scheduledDate);
    return [...scheduled, ...unscheduled];
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;

    const srcCol = result.source.droppableId as VideoStatus;
    const dstCol = result.destination.droppableId as VideoStatus;
    const srcIdx = result.source.index;
    const dstIdx = result.destination.index;

    if (srcCol === dstCol && srcIdx === dstIdx) return;

    const colVideos = (col: VideoStatus) => sortByScheduled(videos.filter((v) => v.status === col));
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
      const colOrder: VideoStatus[] = ["ideas", "scripted", "infographics", "filming", "published"];
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

  function addScriptToBoard(title: string, script: string, format: VideoFormat) {
    const video: VideoCard = {
      id: generateId(),
      title,
      description: script,
      format,
      status: "ideas",
      createdAt: new Date().toISOString(),
    };
    persist([video, ...videos]);
  }

  return (
    <div className="p-4 md:p-6">
      <Tabs defaultValue="board">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="script-generator">Script Generator</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="script-guide">Script Guide</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-2">
              {(["all", "dated", "undated", "archived"] as const).map((f) => (
                <Button
                  key={f}
                  variant={dateFilter === f ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => setDateFilter(f)}
                >
                  {f === "all" ? "All" : f === "dated" ? "Has date" : f === "undated" ? "No date" : "Archived"}
                </Button>
              ))}
            </div>
            <Button
              variant={groupByDate ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setGroupByDate(!groupByDate)}
            >
              <CalendarDays size={13} />
              {groupByDate ? "Grouped" : "Group by date"}
            </Button>
            <AiIdeasPanel onUseIdea={useIdea} />
            <AddVideoDialog onAdd={addVideo} />
          </div>
        </div>

        {/* Board tab */}
        <TabsContent value="board">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {COLUMNS.map((col) => {
                const colVideos = sortByScheduled(
                  videos.filter((v) => v.status === col.key)
                    .filter((v) => {
                      if (dateFilter === "archived") return !!v.archived;
                      if (v.archived) return false;
                      if (dateFilter === "all") return true;
                      if (dateFilter === "dated") return !!v.scheduledDate;
                      return !v.scheduledDate;
                    })
                );
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

          {/* Recent Competitor Videos */}
          <RecentYTVideos />
        </TabsContent>

        {/* Scripts tab */}
        <TabsContent value="scripts">
          <YTScriptsTab />
        </TabsContent>

        {/* Script Generator tab */}
        <TabsContent value="script-generator">
          <ScriptGenerator onAddToBoard={addScriptToBoard} />
        </TabsContent>

        {/* Tags tab */}
        <TabsContent value="tags">
          <TagsManager />
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
