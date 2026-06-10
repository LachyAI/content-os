"use client";

import { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  Copy,
  Check,
  Trash2,
  GripVertical,
  PlusCircle,
  CopyPlus,
  CalendarDays,
  FileText,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { DuplicateToDialog } from "@/components/duplicate-to-dialog";
import { cn } from "@/lib/utils";
import {
  useFbBoard,
  ALL_FB_POST_TYPES,
  ALL_FB_FORMATS,
  type FbBoardCard,
  type FbStatus,
  type FbPostType,
  type FbFormat,
} from "@/lib/use-fb-board";

const COLUMNS: { key: FbStatus; label: string }[] = [
  { key: "ideas", label: "Ideas" },
  { key: "drafts", label: "Drafts" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
];

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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
  card: FbBoardCard;
  index: number;
  onUpdate: (id: string, updates: Partial<FbBoardCard>) => void;
  onDelete: (id: string) => void;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [form, setForm] = useState<FbBoardCard>({ ...card });

  useEffect(() => {
    if (!editOpen) setForm({ ...card });
  }, [card, editOpen]);

  function handleSave() {
    onUpdate(card.id, {
      text: form.text,
      postType: form.postType,
      format: form.format,
      reelScript: form.reelScript,
      scheduledDate: form.scheduledDate,
      url: form.url,
      reactions: form.reactions,
      comments: form.comments,
      shares: form.shares,
    });
    setEditOpen(false);
  }

  const preview =
    card.text.length > 200 ? card.text.slice(0, 200) + "…" : card.text;

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps}>
          <Card
            onClick={() => setEditOpen(true)}
            className={cn(
              "bg-card border-border group cursor-pointer transition-all duration-150",
              card.scheduledDate && "ring-2 ring-orange-400",
              snapshot.isDragging &&
                "opacity-80 shadow-lg ring-1 ring-primary/30 rotate-[0.5deg]"
            )}
          >
            <CardContent className="p-3 max-h-[240px] overflow-hidden">
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
                <p className="text-sm leading-relaxed whitespace-pre-wrap flex-1 line-clamp-6">
                  {preview}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 ml-5 mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {card.format && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 capitalize"
                    >
                      {card.format}
                    </Badge>
                  )}
                  {card.postType && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-4"
                    >
                      {card.postType}
                    </Badge>
                  )}
                  {card.reelScript?.trim() && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 gap-0.5 text-primary border-primary/40"
                    >
                      <FileText size={9} />
                      Script
                    </Badge>
                  )}
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

              {card.status === "published" &&
                card.reactions !== undefined && (
                  <div className="ml-5 mt-2 flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                    <span>{card.reactions?.toLocaleString()} reactions</span>
                    {card.comments !== undefined && (
                      <span>{card.comments} comments</span>
                    )}
                    {card.shares !== undefined && (
                      <span>{card.shares} shares</span>
                    )}
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
              className="max-w-md max-h-[85vh] overflow-y-auto bg-card border-border"
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
                  rows={8}
                  className="bg-background border-border text-sm resize-none"
                />
                <div className="grid grid-cols-3 gap-3">
                  <Select
                    value={form.format ?? "none"}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        format: v === "none" ? undefined : (v as FbFormat),
                      })
                    }
                  >
                    <SelectTrigger className="bg-background border-border text-sm h-9">
                      <SelectValue placeholder="Format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No format</SelectItem>
                      {ALL_FB_FORMATS.map((f) => (
                        <SelectItem key={f} value={f} className="capitalize">
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={form.postType ?? "none"}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        postType:
                          v === "none" ? undefined : (v as FbPostType),
                      })
                    }
                  >
                    <SelectTrigger className="bg-background border-border text-sm h-9">
                      <SelectValue placeholder="Post type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No type</SelectItem>
                      {ALL_FB_POST_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
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
                {(form.format === "reel" || form.format === "video") && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Reel script
                    </label>
                    <Textarea
                      placeholder="Hook, beats, CTA — paste your reel script here"
                      value={form.reelScript ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, reelScript: e.target.value })
                      }
                      rows={6}
                      className="bg-background border-border text-sm resize-none"
                    />
                  </div>
                )}
                {form.status === "published" && (
                  <>
                    <Input
                      placeholder="Post URL"
                      value={form.url ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, url: e.target.value })
                      }
                      className="bg-background border-border text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        placeholder="Reactions"
                        value={form.reactions ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            reactions: e.target.value
                              ? parseInt(e.target.value, 10)
                              : undefined,
                          })
                        }
                        className="bg-background border-border text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="Comments"
                        value={form.comments ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            comments: e.target.value
                              ? parseInt(e.target.value, 10)
                              : undefined,
                          })
                        }
                        className="bg-background border-border text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="Shares"
                        value={form.shares ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            shares: e.target.value
                              ? parseInt(e.target.value, 10)
                              : undefined,
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
            currentBoard="fb-groups"
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
  onAdd: (card: Omit<FbBoardCard, "id" | "createdAt">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [postType, setPostType] = useState<FbPostType | "none">("none");
  const [format, setFormat] = useState<FbFormat | "none">("none");
  const [status, setStatus] = useState<FbStatus>("ideas");
  const [scheduledDate, setScheduledDate] = useState("");

  function handleAdd() {
    if (!text.trim()) return;
    onAdd({
      text: text.trim(),
      status,
      postType: postType === "none" ? undefined : postType,
      format: format === "none" ? undefined : format,
      scheduledDate: scheduledDate || undefined,
    });
    setText("");
    setPostType("none");
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
            placeholder="Paste your GPT-generated post or write an idea..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="bg-background border-border text-sm resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as FbStatus)}
            >
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
              onValueChange={(v) => setFormat(v as FbFormat | "none")}
            >
              <SelectTrigger className="bg-background border-border text-sm h-9">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No format</SelectItem>
                {ALL_FB_FORMATS.map((f) => (
                  <SelectItem key={f} value={f} className="capitalize">
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={postType}
              onValueChange={(v) => setPostType(v as FbPostType | "none")}
            >
              <SelectTrigger className="bg-background border-border text-sm h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No type</SelectItem>
                {ALL_FB_POST_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
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

// ─── Main Board ──────────────────────────────────────────────────────────────

export function FbGroupsClient() {
  const { cards, mounted, addCard, updateCard, removeCard, commit } =
    useFbBoard();
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

    const srcCol = result.source.droppableId as FbStatus;
    const dstCol = result.destination.droppableId as FbStatus;
    const srcIdx = result.source.index;
    const dstIdx = result.destination.index;

    if (srcCol === dstCol && srcIdx === dstIdx) return;

    const colCards = (col: FbStatus) =>
      sortByScheduled(cards.filter((c) => c.status === col));

    if (srcCol === dstCol) {
      const items = [...colCards(srcCol)];
      const [moved] = items.splice(srcIdx, 1);
      items.splice(dstIdx, 0, moved);
      const colOrder: FbStatus[] = [
        "ideas",
        "drafts",
        "scheduled",
        "published",
      ];
      const rebuild: FbBoardCard[] = [];
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
      const colOrder: FbStatus[] = [
        "ideas",
        "drafts",
        "scheduled",
        "published",
      ];
      const rebuild: FbBoardCard[] = [];
      for (const col of colOrder) {
        if (col === srcCol) rebuild.push(...srcItems);
        else if (col === dstCol) rebuild.push(...dstItems);
        else rebuild.push(...cards.filter((c) => c.status === col));
      }
      commit(rebuild);
    }
  }

  if (!mounted) return null;

  const counts = COLUMNS.reduce(
    (acc, col) => {
      acc[col.key] = cards.filter((c) => c.status === col.key).length;
      return acc;
    },
    {} as Record<FbStatus, number>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
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
