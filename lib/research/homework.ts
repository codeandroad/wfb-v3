import type { STask } from "@/lib/mt/model"
import { canReadDocument, canRetainItem, leafItems, referenceFor, referenceReadable, selectItems, taskCompatible, type Actor, type PreparedQuestion, type ResearchState } from "./model"
import { questionsFromItems } from "./teaching"

export function prepareHomeworkQuestions(state: ResearchState, actor: Actor, documentId: string, version: number, itemIds: string[], task: STask): PreparedQuestion[] {
  const document = state.documents.find(d => d.id === documentId)
  if (!document || document.archived || document.version !== version || !canReadDocument(state, actor, document) || document.restricted || document.copyPolicy !== "retain") throw new Error("资料来源已变化、归档或不能合法转交，请重新核对。")
  const items = leafItems({ items: selectItems(document, itemIds) })
  if (!items.length || items.some(i => !canRetainItem(state, actor, i, document.owner)) || !taskCompatible(document, task, items)) throw new Error("题目课程、真实单元或来源权限不适用于所选任教任务。")
  return questionsFromItems(items.map(item => ({ ...structuredClone(item), references: [...item.references.map(ref => ({ ...structuredClone(ref), retainedBy: actor.staff })), referenceFor(document, item, actor)] })))
}

export function preparedQuestionReadable(state: ResearchState, actor: Actor, question: PreparedQuestion) {
  return [question.source, ...question.references].every(ref => referenceReadable(state, actor, ref, actor.staff))
}

export function validatePreparedQuestions(state: ResearchState, actor: Actor, task: STask, questions: PreparedQuestion[], useSavedVersions = false): string | null {
  if (new Set(questions.map(q => q.id)).size !== questions.length) return "同一题目重复选入，请核对后再布置。"
  for (const question of questions) {
    const source = state.documents.find(d => d.id === question.source.documentId)
    const saved = state.revisions[`${question.source.documentId}@${question.source.version}`] ?? (source?.version === question.source.version ? source : null)
    const item = saved?.items.find(i => i.id === question.source.itemId)
    if (!source || !saved || !item || source.restricted || source.copyPolicy !== "retain" || !preparedQuestionReadable(state, actor, question)) return "某条题目来源或受限资料授权不可用，草稿保留，不能绕过限制继续转交。"
    if (!useSavedVersions && (source.archived || source.version !== question.source.version)) return "题目来源已有修订或归档。请核对已保存正文，明确勾选沿用快照，或返回资料重新选择；不会替换成新版。"
    if (!useSavedVersions && !canReadDocument(state, actor, source)) return "当前没有来源读取权；只能在核对合法保留的快照后明确沿用。"
    if (!taskCompatible(saved, task, [item])) return "题目使用了不同课程或不同真实单元，不能按同名内容跨用。"
    if (question.maxScore !== item.maxScore || question.scoring !== item.scoring || !Number.isFinite(question.maxScore ?? 0)) return "保存的题目分值或评分依据不一致，请重新选取。"
    if ([question.source, ...question.references].some(ref => { const original = state.documents.find(d => d.id === ref.documentId); return !original || original.restricted || original.copyPolicy !== "retain" || !ref.retainText })) return "题目包含仅允许受限引用的来源，不能转交为作业副本。"
  }
  return null
}

export function homeworkQuestionInstructions(questions: PreparedQuestion[]) {
  return questions.map(question => [question.title, question.stem && `共同题干：${question.stem}`, question.text, `来源：${question.source.title} v${question.source.version} · 印刷页 ${question.printedPage || "未提供"} · 文件页 ${question.filePage || "未提供"} · 题 ${question.question || "未提供"}${question.subquestion}`].filter(Boolean).join("\n")).join("\n\n")
}
