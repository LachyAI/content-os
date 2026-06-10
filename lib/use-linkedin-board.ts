'use client'

import { useSupabaseBoard, type BoardCard } from "@/lib/use-supabase-board";

export type LinkedInStatus = "ideas" | "drafts" | "scheduled" | "published";

export type LinkedInPostType =
  | "Text Post"
  | "Carousel"
  | "Article"
  | "Poll"
  | "Video"
  | "Document"
  | "Newsletter"
  | "Celebration";

export const ALL_LINKEDIN_POST_TYPES: LinkedInPostType[] = [
  "Text Post",
  "Carousel",
  "Article",
  "Poll",
  "Video",
  "Document",
  "Newsletter",
  "Celebration",
];

export interface LinkedInBoardCard extends BoardCard {
  status: LinkedInStatus;
  postType?: LinkedInPostType;
  scheduledDate?: string;
  url?: string;
  reactions?: number;
  comments?: number;
  reposts?: number;
  impressions?: number;
}

export function useLinkedInBoard() {
  return useSupabaseBoard<LinkedInBoardCard>("linkedin", "li");
}
