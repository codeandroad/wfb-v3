import { permittedTasks } from "@/lib/mt/derive"
import { PERSONAS } from "@/lib/demo/nav"
import { dateOfClock, lessonsOfWeek, teacherOfPersona, weekOfDate, type PlanItem, type STask } from "@/lib/mt/model"
import type { MtBiz } from "@/lib/mt/store"
import { canReadDocument, canRetainItem, itemText, leafItems, referenceFor, referenceReadable, selectItems, taskCompatible, type Actor, type Document, type Item, type PreparedQuestion, type ResearchState, type TeachingContent } from "./model"

export function isTeachingActor(actor: Actor, teacherId: string | null) {
  const persona = Object.entries(PERSONAS).find(([,value]) => value.staffId === actor.staff)?.[0]
  return actor.enabled && !!teacherId && !!persona && teacherOfPersona(persona) === teacherId
}

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
  return items.map(i => ({ id: `research:${doc.id}:${i.id}`,title: i.title,points: [itemText(i)],estimatedLessons: i.minutes === null || !doc.period ? null : i.minutes/doc.period,objectives: doc.objectives,resources: `${doc.title} v${doc.version} / ${i.source || i.id}\n${doc.source}`,notes: `已采用教研正文快照；${doc.notes}`,researchSource: referenceFor(doc,i,actor),sourceReferences: i.references.map(ref => ({ ...structuredClone(ref),retainedBy: actor.staff })),relativeWeeks: structuredClone(i.weeks),plannedDates: mapping[i.id].dates,unmappedMinutes: mapping[i.id].unmapped,actualMinutes: i.minutes }))
}
export function adoptResearchPlan(biz: MtBiz, state: ResearchState, actor: Actor, teacherId: string | null, input: { documentId: string; version: number; itemIds: string[]; taskId: string; firstWeek: number | null; mode: "append" | "replace"; replaceIds: string[] }): MtBiz | { error: string } {
  const task = permittedTasks(biz,teacherId).find(t => t.id === input.taskId)
  const doc = state.documents.find(d => d.id === input.documentId)
  if (!isTeachingActor(actor,teacherId) || !task || actor.date < task.valid_from || actor.date > task.valid_through) return { error: "目标不是当前本人有效任教任务，不能采用。" }
  if (!doc || doc.kind !== "计划" || doc.version !== input.version || doc.archived || !canReadDocument(state,actor,doc) || doc.restricted || doc.copyPolicy !== "retain") return { error: "计划来源已变动或没有合法采用权，请重新核对。" }
  const selected = selectItems(doc,input.itemIds)
  const items = leafItems({ items: selected })
  if (!items.length || items.some(i => !canRetainItem(state,actor,i,doc.owner)) || !taskCompatible(doc,task,items)) return { error: "所选课程、真实单元或来源权限不适用于该任教分工。" }
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
export type TeachingSelection = { id: string; taskId: string; date: string; title: string; text: string; documentId?: string; version?: number; itemId?: string; planItemId?: string; editingId?: string; baseRevision?: number; confirmed: boolean }
export function confirmTeachingContent(biz: MtBiz, state: ResearchState, actor: Actor, teacherId: string | null, input: TeachingSelection): MtBiz | { error: string } {
  const task = permittedTasks(biz,teacherId).find(t => t.id === input.taskId)
  if (!isTeachingActor(actor,teacherId) || !task || !input.confirmed) return { error: "请明确核对本人有权任教的任务及本次实际教学。" }
  if (input.date < task.valid_from || input.date > task.valid_through || !lessonsOfWeek(biz.variant,weekOfDate(input.date),[task.id]).some(l => l.actual_date === input.date && l.endTs <= Date.parse(biz.clock))) return { error: "该日期没有本人已发生的真实课次，不能把备课或试讲记为已教事实。" }
  if (!input.title.trim() || !input.text.trim() || input.text.length > 12000) return { error: "请核对实际教学标题与 1–12000 字正文；可以修改，不推定学生掌握。" }
  const key = `${task.id}|${input.date}`
  const existing = biz.teachingContent?.[key] ?? []
  let content: TeachingContent
  if (input.editingId) {
    const previous = existing.find(item => item.id === input.editingId && item.confirmedBy === actor.staff)
    if (!previous || (previous.revision ?? 1) !== input.baseRevision) return { error: "实际内容已由其他操作更新，请重新核对；当前编辑保留。" }
    content = { ...previous,title: input.title.trim(),text: input.text.trim(),at: biz.clock,revision: (previous.revision ?? 1)+1 }
  } else {
    let source: TeachingContent["source"] = null
    let references: TeachingContent["references"] = []
    if (input.planItemId) {
      const item = biz.plans[task.id]?.items.find(i => i.id === input.planItemId)
      if (!item || item.researchSource && !referenceReadable(state,actor,item.researchSource,actor.staff) || item?.sourceReferences?.some(ref => !referenceReadable(state,actor,ref,actor.staff))) return { error: "所选采用安排或来源权限不可用，请重新核对。" }
      source = item.researchSource ? structuredClone(item.researchSource) : null
      references = structuredClone(item.sourceReferences ?? [])
    } else if (input.documentId) {
      const document = state.documents.find(d => d.id === input.documentId)
      const item = document?.items.find(i => i.id === input.itemId)
      if (!document || document.archived || document.version !== input.version || document.restricted || document.copyPolicy !== "retain" || !item || !canReadDocument(state,actor,document) || !canRetainItem(state,actor,item,document.owner) || !taskCompatible(document,task,[item])) return { error: "所选正文的课程、真实单元、版本或保留权限已变化，请重新选取。" }
      source = referenceFor(document,item,actor)
      references = item.references.map(ref => ({ ...structuredClone(ref),retainedBy: actor.staff }))
    }
    if (existing.some(item => item.id === input.id || input.planItemId && item.planItemId === input.planItemId || source && item.source?.documentId === source.documentId && item.source.itemId === source.itemId || !source && !input.planItemId && item.title === input.title.trim() && item.text === input.text.trim())) return { error: "该内容已在本日确认；请编辑原记录，不重复添加。" }
    content = { id: input.id,title: input.title.trim(),text: input.text.trim(),source,references,at: biz.clock,confirmedBy: actor.staff,revision: 1,...(input.planItemId ? { planItemId: input.planItemId } : {}) }
  }
  return { ...biz,teachingContent: { ...biz.teachingContent,[key]: input.editingId ? existing.map(item => item.id === input.editingId ? content : item) : [...existing,content] } }
}

export function questionsFromItems(items: Item[]): PreparedQuestion[] {
  return leafItems({ items }).map(i => {
    const source = i.references.at(-1)
    if (!source) throw new Error("题目没有稳定来源，不能作为引用资料交接。")
    return { id: `${source.documentId}:v${source.version}:${source.itemId}`,title: i.title,text: itemText({ ...i,stem: "",notes: "" }),notes: i.notes,stem: i.stem,printedPage: i.printedPage,filePage: i.filePage,question: i.question,subquestion: i.subquestion,maxScore: i.maxScore,scoring: i.scoring,answer: i.answer,source: structuredClone(source),references: structuredClone(i.references.slice(0,-1)) }
  })
}
