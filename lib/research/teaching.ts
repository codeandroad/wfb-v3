import { permittedTasks } from "@/lib/mt/derive"
import { dateOfClock, lessonsOfWeek, type PlanItem, type STask } from "@/lib/mt/model"
import type { MtBiz } from "@/lib/mt/store"
import { canReadDocument, itemReadable, itemText, leafItems, referenceFor, selectItems, taskCompatible, type Actor, type Document, type Item, type PreparedQuestion, type ResearchState } from "./model"

export function mapTeachingDates(items: Item[], task: STask, variant: MtBiz["variant"], firstWeek: number | null) {
  const pools = new Map<number,{ date: string; remaining: number }[]>()
  const result: Record<string,{ dates: { date: string; minutes: number }[]; unmapped: number | null }> = {}
  for (const item of items) {
    const dates: { date: string; minutes: number }[] = []
    for (const week of firstWeek === null ? [] : item.weeks) {
      const actualWeek = firstWeek! + week.week - 1
      if (!pools.has(actualWeek)) pools.set(actualWeek,lessonsOfWeek(variant,actualWeek,[task.id]).filter(l => l.actual_date >= task.valid_from && l.actual_date <= task.valid_through).sort((a,b) => a.startTs-b.startTs).map(l => ({ date: l.actual_date,remaining: Math.round((l.endTs-l.startTs)/60000) })))
      let rest = week.minutes
      for (const slot of pools.get(actualWeek)!) {
        const minutes = Math.min(rest,slot.remaining)
        if (minutes > 0) {
          const existing = dates.find(d => d.date === slot.date)
          if (existing) existing.minutes += minutes; else dates.push({ date: slot.date,minutes })
          slot.remaining -= minutes; rest -= minutes
        }
        if (rest === 0) break
      }
    }
    result[item.id] = { dates,unmapped: item.minutes === null ? null : item.minutes-dates.reduce((n,d) => n+d.minutes,0) }
  }
  return result
}
export function adoptedPlanItems(doc: Document, items: Item[], task: STask, actor: Actor, variant: MtBiz["variant"], firstWeek: number | null): PlanItem[] {
  const mapping = mapTeachingDates(items,task,variant,firstWeek)
  return items.map(i => ({ id: `research:${doc.id}:${i.id}`,title: i.title,points: [itemText(i)],estimatedLessons: i.minutes === null || !doc.period ? null : i.minutes/doc.period,objectives: doc.objectives,resources: `${doc.title} v${doc.version} / ${i.source || i.id}\n${doc.source}`,notes: `已采用教研正文快照；${doc.notes}`,researchSource: referenceFor(doc,i,actor),sourceReferences: structuredClone(i.references),relativeWeeks: structuredClone(i.weeks),plannedDates: mapping[i.id].dates,unmappedMinutes: mapping[i.id].unmapped,actualMinutes: i.minutes }))
}
export function adoptResearchPlan(biz: MtBiz, state: ResearchState, actor: Actor, teacherId: string | null, input: { documentId: string; version: number; itemIds: string[]; taskId: string; firstWeek: number | null; mode: "append" | "replace"; replaceIds: string[] }): MtBiz | { error: string } {
  const task = permittedTasks(biz,teacherId).find(t => t.id === input.taskId)
  const doc = state.documents.find(d => d.id === input.documentId)
  if (!actor.enabled || !task || actor.date < task.valid_from || actor.date > task.valid_through) return { error: "目标不是当前本人有效任教任务，不能采用。" }
  if (!doc || doc.kind !== "计划" || doc.version !== input.version || doc.archived || !canReadDocument(state,actor,doc) || doc.restricted || doc.copyPolicy !== "retain") return { error: "计划来源已变动或没有合法采用权，请重新核对。" }
  const selected = selectItems(doc,input.itemIds)
  const items = leafItems({ items: selected })
  if (!items.length || items.some(i => !itemReadable(state,actor,i,doc.owner)) || !taskCompatible(doc,task,items)) return { error: "所选课程、真实单元或来源权限不适用于该任教分工。" }
  if (input.firstWeek !== null && (!Number.isInteger(input.firstWeek) || input.firstWeek < 1)) return { error: "具体日期映射起始周须为学校正整数周，或暂不映射。" }
  const prev = biz.plans[task.id] ?? { taskId: task.id,state: "DRAFT" as const,items: [],history: [],revision: 0 }
  const sourceIds = new Set(items.map(i => i.id))
  const replaceable = prev.items.filter(i => i.researchSource?.documentId === doc.id && sourceIds.has(i.researchSource.itemId))
  if (input.replaceIds.some(id => !replaceable.some(i => i.id === id))) return { error: "替换范围包含未明确匹配的其他安排；范围外内容不能覆盖。" }
  const replacements = input.mode === "replace" ? new Set(input.replaceIds) : new Set<string>()
  const kept = prev.items.filter(i => !replacements.has(i.id))
  const proposed = adoptedPlanItems(doc,items,task,actor,biz.variant,input.firstWeek)
  const added = proposed.filter(i => !kept.some(p => p.researchSource?.documentId === i.researchSource?.documentId && p.researchSource?.itemId === i.researchSource?.itemId || p.id === i.id))
  if (!added.length) return { error: "所选内容已经采用。来源更新需明确选中旧安排并选择替换，不重复累计时长。" }
  const adoption = { id: `${task.id}:${doc.id}:v${doc.version}:${prev.revision+1}`,documentId: doc.id,version: doc.version,taskId: task.id,itemIds: items.map(i => i.id),adoptedAt: biz.clock,items: structuredClone(selected),unitIds: [...doc.unitIds] }
  return { ...biz,plans: { ...biz.plans,[task.id]: { ...prev,state: "ADOPTED",items: [...kept,...added],revision: prev.revision+1,history: [...prev.history,{ at: biz.clock,action: `明确采用 ${doc.title} v${doc.version}；新增 ${added.length} 项，替换 ${replacements.size} 个本来源安排；实际教学与反馈不变` }] } },researchAdoptions: [...(biz.researchAdoptions ?? []),adoption] }
}
export function questionsFromItems(items: Item[]): PreparedQuestion[] {
  return leafItems({ items }).map(i => {
    const source = i.references.at(-1)
    if (!source) throw new Error("题目没有稳定来源，不能作为引用资料交接。")
    return { id: `${source.documentId}:v${source.version}:${source.itemId}`,title: i.title,text: itemText({ ...i,stem: "" }),stem: i.stem,printedPage: i.printedPage,filePage: i.filePage,question: i.question,subquestion: i.subquestion,maxScore: i.maxScore,scoring: i.scoring,answer: i.answer,source: structuredClone(source),references: structuredClone(i.references.slice(0,-1)) }
  })
}
