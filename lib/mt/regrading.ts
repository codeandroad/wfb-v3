import { permittedTasks } from "./derive"
import { feedbackPeriodId, weekOfDate, type HwResult, type Rec } from "./model"
import { bindingKey, classroomRevFor, ownerKey, SYSTEM_SCHEMES, revById } from "./schemes"
import { writeBlock } from "./hw"
import type { MtBiz } from "./store"

export type RegradeTarget = { kind: "CLASSROOM"; taskId: string; week: number } | { kind: "HOMEWORK"; taskId: string; assignmentId: string }
export interface RegradeHistory {
  token: string; key: string; from: string | null; to: string; at: string; generation: number
  records?: Record<string, Rec>; results?: Record<string, HwResult>
}
export const regradeKey = (t: RegradeTarget) => t.kind === "CLASSROOM" ? `CLASSROOM:${bindingKey(t.taskId, feedbackPeriodId(t.week))}` : `HOMEWORK:${t.assignmentId}`
export const generationOf = (s: MtBiz, t: RegradeTarget) => s.evaluationGenerations?.[regradeKey(t)] ?? 0
export function regradeImpact(s: MtBiz, t: RegradeTarget) {
  if (t.kind === "HOMEWORK") return Object.values(s.assignments.find(a => a.id === t.assignmentId)?.results ?? {}).filter(r => r.quality !== null || r.noGrade || r.qualityCleared).length
  return Object.values(s.records).filter(r => r.taskId === t.taskId && weekOfDate(r.date) === t.week && (r.grade !== null || r.gradeHandling === "CONFIRMED" || r.gradeHandling === "EXPLICIT_EMPTY")).length
}

export function regrade(s: MtBiz, teacherId: string, t: RegradeTarget, revId: string, expected: number, token: string): MtBiz | { error: string } {
  if (s.regradeHistory?.some(h => h.token === token)) return s
  const task = permittedTasks(s, teacherId).find(x => x.id === t.taskId)
  if (!task) return { error: "已失去该任务权限" }
  if (generationOf(s, t) !== expected) return { error: "评价代次已变化，请核对最新方案后重新操作" }
  const rev = revById(revId)
  const scheme = rev && (s.schemes.schemes[rev.schemeId] ?? SYSTEM_SCHEMES.find(x => x.id === rev.schemeId))
  if (!rev || !scheme || scheme.archived || (scheme.owner !== "SYSTEM" && scheme.owner !== ownerKey(teacherId))) return { error: "方案不存在或无权采用" }
  const key = regradeKey(t)
  const generation = expected + 1
  const history: RegradeHistory = { token, key, from: null, to: revId, at: s.clock, generation }
  const common = { evaluationGenerations: { ...s.evaluationGenerations, [key]: generation } }
  if (t.kind === "CLASSROOM") {
    const bk = bindingKey(t.taskId, feedbackPeriodId(t.week))
    const old = classroomRevFor(s.schemes, t.taskId, task.teacher_id, feedbackPeriodId(t.week), t.week).revId
    if (old === revId) return s
    history.from = old
    history.records = {}
    const records = { ...s.records }
    for (const [k, r] of Object.entries(records)) {
      if (r.taskId !== t.taskId || weekOfDate(r.date) !== t.week) continue
      history.records[k] = r
      records[k] = { ...r, grade: null, gradeHandling: r.gradeHandling === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "PENDING", gradeOrigin: r.gradeHandling === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "UNSET", gradeCovered: r.gradeHandling === "NOT_APPLICABLE" ? r.gradeCovered : [], coverageReview: false, revision: r.revision + 1, fieldRev: { ...r.fieldRev, grade: (r.fieldRev.grade ?? 0) + 1 }, stamp: s.stamp + 1 }
    }
    return { ...s, ...common, records, schemes: { ...s.schemes, bindings: { ...s.schemes.bindings, [bk]: revId } }, regradeHistory: [...(s.regradeHistory ?? []), history] }
  }
  const a = s.assignments.find(x => x.id === t.assignmentId && x.taskId === t.taskId)
  if (!a) return { error: "作业不存在" }
  if (a.schemeRevId === revId) return s
  const block = a.recipients.map(sid => writeBlock(a, sid, Date.parse(s.clock))).find(Boolean)
  if (block) return { error: `${block}；请先使用原有恢复处理／延期入口。` }
  history.from = a.schemeRevId ?? null
  history.results = a.results
  const results = Object.fromEntries(Object.entries(a.results).map(([sid, r]) => [sid, { ...r, quality: null, noGrade: false, qualityCleared: false, qualitySource: undefined, rev: { ...r.rev, quality: (r.rev?.quality ?? 0) + 1, noGrade: (r.rev?.noGrade ?? 0) + 1 } }]))
  return { ...s, ...common, assignments: s.assignments.map(x => x.id === a.id ? { ...a, schemeRevId: revId, results, revision: a.revision + 1, stamp: s.stamp + 1 } : x), regradeHistory: [...(s.regradeHistory ?? []), history] }
}
