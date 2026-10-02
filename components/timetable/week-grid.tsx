"use client"

import { Badge } from "@/components/kit"
import { cn } from "@/lib/utils"
import { eventCovers, stoppedDatesFor, swapClonesFor, useCalendarEvents } from "@/lib/timetable/calendar-store"
import { recordKey, useLessonRecords } from "@/lib/timetable/lesson-records"
import { dutyName, useDuties } from "@/lib/timetable/duty-store"
import { useTeacherId } from "@/lib/mt/derive"
import { personalDisplay, prefKey, TASKS } from "@/lib/mt/model"
import { useMt } from "@/lib/mt/store"
import {
  addDays,
  finalMarker,
  fmtDate,
  LUNCH,
  PERIODS,
  periodById,
  WEEKDAYS,
  type CalEvent,
  type Period,
  type ProjectedEntry,
  type SlotEdit,
} from "@/lib/timetable/data"
import { CalendarOff, CalendarSync, ChevronDown, ClipboardPen, ChevronRight, GripVertical, Lock, MapPin, Plus } from "lucide-react"
import { useRef, useState } from "react"

const AXIS = "w-[78px]"

type CardMeta = {
  conflict?: boolean
  draft?: boolean
  draggable?: boolean
  past?: boolean // 过去日期的课次：锁定只读并置灰
  recorded?: boolean // 已过期课次已有课后记录（仅教师本人视图）
  voided?: boolean // 放假/停课日的课次：保留显示但失效
}

export function WeekGrid({
  weekStart,
  entries,
  clockDate,
  showWeekend = true,
  onCardClick,
  conflictKeys,
  className,
  editing = false,
  canDrag,
  draftKeys,
  onMove,
  onAddCell,
  calendarEvents: calendarEventsProp,
  canonical = false,
  recordable = false,
  makeupEdits,
}: {
  weekStart: string
  entries: ProjectedEntry[]
  clockDate?: string
  showWeekend?: boolean
  onCardClick?: (e: ProjectedEntry) => void
  conflictKeys?: Set<string>
  className?: string
  editing?: boolean
  canDrag?: (e: ProjectedEntry) => boolean
  draftKeys?: Set<string>
  onMove?: (entry: ProjectedEntry, weekday: number, periodId: string) => void
  onAddCell?: (weekday: number, periodId: string, date: string) => void
  calendarEvents?: CalEvent[]
  // true：教务/他人规范视图，不读取个人自定义分工，只显示规范名称
  canonical?: boolean
  // true：教师本人视图，已过期课次显示课后记录状态
  recordable?: boolean
  // 作用于调休补课日镜像课次的单次编辑（键为镜像键，按补课日期命中）
  makeupEdits?: SlotEdit[]
}) {
  const sharedEvents = useCalendarEvents()
  const calendarEvents = calendarEventsProp ?? sharedEvents
  const records = useLessonRecords()
  // null=跟随是否有晚间课自动展开/折叠；true/false=用户手动覆盖
  const [eveningOverride, setEveningOverride] = useState<boolean | null>(null)
  const [over, setOver] = useState<string | null>(null) // `${periodId}@${date}`
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null)
  const draggedAtRef = useRef(0)

  // 指针拖拽状态：使用 setPointerCapture，事件绑定在课卡自身，
  // 避免全局 window 监听在预览 iframe / 触屏环境下丢事件。
  const pd = useRef<{
    entry: ProjectedEntry
    el: HTMLElement
    pointerId: number
    startX: number
    startY: number
    active: boolean
  } | null>(null)

  function cellFromPoint(x: number, y: number): HTMLElement | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    return el ? (el.closest("[data-cell]") as HTMLElement | null) : null
  }

  const dragHandlers = (entry: ProjectedEntry) => ({
    onPointerDown: (ev: React.PointerEvent<HTMLButtonElement>) => {
      if (ev.button !== 0 && ev.pointerType === "mouse") return
      const el = ev.currentTarget
      try {
        el.setPointerCapture(ev.pointerId)
      } catch {
        /* 忽略：个别环境不支持捕获，仍可依赖冒泡事件 */
      }
      pd.current = { entry, el, pointerId: ev.pointerId, startX: ev.clientX, startY: ev.clientY, active: false }
    },
    onPointerMove: (ev: React.PointerEvent<HTMLButtonElement>) => {
      const s = pd.current
      if (!s || ev.pointerId !== s.pointerId) return
      if (!s.active) {
        if (Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY) < 5) return
        s.active = true
      }
      ev.preventDefault()
      const cell = cellFromPoint(ev.clientX, ev.clientY)
      setOver(cell?.getAttribute("data-cell") ?? null)
      setGhost({ x: ev.clientX, y: ev.clientY, label: s.entry.className })
    },
    onPointerUp: (ev: React.PointerEvent<HTMLButtonElement>) => {
      const s = pd.current
      if (!s || ev.pointerId !== s.pointerId) return
      try {
        s.el.releasePointerCapture(s.pointerId)
      } catch {
        /* noop */
      }
      pd.current = null
      setGhost(null)
      setOver(null)
      if (!s.active) return
      draggedAtRef.current = Date.now()
      const cell = cellFromPoint(ev.clientX, ev.clientY)
      if (!cell || cell.getAttribute("data-droppable") !== "1") return
      const periodId = cell.getAttribute("data-period")
      const date = cell.getAttribute("data-date")
      const weekday = Number(cell.getAttribute("data-weekday"))
      if (!periodId || !date) return
      if (s.entry.periodId === periodId && s.entry.date === date) return
      // 补课日课次只能在补课当日内移动到空闲节次
      if (s.entry.makeupFrom) {
        if (date !== s.entry.date) return
        if (renderEntries.some((x) => x.date === date && x.periodId === periodId)) return
      }
      onMove?.(s.entry, weekday, periodId)
    },
    onPointerCancel: () => {
      const s = pd.current
      if (s) {
        try {
          s.el.releasePointerCapture(s.pointerId)
        } catch {
          /* noop */
        }
      }
      pd.current = null
      setGhost(null)
      setOver(null)
    },
  })

  const dayCount = showWeekend ? 7 : 5
  const days = WEEKDAYS.slice(0, dayCount).map((w) => ({ ...w, date: addDays(weekStart, w.n - 1) }))

  // 命中本周的校历事项：停课(holiday) 覆盖当日；整日调休(swap) 标注来源日与补课日
  function calFor(date: string): { holiday?: CalEvent; swapSource?: CalEvent; movedAway?: CalEvent } {
    const holiday = calendarEvents.find((e) => e.kind === "holiday" && eventCovers(e, date))
    // 该日为补课执行日（承接来源日课表）
    const swapSource = calendarEvents.find((e) => e.kind === "swap" && e.targetDate === date)
    // 该日为被调休搬走的来源日（课程已移至 targetDate）
    const movedAway = calendarEvents.find((e) => e.kind === "swap" && e.date === date && !!e.targetDate)
    return { holiday, swapSource, movedAway }
  }
  const weekFirst = days[0].date
  const weekLast = days[days.length - 1].date
  const weekCalEvents = calendarEvents.filter((e) => {
    if (e.kind === "exception") return false
    const overlaps = e.date <= weekLast && (e.endDate ?? e.date) >= weekFirst
    const targetIn = !!e.targetDate && e.targetDate >= weekFirst && e.targetDate <= weekLast
    return overlaps || targetIn
  })

  // 调休/停课投影与「我的教学」简版共用 calendar-store 中的同一实现。
  const stoppedDates = stoppedDatesFor(calendarEvents, [...new Set([...entries.map((e) => e.date), ...days.map((d) => d.date)])])
  // 实际参与渲染的课次：停课日课程保留但以失效态低调显示，追加补课日克隆
  const renderEntries: ProjectedEntry[] = [
    ...entries,
    ...days.flatMap((d) => swapClonesFor(calendarEvents, entries, d.date, stoppedDates, makeupEdits)),
  ]

  const eveningCount = renderEntries.filter(
    (e) => periodById(e.periodId)?.block === "evening" && !stoppedDates.has(e.date),
  ).length
  // 有晚间课时自动展开，无课时折叠；用户手动切换后以覆盖值为准
  const showEvening = eveningOverride ?? eveningCount > 0
  const dayPeriods = PERIODS.filter((p) => p.block !== "evening")
  const eveningPeriods = PERIODS.filter((p) => p.block === "evening")

  const cellEntries = (periodId: string, date: string) =>
    renderEntries.filter((e) => e.periodId === periodId && e.date === date)

  function draggableFor(e: ProjectedEntry): boolean {
    if (!editing || !onMove) return false
    // 历史/锁定课次只读；已过去的课次不可拖拽
    if (e.kind === "history" || e.locked) return false
    // 调休补课日课次：仅在提供单次编辑通道时可在当日内拖动
    if (e.makeupFrom && !makeupEdits) return false
    if (stoppedDates.has(e.date)) return false
    if (clockDate && e.date < clockDate) return false
    return canDrag ? canDrag(e) : true
  }

  const renderRow = (p: Period, showLunchBefore: boolean) => (
    <div key={p.id}>
      {showLunchBefore ? (
        <div className="flex items-stretch border-t border-border/70 bg-muted/40">
          <div className={cn(AXIS, "shrink-0 px-1.5 py-1 text-center text-[10px] leading-tight text-muted-foreground/70")}>午间</div>
          <div className="flex-1 px-2 py-1 text-[10px] leading-tight text-muted-foreground/60">{LUNCH.start}–{LUNCH.end} · 午休</div>
        </div>
      ) : null}
      <div className="flex items-stretch border-t border-border/70">
        <div className={cn(AXIS, "flex shrink-0 flex-col justify-center px-1 py-1 text-center")}>
          <span className="text-[11px] font-medium leading-none text-foreground/80">{p.label}</span>
          <span className="mt-0.5 whitespace-nowrap text-[9px] leading-none text-muted-foreground/70">{p.start}–{p.end}</span>
        </div>
        {days.map((d) => {
          const items = cellEntries(p.id, d.date)
          const cellId = `${p.id}@${d.date}`
          const isOver = editing && over === cellId
          const droppable = editing && !!onMove
          const isPastCell = !!clockDate && d.date < clockDate
          const cal = calFor(d.date)
          const isMakeup = !!cal.swapSource
          const isStopped = stoppedDates.has(d.date)
          const canAdd = editing && !!onAddCell && items.length === 0 && !isPastCell && !isStopped
          return (
            <div
              key={d.n}
              data-cell={cellId}
              data-droppable={droppable && !isStopped ? "1" : "0"}
              data-period={p.id}
              data-date={d.date}
              data-weekday={d.n}
              className={cn(
                "relative min-w-0 flex-1 border-l border-border/70 p-1",
                d.n >= 6 && "bg-muted/20",
                isMakeup && "bg-[#2a5b6e]/10",
                isStopped && "bg-[#e8ebf1]",
                isOver && "outline outline-2 -outline-offset-2 outline-primary bg-accent/60",
              )}
            >
              <div className="flex min-h-[46px] flex-col gap-1">
                {canAdd ? (
                  <button
                    type="button"
                    onClick={() => onAddCell!(d.n, p.id, d.date)}
                    className="flex min-h-[46px] w-full items-center justify-center rounded-md border border-dashed border-border/60 text-muted-foreground/40 transition-colors hover:border-primary/60 hover:bg-accent/40 hover:text-primary"
                    aria-label={`在 ${d.label} ${p.label} 新增课次`}
                  >
                    <Plus className="size-4" />
                  </button>
                ) : null}
                {items.map((e, i) => (
                  <ClassCard
                    key={e.key + i}
                    entry={e}
                    canonical={canonical}
                    meta={{
                      conflict: conflictKeys?.has(cellKey(e)),
                      draft: draftKeys?.has(e.key),
                      draggable: draggableFor(e),
                      past: isPastCell,
                      voided: isStopped && !e.makeupFrom,
                      recorded:
                        recordable && isPastCell && !isStopped && e.kind !== "activity" && !!records[recordKey(e)],
                    }}
                    onClick={
                      onCardClick
                        ? () => {
                            // 拖拽刚结束时抑制误触点击
                            if (Date.now() - draggedAtRef.current < 260) return
                            onCardClick(e)
                          }
                        : undefined
                    }
                    dragProps={draggableFor(e) ? dragHandlers(e) : undefined}
                  />
                ))}
              </div>
              {isOver ? (
                <span className="pointer-events-none absolute inset-x-1 bottom-1 truncate rounded bg-primary px-1 py-0.5 text-center text-[9px] font-medium text-primary-foreground">
                  移到 {d.label} {p.label}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", editing ? "border-primary/50 ring-1 ring-primary/30" : "border-border", className)}>
      <div className="flex items-stretch bg-muted/60">
        <div className={cn(AXIS, "shrink-0 px-1 py-1.5 text-center text-[10px] text-muted-foreground")}>节次</div>
        {days.map((d) => {
          const isToday = clockDate === d.date
          const { holiday, swapSource, movedAway } = calFor(d.date)
          return (
            <div
              key={d.n}
              className={cn(
                "flex-1 border-l border-border/70 px-1 py-1.5 text-center",
                d.n >= 6 && "bg-muted/40",
                isToday && "bg-accent",
                holiday && "bg-[#dde2ea]",
                swapSource && "bg-[#2a5b6e]",
              )}
            >
              <p className={cn("text-[12px] font-semibold leading-none", isToday && "text-primary", holiday && "text-[#46526a]", swapSource && "text-white")}>{d.label}</p>
              <p className={cn("mt-0.5 text-[10px] leading-none text-muted-foreground", swapSource && "text-white/70")}>{fmtDate(d.date)}</p>
              {movedAway ? (
                <span className="mt-1 inline-flex items-center gap-0.5 rounded bg-[#56627a] px-1 py-0.5 text-[9px] font-medium leading-none text-[#f4f6f9]">
                  <CalendarOff className="size-2.5" />停课 · 移至 {fmtDate(movedAway.targetDate!)}
                </span>
              ) : holiday ? (
                <span className="mt-1 inline-flex items-center gap-0.5 rounded bg-[#56627a] px-1 py-0.5 text-[9px] font-medium leading-none text-[#f4f6f9]">
                  <CalendarOff className="size-2.5" />{holiday.title ?? "停课"}
                </span>
              ) : swapSource ? (
                <span className="mt-1 inline-flex items-center gap-0.5 rounded bg-white px-1 py-0.5 text-[9px] font-medium leading-none text-[#2a5b6e]">
                  <CalendarSync className="size-2.5" />补 {fmtDate(swapSource.date)} 课表
                </span>
              ) : null}
            </div>
          )
        })}
      </div>

      {weekCalEvents.length ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/70 bg-[#f1f3f7] px-3 py-1.5 text-[11px] text-[#46526a]">
          <CalendarSync className="size-3.5 shrink-0" />
          {weekCalEvents.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1">
              {e.kind === "holiday" ? (
                e.endDate && e.endDate !== e.date ? (
                  <>{e.title ?? "停课"} {fmtDate(e.date)}–{fmtDate(e.endDate)}（{e.scope}）：期间课表失效</>
                ) : (
                  <>本周 {fmtDate(e.date)} {e.title ?? "停课"}（{e.scope}）</>
                )
              ) : (
                <>本周调休：{fmtDate(e.date)} 停课，其课表整体移至 {fmtDate(e.targetDate!)} 执行</>
              )}
            </span>
          ))}
        </div>
      ) : null}

      {dayPeriods.map((p) => renderRow(p, p.id === "a1"))}

      <button
        onClick={() => setEveningOverride(!showEvening)}
        className="flex w-full items-center justify-between border-t border-border bg-muted/40 px-3 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted"
        aria-expanded={showEvening}
      >
        <span className="flex items-center gap-1.5">
          {showEvening ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          晚间 {eveningPeriods.length} 节
          {eveningCount > 0 ? <Badge tone="info">{eveningCount} 节有课</Badge> : <span className="text-muted-foreground/60">· 无课</span>}
        </span>
        <span className="text-[10px] text-muted-foreground/60">{showEvening ? "收起" : "展开"}</span>
      </button>
      {showEvening ? eveningPeriods.map((p) => renderRow(p, false)) : null}

      {ghost ? (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-md border border-primary bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground shadow-lg"
          style={{ left: ghost.x, top: ghost.y }}
        >
          {ghost.label}
        </div>
      ) : null}
    </div>
  )
}

function cellKey(e: ProjectedEntry): string {
  return `${e.teacherId}-${e.key}-${e.date}-${e.periodId}`
}

export function ClassCard({
  entry,
  meta,
  onClick,
  dragProps,
  canonical = false,
}: {
  entry: ProjectedEntry
  meta?: CardMeta
  canonical?: boolean
  onClick?: () => void
  dragProps?: {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => void
  }
}) {
  const duties = useDuties()
  const mt = useMt()
  const teacherId = useTeacherId()
  const lessonCustom = !canonical && entry.displayMode === "CUSTOM" && !!entry.customLabel?.trim()
  const task = !canonical && !lessonCustom && entry.taskId && teacherId ? TASKS.find((t) => t.id === entry.taskId) : undefined
  const taskPref = task && teacherId ? mt.biz.taskPrefs[prefKey(teacherId, task.id)] : undefined
  const taskCustom = !!taskPref?.enabled && !!taskPref.text.trim()
  const marker =
    task && teacherId && taskCustom
      ? personalDisplay(task, teacherId, mt.biz.taskPrefs, mt.biz.lessonOverrides).division
      : finalMarker(entry, canonical, dutyName(duties, entry.className, entry.group))
  const customShown = lessonCustom || taskCustom
  const ownTask = !canonical && entry.taskId && teacherId ? TASKS.find((t) => t.id === entry.taskId) : undefined
  const courseLabel =
    ownTask && teacherId ? personalDisplay(ownTask, teacherId, mt.biz.taskPrefs, mt.biz.lessonOverrides).course : null
  const noteSummary = entry.noteShow && entry.note?.trim() ? entry.note.trim() : null
  const personal = entry.origin === "personal"
  const history = entry.kind === "history"
  const activity = entry.kind === "activity"
  const swap = !!entry.makeupFrom // 调休补课日的镜像课次
  const draggable = !!meta?.draggable && !!dragProps
  // 已记录历史，或落在过去日期的课次：锁定只读并置灰
  const voided = !!meta?.voided
  const locked = !voided && (history || !!meta?.past)

  const tone = voided
    ? "border-dashed border-[#56627a]/25 bg-transparent text-[#56627a]/45"
    : locked
      ? "border-border bg-muted/50 text-muted-foreground"
      : meta?.draft || personal
        ? "border-[#e6d4a8] bg-[#fbf3e2] text-[#7a5514]"
        : swap
        ? "border-[#2a5b6e]/40 bg-[#e7f0f3] text-[#22505f]"
        : activity
          ? "border-[#c4dae2] bg-[#eaf2f5] text-[#2a5b6e]"
          : "border-primary/20 bg-accent text-foreground"

  const inner = (
    <>
      {/* 安排名称：教学班正式名 */}
      <div className="flex items-center gap-1">
        {draggable ? <GripVertical className="size-3 shrink-0 opacity-50" aria-hidden /> : null}
        <span className="truncate text-[12px] font-semibold leading-tight">{entry.className}</span>
        {locked ? (
          <Lock
            className="ml-auto size-3 shrink-0 opacity-60"
            aria-label={history ? "已记录，只读" : "已过期，只读"}
          />
        ) : null}
      </div>

      {marker ? (
        <div className="mt-0.5 flex items-center gap-1 text-[11px] leading-tight opacity-90">
          <span
            className={cn(
              "shrink-0 rounded px-1 font-medium",
              customShown ? "bg-[#2a5b6e]/15 text-[#22505f]" : "bg-foreground/10",
            )}
          >
            {marker}
          </span>
        </div>
      ) : null}
      {courseLabel ? <div className="mt-0.5 truncate text-[11px] leading-tight opacity-80">{courseLabel}</div> : null}
      {/* 地点 */}
      <div className="mt-0.5 flex items-center gap-1 text-[11px] leading-tight opacity-90">
        {entry.room ? (
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="size-2.5" />
            {entry.room}
          </span>
        ) : (
          <span className="text-[10px] opacity-70">未排教室</span>
        )}
      </div>
      {/* 本课备注摘要：仅在“课卡显示”开启且有正文时出现 */}
      {noteSummary ? (
        <div className="mt-0.5 truncate text-[10px] leading-tight opacity-80" title={noteSummary}>
          {noteSummary}
        </div>
      ) : null}
      {swap ? (
        <span className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-[#2a5b6e] px-1 text-[9px] font-medium leading-none text-white">
          <CalendarSync className="size-2.5" />补 {fmtDate(entry.makeupFrom!)}
        </span>
      ) : null}
      {voided ? <span className="sr-only">（放假停课，本节课表失效）</span> : null}
      {meta?.recorded ? (
        <span className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-primary/15 px-1 text-[9px] font-medium leading-4 text-primary">
          <ClipboardPen className="size-2.5" aria-hidden />
          已记录
        </span>
      ) : null}
      {meta?.draft ? <span className="sr-only">（草稿）</span> : null}
      {meta?.conflict ? <span className="mt-0.5 inline-block text-[10px] font-medium text-destructive">冲突</span> : null}
    </>
  )

  const cls = cn(
    "block w-full rounded-md border px-1.5 py-1 text-left",
    tone,
    meta?.conflict && "ring-2 ring-destructive/60",
    draggable && "cursor-grab touch-none select-none active:cursor-grabbing",
    onClick && "transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
  )

  if (onClick || draggable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cls}
        draggable={false}
        {...(dragProps ?? {})}
      >
        {inner}
      </button>
    )
  }
  return <div className={cls}>{inner}</div>
}
