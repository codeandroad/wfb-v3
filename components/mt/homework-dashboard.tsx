"use client"

import { effDeadline, hwState, hwProgress, lifecycleOf } from "@/lib/mt/hw"
import { clockLabel, formalTaskName, taskById, type Assignment } from "@/lib/mt/model"

export function HomeworkOverview({ assignments, nowTs }: { assignments: Assignment[]; nowTs: number }) {
  const active = assignments.filter(a => lifecycleOf(a) === "ACTIVE")
  const progress = active.map(a => hwProgress(a, nowTs))
  const total = progress.reduce((n,p)=>n+p.E,0)
  const submitted = progress.reduce((n,p)=>n+p.graded+p.noGrade+p.ungraded,0)
  const items = [
    { label: "进行中作业", value: active.length },
    { label: "待批改份数", value: progress.reduce((n,p) => n+p.ungraded,0) },
    { label: "逾期未交（已确认）", value: active.reduce((n,a)=>n+a.recipients.filter(sid=>hwState(a,sid,nowTs)==='MISSING' && !!effDeadline(a,sid) && Date.parse(effDeadline(a,sid)!)<nowTs).length,0) },
    { label: "进行中作业提交率", value: total ? `${Math.round(submitted/total*100)}%` : '—' },
  ]
  return <section aria-label="作业概览" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{items.map(({label,value}, index) => <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-card-foreground"><span aria-hidden className={`hw-stat-icon flex size-8 shrink-0 items-center justify-center rounded-lg text-base font-bold ${index === 1 ? 'hw-amber' : index === 2 ? 'hw-red' : ''}`}>{value}</span><div><strong className="block text-base leading-tight tabular-nums">{value}</strong><span className="text-sm text-muted-foreground">{label}</span></div></div>)}</section>
}

export function HomeworkAssignmentCard({ a, active, nowTs, onClick }: { a: Assignment; active: boolean; nowTs: number; onClick: () => void }) {
  const p = hwProgress(a, nowTs)
  const task = taskById(a.taskId)
  const life = lifecycleOf(a)
  const percent = p.E ? Math.round(p.checked / p.E * 100) : 100
  return <button type="button" aria-pressed={active} onClick={onClick} className={`flex w-full flex-col gap-1 rounded-xl border bg-card p-3 text-left text-card-foreground transition-colors ${active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`}>
    <span className="flex w-full items-start justify-between gap-2"><strong className="text-sm">{a.title}</strong><span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-sm text-primary">{life === "ACTIVE" ? (a.category ?? "未分类") : life === "CLOSED" ? "已结束" : "已撤回"}</span></span>
    <span className="text-sm text-muted-foreground">{task ? formalTaskName(task) : "教学任务"}</span>
    <span className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className={`rounded-full px-2 py-0.5 font-semibold ${a.deadline && Date.parse(a.deadline) < nowTs ? 'hw-red' : 'hw-amber'}`}>{life !== 'ACTIVE' ? '已归档' : !a.deadline ? '无截止' : Date.parse(a.deadline) < nowTs ? `已逾期 ${Math.ceil((nowTs-Date.parse(a.deadline))/86400000)} 天` : `${Math.ceil((Date.parse(a.deadline)-nowTs)/86400000)} 天后截止`}</span><span className="text-muted-foreground">{a.deadline ? `截止 ${clockLabel(a.deadline)}` : '持续进行'}</span></span>
    <span role="progressbar" aria-label="核对进度" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-1 w-full overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{width:`${percent}%`}} /></span>
    <span className="text-sm text-muted-foreground">核对 <b className="text-foreground">{p.checked}/{p.E}</b> · 待评价 {p.ungraded} · 未交 {p.missing}</span>
  </button>
}

export function HomeworkMetrics({ a, nowTs }: { a: Assignment; nowTs: number }) {
  const p = hwProgress(a, nowTs)
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["已批",p.graded+p.noGrade],["待批",p.ungraded],["未交",p.missing],["提交率",p.E ? `${Math.round((p.graded+p.noGrade+p.ungraded)/p.E*100)}%` : '—']].map(([label,value]) => <div key={label} className="rounded-lg border border-border bg-muted/40 px-2 py-2 text-center"><strong className="block text-base tabular-nums">{value}</strong><span className="text-sm text-muted-foreground">{label}</span></div>)}</div>
}

export function HomeworkStatistics({ a, nowTs }: { a: Assignment; nowTs: number }) {
 const p = hwProgress(a, nowTs)
 return <section className="flex flex-col gap-3 p-4" aria-label="作业统计"><h3 className="font-semibold">核对情况</h3>{[["已评价",p.graded+p.noGrade],["待评价",p.ungraded],["未交",p.missing],["到期待核对",p.dueUnrecorded+p.suspected],["未到截止",p.notDue],["免做",p.exempt]].map(([label,value])=><div key={label} className="flex items-center gap-3 text-sm"><span className="w-24 shrink-0">{label}</span><progress aria-label={String(label)} value={Number(value)} max={Math.max(a.recipients.length,1)} className="h-3 min-w-0 flex-1 accent-primary"/><strong className="w-8 text-right">{value}</strong></div>)}<p className="text-sm text-muted-foreground">按当前作业实时结果统计，结束检查不会自动补齐未登记结果。</p></section>
}
