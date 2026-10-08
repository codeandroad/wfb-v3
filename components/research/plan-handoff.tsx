"use client"
import { useState } from "react"
import Link from "next/link"
import { useMt, usePlanWriter } from "@/lib/mt/store"
import { permittedTasks, useTeacherId } from "@/lib/mt/derive"
import { formalTaskName } from "@/lib/mt/model"
import type { Document } from "@/lib/research/store"

export function PlanHandoff({ document: doc }: { document: Document }) {
  const mt = useMt()
  const teacher = useTeacherId()
  const write = usePlanWriter()
  const [target, setTarget] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const tasks = permittedTasks(mt.biz, teacher).filter(t => doc.course === "C101" && t.course_id === "COURSE_MATH_9709")
  const task = tasks.find(t => t.id === target)
  const prefix = `research:${doc.id}:v${doc.version}:`
  const existing = task ? mt.biz.plans[task.id] : undefined
  const newItems = doc.items.filter(i => selected.includes(i.id) && !existing?.items.some(p => p.id === prefix + i.id))
  return <section className="flex flex-col gap-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">用于本人教学班</h2><p className="text-sm text-muted-foreground">仅追加所选教学内容，不替换原安排、不写入学生记录或已发布反馈。此次采用保留 v{doc.version} 正文快照。不同班级独立保存；同版本同项目不重复添加。当前已明确映射 C101 → COURSE_MATH_9709，其他课程尚未映射，不按同名推测。</p><label className="text-sm">任教任务<select className="block w-full rounded-lg border bg-background p-2" value={target} onChange={e => { setTarget(e.target.value); setConfirmed(false) }}><option value="">选择目标</option>{tasks.map(t => <option key={t.id} value={t.id}>{formalTaskName(t)}</option>)}</select></label>{doc.items.map(i => <label className="flex items-start gap-2 text-sm" key={i.id}><input type="checkbox" checked={selected.includes(i.id)} onChange={e => { setSelected(e.target.checked ? [...selected,i.id] : selected.filter(id => id !== i.id)); setConfirmed(false) }} /><span>{i.title}<span className="block whitespace-pre-wrap text-muted-foreground">{i.body}</span></span></label>)}<label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />我已核对所选内容适用于目标任务的教学分工；只追加内容，周次与具体日期在原教学计划中安排。</label><p className="text-sm">目标已有 {existing?.items.length ?? 0} 项，本次追加 {newItems.length} 项。源内容更新不自动改动此班计划。</p><button disabled={!mt.ready || !task || !confirmed || !newItems.length} className="self-start rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={() => { if (!task || !confirmed || !newItems.length) return; write(task.id, [...(existing?.items || []), ...newItems.map(i => ({ id: prefix + i.id, title: i.title, points: [i.body], estimatedLessons: i.minutes === null || !doc.period ? null : i.minutes / doc.period, objectives: i.body, resources: `${doc.id}@${doc.version} / ${i.id}\n${doc.source}\n${i.source}`, notes: `教研内容快照；实际分钟 ${i.minutes ?? '未分配'}；相对周次备注 ${i.week || '未安排'}；${doc.notes}` }))], `从教研内容 ${doc.id}@${doc.version} 追加 ${newItems.length} 项`); setConfirmed(false) }}>确认追加到原教学计划</button>{task && <Link className="text-sm text-primary underline" href={`/teaching/task/${task.id}?tab=plan`}>查看原教学计划与保存状态 →</Link>}</section>
}
