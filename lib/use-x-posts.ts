'use client'

import { useState, useEffect, useCallback } from "react";

export type XFormat =
  | "Bullet Insight"
  | "Contrast / Reframe"
  | "Single Principle"
  | "Dense Paragraph"
  | "Dialogue"
  | "Escalating Lines"
  | "Soft CTA";

export const ALL_FORMATS: XFormat[] = [
  "Bullet Insight",
  "Contrast / Reframe",
  "Single Principle",
  "Dense Paragraph",
  "Dialogue",
  "Escalating Lines",
  "Soft CTA",
];

export interface SavedXPost {
  id: string;
  idea: string;
  format: XFormat;
  post: string;
  charCount: number;
  savedAt: string;
}

const STORAGE_KEY = "content-os-x-posts";

function load(): SavedXPost[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedXPost[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(posts: SavedXPost[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch {
    // ignore quota errors
  }
}

function newId() {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useXPosts() {
  const [posts, setPosts] = useState<SavedXPost[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPosts(load());
    setMounted(true);
  }, []);

  const savePost = useCallback(
    (draft: Omit<SavedXPost, "id" | "savedAt">): SavedXPost => {
      const saved: SavedXPost = {
        ...draft,
        id: newId(),
        savedAt: new Date().toISOString(),
      };
      setPosts((prev) => {
        const next = [saved, ...prev];
        save(next);
        return next;
      });
      return saved;
    },
    []
  );

  const remove = useCallback((id: string) => {
    setPosts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      save(next);
      return next;
    });
  }, []);

  return { posts, mounted, savePost, remove };
}
