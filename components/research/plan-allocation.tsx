"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { allocationPreview, applyAllocation, totals, type AllocationMode, type AllocationPreview, type Document } from "@/lib/research/model"
import { useResearchContext } from "@/lib/research/context"
import { RField } from "./primitives"

export function PlanAllocation({ document: doc,selected,patch }: { document: Document; selected: string[]; patch: (values: Partial<Document>) => void }) {
  const { period: schoolPeriod } = useResearchContext()
  const [mode,setMode] = useState<AllocationMode>("balance")
  const [amount,setAmount] = useState("")
  const [preview,setPreview] = useState<AllocationPreview | null>(null)
  const [error,setError] = useState("")
  const [newPeriod,setNewPeriod] = useState("")
  const t = totals(doc)
  const show = (value: number | null) => value === null ? "未设置" : `${value} 分钟${doc.period ? `（${Number((value/doc.period).toFixed(3))} 课时）` : ""}`
  return <section className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4 text-sm">
    <h3 className="font-semibold">课时预算与分配</h3><p className="text-muted-foreground">学校现有课节设置：{schoolPeriod ? `每节 ${schoolPeriod} 分钟` : "各节时长不一致，请明确本计划换算单位"}。实际教学分钟是稳定依据，换算显示不会改动时长。</p>
    <FieldGroup className="grid sm:grid-cols-3"><RField label="总预算分钟（可空）" type="number" min={0} value={doc.budget ?? ""} onChange={value => patch({ budget: value === "" ? null : Number(value) })} /><RField label="机动分钟" type="number" min={0} value={doc.reserve} onChange={value => patch({ reserve: value === "" ? 0 : Number(value) })} /><RField label="每课时分钟（仅换算）" type="number" min={1} value={doc.period ?? ""} onChange={value => patch({ period: value === "" ? null : Number(value) })} /></FieldGroup>
    <dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-muted-foreground">总预算</dt><dd>{show(doc.budget)}</dd></div><div><dt className="text-muted-foreground">已分配教学时间（只计末级项目）</dt><dd>{show(t.allocated)}</dd></div><div><dt className="text-muted-foreground">机动时间</dt><dd>{show(doc.reserve)}</dd></div><div><dt className="text-muted-foreground">未分配余额</dt><dd className={t.remainder !== null && t.remainder < 0 ? "text-destructive" : "text-foreground"}>{t.remainder === null ? "预算未设置" : t.remainder < 0 ? `超额 ${-t.remainder} 分钟（负余额保留）` : show(t.remainder)}</dd></div></dl><p>尚未分配时长的末级项目：{t.unassignedItems}；明确 0 分钟不是未分配。</p>
    <ToggleGroup value={[mode]} onValueChange={values => { if (values[0]) { setMode(values[0] as AllocationMode); setPreview(null) } }} aria-label="辅助分配方式" variant="outline" className="flex-wrap"><ToggleGroupItem value="balance">均分余额</ToggleGroupItem><ToggleGroupItem value="same">设相同课时</ToggleGroupItem><ToggleGroupItem value="redistribute">重新均分所选</ToggleGroupItem><ToggleGroupItem value="reserve">机动转入</ToggleGroupItem></ToggleGroup>
    {mode !== "balance" && <FieldGroup><RField label={mode === "same" ? "每个所选非固定项目的分钟" : mode === "reserve" ? "从机动池转入的总分钟" : "重新分配所选项目的总分钟"} value={amount} type="number" min={0} onChange={value => { setAmount(value); setPreview(null) }} /></FieldGroup>}
    <p className="text-muted-foreground">仅作用于明确勾选的非固定末级项目；同一内容不重复计时。重新分配若小于已安排周分钟，将要求先调整周安排。</p><Button variant="outline" className="self-start" disabled={!selected.length} onClick={() => { try { if (mode !== "balance" && amount === "") throw new Error("请填写明确分钟，留空不会按 0 覆盖。"); setPreview(allocationPreview(doc,selected,mode,Number(amount))); setError("") } catch(e) { setError(e instanceof Error ? e.message : "无法分配。") } }}>预览所选范围与分配结果</Button>
    {preview && <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground"><p>{preview.description}</p>{preview.ids.map(id => <p key={id}>{doc.items.find(i => i.id === id)?.title}：{preview.before[id] ?? "未分配"} → {preview.after[id]} 分钟</p>)}<div className="flex gap-2"><Button onClick={() => { try { const next = applyAllocation(doc,preview); patch({ items: next.items,reserve: next.reserve }); setPreview(null); setError("") } catch(e) { setError(e instanceof Error ? e.message : "请重新预览。") } }}>确认此次分配</Button><Button variant="outline" onClick={() => setPreview(null)}>取消预览</Button></div></div>}
    <details><summary className="cursor-pointer text-primary">明确调整实际教学时间（不是仅换算）</summary><div className="flex flex-col gap-3 pt-3"><RField label="按新课时长度调整实际分钟" type="number" min={1} value={newPeriod} onChange={setNewPeriod} /><p className="text-muted-foreground">保留各项课时数，将总预算、机动、项目分钟和各周分钟按新旧长度比例调整。本操作会改变实际教学时长，包括已标记固定的项目；不会改变已采用班级或已记录课堂。</p><Button variant="outline" className="self-start" disabled={!doc.period || !Number(newPeriod) || Number(newPeriod) <= 0} onClick={() => { const next = Number(newPeriod); if (!doc.period || !Number.isFinite(next) || next <= 0 || !confirm(`明确将实际教学分钟按 ${doc.period} → ${next} 分钟／课时调整？不是只改显示，全部项目及预算和周安排会按比例调整。`)) return; const ratio = next/doc.period; patch({ period: next,budget: doc.budget === null ? null : Math.floor(doc.budget*ratio),reserve: Math.floor(doc.reserve*ratio),items: doc.items.map(i => ({ ...i,minutes: i.minutes === null ? null : Math.floor(i.minutes*ratio),weeks: i.weeks.map(w => ({ ...w,minutes: Math.floor(w.minutes*ratio) })) })) }); setPreview(null) }}>核对并调整实际分钟</Button></div></details>{error && <p role="alert" className="text-destructive">{error}</p>}
  </section>
}
