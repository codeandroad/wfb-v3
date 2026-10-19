"use client"

import type { ReactNode } from "react"
import { MapPin, UserRound } from "lucide-react"
import { Modal } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { fmtDateFull, periodById } from "@/lib/timetable/data"
import type { ActivityDisplayGroup } from "@/lib/timetable/activity-groups"
import { resolveCardAppearance, type Appearance } from "@/lib/timetable/display"
import { cardSurfaceStyle } from "@/lib/timetable/surface"
import { resolvePreference, titleClass } from "@/lib/mt/styles"
import { StyledCardText, StyledLessonTitle } from "./display-settings"
import type { CardMeta } from "./week-grid"

export function activityPlaceSummary(group: ActivityDisplayGroup) {
  const known = group.rooms.length === 1 ? group.rooms[0] : group.rooms.length ? `${group.rooms.length} 处场所` : ""
  return [known, group.unknownRoomCount ? `${group.unknownRoomCount} 项未安排场所` : ""].filter(Boolean).join(" · ")
}

/** A compact display group, never a new shared event or an arbitrarily chosen teacher's card. */
export function ActivityGroupCard({ group, metas, appearance, onClick }: {
  group: ActivityDisplayGroup; metas: CardMeta[]; appearance?: Appearance; onClick: () => void
}) {
  // Public activity preferences apply to the summary. Per-teacher defaults stay on the individual cards.
  const identity = { ...group.entries[0], teacherId: undefined }
  const base = appearance ? resolveCardAppearance(appearance, identity) : resolvePreference()
  const conflictMetas = metas.filter(meta => meta.conflict)
  const conflictLabels = [...new Set(conflictMetas.flatMap(meta => meta.conflictLabels ?? []))]
  const conflictReasons = [...new Set(conflictMetas.flatMap(meta => meta.conflictReasons ?? []))]
  const stopped = metas.filter(meta => meta.voided).length
  const past = metas.filter(meta => meta.past && !meta.voided).length
  const drafts = group.entries.filter((entry, i) => entry.origin === "personal" || metas[i]?.draft).length
  const makeups = group.entries.filter(entry => entry.makeupFrom).length
  const locked = group.entries.filter((entry, i) => entry.locked && !metas[i]?.past && !metas[i]?.voided).length
  const regular = !(stopped || past || drafts || makeups || locked)
  const count = group.entries.length
  return <button type="button" data-activity-summary aria-label={`${identity.className}，${group.teacherIds.length} 位教师，${count} 项安排，查看详情`} onClick={onClick}
    className={cn("block w-full rounded-md border px-1.5 py-1 text-left transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
      stopped === count ? "border-dashed border-[#56627a]/25 bg-transparent text-[#56627a]/60" : past === count ? "border-border bg-muted/50 text-muted-foreground" : "border-[#c4dae2] bg-[#eaf2f5] text-[#2a5b6e]",
      conflictMetas.length > 0 && "ring-2 ring-destructive/60")}
    style={regular ? cardSurfaceStyle(appearance, identity, base) : undefined}>
    <div className={cn("truncate text-[12px] font-semibold leading-tight", titleClass(base))} style={{ color: base.hex ?? undefined }}><StyledLessonTitle entry={identity} appearance={appearance} /></div>
    <div className="mt-1 flex items-start gap-1 text-[11px] leading-tight"><UserRound className="size-2.5 shrink-0" aria-hidden /><StyledCardText entry={identity} appearance={appearance} field="teacher">{group.teacherIds.length} 位教师 · {count} 项安排</StyledCardText></div>
    <div className="mt-0.5 flex items-start gap-1 text-[11px] leading-tight"><MapPin className="size-2.5 shrink-0" aria-hidden /><StyledCardText entry={identity} appearance={appearance} field="room">{activityPlaceSummary(group)}</StyledCardText></div>
    {stopped > 0 || past > 0 || drafts > 0 || makeups > 0 || locked > 0 ? <div className="mt-1 flex flex-wrap gap-x-2 text-[10px]">
      {stopped > 0 ? <span>{stopped} 项停课／调休</span> : null}{past > 0 ? <span>{past} 项已过期</span> : null}{locked > 0 ? <span>{locked} 项已锁定</span> : null}
      {drafts > 0 ? <span>{drafts} 项草稿／个人调整</span> : null}{makeups > 0 ? <span>{makeups} 项补课</span> : null}
    </div> : null}
    {conflictMetas.length > 0 ? <div className="mt-1 text-[10px] font-medium text-destructive" title={conflictReasons.join("；")}>{conflictLabels.join(" · ") || "冲突"} · {conflictMetas.length} 项安排</div> : null}
    <div className="mt-1 text-[10px] underline underline-offset-2">查看教师与场所</div>
  </button>
}

export function ActivityGroupDialog({ group, onClose, children }: { group: ActivityDisplayGroup; onClose: () => void; children: ReactNode }) {
  const entry = group.entries[0]
  const period = periodById(entry.periodId)
  return <Modal open onClose={onClose} title={entry.className} desc={`${fmtDateFull(entry.date)} · ${period ? `${period.label} ${period.start}–${period.end}` : entry.periodId}`} width="max-w-2xl" footer={<Button variant="outline" onClick={onClose}>关闭</Button>}>
    <p className="text-sm font-medium">{group.teacherIds.length} 位教师 · {group.entries.length} 项安排</p>
    <p className="mt-1 text-xs text-muted-foreground">以下为该时段各教师的独立安排，点击可查看完整详情。</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{children}</div>
  </Modal>
}
