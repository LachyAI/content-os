'use client'

import { useSupabaseBoard, type BoardCard } from "@/lib/use-supabase-board";

export type FbStatus = "ideas" | "drafts" | "scheduled" | "published";

export type FbPostType =
  | "Question"
  | "Value Post"
  | "Before / After"
  | "Tip / Hack"
  | "Engagement Bait"
  | "Offer / CTA"
  | "Story / Personal"
  | "Poll";

export type FbFormat = "post" | "story" | "reel" | "video" | "photo" | "text";

export const ALL_FB_FORMATS: FbFormat[] = [
  "post",
  "story",
  "reel",
  "video",
  "photo",
  "text",
];

export const ALL_FB_POST_TYPES: FbPostType[] = [
  "Question",
  "Value Post",
  "Before / After",
  "Tip / Hack",
  "Engagement Bait",
  "Offer / CTA",
  "Story / Personal",
  "Poll",
];

export interface FbBoardCard extends BoardCard {
  status: FbStatus;
  postType?: FbPostType;
  format?: FbFormat;
  reelScript?: string;
  scheduledDate?: string;
  url?: string;
  reactions?: number;
  comments?: number;
  shares?: number;
}

export function useFbBoard() {
  return useSupabaseBoard<FbBoardCard>("fb-groups", "fb");
}
