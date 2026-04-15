'use client'

import { useState, useEffect, useCallback } from "react";

export type YTScriptFormat = "short" | "long" | "live";

export interface YTSavedScript {
  id: string;
  title: string;
  caption: string;
  script: string;
  notes: string;
  format: YTScriptFormat;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "content-os-yt-scripts";

function load(): YTSavedScript[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as YTSavedScript[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(scripts: YTSavedScript[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
  } catch {
    // ignore quota errors
  }
}

function newId() {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export type YTScriptDraft = {
  id?: string;
  title: string;
  caption: string;
  script: string;
  notes: string;
  format: YTScriptFormat;
  tags?: string[];
};

export function useYTScripts() {
  const [scripts, setScripts] = useState<YTSavedScript[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setScripts(load());
    setMounted(true);
  }, []);

  const upsert = useCallback((draft: YTScriptDraft): YTSavedScript => {
    const now = new Date().toISOString();
    let saved: YTSavedScript;
    setScripts((prev) => {
      let next: YTSavedScript[];
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
    (id: string | undefined | null): YTSavedScript | undefined => {
      if (!id) return undefined;
      return scripts.find((s) => s.id === id);
    },
    [scripts]
  );

  return { scripts, mounted, upsert, remove, getById };
}
