"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Modal } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { useResearchContext } from "@/lib/research/context"
import { activeAt, canLeadGroup, type Task } from "@/lib/research/model"
import { addDays, fmtDate, PERIODS, WEEKDAYS } from "@/lib/timetable/data"
import { RField, RSelect } from "./primitives"

export function ScheduleDays({ group, week }: { group: string; week: string }) {
  const { state, actor } = useResearchContext()
  const leader = canLeadGroup(state, actor, group)
  const [date, setDate] = useState<string | null>(null)
  return <>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="research-day-cards">
      {WEEKDAYS.map(day => {
        const dayDate = addDays(week, day.n - 1)
        const slots = (state.groupSchedules ?? []).filter(s => s.group === group && s.weekday === day.n).sort((a, b) => PERIODS.findIndex(p => p.id === a.periodId) - PERIODS.findIndex(p => p.id === b.periodId))
        const tasks = state.tasks.filter(t => t.group === group && t.scheduleDate === dayDate)
        const content = <>
          <span className="flex items-center justify-between gap-2"><span className="font-semibold">{day.label} · {fmtDate(dayDate)}</span><span className="text-muted-foreground">{slots.length} 节</span></span>
          <span className="flex flex-col gap-2">
            {slots.map(s => { const p = PERIODS.find(p => p.id === s.periodId); return <span key={s.id} className="flex flex-col"><span className="font-medium">{s.title} · {p?.label}</span><span className="text-muted-foreground">{p?.start}–{p?.end} · {s.room || "地点待定"}</span></span> })}
            {!slots.length && <span className="text-muted-foreground">无固定教研课次</span>}
          </span>
          <span className="flex flex-col gap-1 border-t pt-3">
            {tasks.map(t => <span key={t.id} className="break-words">{t.title} · {t.status}</span>)}
            {!tasks.length && <span className="text-muted-foreground">暂无当天事项</span>}
          </span>
          {leader && <span className="flex items-center gap-1 text-primary"><Plus className="size-4" />点击添加教研事项</span>}
        </>
        const cardClass = "flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-background p-4 text-left text-sm leading-relaxed text-foreground"
        return leader ? <button type="button" key={day.n} data-day={dayDate} aria-label={`${day.label} ${dayDate} 教研日卡，添加教研事项`} className={`${cardClass} cursor-pointer transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} onClick={() => setDate(dayDate)}>{content}</button> : <article key={day.n} data-day={dayDate} aria-label={`${day.label} ${dayDate} 教研日卡，只读`} className={cardClass}>{content}</article>
      })}
    </div>
    {date && leader && <DayTaskDialog key={`${group}:${date}`} group={group} date={date} onClose={() => setDate(null)} />}
  </>
}

function DayTaskDialog({ group, date, onClose }: { group: string; date: string; onClose: () => void }) {
  const { state, actor, command, people } = useResearchContext()
  const [title, setTitle] = useState("")
  const [owner, setOwner] = useState(actor.staff)
  const [requirements, setRequirements] = useState("")
  const [error, setError] = useState("")
  const members = [...new Set(state.appointments.filter(a => a.group === group && activeAt(a.start, a.end, actor.date)).map(a => a.staff))].map(id => ({ value: id, label: people.find(p => p.id === id)?.name || id }))
  function create() {
    const task: Task = { id: crypto.randomUUID(), group, title: title.trim(), scheduleDate: date, owner, requirements, parent: null, schoolTaskId: null, course: "", collaborators: [], submitters: [], due: "", mode: "牵头提交", acceptance: false, status: "进行中", outcomes: [], acceptedNote: "" }
    const result = command({ type: "save-task", task })
    if (result.ok) onClose()
    else setError(result.error)
  }
  return <Modal open onClose={onClose} title={`添加教研事项 · ${date}`} width="max-w-md" footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button disabled={!title.trim() || !owner} onClick={create}>添加事项</Button></>}>
    <FieldGroup><p className="text-sm text-muted-foreground">仅安排在 {date}，不会自动重复到下周。保存后全组可见，并同步出现在事项与分工中。</p><RField label="教研事项名称" value={title} required onChange={setTitle} /><RSelect label="事项负责人" value={owner} options={members} onChange={setOwner} /><RField label="事项说明（可选）" type="textarea" value={requirements} onChange={setRequirements} />{error && <p role="alert" className="text-destructive">{error}</p>}</FieldGroup>
  </Modal>
}
