"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { permittedTasks, useTeacherId } from "@/lib/mt/derive"
import type { STask } from "@/lib/mt/model"
import { useMt } from "@/lib/mt/store"
import { useResearchContext } from "@/lib/research/context"
import { useResearchForm } from "@/lib/research/use-form"
import { getResearch } from "@/lib/research/store"
import { canReadDocument, canRetainItem, itemText, leafItems, taskCompatible } from "@/lib/research/model"
import { confirmTeachingContent, isTeachingActor } from "@/lib/research/teaching"
import { ItemRead, RField, RSelect, RichText, SourceLinks } from "./primitives"

export function TeachingContentPicker({ task, date }: { task: STask; date: string }) {
  const mt = useMt()
  const teacher = useTeacherId()
  const { state, actor } = useResearchContext()
  const form = useResearchForm(`actual-teaching:${task.id}:${date}`, { kind: "plan", planItemId: "", documentId: "", version: 0, itemId: "", title: "", text: "", confirmed: false, editingId: "", baseRevision: 0 })
  const [error, setError] = useState("")
  const legal = isTeachingActor(actor, teacher) && permittedTasks(mt.biz, teacher).some(t => t.id === task.id)
  const documents = state.documents.filter(d => !d.archived && !d.restricted && d.copyPolicy === "retain" && canReadDocument(state, actor, d) && leafItems(d).some(i => taskCompatible(d, task, [i]) && canRetainItem(state, actor, i, d.owner)))
  const document = documents.find(d => d.id === form.value.documentId)
  const items = document ? leafItems(document).filter(i => taskCompatible(document, task, [i]) && canRetainItem(state, actor, i, document.owner)) : []
  const item = items.find(i => i.id === form.value.itemId)
  const planItems = mt.biz.plans[task.id]?.items ?? []
  const recorded = mt.biz.teachingContent?.[`${task.id}|${date}`] ?? []
  if (!legal) return null
  function confirm() {
    const f = form.value
    const result = mt.command("明确确认本日实际教学", biz => confirmTeachingContent(biz, getResearch(), actor, teacher, { id: crypto.randomUUID(), taskId: task.id, date, title: f.title, text: f.text, confirmed: f.confirmed, ...(f.editingId ? { editingId: f.editingId, baseRevision: f.baseRevision } : f.kind === "plan" ? { planItemId: f.planItemId } : f.kind === "document" ? { documentId: f.documentId, version: f.version, itemId: f.itemId } : {}) }))
    if (!result.ok) setError(result.error)
    else { form.reset(); setError("") }
  }
  return <section className="flex min-w-0 flex-col gap-3 rounded-lg border p-4" aria-label="本日实际教学内容">
    <h3 className="text-sm font-semibold">实际教了什么 · 内容与来源</h3>
    <p className="text-sm text-muted-foreground">计划安排不是已教事实。教师明确确认后，只保存在本任务本日，供周简介候选引用；不生成出勤、学生评价或掌握程度，不覆盖本日小结和周反馈草稿。</p>
    {recorded.map(content => <article key={content.id} className="flex flex-col gap-3 rounded-lg bg-muted p-3 text-foreground"><h4 className="text-sm font-semibold">{content.title} · 本人已确认</h4><RichText text={content.text} /><SourceLinks owner={actor.staff} references={[...(content.source ? [content.source] : []), ...content.references]} /><Button variant="outline" className="self-start" onClick={() => form.set({ editingId: content.id, baseRevision: content.revision ?? 1, title: content.title, text: content.text, confirmed: false })}>核对并修改此条实际内容</Button></article>)}
    <details open={!!form.value.editingId || !!form.value.text}>
      <summary className="cursor-pointer text-sm text-primary">{form.value.editingId ? "修改本日已确认内容" : "选用大纲、教材或采用安排，也可手工确认"}</summary>
      <div className="flex flex-col gap-4 pt-4">
        {!form.value.editingId && <><FieldGroup><RSelect label="实际内容来源方式" value={form.value.kind} options={[{ value: "plan", label: "本人任务的已采用安排" }, { value: "document", label: "有权使用的大纲、教材或计划" }, { value: "manual", label: "手工确认，不需要准备资料" }]} onChange={kind => form.set({ kind, planItemId: "", documentId: "", itemId: "", title: "", text: "", confirmed: false })} /></FieldGroup>
          {form.value.kind === "plan" && <FieldGroup><RSelect label="选用本任务已有教学项目" value={form.value.planItemId} placeholder="选择项目，核对后仍可修改本次实际正文" options={planItems.map(i => ({ value: i.id, label: `${i.title}${i.researchSource ? ` · 采用 v${i.researchSource.version}` : " · 原有手工计划"}` }))} onChange={planItemId => { const chosen = planItems.find(i => i.id === planItemId); form.set({ planItemId, title: chosen?.title || "", text: chosen?.points.join("\n") || "", confirmed: false }) }} /></FieldGroup>}
          {form.value.kind === "document" && <FieldGroup className="grid sm:grid-cols-2"><RSelect label="实际教学来源资料" value={form.value.documentId} placeholder="仅列课程、单元与授权适用的资料" options={documents.map(d => ({ value: d.id, label: `${d.kind} · ${d.title} v${d.version}` }))} onChange={documentId => form.set({ documentId, itemId: "", title: "", text: "", confirmed: false })} /><RSelect label="实际教学要求／项目" value={form.value.itemId} placeholder="选择具体内容，保留来源与范围" options={items.map(i => ({ value: i.id, label: i.title }))} onChange={itemId => { const selected = items.find(i => i.id === itemId); form.set({ itemId, version: document?.version || 0, title: selected?.title || "", text: selected ? itemText(selected) : "", confirmed: false }) }} /></FieldGroup>}
          {item && document && <ItemRead item={item} owner={document.owner} />}
        </>}
        <FieldGroup><RField label="本次实际教学标题" value={form.value.title} onChange={title => form.set({ title, confirmed: false })} /><RField label="核对并调整本次实际教学正文" type="textarea" rows={5} value={form.value.text} onChange={text => form.set({ text, confirmed: false })} description="可以删改为实际讲授、复习或训练范围；没有资料也可直接手工填写。" /></FieldGroup>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.value.confirmed} onChange={e => form.set({ confirmed: e.target.checked })} />我确认这是本日已发生课堂实际讲授的内容，已核对并调整正文；不代表每位学生已经掌握。</label>
        <div className="flex flex-wrap gap-2"><Button disabled={!form.value.confirmed || !form.value.title.trim() || !form.value.text.trim() || !form.value.editingId && (form.value.kind === "plan" && !form.value.planItemId || form.value.kind === "document" && !item)} onClick={confirm}>确认保存本日实际教学内容</Button><Button variant="outline" onClick={() => form.reset()}>取消本次选用／修改</Button></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </details>
    {!recorded.length && <p className="text-sm text-muted-foreground">尚未确认资料内容。仍可直接填写原本日小结、出勤与评价，无需先完成计划或教研任务。</p>}
  </section>
}
