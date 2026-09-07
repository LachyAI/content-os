'use client'

import { useSupabaseBoard, type BoardCard } from "@/lib/use-supabase-board";

export type TiktokStatus = "ideas" | "drafts" | "scheduled" | "published";

export type TiktokPostType =
  | "Talking Head"
  | "Tutorial / How-To"
  | "Trend / Sound"
  | "Value Post"
  | "Before / After"
  | "Story / Personal"
  | "Engagement Bait"
  | "Offer / CTA";

export type TiktokFormat = "video" | "photo carousel" | "story";

export const ALL_TIKTOK_FORMATS: TiktokFormat[] = [
  "video",
  "photo carousel",
  "story",
];

export const ALL_TIKTOK_POST_TYPES: TiktokPostType[] = [
  "Talking Head",
  "Tutorial / How-To",
  "Trend / Sound",
  "Value Post",
  "Before / After",
  "Story / Personal",
  "Engagement Bait",
  "Offer / CTA",
];

export interface TiktokBoardCard extends BoardCard {
  status: TiktokStatus;
  postType?: TiktokPostType;
  format?: TiktokFormat;
  script?: string;
  scheduledDate?: string;
  url?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export function useTiktokBoard() {
  return useSupabaseBoard<TiktokBoardCard>("tiktok", "tt");
}
