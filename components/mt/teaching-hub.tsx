"use client"

import { TaskListPage } from "@/components/mt/task-list"
import { WeekSchedulePage } from "@/components/mt/week-schedule"
import { cn } from "@/lib/utils"
import { useRouter, useSearchParams } from "next/navigation"

export type TeachingView = "tasks" | "lessons" | "days"

const VIEWS: [TeachingView, string][] = [
  ["tasks", "教学任务"],
  ["lessons", "课次安排"],
  ["days", "按日记录"],
]

const VIEW_PREF = "tgs-mt:teaching-view"

function readViewPref(): TeachingView {
  try {
    const v = window.localStorage.getItem(VIEW_PREF)
    return v === "lessons" || v === "days" ? v : "tasks"
  } catch {
    return "tasks"
  }
}

function writeViewPref(v: TeachingView) {
  try {
    window.localStorage.setItem(VIEW_PREF, v)
  } catch {
    /* 视图偏好写入失败不影响当前页面 */
  }
}

const VIEW_SCOPED_PARAMS = ["lesson", "day", "pane", "student", "focus", "q", "status"]

export function TeachingHub() {
  const sp = useSearchParams()
  const router = useRouter()
  const vq = sp.get("view")
  const view: TeachingView = vq === "tasks" || vq === "lessons" || vq === "days" ? vq : readViewPref()

  const setView = (v: TeachingView) => {
    writeViewPref(v)
    const p = new URLSearchParams(sp.toString())
    for (const k of VIEW_SCOPED_PARAMS) p.delete(k)
    p.set("view", v)
    router.replace(`/teaching?${p.toString()}`, { scroll: false })
  }

  const switcher = (
    <div role="radiogroup" aria-label="我的教学视图" className="inline-flex rounded-lg border border-border bg-muted p-0.5">
      {VIEWS.map(([k, label]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={view === k}
          onClick={() => setView(k)}
          className={cn(
            "h-8 rounded-md px-3 text-sm font-medium",
            view === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )

  return view === "tasks" ? <TaskListPage switcher={switcher} /> : <WeekSchedulePage view={view} switcher={switcher} />
}
