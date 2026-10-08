"use client"

import { useState } from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { useMt } from "@/lib/mt/store"
import { permittedTasks, useTeacherId } from "@/lib/mt/derive"
import { formalTaskName } from "@/lib/mt/model"
import { useResearchContext } from "@/lib/research/context"
import { useResearchForm } from "@/lib/research/use-form"
import { getResearch } from "@/lib/research/store"
import { courseTaskMap, leafItems, taskCompatible, itemReadable, type Document } from "@/lib/research/model"
import { adoptResearchPlan, mapTeachingDates } from "@/lib/research/teaching"
import { Choices, ItemRead, Panel, RField, RSelect } from "./primitives"

export function PlanHandoff({ document: doc }: { document: Document }) {
  const mt = useMt()
  const teacher = useTeacherId()
  const { state, actor } = useResearchContext()
  const form = useResearchForm(`adopt:${doc.id}:v${doc.version}`, { target: "", selected: [] as string[], firstWeek: "", mode: "append", replaceIds: [] as string[], confirmed: false })
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const tasks = permittedTasks(mt.biz, teacher).filter(t => courseTaskMap[doc.course] === t.course_id && t.valid_from <= actor.date && t.valid_through >= actor.date)
  const task = tasks.find(t => t.id === form.value.target)
  const candidates = leafItems(doc).filter(i => itemReadable(state, actor, i, doc.owner) && (!task || taskCompatible(doc, task, [i])))
  const selected = candidates.filter(i => form.value.selected.includes(i.id))
  const existing = task ? mt.biz.plans[task.id] : undefined
  const replaceable = existing?.items.filter(i => i.researchSource?.documentId === doc.id && selected.some(s => s.id === i.researchSource?.itemId)) || []
  const mapping = task ? mapTeachingDates(selected, task, mt.biz.variant, form.value.firstWeek === "" ? null : Number(form.value.firstWeek)) : {}
  return <Panel title="用于本人合法任教任务" description={`采用 v${doc.version} 的保存正文；各班安排与实际教学分别保存。`}>
    <FieldGroup className="grid sm:grid-cols-2"><RSelect label="目标任教任务" value={form.value.target} onChange={target => form.set({ target, selected: [], replaceIds: [], confirmed: false })} placeholder="选择当前本人有效任教任务" options={tasks.map(t => ({ value: t.id, label: formalTaskName(t) }))} /><RField label="相对第 1 周映射到学校周次（可空）" type="number" min={1} value={form.value.firstWeek} onChange={firstWeek => form.set({ firstWeek, confirmed: false })} description="留空则只有内容与时长；明确映射后只使用目标任务的已应用课表，未映射部分仍保留。" /></FieldGroup>
    <Choices label="本次采用的适用内容" options={candidates.map(i => ({ value: i.id, label: i.title }))} value={form.value.selected} onChange={selected => form.set({ selected, replaceIds: [], confirmed: false })} />
    {selected.map(i => <div className="flex flex-col gap-2" key={i.id}><ItemRead item={i} owner={doc.owner} /><p className="text-muted-foreground">实际分钟 {i.minutes ?? "未分配"} · {mapping[i.id]?.dates.map(d => `${d.date} ${d.minutes} 分钟`).join("、") || "未映射具体课次"} · 保留未映射 {mapping[i.id]?.unmapped ?? i.minutes ?? "未分配"} 分钟</p></div>)}
    <p>目标已有 {existing?.items.length || 0} 项安排；其他来源与范围外内容全部保留。同来源同项目不重复累计时长。已确认教学事实和已发布反馈不受此操作影响。</p>
    {replaceable.length > 0 && <><RSelect label="处理本来源已有安排" value={form.value.mode} onChange={mode => form.set({ mode, confirmed: false })} options={[{ value: "append", label: "只追加尚未采用的内容，不替换" }, { value: "replace", label: "明确选择本来源旧安排后替换" }]} />{form.value.mode === "replace" && <Choices label="明确要替换的本来源安排" options={replaceable.map(i => ({ value: i.id, label: `${i.title} · 旧依据 v${i.researchSource?.version} → v${doc.version}` }))} value={form.value.replaceIds} onChange={replaceIds => form.set({ replaceIds, confirmed: false })} />}</>}
    <label className="flex items-start gap-2"><input type="checkbox" checked={form.value.confirmed} onChange={e => form.set({ confirmed: e.target.checked })} />我已阅读所选正文，核对课程、真实单元、来源版本、目标及替换范围；计划安排不等于实际已教或学生已掌握。</label>
    <Button className="self-start" disabled={!task || !form.value.confirmed || !selected.length || !!state.drafts[`${actor.staff}|${doc.id}`]} onClick={() => { const result = mt.command("明确采用教研计划", biz => adoptResearchPlan(biz, getResearch(), actor, teacher, { documentId: doc.id, version: doc.version, taskId: form.value.target, itemIds: selected.map(i => i.id), firstWeek: form.value.firstWeek === "" ? null : Number(form.value.firstWeek), mode: form.value.mode as "append" | "replace", replaceIds: form.value.replaceIds })); if (!result.ok) { setError(result.error); setMessage("") } else { setError(""); setMessage("已写入原任教任务的教学计划及独立采用记录；没有生成任何出勤、评价或教学完成事实。"); form.set({ confirmed: false }) } }}>确认采用到现有教学计划</Button>
    {task && <Link href={`/teaching/task/${task.id}?tab=plan`} className={buttonVariants({ variant: "outline" })}>打开此任务原有教学计划</Link>}
    {!tasks.length && <p className="text-muted-foreground">当前没有明确标识映射且本人有权任教的目标；不按同名课程猜测。独立备课仍可正常保存。</p>}{task && !candidates.length && <p className="text-muted-foreground">所选计划的真实单元不适用于本任教分工，不能跨同名 P1／S1 采用。</p>}{error && <p role="alert" className="text-destructive">{error}</p>}{message && <p role="status">{message}</p>}
  </Panel>
}
