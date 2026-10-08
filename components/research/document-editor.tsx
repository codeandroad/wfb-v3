"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { FieldGroup } from "@/components/ui/field"
import { useResearchContext } from "@/lib/research/context"
import { useResearchForm } from "@/lib/research/use-form"
import { canEditDocument, canReadDocument, emptyItem, itemReadable, selectItems, totals, type Document, type Item } from "@/lib/research/model"
import { parsePlanText } from "@/components/mt/plan-panel"
import { Panel, DocumentRead, DiscussionThread, RField } from "./primitives"
import { DocumentMetadata } from "./document-metadata"
import { ItemEditor } from "./item-editor"
import { PlanAllocation } from "./plan-allocation"
import { SourcePicker } from "./source-picker"

export function DocumentEditor({ document: saved,readonly = false,onCreated }: { document: Document; readonly?: boolean; onCreated: (id: string) => void }) {
  const { state,actor,command,period } = useResearchContext()
  const params = useSearchParams()
  const ui = useResearchForm(`editor:${saved.id}`,{ mode: "read",query: "",selected: [] as string[] })
  const [error,setError] = useState("")
  const [message,setMessage] = useState("")
  const draft = state.drafts[`${actor.staff}|${saved.id}`]
  const editable = !readonly && canEditDocument(state,actor,saved)
  const doc = editable && draft ? draft.document : saved
  const baseVersion = draft?.baseVersion ?? saved.version
  const selected = ui.value.selected
  function patch(values: Partial<Document>) {
    if (!editable) return false
    const result = command({ type: "draft-document",document: { ...doc,...values },baseVersion })
    setError(result.ok ? "" : result.error)
    return result.ok
  }
  function select(id: string,checked: boolean) { const range = selectItems(doc,[id]).map(i => i.id); ui.set({ selected: checked ? [...new Set([...selected,...range])] : selected.filter(x => !range.includes(x)) }) }
  function copy(kind?: Document["kind"],itemIds?: string[]) {
    const id = crypto.randomUUID()
    const result = command({ type: "copy-document",sourceId: saved.id,sourceVersion: saved.version,id,kind,itemIds,period })
    if (!result.ok) setError(result.error); else onCreated(id)
  }
  const viewingEdit = editable && ui.value.mode === "edit"
  const timeline = Object.values(state.revisions).filter(d => d.id === saved.id).sort((a,b) => b.version-a.version)
  return <Panel title={doc.title} description={`${doc.kind} · ${readonly ? "依据快照，只读" : editable ? "可共建修订" : "管理查看，只读"} · 保存版本 v${saved.version}${draft ? " · 有自动保存草稿" : ""}`} action={<Button variant="outline" disabled={!canReadDocument(state,actor,saved) || saved.restricted || saved.copyPolicy === "reference-only"} onClick={() => copy()}>复制为个人版</Button>}>
    <div className="flex flex-wrap items-center justify-between gap-3"><ToggleGroup aria-label="内容阅读编辑" variant="outline" value={[viewingEdit ? "edit" : "read"]} onValueChange={value => value[0] && ui.set({ mode: value[0] })}><ToggleGroupItem value="read">阅读与定位</ToggleGroupItem><ToggleGroupItem value="edit" disabled={!editable}>编辑草稿</ToggleGroupItem></ToggleGroup>{editable && <div className="flex flex-wrap gap-2"><Button disabled={!draft} onClick={() => { const result = command({ type: "save-document",document: doc,baseVersion }); if (!result.ok) setError(result.error); else { setError(""); setMessage("已保存新修订；已采用安排及成果快照保持原内容。") } }}>保存新修订</Button><Button variant="outline" disabled={!draft} onClick={() => { if (confirm("放弃本人的未完成草稿？已保存版本和他人内容不变。")) { const result = command({ type: "discard-draft",id: saved.id }); if (!result.ok) setError(result.error) } }}>放弃草稿</Button></div>}</div>
    <p className="text-muted-foreground">作者记录与组内归属分别保留。输入自动保存为本人草稿；明确保存才产生新修订，离开或切换页签不会修改已被采用的依据。</p>{draft && draft.baseVersion !== saved.version && <p role="alert" className="text-destructive">保存版本已更新至 v{saved.version}；你的草稿仍基于 v{draft.baseVersion}。请比较版本后整理为个人副本或重新编辑，不会覆盖他人修订。</p>}
    {params.get("item") && <p><a className="text-primary underline" href={`#item-${params.get("item")}`}>定位到所引用的章节／要求</a></p>}
    <FieldGroup><RField label="检索完整正文、Notes、译注与来源" value={ui.value.query} onChange={query => ui.set({ query })} /></FieldGroup>
    {viewingEdit ? <><DocumentMetadata document={doc} patch={patch} />{doc.kind === "计划" && <PlanAllocation document={doc} selected={selected} patch={patch} />}<ItemEditor document={doc} patch={patch} selected={selected} onSelect={select} onError={setError} /><details className="rounded-lg border p-4"><summary className="cursor-pointer font-semibold">从多个已有来源选取内容</summary><div className="pt-4"><SourcePicker course={doc.course} formKey={`append:${doc.id}`} onPick={items => patch({ items: [...doc.items,...items.map(i => doc.kind === "计划" ? { ...i,minutes: null,fixed: false,weeks: [] } : i)] })} /></div></details>
      <details><summary className="cursor-pointer text-primary">复用既有教学计划文本导入能力</summary><div className="flex flex-col gap-3 pt-3"><p>仅实际解析 TXT／JSON 结构，核对后追加为教学补充。不会解析 PDF，也不覆盖现有内容。</p><input type="file" accept=".txt,.md,.json" aria-label="导入可解析内容" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; try { const rows = parsePlanText(await file.text()); if (!rows.length) throw new Error("没有识别到内容。文本需以 # 标题开始；原文件未被宣称导入成功。"); patch({ items: [...doc.items,...rows.map(i => ({ ...emptyItem(crypto.randomUUID()),title: i.title,body: i.points.join("\n"),supplement: i.objectives,source: `手工导入 ${file.name}；来源待核对`,notes: [i.resources,i.notes].filter(Boolean).join("\n"),minutes: doc.kind === "计划" && i.estimatedLessons !== null && doc.period ? i.estimatedLessons*doc.period : null }))] }); setMessage(`已解析 ${rows.length} 条到草稿，请核对来源并保存。`) } catch(e) { setError(e instanceof Error ? e.message : "解析失败。") } }} /></div></details>
      <Button variant="outline" className="self-start" onClick={() => { if (confirm(doc.archived ? "恢复本内容到选用候选？" : "归档后不再作为新选用候选；历史引用与已采用安排保留。确认归档？")) patch({ archived: !doc.archived }) }}>{doc.archived ? "恢复内容" : "归档内容（保存后生效）"}</Button>
    </> : <><DocumentRead document={doc} query={ui.value.query} selected={selected} onSelect={readonly ? undefined : select} />{doc.kind === "计划" && <p>预算 {doc.budget === null ? "未设置" : `${doc.budget} 分钟`} · 已分配 {totals(doc).allocated} 分钟 · 机动 {doc.reserve} 分钟 · 余额 {totals(doc).remainder ?? "未设置"} · 换算每课时 {doc.period ?? "未设置"} 分钟</p>}{doc.kind === "计划" && doc.items.map(i => <p key={`time-${i.id}`} className="text-muted-foreground">{i.title}：{doc.items.some(child => child.parentId === i.id) ? "汇总父项，不重复计时" : i.minutes === null ? "未分配" : `${i.minutes} 分钟${i.fixed ? " · 固定" : ""}`} · {i.weeks.length ? i.weeks.map(w => `第${w.week}周 ${w.minutes} 分钟`).join("、") : "未安排到周"}</p>)}</>}
    {!readonly && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!selected.length || !!draft || saved.restricted || saved.copyPolicy === "reference-only"} onClick={() => copy("计划",selected)}>选中内容建立个人计划（{selected.length} 条）</Button><p className="self-center text-muted-foreground">选用保存版本；未保存草稿须先保存，不会悄悄采用编辑中内容。</p></div>}
    {timeline.length > 1 && <details><summary className="cursor-pointer text-primary">查看保存版本及当时依据</summary><div className="flex flex-wrap gap-2 pt-3">{timeline.map(d => { const q = new URLSearchParams(params); q.set("version",String(d.version)); return <a key={d.version} className="text-primary underline" href={`/research?${q}`}>v{d.version} · {d.sourceVersion || "自编修订"}</a> })}</div></details>}
    {error && <p role="alert" className="text-destructive">{error}</p>}{message && <p role="status">{message}</p>}{!readonly && <DiscussionThread target={`document:${saved.id}`} editable={canReadDocument(state,actor,saved) && (saved.owner === actor.staff || !saved.restricted)} />}
  </Panel>
}
