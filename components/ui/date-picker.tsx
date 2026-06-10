"use client"

import { useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

interface DatePickerProps {
  value?: string // "YYYY-MM-DD"
  onChange: (date: string) => void
  placeholder?: string
  className?: string
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", className }: DatePickerProps) {
  const [open, setOpen] = useState(false)

  const parsed = value ? new Date(value + "T00:00:00") : null
  const now = new Date()
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? now.getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day: number) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    onChange(dateStr)
    setOpen(false)
  }

  const displayText = parsed
    ? parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : placeholder

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o)
      if (o && parsed) {
        setViewYear(parsed.getFullYear())
        setViewMonth(parsed.getMonth())
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal h-9 text-sm",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="mr-2 h-3.5 w-3.5 shrink-0" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        {/* Month/year nav */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={prevMonth}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-medium">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map(d => (
            <div key={d} className="text-center text-[10px] text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            const isSelected = dateStr === value
            const isToday = dateStr === todayStr
            return (
              <button
                key={day}
                onClick={() => selectDay(day)}
                className={cn(
                  "h-8 w-8 text-xs rounded-md transition-colors flex items-center justify-center",
                  isSelected
                    ? "bg-primary text-primary-foreground font-medium"
                    : isToday
                      ? "bg-secondary text-foreground font-medium"
                      : "text-foreground hover:bg-secondary/60"
                )}
              >
                {day}
              </button>
            )
          })}
        </div>

        {/* Clear button */}
        {value && (
          <div className="mt-2 pt-2 border-t border-border">
            <button
              onClick={() => { onChange(""); setOpen(false) }}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
