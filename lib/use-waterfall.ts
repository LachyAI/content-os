'use client'

import { useState, useEffect, useCallback } from "react";

export type Platform = "blog" | "linkedin" | "instagram" | "youtube" | "x-threads" | "fb-groups";

export type ContentFormat =
  | "Long-form Article"
  | "Text Post"
  | "Carousel"
  | "Reel / Short"
  | "Thread"
  | "Question"
  | "Poll"
  | "Story"
  | "Newsletter"
  | "Video Essay";

export interface WaterfallIdea {
  id: string;
  text: string;
  platform: Platform;
  format: ContentFormat;
  parentId: string | null;
  createdAt: string;
  angle?: string;
}

export interface WaterfallCluster {
  id: string;
  title: string;
  rootIdea: string;
  ideas: WaterfallIdea[];
  createdAt: string;
}

const STORAGE_KEY = "content-os-waterfall-clusters";

function load(): WaterfallCluster[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WaterfallCluster[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(clusters: WaterfallCluster[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clusters));
  } catch {}
}

function newId() {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? `wf-${Math.random().toString(36).slice(2, 9)}`;
}

export function useWaterfall() {
  const [clusters, setClusters] = useState<WaterfallCluster[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setClusters(load());
    setMounted(true);
  }, []);

  const addCluster = useCallback(
    (draft: { title: string; rootIdea: Omit<WaterfallIdea, "id" | "createdAt"> }) => {
      const rootIdea: WaterfallIdea = {
        id: newId(),
        text: draft.rootIdea.text,
        platform: draft.rootIdea.platform,
        format: draft.rootIdea.format,
        parentId: null,
        createdAt: new Date().toISOString(),
        angle: draft.rootIdea.angle,
      };
      const cluster: WaterfallCluster = {
        id: newId(),
        title: draft.title,
        rootIdea: rootIdea.text,
        ideas: [rootIdea],
        createdAt: new Date().toISOString(),
      };
      setClusters((prev) => {
        const next = [cluster, ...prev];
        persist(next);
        return next;
      });
      return cluster;
    },
    []
  );

  const updateCluster = useCallback((id: string, updates: Partial<WaterfallCluster>) => {
    setClusters((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      persist(next);
      return next;
    });
  }, []);

  const removeCluster = useCallback((id: string) => {
    setClusters((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const addIdea = useCallback(
    (clusterId: string, draft: Omit<WaterfallIdea, "id" | "createdAt">) => {
      const idea: WaterfallIdea = {
        ...draft,
        id: newId(),
        createdAt: new Date().toISOString(),
      };
      setClusters((prev) => {
        const next = prev.map((c) =>
          c.id === clusterId ? { ...c, ideas: [...c.ideas, idea] } : c
        );
        persist(next);
        return next;
      });
      return idea;
    },
    []
  );

  const updateIdea = useCallback(
    (clusterId: string, ideaId: string, updates: Partial<WaterfallIdea>) => {
      setClusters((prev) => {
        const next = prev.map((c) =>
          c.id === clusterId
            ? {
                ...c,
                ideas: c.ideas.map((i) =>
                  i.id === ideaId ? { ...i, ...updates } : i
                ),
              }
            : c
        );
        persist(next);
        return next;
      });
    },
    []
  );

  const removeIdea = useCallback((clusterId: string, ideaId: string) => {
    setClusters((prev) => {
      const next = prev.map((c) =>
        c.id === clusterId
          ? { ...c, ideas: c.ideas.filter((i) => i.id !== ideaId) }
          : c
      );
      persist(next);
      return next;
    });
  }, []);

  return {
    clusters,
    mounted,
    addCluster,
    updateCluster,
    removeCluster,
    addIdea,
    updateIdea,
    removeIdea,
  };
}
