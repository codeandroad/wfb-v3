"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { useResearchContext } from "@/lib/research/context"
import { useResearchForm } from "@/lib/research/use-form"
import { getResearch } from "@/lib/research/store"
import { canReadDocument, canRetainItem, itemReadable, itemText, referenceFor, selectItems, type Document, type Item } from "@/lib/research/model"
import { Choices, ItemRead, RField, RSelect } from "./primitives"

export function SourcePicker({ course,formKey,kinds = ["大纲","计划","资源","练习组合"],onPick,label = "选取内容并保留来源",allowRestricted = false }: { course?: string; formKey: string; kinds?: Document["kind"][]; onPick: (items: Item[]) => boolean | void; label?: string; allowRestricted?: boolean }) {
  const { state,actor,catalog } = useResearchContext()
  const draft = useResearchForm(`picker:${formKey}`,{ document: "",query: "",selected: {} as Record<string,string[]>,versions: {} as Record<string,number> })
  const [error,setError] = useState("")
  const candidates = state.documents.filter(d => !d.archived && (!course || d.course === course) && kinds.includes(d.kind) && canReadDocument(state,actor,d) && (allowRestricted || !d.restricted && d.copyPolicy === "retain"))
  const doc = candidates.find(d => d.id === draft.value.document)
  const selected = doc ? draft.value.selected[doc.id] ?? [] : []
  const total = Object.values(draft.value.selected).reduce((n,ids) => n+ids.length,0)
  const select = (id: string,checked: boolean) => { if (doc) { const range = selectItems(doc,[id]).filter(i => itemReadable(state,actor,i,doc.owner)).map(i => i.id); draft.set({ versions: { ...draft.value.versions,[doc.id]: doc.version },selected: { ...draft.value.selected,[doc.id]: checked ? [...new Set([...selected,...range])] : selected.filter(value => !range.includes(value)) } }) } }
  function confirm() {
    try {
      const live = getResearch()
      const items: Item[] = []
      for (const [id,ids] of Object.entries(draft.value.selected)) {
        if (!ids.length) continue
        const source = live.documents.find(d => d.id === id)
        if (!source || !canReadDocument(live,actor,source) || source.archived || course && source.course !== course || !allowRestricted && source.restricted) throw new Error("来源权限、课程或状态已变化，请重新选择。")
        if (source.version !== draft.value.versions?.[id]) throw new Error("来源版次已更新或旧选择未记录版次，请重新阅读并选择；不会静默替换原依据。")
        const content = source.items.filter(i => ids.includes(i.id))
        if (content.length !== ids.length || content.some(i => allowRestricted ? !itemReadable(live,actor,i,source.owner) : !canRetainItem(live,actor,i,source.owner))) throw new Error("选用内容已变动或受到来源限制。")
        const idsMap = Object.fromEntries(content.map(i => [i.id,crypto.randomUUID()]))
        for (const item of content) items.push({ ...structuredClone(item),id: idsMap[item.id],parentId: item.parentId && idsMap[item.parentId] || null,references: [...item.references.map(ref => ({ ...ref,retainedBy: actor.staff })),referenceFor(source,item,actor)] })
      }
      if (!items.length) throw new Error("请至少选择一条内容。")
      if (onPick(items) !== false) { draft.set({ selected: {} }); setError("") }
    } catch(e) { setError(e instanceof Error ? e.message : "选用失败。") }
  }
  return <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4 text-sm">
    <p className="text-muted-foreground">可从多份有权访问的来源选择整份、章节或具体条目；每项保留内容、版次与定位。不会把答案附件复制进组合。</p>
    <FieldGroup className="grid sm:grid-cols-2"><RSelect label="内容来源" value={draft.value.document} onChange={document => draft.set({ document })} placeholder="选择资料／大纲／计划" options={candidates.map(d => ({ value: d.id,label: `${d.kind} · ${d.title} v${d.version} · ${catalog.courses.find(c => c.code === d.course)?.name || d.course}` }))} /><RField label="检索来源正文" value={draft.value.query} onChange={query => draft.set({ query })} /></FieldGroup>
    {doc && <><label className="flex items-center gap-2"><input type="checkbox" checked={doc.items.length > 0 && doc.items.every(i => selected.includes(i.id))} onChange={e => draft.set({ versions: { ...draft.value.versions,[doc.id]: doc.version },selected: { ...draft.value.selected,[doc.id]: e.target.checked ? doc.items.filter(i => itemReadable(state,actor,i,doc.owner)).map(i => i.id) : [] } })} />选择整份已整理内容（v{doc.version}）</label><p className="text-muted-foreground">{doc.source || "来源尚未填写"} · {doc.edition || doc.sourceVersion || "版次未提供"}{doc.files.length === 0 ? " · 无全文附件" : " · 附件按独立授权读取"}</p><div className="flex max-h-96 flex-col gap-3 overflow-y-auto">{doc.items.filter(i => itemReadable(state,actor,i,doc.owner) && (!draft.value.query || `${i.title} ${itemText(i)}`.includes(draft.value.query))).map(i => <div key={i.id} className="flex flex-col gap-2"><label className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(i.id)} onChange={e => select(i.id,e.target.checked)} />{i.title}{doc.items.some(child => child.parentId === i.id) ? "（章节及所属要求）" : ""}</label><details><summary className="cursor-pointer text-primary">阅读正文及来源定位</summary><ItemRead item={i} owner={doc.owner} /></details></div>)}{!doc.items.length && <p>该资料只有来源信息，尚无可选正文；可先手工整理。</p>}</div></>}
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" onClick={confirm} disabled={!total}>{label}（{total} 条）</Button><Button variant="ghost" disabled={!total} onClick={() => draft.set({ selected: {} })}>清除本次选择</Button></div>{error && <p role="alert" className="text-destructive">{error}</p>}
    {!candidates.length && <p className="text-muted-foreground">没有符合当前课程与授权的来源。仍可以手工整理或按原教学、作业流程操作。</p>}
  </div>
}
