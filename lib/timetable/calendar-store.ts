"use client"

// 校历事项共享源：教务「校历与调休」与各课表网格读同一份，新增后课表立即失效/标注。
import { useSyncExternalStore } from "react"
import { CALENDAR_EVENTS, type CalEvent, type ProjectedEntry, type SlotEdit } from "@/lib/timetable/data"

let events: CalEvent[] = CALENDAR_EVENTS
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useCalendarEvents(): CalEvent[] {
  return useSyncExternalStore(subscribe, () => events, () => CALENDAR_EVENTS)
}

export function addCalendarEvent(ev: CalEvent) {
  events = [...events, ev]
  listeners.forEach((l) => l())
}

export function updateCalendarEvent(ev: CalEvent) {
  events = events.map((e) => (e.id === ev.id ? ev : e))
  listeners.forEach((l) => l())
}

export function removeCalendarEvent(id: string) {
  events = events.filter((e) => e.id !== id)
  listeners.forEach((l) => l())
}

// 事项是否覆盖某日：date..endDate（含端点）；无 endDate 视为单日
export function eventCovers(e: CalEvent, date: string): boolean {
  return date >= e.date && date <= (e.endDate ?? e.date)
}

/**
 * 校历投影（全应用唯一实现）：完整课表网格与「我的教学」简版共用。
 * - 停课日（holiday 覆盖日 + 调休来源日）的课次标为停课，不作为有效课次；
 * - 调休补课日克隆来源日（同星期）课次，key 为 `${key}@swap-${来源日}`，并套用该日单次编辑。
 */
export function stoppedDatesFor(events: CalEvent[], dates: string[]): Set<string> {
  const out = new Set<string>()
  for (const d of dates) if (events.some((e) => e.kind === "holiday" && eventCovers(e, d))) out.add(d)
  for (const e of events) if (e.kind === "swap" && e.targetDate) out.add(e.date)
  return out
}

function weekdayOfIso(iso: string): number {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z")
  return ((d.getUTCDay() + 6) % 7) + 1
}

export function swapClonesFor(
  events: CalEvent[],
  entries: ProjectedEntry[],
  date: string,
  stopped: Set<string>,
  makeupEdits?: SlotEdit[],
  sourceEntries?: (date: string) => ProjectedEntry[],
): ProjectedEntry[] {
  const out: ProjectedEntry[] = []
  for (const s of events.filter((e) => e.kind === "swap" && e.targetDate === date)) {
    const source = sourceEntries ? sourceEntries(s.date) : entries
    for (const e of source.filter(x => x.date === s.date && !x.makeupFrom && !x.movedTo)) {
      const clone: ProjectedEntry = { ...e, date, makeupFrom: s.date, origin: "calendar", key: `${e.key}@swap-${s.date}` }
      const ed = [...(makeupEdits ?? [])].reverse().find((x) => x.key === clone.key && x.onDate === date)
      if (!ed) {
        out.push(clone)
        continue
      }
      if (ed.action === "remove") continue
      out.push({
        ...clone,
        origin: "personal",
        periodId: ed.action === "move" ? ed.periodId : clone.periodId,
        room: ed.room,
        className: ed.className ?? clone.className,
        group: ed.group !== undefined ? ed.group || undefined : clone.group,
        note: ed.note !== undefined ? ed.note || undefined : clone.note,
        noteShow: ed.noteShow ?? clone.noteShow,
        displayMode: ed.displayMode ?? clone.displayMode,
        customLabel: ed.customLabel !== undefined ? ed.customLabel || undefined : clone.customLabel,
      })
    }
  }
  return out
}

/** 一周的有效课次（已扣除停课日，含补课克隆） */
export function effectiveWithCalendar(
  events: CalEvent[],
  entries: ProjectedEntry[],
  weekDates: string[],
  makeupEdits?: SlotEdit[],
  sourceEntries?: (date: string) => ProjectedEntry[],
): { effective: ProjectedEntry[]; stopped: Set<string> } {
  const stopped = stoppedDatesFor(events, [...new Set([...entries.map((e) => e.date), ...weekDates])])
  const clones = weekDates.flatMap((d) => swapClonesFor(events, entries, d, stopped, makeupEdits, sourceEntries))
  return { effective: [...entries.filter((e) => !stopped.has(e.date)), ...clones], stopped }
}

export function eventDays(e: CalEvent): number {
  const a = new Date(e.date + "T00:00:00Z").getTime()
  const b = new Date((e.endDate ?? e.date) + "T00:00:00Z").getTime()
  return Math.round((b - a) / 86400000) + 1
}
