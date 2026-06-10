'use client'

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

export interface BoardCard {
  id: string;
  text: string;
  status: string;
  createdAt: string;
  archived?: boolean;
  [key: string]: unknown;
}

function newId(prefix: string) {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useSupabaseBoard<T extends BoardCard>(
  boardName: string,
  idPrefix: string
) {
  const [cards, setCards] = useState<T[]>([]);
  const [mounted, setMounted] = useState(false);
  const loading = useRef(false);

  useEffect(() => {
    if (loading.current) return;
    loading.current = true;

    supabase
      .from("board_cards")
      .select("id, data")
      .eq("board", boardName)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error(`[${boardName}] load error:`, error.message);
          setCards([]);
        } else {
          setCards((data ?? []).map((row) => ({ ...row.data, id: row.id } as T)));
        }
        setMounted(true);
        loading.current = false;
      });
  }, [boardName]);

  const commit = useCallback(
    async (next: T[]) => {
      setCards(next);
      const rows = next.map((card, i) => ({
        id: card.id,
        board: boardName,
        data: { ...card, sortOrder: i },
      }));
      await supabase.from("board_cards").upsert(rows, { onConflict: "id" });

      const keepIds = next.map((c) => c.id);
      if (keepIds.length > 0) {
        await supabase
          .from("board_cards")
          .delete()
          .eq("board", boardName)
          .not("id", "in", `(${keepIds.join(",")})`);
      }
    },
    [boardName]
  );

  const addCard = useCallback(
    async (draft: Omit<T, "id" | "createdAt"> & Record<string, unknown>) => {
      const card = {
        ...draft,
        id: newId(idPrefix),
        createdAt: new Date().toISOString(),
      } as T;

      setCards((prev) => [card, ...prev]);

      await supabase.from("board_cards").insert({
        id: card.id,
        board: boardName,
        data: card,
      });

      return card;
    },
    [boardName, idPrefix]
  );

  const updateCard = useCallback(
    async (id: string, updates: Partial<T>) => {
      setCards((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
        const updated = next.find((c) => c.id === id);
        if (updated) {
          supabase
            .from("board_cards")
            .update({ data: updated })
            .eq("id", id)
            .then(({ error }) => {
              if (error) console.error(`[${boardName}] update error:`, error.message);
            });
        }
        return next;
      });
    },
    [boardName]
  );

  const removeCard = useCallback(
    async (id: string) => {
      setCards((prev) => prev.filter((c) => c.id !== id));
      await supabase.from("board_cards").delete().eq("id", id);
    },
    []
  );

  return { cards, mounted, addCard, updateCard, removeCard, commit };
}
