"use client"

import { useId, useState, type ReactNode } from "react"
import Link from "next/link"
import katex from "katex"
import "katex/dist/katex.min.css"
import { Card, CardHeader, EmptyState } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { useResearchContext } from "@/lib/research/context"
import { useResearchForm } from "@/lib/research/use-form"
import { canReadDocument, canUseAccess, canViewGroup, itemReadable, itemText, safeUrl, type Document, type Item, type SourceRef } from "@/lib/research/model"
import { BookOpen } from "lucide-react"

export const control = "min-h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
export function Panel({ title, description, action, children }: { title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode }) { return <Card><CardHeader title={title} desc={description} action={action} /><div className="flex min-w-0 flex-col gap-4 p-5 text-sm leading-relaxed">{children}</div></Card> }
export function RField({ label,value,onChange,type = "text",rows = 3,disabled,description,required,min }: { label: string; value: string | number; onChange: (value: string) => void; type?: "text" | "textarea" | "number" | "date" | "datetime-local"; rows?: number; disabled?: boolean; description?: string; required?: boolean; min?: number }) {
  const id = useId()
  return <Field data-disabled={disabled}><FieldLabel htmlFor={id}>{label}</FieldLabel>{type === "textarea" ? <textarea id={id} aria-label={label} className={control} rows={rows} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} /> : <input id={id} aria-label={label} className={control} type={type} min={min} disabled={disabled} required={required} value={value} onChange={e => onChange(e.target.value)} />} {description && <FieldDescription>{description}</FieldDescription>}</Field>
}
export function RSelect({ label,value,onChange,options,disabled,placeholder }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; disabled?: boolean; placeholder?: string }) {
  const id = useId()
  return <Field data-disabled={disabled}><FieldLabel htmlFor={id}>{label}</FieldLabel><select id={id} aria-label={label} className={control} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>{placeholder !== undefined && <option value="">{placeholder}</option>}{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
}
export function Choices({ label,options,value,onChange,disabled }: { label: string; options: { value: string; label: string; disabled?: boolean }[]; value: string[]; onChange: (value: string[]) => void; disabled?: boolean }) {
  return <FieldSet disabled={disabled}><FieldLegend variant="label">{label}</FieldLegend><FieldGroup className="flex flex-wrap gap-3">{options.map(o => <label key={o.value} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled || o.disabled} checked={value.includes(o.value)} onChange={e => onChange(e.target.checked ? [...value,o.value] : value.filter(v => v !== o.value))} />{o.label}</label>)}</FieldGroup>{!options.length && <p className="text-muted-foreground">没有可选内容。</p>}</FieldSet>
}
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\$\$[\s\S]*?\$\$)/g)
  return <div className="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed">{parts.map((part,index) => part.startsWith("$$") && part.endsWith("$$") ? <div key={index} className="overflow-x-auto py-2" role="math" aria-label={part.slice(2,-2)} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.slice(2,-2),{ displayMode: true,throwOnError: false,trust: false,strict: "warn",output: "htmlAndMathml" }) }} /> : <span key={index}>{part}</span>)}</div>
}
export function documentHref(doc: Document, self: string, canViewOwner: boolean, version?: number, item?: string) {
  const q = new URLSearchParams(doc.owner === self ? { space: "personal" } : canViewOwner ? { group: doc.owner } : { space: "shared" })
  q.set("tab","课程与内容"); q.set("doc",doc.id)
  if (version) q.set("version",String(version))
  if (item) q.set("item",item)
  return `/research?${q}`
}
export function SourceLinks({ references,owner }: { references: SourceRef[]; owner?: string }) {
  const { state,actor } = useResearchContext()
  return <div className="flex flex-col gap-1 text-sm text-muted-foreground">{references.map((ref,index) => {
    const source = state.documents.find(d => d.id === ref.documentId)
    const readable = source && canReadDocument(state,actor,source)
    return <p key={`${ref.documentId}:${ref.itemId}:${index}`}>{readable ? <Link className="text-primary underline underline-offset-4" href={documentHref(source,actor.staff,canViewGroup(state,actor,source.owner),ref.version,ref.itemId)}>{ref.title} v{ref.version} · {ref.locator || ref.itemId}</Link> : <span>来源当前不可访问{owner === actor.staff && ref.retainedBy === actor.staff && ref.retainText ? "；合法保存的教学正文仍保留" : "，未开放原组工作区"}</span>}{source && source.version !== ref.version && <span className="block">来源有新修订 v{source.version}；本次引用仍为 v{ref.version}，不会自动替换。</span>}</p>
  })}</div>
}
export function ItemRead({ item,owner,retainedSnapshot = false }: { item: Item; owner?: string; retainedSnapshot?: boolean }) {
  const { state,actor } = useResearchContext()
  if (!retainedSnapshot && !itemReadable(state,actor,item,owner)) return <p className="rounded-lg border border-dashed p-4 text-muted-foreground">引用内容受限或来源授权已结束。计划／组合的访问权不授予受限来源权限。</p>
  const answerDoc = item.answer ? state.documents.find(d => d.id === item.answer!.documentId) : null
  const answerItem = answerDoc?.items.find(i => i.id === item.answer?.itemId)
  const answerAllowed = answerDoc && answerItem && canReadDocument(state,actor,answerDoc) && itemReadable(state,actor,answerItem,answerDoc.owner)
  return <article id={`item-${item.id}`} className="flex scroll-mt-4 flex-col gap-3 rounded-lg border border-border p-4">
    <header className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-pretty font-semibold">{item.title}</h3><span className="text-muted-foreground">{item.origin}</span></header>
    <RichText text={itemText(item) || "尚未整理要求正文。"} />
    {(item.printedPage || item.filePage || item.question) && <p className="text-muted-foreground">印刷页 {item.printedPage || "未提供"} · 文件页 {item.filePage || "未提供"} · 题 {item.question || "未提供"}{item.subquestion}</p>}
    {item.source && <p className="text-muted-foreground">定位：{item.source}</p>}
    {item.maxScore !== null && <p>分值：{item.maxScore} 分 · {item.scoring || "未提供评分说明"}</p>}
    <SourceLinks references={item.references} owner={owner} />
    {item.answer && (answerAllowed ? <details><summary className="cursor-pointer text-primary">查看有权读取的答案／评分资料</summary><RichText text={itemText(answerItem!)} /><Link className="text-primary underline" href={documentHref(answerDoc!,actor.staff,canViewGroup(state,actor,answerDoc!.owner))}>打开答案原资料</Link></details> : <p className="text-muted-foreground">已关联答案，当前身份无答案授权；未提供正文或附件预览。</p>)}
  </article>
}
export function DocumentRead({ document: doc, query = "", selected = [], onSelect,submittedSnapshot = false }: { document: Document; query?: string; selected?: string[]; onSelect?: (id: string,checked: boolean) => void; submittedSnapshot?: boolean }) {
  const { state,actor,catalog } = useResearchContext()
  const course = catalog.courses.find(c => c.code === doc.course)
  return <div className="flex min-w-0 flex-col gap-5"><p className="text-muted-foreground">{course?.name || doc.course} · {course?.board} · {course?.officialCode} · {doc.language} · {doc.years || "适用年份未填写"} · {doc.sourceVersion || "来源版本未填写"}</p><p>教学范围：{doc.scope === "whole" ? "完整课程（不创建默认单元）" : doc.unitIds.map(id => catalog.units.find(u => u.code === id && u.courseCode === doc.course)?.name || id).join("、")}</p><RichText text={[doc.objectives && `课程目标：${doc.objectives}`,doc.prerequisites && `先修要求：${doc.prerequisites}`,doc.notes].filter(Boolean).join("\n\n")} /><p className="text-muted-foreground">来源：{doc.source || "未提供；不视为官方原文"}</p>{safeUrl(doc.source) && <a href={safeUrl(doc.source)!} target="_blank" rel="noopener noreferrer" className="self-start text-primary underline">打开来源链接</a>}
    {doc.kind === "资源" && <p className="text-muted-foreground">{[doc.resourceType,doc.edition,doc.publisher,doc.examYear,doc.session,doc.paperCode].filter(Boolean).join(" · ")}</p>}
    {doc.files.length === 0 ? <p className="text-muted-foreground">没有完整附件；当前为已整理正文、目录或引用信息，不提供虚构的全文预览。</p> : doc.files.map(file => canUseAccess(state,actor,doc.owner,file.access,!doc.restricted) ? <a key={file.id} href={file.data} download={file.name} className="self-start text-primary underline">下载来源附件：{file.name}（本机演示文件）</a> : <p key={file.id} className="text-muted-foreground">来源附件受独立授权限制。</p>)}
    {doc.items.filter(i => !query || `${i.title} ${itemText(i)} ${i.source}`.toLowerCase().includes(query.toLowerCase())).map(i => <div key={i.id} className="flex flex-col gap-2">{onSelect && itemReadable(state,actor,i,doc.owner) && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(i.id)} onChange={e => onSelect(i.id,e.target.checked)} />选择{i.title}{doc.items.some(x => x.parentId === i.id) ? "（含所属学习要求）" : ""}</label>}<ItemRead item={i} owner={doc.owner} retainedSnapshot={submittedSnapshot} /></div>)}
    {!doc.items.length && <EmptyState icon={<BookOpen className="size-6" />} title="尚未整理正文" desc="可从空白整理或手工关联来源；没有解析服务，不显示虚假的导入成功。" />}
    {doc.kind === "大纲" && <><Separator /><h3 className="font-semibold">大纲规定的考核结构</h3>{!doc.assessments.length && <p className="text-muted-foreground">尚未整理考核项目及组合；权重未知，不填写示例考试局规则补齐。</p>}{doc.assessments.map(a => <section key={a.id} className="flex flex-col gap-2 rounded-lg border p-4"><h4 className="font-semibold">{a.title}</h4><p>覆盖要求：{a.itemIds.map(id => doc.items.find(i => i.id === id)?.title || id).join("、") || "未提供"}</p><p>目录单元：{a.unitIds.map(id => catalog.units.find(u => u.code === id)?.name || id).join("、") || "未关联"}</p><RichText text={`条件：${a.conditions || "未提供"}\n量规：${a.rubric || "未提供"}\n依据：${a.source || "未提供"}`} /></section>)}{doc.paths.map(p => <section key={p.id} className="flex flex-col gap-2 rounded-lg border p-4"><h4 className="font-semibold">适用目标：{p.target}</h4><p>必选：{p.required.map(id => doc.assessments.find(a => a.id === id)?.title || id).join("、") || "未提供"}</p><p>选考：{p.optional.map(id => doc.assessments.find(a => a.id === id)?.title || id).join("、") || "未提供"} · 选取数量 {p.choose ?? "未提供"}</p><p>组合权重：{[...p.required,...p.optional].map(id => `${doc.assessments.find(a => a.id === id)?.title || id} ${p.weights[id] == null ? "未知" : `${p.weights[id]}%`}`).join("；")}</p><RichText text={`条件：${p.conditions}\n依据：${p.source || "未提供"}`} /></section>)}</>}
  </div>
}
export function DiscussionThread({ target,editable = true }: { target: string; editable?: boolean }) {
  const { state,actor,people,command } = useResearchContext()
  const draft = useResearchForm(`discussion:${target}`,{ text: "" })
  const [error,setError] = useState("")
  return <section className="flex flex-col gap-3"><Separator /><h3 className="font-semibold">事项讨论</h3><p className="text-muted-foreground">只对有权访问当前事项的人可见；不发送给无账号成员，不开放其他科组或学生记录。</p>{state.discussions.filter(d => d.target === target).map(d => <article className="rounded-lg bg-muted p-3 text-foreground" key={d.id}><p className="text-muted-foreground">{people.find(p => p.id === d.author)?.name || "原作者"} · {d.at}</p><RichText text={d.body} /></article>)}{editable && actor.enabled && <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); const result = command({ type: "discussion",discussion: { id: crypto.randomUUID(),target,author: actor.staff,body: draft.value.text.trim(),at: actor.date } }); if (!result.ok) setError(result.error); else { draft.reset(); setError("") } }}><FieldGroup><RField label="讨论内容" value={draft.value.text} onChange={text => draft.set({ text })} type="textarea" /></FieldGroup><Button type="submit" disabled={!draft.value.text.trim()} className="self-start">发表讨论</Button></form>}{error && <p role="alert" className="text-destructive">{error}</p>}</section>
}
