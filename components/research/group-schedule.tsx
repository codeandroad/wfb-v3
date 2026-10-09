"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Pencil, Check, Lock } from "lucide-react"
import { Modal } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FieldGroup } from "@/components/ui/field"
import { WeekGrid } from "@/components/timetable/week-grid"
import { useTimetable } from "@/lib/timetable/store"
import { addDays, fmtDate, PERIODS, WEEKDAYS, weekStartOf, type ProjectedEntry } from "@/lib/timetable/data"
import { useResearchContext } from "@/lib/research/context"
import { canLeadGroup, groups, type GroupScheduleSlot } from "@/lib/research/model"
import { Panel, RField, RSelect } from "./primitives"

export function GroupSchedule({ group }: { group: string }) {
  const { state, actor, command } = useResearchContext()
  const tt = useTimetable()
  const [week, setWeek] = useState(tt.weekStart)
  const [editing, setEditing] = useState(false)
  const [slot, setSlot] = useState<GroupScheduleSlot | null>(null)
  const [message, setMessage] = useState("")
  const leader = canLeadGroup(state, actor, group)
  const canEdit = leader && editing
  const groupName = groups.find(g => g.id === group)?.name ?? "科组"
  const slots = (state.groupSchedules ?? []).filter(s => s.group === group)
  const entries: ProjectedEntry[] = slots.map(s => ({ key: s.id, weekday: s.weekday, periodId: s.periodId, className: s.title, subject: groupName.replace("组", ""), room: s.room, kind: "activity", date: addDays(week, s.weekday - 1), teacherId: `research:${group}` }))
  function save(value: GroupScheduleSlot) {
    const result = command({ type: "save-group-slot", slot: value })
    setMessage(result.ok ? "已更新本组共享安排（本机演示），组员查看同一份课表。" : result.error)
    return { ok: result.ok, msg: result.ok ? "已保存" : result.error }
  }
  return <section aria-label="本组教研课表" data-testid="group-schedule" data-editable={canEdit}>
    <Panel title="本组教研课表" description="仅展示本组教研安排 · 每周固定课次 · 与个人课表草稿分开维护" action={<Badge variant="outline">{leader ? "组长可维护" : "组员共享只读"}</Badge>}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="icon-sm" aria-label="上一周教研课表" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft /></Button><span>{fmtDate(week)}–{fmtDate(addDays(week, 6))}</span><Button variant="outline" size="icon-sm" aria-label="下一周教研课表" onClick={() => setWeek(addDays(week, 7))}><ChevronRight /></Button><Button variant="ghost" size="sm" onClick={() => setWeek(weekStartOf(actor.date))}>本周</Button></div>
        {leader ? <Button variant={canEdit ? "default" : "outline"} size="sm" onClick={() => { setEditing(!canEdit); setSlot(null); setMessage("") }}>{canEdit ? <Check data-icon="inline-start" /> : <Pencil data-icon="inline-start" />}{canEdit ? "完成调整" : "调整教研课表"}</Button> : <span className="flex items-center gap-2 text-muted-foreground"><Lock className="size-4" />仅教研组长可修改</span>}
      </div>
      {canEdit && <p className="text-muted-foreground">拖拽课卡调整每周安排；点击课卡修改名称、教室或用选择器移动；点击空格新增。每次操作直接保存本组安排，不改成员个人草稿。</p>}
      {!slots.length && <p className="text-muted-foreground">本组暂无固定教研安排，由组长添加。</p>}
      <div className="overflow-x-auto"><WeekGrid key={`${group}:${canEdit}`} className="min-w-[640px]" weekStart={week} entries={entries} compact canonical editing={canEdit} onMove={canEdit ? (entry, weekday, periodId) => { const current = slots.find(s => s.id === entry.key); if (current) save({ ...current, weekday, periodId }) } : undefined} onCardClick={canEdit ? entry => setSlot(slots.find(s => s.id === entry.key) ?? null) : undefined} onAddCell={canEdit ? (weekday, periodId) => setSlot({ id: crypto.randomUUID(), group, weekday, periodId, title: `${groupName.replace("组", "")}教研`, room: null }) : undefined} /></div>
      {message && <p role="status" className="text-primary">{message}</p>}
      <Modal open={!!slot && canEdit} onClose={() => setSlot(null)} title="教研课卡信息" width="max-w-md" footer={<><Button variant="outline" onClick={() => setSlot(null)}>取消</Button>{slot && slots.some(s => s.id === slot.id) && <Button variant="destructive" onClick={() => { const result = command({ type: "delete-group-slot", id: slot.id }); setMessage(result.ok ? "已删除该教研安排。" : result.error); if (result.ok) setSlot(null) }}>删除课卡</Button>}<Button disabled={!slot?.title.trim()} onClick={() => { if (slot && save(slot).ok) setSlot(null) }}>保存安排</Button></>}>
        {slot && <FieldGroup><RField label="教研名称" value={slot.title} onChange={title => setSlot({ ...slot, title })} /><RField label="教室" value={slot.room ?? ""} onChange={room => setSlot({ ...slot, room: room || null })} /><RSelect label="星期" value={String(slot.weekday)} options={WEEKDAYS.map(d => ({ value: String(d.n), label: d.label }))} onChange={weekday => setSlot({ ...slot, weekday: Number(weekday) })} /><RSelect label="节次" value={slot.periodId} options={PERIODS.map(p => ({ value: p.id, label: `${p.label} · ${p.start}–${p.end}` }))} onChange={periodId => setSlot({ ...slot, periodId })} />{message && <p role="status">{message}</p>}</FieldGroup>}
      </Modal>
    </Panel>
  </section>
}
