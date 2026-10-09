"use client"

import { useState } from "react"
import { MapPin } from "lucide-react"
import { Modal } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { ClassCard, WeekGrid } from "@/components/timetable/week-grid"
import { useResearchContext } from "@/lib/research/context"
import { canLeadGroup, type Task } from "@/lib/research/model"
import { fmtDate, periodById, WEEKDAYS, type ProjectedEntry } from "@/lib/timetable/data"
import { cn } from "@/lib/utils"
import { RField } from "./primitives"

export function ScheduleDays({ group, week, entries }: { group: string; week: string; entries: ProjectedEntry[] }) {
  const { state, actor } = useResearchContext()
  const leader = canLeadGroup(state, actor, group)
  const [date, setDate] = useState<string | null>(null)
  return <>
    <div className="overflow-x-auto" data-testid="research-day-cards">
      <WeekGrid className="min-w-[640px]" weekStart={week} entries={entries} compact canonical renderDay={({ weekday, date: dayDate, entries: dayEntries, stopped }) => {
        const tasks = state.tasks.filter(t => t.group === group && t.scheduleDate === dayDate)
        if (!dayEntries.length && !tasks.length) return null
        const courses = new Map<string, ProjectedEntry[]>()
        for (const entry of dayEntries) {
          const key = JSON.stringify([entry.className, entry.room, entry.makeupFrom])
          const course = courses.get(key)
          if (course) course.push(entry)
          else courses.set(key, [entry])
        }
        const merged: ProjectedEntry = { key: `${group}:day:${dayDate}`, weekday, date: dayDate, periodId: "", className: "当日教研", subject: "教研", room: null, kind: "activity", teacherId: `research:${group}`, makeupFrom: dayEntries.find(entry => entry.makeupFrom)?.makeupFrom }
        const dayLabel = WEEKDAYS.find(day => day.n === weekday)?.label ?? ""
        return <ClassCard entry={merged} canonical meta={{ voided: stopped && !!dayEntries.length && !tasks.length }} ariaLabel={`${dayLabel} ${dayDate} 教研日卡，${leader ? "添加事项" : "只读"}`} onClick={leader ? () => setDate(dayDate) : undefined}>
          <span className="flex min-w-0 flex-col gap-2 text-sm leading-relaxed">
            {[...courses].map(([key, lessons]) => <span key={key} className={cn("flex flex-col gap-1", stopped && !lessons[0].makeupFrom && "opacity-60")}>
              <span className="break-words font-semibold">{lessons[0].className}</span>
              {lessons.map(lesson => { const period = periodById(lesson.periodId); return <span key={lesson.key} className="opacity-80">{period ? `${period.label} · ${period.start}–${period.end}` : lesson.periodId}</span> })}
              <span className="inline-flex items-center gap-1 opacity-80"><MapPin className="size-4 shrink-0" aria-hidden />{lessons[0].room || "地点待定"}</span>
              {lessons[0].makeupFrom && <span>补 {fmtDate(lessons[0].makeupFrom)} 课表</span>}
              {stopped && !lessons[0].makeupFrom && <span>停课／调休（本日不授课）</span>}
            </span>)}
            {tasks.length > 0 && <span className="flex flex-col gap-1">
              {tasks.map(task => <span key={task.id} className="break-words">{task.title} · {task.status}</span>)}
            </span>}
          </span>
        </ClassCard>
      }} />
    </div>
    {date && leader && <DayTaskDialog key={`${group}:${date}`} group={group} date={date} onClose={() => setDate(null)} />}
  </>
}

function DayTaskDialog({ group, date, onClose }: { group: string; date: string; onClose: () => void }) {
  const { actor, command } = useResearchContext()
  const [title, setTitle] = useState("")
  const [requirements, setRequirements] = useState("")
  const [error, setError] = useState("")
  function create() {
    const task: Task = { id: crypto.randomUUID(), group, title: title.trim(), scheduleDate: date, owner: actor.staff, requirements, parent: null, schoolTaskId: null, course: "", collaborators: [], submitters: [], due: "", mode: "牵头提交", acceptance: false, status: "进行中", outcomes: [], acceptedNote: "" }
    const result = command({ type: "save-task", task })
    if (result.ok) onClose()
    else setError(result.error)
  }
  return <Modal open onClose={onClose} title={`添加教研事项 · ${date}`} width="max-w-md" footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button disabled={!title.trim()} onClick={create}>添加事项</Button></>}>
    <FieldGroup><p className="text-sm text-muted-foreground">仅安排在 {date}，不会自动重复到下周。保存后全组可见，并同步出现在事项与分工中。</p><RField label="教研事项名称" value={title} required onChange={setTitle} /><RField label="事项说明（可选）" type="textarea" value={requirements} onChange={setRequirements} />{error && <p role="alert" className="text-destructive">{error}</p>}</FieldGroup>
  </Modal>
}
