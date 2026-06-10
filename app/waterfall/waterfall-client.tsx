"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  Pencil,
  Sparkles,
  ChevronRight,
  GitBranch,
  Check,
  X,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useWaterfall,
  type Platform,
  type ContentFormat,
  type WaterfallIdea,
  type WaterfallCluster,
} from "@/lib/use-waterfall";

const PLATFORMS: Platform[] = [
  "blog",
  "linkedin",
  "instagram",
  "youtube",
  "x-threads",
  "fb-groups",
];

const FORMATS: ContentFormat[] = [
  "Long-form Article",
  "Text Post",
  "Carousel",
  "Reel / Short",
  "Thread",
  "Question",
  "Poll",
  "Story",
  "Newsletter",
  "Video Essay",
];

const PLATFORM_LABELS: Record<Platform, string> = {
  blog: "Blog",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  youtube: "YouTube",
  "x-threads": "X / Threads",
  "fb-groups": "FB Groups",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  blog: "border-l-blue-500",
  linkedin: "border-l-blue-600",
  instagram: "border-l-pink-500",
  youtube: "border-l-red-500",
  "x-threads": "border-l-neutral-400",
  "fb-groups": "border-l-blue-400",
};

const PLATFORM_DOT_COLORS: Record<Platform, string> = {
  blog: "bg-blue-500",
  linkedin: "bg-blue-600",
  instagram: "bg-pink-500",
  youtube: "bg-red-500",
  "x-threads": "bg-neutral-400",
  "fb-groups": "bg-blue-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── Suggestion card ─────────────────────────────────────────────────────────

interface Suggestion {
  platform: string;
  format: string;
  angle: string;
}

function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: Suggestion;
  onAccept: () => void;
  onReject: () => void;
}) {
  const platform = suggestion.platform as Platform;
  const borderColor = PLATFORM_COLORS[platform] ?? "border-l-zinc-500";
  const dotColor = PLATFORM_DOT_COLORS[platform] ?? "bg-zinc-500";
  return (
    <Card className={cn("bg-card border border-border border-l-4 transition-colors", borderColor)}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full shrink-0", dotColor)} />
            <span className="text-xs font-medium text-foreground">
              {PLATFORM_LABELS[platform] ?? suggestion.platform}
            </span>
          </div>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {suggestion.format}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-snug">{suggestion.angle}</p>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="default"
            className="h-6 px-2 text-xs gap-1"
            onClick={onAccept}
          >
            <Check size={10} /> Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs gap-1 text-muted-foreground"
            onClick={onReject}
          >
            <X size={10} /> Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Derivative idea card ────────────────────────────────────────────────────

function IdeaCard({
  idea,
  onEdit,
  onDelete,
}: {
  idea: WaterfallIdea;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const borderColor = PLATFORM_COLORS[idea.platform] ?? "border-l-zinc-500";
  const dotColor = PLATFORM_DOT_COLORS[idea.platform] ?? "bg-zinc-500";
  return (
    <Card className={cn("bg-card border border-border border-l-4 transition-colors group", borderColor)}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full shrink-0", dotColor)} />
            <span className="text-xs font-medium text-foreground">
              {PLATFORM_LABELS[idea.platform]}
            </span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {idea.format}
        </Badge>
        <p className="text-sm text-muted-foreground leading-snug">{idea.angle ?? idea.text}</p>
      </CardContent>
    </Card>
  );
}

// ─── Guide component ─────────────────────────────────────────────────────────

function WaterfallGuide({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-secondary/30 transition-colors"
      >
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Info size={12} />
          How Content Waterfall works
        </span>
        <ChevronRight size={12} className={cn("text-muted-foreground transition-transform", !collapsed && "rotate-90")} />
      </button>
      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 text-sm text-muted-foreground border-t border-border pt-3">
          <div className="space-y-2">
            <p className="font-medium text-foreground text-xs">The Matt Gray method: one idea, every platform</p>
            <ol className="space-y-1.5 text-xs list-decimal list-inside">
              <li><span className="text-foreground font-medium">Start with a core idea</span> — a blog post, a video concept, a personal story. This is your &quot;seed&quot; content.</li>
              <li><span className="text-foreground font-medium">Create the cluster</span> — give it a title and describe the core concept. Pick the original platform and format.</li>
              <li><span className="text-foreground font-medium">Generate derivatives</span> — hit &quot;Generate Ideas&quot; and AI suggests how to adapt the idea for other platforms (LinkedIn text post, Instagram reel hook, X thread, FB group question, etc).</li>
              <li><span className="text-foreground font-medium">Accept or dismiss</span> — keep the ideas that resonate, dismiss the rest. Add your own manually too.</li>
              <li><span className="text-foreground font-medium">Execute</span> — use each derivative as a brief when you create the actual content. The ideas stay here as your map.</li>
            </ol>
          </div>
          <div className="bg-secondary/30 rounded-md p-3 space-y-1">
            <p className="text-xs font-medium text-foreground">Example</p>
            <p className="text-[11px]">Core idea: &quot;5 tools every tradie should automate&quot; (blog post)</p>
            <p className="text-[11px]">→ LinkedIn: &quot;I automated 5 things in my trade business — here&apos;s what happened&quot;</p>
            <p className="text-[11px]">→ Instagram: Reel hook — &quot;Stop doing these 5 things manually&quot;</p>
            <p className="text-[11px]">→ X: Thread breaking down each tool with screenshots</p>
            <p className="text-[11px]">→ FB Groups: &quot;What tools do you use to save time?&quot; (engagement question)</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function WaterfallClient() {
  const {
    clusters,
    mounted,
    addCluster,
    removeCluster,
    addIdea,
    updateIdea,
    removeIdea,
  } = useWaterfall();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guideCollapsed, setGuideCollapsed] = useState(true);

  // New cluster dialog
  const [clusterDialogOpen, setClusterDialogOpen] = useState(false);
  const [clusterForm, setClusterForm] = useState({
    title: "",
    text: "",
    platform: "blog" as Platform,
    format: "Long-form Article" as ContentFormat,
  });

  // Add idea dialog
  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false);
  const [ideaForm, setIdeaForm] = useState({
    platform: "linkedin" as Platform,
    format: "Text Post" as ContentFormat,
    angle: "",
  });

  // Edit idea dialog
  const [editIdeaDialogOpen, setEditIdeaDialogOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<WaterfallIdea | null>(null);
  const [editIdeaForm, setEditIdeaForm] = useState({
    platform: "linkedin" as Platform,
    format: "Text Post" as ContentFormat,
    angle: "",
  });

  // AI generation
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const selectedCluster = clusters.find((c) => c.id === selectedId) ?? null;

  function openCreateCluster() {
    setClusterForm({ title: "", text: "", platform: "blog", format: "Long-form Article" });
    setClusterDialogOpen(true);
  }

  function handleCreateCluster() {
    if (!clusterForm.title.trim() || !clusterForm.text.trim()) return;
    const cluster = addCluster({
      title: clusterForm.title.trim(),
      rootIdea: {
        text: clusterForm.text.trim(),
        platform: clusterForm.platform,
        format: clusterForm.format,
        parentId: null,
        angle: clusterForm.text.trim(),
      },
    });
    setSelectedId(cluster.id);
    setClusterDialogOpen(false);
    setSuggestions([]);
  }

  function handleAddIdea() {
    if (!selectedCluster || !ideaForm.angle.trim()) return;
    const root = selectedCluster.ideas.find((i) => i.parentId === null);
    addIdea(selectedCluster.id, {
      text: ideaForm.angle.trim(),
      platform: ideaForm.platform,
      format: ideaForm.format,
      parentId: root?.id ?? null,
      angle: ideaForm.angle.trim(),
    });
    setIdeaForm({ platform: "linkedin", format: "Text Post", angle: "" });
    setIdeaDialogOpen(false);
  }

  function openEditIdea(idea: WaterfallIdea) {
    setEditingIdea(idea);
    setEditIdeaForm({
      platform: idea.platform,
      format: idea.format,
      angle: idea.angle ?? idea.text,
    });
    setEditIdeaDialogOpen(true);
  }

  function handleEditIdea() {
    if (!selectedCluster || !editingIdea || !editIdeaForm.angle.trim()) return;
    updateIdea(selectedCluster.id, editingIdea.id, {
      platform: editIdeaForm.platform,
      format: editIdeaForm.format,
      angle: editIdeaForm.angle.trim(),
      text: editIdeaForm.angle.trim(),
    });
    setEditIdeaDialogOpen(false);
    setEditingIdea(null);
  }

  async function handleGenerate() {
    if (!selectedCluster) return;
    const root = selectedCluster.ideas.find((i) => i.parentId === null);
    if (!root) return;

    const derivatives = selectedCluster.ideas.filter((i) => i.parentId !== null);

    setGenerating(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/waterfall/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootIdea: root.text,
          rootPlatform: root.platform,
          rootFormat: root.format,
          existingIdeas: derivatives,
        }),
      });
      const data = await res.json() as { ideas?: Suggestion[]; error?: string };
      if (data.ideas && data.ideas.length > 0) {
        setSuggestions(data.ideas);
      }
    } catch {
      // silent fail
    } finally {
      setGenerating(false);
    }
  }

  function acceptSuggestion(suggestion: Suggestion) {
    if (!selectedCluster) return;
    const root = selectedCluster.ideas.find((i) => i.parentId === null);
    const platform = suggestion.platform as Platform;
    const format = (FORMATS.includes(suggestion.format as ContentFormat)
      ? suggestion.format
      : "Text Post") as ContentFormat;
    addIdea(selectedCluster.id, {
      text: suggestion.angle,
      platform,
      format,
      parentId: root?.id ?? null,
      angle: suggestion.angle,
    });
    setSuggestions((prev) =>
      prev.filter((s) => s.platform !== suggestion.platform || s.angle !== suggestion.angle)
    );
  }

  function dismissSuggestion(suggestion: Suggestion) {
    setSuggestions((prev) =>
      prev.filter((s) => s.platform !== suggestion.platform || s.angle !== suggestion.angle)
    );
  }

  if (!mounted) return null;

  const rootIdea = selectedCluster?.ideas.find((i) => i.parentId === null) ?? null;
  const derivatives = selectedCluster?.ideas.filter((i) => i.parentId !== null) ?? [];

  // Group derivatives by platform
  const byPlatform: Record<string, WaterfallIdea[]> = {};
  for (const idea of derivatives) {
    if (!byPlatform[idea.platform]) byPlatform[idea.platform] = [];
    byPlatform[idea.platform].push(idea);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* ── Left panel: cluster list ─────────────────────────────────────── */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border">
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={openCreateCluster}
          >
            <Plus size={14} /> New Cluster
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {clusters.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 px-3">
                No ideas yet. Create your first cluster.
              </p>
            )}
            {clusters.map((cluster) => {
              const derivativeCount = cluster.ideas.filter((i) => i.parentId !== null).length;
              const isActive = cluster.id === selectedId;
              return (
                <button
                  key={cluster.id}
                  onClick={() => {
                    setSelectedId(cluster.id);
                    setSuggestions([]);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-md transition-colors group flex items-start justify-between gap-2",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{cluster.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {derivativeCount} derivative{derivativeCount !== 1 ? "s" : ""} · {formatDate(cluster.createdAt)}
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    className={cn(
                      "shrink-0 mt-0.5 text-muted-foreground transition-opacity",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                    )}
                  />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ── Right panel: waterfall view ──────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!selectedCluster ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-10 max-w-lg mx-auto w-full">
            <WaterfallGuide collapsed={false} onToggle={() => {}} />
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <GitBranch size={24} className="text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Start with a core idea</p>
              <p className="text-sm text-muted-foreground mt-1">
                Watch it cascade across platforms
              </p>
            </div>
            <Button onClick={openCreateCluster} className="gap-1.5">
              <Plus size={14} /> Create First Idea
            </Button>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6 max-w-4xl">
              {/* Header actions */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{selectedCluster.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Created {formatDate(selectedCluster.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    <Sparkles size={12} />
                    {generating ? "Generating..." : "Generate Ideas"}
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      setIdeaForm({ platform: "linkedin", format: "Text Post", angle: "" });
                      setIdeaDialogOpen(true);
                    }}
                  >
                    <Plus size={12} /> Add Derivative
                  </Button>
                  <button
                    onClick={() => {
                      removeCluster(selectedCluster.id);
                      setSelectedId(null);
                      setSuggestions([]);
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 transition-colors"
                    title="Delete cluster"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Guide */}
              <WaterfallGuide
                collapsed={guideCollapsed}
                onToggle={() => setGuideCollapsed((c) => !c)}
              />

              {/* Root idea */}
              {rootIdea && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Core Idea
                  </p>
                  <Card className={cn("border border-border border-l-4 bg-card/80", PLATFORM_COLORS[rootIdea.platform])}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-2.5 w-2.5 rounded-full shrink-0",
                                PLATFORM_DOT_COLORS[rootIdea.platform]
                              )}
                            />
                            <span className="text-sm font-medium text-foreground">
                              {PLATFORM_LABELS[rootIdea.platform]}
                            </span>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              {rootIdea.format}
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground font-medium leading-snug">
                            {rootIdea.text}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Waterfall arrow */}
              {(derivatives.length > 0 || suggestions.length > 0) && (
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <GitBranch size={12} />
                    <span>cascades into</span>
                  </div>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}

              {/* AI suggestions */}
              {suggestions.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles size={10} /> AI Suggestions
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {suggestions.map((s, i) => (
                      <SuggestionCard
                        key={i}
                        suggestion={s}
                        onAccept={() => acceptSuggestion(s)}
                        onReject={() => dismissSuggestion(s)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Derivatives grouped by platform */}
              {derivatives.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Derivatives · {derivatives.length}
                  </p>
                  <div className="space-y-4">
                    {PLATFORMS.filter((p) => byPlatform[p]?.length).map((platform) => (
                      <div key={platform}>
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={cn("h-2 w-2 rounded-full", PLATFORM_DOT_COLORS[platform])}
                          />
                          <p className="text-xs font-medium text-muted-foreground">
                            {PLATFORM_LABELS[platform]}
                          </p>
                          <span className="text-[10px] text-muted-foreground/60">
                            ({byPlatform[platform].length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {byPlatform[platform].map((idea) => (
                            <IdeaCard
                              key={idea.id}
                              idea={idea}
                              onEdit={() => openEditIdea(idea)}
                              onDelete={() => removeIdea(selectedCluster.id, idea.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty derivatives state */}
              {derivatives.length === 0 && suggestions.length === 0 && (
                <div className="border border-dashed border-border rounded-lg p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No derivatives yet. Add one manually or use Generate Ideas.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* ── New cluster dialog ──────────────────────────────────────────── */}
      <Dialog open={clusterDialogOpen} onOpenChange={setClusterDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Content Cluster</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Cluster title</label>
              <Input
                placeholder="e.g. How I 10x'd my email open rates"
                value={clusterForm.title}
                onChange={(e) => setClusterForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Core idea</label>
              <Textarea
                placeholder="Describe the core concept or topic..."
                rows={3}
                value={clusterForm.text}
                onChange={(e) => setClusterForm((f) => ({ ...f, text: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Platform</label>
                <Select
                  value={clusterForm.platform}
                  onValueChange={(v) => setClusterForm((f) => ({ ...f, platform: v as Platform }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PLATFORM_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Format</label>
                <Select
                  value={clusterForm.format}
                  onValueChange={(v) => setClusterForm((f) => ({ ...f, format: v as ContentFormat }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((fmt) => (
                      <SelectItem key={fmt} value={fmt}>
                        {fmt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setClusterDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateCluster}
                disabled={!clusterForm.title.trim() || !clusterForm.text.trim()}
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add idea dialog ─────────────────────────────────────────────── */}
      <Dialog open={ideaDialogOpen} onOpenChange={setIdeaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Derivative Idea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Platform</label>
                <Select
                  value={ideaForm.platform}
                  onValueChange={(v) => setIdeaForm((f) => ({ ...f, platform: v as Platform }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PLATFORM_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Format</label>
                <Select
                  value={ideaForm.format}
                  onValueChange={(v) => setIdeaForm((f) => ({ ...f, format: v as ContentFormat }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((fmt) => (
                      <SelectItem key={fmt} value={fmt}>
                        {fmt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Idea / angle</label>
              <Textarea
                placeholder="Describe the angle or hook for this platform..."
                rows={3}
                value={ideaForm.angle}
                onChange={(e) => setIdeaForm((f) => ({ ...f, angle: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setIdeaDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddIdea}
                disabled={!ideaForm.angle.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit idea dialog ────────────────────────────────────────────── */}
      <Dialog open={editIdeaDialogOpen} onOpenChange={setEditIdeaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Idea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Platform</label>
                <Select
                  value={editIdeaForm.platform}
                  onValueChange={(v) => setEditIdeaForm((f) => ({ ...f, platform: v as Platform }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PLATFORM_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Format</label>
                <Select
                  value={editIdeaForm.format}
                  onValueChange={(v) => setEditIdeaForm((f) => ({ ...f, format: v as ContentFormat }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((fmt) => (
                      <SelectItem key={fmt} value={fmt}>
                        {fmt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Idea / angle</label>
              <Textarea
                placeholder="Describe the angle or hook..."
                rows={3}
                value={editIdeaForm.angle}
                onChange={(e) => setEditIdeaForm((f) => ({ ...f, angle: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setEditIdeaDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleEditIdea}
                disabled={!editIdeaForm.angle.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
