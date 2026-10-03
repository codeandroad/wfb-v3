/**
 * 作业管理第二期：唯一作业状态规则。
 * 侧边栏作业管理、整周反馈“作业评价”、学生详情、统计与发布全部从这里读取有效状态，
 * 写入守卫也复用同一组判定，避免两个入口各自维护一套口径。
 */
import {
  addDays,
  assignmentWeek,
  dateOfClock,
  fmtMD,
  requirementOf,
  SUBMISSION_LABEL,
  type Assignment,
  type HwField,
  type HwResult,
  type Requirement,
  type Submission,
} from "./model"
import { levelText, revById } from "./schemes"

export const DAY_MS = 86400000
/** 原默认截止后 3 天锁定（沿用已确认设置） */
export const LOCK_DAYS = 3

export const blankResult = (): HwResult => ({ submission: null, submissionConfirmed: false, quality: null, score: null })
export const lifecycleOf = (a: Assignment) => a.status ?? "ACTIVE"
export const isSubmitted = (s: Submission | null | undefined) => s === "ON_TIME" || s === "LATE" || s === "SUBMITTED"

/** 该生有效截止：个别延期优先，不移动全班截止与归期 */
export function effDeadline(a: Assignment, sid: string): string | null {
  return a.results[sid]?.extDeadline ?? a.deadline
}

/** 学校本地第 3 个自然日结束（演示时钟为 +08:00） */
export function defaultDeadline(fromIso: string): string {
  return `${addDays(dateOfClock(fromIso), 3)}T23:59:00+08:00`
}

export function lockAtOf(a: Assignment, sid: string): number | null {
  const d = effDeadline(a, sid)
  if (!d) return null
  let t = Date.parse(d) + LOCK_DAYS * DAY_MS
  // 线下补录：从真实登记时点起至少给出同样的处理窗口，避免只读空壳
  if (a.offline) t = Math.max(t, Date.parse(a.offline.registeredAt) + LOCK_DAYS * DAY_MS)
  const added = a.addedAt?.[sid]
  if (added) t = Math.max(t, Date.parse(added) + LOCK_DAYS * DAY_MS)
  return t
}

/** 是否禁止写入该生结果；返回原因或 null */
export function writeBlock(a: Assignment, sid: string, nowTs: number): string | null {
  const st = lifecycleOf(a)
  if (st === "WITHDRAWN") return "作业已撤回，结果只读"
  if (st === "CLOSED") return "作业已结束检查；如需补交请先“恢复处理”"
  if (!a.recipients.includes(sid)) return "该生不在本作业对象中"
  const lock = lockAtOf(a, sid)
  if (lock !== null && nowTs >= lock) return `已于 ${fmtMD(dateOfClock(new Date(lock + 8 * 3600000).toISOString()))} 按截止后 ${LOCK_DAYS} 天锁定`
  return null
}

export type HwState =
  | "EXEMPT"
  | "OPTIONAL_OUT"
  | "OPTIONAL_OPEN"
  | "REVIEW"
  | "NOT_DUE"
  | "DUE_UNRECORDED"
  | "SUSPECTED_MISSING"
  | "MISSING"
  | "UNGRADED"
  | "GRADED"
  | "NO_GRADE"

export const STATE_LABEL: Record<HwState, string> = {
  EXEMPT: "确认免做",
  OPTIONAL_OUT: "选做未参与",
  OPTIONAL_OPEN: "选做 · 未登记",
  REVIEW: "参与安排待核对",
  NOT_DUE: "未到截止 · 未登记",
  DUE_UNRECORDED: "到期待核对",
  SUSPECTED_MISSING: "疑似未交 · 待核实",
  MISSING: "未交（已核实）",
  UNGRADED: "已提交 · 待评价",
  GRADED: "已评价",
  NO_GRADE: "已提交 · 明确不评价",
}
/** 需要教师继续处理的状态（参与待核对单列，不计入 E） */
export const PENDING_STATES: HwState[] = ["DUE_UNRECORDED", "SUSPECTED_MISSING", "UNGRADED", "REVIEW"]

export function hwState(a: Assignment, sid: string, nowTs: number): HwState {
  const req: Requirement = requirementOf(a, sid)
  const r = a.results[sid]
  if (req === "EXEMPT") return "EXEMPT"
  if (r?.review) return "REVIEW"
  if (req === "OPTIONAL" && r?.participating === false) return "OPTIONAL_OUT"
  const sub = r?.submission ?? null
  if (!sub) {
    if (req === "OPTIONAL" && r?.participating !== true) return "OPTIONAL_OPEN"
    const d = effDeadline(a, sid)
    return d && Date.parse(d) <= nowTs ? "DUE_UNRECORDED" : "NOT_DUE"
  }
  if (sub === "MISSING") return r!.submissionConfirmed ? "MISSING" : "SUSPECTED_MISSING"
  if (r!.quality) return "GRADED"
  if (r!.noGrade) return "NO_GRADE"
  return "UNGRADED"
}

/** 是否属于当前有效要求完成对象 E */
export function inE(s: HwState) {
  return !(s === "EXEMPT" || s === "OPTIONAL_OUT" || s === "OPTIONAL_OPEN" || s === "REVIEW")
}
/** 是否已完成检查（已评价、明确不评价、已核实未交） */
export function isChecked(s: HwState) {
  return s === "GRADED" || s === "NO_GRADE" || s === "MISSING"
}

export function qualityText(a: Assignment, q: string | null | undefined): string {
  if (!q) return ""
  const l = revById(a.schemeRevId)?.levels.find((x) => x.id === q)
  return l ? levelText(l) : q
}

/** 面向教师的单条状态文案 */
export function hwLabel(a: Assignment, sid: string, nowTs: number): string {
  const s = hwState(a, sid, nowTs)
  const r = a.results[sid]
  if (s === "GRADED") return `${SUBMISSION_LABEL[r!.submission!]} · ${qualityText(a, r!.quality)}`
  if (s === "UNGRADED" || s === "NO_GRADE") return `${SUBMISSION_LABEL[r!.submission!]}${r!.submission === "SUBMITTED" ? "（时效未定）" : ""} · ${s === "UNGRADED" ? "待评价" : "明确不评价"}`
  return STATE_LABEL[s]
}

/** 兼容旧调用：pending 与统计同口径 */
export function hwStatus(a: Assignment, sid: string, nowTs: number) {
  const s = hwState(a, sid, nowTs)
  return { s, label: hwLabel(a, sid, nowTs), pending: PENDING_STATES.includes(s) }
}

export interface HwProgress {
  E: number
  checked: number
  graded: number
  noGrade: number
  missing: number
  ungraded: number
  dueUnrecorded: number
  suspected: number
  notDue: number
  review: number
  exempt: number
  optionalOut: number
  optionalOpen: number
  pending: number
}
export function hwProgress(a: Assignment, nowTs: number): HwProgress {
  const p: HwProgress = { E: 0, checked: 0, graded: 0, noGrade: 0, missing: 0, ungraded: 0, dueUnrecorded: 0, suspected: 0, notDue: 0, review: 0, exempt: 0, optionalOut: 0, optionalOpen: 0, pending: 0 }
  for (const sid of a.recipients) {
    const s = hwState(a, sid, nowTs)
    if (inE(s)) p.E++
    if (isChecked(s)) p.checked++
    if (PENDING_STATES.includes(s)) p.pending++
    const k: Partial<Record<HwState, keyof HwProgress>> = {
      GRADED: "graded",
      NO_GRADE: "noGrade",
      MISSING: "missing",
      UNGRADED: "ungraded",
      DUE_UNRECORDED: "dueUnrecorded",
      SUSPECTED_MISSING: "suspected",
      NOT_DUE: "notDue",
      REVIEW: "review",
      EXEMPT: "exempt",
      OPTIONAL_OUT: "optionalOut",
      OPTIONAL_OPEN: "optionalOpen",
    }
    const key = k[s]
    if (key) p[key]++
  }
  return p
}

/** 是否有未结项（用于“往期未结”与活动列表） */
export function hasOpen(a: Assignment, nowTs: number) {
  if (lifecycleOf(a) !== "ACTIVE") return false
  const p = hwProgress(a, nowTs)
  return p.pending > 0 || p.notDue > 0
}

export type HwBucket = "THIS" | "LATER" | "PAST_OPEN"
/** 整周反馈“作业评价”的分组；null 表示不在本周期显示 */
export function hwBucket(a: Assignment, week: number, nowTs: number): HwBucket | null {
  if (lifecycleOf(a) === "WITHDRAWN") return null
  const w = assignmentWeek(a)
  if (w === week) return "THIS"
  const issuedWeek = assignmentWeekOfDate(a.issuedAt)
  if (w > week && issuedWeek <= week) return "LATER"
  if (w < week && hasOpen(a, nowTs)) return "PAST_OPEN"
  return null
}
function assignmentWeekOfDate(iso: string) {
  return assignmentWeek({ deadline: null, issuedAt: iso } as Assignment)
}
export const BUCKET_LABEL: Record<HwBucket, string> = { THIS: "本期应完成", LATER: "后续安排", PAST_OPEN: "往期未结" }

/* ============================================================
 * 写入守卫（单条）
 * ========================================================== */

export type HwPatch = Partial<Pick<HwResult, "submission" | "submissionConfirmed" | "quality" | "score" | "noGrade" | "participating" | "extDeadline" | "review" | "note" | "memo" | "reason">>

const TRACKED: HwField[] = ["submission", "quality", "score", "noGrade", "participating"]

function bump(r: HwResult, f: HwField) {
  r.rev = { ...(r.rev ?? {}), [f]: (r.rev?.[f] ?? 0) + 1 }
}

/** 让质量 / 分数 / 不评价退出有效状态，旧值进入历史 */
function voidQuality(r: HwResult, at: string, why: string) {
  const parts: string[] = []
  if (r.quality) parts.push(`质量 ${r.quality}`)
  if (r.score !== null && r.score !== undefined) parts.push(`分数 ${r.score}`)
  if (r.noGrade) parts.push("明确不评价")
  if (!parts.length) return
  r.history = [...(r.history ?? []), { at, what: why, from: parts.join("、") }]
  if (r.quality) {
    r.quality = null
    bump(r, "quality")
  }
  if (r.score !== null && r.score !== undefined) {
    r.score = null
    bump(r, "score")
  }
  if (r.noGrade) {
    r.noGrade = false
    bump(r, "noGrade")
  }
  r.qualitySource = undefined
}

/**
 * 把补丁应用到单条结果并执行全部业务守卫。
 * 返回新结果或错误；不修改入参。
 */
export function applyHwPatch(
  a: Assignment,
  sid: string,
  patch: HwPatch,
  ctx: { nowTs: number; at: string; source?: "MANUAL" | "BATCH"; requirement?: Requirement },
): { r: HwResult; requirement: Requirement } | { error: string } {
  const block = writeBlock(a, sid, ctx.nowTs)
  if (block) return { error: block }
  const before = a.results[sid] ?? blankResult()
  const r: HwResult = { ...before, rev: { ...(before.rev ?? {}) }, history: before.history ? [...before.history] : undefined }
  const reqBefore = requirementOf(a, sid)
  const req = ctx.requirement ?? reqBefore

  for (const f of TRACKED) {
    if (f in patch && (patch as Record<string, unknown>)[f] !== (before as unknown as Record<string, unknown>)[f]) {
      ;(r as unknown as Record<string, unknown>)[f] = (patch as Record<string, unknown>)[f]
      bump(r, f)
    }
  }
  for (const f of ["submissionConfirmed", "extDeadline", "review", "note", "memo", "reason"] as const) if (f in patch) (r as unknown as Record<string, unknown>)[f] = patch[f]

  // 登记提交：选做视为明确参与；未交的录入即教师明确确认
  if ("submission" in patch) {
    if (patch.submission && req === "OPTIONAL") r.participating = true
    if (patch.submission === "MISSING" && !("submissionConfirmed" in patch)) r.submissionConfirmed = true
    if (isSubmitted(patch.submission)) r.submissionConfirmed = true
  }

  // 失去提交事实 / 免做 / 退出参与：质量与分数退出有效状态，恢复后不自动复活
  const lostSubmission = isSubmitted(before.submission) && !isSubmitted(r.submission)
  if (lostSubmission) voidQuality(r, ctx.at, r.submission === "MISSING" ? "改为未交" : "撤销提交登记")
  if (req === "EXEMPT" && reqBefore !== "EXEMPT") voidQuality(r, ctx.at, "改为确认免做")
  if (req === "OPTIONAL" && r.participating === false && before.participating !== false) voidQuality(r, ctx.at, "改为选做未参与")

  // 等级 / 分数 / 不评价只能写给真实提交的有效对象
  const writingGrade = (patch.quality ?? null) !== null || (patch.score ?? null) !== null || patch.noGrade === true
  if (writingGrade) {
    if (req === "EXEMPT") return { error: "确认免做的学生不能获得作业等级或分数" }
    if (req === "OPTIONAL" && r.participating === false) return { error: "选做未参与的学生不能获得作业等级或分数" }
    if (r.review) return { error: "参与安排待核对，先核对再评价" }
    if (!isSubmitted(r.submission)) return { error: "未登记真实提交，不能写入等级或分数" }
    if (patch.quality) {
      const rev = revById(a.schemeRevId)
      if (!rev) return { error: "本作业质量标准待核对，暂不能评价" }
      if (!rev.levels.some((l) => l.id === patch.quality)) return { error: "所选等级不属于本作业已采用的标准" }
      r.noGrade = false
      r.qualitySource = ctx.source ?? "MANUAL"
    }
    if (patch.noGrade) {
      if (r.quality) {
        r.history = [...(r.history ?? []), { at: ctx.at, what: "改为明确不评价", from: `质量 ${r.quality}` }]
        r.quality = null
        bump(r, "quality")
      }
    }
    if ((patch.score ?? null) !== null && !a.scoreEnabled) return { error: "本作业未启用分数" }
  }
  if (patch.quality === null && "quality" in patch) r.qualitySource = undefined
  return { r, requirement: req }
}

/* ============================================================
 * 批量（计划 → 确认 → 原子执行）
 * ========================================================== */

export type BatchKind = "SUBMIT" | "GRADE" | "ROUTINE"
export const BATCH_LABEL: Record<BatchKind, string> = {
  SUBMIT: "批量登记提交",
  GRADE: "批量评价",
  ROUTINE: "确认常规完成",
}
export interface BatchOpts {
  submission?: "ON_TIME" | "LATE" | "SUBMITTED"
  level?: string | null
}
export interface BatchPlan {
  writes: { sid: string; patch: HwPatch }[]
  skipped: { sid: string; reason: string }[]
}

export function planBatch(a: Assignment, kind: BatchKind, opts: BatchOpts, subset: string[] | null, nowTs: number): BatchPlan {
  const plan: BatchPlan = { writes: [], skipped: [] }
  const targets = subset ?? a.recipients
  for (const sid of targets) {
    const skip = (reason: string) => plan.skipped.push({ sid, reason })
    const block = writeBlock(a, sid, nowTs)
    if (block) {
      skip(block.startsWith("已于") ? "已锁定" : block)
      continue
    }
    const s = hwState(a, sid, nowTs)
    const r = a.results[sid]
    if (s === "EXEMPT") {
      skip("确认免做")
      continue
    }
    if (s === "OPTIONAL_OUT") {
      skip("选做未参与")
      continue
    }
    if (s === "REVIEW") {
      skip("参与安排待核对")
      continue
    }
    if (s === "OPTIONAL_OPEN") {
      skip("选做未明确参与")
      continue
    }
    if (kind === "SUBMIT") {
      if (r?.submission) {
        skip(r.submission === "MISSING" ? "已登记未交" : "已有提交登记")
        continue
      }
      plan.writes.push({ sid, patch: { submission: opts.submission ?? "ON_TIME" } })
    } else if (kind === "GRADE") {
      if (!r?.submission) {
        skip("未登记提交")
        continue
      }
      if (r.submission === "MISSING") {
        skip("未交")
        continue
      }
      if (r.quality) {
        skip("已有等级")
        continue
      }
      if (r.noGrade) {
        skip("明确不评价")
        continue
      }
      plan.writes.push({ sid, patch: { quality: opts.level ?? null } })
    } else {
      if (r?.submission) {
        skip(r.submission === "LATE" ? "已知迟交" : r.submission === "MISSING" ? "未交" : "已有提交登记")
        continue
      }
      plan.writes.push({ sid, patch: opts.level ? { submission: "ON_TIME", quality: opts.level } : { submission: "ON_TIME" } })
    }
  }
  return plan
}
