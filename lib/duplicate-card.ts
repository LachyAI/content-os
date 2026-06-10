'use client'

import { supabase } from "@/lib/supabase"

export type BoardTarget = "fb-groups" | "fb-personal" | "fb-biz" | "linkedin" | "x-threads" | "instagram" | "youtube"

export const BOARD_TARGETS: { key: BoardTarget; label: string }[] = [
  { key: "fb-groups", label: "FB Groups" },
  { key: "fb-personal", label: "FB Personal" },
  { key: "fb-biz", label: "FB Biz Page" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "x-threads", label: "X / Threads" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
]

function newId(prefix: string) {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } }
  return g.crypto?.randomUUID?.() ?? `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

const ID_PREFIX: Record<BoardTarget, string> = {
  "fb-groups": "fb",
  "fb-personal": "fbp",
  "fb-biz": "fbb",
  "linkedin": "li",
  "x-threads": "x",
  "instagram": "ig",
  "youtube": "yt",
}

export async function duplicateCardTo(text: string, target: BoardTarget): Promise<boolean> {
  try {
    const now = new Date().toISOString()
    const id = newId(ID_PREFIX[target])

    let data: Record<string, unknown> = { id, text, status: "ideas", createdAt: now }

    if (target === "x-threads") {
      data.charCount = text.length
    } else if (target === "instagram") {
      data = { id, title: text.slice(0, 80), caption: text, format: "reel", status: "ideas", createdAt: now }
    } else if (target === "youtube") {
      data = { id, title: text.slice(0, 100), description: text, format: "long", status: "ideas", createdAt: now }
    }

    const { error } = await supabase.from("board_cards").insert({
      id,
      board: target,
      data,
    })

    return !error
  } catch {
    return false
  }
}
