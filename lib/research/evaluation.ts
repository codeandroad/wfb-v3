import { permittedTasks } from "@/lib/mt/derive"
import { lifecycleOf, isSubmitted } from "@/lib/mt/hw"
import type { Assignment } from "@/lib/mt/model"
import { ownerKey, validateDraft, type SchemeRev } from "@/lib/mt/schemes"
import type { MtBiz } from "@/lib/mt/store"
import { canReadCriterion, courseTaskMap, coursesFor, validateCriterion, type Actor, type CatalogState, type ResearchState, type TestConversion } from "./model"
import { isTeachingActor } from "./teaching"

export function copyCriterionToScheme(biz: MtBiz, state: ResearchState, actor: Actor, teacherId: string | null, criterionId: string, version: number): { biz: MtBiz; revId: string } | { error: string } {
  const criterion = state.criteria.find(c => c.id === criterionId)
  if (!isTeachingActor(actor, teacherId) || !criterion || criterion.version !== version || !canReadCriterion(state, actor, criterion)) return { error: "没有本人教学身份或依据已有修订／无读取权限。" }
  if (criterion.kind !== "课堂表现方案" && criterion.kind !== "作业质量方案") return { error: "题目评分与单次考核换算不能当作课堂或作业质量方案。" }
  const source = criterion.documentId ? state.documents.find(d => d.id === criterion.documentId) : null
  if (source && (source.restricted || source.copyPolicy !== "retain")) return { error: "受限来源不能复制为脱离授权的个人评价依据。" }
  const schemeId = `RESEARCH_${teacherId}_${criterion.id}_v${criterion.version}`
  const revId = `${schemeId}@1`
  if (biz.schemes.revs[revId]) return { biz, revId }
  const draft = { name: `${criterion.title.slice(0, 18)} · v${version}`, desc: "本人明确保存的科组依据副本；完整维度、等级含义和来源保留，不自动采用。", levels: structuredClone(criterion.levels), defaultLevelId: criterion.levels.find(l => l.code === "A")?.id ?? null, parentMode: "CODE_LABEL" as const }
  const issues = validateDraft(draft, [])
  if (issues.length) return { error: `沿用原评价方案校验：${issues[0].msg}。请先修订共建依据。` }
  const rev: SchemeRev = { ...draft, id: revId, schemeId, n: 1, at: biz.clock, researchBasis: structuredClone(criterion) }
  return { revId, biz: { ...biz, schemes: { ...biz.schemes, schemes: { ...biz.schemes.schemes, [schemeId]: { id: schemeId, owner: ownerKey(teacherId!), source: { schemeId: `criterion:${criterion.id}`, revId: `v${criterion.version}`, name: criterion.title }, archived: false, revIds: [revId], createdAt: biz.clock } }, revs: { ...biz.schemes.revs, [revId]: rev } } } }
}

export function bindTestConversion(biz: MtBiz, state: ResearchState, catalog: CatalogState, actor: Actor, teacherId: string | null, input: { criterionId: string; version: number; assignmentId: string; participantIds: string[]; confirmed: boolean }): MtBiz | { error: string } {
  const criterion = state.criteria.find(c => c.id === input.criterionId)
  const assignment = biz.assignments.find(a => a.id === input.assignmentId)
  const task = permittedTasks(biz, teacherId).find(t => t.id === assignment?.taskId)
  if (!isTeachingActor(actor, teacherId) || !input.confirmed || !criterion || !assignment || !task || !canReadCriterion(state, actor, criterion) || criterion.version !== input.version) return { error: "请明确核对本人的合法考核、保存依据版本与参与范围。" }
  if (criterion.kind !== "单次考核等级换算" || !criterion.thresholds.length || lifecycleOf(assignment) !== "ACTIVE") return { error: "只有已提供真实分数线的单次考核依据可以绑定正在处理的考核。" }
  if (!coursesFor(catalog, criterion.group).some(c => courseTaskMap[c.code] === task.course_id)) return { error: "本次考核课程不在该依据所属科组的有效责任范围。" }
  const participants = [...new Set(input.participantIds)]
  if (!participants.length || participants.some(id => !assignment.recipients.includes(id))) return { error: "参与范围必须是该考核已保存名单中的明确对象，不能扩大至其他班级。" }
  try { validateCriterion(criterion) } catch (error) { return { error: error instanceof Error ? error.message : "依据无效。" } }
  const conversion: TestConversion = { criterionId: criterion.id, version: criterion.version, title: criterion.title, source: criterion.source, testName: criterion.testName, assignmentId: assignment.id, participantIds: participants, thresholds: structuredClone(criterion.thresholds), levels: structuredClone(criterion.levels), adoptedAt: biz.clock }
  return { ...biz, assignments: biz.assignments.map(a => a.id === assignment.id ? { ...a, gradeConversion: conversion, gradeConversionHistory: [...(a.gradeConversionHistory ?? []), ...(a.gradeConversion ? [structuredClone(a.gradeConversion)] : [])], revision: a.revision + 1, log: [...(a.log ?? []), { at: biz.clock, what: `明确绑定单次考核换算 ${criterion.title} v${criterion.version}，范围 ${participants.length} 人；质量评价、数字分数与发布历史保持不变` }] } : a) }
}

export function bindQuestionScoringBasis(biz: MtBiz, state: ResearchState, actor: Actor, teacherId: string | null, input: { criterionId: string; version: number; assignmentId: string; questionId: string; confirmed: boolean }): MtBiz | { error: string } {
  const criterion = state.criteria.find(c => c.id === input.criterionId)
  const assignment = biz.assignments.find(a => a.id === input.assignmentId)
  const question = assignment?.questionSources?.find(q => q.id === input.questionId)
  if (!isTeachingActor(actor,teacherId) || !input.confirmed || !criterion || criterion.version !== input.version || criterion.kind !== "题目评分依据" || !canReadCriterion(state,actor,criterion) || !assignment || lifecycleOf(assignment) !== "ACTIVE" || !permittedTasks(biz,teacherId).some(t => t.id === assignment.taskId) || !question) return { error: "请明确核对本人作业的具体题目和可读取的评分依据版本。" }
  if (![question.source,...question.references].some(ref => ref.documentId === criterion.documentId && ref.itemId === criterion.itemId)) return { error: "评分依据并未关联本题／小题，不能按题目名称匹配。" }
  const source = state.documents.find(d => d.id === criterion.documentId)
  if (!source || source.restricted || source.copyPolicy !== "retain") return { error: "受限评分资料不能转交为作业中的脱离授权副本。" }
  const basis = { criterionId: criterion.id,version: criterion.version,title: criterion.title,source: criterion.source,maxScore: criterion.maxScore,scoring: criterion.scoring,adoptedAt: biz.clock }
  return { ...biz,assignments: biz.assignments.map(a => a.id === assignment.id ? { ...a,questionSources: a.questionSources?.map(q => q.id === question.id ? { ...q,scoringBasis: basis } : q),questionScoringHistory: [...(a.questionScoringHistory ?? []),...(question.scoringBasis ? [{ questionId: question.id,basis: structuredClone(question.scoringBasis) }] : [])],revision: a.revision+1,log: [...(a.log ?? []),{ at: biz.clock,what: `明确采用单题评分依据 ${criterion.title} v${criterion.version}；已有分数、质量评价与发布历史不重算` }] } : a) }
}

export function testConversionReference(assignment: Assignment, studentId: string) {
  const conversion = assignment.gradeConversion
  const result = assignment.results[studentId]
  if (!conversion || conversion.assignmentId !== assignment.id || !conversion.participantIds.includes(studentId) || result?.score == null || !isSubmitted(result.submission) || result.review || assignment.requirementOverrides[studentId] === "EXEMPT" || (assignment.requirementOverrides[studentId] ?? assignment.defaultRequirement) === "OPTIONAL" && result.participating === false) return null
  const threshold = [...conversion.thresholds].sort((a, b) => b.minimum - a.minimum).find(t => result.score! >= t.minimum)
  if (!threshold) return { text: "未落入已提供的分数线，不自动补齐等级", version: conversion.version }
  const level = conversion.levels?.find(l => l.code === threshold.code)
  return { text: `${threshold.code}${level ? ` · ${level.label}` : "（旧依据未保存等级含义）"}`, version: conversion.version }
}
