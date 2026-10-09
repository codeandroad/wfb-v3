"use client"

import { useState } from "react"
import Link from "next/link"
import { AssignForm } from "@/components/mt/homework"
import { Button, buttonVariants } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { useMt } from "@/lib/mt/store"
import { permittedTasks, useTeacherId } from "@/lib/mt/derive"
import { formalTaskName } from "@/lib/mt/model"
import { useResearchContext } from "@/lib/research/context"
import { useResearchForm } from "@/lib/research/use-form"
import { getResearch } from "@/lib/research/store"
import { canRetainItem, courseTaskMap, leafItems, taskCompatible, type Document } from "@/lib/research/model"
import { homeworkQuestionInstructions, prepareHomeworkQuestions } from "@/lib/research/homework"
import { isTeachingActor } from "@/lib/research/teaching"
import { Choices, ItemRead, Panel, RSelect } from "./primitives"

export function HomeworkHandoff({ document: doc }: { document: Document }) {
  const mt = useMt()
  const teacher = useTeacherId()
  const { state, actor } = useResearchContext()
  const form = useResearchForm(`homework-handoff:${doc.id}:v${doc.version}`, { target: "", selected: [] as string[], confirmed: false, result: "" })
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const tasks = permittedTasks(mt.biz, teacher).filter(t => isTeachingActor(actor, teacher) && courseTaskMap[doc.course] === t.course_id && t.valid_from <= actor.date && t.valid_through >= actor.date)
  const task = tasks.find(t => t.id === form.value.target)
  const candidates = leafItems(doc).filter(item => canRetainItem(state, actor, item, doc.owner) && (!task || taskCompatible(doc, task, [item])))
  const selected = candidates.filter(item => form.value.selected.includes(item.id))
  const draftExists = task && !!mt.biz.hwDrafts?.[`${teacher}|${task.id}|NEW`]
  let prepared: ReturnType<typeof prepareHomeworkQuestions> = []
  if (task && selected.length) {
    try { prepared = prepareHomeworkQuestions(state, actor, doc.id, doc.version, selected.map(i => i.id), task) } catch { prepared = [] }
  }
  function begin() {
    if (!task || !form.value.confirmed) return
    try { prepareHomeworkQuestions(getResearch(), actor, doc.id, doc.version, selected.map(i => i.id), task); setError(""); setOpen(true) } catch (error) { setError(error instanceof Error ? error.message : "选用失败，已保留当前选择。") }
  }
  return <Panel title="选用练习 · 交给原作业流程" description="结构化保留每题页码、题号、小题、共同题干、分值及评分说明，不另建作业系统。">
    <FieldGroup><RSelect label="作业目标任教任务" value={form.value.target} options={tasks.map(t => ({ value: t.id, label: formalTaskName(t) }))} placeholder="选择当前本人有权任教的适用任务" onChange={target => { form.set({ target, selected: [], confirmed: false }); setOpen(false) }} /></FieldGroup>
    <Choices label="本次选用的题目／小题" options={candidates.map(item => ({ value: item.id, label: `${item.title} · 印刷页 ${item.printedPage || "未提供"} / 文件页 ${item.filePage || "未提供"}` }))} value={form.value.selected} onChange={selected => { form.set({ selected, confirmed: false }); setOpen(false) }} />
    {selected.map(item => <ItemRead key={item.id} item={item} owner={doc.owner} />)}
    <p className="text-muted-foreground">正文和共同题干进入学生作业要求；教师答案不带入要求，仍按独立授权读取。原流程继续确定名单快照、选做、截止、评价方案和锁定规则。</p>
    {draftExists && <p role="note">目标已有未布置草稿，将优先恢复。此次选题不会覆盖草稿；原表单提供明确追加选题的操作。</p>}
    <label className="flex items-start gap-2"><input type="checkbox" checked={form.value.confirmed} onChange={e => form.set({ confirmed: e.target.checked })} />我已核对所选正文、来源版本、课程与真实单元；本次选题不带入答案，不生成任何提交或成绩。</label>
    <Button className="self-start" disabled={!task || !prepared.length || !form.value.confirmed || !!state.drafts[`${actor.staff}|${doc.id}`]} onClick={begin}>核对选题并打开原作业表单</Button>
    {open && task && prepared.length > 0 && <AssignForm key={`${task.id}:${doc.id}:v${doc.version}`} task={task} preparedContent={{ title: doc.title, instructions: homeworkQuestionInstructions(prepared), questionSources: prepared }} onDone={id => { setOpen(false); if (id) form.set({ result: id, confirmed: false }) }} />}
    {form.value.result && <Link className={buttonVariants({ variant: "outline" })} href={`/homework?hw=${encodeURIComponent(form.value.result)}`}>查看原流程已布置的作业</Link>}
    {!tasks.length && <p className="text-muted-foreground">当前没有标识明确且本人有权任教的适用目标；不按同名课程猜测。资料仍可独立准备。</p>}
    {task && !candidates.length && <p className="text-muted-foreground">资料的真实单元或保留策略不适用于所选任教分工。不同课程的同名 P1／S1 不会串用。</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </Panel>
}
