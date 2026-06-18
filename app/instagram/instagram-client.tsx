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
import { notifyScheduled } from "@/lib/notify-scheduled";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScriptsTab } from "./scripts-tab";
import { useScripts } from "@/lib/use-scripts";
import { cn } from "@/lib/utils";
import {
  PlusCircle,
  GripVertical,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Loader2,
  BarChart2,
  Share2,
  CopyPlus,
  CalendarDays,
} from "lucide-react";
import { DuplicateToDialog } from "@/components/duplicate-to-dialog";
import { getAllPosts } from "@/lib/competitor-data";
import type { Post } from "@/lib/competitor-data";
import { getSavedHooks } from "@/lib/hook-patterns";

type Format = "reel" | "post" | "album" | "story" | "ig-pc" | "ig-raw";
type Status = "ideas" | "scripted" | "filming" | "posted";
// Supabase DB uses singular 'idea', UI uses 'ideas' — map at the boundary
type DbStatus = "idea" | "scripted" | "filming" | "posted";

interface PostCard {
  id: string;
  title: string;
  caption: string;
  format: Format;
  status: Status;
  scheduledDate?: string;
  createdAt?: string;
  // Link to a SavedScript (localStorage in useScripts)
  scriptId?: string;
  // Performance tracking
  actual_likes?: number;
  actual_comments?: number;
  actual_saves?: number;
  actual_shares?: number;
  post_url?: string;
  performance_notes?: string;
  archived?: boolean;
}

interface VideoIdea {
  title: string;
  hook: string;
  format: Format;
  pillar: string;
  why: string;
}

const STORAGE_KEY = "content-os-instagram-posts";
const HASHTAG_STORAGE_KEY = "ig-hashtag-sets";

const COLUMNS: { key: Status; label: string }[] = [
  { key: "ideas", label: "Ideas" },
  { key: "scripted", label: "Scripted" },
  { key: "filming", label: "Filming" },
  { key: "posted", label: "Posted" },
];

const formatColors: Record<Format, string> = {
  reel: "bg-primary/15 text-primary border-primary/20",
  album: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  post: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  story: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "ig-pc": "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "ig-raw": "bg-orange-500/15 text-orange-400 border-orange-500/20",
};

const formatLabels: Record<Format, string> = {
  reel: "Reel",
  album: "Album",
  post: "Post",
  story: "Story",
  "ig-pc": "IG - PC",
  "ig-raw": "IG - iOS/Raw",
};

const SAMPLE_POSTS: PostCard[] = [
  {
    id: "1",
    title: "AI automation for handymen",
    caption:
      "Most handymen lose jobs because they don't follow up fast enough. Here's the 3-message sequence I built that books jobs on autopilot...",
    format: "reel",
    status: "ideas",
  },
  {
    id: "2",
    title: "GHL workflow walkthrough",
    caption:
      "Full behind-the-scenes of the GoHighLevel workflow that handles missed calls, texts the lead, and books the appointment — no human needed.",
    format: "reel",
    status: "scripted",
  },
  {
    id: "3",
    title: "Why most agency offers fail",
    caption:
      "The guarantee is wrong. Not the service. Here's what changed when we flipped it to 10 booked jobs or free...",
    format: "post",
    status: "ideas",
    scheduledDate: "2026-04-01",
  },
  {
    id: "4",
    title: "Local biz AI stack breakdown",
    caption:
      "6 tools. $0 extra cost for the client. This is the full automation stack I install for every handyman I onboard.",
    format: "album",
    status: "filming",
  },
];

// Map UI status → DB status
function toDbStatus(status: Status): DbStatus {
  return status === "ideas" ? "idea" : status;
}

// Map DB status → UI status
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
    actual_likes: row.actual_likes as number | undefined,
    actual_comments: row.actual_comments as number | undefined,
    actual_saves: row.actual_saves as number | undefined,
    actual_shares: row.actual_shares as number | undefined,
    post_url: row.post_url as string | undefined,
    performance_notes: row.performance_notes as string | undefined,
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

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── AI Idea Generation ───────────────────────────────────────────────────────

const PILLARS = [
  { name: "Authority", description: "AI demos, automations, breakdowns" },
  { name: "Discipline & Lifestyle", description: "Gym, deep work, Chiang Mai life" },
  { name: "Social & Magnetism", description: "Quiet confidence, clean aesthetic" },
];

interface ClaudeIdea {
  title: string;
  hook: string;
  scriptOutline: string;
  pillar: string;
  reasoning: string;
}

const HOOK_PATTERNS = [
  'I built a system that {outcome} while I {action}',
  'Claude Code just {bold claim}',
  'Comment {WORD} for {free thing}',
  "You're probably using {tool} wrong",
  'Stop {mistake}. Do this instead.',
  '{Tool} + {Tool} = {surprising result}',
  'How I {outcome} in {short time}',
  'Most {audience} don\'t know this exists',
];

function generateVideoIdeas(competitorPosts: Post[]): VideoIdea[] {
  if (competitorPosts.length === 0) {
    return [
      {
        title: "I built a cron job that runs Claude while I sleep",
        hook: "I built a system that processes my emails while I sleep — using Claude Code + VPS cron jobs.",
        format: "reel",
        pillar: "Authority",
        why: "System-building content performs well in the AI automation niche. Showing real infrastructure builds credibility.",
      },
      {
        title: "Stop using ChatGPT for this. Use Claude Code instead.",
        hook: "Stop using ChatGPT for coding. This is what Claude Code does that nothing else can.",
        format: "reel",
        pillar: "Authority",
        why: "Comparison hooks drive high engagement. Direct tool replacement content resonates strongly.",
      },
      {
        title: "Comment 'SYSTEM' for my full automation stack",
        hook: "Comment SYSTEM and I'll send you the exact automation stack I use to run my agency on autopilot.",
        format: "post",
        pillar: "Authority",
        why: "Comment CTAs are one of the highest-engagement tactics. Lead generation and algorithm boost simultaneously.",
      },
      {
        title: "Deep work morning in Chiang Mai",
        hook: "6am in Chiang Mai. Coffee, Claude Code, and 4 hours of uninterrupted building.",
        format: "reel",
        pillar: "Discipline & Lifestyle",
        why: "Lifestyle content humanises the authority posts. Location + routine content builds parasocial connection.",
      },
      {
        title: "n8n + Claude = AI employee that costs $20/month",
        hook: "n8n + Claude = an AI employee that handles your client follow-ups for $20/month.",
        format: "reel",
        pillar: "Authority",
        why: "Tool combination content with a specific cost claim drives saves and shares.",
      },
    ];
  }

  const topPosts = [...competitorPosts]
    .sort((a, b) => (b.like_count + b.comment_count) - (a.like_count + a.comment_count))
    .slice(0, Math.ceil(competitorPosts.length * 0.2));

  const wordFreq = new Map<string, number>();
  const stopWords = new Set(["the","a","an","is","are","was","were","to","of","in","for","on","with","at","by","and","or","it","this","that","you","i","my","me","we","our","your","do","get","can","will","not","just","have","be","but","if","so","as","how","what","when","where","why","who","use","using","make","way","know","like","all","more","also","one","up","out","no","about","into"]);
  for (const post of topPosts) {
    const words = post.text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
    for (const w of words) wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
  }
  const topTopics = Array.from(wordFreq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);

  const hasCommentCta = topPosts.filter(p => /comment\s+\w+/i.test(p.text)).length;
  const ctaRate = topPosts.length > 0 ? hasCommentCta / topPosts.length : 0;

  const formatCounts: Record<string, number> = {};
  for (const p of topPosts) formatCounts[p.media_name] = (formatCounts[p.media_name] ?? 0) + 1;
  const topFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "reel";

  const ideas: VideoIdea[] = [];

  const topic1 = topTopics[0] ?? "automation";
  ideas.push({
    title: `How I use ${topic1} to get clients without cold outreach`,
    hook: `I built a system that gets handyman clients using ${topic1} — without a single cold call.`,
    format: topFormat as Format,
    pillar: "Authority",
    why: `"${topic1}" is the #1 keyword in your top competitors' highest-performing posts.`,
  });

  const topic2 = topTopics[1] ?? "workflow";
  if (ctaRate > 0.15) {
    ideas.push({
      title: `Comment 'AI' for my ${topic2} setup`,
      hook: `Comment AI and I'll send you the exact ${topic2} setup I use to automate my agency.`,
      format: "post",
      pillar: "Authority",
      why: `${Math.round(ctaRate * 100)}% of top-performing competitor posts use a "Comment X" CTA.`,
    });
  } else {
    ideas.push({
      title: `The ${topic2} mistake that's costing you leads`,
      hook: `You're probably setting up your ${topic2} wrong. Here's the fix that doubled my response rate.`,
      format: "reel",
      pillar: "Authority",
      why: `"You're probably doing X wrong" hooks outperform most alternatives.`,
    });
  }

  ideas.push({
    title: "4am deep work session — Chiang Mai",
    hook: "4am in Chiang Mai. This is what 3 hours of deep work looks like when you build AI systems for a living.",
    format: "reel",
    pillar: "Discipline & Lifestyle",
    why: "Lifestyle + location content anchors your identity beyond tools.",
  });

  const topic3 = topTopics[2] ?? "claude";
  ideas.push({
    title: `Claude Code + ${topic3} = my entire agency backend`,
    hook: `Claude Code + ${topic3} = the entire backend of my agency. Here's what that looks like.`,
    format: "reel",
    pillar: "Authority",
    why: `Tool combination posts with "=" hooks drive saves.`,
  });

  ideas.push({
    title: "Why I don't post my revenue (and what I post instead)",
    hook: "Everyone's posting revenue screenshots. I post systems. Here's why that's converting better.",
    format: "post",
    pillar: "Social & Magnetism",
    why: "Counter-narrative content outperforms trend-following.",
  });

  return ideas;
}

// ─── Script Guide Component ───────────────────────────────────────────────────

function ScriptGuide() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors rounded-lg"
      >
        <span className="text-sm font-medium">Script Reference</span>
        {collapsed ? <ChevronDown size={15} className="text-muted-foreground" /> : <ChevronUp size={15} className="text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-5">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Reel Structure (under 30s)</p>
            <div className="space-y-1.5">
              {[
                { time: "0-3s", label: "Hook", desc: "Bold claim or tension — must stop scroll" },
                { time: "3-10s", label: "Setup", desc: "What problem / what you'll show" },
                { time: "10-25s", label: "Demo", desc: "The actual tool / insight / moment" },
                { time: "25-30s", label: "Landing", desc: "What it means + CTA" },
              ].map(({ time, label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="text-[10px] font-mono text-muted-foreground/60 w-12 shrink-0 mt-0.5">{time}</span>
                  <span className="text-xs font-medium w-12 shrink-0 text-primary">{label}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Hook Formulas</p>
            <div className="space-y-1">
              {HOOK_PATTERNS.map((h) => (
                <p key={h} className="text-xs text-muted-foreground font-mono bg-secondary/50 px-2 py-1 rounded">
                  {h}
                </p>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Caption Structure</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><span className="text-foreground font-medium">Line 1:</span> Hook (must stop scroll alone)</p>
              <p><span className="text-foreground font-medium">Lines 2-5:</span> The message / story</p>
              <p><span className="text-foreground font-medium">Last line:</span> CTA (DM me AI / Follow for breakdown / Save this)</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">CTA Patterns</p>
            <div className="space-y-1">
              {[
                { cta: 'Comment [WORD]', why: 'drives comments, 20% of top posts use this' },
                { cta: 'DM me [WORD]', why: 'generates leads' },
                { cta: 'Follow for the breakdown', why: 'drives follows' },
                { cta: 'Save this', why: 'boosts saves / algorithm' },
              ].map(({ cta, why }) => (
                <div key={cta} className="flex items-start gap-2 text-xs">
                  <span className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px] shrink-0">{cta}</span>
                  <span className="text-muted-foreground">{why}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Filming Tips</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Front camera for talking, flip to show screen</p>
              <p>Under 30 seconds — hook in first 2 seconds</p>
              <p>No fancy transitions — just you + your screen</p>
              <p>Text overlay CTA at the end</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Caption Generator Dialog ─────────────────────────────────────────────────

function CaptionDialog({
  post,
  onSave,
}: {
  post: PostCard;
  onSave: (caption: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: post.title,
          format: post.format,
          pillar: PILLARS.find((p) => post.caption?.toLowerCase().includes(p.name.toLowerCase()))?.name,
        }),
      });
      const data = await res.json() as { caption?: string; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to generate caption");
      } else {
        setCaption(data.caption ?? "");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    if (!caption) generate();
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function handleSave() {
    onSave(caption);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); handleOpen(); }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-primary/20 bg-primary/5 text-primary hover:bg-primary/15 transition-colors"
      >
        <Sparkles size={9} />
        Write Caption
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-popover border-border max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-sm">Caption — {post.title}</DialogTitle>
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
            <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Writing caption...
            </div>
          ) : error ? (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          ) : (
            <div className="space-y-3 pt-1">
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="bg-input border-border resize-none font-mono text-xs leading-relaxed"
                rows={14}
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {caption.length} / 2200 chars
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    className="border-border h-7 text-xs px-3 gap-1.5"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!caption}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs px-3"
                  >
                    Save to Post
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Log Results Dialog ───────────────────────────────────────────────────────

function LogResultsDialog({
  post,
  onSave,
}: {
  post: PostCard;
  onSave: (metrics: Partial<PostCard>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    actual_likes: post.actual_likes?.toString() ?? "",
    actual_comments: post.actual_comments?.toString() ?? "",
    actual_saves: post.actual_saves?.toString() ?? "",
    actual_shares: post.actual_shares?.toString() ?? "",
    post_url: post.post_url ?? "",
    performance_notes: post.performance_notes ?? "",
  });

  function handleSave() {
    onSave({
      actual_likes: form.actual_likes ? parseInt(form.actual_likes, 10) : undefined,
      actual_comments: form.actual_comments ? parseInt(form.actual_comments, 10) : undefined,
      actual_saves: form.actual_saves ? parseInt(form.actual_saves, 10) : undefined,
      actual_shares: form.actual_shares ? parseInt(form.actual_shares, 10) : undefined,
      post_url: form.post_url || undefined,
      performance_notes: form.performance_notes || undefined,
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
            <DialogTitle className="text-sm">Log Results — {post.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Likes</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.actual_likes}
                  onChange={(e) => setForm((f) => ({ ...f, actual_likes: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Comments</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.actual_comments}
                  onChange={(e) => setForm((f) => ({ ...f, actual_comments: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Saves (optional)</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.actual_saves}
                  onChange={(e) => setForm((f) => ({ ...f, actual_saves: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Shares (optional)</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.actual_shares}
                  onChange={(e) => setForm((f) => ({ ...f, actual_shares: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Post URL</label>
              <Input
                placeholder="https://instagram.com/p/..."
                value={form.post_url}
                onChange={(e) => setForm((f) => ({ ...f, post_url: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Notes</label>
              <Textarea
                placeholder="What worked, what didn't..."
                value={form.performance_notes}
                onChange={(e) => setForm((f) => ({ ...f, performance_notes: e.target.value }))}
                className="bg-input border-border resize-none"
                rows={2}
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

// ─── Hashtag Manager Tab ──────────────────────────────────────────────────────

const DEFAULT_HASHTAG_SETS: Record<string, string[]> = {
  "Authority": [
    "#ClaudeCode", "#AIautomation", "#BuildInPublic", "#AItools", "#Anthropic",
    "#AIagent", "#NoCode", "#TechStartup", "#AutomationTools", "#AIworkflow",
  ],
  "Discipline & Lifestyle": [
    "#DeepWork", "#DigitalNomad", "#ChiangMai", "#MorningRoutine", "#GymLife",
    "#Discipline", "#RemoteWork", "#Minimalism", "#ProductivityHacks", "#FocusMode",
  ],
  "Social & Magnetism": [
    "#PersonalBrand", "#QuietConfidence", "#Aesthetic", "#CleanDesign", "#LifestyleDesign",
    "#IntentionalLiving", "#GrowthMindset", "#SelfImprovement", "#ModernMasculinity", "#Presence",
  ],
};

function HashtagManager() {
  const [sets, setSets] = useState<Record<string, string[]>>(DEFAULT_HASHTAG_SETS);
  const [editingPillar, setEditingPillar] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HASHTAG_STORAGE_KEY);
      if (stored) setSets(JSON.parse(stored) as Record<string, string[]>);
    } catch { /* ignore */ }
  }, []);

  function saveSets(updated: Record<string, string[]>) {
    setSets(updated);
    try {
      localStorage.setItem(HASHTAG_STORAGE_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
  }

  function startEdit(pillar: string) {
    setEditingPillar(pillar);
    setEditValue((sets[pillar] ?? []).join("\n"));
  }

  function saveEdit(pillar: string) {
    const tags = editValue
      .split(/[\n,]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));
    saveSets({ ...sets, [pillar]: tags });
    setEditingPillar(null);
  }

  async function copySet(pillar: string) {
    try {
      await navigator.clipboard.writeText((sets[pillar] ?? []).join(" "));
      setCopied(pillar);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  }

  async function copyAll() {
    const allTags = Object.values(sets).flat().join(" ");
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
        body: JSON.stringify({ pillar, currentHashtags: sets[pillar] }),
      });
      const data = await res.json() as { hashtags?: string[]; error?: string };
      if (!res.ok || data.error) {
        setGenError(data.error ?? "Failed to generate hashtags");
      } else if (data.hashtags) {
        saveSets({ ...sets, [pillar]: data.hashtags });
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
            {totalTags} total tags across 3 pillars
            {totalTags > 30 && (
              <span className="ml-2 text-yellow-500">Instagram limit is 30 per post</span>
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
              placeholder="One hashtag per line or comma-separated"
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

// ─── Instagram Script Generator ──────────────────────────────────────────────

type IgContentPillar = "Authority" | "Discipline & Lifestyle" | "Social & Magnetism" | "Tutorial" | "Behind the Scenes";

interface IgScriptResult {
  topic: string;
  format: Format;
  pillar: IgContentPillar;
  script: string;
}

function IgScriptGenerator({ onAddToBoard }: { onAddToBoard: (title: string, script: string, format: Format) => void }) {
  const [topic, setTopic] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [format, setFormat] = useState<Format>("reel");
  const [pillar, setPillar] = useState<IgContentPillar>("Authority");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IgScriptResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true);
    setResult(null);

    const formatLabel = format === "reel"
      ? "Instagram Reel (under 30s)"
      : format === "album"
      ? "Instagram Carousel/Album"
      : format === "story"
      ? "Instagram Story"
      : "Instagram Static Post";

    const pointsBlock = keyPoints.trim()
      ? `\nKey Points to Cover:\n${keyPoints.trim().split(/\n/).map(p => `- ${p.replace(/^[-•]\s*/, '')}`).join('\n')}\n`
      : '';

    // Inject proven hooks from the Hook Library
    const savedHooksList = getSavedHooks()
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10);
    const hookRefBlock = savedHooksList.length > 0
      ? `\n\nPROVEN HOOKS (use these as inspiration for tone, structure, and pattern — adapt, don't copy):\n${savedHooksList.map((h, i) => `${i + 1}. "${h.hook}" (@${h.username}, ${h.engagement.toLocaleString()} engagement${h.pattern ? `, pattern: ${h.pattern}` : ''})`).join('\n')}\n`
      : '';

    const prompt = format === "album"
      ? `You are an Instagram content strategist. Generate a carousel/album script for Instagram.

Topic: ${topic}
Content Pillar: ${pillar}${pointsBlock}
Format: Instagram Carousel/Album (swipeable slides)

Output EXACTLY this format (plain text only, no markdown):

SLIDE 1 (Hook):
- [Attention-grabbing opening line]
- [Sub-hook or tension]

SLIDE 2:
- [Point 1 bullet]
- [Supporting detail]

SLIDE 3:
- [Point 2 bullet]
- [Supporting detail]

SLIDE 4:
- [Point 3 bullet]
- [Supporting detail]

SLIDE 5:
- [Point 4 bullet]
- [Supporting detail]

SLIDE 6:
- [Point 5 bullet]
- [Supporting detail]

SLIDE 7:
- [Point 6 bullet]
- [Supporting detail]

SLIDE 8:
- [Point 7 bullet / Insight]

SLIDE 9 (CTA):
- [Call to action]
- [Follow / Save / DM prompt]

Keep each slide to 2-3 bullets max. Mobile-first — short punchy text per slide.${hookRefBlock}`
      : `You are an Instagram script architect. Generate a structured script for a ${formatLabel}.

Topic: ${topic}
Content Pillar: ${pillar}${pointsBlock}

Output EXACTLY this format (plain text only, no markdown):

HOOK (0-3s, word-for-word):
"[Exact opening line — pattern interrupt, bold claim, or scroll-stopper]"

SETUP (3-10s):
- [Why they should care]
- [What they'll get from watching]

DEMO / VALUE (10-25s):
- [Main point / demonstration]
- [Supporting detail or example]
- [Key insight]

LANDING / CTA (25-30s):
- [What it means for them]
- [One clear CTA — follow / save / comment word]

Keep bullet prompts concise — these are speaking cues, not full sentences.${hookRefBlock}`;

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "instagram",
          competitorPosts: [],
          previousTitles: [],
          context: prompt,
          mode: "script",
        }),
      });

      if (res.ok) {
        const data = await res.json() as { ideas?: { scriptOutline?: string; title?: string }[]; script?: string; raw?: string };
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
          script: format === "album"
            ? `SLIDE 1 (Hook):\n- [Could not generate — check API]\n\nSLIDE 9 (CTA):\n- Follow for more\n- Save this`
            : `HOOK (0-3s, word-for-word):\n"[Could not generate — check API]"\n\nCTA (25-30s):\n- Follow for more\n- Comment your thoughts`,
        });
      }
    } catch {
      setResult({
        topic: topic.trim(),
        format,
        pillar,
        script: `HOOK (0-3s, word-for-word):\n"[Could not generate — check API]"\n\nCTA (25-30s):\n- Follow for more`,
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

  const formatBadgeClass = (f: Format) => {
    if (f === "reel") return "bg-primary/10 text-primary border-primary/20";
    if (f === "album") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (f === "story") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    return "bg-zinc-700/30 text-zinc-400 border-zinc-600/20";
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Generate Instagram Script</CardTitle>
          <p className="text-xs text-muted-foreground">
            {`Reel: Hook (word-for-word) + bullet-prompt sections • Album: slide-by-slide bullets`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Topic / Title</label>
            <Input
              placeholder="e.g. I built a system that books jobs while I sleep"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !keyPoints && generate()}
              className="bg-input border-border"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Key Points <span className="text-muted-foreground/50">(optional — one per line)</span></label>
            <textarea
              placeholder={"e.g.\nMissed calls cost tradies $2K/month\nSMS recovery gets 30% reply rate\nWhole system runs on autopilot"}
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
              rows={3}
              className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Format</label>
              <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="reel">Reel (&lt;30s)</SelectItem>
                  <SelectItem value="ig-pc">IG - PC (CapCut/edited)</SelectItem>
                  <SelectItem value="ig-raw">IG - iOS/Raw</SelectItem>
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="album">Album / Carousel</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Content Pillar</label>
              <Select value={pillar} onValueChange={(v) => setPillar(v as IgContentPillar)}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="Authority">Authority</SelectItem>
                  <SelectItem value="Discipline & Lifestyle">Discipline &amp; Lifestyle</SelectItem>
                  <SelectItem value="Social & Magnetism">Social &amp; Magnetism</SelectItem>
                  <SelectItem value="Tutorial">Tutorial</SelectItem>
                  <SelectItem value="Behind the Scenes">Behind the Scenes</SelectItem>
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
                Generate Script
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
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${formatBadgeClass(result.format)}`}>
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

// ─── Recent Competitor Posts ──────────────────────────────────────────────────

function RecentIgPosts() {
  const [collapsed, setCollapsed] = useState(true);
  const [posts, setRecentPosts] = useState<Post[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ig-scraped-data");
      if (!raw) return;
      const scraped = JSON.parse(raw) as Array<{ username: string; posts: Post[] }>;
      const all = scraped.flatMap((e) => e.posts);
      const sorted = [...all]
        .sort((a, b) => new Date(b.taken_at_date).getTime() - new Date(a.taken_at_date).getTime())
        .slice(0, 10);
      setRecentPosts(sorted);
    } catch { /* ignore */ }
  }, []);

  if (posts.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-border bg-card">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors rounded-lg"
      >
        <span className="text-sm font-medium text-muted-foreground">
          Recent Competitor Posts ({posts.length})
        </span>
        {collapsed
          ? <ChevronDown size={15} className="text-muted-foreground" />
          : <ChevronUp size={15} className="text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {posts.map((post, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-medium text-primary">@{post.username}</span>
                  <span className={`text-[10px] px-1.5 py-0 rounded border ${
                    post.media_name === "reel" ? "bg-primary/10 text-primary border-primary/20" :
                    post.media_name === "album" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                    "bg-zinc-700/30 text-zinc-400 border-zinc-600/20"
                  }`}>
                    {post.media_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                    {new Date(post.taken_at_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {post.text.slice(0, 60)}{post.text.length > 60 ? "..." : ""}
                </p>
              </div>
              <div className="text-right shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                <div>{post.like_count.toLocaleString()} likes</div>
                <div>{post.comment_count} comments</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AI Suggest Panel ─────────────────────────────────────────────────────────

function AiSuggestPanel({
  onUseIdea,
}: {
  onUseIdea: (idea: VideoIdea) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ideas, setIdeas] = useState<VideoIdea[]>([]);
  const [claudeIdeas, setClaudeIdeas] = useState<ClaudeIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Analysing competitor data...");
  const [usingClaude, setUsingClaude] = useState(false);
  const [previousTitles, setPreviousTitles] = useState<string[]>([]);

  async function generate() {
    setLoading(true);
    setLoadingMsg("Generating ideas with Claude...");
    setClaudeIdeas([]);
    setIdeas([]);

    try {
      const competitorPosts = getAllPosts();

      const apiPosts = competitorPosts.map((p) => ({
        username: p.username,
        text: p.text,
        like_count: p.like_count,
        comment_count: p.comment_count,
      }));

      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorPosts: apiPosts, previousTitles }),
      });

      if (res.ok) {
        const data = await res.json() as { ideas: ClaudeIdea[] };
        const newIdeas = data.ideas ?? [];
        setClaudeIdeas(newIdeas);
        setUsingClaude(true);
        setPreviousTitles((prev) => [...prev, ...newIdeas.map((i) => i.title)]);
      } else {
        setUsingClaude(false);
        setLoadingMsg("Using local analysis...");
        await new Promise((r) => setTimeout(r, 300));
        setIdeas(generateVideoIdeas(competitorPosts));
      }
    } catch {
      setUsingClaude(false);
      setIdeas(generateVideoIdeas(getAllPosts()));
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    if (claudeIdeas.length === 0 && ideas.length === 0) generate();
  }

  function useClaudeIdea(idea: ClaudeIdea) {
    const mapped: VideoIdea = {
      title: idea.title,
      hook: idea.hook,
      format: "reel",
      pillar: idea.pillar,
      why: idea.reasoning,
    };
    onUseIdea(mapped);
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
                <DialogTitle>AI Video Ideas</DialogTitle>
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
                {loading ? loadingMsg : "Regenerate"}
              </button>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {loadingMsg}
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

                  <div className="flex items-start gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0 whitespace-nowrap">
                      {idea.pillar}
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
              {ideas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No ideas generated. Try regenerating.</p>
              )}
              {ideas.map((idea, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-snug">{idea.title}</p>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0", formatColors[idea.format])}
                    >
                      {formatLabels[idea.format] || idea.format}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground bg-secondary/50 rounded px-2 py-1.5 font-mono leading-relaxed">
                    &ldquo;{idea.hook}&rdquo;
                  </p>

                  <div className="flex items-start gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                      {idea.pillar}
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

// ─── Repurpose Dialog ────────────────────────────────────────────────────────

interface RepurposeResult {
  twitter: { tweet: string; thread: string[] };
  linkedin: string;
}

function RepurposeDialog({ post }: { post: PostCard }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RepurposeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: post.title, caption: post.caption }),
      });
      const data = await res.json() as RepurposeResult & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to generate");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    if (!result) generate();
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); handleOpen(); }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-purple-500/20 bg-purple-500/5 text-purple-400 hover:bg-purple-500/15 transition-colors"
      >
        <Share2 size={9} />
        Repurpose
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-popover border-border w-full max-w-xl mx-4 sm:mx-auto max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-sm">Repurpose — {post.title}</DialogTitle>
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
            <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Repurposing with Claude...
            </div>
          ) : error ? (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          ) : result ? (
            <Tabs defaultValue="twitter" className="pt-1">
              <TabsList className="bg-secondary w-full">
                <TabsTrigger value="twitter" className="flex-1">X / Twitter</TabsTrigger>
                <TabsTrigger value="linkedin" className="flex-1">LinkedIn</TabsTrigger>
              </TabsList>

              <TabsContent value="twitter" className="space-y-4 pt-3">
                {/* Single tweet */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Single Tweet</p>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px]",
                        result.twitter.tweet.length > 280 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {result.twitter.tweet.length} / 280
                      </span>
                      <button
                        onClick={() => copy(result.twitter.tweet, "tweet")}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-border bg-secondary hover:bg-secondary/70 transition-colors"
                      >
                        {copied === "tweet" ? <Check size={10} /> : <Copy size={10} />}
                        {copied === "tweet" ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div className="bg-input border border-border rounded-md px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                    {result.twitter.tweet}
                  </div>
                </div>

                {/* Thread */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Thread ({result.twitter.thread.length} tweets)</p>
                    <button
                      onClick={() => copy(result.twitter.thread.join("\n\n"), "thread")}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-border bg-secondary hover:bg-secondary/70 transition-colors"
                    >
                      {copied === "thread" ? <Check size={10} /> : <Copy size={10} />}
                      {copied === "thread" ? "Copied" : "Copy all"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {result.twitter.thread.map((tweet, i) => (
                      <div key={i} className="bg-input border border-border rounded-md px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm leading-relaxed flex-1 whitespace-pre-wrap">{tweet}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground">{tweet.length}/280</span>
                            <button
                              onClick={() => copy(tweet, `tweet-${i}`)}
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              {copied === `tweet-${i}` ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="linkedin" className="pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-muted-foreground">LinkedIn Post</p>
                  <button
                    onClick={() => copy(result.linkedin, "linkedin")}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-border bg-secondary hover:bg-secondary/70 transition-colors"
                  >
                    {copied === "linkedin" ? <Check size={10} /> : <Copy size={10} />}
                    {copied === "linkedin" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="bg-input border border-border rounded-md px-3 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {result.linkedin}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">{result.linkedin.length} characters</p>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function InstagramClient() {
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [useSupabase, setUseSupabase] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Edit dialog state
  const [editPost, setEditPost] = useState<PostCard | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    caption: string;
    format: Format;
    status: Status;
    scheduledDate: string;
    scriptId: string;
  }>({ title: "", caption: "", format: "reel", status: "ideas", scheduledDate: "", scriptId: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [groupByDate, setGroupByDate] = useState(false);
  const [dateFilter, setDateFilter] = useState<"all" | "dated" | "undated" | "archived">("all");

  const [form, setForm] = useState<{
    title: string;
    caption: string;
    format: Format;
    status: Status;
    scheduledDate: string;
    scriptId: string;
  }>({
    title: "",
    caption: "",
    format: "reel",
    status: "ideas",
    scheduledDate: "",
    scriptId: "",
  });

  // Saved scripts (for linking to board posts)
  const { scripts: savedScripts, getById: getScriptById } = useScripts();

  // Lazy-load Supabase client only when configured
  async function getSupabase() {
    const { supabase } = await import("@/lib/supabase");
    return supabase;
  }

  // Load posts on mount + set mounted flag for DnD SSR guard
  useEffect(() => {
    setMounted(true);
    const configured = isSupabaseConfigured();
    setUseSupabase(configured);

    if (configured) {
      loadFromSupabase();
    } else {
      loadFromLocalStorage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPosts(JSON.parse(stored) as PostCard[]);
      } else {
        setPosts(SAMPLE_POSTS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_POSTS));
      }
    } catch {
      setPosts(SAMPLE_POSTS);
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

      if (data && data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPosts(data.map((row: Record<string, any>) => fromDbRow(row)));
      } else {
        await seedSamplePosts();
      }
    } catch {
      loadFromLocalStorage();
    }
  }

  async function seedSamplePosts() {
    try {
      const sb = await getSupabase();
      const rows = SAMPLE_POSTS.map((p) => ({
        title: p.title,
        caption: p.caption,
        format: p.format,
        status: toDbStatus(p.status),
        scheduled_date: p.scheduledDate ?? null,
      }));
      const { data, error } = await sb
        .from("content_posts")
        .insert(rows)
        .select();
      if (error) throw error;
      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPosts(data.map((row: Record<string, any>) => fromDbRow(row)));
      }
    } catch {
      setPosts(SAMPLE_POSTS);
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
          scriptId: form.scriptId || undefined,
        };
        setPosts((prev) => [...prev, newPost]);
      }
    } else {
      const newPost: PostCard = {
        id: generateId(),
        title: form.title.trim(),
        caption: form.caption.trim(),
        format: form.format,
        status: form.status,
        scheduledDate: form.scheduledDate || undefined,
        scriptId: form.scriptId || undefined,
      };
      const updated = [...posts, newPost];
      setPosts(updated);
      saveToLocalStorage(updated);
    }

    // Ping Slack when a reel is created already carrying a scheduled date.
    if (form.scheduledDate) {
      notifyScheduled({ board: "instagram", title: form.title.trim(), date: form.scheduledDate });
    }

    setForm({ title: "", caption: "", format: "reel", status: "ideas", scheduledDate: "", scriptId: "" });
    setAddOpen(false);
  }

  function addFromIdea(idea: VideoIdea) {
    const newPost: PostCard = {
      id: generateId(),
      title: idea.title,
      caption: idea.hook,
      format: idea.format,
      status: "ideas",
    };
    const updated = [...posts, newPost];
    setPosts(updated);
    if (!useSupabase) saveToLocalStorage(updated);
    if (useSupabase) {
      getSupabase().then((sb) =>
        sb.from("content_posts").insert({
          title: newPost.title,
          caption: newPost.caption,
          format: newPost.format,
          status: "idea",
          scheduled_date: null,
        })
      ).catch(() => {/* silent */});
    }
  }

  async function movePost(id: string, newStatus: Status) {
    const updated = posts.map((p) => (p.id === id ? { ...p, status: newStatus } : p));
    setPosts(updated);

    if (useSupabase) {
      try {
        const sb = await getSupabase();
        const { error } = await sb
          .from("content_posts")
          .update({ status: toDbStatus(newStatus), updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } catch {
        // optimistic update already applied — silent fail
      }
    } else {
      saveToLocalStorage(updated);
    }
  }

  function sortByScheduled<T extends { scheduledDate?: string }>(items: T[]): T[] {
    if (!groupByDate) return items;
    const scheduled = items.filter((c) => c.scheduledDate);
    const unscheduled = items.filter((c) => !c.scheduledDate);
    return [...scheduled, ...unscheduled];
  }

  // Drag and drop handler
  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return;

    const newStatus = destination.droppableId as Status;
    if (newStatus !== source.droppableId) {
      movePost(draggableId, newStatus);
    }
  }

  // Open edit dialog for a card
  function openEdit(post: PostCard) {
    setEditPost(post);
    setEditForm({
      title: post.title,
      caption: post.caption,
      format: post.format,
      status: post.status,
      scheduledDate: post.scheduledDate ?? "",
      scriptId: post.scriptId ?? "",
    });
    setDeleteConfirm(false);
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editPost || !editForm.title.trim()) return;

    const updated = posts.map((p) =>
      p.id === editPost.id
        ? {
            ...p,
            title: editForm.title.trim(),
            caption: editForm.caption.trim(),
            format: editForm.format,
            status: editForm.status,
            scheduledDate: editForm.scheduledDate || undefined,
            scriptId: editForm.scriptId || undefined,
          }
        : p
    );
    setPosts(updated);

    if (useSupabase) {
      try {
        const sb = await getSupabase();
        await sb
          .from("content_posts")
          .update({
            title: editForm.title.trim(),
            caption: editForm.caption.trim(),
            format: editForm.format,
            status: toDbStatus(editForm.status),
            scheduled_date: editForm.scheduledDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editPost.id);
      } catch {
        // optimistic update already applied
      }
    } else {
      saveToLocalStorage(updated);
    }

    // Ping Slack only the first time a reel gains a scheduled date (matches the
    // !oldDate && newDate semantics used by the other content boards).
    if (!editPost.scheduledDate && editForm.scheduledDate) {
      notifyScheduled({ board: "instagram", title: editForm.title.trim(), date: editForm.scheduledDate });
    }

    setEditOpen(false);
    setEditPost(null);
  }

  async function handleDelete() {
    if (!editPost) return;

    const updated = posts.filter((p) => p.id !== editPost.id);
    setPosts(updated);

    if (useSupabase) {
      try {
        const sb = await getSupabase();
        await sb.from("content_posts").delete().eq("id", editPost.id);
      } catch {
        // optimistic delete already applied
      }
    } else {
      saveToLocalStorage(updated);
    }

    setEditOpen(false);
    setEditPost(null);
    setDeleteConfirm(false);
  }

  // Save generated caption back to post
  async function handleSaveCaption(id: string, caption: string) {
    const updated = posts.map((p) => (p.id === id ? { ...p, caption } : p));
    setPosts(updated);

    if (useSupabase) {
      try {
        const sb = await getSupabase();
        await sb
          .from("content_posts")
          .update({ caption, updated_at: new Date().toISOString() })
          .eq("id", id);
      } catch {
        // optimistic update already applied
      }
    } else {
      saveToLocalStorage(updated);
    }
  }

  // Save performance metrics
  async function handleSaveMetrics(id: string, metrics: Partial<PostCard>) {
    const updated = posts.map((p) => (p.id === id ? { ...p, ...metrics } : p));
    setPosts(updated);

    if (useSupabase) {
      try {
        const sb = await getSupabase();
        await sb
          .from("content_posts")
          .update({
            actual_likes: metrics.actual_likes ?? null,
            actual_comments: metrics.actual_comments ?? null,
            actual_saves: metrics.actual_saves ?? null,
            actual_shares: metrics.actual_shares ?? null,
            post_url: metrics.post_url ?? null,
            performance_notes: metrics.performance_notes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      } catch {
        // optimistic update already applied
      }
    } else {
      saveToLocalStorage(updated);
    }
  }

  function addScriptToBoard(title: string, script: string, format: Format) {
    const newPost: PostCard = {
      id: generateId(),
      title,
      caption: script,
      format,
      status: "ideas",
      createdAt: new Date().toISOString(),
    };
    const updated = [...posts, newPost];
    setPosts(updated);
    if (!useSupabase) saveToLocalStorage(updated);
    if (useSupabase) {
      getSupabase().then((sb) =>
        sb.from("content_posts").insert({
          title: newPost.title,
          caption: newPost.caption,
          format: newPost.format,
          status: "idea",
          scheduled_date: null,
        })
      ).catch(() => {/* silent */});
    }
  }

  // Don't render DnD until client-side to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className="min-w-[280px] flex-shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {col.label}
                </h3>
              </div>
              <div className="min-h-[120px]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Tabs defaultValue="board">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <TabsList className="bg-secondary w-full sm:w-auto">
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="script-generator">Script Generator</TabsTrigger>
            <TabsTrigger value="script-guide">Script Guide</TabsTrigger>
            <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{posts.length} posts tracked</p>
            <div className="flex items-center gap-1">
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
            <AiSuggestPanel onUseIdea={addFromIdea} />
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <PlusCircle size={14} />
                Add Post
              </DialogTrigger>

              <DialogContent className="bg-popover border-border w-full max-w-md mx-4 sm:mx-auto">
                <DialogHeader>
                  <DialogTitle>New Post Idea</DialogTitle>
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
                          <SelectItem value="ig-pc">IG - PC</SelectItem>
                          <SelectItem value="ig-raw">IG - iOS/Raw</SelectItem>
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
                    <label className="text-xs text-muted-foreground mb-1.5 block">Scheduled Date (optional)</label>
                    <Input
                      type="date"
                      value={form.scheduledDate}
                      onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                      className="bg-input border-border"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Link Script (optional)</label>
                    <Select
                      value={form.scriptId || "__none__"}
                      onValueChange={(v) => setForm((f) => ({ ...f, scriptId: !v || v === "__none__" ? "" : v }))}
                    >
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="No script linked" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="__none__">No script linked</SelectItem>
                        {savedScripts.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {savedScripts.length === 0 && (
                      <p className="text-[11px] text-muted-foreground/60 mt-1">
                        Create scripts in the Scripts tab to link them here.
                      </p>
                    )}
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
        </div>

        {/* Edit/View Post Dialog */}
        <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { setDeleteConfirm(false); } }}>
          <DialogContent className="bg-popover border-border w-full max-w-md mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Post</DialogTitle>
            </DialogHeader>
            {editPost && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Title</label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    className="bg-input border-border"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Caption</label>
                  <Textarea
                    value={editForm.caption}
                    onChange={(e) => setEditForm((f) => ({ ...f, caption: e.target.value }))}
                    className="bg-input border-border resize-none"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Format</label>
                    <Select
                      value={editForm.format}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, format: v as Format }))}
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
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
                    <Select
                      value={editForm.status}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as Status }))}
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
                  <label className="text-xs text-muted-foreground mb-1.5 block">Scheduled Date (optional)</label>
                  <Input
                    type="date"
                    value={editForm.scheduledDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                    className="bg-input border-border"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Link Script (optional)</label>
                  <Select
                    value={editForm.scriptId || "__none__"}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, scriptId: !v || v === "__none__" ? "" : v }))}
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="No script linked" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="__none__">No script linked</SelectItem>
                      {savedScripts.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editForm.scriptId && (() => {
                    const linked = getScriptById(editForm.scriptId);
                    if (!linked) {
                      return (
                        <p className="text-[11px] text-destructive/80 mt-1">
                          Linked script no longer exists.
                        </p>
                      );
                    }
                    return (
                      <div className="mt-2 bg-secondary/30 border border-border/50 rounded-md p-2 max-h-48 overflow-y-auto">
                        <p className="text-[11px] text-muted-foreground mb-1">
                          {linked.script.split("\n").length} lines · {linked.script.split(/\s+/).filter(Boolean).length} words
                        </p>
                        <pre className="text-[11px] font-mono text-foreground/80 whitespace-pre-wrap">
                          {linked.script || "(empty script)"}
                        </pre>
                      </div>
                    );
                  })()}
                </div>
                {editPost.createdAt && (
                  <p className="text-[11px] text-muted-foreground/50">
                    Created {new Date(editPost.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  {deleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-destructive">Delete this post?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleDelete}
                        className="h-7 text-xs px-2"
                      >
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
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirm(true)}
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={12} className="mr-1" />
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2 text-muted-foreground"
                        onClick={() => setDuplicateOpen(true)}
                      >
                        <CopyPlus size={12} className="mr-1" />
                        Duplicate to...
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn("h-7 text-xs px-2", editPost?.archived ? "text-orange-400" : "text-muted-foreground")}
                        onClick={() => {
                          if (editPost) {
                            const updated = posts.map((p) => p.id === editPost.id ? { ...p, archived: !p.archived } : p);
                            setPosts(updated);
                            // Also persist to localStorage
                            try { localStorage.setItem("content-os-instagram-posts", JSON.stringify(updated)); } catch {}
                            setEditOpen(false);
                          }
                        }}
                      >
                        {editPost?.archived ? "Unarchive" : "Archive"}
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditOpen(false)}
                      className="border-border h-7 text-xs px-3"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs px-3"
                      onClick={handleSaveEdit}
                      disabled={!editForm.title.trim()}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {editPost && (
          <DuplicateToDialog
            open={duplicateOpen}
            onOpenChange={setDuplicateOpen}
            text={editPost.title + (editPost.caption ? "\n\n" + editPost.caption : "")}
            currentBoard="instagram"
          />
        )}

        <TabsContent value="board">
          {/* Kanban board with drag and drop */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x" id="ig-kanban">
              {COLUMNS.map((col) => {
                const colPosts = sortByScheduled(
                  posts.filter((p) => p.status === col.key)
                    .filter((p) => {
                      if (dateFilter === "archived") return !!p.archived;
                      if (p.archived) return false;
                      if (dateFilter === "all") return true;
                      if (dateFilter === "dated") return !!p.scheduledDate;
                      return !p.scheduledDate;
                    })
                );
                return (
                  <div key={col.key} className="min-w-[280px] snap-start flex-shrink-0 space-y-3 md:flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {col.label}
                      </h3>
                      <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                        {colPosts.length}
                      </span>
                    </div>

                    <Droppable droppableId={col.key}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "space-y-2 min-h-[120px] rounded-md transition-colors duration-150 p-1 -m-1",
                            snapshot.isDraggingOver && "bg-primary/5 ring-1 ring-primary/20"
                          )}
                        >
                          {colPosts.map((post, index) => (
                            <Draggable key={post.id} draggableId={post.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                >
                                  <Card
                                    className={cn(
                                      "bg-card border-border group cursor-pointer transition-all duration-150",
                                      post.scheduledDate && "ring-2 ring-orange-400",
                                      dragSnapshot.isDragging && "opacity-80 shadow-lg ring-1 ring-primary/30 rotate-[0.5deg]"
                                    )}
                                    onClick={() => {
                                      if (!dragSnapshot.isDragging) openEdit(post);
                                    }}
                                  >
                                    <CardContent className="p-3 max-h-[200px] overflow-hidden">
                                      <div className="flex items-start gap-2 mb-2">
                                        <div
                                          {...dragProvided.dragHandleProps}
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing"
                                        >
                                          <GripVertical
                                            size={13}
                                            className="text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors"
                                          />
                                        </div>
                                        <p className="text-sm font-medium leading-snug flex-1 line-clamp-2">{post.title}</p>
                                      </div>
                                      {post.caption && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2 ml-5">
                                          {post.caption}
                                        </p>
                                      )}
                                      <div className="flex items-center justify-between ml-5 mb-2">
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[10px] px-1.5 py-0 h-4",
                                            formatColors[post.format]
                                          )}
                                        >
                                          {formatLabels[post.format] || post.format}
                                        </Badge>
                                        {post.scheduledDate && (
                                          <span className="text-[10px] text-muted-foreground">
                                            {formatDateShort(post.scheduledDate)}
                                          </span>
                                        )}
                                      </div>
                                      {/* Action buttons */}
                                      <div className="flex items-center flex-wrap gap-1.5 ml-5" onClick={(e) => e.stopPropagation()}>
                                        <CaptionDialog
                                          post={post}
                                          onSave={(caption) => handleSaveCaption(post.id, caption)}
                                        />
                                        <RepurposeDialog post={post} />
                                        {post.status === "posted" && (
                                          <LogResultsDialog
                                            post={post}
                                            onSave={(metrics) => handleSaveMetrics(post.id, metrics)}
                                          />
                                        )}
                                      </div>
                                      {/* Show logged metrics summary if available */}
                                      {post.status === "posted" && post.actual_likes !== undefined && (
                                        <div className="ml-5 mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                                          <span>{post.actual_likes?.toLocaleString()} likes</span>
                                          {post.actual_comments !== undefined && (
                                            <span>{post.actual_comments} comments</span>
                                          )}
                                          {post.actual_saves !== undefined && (
                                            <span>{post.actual_saves} saves</span>
                                          )}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          ))}

                          {provided.placeholder}

                          {colPosts.length === 0 && !snapshot.isDraggingOver && (
                            <div className="border border-dashed border-border rounded-md h-20 flex items-center justify-center">
                              <p className="text-xs text-muted-foreground/40">Empty</p>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>

          {/* Recent Competitor Posts */}
          <RecentIgPosts />
        </TabsContent>

        <TabsContent value="scripts">
          <ScriptsTab />
        </TabsContent>

        <TabsContent value="script-generator">
          <IgScriptGenerator onAddToBoard={addScriptToBoard} />
        </TabsContent>

        <TabsContent value="script-guide">
          <ScriptGuide />
        </TabsContent>

        <TabsContent value="hashtags">
          <HashtagManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
