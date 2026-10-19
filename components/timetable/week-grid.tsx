"use client"

import { TimetableDisplaySettings, StyledLessonTitle, StyledCardText, useTimetableAppearance, personalAppearanceTask } from "./display-settings"
import { TimetableFilterBar } from "./card-filters"
import { ActivityGroupCard, ActivityGroupDialog } from "./activity-group-card"
import { groupActivityEntries } from "@/lib/timetable/activity-groups"
import { EMPTY_CARD_FILTERS, hasCardFilters, matchesCardFilters, cardDisplayLabels, resolveCardAppearance, type Appearance, type DisplayMode, type CardFilters } from "@/lib/timetable/display"
import { teacherById } from "@/lib/timetable/data"
import { Palette, UserRound } from "lucide-react"
import { useTeaching } from "@/lib/teaching/store"
import { assessSchedule, entryStudentRoster, scheduleEntryKey, type ScheduleAssessment } from "@/lib/timetable/conflict-display"
import { cardSurfaceStyle } from "@/lib/timetable/surface"
import { Badge } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import { eventCovers, stoppedDatesFor, swapClonesFor, useCalendarEvents } from "@/lib/timetable/calendar-store"
import { recordKey, useLessonRecords } from "@/lib/timetable/lesson-records"
import { dutyName, useDuties } from "@/lib/timetable/duty-store"
import { useTeacherId } from "@/lib/mt/derive"
import { teacherWeekEntries, useTimetable } from "@/lib/timetable/store"
import { weekStartOf } from "@/lib/timetable/data"
import { useMt } from "@/lib/mt/store"
import { resolveStyle, tagStyle, titleClass } from "@/lib/mt/styles"
import { teacherSurfaceStyle } from "@/lib/timetable/teacher-appearance"
import {
  addDays,
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

export type CardMeta = {
  conflict?: boolean
  conflictLabels?: string[]
  conflictReasons?: string[]
  reviewReasons?: string[]
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
  onCopyCell,
  compact = false,
  renderDay,
  displayControls,
  calendarSourceEntries,
  showTeacher = false,
  initialFilters,
  filterScope,
  groupActivities = false,
  allowStyleEditing = true,
}: {
  /** Read-only fixture views keep the real filters while preventing preference writes. */
  allowStyleEditing?: boolean
  /** Compact summaries are display-only and enabled only by the read-only school activity view. */
  groupActivities?: boolean
  initialFilters?: Partial<CardFilters>
  /** Limits visible objects while the full source remains available for conflicts and calendar projection. */
  filterScope?: Partial<CardFilters>
  displayControls?: DisplayMode
  calendarSourceEntries?: (date: string) => ProjectedEntry[]
  showTeacher?: boolean
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
  onCopyCell?: (entry: ProjectedEntry, cell: { weekday: number; periodId: string; date: string }) => { ok: boolean; msg: string }
  compact?: boolean
  renderDay?: (day: { weekday: number; date: string; entries: ProjectedEntry[]; stopped: boolean }) => React.ReactNode
}) {
  const [filters, setFilters] = useState({ ...EMPTY_CARD_FILTERS, ...initialFilters })
  const [stylesOpen, setStylesOpen] = useState(false)
  const [openActivityGroup, setOpenActivityGroup] = useState<{ key: string; context: string } | null>(null)
  const { appearance } = useTimetableAppearance(displayControls ?? "teacher")
  const cardAppearance = displayControls === "admin" || !canonical ? appearance : undefined
  const mt = useMt()
  const teacherId = useTeacherId()
  const duties = useDuties()
  const teaching = useTeaching()
  const timetable = useTimetable()
  const sharedEvents = useCalendarEvents()
  const calendarEvents = calendarEventsProp ?? sharedEvents
  const records = useLessonRecords()
  // null=跟随是否有晚间课自动展开/折叠；true/false=用户手动覆盖
  const [eveningOverride, setEveningOverride] = useState<boolean | null>(null)
  const [over, setOver] = useState<string | null>(null) // `${periodId}@${date}`
  const [ghost, setGhost] = useState<{ x: number; y: number; entry: ProjectedEntry } | null>(null)
  const draggedAtRef = useRef(0)
  const [copied, setCopied] = useState<ProjectedEntry | null>(null)
  const [copyMessage, setCopyMessage] = useState("")

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
      setGhost({ x: ev.clientX, y: ev.clientY, entry: s.entry })
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
    ...days.flatMap((d) => swapClonesFor(calendarEvents, entries, d.date, stoppedDates, makeupEdits, calendarSourceEntries ?? (canonical ? undefined : date => [...new Set(entries.map(e => e.teacherId))].flatMap(id => teacherWeekEntries(timetable, id, weekStartOf(date)).entries)))),
  ]

  // Assess the complete effective projection before display filters, excluding cancelled source days.
  const assessment = assessSchedule(renderEntries.filter(e => !stoppedDates.has(e.date) && !e.movedTo), e => entryStudentRoster(e, mt.ready && !mt.loadError ? mt.biz.memberships : null, teaching))
  const inScope = (entry: ProjectedEntry) => !filterScope || matchesCardFilters(entry, { ...EMPTY_CARD_FILTERS, ...filterScope })
  const scopedEntries = renderEntries.filter(inScope)
  const scopedAssessment = filterScope ? {
    conflicts: assessment.conflicts.filter(issue => inScope(issue.a) || inScope(issue.b)),
    reviews: assessment.reviews.filter(issue => inScope(issue.a) || inScope(issue.b)),
  } : assessment
  const issuesFor = (entry: ProjectedEntry) => {
    const key = scheduleEntryKey(entry)
    const conflicts = assessment.conflicts.filter(c => scheduleEntryKey(c.a) === key || scheduleEntryKey(c.b) === key)
    const reviews = assessment.reviews.filter(c => scheduleEntryKey(c.a) === key || scheduleEntryKey(c.b) === key)
    return {
      conflict: !!conflicts.length || !!conflictKeys?.has(key),
      conflictLabels: [...new Set(conflicts.map(c => ({ teacher: "教师冲突", room: "教室冲突", student: "学生冲突", time: "时段冲突", unknown: "冲突待核对" })[c.type]))],
      conflictReasons: conflicts.map(c => c.reason),
      reviewReasons: reviews.map(c => c.reason),
    }
  }

  const matchesDisplay = (entry: ProjectedEntry) => {
    if (!inScope(entry)) return false
    const labels = cardDisplayLabels(entry, canonical, teacherId, mt.biz, dutyName(duties, entry.className, entry.group))
    return matchesCardFilters({ ...entry, searchText: [labels.marker, labels.courseLabel].filter(Boolean).join(" ") }, filters)
  }
  const visibleEntries = displayControls ? scopedEntries.filter(matchesDisplay) : scopedEntries
  const grouping = groupActivities && !editing && displayControls === "admin" && filterScope?.kind === "activity"
  const displayGroups = grouping ? groupActivityEntries(visibleEntries) : []
  const groupContext = JSON.stringify([weekStart, filters, filterScope])
  const activeGroup = openActivityGroup?.context === groupContext ? displayGroups.find(group => group.key === openActivityGroup.key && group.entries.length > 1) : undefined
  if (openActivityGroup && !activeGroup) setOpenActivityGroup(null)
  const entryMeta = (entry: ProjectedEntry): CardMeta => ({
    ...issuesFor(entry), draft: draftKeys?.has(entry.key),
    past: !!clockDate && entry.date < clockDate,
    voided: stoppedDates.has(entry.date) && !entry.makeupFrom,
  })
  const filtering = !!displayControls && hasCardFilters(filters)
  const eveningCount = scopedEntries.filter(
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
          const canAdd = editing && (!!onAddCell || !!copied && !!onCopyCell) && items.length === 0 && !isPastCell && !isStopped
          const displayed = items.filter(e => inScope(e) && (!displayControls || matchesDisplay(e)))
          const cellGroups = grouping ? groupActivityEntries(displayed) : displayed.map((entry, i) => ({ key: `${entry.key}:${i}`, entries: [entry], teacherIds: [entry.teacherId], rooms: [], unknownRoomCount: 0 }))
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
                    onClick={() => {
                      if (copied && onCopyCell) {
                        const result = onCopyCell(copied, { weekday: d.n, periodId: p.id, date: d.date })
                        setCopyMessage(result.ok ? `已复制到${d.label}${p.label}，可继续点击其他空格。` : result.msg)
                      } else onAddCell?.(d.n, p.id, d.date)
                    }}
                    className="flex min-h-[46px] w-full items-center justify-center rounded-md border border-dashed border-border/60 text-muted-foreground/40 transition-colors hover:border-primary/60 hover:bg-accent/40 hover:text-primary"
                    aria-label={copied && onCopyCell ? `粘贴到 ${d.label} ${p.label}` : `在 ${d.label} ${p.label} 新增课次`}
                  >
                    <Plus className="size-4" />
                  </button>
                ) : null}
                {cellGroups.map((group, i) => group.entries.length > 1 ? (
                  <ActivityGroupCard key={group.key} group={group} metas={group.entries.map(entryMeta)} appearance={cardAppearance} onClick={() => setOpenActivityGroup({ key: group.key, context: groupContext })} />
                ) : group.entries.map(e => (
                  <div key={e.key + i} className="flex min-w-0 flex-col gap-1">
                  <ClassCard
                    entry={e}
                    canonical={canonical}
                    showTeacher={showTeacher}
                    appearance={cardAppearance}
                    meta={{
                      ...issuesFor(e),
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
                  {editing && onCopyCell && draggableFor(e) && <Button variant="ghost" size="xs" aria-label={`复制${e.className} ${d.label}${p.label}`} onClick={() => { setCopied({ ...e }); setCopyMessage("已选中课卡，点击空格粘贴；可连续复制多节。") }}><Copy data-icon="inline-start" />复制</Button>}
                  </div>
                )))}
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
    <>
      {displayControls ? <div className="mb-3 space-y-2 rounded-lg border border-border bg-card px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-xs text-muted-foreground">显示 {visibleEntries.length} / {scopedEntries.length} {grouping ? `项安排 · ${displayGroups.length} 张课卡` : "张课卡"}{filtering ? " · 筛选仅影响显示" : ""}</p>{allowStyleEditing ? <Button variant="outline" size="xs" onClick={() => setStylesOpen(true)}><Palette className="mr-1 size-3.5" />显示样式</Button> : null}</div>
        <TimetableFilterBar entries={scopedEntries} value={filters} onChange={setFilters} showTeacher={showTeacher} fixedKind={filterScope?.kind === "all" ? undefined : filterScope?.kind} />
        {!filtering && filterScope && scopedEntries.length === 0 ? <p className="text-sm">本周暂无{filterScope.kind === "activity" ? "活动" : "课卡"}安排，可切换周次或左侧对象查看。</p> : null}
        {filtering && visibleEntries.length === 0 ? <p className="text-sm">没有符合条件的课卡，可清除筛选查看全部安排。</p> : null}
        {filtering && editing ? <p className="text-xs text-muted-foreground">隐藏的课次仍占用原时段；新增、复制和移动会核对完整课表。</p> : null}
      </div> : null}
      {stylesOpen && displayControls && allowStyleEditing ? <TimetableDisplaySettings mode={displayControls} entries={scopedEntries} onClose={() => setStylesOpen(false)} /> : null}
      {activeGroup ? <ActivityGroupDialog group={activeGroup} onClose={() => setOpenActivityGroup(null)}>{activeGroup.entries.map((entry, i) => <ClassCard key={`${scheduleEntryKey(entry)}:${i}`} entry={entry} meta={entryMeta(entry)} canonical showTeacher appearance={cardAppearance} onClick={onCardClick ? () => { setOpenActivityGroup(null); onCardClick(entry) } : undefined} />)}</ActivityGroupDialog> : null}
      <ScheduleIssues assessment={scopedAssessment} />
    <div data-layout={renderDay ? "days" : "periods"} className={cn("overflow-hidden rounded-lg border bg-card", editing ? "border-primary/50 ring-1 ring-primary/30" : "border-border", className)}>
      {editing && copied && onCopyCell && <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-accent px-3 py-2 text-sm text-accent-foreground"><p role="status">复制「{copied.className}」 · {copyMessage}</p><Button variant="outline" size="sm" onClick={() => { setCopied(null); setCopyMessage("") }}>结束复制</Button></div>}
      <div className="flex items-stretch bg-muted/60">
        <div className={cn(AXIS, "shrink-0 px-1 py-1.5 text-center text-[10px] text-muted-foreground")}>{renderDay ? "日程" : "节次"}</div>
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
                  <>{e.title ?? "停课"} {fmtDate(e.date)}–{fmtDate(e.endDate)}（{e.scope}）：期间��表失效</>
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

      {renderDay ? (
        <div className="flex items-stretch border-t border-border/70">
          <div className={cn(AXIS, "flex shrink-0 items-center justify-center text-sm text-muted-foreground")}>当日</div>
          {days.map((day) => (
            <div
              key={day.n}
              data-day={day.date}
              className={cn("min-w-0 flex-1 border-l border-border/70 p-1", day.n >= 6 && "bg-muted/20", stoppedDates.has(day.date) && "bg-muted/40")}
            >
              <div className="flex min-h-[46px] flex-col gap-1">
                {renderDay({
                  weekday: day.n,
                  date: day.date,
                  entries: visibleEntries.filter(entry => entry.date === day.date).sort((a, b) => (periodById(a.periodId)?.no ?? 0) - (periodById(b.periodId)?.no ?? 0)),
                  stopped: stoppedDates.has(day.date),
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {dayPeriods.filter(p => !compact || editing || scopedEntries.some(e => e.periodId === p.id)).map((p) => renderRow(p, p.id === "a1"))}

          {(!compact || editing || eveningCount > 0) && <button
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
          </button>}
          {showEvening ? eveningPeriods.map((p) => renderRow(p, false)) : null}
        </>
      )}

      {ghost ? (
        <div
          className="pointer-events-none fixed z-50 w-40 -translate-x-1/2 -translate-y-1/2 rounded-md bg-card text-foreground shadow-lg"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <ClassCard entry={ghost.entry} canonical={canonical} showTeacher={showTeacher} appearance={cardAppearance} meta={issuesFor(ghost.entry)} />
        </div>
      ) : null}
    </div>
    </>
  )
}

export function ScheduleIssues({ assessment }: { assessment: ScheduleAssessment }) {
  if (!assessment.conflicts.length && !assessment.reviews.length) return null
  const label = (entry: ProjectedEntry) => `${entry.className}（${teacherById(entry.teacherId)?.name ?? entry.teacherId}）`
  return <details className="mb-3 rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] px-3 py-2 text-xs" open>
    <summary className="cursor-pointer font-medium">当前范围：{assessment.conflicts.length} 项冲突 · {assessment.reviews.length} 项待核对</summary>
    <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
      {[...assessment.conflicts.map(item => ({ ...item, confirmed: true })), ...assessment.reviews.map(item => ({ ...item, confirmed: false }))].map((item, i) => <li key={i} className={item.confirmed ? "text-destructive" : "text-[#805b17]"}>
        <strong>{item.confirmed ? "冲突" : "待核对"} · {fmtDate(item.a.date)} {periodById(item.a.periodId)?.label}</strong>：{label(item.a)} / {label(item.b)}。{item.reason}
      </li>)}
    </ul>
    <p className="mt-2 text-muted-foreground">基于当前范围的全部有效课次判断；筛选隐藏课卡不会消除提示。</p>
  </details>
}

export function ClassCard({
  entry,
  meta,
  onClick,
  dragProps,
  canonical = false,
  showTeacher = false,
  appearance,
  children,
  ariaLabel,
}: {
  entry: ProjectedEntry
  showTeacher?: boolean
  appearance?: Appearance
  meta?: CardMeta
  canonical?: boolean
  children?: React.ReactNode
  ariaLabel?: string
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
  const { ownTask, marker, customShown, courseLabel } = cardDisplayLabels(entry, canonical, teacherId, mt.biz, dutyName(duties, entry.className, entry.group))
  const styleTask = appearance?.mode === "teacher" ? !canonical ? personalAppearanceTask(appearance, entry) : null : ownTask
  // 本人样式仅作用于本人真实任务课卡；学校版/差异（canonical）不染色
  const ps = appearance && (appearance.mode === "admin" || entry.kind === "activity")
    ? resolveCardAppearance(appearance, entry)
    : styleTask && teacherId ? resolveStyle(mt.biz, teacherId, styleTask) : null
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
        <span
          className={cn("truncate text-[12px] font-semibold leading-tight", ps && titleClass(ps))}
          style={ps?.hex ? { color: ps.hex } : undefined}
        >
          <StyledLessonTitle entry={entry} appearance={appearance} />
        </span>
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
            style={ps ? tagStyle(ps) : undefined}
          >
            {marker}
          </span>
        </div>
      ) : null}
      {courseLabel ? <div className="mt-0.5 truncate text-[11px] leading-tight opacity-80">{courseLabel}</div> : null}
      {showTeacher ? <div className="mt-0.5 flex items-start gap-1 text-[11px] leading-tight"><UserRound className="size-2.5 shrink-0" aria-hidden /><StyledCardText entry={entry} appearance={appearance} field="teacher">{teacherById(entry.teacherId)?.name ?? entry.teacherId}</StyledCardText></div> : null}
      {/* 地点 */}
      <div className="mt-0.5 flex items-center gap-1 text-[11px] leading-tight opacity-90">
        {entry.room ? (
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="size-2.5" />
            <StyledCardText entry={entry} appearance={appearance} field="room">{entry.room}</StyledCardText>
          </span>
        ) : (
          <span className="text-[10px] opacity-70">未安排场所</span>
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
      {voided ? <span className="text-xs font-medium">停课／调休（本日不授课）</span> : null}
      {meta?.recorded ? (
        <span className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-primary/15 px-1 text-[9px] font-medium leading-4 text-primary">
          <ClipboardPen className="size-2.5" aria-hidden />
          已记录
        </span>
      ) : null}
      {meta?.draft || personal ? <span className="text-xs font-medium">草稿／个人调整</span> : null}
      {meta?.conflict ? <span title={meta.conflictReasons?.join("；")} className="mt-0.5 inline-block text-[10px] font-medium text-destructive">{meta.conflictLabels?.length ? meta.conflictLabels.join(" · ") : "冲突"}</span> : null}
      {meta?.reviewReasons?.length ? <span title={meta.reviewReasons.join("；")} className="mt-0.5 inline-block text-[10px] font-medium text-[#805b17]">同时段安排 · 待核对</span> : null}
    </>
  )

  const cls = cn(
    "block w-full rounded-md border px-1.5 py-1 text-left",
    tone,
    meta?.conflict && "ring-2 ring-destructive/60",
    !meta?.conflict && !!meta?.reviewReasons?.length && "ring-1 ring-[#b88522]/60",
    draggable && "cursor-grab touch-none select-none active:cursor-grabbing",
    onClick && "transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
  )

  const plainTone = !!ps
  const personalCard = ps && !locked && !voided && !meta?.draft && !personal && !swap
    ? styleTask && teacherId && appearance?.mode !== "admin" && !activity
      ? teacherSurfaceStyle(mt.biz.styles ?? {}, teacherId, styleTask)
      : cardSurfaceStyle(appearance, entry, ps)
    : undefined

  if (onClick || draggable) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={cls}
        style={personalCard}
        data-style-bg={ps && plainTone ? ps.bg?.label ?? "" : ""}
        draggable={false}
        {...(dragProps ?? {})}
      >
        {children ?? inner}
      </button>
    )
  }
  return (
    <div role={ariaLabel ? "group" : undefined} aria-label={ariaLabel} className={cls} style={personalCard}>
      {children ?? inner}
    </div>
  )
}
