'use client'

import { useState, useEffect, useCallback } from "react";
import type { Post } from "@/lib/competitor-data";

const PINNED_KEY = "pinned-posts";

export interface PinnedPost extends Post {
  pinnedAt: string;
}

function loadPinned(): PinnedPost[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? (JSON.parse(raw) as PinnedPost[]) : [];
  } catch {
    return [];
  }
}

function savePinned(posts: PinnedPost[]) {
  try {
    localStorage.setItem(PINNED_KEY, JSON.stringify(posts));
  } catch {
    // ignore quota errors
  }
}

export function usePinnedPosts() {
  const [pinned, setPinned] = useState<PinnedPost[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPinned(loadPinned());
    setMounted(true);
  }, []);

  const isPinned = useCallback(
    (post: Post) => pinned.some((p) => p.link_user === post.link_user),
    [pinned]
  );

  const togglePin = useCallback((post: Post) => {
    setPinned((prev) => {
      const exists = prev.some((p) => p.link_user === post.link_user);
      const next = exists
        ? prev.filter((p) => p.link_user !== post.link_user)
        : [...prev, { ...post, pinnedAt: new Date().toISOString() }];
      savePinned(next);
      return next;
    });
  }, []);

  const unpin = useCallback((post: Post) => {
    setPinned((prev) => {
      const next = prev.filter((p) => p.link_user !== post.link_user);
      savePinned(next);
      return next;
    });
  }, []);

  return { pinned, isPinned, togglePin, unpin, pinnedCount: pinned.length, mounted };
}
