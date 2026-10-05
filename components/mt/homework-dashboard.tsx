"use client"

import { ClipboardList, CircleCheck, Clock3, FileWarning } from "lucide-react"
import { hwProgress, lifecycleOf } from "@/lib/mt/hw"
import { clockLabel, formalTaskName, taskById, type Assignment } from "@/lib/mt/model"

export function HomeworkOverview({ assignments, nowTs }: { assignments: Assignment[]; nowTs: number }) {
  const active = assignments.filter(a => lifecycleOf(a) === "ACTIVE")
  const progress = active.map(a => hwProgress(a, nowTs))
  const items = [
    { label: "进行中作业", value: active.length, Icon: ClipboardList },
    { label: "待评价份数", value: progress.reduce((n,p) => n+p.ungraded,0), Icon: Clock3 },
    { label: "到期待核对", value: progress.reduce((n,p) => n+p.dueUnrecorded+p.suspected,0), Icon: FileWarning },
    { label: "已评价份数", value: progress.reduce((n,p) => n+p.graded+p.noGrade,0), Icon: CircleCheck },
  ]
  return <section aria-label="作业概览" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{items.map(({label,value,Icon}) => <div key={label} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-card-foreground"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span><div><strong className="block text-2xl leading-tight tabular-nums">{value}</strong><span className="text-sm text-muted-foreground">{label}</span></div></div>)}</section>
}

export function HomeworkAssignmentCard({ a, active, nowTs, onClick }: { a: Assignment; active: boolean; nowTs: number; onClick: () => void }) {
  const p = hwProgress(a, nowTs)
  const task = taskById(a.taskId)
  const life = lifecycleOf(a)
  const percent = p.E ? Math.round(p.checked / p.E * 100) : 100
  return <button type="button" aria-pressed={active} onClick={onClick} className={`flex w-full flex-col gap-2 rounded-2xl border bg-card p-4 text-left text-card-foreground transition-colors ${active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`}>
    <span className="flex w-full items-start justify-between gap-2"><strong className="text-base">{a.title}</strong><span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-sm text-primary">{life === "ACTIVE" ? "进行中" : life === "CLOSED" ? "已结束" : "已撤回"}</span></span>
    <span className="text-sm text-muted-foreground">{task ? formalTaskName(task) : "教学任务"}</span>
    <span className="text-sm">{a.deadline ? `截止 ${clockLabel(a.deadline)}` : "无截止时间"}</span>
    <span role="progressbar" aria-label="核对进度" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{width:`${percent}%`}} /></span>
    <span className="text-sm text-muted-foreground">核对 <b className="text-foreground">{p.checked}/{p.E}</b> · 待评价 {p.ungraded} · 未交 {p.missing}</span>
  </button>
}

export function HomeworkMetrics({ a, nowTs }: { a: Assignment; nowTs: number }) {
  const p = hwProgress(a, nowTs)
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["适用学生",a.recipients.length],["已评价",p.graded+p.noGrade],["待评价",p.ungraded],["已确认未交",p.missing]].map(([label,value]) => <div key={label} className="rounded-xl border border-border bg-muted/40 px-2 py-3 text-center"><strong className="block text-xl tabular-nums">{value}</strong><span className="text-sm text-muted-foreground">{label}</span></div>)}</div>
}

export function HomeworkStatistics({ a, nowTs }: { a: Assignment; nowTs: number }) {
 const p = hwProgress(a, nowTs)
 return <section className="flex flex-col gap-3 p-5" aria-label="作业统计"><h3 className="font-semibold">核对情况</h3>{[["已评价",p.graded+p.noGrade],["待评价",p.ungraded],["未交",p.missing],["到期待核对",p.dueUnrecorded+p.suspected],["未到截止",p.notDue],["免做",p.exempt]].map(([label,value])=><div key={label} className="flex items-center gap-3 text-sm"><span className="w-24 shrink-0">{label}</span><progress aria-label={String(label)} value={Number(value)} max={Math.max(a.recipients.length,1)} className="h-3 min-w-0 flex-1 accent-primary"/><strong className="w-8 text-right">{value}</strong></div>)}<p className="text-sm text-muted-foreground">按当前作业实时结果统计，结束检查不会自动补齐未登记结果。</p></section>
}
