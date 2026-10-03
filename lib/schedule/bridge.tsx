"use client"

// r4 课表同源：把完整「我的课表」的有效安排（已采用学校版本 + 已应用个人调整 + 校历停课/调休/补课）
// 注册为「我的教学」的唯一课次来源。不复制课次数组；未应用的个人草稿不在此投影中。

import { useMemo, type ReactNode } from "react"
import { useTimetable, teacherWeekEntries, teacherCurrent } from "@/lib/timetable/store"
import { useCalendarEvents, effectiveWithCalendar } from "@/lib/timetable/calendar-store"
import { PERIODS, addDays, weekStartOf } from "@/lib/timetable/data"
import { setScheduleSource, type ScheduleRead } from "@/lib/mt/model"
import { ScheduleRevContext } from "@/lib/mt/store"
import { useDemo } from "@/lib/demo/store"
import { PERSONAS } from "@/lib/demo/nav"

export function ScheduleBridge({ children }: { children: ReactNode }) {
  const tt = useTimetable()
  const events = useCalendarEvents()
  const { persona } = useDemo()
  const teacherId = PERSONAS[persona]?.teacherId ?? null

  const source = useMemo(() => {
    const cache = new Map<string, ScheduleRead>()
    return (weekStartIso: string): ScheduleRead => {
      const hit = cache.get(weekStartIso)
      if (hit) return hit
      let out: ScheduleRead
      if (!teacherId) out = { status: "unconfirmed", message: "当前演示身份没有任教身份" }
      else {
        const cur = teacherCurrent(tt, teacherId, weekStartIso)
        if (cur.kind === "load_error") out = { status: "error", message: "本人课表读取失败，暂不能判断本周课次" }
        else if (cur.kind !== "ok") out = { status: "unconfirmed", message: "尚未采用学校课表，暂无有效个人安排" }
        else {
          const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStartIso, i))
          const { entries } = teacherWeekEntries(tt, teacherId, weekStartIso)
          const { effective } = effectiveWithCalendar(events, entries, dates, tt.adoptions[teacherId]?.personalEdits ?? [], date => teacherWeekEntries(tt, teacherId, weekStartOf(date)).entries)
          out = {
            status: "ok",
            exclusions: events.filter(e => (e.kind === "holiday" && dates.some(d => d >= e.date && d <= (e.endDate ?? e.date))) || (e.kind === "swap" && dates.includes(e.date))).map(e => ({ date: e.date, reason: e.kind === "swap" ? `校历调休至 ${e.targetDate}` : `校历停课${e.endDate ? `至 ${e.endDate}` : ""}` })),
            lessons: effective
              .filter((e) => e.taskId && !e.movedTo && dates.includes(e.date))
              .map((e) => {
                const p = PERIODS.find((x) => x.id === e.periodId)!
                return { key: e.key, taskId: e.taskId!, date: e.date, periodNo: p.no, start: p.start, end: p.end, room: e.room, makeupFrom: e.makeupFrom, note: e.noteShow === false ? undefined : e.note || undefined }
              }),
          }
        }
      }
      cache.set(weekStartIso, out)
      return out
    }
  }, [tt, events, teacherId])

  // 在子树渲染前注册（同步、幂等）；rev 变化使所有 useMt 使用方重新解析课次。
  setScheduleSource(source)
  return <ScheduleRevContext.Provider value={source}>{children}</ScheduleRevContext.Provider>
}
