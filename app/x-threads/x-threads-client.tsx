"use client";

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Bookmark,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  GripVertical,
  PlusCircle,
  Plus,
  CopyPlus,
  CalendarDays,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { DuplicateToDialog } from "@/components/duplicate-to-dialog";
import { cn } from "@/lib/utils";
import { useXPosts, ALL_FORMATS, type XFormat } from "@/lib/use-x-posts";
import { useXBoard, type XBoardCard, type XStatus } from "@/lib/use-x-board";

interface GeneratedPost {
  format: XFormat;
  post: string;
  charCount: number;
}

const COLUMNS: { key: XStatus; label: string }[] = [
  { key: "ideas", label: "Ideas" },
  { key: "drafts", label: "Drafts" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
];

function charBadgeClasses(count: number) {
  if (count > 280) return "bg-red-500/15 text-red-400 border-red-500/20";
  if (count >= 240) return "bg-yellow-500/15 text-yellow-400 border-yellow-500/20";
  return "bg-green-500/15 text-green-400 border-green-500/20";
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Board Card ───────────────────────────────────────────────────────────────

function BoardCardItem({
  card,
  index,
  onUpdate,
  onDelete,
  onCopy,
  copiedId,
}: {
  card: XBoardCard;
  index: number;
  onUpdate: (id: string, updates: Partial<XBoardCard>) => void;
  onDelete: (id: string) => void;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [form, setForm] = useState<XBoardCard>({ ...card });

  useEffect(() => {
    if (!editOpen) setForm({ ...card });
  }, [card, editOpen]);

  function handleSave() {
    onUpdate(card.id, {
      text: form.text,
      format: form.format,
      scheduledDate: form.scheduledDate,
      url: form.url,
      impressions: form.impressions,
      likes: form.likes,
      replies: form.replies,
      reposts: form.reposts,
    });
    setEditOpen(false);
  }

  const preview = card.text.length > 180 ? card.text.slice(0, 180) + "…" : card.text;

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps}>
          <Card
            onClick={() => setEditOpen(true)}
            className={cn(
              "bg-card border-border group cursor-pointer transition-all duration-150",
              card.scheduledDate && "ring-2 ring-orange-400",
              snapshot.isDragging && "opacity-80 shadow-lg ring-1 ring-primary/30 rotate-[0.5deg]"
            )}
          >
            <CardContent className="p-3 max-h-[220px] overflow-hidden">
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
                <p className="text-sm leading-relaxed whitespace-pre-wrap flex-1 line-clamp-5">
                  {preview}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 ml-5 mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {card.format && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {card.format}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 h-4", charBadgeClasses(card.charCount))}
                  >
                    {card.charCount}/280
                  </Badge>
                </div>
                {card.scheduledDate && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDateShort(card.scheduledDate)}
                  </span>
                )}
              </div>

              <div
                className="flex items-center gap-1.5 ml-5"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                  onClick={() => onCopy(card.text, card.id)}
                >
                  {copiedId === card.id ? (
                    <Check className="h-3 w-3 text-green-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-red-400/70 hover:text-red-300"
                  onClick={() => onDelete(card.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {card.status === "published" && card.impressions !== undefined && (
                <div className="ml-5 mt-2 flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                  <span>{card.impressions?.toLocaleString()} imp</span>
                  {card.likes !== undefined && <span>{card.likes} ♥</span>}
                  {card.replies !== undefined && <span>{card.replies} 💬</span>}
                  {card.reposts !== undefined && <span>{card.reposts} 🔁</span>}
                  {card.url && (
                    <a
                      href={card.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline ml-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Dialog */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent
              className="max-w-md bg-card border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <DialogHeader>
                <DialogTitle className="text-sm">Edit Post</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Textarea
                  placeholder="Post text"
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                  rows={6}
                  className="bg-background border-border text-sm resize-none"
                />
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", charBadgeClasses(form.text.length))}
                  >
                    {form.text.length}/280
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={form.format ?? "none"}
                    onValueChange={(v) =>
                      setForm({ ...form, format: v === "none" ? undefined : (v as XFormat) })
                    }
                  >
                    <SelectTrigger className="bg-background border-border text-sm h-9">
                      <SelectValue placeholder="Format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No format</SelectItem>
                      {ALL_FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <DatePicker
                    value={form.scheduledDate ?? ""}
                    onChange={(v) => setForm({ ...form, scheduledDate: v })}
                    className="bg-background border-border text-sm h-9 w-full"
                  />
                </div>
                {form.status === "published" && (
                  <>
                    <Input
                      placeholder="Tweet URL"
                      value={form.url ?? ""}
                      onChange={(e) => setForm({ ...form, url: e.target.value })}
                      className="bg-background border-border text-sm"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      <Input
                        type="number"
                        placeholder="Imp"
                        value={form.impressions ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            impressions: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          })
                        }
                        className="bg-background border-border text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="Likes"
                        value={form.likes ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            likes: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          })
                        }
                        className="bg-background border-border text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="Replies"
                        value={form.replies ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            replies: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          })
                        }
                        className="bg-background border-border text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="Reposts"
                        value={form.reposts ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            reposts: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          })
                        }
                        className="bg-background border-border text-sm"
                      />
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground"
                      onClick={() => setDuplicateOpen(true)}
                    >
                      <CopyPlus className="h-3.5 w-3.5" />
                      Duplicate to...
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("gap-1.5", card.archived ? "text-orange-400" : "text-muted-foreground")}
                      onClick={() => {
                        onUpdate(card.id, { archived: !card.archived });
                        setEditOpen(false);
                      }}
                    >
                      {card.archived ? "Unarchive" : "Archive"}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditOpen(false)}
                      className="border-border"
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <DuplicateToDialog
            open={duplicateOpen}
            onOpenChange={setDuplicateOpen}
            text={card.text}
            currentBoard="x-threads"
          />
        </div>
      )}
    </Draggable>
  );
}

// ─── Add Card Dialog ──────────────────────────────────────────────────────────

function AddCardDialog({
  onAdd,
}: {
  onAdd: (card: Omit<XBoardCard, "id" | "createdAt" | "charCount">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [format, setFormat] = useState<XFormat | "none">("none");
  const [status, setStatus] = useState<XStatus>("ideas");
  const [scheduledDate, setScheduledDate] = useState("");

  function handleAdd() {
    if (!text.trim()) return;
    onAdd({
      text: text.trim(),
      status,
      format: format === "none" ? undefined : format,
      scheduledDate: scheduledDate || undefined,
    });
    setText("");
    setFormat("none");
    setStatus("ideas");
    setScheduledDate("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8"
      >
        <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
        Add Post
      </Button>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm">Add Post to Board</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            placeholder="What's the post?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="bg-background border-border text-sm resize-none"
          />
          <Badge variant="outline" className={cn("text-[10px]", charBadgeClasses(text.length))}>
            {text.length}/280
          </Badge>
          <div className="grid grid-cols-3 gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as XStatus)}>
              <SelectTrigger className="bg-background border-border text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMNS.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as XFormat | "none")}
            >
              <SelectTrigger className="bg-background border-border text-sm h-9">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No format</SelectItem>
                {ALL_FORMATS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DatePicker
              value={scheduledDate}
              onChange={setScheduledDate}
              className="bg-background border-border text-sm h-9 w-full"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={!text.trim()}>
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Board Tab ────────────────────────────────────────────────────────────────

function BoardTab() {
  const { cards, mounted, addCard, updateCard, removeCard, commit } = useXBoard();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [groupByDate, setGroupByDate] = useState(false);
  const [dateFilter, setDateFilter] = useState<"all" | "dated" | "undated" | "archived">("all");

  async function handleCopy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function sortByScheduled<T extends { scheduledDate?: string }>(items: T[]): T[] {
    if (!groupByDate) return items;
    const scheduled = items.filter((c) => c.scheduledDate);
    const unscheduled = items.filter((c) => !c.scheduledDate);
    return [...scheduled, ...unscheduled];
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;

    const srcCol = result.source.droppableId as XStatus;
    const dstCol = result.destination.droppableId as XStatus;
    const srcIdx = result.source.index;
    const dstIdx = result.destination.index;

    if (srcCol === dstCol && srcIdx === dstIdx) return;

    const colCards = (col: XStatus) => sortByScheduled(cards.filter((c) => c.status === col));

    if (srcCol === dstCol) {
      const items = [...colCards(srcCol)];
      const [moved] = items.splice(srcIdx, 1);
      items.splice(dstIdx, 0, moved);
      const colOrder: XStatus[] = ["ideas", "drafts", "scheduled", "published"];
      const rebuild: XBoardCard[] = [];
      for (const col of colOrder) {
        if (col === srcCol) rebuild.push(...items);
        else rebuild.push(...cards.filter((c) => c.status === col));
      }
      commit(rebuild);
    } else {
      const srcItems = [...colCards(srcCol)];
      const dstItems = [...colCards(dstCol)];
      const [moved] = srcItems.splice(srcIdx, 1);
      const updated = { ...moved, status: dstCol };
      dstItems.splice(dstIdx, 0, updated);
      const colOrder: XStatus[] = ["ideas", "drafts", "scheduled", "published"];
      const rebuild: XBoardCard[] = [];
      for (const col of colOrder) {
        if (col === srcCol) rebuild.push(...srcItems);
        else if (col === dstCol) rebuild.push(...dstItems);
        else rebuild.push(...cards.filter((c) => c.status === col));
      }
      commit(rebuild);
    }
  }

  if (!mounted) return null;

  const counts = COLUMNS.reduce((acc, col) => {
    acc[col.key] = cards.filter((c) => c.status === col.key).length;
    return acc;
  }, {} as Record<XStatus, number>);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(["all", "dated", "undated", "archived"] as const).map((f) => (
            <Button
              key={f}
              variant={dateFilter === f ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-[11px] px-2.5 shrink-0"
              onClick={() => setDateFilter(f)}
            >
              {f === "all" ? "All" : f === "dated" ? "Has date" : f === "undated" ? "No date" : "Archived"}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={groupByDate ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setGroupByDate(!groupByDate)}
          >
            <CalendarDays size={13} />
            {groupByDate ? "Grouped" : "Group by date"}
          </Button>
          <AddCardDialog onAdd={addCard} />
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colCards = sortByScheduled(
              cards.filter((c) => c.status === col.key)
                .filter((c) => {
                  if (dateFilter === "archived") return !!c.archived;
                  if (c.archived) return false;
                  if (dateFilter === "all") return true;
                  if (dateFilter === "dated") return !!c.scheduledDate;
                  return !c.scheduledDate;
                })
            );
            return (
              <div key={col.key} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {col.label}
                  </h3>
                  <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                    {counts[col.key]}
                  </span>
                </div>

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
                      {colCards.map((card, index) => (
                        <BoardCardItem
                          key={card.id}
                          card={card}
                          index={index}
                          onUpdate={updateCard}
                          onDelete={removeCard}
                          onCopy={handleCopy}
                          copiedId={copiedId}
                        />
                      ))}
                      {provided.placeholder}
                      {colCards.length === 0 && (
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
    </div>
  );
}

// ─── Generator Tab (existing 3-posts flow) ────────────────────────────────────

function GeneratorTab() {
  const { posts, mounted, savePost, remove } = useXPosts();
  const { addCard } = useXBoard();

  const [idea, setIdea] = useState("");
  const [results, setResults] = useState<GeneratedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<XFormat[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  function toggleFormat(format: XFormat) {
    setSelectedFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : prev.length >= 3
          ? prev
          : [...prev, format]
    );
  }

  async function handleGenerate() {
    if (!idea.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch("/api/x-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          formats: selectedFormats.length > 0 ? selectedFormats : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      setResults(
        data.results.map((r: { format: XFormat; post: string }) => ({
          ...r,
          charCount: r.post.length,
        }))
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate(format: XFormat, index: number) {
    setRegenerating(index);
    try {
      const res = await fetch("/api/x-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, formats: [format] }),
      });
      const data = await res.json();
      if (!res.ok || data.error) return;
      setResults((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                format: data.results[0].format,
                post: data.results[0].post,
                charCount: data.results[0].post.length,
              }
            : r
        )
      );
    } finally {
      setRegenerating(null);
    }
  }

  async function handleCopy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleSave(result: GeneratedPost) {
    savePost({
      idea,
      format: result.format,
      post: result.post,
      charCount: result.charCount,
    });
  }

  function handleAddToBoard(result: GeneratedPost, index: number) {
    addCard({
      text: result.post,
      status: "drafts",
      format: result.format,
      idea,
    });
    const id = `added-${index}`;
    setAddedId(id);
    setTimeout(() => setAddedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Input */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Textarea
            placeholder="Your rough idea or thought... (e.g. 'Most people overcomplicate automation. The best systems are boring and reliable.')"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={4}
            className="resize-none"
          />

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Pick up to 3 formats (or leave empty to auto-pick):
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_FORMATS.map((format) => {
                const selected = selectedFormats.includes(format);
                return (
                  <Badge
                    key={format}
                    variant="outline"
                    className={cn(
                      "cursor-pointer transition-colors text-xs",
                      selected
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "hover:bg-muted"
                    )}
                    onClick={() => toggleFormat(format)}
                  >
                    {format}
                  </Badge>
                );
              })}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !idea.trim()}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {loading ? "Generating..." : "Generate 3 Posts"}
          </Button>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Generated Posts</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {results.map((result, i) => (
              <Card key={`${result.format}-${i}`} className="flex flex-col">
                <CardContent className="pt-5 flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {result.format}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", charBadgeClasses(result.charCount))}
                    >
                      {result.charCount}/280
                    </Badge>
                  </div>

                  <p className="text-sm whitespace-pre-wrap flex-1 leading-relaxed">
                    {result.post}
                  </p>

                  <div className="flex items-center flex-wrap gap-1.5 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => handleCopy(result.post, `result-${i}`)}
                    >
                      {copiedId === `result-${i}` ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span className="ml-1.5 text-xs">
                        {copiedId === `result-${i}` ? "Copied" : "Copy"}
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      disabled={regenerating === i}
                      onClick={() => handleRegenerate(result.format, i)}
                    >
                      <RefreshCw
                        className={cn(
                          "h-3.5 w-3.5",
                          regenerating === i && "animate-spin"
                        )}
                      />
                      <span className="ml-1.5 text-xs">Redo</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => handleSave(result)}
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      <span className="ml-1.5 text-xs">Save</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-primary hover:text-primary"
                      onClick={() => handleAddToBoard(result, i)}
                    >
                      {addedId === `added-${i}` ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      <span className="ml-1.5 text-xs">
                        {addedId === `added-${i}` ? "Added" : "To Board"}
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Saved History */}
      {mounted && posts.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {historyOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Saved Posts ({posts.length})
          </button>

          {historyOpen && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {posts.map((post) => (
                  <Card key={post.id}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {post.format}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              charBadgeClasses(post.charCount)
                            )}
                          >
                            {post.charCount}/280
                          </Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(post.savedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {post.post}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Idea: {post.idea}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => handleCopy(post.post, post.id)}
                        >
                          {copiedId === post.id ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          <span className="ml-1 text-xs">
                            {copiedId === post.id ? "Copied" : "Copy"}
                          </span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => {
                            addCard({
                              text: post.post,
                              status: "drafts",
                              format: post.format,
                              idea: post.idea,
                            });
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          <span className="ml-1 text-xs">To Board</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-red-400 hover:text-red-300"
                          onClick={() => remove(post.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="ml-1 text-xs">Delete</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function XThreadsClient() {
  return (
    <div className="p-4 md:p-6">
      <Tabs defaultValue="board">
        <TabsList className="mb-6">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="generator">Generator</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <BoardTab />
        </TabsContent>

        <TabsContent value="generator">
          <GeneratorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
