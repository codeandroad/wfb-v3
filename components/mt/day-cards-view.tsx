"use client"

import { Badge } from "@/components/kit"
import { dayCardsOfWeek, lessonTimingLabel, periodsLabel } from "@/lib/mt/daycards"
import { Layers } from "lucide-react"
import { fmtMD, personalDisplay, WEEKDAY_CN, type STask } from "@/lib/mt/model"
import { useMt } from "@/lib/mt/store"
import { cn } from "@/lib/utils"
import Link from "next/link"

/** 按日记录视图：同一教学任务同一日期的原课次合并为一张日卡 */
export function DayCardsView({
  tasks,
  allTasks,
  teacherId,
  week,
  cols,
  back,
  focus,
}: {
  tasks: STask[]
  allTasks: STask[]
  teacherId: string
  week: number
  cols: string[]
  back: string
  focus: string | null
}) {
  const mt = useMt()
  const cards = dayCardsOfWeek(mt.biz, tasks, week)
  return (
    <div className={cn("grid gap-3", cols.length === 7 ? "md:grid-cols-7" : "md:grid-cols-5")}>
      {cols.map((d, i) => {
        const day = cards.filter((c) => c.date === d)
        return (
          <section key={d} aria-label={`${WEEKDAY_CN[i]} ${fmtMD(d)}`} className="flex flex-col gap-2">
            <h2 className="flex items-baseline gap-2 border-b border-border pb-1.5 text-sm font-semibold">
              {WEEKDAY_CN[i]}
              <span className="font-mono text-xs font-normal text-muted-foreground">{fmtMD(d)}</span>
            </h2>
            {day.length === 0 ? <p className="py-3 text-xs text-muted-foreground">无课</p> : null}
            {day.map((c) => {
              const t = allTasks.find((x) => x.id === c.task.id)!
              const pd = personalDisplay(t, teacherId, mt.biz.taskPrefs, mt.biz.lessonOverrides)
              const sub = [pd.division, pd.course].filter(Boolean).join(" · ")
              const roomSet = [...new Set(c.lessons.map((l) => l.room).filter(Boolean))]
              const perLessonRoom = roomSet.length > 1
              const nowTs = Date.parse(mt.biz.clock)
              const allFuture = c.timing.key === "FUTURE"
              const href = `/teaching/task/${t.id}/day/${c.date}?week=${week}&from=schedule&back=${encodeURIComponent(back)}`
              return (
                <Link
                  key={c.key}
                  href={href}
                  id={`day-${c.key}`}
                  data-merged={c.merged}
                  data-eval={c.status.key}
                  aria-label={`${pd.className}${sub ? ` ${sub}` : ""} ${fmtMD(c.date)} ${periodsLabel(c.lessons)}${c.merged > 1 ? `，合并${c.merged}节` : ""}，${c.status.label}${c.attTodo ? `，考勤待核对${c.attTodo}人` : ""}，打开本日记录`}
                  className={cn(
                    "relative flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary",
                    c.merged > 1 && "border-l-4 border-l-foreground/25",
                    focus === c.key ? "border-primary ring-2 ring-primary/30" : "border-border",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug">{pd.className}</span>
                    {c.merged > 1 ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded border border-foreground/30 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                        <Layers className="size-3" aria-hidden />
                        合并{c.merged}节
                      </span>
                    ) : null}
                  </span>
                  {sub ? <span className="-mt-1 text-xs text-muted-foreground">{sub}</span> : null}
                  <ul className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                    {c.lessons.map((l) => {
                      const tl = allFuture ? null : lessonTimingLabel(l, nowTs)
                      return (
                        <li key={l.id} className={cn("flex flex-wrap items-baseline gap-x-1.5", l.startTs > nowTs && !allFuture && "opacity-70")}>
                          <span className="text-xs text-foreground">第{l.period.number}节</span>
                          <span className="font-mono">
                            {l.period.start}–{l.period.end}
                          </span>
                          {perLessonRoom && l.room ? <span>{l.room}</span> : null}
                          {tl ? <span>· {tl}</span> : null}
                        </li>
                      )
                    })}
                  </ul>
                  {!perLessonRoom && roomSet[0] ? <span className="text-[11px] text-muted-foreground">{roomSet[0]}</span> : null}
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={c.status.tone}>{c.status.label}</Badge>
                    {c.status.key !== "FUTURE" && (c.timing.key === "MORE_TODAY" || c.timing.key === "LIVE") ? (
                      <span className="text-[11px] text-muted-foreground">{c.timing.key === "LIVE" ? "正在上课" : "今日还有课"}</span>
                    ) : null}
                    {c.attTodo > 0 ? <Badge tone="warning">考勤待核对 {c.attTodo} 人</Badge> : null}
                  </span>
                </Link>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
