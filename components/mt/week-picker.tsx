"use client"

import { MAX_WEEK, weekRangeLabel } from "@/lib/mt/model"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function WeekPicker({ week, current, onChange }: { week: number; current: number; onChange: (w: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-input bg-card p-0.5">
      <button
        type="button"
        aria-label="上一周"
        disabled={week <= 1}
        onClick={() => onChange(week - 1)}
        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <select
        aria-label="选择教学周"
        value={week}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-md bg-transparent px-1 text-sm font-medium"
      >
        {Array.from({ length: MAX_WEEK }, (_, i) => i + 1).map((w) => (
          <option key={w} value={w}>
            第 {w} 周 · {weekRangeLabel(w)}
            {w === current ? "（本周）" : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label="下一周"
        disabled={week >= MAX_WEEK}
        onClick={() => onChange(week + 1)}
        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
      {week !== current ? (
        <button type="button" onClick={() => onChange(current)} className="rounded-md px-2 text-xs text-primary hover:underline">
          回到本周
        </button>
      ) : null}
    </div>
  )
}
