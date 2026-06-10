'use client'

import { useSupabaseBoard, type BoardCard } from "@/lib/use-supabase-board";
import type { XFormat } from "@/lib/use-x-posts";

export type XStatus = "ideas" | "drafts" | "scheduled" | "published";

export interface XBoardCard extends BoardCard {
  status: XStatus;
  format?: XFormat;
  idea?: string;
  charCount: number;
  scheduledDate?: string;
  url?: string;
  impressions?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
}

export function useXBoard() {
  return useSupabaseBoard<XBoardCard>("x-threads", "x");
}
