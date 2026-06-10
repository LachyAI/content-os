'use client'

import { useSupabaseBoard, type BoardCard } from "@/lib/use-supabase-board";

export type FbBizStatus = "ideas" | "drafts" | "scheduled" | "published";

export type FbBizPostType =
  | "Question"
  | "Value Post"
  | "Before / After"
  | "Tip / Hack"
  | "Engagement Bait"
  | "Offer / CTA"
  | "Story / Personal"
  | "Poll";

export type FbBizFormat = "post" | "story" | "reel" | "video" | "photo" | "text";

export const ALL_FB_BIZ_FORMATS: FbBizFormat[] = [
  "post",
  "story",
  "reel",
  "video",
  "photo",
  "text",
];

export const ALL_FB_BIZ_POST_TYPES: FbBizPostType[] = [
  "Question",
  "Value Post",
  "Before / After",
  "Tip / Hack",
  "Engagement Bait",
  "Offer / CTA",
  "Story / Personal",
  "Poll",
];

export interface FbBizBoardCard extends BoardCard {
  status: FbBizStatus;
  postType?: FbBizPostType;
  format?: FbBizFormat;
  reelScript?: string;
  scheduledDate?: string;
  url?: string;
  reactions?: number;
  comments?: number;
  shares?: number;
}

export function useFbBizBoard() {
  return useSupabaseBoard<FbBizBoardCard>("fb-biz", "fbb");
}
