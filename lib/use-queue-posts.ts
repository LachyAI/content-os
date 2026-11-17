'use client'

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Read-only cards written by C:\Dev\scripts\content-os-sync.mjs after each content batch (board "queue").
export interface QueueCard {
  id: string;
  text: string;
  status: "queued";
  createdAt: string;
  source: "ghl" | "fb";
  sourceStatus: string;
  date: string; // YYYY-MM-DD, Chiang Mai
  time: string | null; // "6:00pm", null for Facebook personal (he picks the time in Facebook)
  at: string;
  brand: string;
  platform: string;
  how: string;
  image: string | null;
  extraImages: number;
  label: string | null;
}

export const BRAND_DOT: Record<string, string> = {
  LachlanCB: "bg-sky-400",
  ClearScale: "bg-orange-500",
  "ACoS IQ": "bg-emerald-500",
};

export function brandDot(brand: string) {
  return BRAND_DOT[brand.split(" + ")[0]] ?? "bg-zinc-400";
}

export function todayChiangMai() {
  return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
}

export function useQueuePosts() {
  const [posts, setPosts] = useState<QueueCard[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    supabase
      .from("board_cards")
      .select("data")
      .eq("board", "queue")
      .then(({ data, error }) => {
        if (error) console.error("[queue] load error:", error.message);
        const cards = (data ?? []).map((row) => row.data as QueueCard);
        cards.sort((a, b) => a.at.localeCompare(b.at));
        setPosts(cards);
        setMounted(true);
      });
  }, []);

  return { posts, mounted };
}
