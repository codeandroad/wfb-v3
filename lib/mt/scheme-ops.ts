// 评价方案的明确命令：纯函数，返回新的 MtBiz 或错误；由 mt.command 原子提交。
// 保存只产生方案/修订；设默认只改所选用途；均不改写学生结果、不重算、不发布。

import { permittedTasks } from "./derive"
import { feedbackPeriodId, weekOfDate, dateOfClock } from "./model"
import {
  SYSTEM_DEFAULT_REV,
  SYSTEM_SCHEMES,
  bindingKey,
  cleanDraft,
  defaultKey,
  homeworkDefaultNow,
  classroomDefaultAt,
  ownerKey,
  overrideKey,
  revById,
  revRefs,
  sameContent,
  draftOfRev,
  type DefaultEntry,
  type Draft,
  type Purpose,
  type Scheme,
  type SchemeRev,
  type SchemeState,
} from "./schemes"
import type { MtBiz } from "./store"

type Out = MtBiz | { error: string }

export function curWeekOf(biz: MtBiz): number {
  return weekOfDate(dateOfClock(biz.clock))
}

export function refsOf(biz: MtBiz) {
  return revRefs(biz.schemes, {
    assignmentRevs: biz.assignments.map((a) => a.schemeRevId),
    publicationRevs: biz.publications.flatMap((p) => (p.legends ?? []).map((l) => l.revId)),
  })
}

export function mySchemes(st: SchemeState, teacherId: string): Scheme[] {
  const owner = ownerKey(teacherId)
  return Object.values(st.schemes)
    .filter((s) => s.owner === owner)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** 本人当前反馈周期是否已有课堂评价绑定或含课堂维度的发布：是则课堂默认只能下期起生效 */
export function classroomUsedThisPeriod(biz: MtBiz, teacherId: string): boolean {
  const pid = feedbackPeriodId(curWeekOf(biz))
  const tasks = permittedTasks(biz, teacherId).map((t) => t.id)
  if (tasks.some((t) => biz.schemes.bindings[bindingKey(t, pid)])) return true
  return biz.publications.some((p) => p.periodId === pid && p.taskIds.some((t) => tasks.includes(t)))
}

function newId(prefix: string, biz: MtBiz) {
  return `${prefix}_${biz.seq + 1}_${Math.random().toString(36).slice(2, 7)}`
}

/** 保存：新建方案，或在内容实质变化时追加修订（未被任何引用的最新修订原地更新，避免修订链） */
export function saveScheme(
  biz: MtBiz,
  teacherId: string,
  schemeId: string | null,
  draft: Draft,
  source: Scheme["source"],
): { biz: MtBiz; revId: string; changed: boolean } | { error: string } {
  const st = biz.schemes
  const d = cleanDraft(draft)
  const at = biz.clock
  if (!schemeId) {
    const sid = newId("SCH", biz)
    const rev: SchemeRev = { id: `${sid}@1`, schemeId: sid, n: 1, ...d, at }
    const scheme: Scheme = { id: sid, owner: ownerKey(teacherId), source, archived: false, revIds: [rev.id], createdAt: at }
    return {
      biz: { ...biz, seq: biz.seq + 1, schemes: { ...st, schemes: { ...st.schemes, [sid]: scheme }, revs: { ...st.revs, [rev.id]: rev } } },
      revId: rev.id,
      changed: true,
    }
  }
  const scheme = st.schemes[schemeId]
  if (!scheme || scheme.owner !== ownerKey(teacherId)) return { error: "只能修改本人的方案" }
  const last = st.revs[scheme.revIds.at(-1)!]
  if (last && sameContent(draftOfRev(last), d)) return { biz, revId: last.id, changed: false }
  const refs = refsOf(biz)
  if (last && !refs.business.has(last.id) && !refs.defaults.has(last.id)) {
    const rev: SchemeRev = { ...last, ...d, at }
    return { biz: { ...biz, seq: biz.seq + 1, schemes: { ...st, revs: { ...st.revs, [rev.id]: rev } } }, revId: rev.id, changed: true }
  }
  const n = (last?.n ?? 0) + 1
  const rev: SchemeRev = { id: `${schemeId}@${n}`, schemeId, n, ...d, at, ...(last?.researchBasis ? { researchBasis: structuredClone(last.researchBasis) } : {}) }
  return {
    biz: {
      ...biz,
      seq: biz.seq + 1,
      schemes: {
        ...st,
        schemes: { ...st.schemes, [schemeId]: { ...scheme, revIds: [...scheme.revIds, rev.id] } },
        revs: { ...st.revs, [rev.id]: rev },
      },
    },
    revId: rev.id,
    changed: true,
  }
}

export type ClassroomTiming = "NOW"

/** 设为默认：只改所选用途。课堂可本期立即生效（已固定绑定的任务不受影响）或下期起；同一待生效周期再次调整即替换。 */
export function setDefault(biz: MtBiz, teacherId: string, revId: string, purposes: Purpose[], timing: ClassroomTiming): Out {
  if (!revById(revId) && !biz.schemes.revs[revId]) return { error: "找不到该方案修订" }
  const owner = ownerKey(teacherId)
  const cur = curWeekOf(biz)
  const defaults = { ...biz.schemes.defaults }
  for (const p of purposes) {
    const k = defaultKey(owner, p)
    const list = [...(defaults[k] ?? [])]
    if (p === "CLASSROOM") {
      const from = cur
      const kept = list.filter((e) => e.fromWeek < from)
      const entry: DefaultEntry = { revId, fromWeek: from, at: biz.clock }
      defaults[k] = [...kept, entry]
    } else {
      defaults[k] = [...list, { revId, fromWeek: cur, at: biz.clock }]
    }
  }
  return { ...biz, schemes: { ...biz.schemes, defaults } }
}

/** 当前任务本周期课堂是否已实际使用（已绑定/含该任务的发布）：是则覆盖只能下期起 */
export function taskClassroomUsed(biz: MtBiz, taskId: string): boolean {
  const pid = feedbackPeriodId(curWeekOf(biz))
  if (biz.schemes.bindings[bindingKey(taskId, pid)]) return true
  return biz.publications.some((p) => p.periodId === pid && p.taskIds.includes(taskId))
}

/**
 * 仅对一个真实任务设置某用途覆盖；revId 为空表示清除覆盖、恢复教师默认。
 * 课堂：本期未使用则自本期起，否则自下期起（本期继续用原修订）；作业：仅之后新布置的作业。
 */
export function setTaskOverride(biz: MtBiz, teacherId: string, taskId: string, purpose: Purpose, revId: string | null): Out | { error: string } {
  if (!permittedTasks(biz, teacherId).some((t) => t.id === taskId)) return { error: "无权修改该任务" }
  if (revId && !revById(revId) && !biz.schemes.revs[revId]) return { error: "找不到该方案修订" }
  const k = overrideKey(taskId, purpose)
  const list = [...(biz.schemes.taskOverrides?.[k] ?? [])]
  const cur = curWeekOf(biz)
  let next: DefaultEntry[]
  if (purpose === "CLASSROOM") {
    return { error: "请在任务课堂方案中明确采用，当前周期与持续选择一起更新。" }
  } else {
    next = [...list, { revId: revId ?? "", fromWeek: cur, at: biz.clock }]
  }
  return { ...biz, schemes: { ...biz.schemes, taskOverrides: { ...(biz.schemes.taskOverrides ?? {}), [k]: next } } }
}

/** 某用途在某修订之上的引用（当前有效或待生效）；用于归档/删除前替换 */
export function defaultUsesScheme(biz: MtBiz, teacherId: string, schemeId: string): Purpose[] {
  const owner = ownerKey(teacherId)
  const cur = curWeekOf(biz)
  const out: Purpose[] = []
  const inScheme = (rev: string) => rev.startsWith(`${schemeId}@`)
  const cls = biz.schemes.defaults[defaultKey(owner, "CLASSROOM")] ?? []
  if (inScheme(classroomDefaultAt(biz.schemes, owner, cur)) || cls.some((e) => e.fromWeek > cur && inScheme(e.revId))) out.push("CLASSROOM")
  if (inScheme(homeworkDefaultNow(biz.schemes, owner, biz.clock))) out.push("HOMEWORK")
  return out
}

export function schemeInBusiness(biz: MtBiz, scheme: Scheme): boolean {
  const refs = refsOf(biz)
  return scheme.revIds.some((r) => refs.business.has(r))
}

/** 归档或删除；仍被默认引用时必须同时给出替代修订（默认为系统默认） */
export function retireScheme(biz: MtBiz, teacherId: string, schemeId: string, mode: "ARCHIVE" | "DELETE", replacementRevId: string): Out {
  const scheme = biz.schemes.schemes[schemeId]
  if (!scheme || scheme.owner !== ownerKey(teacherId)) return { error: "只能处理本人的方案" }
  if (replacementRevId.startsWith(`${schemeId}@`)) return { error: "替代方案不能是被处理的方案本身" }
  const used = defaultUsesScheme(biz, teacherId, schemeId)
  let next: MtBiz = biz
  if (used.length) {
    const r = setDefault(biz, teacherId, replacementRevId, used, "NOW")
    if ("error" in r) return r
    next = r
    // 待生效选择若仍指向该方案，也一并替换
    const k = defaultKey(ownerKey(teacherId), "CLASSROOM")
    const list = next.schemes.defaults[k] ?? []
    next = {
      ...next,
      schemes: {
        ...next.schemes,
        defaults: { ...next.schemes.defaults, [k]: list.map((e) => (e.fromWeek > curWeekOf(biz) && e.revId.startsWith(`${schemeId}@`) ? { ...e, revId: replacementRevId } : e)) },
      },
    }
  }
  if (mode === "ARCHIVE") {
    return { ...next, schemes: { ...next.schemes, schemes: { ...next.schemes.schemes, [schemeId]: { ...scheme, archived: true } } } }
  }
  if (schemeInBusiness(biz, scheme)) return { error: "该方案已被评价、作业或发布引用，只能归档" }
  const refs = refsOf(next)
  if (scheme.revIds.some((r) => refs.defaults.has(r) && isCurrentlyReferenced(next, teacherId, r)))
    return { error: "该方案仍被默认选择引用，请先替换" }
  const schemes = { ...next.schemes.schemes }
  delete schemes[schemeId]
  const revs = { ...next.schemes.revs }
  // 采用历史中曾出现过的修订保留（用于补录解析），其余物理删除
  for (const r of scheme.revIds) if (!refs.defaults.has(r)) delete revs[r]
  return { ...next, schemes: { ...next.schemes, schemes, revs } }
}

function isCurrentlyReferenced(biz: MtBiz, teacherId: string, revId: string): boolean {
  const owner = ownerKey(teacherId)
  const cur = curWeekOf(biz)
  if (classroomDefaultAt(biz.schemes, owner, cur) === revId) return true
  if (homeworkDefaultNow(biz.schemes, owner, biz.clock) === revId) return true
  return (biz.schemes.defaults[defaultKey(owner, "CLASSROOM")] ?? []).some((e) => e.fromWeek > cur && e.revId === revId)
}

export function restoreArchived(biz: MtBiz, teacherId: string, schemeId: string): Out {
  const scheme = biz.schemes.schemes[schemeId]
  if (!scheme || scheme.owner !== ownerKey(teacherId)) return { error: "只能处理本人的方案" }
  return { ...biz, schemes: { ...biz.schemes, schemes: { ...biz.schemes.schemes, [schemeId]: { ...scheme, archived: false } } } }
}

export const SYSTEM_DEFAULT = SYSTEM_DEFAULT_REV
export const SYSTEM_LIST = SYSTEM_SCHEMES
