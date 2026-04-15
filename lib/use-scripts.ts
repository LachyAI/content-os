'use client'

import { useState, useEffect, useCallback } from "react";

export type ScriptFormat = "reel" | "post" | "album" | "story" | "ig-pc" | "ig-raw";

export interface SavedScript {
  id: string;
  title: string;
  caption: string;
  script: string;
  notes: string;
  format: ScriptFormat;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "content-os-ig-scripts";

function load(): SavedScript[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedScript[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(scripts: SavedScript[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
  } catch {
    // ignore quota errors
  }
}

function newId() {
  // Prefer crypto.randomUUID when available
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export type ScriptDraft = {
  id?: string;
  title: string;
  caption: string;
  script: string;
  notes: string;
  format: ScriptFormat;
  tags?: string[];
};

export function useScripts() {
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setScripts(load());
    setMounted(true);
  }, []);

  const upsert = useCallback((draft: ScriptDraft): SavedScript => {
    const now = new Date().toISOString();
    let saved: SavedScript;
    setScripts((prev) => {
      let next: SavedScript[];
      if (draft.id) {
        const existing = prev.find((s) => s.id === draft.id);
        saved = {
          id: draft.id,
          title: draft.title,
          caption: draft.caption,
          script: draft.script,
          notes: draft.notes ?? existing?.notes ?? "",
          format: draft.format,
          tags: draft.tags ?? existing?.tags ?? [],
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        next = prev.map((p) => (p.id === draft.id ? saved : p));
      } else {
        saved = {
          id: newId(),
          title: draft.title,
          caption: draft.caption,
          script: draft.script,
          notes: draft.notes ?? "",
          format: draft.format,
          tags: draft.tags ?? [],
          createdAt: now,
          updatedAt: now,
        };
        next = [saved, ...prev];
      }
      save(next);
      return next;
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return saved!;
  }, []);

  const remove = useCallback((id: string) => {
    setScripts((prev) => {
      const next = prev.filter((s) => s.id !== id);
      save(next);
      return next;
    });
  }, []);

  const getById = useCallback(
    (id: string | undefined | null): SavedScript | undefined => {
      if (!id) return undefined;
      return scripts.find((s) => s.id === id);
    },
    [scripts]
  );

  return { scripts, mounted, upsert, remove, getById };
}
