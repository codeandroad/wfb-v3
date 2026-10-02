"use client"

import { Badge, Segmented, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ProjectedEntry } from "@/lib/timetable/data"
import {
  ATTENDANCE_META,
  PERFORMANCE_META,
  recordKey,
  rosterFor,
  saveLessonRecord,
  useLessonRecords,
  type Attendance,
  type Performance,
} from "@/lib/timetable/lesson-records"
import { Check, ClipboardCheck } from "lucide-react"
import { useState } from "react"

type Tab = "attendance" | "performance" | "summary"

const ATT_TONE: Record<Attendance, string> = {
  present: "border-primary/40 bg-accent text-foreground",
  late: "border-[#e6d4a8] bg-[#fbf3e2] text-[#7a5514]",
  leave: "border-[#c4dae2] bg-[#eaf2f5] text-[#2a5b6e]",
  absent: "border-[#eec4bf] bg-[#fbe6e4] text-[#9a2b22]",
}

const PERF_TONE: Record<Performance, string> = {
  active: "border-primary/40 bg-accent text-foreground",
  normal: "border-border bg-muted text-foreground",
  attention: "border-[#eec4bf] bg-[#fbe6e4] text-[#9a2b22]",
}

/* 已过期课次的课后记录入口：出勤 / 课堂表现 / 课堂小结 */
export function LessonRecordPanel({ entry, onSaved }: { entry: ProjectedEntry; onSaved?: () => void }) {
  const { push } = useToast()
  const records = useLessonRecords()
  const key = recordKey(entry)
  const saved = records[key]
  const roster = rosterFor(entry.className)

  const [tab, setTab] = useState<Tab>("attendance")
  const [attendance, setAttendance] = useState<Record<string, Attendance>>(saved?.attendance ?? {})
  const [performance, setPerformance] = useState<Record<string, Performance>>(saved?.performance ?? {})
  const [summary, setSummary] = useState(saved?.summary ?? "")
  const [homework, setHomework] = useState(saved?.homework ?? "")
  const [justSaved, setJustSaved] = useState(false)
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setAttendance(saved?.attendance ?? {})
    setPerformance(saved?.performance ?? {})
    setSummary(saved?.summary ?? "")
    setHomework(saved?.homework ?? "")
    setTab("attendance")
  }

  const att = (id: string): Attendance => attendance[id] ?? "present"
  const counts = (Object.keys(ATTENDANCE_META) as Attendance[]).map((k) => ({
    k,
    n: roster.filter((s) => att(s.id) === k).length,
  }))
  const perfMarked = roster.filter((s) => performance[s.id]).length

  function save() {
    const full: Record<string, Attendance> = {}
    roster.forEach((s) => (full[s.id] = att(s.id)))
    saveLessonRecord(key, {
      attendance: full,
      performance,
      summary,
      homework,
      savedAt: new Date().toISOString(),
    })
    push("课后记录已保存")
    if (onSaved) {
      onSaved()
      return
    }
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 2000)
  }

  return (
    <section className="mt-4 rounded-lg border border-border bg-card" aria-label="课后记录">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <ClipboardCheck className="size-4 text-primary" aria-hidden />
        <h4 className="text-[13px] font-semibold">课后记录</h4>
        {saved ? <Badge tone="success">已记录</Badge> : <Badge tone="warning">待记录</Badge>}
        <div className="ml-auto">
          <Segmented
            size="sm"
            ariaLabel="记录类型"
            value={tab}
            onChange={(v) => setTab(v)}
            options={[
              { value: "attendance", label: "出勤" },
              { value: "performance", label: "课堂表现" },
              { value: "summary", label: "课堂小结" },
            ]}
          />
        </div>
      </div>

      <div className="p-3">
        {tab === "attendance" ? (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
              <span>共 {roster.length} 人</span>
              {counts.map((c) => (
                <span key={c.k}>
                  {ATTENDANCE_META[c.k].label} <strong className="text-foreground">{c.n}</strong>
                </span>
              ))}
              <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setAttendance({})}>
                全部到课
              </Button>
            </div>
            <ul className="thin-scroll max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {roster.map((s) => (
                <li key={s.id} className="flex items-center gap-2 px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
                  <div className="flex gap-1" role="radiogroup" aria-label={`${s.name} 出勤`}>
                    {(Object.keys(ATTENDANCE_META) as Attendance[]).map((k) => {
                      const on = att(s.id) === k
                      return (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={ATTENDANCE_META[k].label}
                          onClick={() => setAttendance((m) => ({ ...m, [s.id]: k }))}
                          className={cn(
                            "size-7 rounded-md border text-[12px] font-medium transition-colors",
                            on ? ATT_TONE[k] : "border-transparent text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {ATTENDANCE_META[k].short}
                        </button>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {tab === "performance" ? (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
              <span>已标记 {perfMarked} / {roster.length} 人 · 只需标记值得关注的学生</span>
              <Button
                variant="ghost"
                size="xs"
                className="ml-auto"
                onClick={() => {
                  const next: Record<string, Performance> = {}
                  roster.forEach((s) => {
                    const a = att(s.id)
                    if (a !== "absent" && a !== "leave") next[s.id] = "normal"
                  })
                  setPerformance(next)
                }}
              >
                全部正常
              </Button>
            </div>
            <ul className="thin-scroll max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {roster.map((s) => (
                <li key={s.id} className="flex items-center gap-2 px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
                  {att(s.id) === "absent" || att(s.id) === "leave" ? (
                    <span className="text-[11px] text-muted-foreground">{ATTENDANCE_META[att(s.id)].label}</span>
                  ) : null}
                  <div className="flex gap-1" role="radiogroup" aria-label={`${s.name} 课堂表现`}>
                    {(Object.keys(PERFORMANCE_META) as Performance[]).map((k) => {
                      const on = performance[s.id] === k
                      return (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() =>
                            setPerformance((m) => {
                              const next = { ...m }
                              if (on) delete next[s.id]
                              else next[s.id] = k
                              return next
                            })
                          }
                          className={cn(
                            "rounded-md border px-2 py-1 text-[12px] font-medium transition-colors",
                            on ? PERF_TONE[k] : "border-transparent text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {PERFORMANCE_META[k].label}
                        </button>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {tab === "summary" ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">教学进度 / 课堂小结</span>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                placeholder="如：完成 P1 第3章例题，学生对二次函数图像掌握较好"
                className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-[14px] leading-relaxed"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">布置作业</span>
              <input
                value={homework}
                onChange={(e) => setHomework(e.target.value)}
                placeholder="如：练习册 P24 第 1–6 题"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[14px]"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={cn("text-[11px]", justSaved ? "font-medium text-primary" : "text-muted-foreground")} aria-live="polite">
            {justSaved
              ? "已保存"
              : saved
                ? `上次保存 ${new Date(saved.savedAt).toLocaleString("zh-CN", { hour12: false })}`
                : "记录仅补充课堂事实，不改动课表安排"}
          </span>
          <Button size="sm" onClick={save} disabled={justSaved}>
            {justSaved ? (
              <>
                <Check className="size-3.5" aria-hidden />
                已保存
              </>
            ) : (
              "保存记录"
            )}
          </Button>
        </div>
      </div>
    </section>
  )
}
