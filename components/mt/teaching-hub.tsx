"use client"

import { TaskListPage } from "@/components/mt/task-list"
import { WeekSchedulePage } from "@/components/mt/week-schedule"
import { cn } from "@/lib/utils"
import { Settings2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { PageHeader, LinkButton } from "@/components/kit"
import { MtDemoBar, MtLoadError, MtLoading } from "@/components/mt/shared"
import { WeekPicker } from "@/components/mt/week-picker"
import { useMt } from "@/lib/mt/store"
import { currentWeek, permittedTasks, useTeacherId } from "@/lib/mt/derive"
import { classOf, MAX_WEEK, weekStart } from "@/lib/mt/model"

export type SettingsTab = "schemes" | "list" | "style" | "phrases"
export const SETTINGS_TABS: [SettingsTab, string][] = [
  ["schemes", "评价方案"],
  ["list", "作业与列表"],
  ["style", "显示样式"],
  ["phrases", "常用内容"],
]
const scrollKey = (ret: string) => `tgs-mt:scroll:${ret}`
/** 所有入口打开同一个设置工作区；明确的分类优先于上次访问的分类 */
export function settingsHref(ret: string, tab?: SettingsTab) {
  return `/teaching/settings?${tab ? `tab=${tab}&` : ""}ret=${encodeURIComponent(ret)}`
}

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
  const mt = useMt()
  const teacherId = useTeacherId()
  const cw = currentWeek(mt.biz)
  const wq = Number(sp.get("week"))
  const week = wq >= 1 && wq <= MAX_WEEK ? wq : cw
  const tasks = permittedTasks(mt.biz, teacherId)
  const classes = [...new Map(tasks.map(t => [t.class_id, classOf(t)])).values()]
  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value); else p.delete(key)
    if (key === "class") p.delete("task")
    router.replace(`/teaching?${p}`, { scroll: false })
  }
  useEffect(() => {
    if (!sp.get("week") && mt.ready) setParam("week", String(week))
  }, [mt.ready, sp, week])
  const vq = sp.get("view")
  const view: TeachingView = vq === "tasks" || vq === "lessons" || vq === "days" ? vq : readViewPref()

  const setView = (v: TeachingView) => {
    writeViewPref(v)
    const p = new URLSearchParams(sp.toString())
    for (const k of VIEW_SCOPED_PARAMS) p.delete(k)
    p.set("view", v)
    router.replace(`/teaching?${p.toString()}`, { scroll: false })
  }

  const ret = `/teaching?${(() => {
    const p = new URLSearchParams(sp.toString())
    p.set("view", view)
    return p.toString()
  })()}`
  useEffect(() => {
    const y = Number(window.sessionStorage.getItem(scrollKey(ret)))
    if (y > 0) {
      window.sessionStorage.removeItem(scrollKey(ret))
      requestAnimationFrame(() => window.scrollTo({ top: y }))
    }
  }, [ret])

  const switcher = (
    <div className="flex flex-wrap items-center justify-between gap-2">
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
      <Link
        href={settingsHref(ret)}
        onClick={() => window.sessionStorage.setItem(scrollKey(ret), String(window.scrollY))}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
      >
        <Settings2 className="size-4" aria-hidden />
        教学设置
      </Link>
    </div>
  )

  return <>
    <header data-testid="teaching-workspace-header">
      <PageHeader title="我的教学" desc="本人任教任务、课次与按日记录" actions={
        <LinkButton variant="outline" href={`/timetable/my?${new URLSearchParams({ from: "schedule", week: weekStart(week), back: new URLSearchParams(ret.split("?")[1]).toString() })}`}>我的完整课表</LinkButton>
      } />
      <div className="mb-4">{switcher}</div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <WeekPicker week={week} current={cw} onChange={w => setParam("week", String(w))} />
        <select aria-label="筛选教学班" value={sp.get("class") ?? ""} onChange={e => setParam("class", e.target.value)} className="h-9 rounded-lg border border-input bg-card px-2 text-sm">
          <option value="">全部教学班</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <MtDemoBar />
    </header>
    {!mt.ready ? <MtLoading /> : mt.loadError ? <MtLoadError /> : view === "tasks" ? <TaskListPage /> : <WeekSchedulePage view={view} />}
  </>
}
