"use client"
import { useState } from "react"
import Link from "next/link"
import { AssignForm } from "@/components/mt/homework"
import { useMt } from "@/lib/mt/store"
import { permittedTasks, useTeacherId } from "@/lib/mt/derive"
import { formalTaskName } from "@/lib/mt/model"
import type { Document } from "@/lib/research/store"

export function HomeworkHandoff({ document }: { document: Document }) {
  const mt = useMt()
  const teacher = useTeacherId()
  const tasks = permittedTasks(mt.biz, teacher)
  const [target, setTarget] = useState("")
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const task = tasks.find(t => t.id === target)
  return <section className="flex flex-col gap-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">选用资料布置作业</h2><p className="text-sm text-muted-foreground">保留来源与正文，进入原作业表单确认名单、截止与评价方案。已有草稿优先，不被自动覆盖；如已有草稿，请核对后手工补入本次资料。课程适用范围请教师确认，目录与任教任务跨模型映射尚未自动校验。</p><select aria-label="目标任教任务" className="rounded-lg border bg-background p-2 text-sm" value={target} onChange={e => { setTarget(e.target.value); setOpen(false) }}><option value="">选择本人有权任教任务</option>{tasks.map(t => <option value={t.id} key={t.id}>{formalTaskName(t)}</option>)}</select><button className="self-start rounded-lg border px-3 py-2 text-sm" disabled={!task} onClick={() => setOpen(true)}>核对内容并打开原作业表单</button>{open && task && <AssignForm key={`${task.id}:${document.id}`} task={task} preparedContent={{ title: document.title, instructions: [`教研资料：${document.id}@${document.version}`, document.source, ...document.items.map(i => `${i.title}\n${i.body}\n来源：${i.source}`)].join('\n\n') }} onDone={id => { setOpen(false); setResult(id) }} />}{result && <Link className="text-sm text-primary underline" href={`/homework?hw=${encodeURIComponent(result)}`}>查看已布置作业 →</Link>}</section>
}
