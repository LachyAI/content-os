'use client'

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { brandDot, type QueueCard } from "@/lib/use-queue-posts";

export function formatDay(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

export function QueuePostDialog({
  post,
  open,
  onOpenChange,
}: {
  post: QueueCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!post) return null;

  async function copy() {
    if (!post) return;
    await navigator.clipboard.writeText(post.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <span className={cn("w-2 h-2 rounded-full shrink-0", brandDot(post.brand))} />
            {post.platform}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>
              {formatDay(post.date)} · {post.time ?? "you pick the time in Facebook"} · {post.brand}
            </div>
            <div>{post.how}{post.source === "ghl" ? ` · ${post.sourceStatus}` : ""}</div>
            {post.label && <div>{post.label}</div>}
          </div>
          {post.image && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.image} alt="" className="w-full rounded-md border border-border object-cover max-h-80" />
              {post.extraImages > 0 && (
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">
                  +{post.extraImages} more
                </span>
              )}
            </div>
          )}
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy caption"}
          </button>
          <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">{post.text || "No caption"}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
