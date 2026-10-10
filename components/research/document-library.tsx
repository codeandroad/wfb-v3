"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FieldGroup } from "@/components/ui/field"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useResearchContext } from "@/lib/research/context"
import { useResearchForm } from "@/lib/research/use-form"
import { canEditGroup, canReadDocument, coursesFor, emptyDocument, itemReadable, itemText, type Document } from "@/lib/research/model"
import { Panel, RField, RSelect } from "./primitives"

export function DocumentLibrary({ group, personal = false, shared = false, onOpen, onCreated }: { group?: string; personal?: boolean; shared?: boolean; onOpen: (id: string) => void; onCreated: (id: string) => void }) {
  const { state, actor, catalog, period, command } = useResearchContext()
  const scope = personal ? actor.staff : group || "shared"
  const form = useResearchForm(`library:${scope}`, { kind: "全部", course: "", query: "", title: "", createKind: "计划" as Document["kind"], createCourse: "", archived: false })
  const [error, setError] = useState("")
  const courses = group ? coursesFor(catalog, group) : catalog.courses
  const editable = actor.enabled && !shared && (personal || !!group && canEditGroup(state, actor, group))
  const docs = state.documents.filter(d => canReadDocument(state, actor, d) && (personal ? d.owner === actor.staff : shared ? d.share.audience !== "owner" && d.owner !== actor.staff : d.owner === group || d.share.audience !== "group" && d.share.audience !== "owner"))
  const filtered = docs.filter(d => (form.value.archived || !d.archived) && (form.value.kind === "全部" || d.kind === form.value.kind) && (!form.value.course || d.course === form.value.course) && (!form.value.query || [d.title, d.source, ...d.items.filter(i => itemReadable(state, actor, i, d.owner)).map(itemText)].join(" ").toLowerCase().includes(form.value.query.toLowerCase())))
  return <div className="flex min-w-0 flex-col gap-5">
    {!shared && <Panel title={personal ? "个人教学内容的课程关联" : "本组全部有效责任课程"} description={personal ? "可以跨过去研究过的课程长期保存；不因此获得其他组的访问权。" : "读取课程管理的同一份目录与明确责任映射，不按本人任课筛选。"}><div className="flex flex-wrap gap-2">{courses.map(c => <Button key={c.code} variant="outline" onClick={() => form.set({ course: form.value.course === c.code ? "" : c.code, createCourse: c.code })}>{c.name} · {c.officialCode}</Button>)}</div>{!courses.length && <p className="text-muted-foreground">本组没有已维护的有效责任课程，请由学校在课程管理中确认；不能通过新建大纲开设课程。</p>}</Panel>}
    {editable && <details className="rounded-xl border bg-card p-5 text-card-foreground"><summary className="cursor-pointer font-semibold">从空白建立大纲、计划或资料</summary><form className="flex flex-col gap-4 pt-4" onSubmit={e => { e.preventDefault(); const course = form.value.createCourse || courses[0]?.code; if (!course) return; const id = crypto.randomUUID(); const result = command({ type: "create-document", document: emptyDocument(id, form.value.createKind, form.value.title.trim(), scope, actor.staff, course, form.value.createKind === "计划" ? period : null, state.groups) }); if (!result.ok) setError(result.error); else { form.set({ title: "" }); setError(""); onCreated(id) } }}><FieldGroup className="grid sm:grid-cols-3"><RSelect label="新建内容类型" value={form.value.createKind} options={["大纲", "计划", "资源", "练习组合"].map(value => ({ value, label: value }))} onChange={createKind => form.set({ createKind: createKind as Document["kind"] })} /><RSelect label="关联课程（真实标识）" value={form.value.createCourse || courses[0]?.code || ""} options={courses.map(c => ({ value: c.code, label: `${c.name} · ${c.board} · ${c.officialCode} (${c.code})` }))} onChange={createCourse => form.set({ createCourse })} /><RField label="新建内容名称" value={form.value.title} onChange={title => form.set({ title })} required /></FieldGroup><p className="text-sm text-muted-foreground">独立备课不要求班级、学期日期或课表。创建内容不会新增正式课程，也不会创建虚构默认单元。</p><Button type="submit" className="self-start" disabled={!form.value.title.trim() || !courses.length}>创建并整理内容</Button>{error && <p role="alert" className="text-destructive">{error}</p>}</form></details>}
    <Panel title={shared ? "当前有权使用的共享资料" : personal ? "长期保留的个人资料" : "课程内容与可用共享资料"} description="同一资料对象从科组、计划、教学和作业选用；归属及来源不会因分享改变。">
      <div className="overflow-x-auto"><ToggleGroup aria-label="资料类型筛选" variant="outline" value={[form.value.kind]} onValueChange={value => value[0] && form.set({ kind: value[0] })}>{["全部", "大纲", "计划", "资源", "练习组合"].map(value => <ToggleGroupItem key={value} value={value}>{value}</ToggleGroupItem>)}</ToggleGroup></div>
      <FieldGroup className="grid sm:grid-cols-2"><RField label="检索名称、正文与来源" value={form.value.query} onChange={query => form.set({ query })} /><RSelect label="按课程筛选" value={form.value.course} placeholder="全部有权课程" options={[...new Set(docs.map(d => d.course))].map(code => { const c = catalog.courses.find(c => c.code === code); return { value: code, label: `${c?.name || code} · ${c?.board || ""} (${code})` } })} onChange={course => form.set({ course })} /></FieldGroup>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.value.archived} onChange={e => form.set({ archived: e.target.checked })} />包含归档资料（历史引用保留，不作为新选用候选）</label>
      <div className="grid gap-3 md:grid-cols-2">{filtered.map(d => <button key={d.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onOpen(d.id)}><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{d.kind}</Badge><Badge variant="secondary">v{d.version}</Badge>{d.archived && <Badge variant="outline">已归档</Badge>}{d.restricted && <Badge variant="outline">独立受限授权</Badge>}</div><h3 className="text-pretty font-semibold">{d.title}</h3><p className="text-muted-foreground">{catalog.courses.find(c => c.code === d.course)?.name || d.course} · {d.scope === "whole" ? "完整课程" : d.unitIds.join("、")}</p><p className="text-muted-foreground">归属：{state.groups.find(g => g.id === d.owner)?.name || (d.owner === actor.staff ? "本人" : "个人共享")} · {d.sourceVersion || d.edition || "来源版本未填写"}</p><p className="text-primary">阅读完整内容、定位与选用</p></button>)}</div>
      {!filtered.length && <Empty><EmptyHeader><EmptyTitle>暂无符合条件的可用内容</EmptyTitle><EmptyDescription>当前只检索有权读取的正文。可清除筛选、建立空白内容或继续原有手工教学及作业流程。</EmptyDescription></EmptyHeader></Empty>}
    </Panel>
  </div>
}
