"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  duplicateCardTo,
  BOARD_TARGETS,
  type BoardTarget,
} from "@/lib/duplicate-card"

interface DuplicateToDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  text: string
  currentBoard: BoardTarget
}

export function DuplicateToDialog({
  open,
  onOpenChange,
  text,
  currentBoard,
}: DuplicateToDialogProps) {
  const [duplicatedTo, setDuplicatedTo] = useState<BoardTarget | null>(null)

  const targets = BOARD_TARGETS.filter((t) => t.key !== currentBoard)

  async function handleDuplicate(target: BoardTarget) {
    const ok = await duplicateCardTo(text, target)
    if (ok) {
      setDuplicatedTo(target)
      setTimeout(() => {
        setDuplicatedTo(null)
        onOpenChange(false)
      }, 1200)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm">Duplicate to...</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 pt-1">
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {text.slice(0, 120)}{text.length > 120 ? "..." : ""}
          </p>
          {targets.map((t) => {
            const isDone = duplicatedTo === t.key
            return (
              <button
                key={t.key}
                onClick={() => handleDuplicate(t.key)}
                disabled={isDone}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm text-left transition-colors",
                  isDone
                    ? "bg-green-500/10 text-green-400"
                    : "hover:bg-secondary/60 text-foreground"
                )}
              >
                <span>{t.label}</span>
                {isDone && <Check size={14} className="text-green-400" />}
              </button>
            )
          })}
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
