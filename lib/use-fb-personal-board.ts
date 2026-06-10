'use client'

import { useSupabaseBoard, type BoardCard } from "@/lib/use-supabase-board";

export type FbPersonalStatus = "ideas" | "drafts" | "scheduled" | "published";

export type FbPersonalPostType =
  | "Question"
  | "Value Post"
  | "Before / After"
  | "Tip / Hack"
  | "Engagement Bait"
  | "Offer / CTA"
  | "Story / Personal"
  | "Poll";

export type FbPersonalFormat = "post" | "story" | "reel" | "video" | "photo" | "text";

export const ALL_FB_PERSONAL_FORMATS: FbPersonalFormat[] = [
  "post",
  "story",
  "reel",
  "video",
  "photo",
  "text",
];

export const ALL_FB_PERSONAL_POST_TYPES: FbPersonalPostType[] = [
  "Question",
  "Value Post",
  "Before / After",
  "Tip / Hack",
  "Engagement Bait",
  "Offer / CTA",
  "Story / Personal",
  "Poll",
];

export interface FbPersonalBoardCard extends BoardCard {
  status: FbPersonalStatus;
  postType?: FbPersonalPostType;
  format?: FbPersonalFormat;
  reelScript?: string;
  scheduledDate?: string;
  url?: string;
  reactions?: number;
  comments?: number;
  shares?: number;
}

export function useFbPersonalBoard() {
  return useSupabaseBoard<FbPersonalBoardCard>("fb-personal", "fbp");
}
