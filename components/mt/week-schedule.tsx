"use client"

import { EmptyState, LinkButton, PageHeader } from "@/components/kit"
import { MtDemoBar, MtLoadError, MtLoading } from "@/components/mt/shared"
import { WeekPicker } from "@/components/mt/week-picker"
import { currentWeek, permittedTasks, useTeacherId } from "@/lib/mt/derive"
import {
  classOf,
  fmtMD,
  personalDisplay,
  lessonsOfWeek,
  lessonTimeLabel,
  MAX_WEEK,
  resolveLabel,
  uniq,
  WEEKDAY_CN,
  weekDates,
  weekRangeLabel,
} from "@/lib/mt/model"
import { weekStart } from "@/lib/mt/model"
import { useMt } from "@/lib/mt/store"
import { cn } from "@/lib/utils"
import { ArrowLeft, CalendarRange, X } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { DayCardsView } from "@/components/mt/day-cards-view"
import { LessonDetail } from "@/components/mt/lesson-detail"

type ScheduleView = "lessons" | "days"
const VIEW_PREF = "tgs-mt:schedule-view"
function readViewPref(): ScheduleView {
  try {
    return window.localStorage.getItem(VIEW_PREF) === "days" ? "days" : "lessons"
  } catch {
    return "lessons"
  }
}
function writeViewPref(v: ScheduleView) {
  try {
    window.localStorage.setItem(VIEW_PREF, v)
  } catch {
    /* 偏好写入失败不影响当前视图 */
  }
}

export function WeekSchedulePage() {
  const mt = useMt()
  const teacherId = useTeacherId()
  const sp = useSearchParams()
  const router = useRouter()
  if (!mt.ready) return <MtLoading />
  if (mt.loadError) return <MtLoadError />

  const cw = currentWeek(mt.biz)
  const wq = Number(sp.get("week"))
  const week = wq >= 1 && wq <= MAX_WEEK ? wq : cw
  const classFilter = sp.get("class") ?? ""
  const taskFilter = sp.get("task") ?? ""

  const setParam = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) if (!v) p.delete(k)
    else p.set(k, v)
    router.replace(`/teaching/schedule?${p.toString()}`, { scroll: false })
  }

  const tasks = permittedTasks(mt.biz, teacherId)
  const classes = uniq(tasks.map((t) => t.class_id)).map((id) => ({ id, name: classOf(tasks.find((t) => t.class_id === id)!).name }))
  const scoped = tasks.filter((t) => (!classFilter || t.class_id === classFilter) && (!taskFilter || t.id === taskFilter))
  const lessons = lessonsOfWeek(mt.biz.variant, week, scoped.map((t) => t.id))
  const dates = weekDates(week)
  const showWeekend = lessons.some((l) => dates.indexOf(l.actual_date) >= 5)
  const cols = showWeekend ? dates : dates.slice(0, 5)
  const nowTs = Date.parse(mt.biz.clock)
  const back = sp.toString()
  const myTimetableHref = `/timetable/my?${new URLSearchParams({ from: "schedule", week: weekStart(week), back }).toString()}`
  const taskOfFilter = taskFilter ? tasks.find((t) => t.id === taskFilter) : null
  const vq = sp.get("view")
  const view: ScheduleView = vq === "days" || vq === "lessons" ? vq : readViewPref()
  const lessonParam = sp.get("lesson")
  const openLesson = lessonParam ? lessons.find((l) => l.id === lessonParam) ?? null : null
  const openTask = openLesson ? tasks.find((t) => t.id === openLesson.task_id) ?? null : null
  const backParams = new URLSearchParams(back)
  backParams.delete("lesson")
  const backNoLesson = backParams.toString()
  const setView = (v: ScheduleView) => {
    writeViewPref(v)
    setParam({ view: v })
  }

  return (
    <div>
      <PageHeader
        title="本周教学安排"
        desc={`第 ${week} 周 · ${weekRangeLabel(week)} · ${view === "days" ? "点击日卡进入该任务当天的按日记录" : "点击课卡在原位查看课次详情，可记录可选观察或更正本节考勤"}`}
        actions={
          <>
            <LinkButton href={`/teaching?week=${week}`} variant="outline">
              <ArrowLeft className="size-3.5" aria-hidden />
              返回我的教学
            </LinkButton>
            <LinkButton href={myTimetableHref} variant="outline">
              <CalendarRange className="size-3.5" aria-hidden />
              我的完整课表
            </LinkButton>
          </>
        }
      />
      <MtDemoBar />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="视图" className="inline-flex rounded-lg border border-border bg-muted p-0.5">
          {(
            [
              ["lessons", "课次安排"],
              ["days", "按日记录"],
            ] as const
          ).map(([k, label]) => (
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
        <WeekPicker week={week} current={cw} onChange={(w) => setParam({ week: String(w) })} />
        <select
          aria-label="筛选教学班"
          value={classFilter}
          onChange={(e) => setParam({ class: e.target.value, task: null })}
          className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
        >
          <option value="">全部教学班</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {taskOfFilter ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
            仅任务：{classOf(taskOfFilter).name} ·{" "}
            {resolveLabel(taskOfFilter, teacherId!, mt.biz.taskPrefs, mt.biz.lessonOverrides).text ?? classOf(taskOfFilter).subject}
          </span>
        ) : null}
        {classFilter || taskFilter ? (
          <button
            type="button"
            onClick={() => setParam({ class: null, task: null })}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" aria-hidden />
            清除条件
          </button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">共 {lessons.length} 个课次</span>
      </div>

      {!teacherId ? (
        <EmptyState icon={<CalendarRange className="size-7" />} title="当前身份没有任教任务" desc="切换为示例林老师或示例周老师查看。" />
      ) : lessons.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="size-7" />}
          title="本周没有课次"
          desc="按已应用的安排与校历，本周无本人课次。可切换周次或清除筛选。"
        />
      ) : view === "days" ? (
        <DayCardsView tasks={scoped} allTasks={tasks} teacherId={teacherId} week={week} cols={cols} back={back} focus={sp.get("focus")} />
      ) : (
        <div className={cn("grid gap-3", showWeekend ? "md:grid-cols-7" : "md:grid-cols-5")}>
          {cols.map((d, i) => {
            const day = lessons.filter((l) => l.actual_date === d)
            return (
              <section key={d} aria-label={`${WEEKDAY_CN[i]} ${fmtMD(d)}`} className="flex flex-col gap-2">
                <h2 className="flex items-baseline gap-2 border-b border-border pb-1.5 text-sm font-semibold">
                  {WEEKDAY_CN[i]}
                  <span className="font-mono text-xs font-normal text-muted-foreground">{fmtMD(d)}</span>
                </h2>
                {day.length === 0 ? <p className="py-3 text-xs text-muted-foreground">无课</p> : null}
                {day.map((l) => {
                  const t = tasks.find((x) => x.id === l.task_id)!
                  const pd = personalDisplay(t, teacherId, mt.biz.taskPrefs, mt.biz.lessonOverrides, l.id)
                  const sub = [pd.division, pd.course].filter(Boolean).join(" · ")
                  const done = l.endTs <= nowTs
                  const hasObs = !!mt.biz.observations[`${l.id}|CLASS`]
                  return (
                    <button
                      type="button"
                      key={l.id}
                      onClick={() => setParam({ lesson: l.id })}
                      aria-haspopup="dialog"
                      id={`lesson-${l.id}`}
                      className={cn(
                        "flex flex-col gap-1 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary",
                        sp.get("focus") === l.id ? "border-primary ring-2 ring-primary/30" : "border-border",
                      )}
                    >
                      <span className="font-mono text-[11px] text-muted-foreground">{lessonTimeLabel(l)}</span>
                      <span className="text-sm font-semibold leading-snug">{pd.className}</span>
                      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
                      <span className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>{l.room ?? ""}</span>
                        <span className="flex items-center gap-1.5">
                          {hasObs ? <span className="text-muted-foreground">有观察</span> : null}
                          <span className={done ? "text-[#256a49]" : ""}>{done ? "已结束" : "未开始"}</span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </section>
            )
          })}
        </div>
      )}
      {openLesson && openTask && teacherId ? (
        <LessonDetail
          lesson={openLesson}
          task={openTask}
          teacherId={teacherId}
          back={backNoLesson}
          onClose={() => setParam({ lesson: null, focus: openLesson.id })}
        />
      ) : null}
    </div>
  )
}
