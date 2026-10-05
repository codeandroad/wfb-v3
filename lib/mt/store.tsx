"use client"

// 我的教学 r3 统一模拟业务 store。
// - 业务数据按“变体”命名空间持久化到 localStorage：tgs-mt-r3:biz:<variant>；不是正式数据库，不跨设备同步。
// - 每次写入都绑定发起时的目标（任务/日期/学生/字段）与序号：旧响应不覆盖较新输入，切换对象不串写。
// - 只有成功写入模拟存储后才标记“已保存”；故障注入仅用于原型测试。
// - 重置只清本原型命名空间的键，不清空整个浏览器存储。

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { schoolNow } from "./clock"
import { sourceVersion, validTemplate } from './reports'
import { generationOf } from "./regrading"
import {
  addDaysIso,
  applyRoutineItem,
  blankRec,
  dateOfClock,
  dayEligibility,
  ELIG_REASON,
  feedbackPeriodId,
  isAbsentAtt,
  isAttendedAtt,
  isMemberOn,
  lessonParticipation,
  lessonsOfWeek,
  PARTICIPATION_REASON,
  reconcileGrade,
  type DayElig,
  planRoutine,
  prefKey,
  seedAssignments,
  seedLessonOverrides,
  seedMemberships,
  seedPlans,
  seedPublications,
  seedRecords,
  seedTaskPrefs,
  TASKS,
  variantInitialClock,
  weekOfDate,
  type Assignment,
  type Attendance,
  type DisplayPref,
  type HwResult,
  type Membership,
  type Plan,
  type PlanItem,
  type Publication,
  type Rec,
  type Requirement,
  type RoutinePlan,
  type StudentDay,
  type VariantId,
} from "./model"
import { cleanPhrase, emptyLib, type PersonalPhrase, type PhraseKind, type PhraseLib } from "./phrases"
import type { HwBatch, HwBatchEntry, HwField, HwLifecycle } from "./model"
import { applyHwPatch, BATCH_LABEL, blankResult, HW_DAYS_MAX, isSubmitted, lifecycleOf, isPageSize, planBatch, type BatchKind, type BatchOpts, type HwPatch, type PageSize } from "./hw"
import { saveStylePatch, type StylePref } from "./styles"
import type { Attendance as AttV } from "./model"
import {
  bindingKey,
  revById,
  seedSchemeState,
  syncRevRegistry,
  type SchemeState,
} from "./schemes"

/* ============================================================
 * 业务状态
 * ========================================================== */

export interface TextEntry {
  text: string
  stamp: number
}
export interface Highlight {
  id: string
  text: string
  /** r3：来自日卡时为实际日期；既有周级亮点无日期 */
  date?: string
  /** 选用的常用短语（仅来源记录；文字以本条保存为准） */
  phraseId?: string
  /** r4：明确关联的课次（如从课次观察采用）；该课次必须确认参加 */
  lessonId?: string
  /** r4：来源课次观察 */
  obsKey?: string
  /** r4：因出勤更正失效：不再进入有效统计、预览与发布；只能删除或重新添加，不能直接改写为有效 */
  void?: { at: string; reason: string }
  /** r4：存量无日期亮点，所在周有未出席日且无法确定依据：需教师关联参加日期后才计入 */
  review?: boolean
}

/** 亮点当前有效性（唯一判定；输入为该亮点日期对应的学生日资格） */
export type HlStatus = "VALID" | "VOID" | "REVIEW" | "INELIGIBLE"
export function highlightStatus(h: Highlight, e: DayElig | undefined): HlStatus {
  if (h.void) return "VOID"
  if (h.review) return "REVIEW"
  if (!h.date) return "VALID"
  if (!e) return "INELIGIBLE"
  if (h.lessonId) return lessonParticipation(e, h.lessonId) === "ATTENDED" ? "VALID" : "INELIGIBLE"
  return e.kind === "ELIGIBLE" ? "VALID" : "INELIGIBLE"
}

export interface RepairLog {
  id: string
  at: string
  grades: string[]
  coverage: string[]
  highlights: string[]
  review: string[]
}

/**
 * r4 存量修复（幂等，只处理能确定的情形）：
 * - 记录中出现的课次（出勤 + 覆盖）全部确认未出席却保留等级 → 等级转入失效历史，处理为不适用；
 * - 仍有参加但覆盖包含未出席课次 → 自动移出该课次，保留合法等级且不再要求核对；
 * - 确定未出席日的有日期亮点 → 失效；关联未出席课次的亮点 → 失效；
 * - 同周存在确定未出席日的无日期旧亮点 → 标记待核对，不擅自删除或计入。
 * 运行时投影另以真实课次兜底，修复未覆盖的情形也不会进入有效输出。
 */
export function repairEligibility(b: MtBiz): { biz: MtBiz; log: RepairLog | null } {
  const log: RepairLog = { id: `REPAIR_R4_${b.seq}`, at: b.clock, grades: [], coverage: [], highlights: [], review: [] }
  const records = { ...b.records }
  const absentDays = new Map<string, Set<string>>()
  const attendedLessons = new Map<string, Set<string>>()
  const absentLessons = new Map<string, Set<string>>()
  for (const [k, r] of Object.entries(b.records)) {
    const ids = [...new Set([...Object.keys(r.att), ...r.gradeCovered])]
    const att = ids.filter((id) => isAttendedAtt(r.att[id]))
    const abs = ids.filter((id) => isAbsentAtt(r.att[id]))
    const hk = entryKey(r.taskId, weekOfDate(r.date), r.studentId)
    attendedLessons.set(`${hk}|${r.date}`, new Set(att))
    absentLessons.set(`${hk}|${r.date}`, new Set(abs))
    const certainAbsent = ids.length > 0 && abs.length === ids.length
    if (certainAbsent) {
      if (!absentDays.has(hk)) absentDays.set(hk, new Set())
      absentDays.get(hk)!.add(r.date)
    }
    const confirmed = r.gradeHandling === "CONFIRMED" || r.gradeHandling === "EXPLICIT_EMPTY"
    if (certainAbsent && (confirmed || r.grade !== null)) {
      const e: DayElig = { kind: "ABSENT", attended: [], absent: abs, unknown: [], future: [] }
      records[k] = reconcileGrade(r, e, b.clock, "存量修复：未出席日不应保留课堂评价")
      log.grades.push(k)
    } else if (confirmed && att.length && (r.coverageReview || r.gradeCovered.some((id) => abs.includes(id)))) {
      records[k] = { ...r, gradeCovered: r.gradeCovered.filter((id) => !abs.includes(id)), coverageReview: false }
      log.coverage.push(k)
    }
  }
  const highlights = { ...b.highlights }
  for (const [hk, entry] of Object.entries(b.highlights)) {
    let changed = false
    const items = entry.items.map((h) => {
      if (h.void || h.review) return h
      if (h.date) {
        const dayAbsent = absentDays.get(hk)?.has(h.date)
        const lessonAbsent = h.lessonId ? absentLessons.get(`${hk}|${h.date}`)?.has(h.lessonId) : false
        if (dayAbsent || lessonAbsent) {
          changed = true
          log.highlights.push(`${hk}|${h.id}`)
          return { ...h, void: { at: b.clock, reason: "存量修复：学生该日未出席" } }
        }
        return h
      }
      if (absentDays.get(hk)?.size) {
        changed = true
        log.review.push(`${hk}|${h.id}`)
        return { ...h, review: true }
      }
      return h
    })
    if (changed) highlights[hk] = { items, stamp: b.stamp + 1 }
  }
  const n = log.grades.length + log.coverage.length + log.highlights.length + log.review.length
  if (!n) return { biz: b, log: null }
  return { biz: { ...b, records, highlights, stamp: b.stamp + 1, repairLog: [...(b.repairLog ?? []), log] }, log }
}
export interface RoutineOp {
  id: string
  token: string
  at: string
  scopeLabel: string
  entries: { key: string; before: Rec; afterRevision: number }[]
  skipped: number
  undone: boolean
  undoResult?: { restored: number; kept: number }
}

export interface MtBiz {
  evaluationGenerations?: Record<string, number>
  regradeRequests?: Record<string, string>
  schema: 3
  variant: VariantId
  clock: string
  stamp: number
  seq: number
  records: Record<string, Rec>
  memberships: Record<string, Membership[]>
  taskPrefs: Record<string, DisplayPref>
  lessonOverrides: Record<string, DisplayPref>
  assignments: Assignment[]
  plans: Record<string, Plan>
  reporting?: import('./reports').ReportingState
  summaries: Record<string, TextEntry & { teaching?: string; learning?: string }> // `${taskId}|${periodId}`
  comments: Record<string, TextEntry> // `${taskId}|${periodId}|${sid}`
  /** 按日记录的课堂日小结：`${taskId}|${date}`；不自动并入公共总结 */
  daySummaries: Record<string, TextEntry>
  highlights: Record<string, { items: Highlight[]; stamp: number }>
  publications: Publication[]
  routineOps: RoutineOp[]
  revoked: string[]
  /** 原型演示：大班分页数据开关（隔离任务，关闭即恢复原数据视图） */
  bigDemo?: boolean
  rosterEvents: string[]
  /** 评价方案 r1：个人方案、修订、默认采用历史与课堂周期绑定 */
  schemes: SchemeState
  /**
   * r2 课次参考观察（可选）：`${lessonId}|CLASS` 本课教学观察；`${lessonId}|S|${sid}` 指定学生观察。
   * 只作参考：不参与评价覆盖、完成度、发布内容或排课版本。
   */
  observations: Record<string, Observation>
  /** r3 常用内容：按教师隔离的个人常用原因 / 亮点与收藏 */
  phrases: Record<string, PhraseLib>
  /** r4：出勤—评价资格存量修复记录（可审计） */
  repairLog?: RepairLog[]
  /** 作业未布置草稿（按教师＋任务＋方式） */
  hwDrafts?: Record<string, HwDraft>
  /** 教师个人偏好（不影响他人、不改业务数据） */
  teacherPrefs?: Record<string, TeacherPrefs>
  /** 批量候选参数：`${teacherId}|${assignmentId}|${revId}`；只记参数，不代表已写入任何学生 */
  batchCands?: Record<string, BatchCand>
  /** 个人显示样式：`${teacherId}|TASK|CLASS|COURSE|${id}` */
  styles?: Record<string, StylePref>
}

export interface TeacherPrefs {
  /** 布置作业“N 天后”默认值 */
  hwDays?: number
  /** 学生列表每页数量 */
  pageSize?: PageSize
}
export interface BatchCand {
  submission?: "ON_TIME" | "LATE" | "SUBMITTED"
  level?: string
}
export const scopePrefs = (teacherId: string) => `prefs:${teacherId}`

export interface HwDraft {
  teacherId: string
  taskId: string
  mode: "NEW" | "OFFLINE" | "COPY"
  title: string
  instructions: string
  requirement: "REQUIRED" | "OPTIONAL"
  deadline: string
  originalDate?: string
  sourceDate?: string | null
  copiedFrom?: string | null
  savedAt?: string
}

export interface Observation {
  key: string
  lessonId: string
  taskId: string
  date: string
  periodNo: number
  authorId: string
  /** null = 本课整体（全班）观察 */
  studentId: string | null
  text: string
  createdStamp: number
  stamp: number
}

export const obsKey = (lessonId: string, sid: string | null) => (sid ? `${lessonId}|S|${sid}` : `${lessonId}|CLASS`)
export const scopeObs = (lessonId: string) => `obs:${lessonId}`

export interface Faults {
  saveFail: boolean
  delayMs: number
  storageFail: boolean
  loadFail: boolean
  publishLost: boolean
  imageFail: boolean
  slowNextMs: number
}
const NO_FAULTS: Faults = {
  saveFail: false,
  delayMs: 250,
  storageFail: false,
  loadFail: false,
  publishLost: false,
  imageFail: false,
  slowNextMs: 0,
}

export function freshBiz(variant: VariantId): MtBiz {
  const clock = variantInitialClock(variant)
  const memberships: Record<string, Membership[]> = {}
  for (const t of TASKS) memberships[t.id] = seedMemberships(t)
  return {
    schema: 3,
    variant,
    clock,
    stamp: 1,
    seq: 1,
    records: seedRecords(clock),
    memberships,
    taskPrefs: seedTaskPrefs(),
    lessonOverrides: seedLessonOverrides(),
    assignments: seedAssignments(clock),
    plans: seedPlans(),
    summaries: {},
    comments: {},
    daySummaries: {},
    highlights: {},
    publications: seedPublications(clock),
    routineOps: [],
    revoked: [],
    rosterEvents: [],
    schemes: seedSchemes(seedRecords(clock)),
    observations: {},
    phrases: {},
  }
}

/** 既有已确认课堂评价按原型既有字典（A＝优秀，即系统基础四级第 1 修订）固定其周期标准 */
function seedSchemes(records: Record<string, Rec>): SchemeState {
  const keys = new Set<string>()
  for (const r of Object.values(records)) {
    if (r.gradeHandling === "CONFIRMED" || r.gradeHandling === "EXPLICIT_EMPTY") keys.add(bindingKey(r.taskId, feedbackPeriodId(weekOfDate(r.date))))
  }
  return seedSchemeState({ boundPeriods: [...keys] })
}

/** 接入既有原型存储：补充方案状态与作业标准引用，不重置、不改写既有评价 */
function migrate(p: MtBiz): MtBiz {
  let out = p
  if (!out.schemes) out = { ...out, schemes: seedSchemes(out.records) }
  if (!out.daySummaries) out = { ...out, daySummaries: {} }
  if (!out.observations) out = { ...out, observations: {} }
  if (!out.phrases) out = { ...out, phrases: {} }
  if (out.assignments.some((a) => a.schemeRevId === undefined)) {
    // 迁移前布置的作业只可能使用原型既有字典（A＝优秀）
    out = { ...out, assignments: out.assignments.map((a) => (a.schemeRevId === undefined ? { ...a, schemeRevId: "SYS_BASIC4@1" } : a)) }
  }
  return out
}

const NS = "tgs-mt-r3"
const bizKey = (v: VariantId) => `${NS}:biz:${v}`
const META_KEY = `${NS}:meta`

function readBiz(v: VariantId): MtBiz {
  try {
    const raw = window.localStorage.getItem(bizKey(v))
    if (raw) {
      const p = JSON.parse(raw) as MtBiz
      if (p && p.schema === 3 && p.variant === v) return migrate(p)
    }
  } catch {
    /* 损坏则重建 */
  }
  return freshBiz(v)
}

/* ============================================================
 * 保存状态
 * ========================================================== */

export type SaveStatus = "saving" | "saved" | "failed" | "rejected" | "conflict"
export interface SaveEntry {
  field: string
  scope: string[]
  label: string
  value: unknown
  status: SaveStatus
  seq: number
  error?: string
}
type Runner = (s: MtBiz) => MtBiz | { error: string; kind?: "rejected" | "conflict" }

interface SaveReq {
  field: string
  scope: string[]
  label: string
  value: unknown
  taskId?: string
  run: Runner
}

/* ============================================================
 * Context
 * ========================================================== */

interface Ctx {
  ready: boolean
  loadError: boolean
  biz: MtBiz
  faults: Faults
  saves: Record<string, SaveEntry>
  nowTs: number

  // 保存管线
  save: (req: SaveReq) => void
  retry: (field: string) => void
  retryScope: (scope: string) => void
  discardScope: (scope: string) => void
  unsettled: (scope: string) => SaveEntry[]
  pendingValue: <T>(field: string) => { has: boolean; value: T | undefined; status?: SaveStatus }

  // 明确命令（原子）
  runRoutine: (token: string, plan: RoutinePlan, days: StudentDay[], scopeLabel: string) => { ok: true; op: RoutineOp; written: number } | { ok: false; error: string }
  undoRoutine: (opId: string) => { restored: number; kept: number } | { error: string }
  command: (label: string, run: Runner) => { ok: true } | { ok: false; error: string }
  publish: (pub: Omit<Publication, "id" | "revision" | "stamp" | "publishedAt">) => { ok: true; pub: Publication; reused: boolean } | { ok: false; error: string; lost?: boolean }

  // 演示控制
  setVariant: (v: VariantId) => void
  clockMode: "realtime" | "demo"
  resumeRealtime: () => void
  setClock: (iso: string) => void
  setFault: (patch: Partial<Faults>) => void
  retryLoad: () => void
  resetVariant: () => void
  toggleRevoke: (taskId: string) => void
  setBigDemo: (on: boolean) => void
  applyRosterEvent: (id: "G1P1_JOIN_21" | "G1P1_LEAVE_12") => void
}

const MtContext = createContext<Ctx | null>(null)

export function MtProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [biz, setBiz] = useState<MtBiz>(() => freshBiz("BASE"))
  const [faults, setFaults] = useState<Faults>(NO_FAULTS)
  const [saves, setSaves] = useState<Record<string, SaveEntry>>({})
  const [loadError, setLoadError] = useState(false)

  const [clockMode, setClockMode] = useState<"realtime" | "demo">("realtime")
  const demoClock = useRef<string | null>(null)
  const bizRef = useRef(biz)
  const faultsRef = useRef(faults)
  const runners = useRef<Record<string, SaveReq>>({})
  const latestSeq = useRef<Record<string, number>>({})
  const seqCounter = useRef(0)
  const savesRef = useRef(saves)
  savesRef.current = saves
  faultsRef.current = faults

  const persistMeta = useCallback((variant: VariantId, f: Faults) => {
    try {
      window.localStorage.setItem(META_KEY, JSON.stringify({ variant, faults: f }))
    } catch {
      /* ignore */
    }
  }, [])

  const load = useCallback((v?: VariantId) => {
    let variant: VariantId = v ?? "BASE"
    let f = NO_FAULTS
    try {
      const m = JSON.parse(window.localStorage.getItem(META_KEY) ?? "null")
      if (!v && m?.variant) variant = m.variant
      if (m?.faults) f = { ...NO_FAULTS, ...m.faults }
    } catch {
      /* ignore */
    }
    setFaults(f)
    faultsRef.current = f
    if (f.loadFail) {
      setLoadError(true)
      setReady(true)
      return
    }
    const loaded = readBiz(variant)
    const repaired = repairEligibility(loaded)
    const b = { ...repaired.biz, clock: demoClock.current ?? schoolNow(), schemes: { ...repaired.biz.schemes, taskOverrides: Object.fromEntries(Object.entries(repaired.biz.schemes.taskOverrides ?? {}).filter(([key]) => !key.endsWith("|CLASSROOM"))) } }
  delete (b as MtBiz & { regradeHistory?: unknown }).regradeHistory
  const upgradeWeek = weekOfDate(dateOfClock(b.clock))
  b.schemes.defaults = Object.fromEntries(Object.entries(b.schemes.defaults).map(([key, list]) => [key, key.endsWith("|CLASSROOM") ? list.filter(entry => entry.fromWeek <= upgradeWeek) : list]))
  if ((loaded as MtBiz & { regradeHistory?: unknown }).regradeHistory || Object.keys(loaded.schemes.taskOverrides ?? {}).some(key => key.endsWith("|CLASSROOM")) || Object.entries(loaded.schemes.defaults).some(([key, entries]) => key.endsWith("|CLASSROOM") && entries.some(entry => entry.fromWeek > upgradeWeek))) {
    try { window.localStorage.setItem(bizKey(b.variant), JSON.stringify(b)) } catch { /* 保留内存迁移，下次成功保存时持久化。 */ }
  }
    if (repaired.log) {
      try {
        window.localStorage.setItem(bizKey(b.variant), JSON.stringify(b))
      } catch {
        /* 写入失败时仅本次会话使用修复后的投影 */
      }
    }
    syncRevRegistry(b.schemes.revs)
    bizRef.current = b
    setBiz(b)
    setLoadError(false)
    setReady(true)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const tick = () => {
      if (demoClock.current || !ready) return
      const next = { ...bizRef.current, clock: schoolNow() }
      bizRef.current = next
      setBiz(next)
    }
    const timer = window.setInterval(tick, 1000)
    window.addEventListener("focus", tick)
    window.addEventListener("pageshow", tick)
    document.addEventListener("visibilitychange", tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", tick)
      window.removeEventListener("pageshow", tick)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [ready])

  /** 写入模拟存储；成功才更新内存状态 */
  const commitBiz = useCallback((next: MtBiz): string | null => {
    if (faultsRef.current.storageFail) return "模拟存储写入失败（故障注入）"
    try {
      const stored = JSON.parse(window.localStorage.getItem(bizKey(next.variant)) ?? 'null') as MtBiz | null
      if (stored && next.variant === bizRef.current.variant && stored.stamp > bizRef.current.stamp) return '其他页面已保存更新。请刷新读取最新内容后重试；本次未覆盖存储。'
      window.localStorage.setItem(bizKey(next.variant), JSON.stringify(next))
    } catch {
      return "浏览器存储不可用或已满"
    }
    syncRevRegistry(next.schemes.revs)
    bizRef.current = next
    setBiz(next)
    return null
  }, [])

  const dispatch = useCallback(
    (req: SaveReq) => {
      const seq = ++seqCounter.current
      latestSeq.current[req.field] = seq
      runners.current[req.field] = req
      setSaves((s) => ({
        ...s,
        [req.field]: { field: req.field, scope: req.scope, label: req.label, value: req.value, status: "saving", seq },
      }))
      const f = faultsRef.current
      let delay = f.delayMs
      if (f.slowNextMs > 0) {
        delay = f.slowNextMs
        const nf = { ...f, slowNextMs: 0 }
        faultsRef.current = nf
        setFaults(nf)
      }
      window.setTimeout(() => {
        // 同一字段已有更新的输入：旧响应直接丢弃，不覆盖
        if (latestSeq.current[req.field] !== seq) return
        const fail = (status: SaveStatus, error: string) =>
          setSaves((s) => (s[req.field]?.seq === seq ? { ...s, [req.field]: { ...s[req.field], status, error } } : s))
        if (faultsRef.current.saveFail) return fail("failed", "保存失败（故障注入）")
        const cur = bizRef.current
        if (req.taskId && cur.revoked.includes(req.taskId)) return fail("rejected", "已失去该任务权限，写入被拒绝")
        const out = req.run(cur)
        if ("error" in out) return fail(out.kind ?? "failed", out.error)
        const err = commitBiz({ ...out, stamp: cur.stamp + 1 })
        if (err) return fail("failed", err)
        setSaves((s) => (s[req.field]?.seq === seq ? { ...s, [req.field]: { ...s[req.field], status: "saved" } } : s))
      }, delay)
    },
    [commitBiz],
  )

  const value = useMemo<Ctx>(() => {
    const nowTs = Date.parse(biz.clock)
    const inScope = (e: SaveEntry, scope: string) => e.scope.includes(scope)
    return {
      ready,
      loadError,
      biz,
      faults,
      saves,
      nowTs,

      save: dispatch,
      retry: (field) => {
        const r = runners.current[field]
        if (r) dispatch(r)
      },
      retryScope: (scope) => {
        for (const e of Object.values(savesRef.current)) {
          if (inScope(e, scope) && e.status !== "saved" && e.status !== "saving") {
            const r = runners.current[e.field]
            if (r) dispatch(r)
          }
        }
      },
      discardScope: (scope) =>
        setSaves((s) => {
          const n = { ...s }
          for (const k of Object.keys(n)) if (inScope(n[k], scope) && n[k].status !== "saved") delete n[k]
          return n
        }),
      unsettled: (scope) => Object.values(saves).filter((e) => inScope(e, scope) && e.status !== "saved"),
      pendingValue: <T,>(field: string) => {
        const e = saves[field]
        if (!e || e.status === "saved") return { has: false, value: undefined as T | undefined, status: e?.status }
        return { has: true, value: e.value as T, status: e.status }
      },

      runRoutine: (token, plan, days, scopeLabel) => {
        const cur = bizRef.current
        const existing = cur.routineOps.find((o) => o.token === token)
        if (existing) return { ok: true, op: existing, written: 0 }
        if (plan.items.some(it => generationOf(cur, { kind: "CLASSROOM", taskId: it.taskId, week: weekOfDate(it.date) }) !== generationOf(biz, { kind: "CLASSROOM", taskId: it.taskId, week: weekOfDate(it.date) }))) return { ok: false, error: "评价代次已更换，请重新核对批量候选" }
        if (plan.items.some(it => cur.revoked.includes(it.taskId))) return { ok: false, error: "已失去任务权限" }
        if (!plan.items.length) return { ok: false, error: "没有符合常规条件的待处理目标，未写入任何记录" }
        const byKey = new Map(days.map((d) => [d.rec.key, d]))
        const records = { ...cur.records }
        const bindings = { ...cur.schemes.bindings }
        const entries: RoutineOp["entries"] = []
        const stamp = cur.stamp + 1
        for (const it of plan.items) {
          const d = byKey.get(it.key)
          if (!d) continue
          const before = records[it.key] ?? blankRec(it.taskId, it.date, it.studentId)
          // 发起后记录已变化（版本不一致）则不写，避免用过期范围执行
          if (before.revision !== d.rec.revision) continue
          if (it.writeGrade) {
            const bk = bindingKey(it.taskId, feedbackPeriodId(weekOfDate(it.date)))
            // 周期已固定另一修订（例如期间改了默认）：不写入，避免混用标准
            if (bindings[bk] && bindings[bk] !== it.revId) continue
            if (!revById(it.revId)?.levels.some((l) => l.id === it.gradeValue)) continue
            bindings[bk] = it.revId
          }
          const after = applyRoutineItem(before, it, d.elapsed.map((l) => l.id), stamp)
          // 写入后再判定：任何未出席课次都不能获得等级或覆盖
          if (it.writeGrade || it.extendGrade.length) {
            const e = dayEligibility(after, d.lessons, Date.parse(cur.clock))
            if (e.kind !== "ELIGIBLE") continue
            if (after.gradeCovered.some((id) => !e.attended.includes(id))) after.gradeCovered = after.gradeCovered.filter((id) => e.attended.includes(id))
          }
          records[it.key] = after
          entries.push({ key: it.key, before, afterRevision: after.revision })
        }
        const op: RoutineOp = {
          id: `OP_${cur.seq}`,
          token,
          at: cur.clock,
          scopeLabel,
          entries,
          skipped: plan.skipped.length,
          undone: false,
        }
        const err = commitBiz({ ...cur, records, schemes: { ...cur.schemes, bindings }, stamp, seq: cur.seq + 1, routineOps: [op, ...cur.routineOps].slice(0, 30) })
        if (err) return { ok: false, error: err }
        return { ok: true, op, written: entries.length }
      },

      undoRoutine: (opId) => {
        const cur = bizRef.current
        const op = cur.routineOps.find((o) => o.id === opId)
        if (!op) return { error: "找不到该操作" }
        if (op.undone) return op.undoResult ?? { restored: 0, kept: 0 }
        const records = { ...cur.records }
        let restored = 0
        let kept = 0
        const stamp = cur.stamp + 1
        for (const e of op.entries) {
          const now = records[e.key]
          if (now && now.revision === e.afterRevision) {
            records[e.key] = { ...e.before, revision: now.revision + 1, stamp, fieldRev: now.fieldRev }
            restored++
          } else kept++
        }
        const undoResult = { restored, kept }
        const err = commitBiz({
          ...cur,
          records,
          stamp,
          routineOps: cur.routineOps.map((o) => (o.id === opId ? { ...o, undone: true, undoResult } : o)),
        })
        if (err) return { error: err }
        return undoResult
      },

      command: (_label, run) => {
        const cur = bizRef.current
        const out = run(cur)
        if ("error" in out) return { ok: false, error: out.error }
        if (out === cur) return { ok: true }
        if (faultsRef.current.saveFail) return { ok: false, error: "保存失败（故障注入），数据未变" }
        const err = commitBiz({ ...out, stamp: cur.stamp + 1 })
        return err ? { ok: false, error: err } : { ok: true }
      },

      publish: (input) => {
        const cur = bizRef.current
        const dup = cur.publications.find((p) => p.idemKey === input.idemKey)
        if (dup) return { ok: true, pub: dup, reused: true }
        if (faultsRef.current.saveFail) return { ok: false, error: '保存失败（故障注入），输入已保留' }
        if (input.reports) {
          let persisted: MtBiz | null = null
          try { persisted = JSON.parse(window.localStorage.getItem(bizKey(cur.variant)) ?? 'null') } catch { return { ok: false, error: '无法核对存储版本，请重载后重试' } }
          if (input.sourceVersion !== sourceVersion(cur) || (persisted && sourceVersion(persisted) !== input.sourceVersion)) return { ok: false, error: '源内容已变化，请重新加载并核对预览' }
          if (!input.authorId || input.taskIds.some(id => !TASKS.some(t => t.id === id && (t.teacher_id === input.authorId || (cur.bigDemo && input.authorId === 'TEACHER_LYNN' && t.teacher_id === 'TEACHER_BIG_DEMO'))))) return { ok: false, error: '无权发布该教学范围' }
          if (input.reports.some(r => !validTemplate(r.template) || (!r.tables?.some(t => t.rows.length) && !r.blocks.some(b => b.key !== 'legend' && b.lines.length)))) return { ok: false, error: '报告内容为空或模板非法' }
        }
        if (input.taskIds.some((t) => cur.revoked.includes(t))) return { ok: false, error: "已失去任务权限，不能��布" }
        const prev = cur.publications.filter(
          (p) => p.periodId === input.periodId && p.taskIds.slice().sort().join() === input.taskIds.slice().sort().join(),
        )
        const pub: Publication = {
          ...input,
          id: `PUB_${input.taskIds.join("+")}_${input.periodId}_V${prev.length + 1}`,
          revision: prev.length + 1,
          publishedAt: cur.clock,
          stamp: cur.stamp + 1,
        }
        const err = commitBiz({ ...cur, publications: [...cur.publications, pub], stamp: cur.stamp + 1 })
        if (err) return { ok: false, error: err }
        // 故障注入：已写入，但响应丢失；重试以同一幂等键返回同一版本
        if (faultsRef.current.publishLost) {
          const nf = { ...faultsRef.current, publishLost: false }
          faultsRef.current = nf
          setFaults(nf)
          persistMeta(cur.variant, nf)
          return { ok: false, error: "发布响应丢失（故障注入）。请重试：同一提交不会生成重复版本。", lost: true }
        }
        return { ok: true, pub, reused: false }
      },

      setVariant: (v) => {
        persistMeta(v, faultsRef.current)
        setSaves({})
        load(v)
      },
      clockMode,
      resumeRealtime: () => {
        demoClock.current = null
        setClockMode("realtime")
        const next = { ...bizRef.current, clock: schoolNow() }
        bizRef.current = next
        setBiz(next)
      },
      setClock: (iso) => {
        const timestamp = Date.parse(iso)
        if (!Number.isFinite(timestamp)) return
        demoClock.current = schoolNow(timestamp)
        setClockMode("demo")
        const next = { ...bizRef.current, clock: demoClock.current }
        bizRef.current = next
        setBiz(next)
      },
      setFault: (patch) => {
        const nf = { ...faultsRef.current, ...patch }
        faultsRef.current = nf
        setFaults(nf)
        persistMeta(bizRef.current.variant, nf)
      },
      retryLoad: () => {
        const nf = { ...faultsRef.current, loadFail: false }
        persistMeta(bizRef.current.variant, nf)
        load(bizRef.current.variant)
      },
      resetVariant: () => {
        const v = bizRef.current.variant
        try {
          window.localStorage.removeItem(bizKey(v))
        } catch {
          /* ignore */
        }
        setSaves({})
        const b = freshBiz(v)
        commitBiz(b)
      },
      setBigDemo: (on) => {
        commitBiz({ ...bizRef.current, bigDemo: on })
      },
      toggleRevoke: (taskId) => {
        const cur = bizRef.current
        const revoked = cur.revoked.includes(taskId) ? cur.revoked.filter((t) => t !== taskId) : [...cur.revoked, taskId]
        commitBiz({ ...cur, revoked })
      },
      applyRosterEvent: (id) => {
        const cur = bizRef.current
        if (cur.rosterEvents.includes(id)) return
        const date = addDaysIso(cur.clock, 1).slice(0, 10)
        const ms = { ...cur.memberships }
        const list = [...(ms.TASK_MATH_G1_P1 ?? [])]
        if (id === "G1P1_JOIN_21") list.push({ studentId: "DEMO_STU_21", from: date, until: "2027-01-31" })
        else {
          const i = list.findIndex((m) => m.studentId === "DEMO_STU_12")
          if (i >= 0) list[i] = { ...list[i], until: dateOfClock(cur.clock) }
        }
        ms.TASK_MATH_G1_P1 = list
        commitBiz({ ...cur, memberships: ms, rosterEvents: [...cur.rosterEvents, id] })
      },
    }
  }, [ready, loadError, biz, faults, saves, dispatch, commitBiz, load, persistMeta, clockMode])

  return <MtContext.Provider value={value}>{children}</MtContext.Provider>
}

/** r4：课次来源版本。ScheduleBridge 提供；useMt 订阅它，使课表变化后所有「我的教学」视图同步重算。 */
export const ScheduleRevContext = createContext<unknown>(null)

export function useMt() {
  useContext(ScheduleRevContext)
  const c = useContext(MtContext)
  if (!c) throw new Error("useMt must be inside MtProvider")
  return c
}

/* ============================================================
 * 业务写入助手（全部走字段级保存；只写实际修改字段）
 * ========================================================== */

export function scopeTask(taskId: string) {
  return `task:${taskId}`
}
export function scopeStudent(taskId: string, week: number, sid: string) {
  return `stu:${taskId}|${week}|${sid}`
}
export function entryKey(taskId: string, week: number, sid?: string) {
  const p = `${taskId}|${feedbackPeriodId(week)}`
  return sid ? `${p}|${sid}` : p
}

type LessonAttT = Rec["att"][string]
const cleanReason = (t: string) => t.replace(/[\u0000-\u0008\u000b-\u001f<>]/g, "").slice(0, 200)

export const scopePhrases = (teacherId: string) => `phr:${teacherId}`

/** 常用内容写入：只改本人个人库，不触碰系统原文、他人库或任何已保存的学生记录 */
/** 教师个人偏好 / 批量候选 / 个人样式：只写当前教师的个人记录，不触碰排课版本与业务结果 */
export function usePrefWriters(teacherId: string | null) {
  const mt = useMt()
  return useMemo(() => {
    const write = (label: string, field: string, run: (s: MtBiz) => MtBiz | { error: string }) => {
      if (!teacherId) return
      mt.save({
        field: `pref:${teacherId}:${field}`,
        scope: [scopePrefs(teacherId)],
        label,
        value: field,
        run: (s) => {
          const r = run(s)
          if ("error" in r) return { error: r.error, kind: "rejected" as const }
          return r
        },
      })
    }
    return {
      setHwDays(n: number) {
        write("作业默认天数", `hwDays:${n}`, (s) => {
          if (!Number.isInteger(n) || n < 0 || n > HW_DAYS_MAX) return { error: `请输入 0–${HW_DAYS_MAX} 的整数` }
          const cur = s.teacherPrefs?.[teacherId!] ?? {}
          return { ...s, teacherPrefs: { ...(s.teacherPrefs ?? {}), [teacherId!]: { ...cur, hwDays: n } } }
        })
      },
      setPageSize(n: PageSize) {
        write("列表每页数量", `pageSize:${n}`, (s) => {
          if (!isPageSize(n)) return { error: "每页人数须为 1–200 的整数" }
          const cur = s.teacherPrefs?.[teacherId!] ?? {}
          return { ...s, teacherPrefs: { ...(s.teacherPrefs ?? {}), [teacherId!]: { ...cur, pageSize: n } } }
        })
      },
      setBatchCand(key: string, cand: BatchCand) {
        write("批量候选参数", `cand:${key}:${cand.submission ?? ""}:${cand.level ?? ""}`, (s) => ({
          ...s,
          batchCands: { ...(s.batchCands ?? {}), [`${teacherId}|${key}`]: cand },
        }))
      },
      setStyle(key: string, pref: StylePref | null) {
        return mt.command(pref ? "我的显示样式" : "恢复默认样式", (s) => {
          if (!teacherId || !key.startsWith(`${teacherId}|`)) return { error: "无权修改此偏好" }
          return { ...s, styles: saveStylePatch(s.styles ?? {}, key, pref) }
        })
      },
    }
  }, [mt, teacherId])
}

export function useTeacherPrefs(teacherId: string | null): Required<TeacherPrefs> {
  const mt = useMt()
  const p = teacherId ? mt.biz.teacherPrefs?.[teacherId] : undefined
  return { hwDays: p?.hwDays ?? 3, pageSize: p?.pageSize && isPageSize(p.pageSize) ? p.pageSize : 20 }
}

export function usePhraseWriters(teacherId: string | null) {
  const mt = useMt()
  return useMemo(() => {
    const write = (label: string, field: string, fn: (lib: PhraseLib, s: MtBiz) => PhraseLib | { error: string }) => {
      if (!teacherId) return
      mt.save({
        field: `phr:${teacherId}:${field}`,
        scope: [scopePhrases(teacherId)],
        label,
        value: field,
        run: (s) => {
          const r = fn(s.phrases[teacherId] ?? emptyLib(), s)
          if ("error" in r) return { error: r.error, kind: "rejected" as const }
          return { ...s, phrases: { ...s.phrases, [teacherId]: r }, seq: s.seq + 1 }
        },
      })
    }
    return {
      add(kind: PhraseKind, text: string, opts?: { states?: AttV[]; category?: string; fromSystemId?: string }) {
        const t = cleanPhrase(text)
        if (!t) return
        write("新增常用内容", `add:${kind}:${t}`, (lib, s) => {
          if (lib.items.some((p) => p.kind === kind && p.text === t && p.active)) return lib
          const item: PersonalPhrase = {
            id: `PP_${teacherId}_${s.seq}`,
            kind,
            text: t,
            system: false,
            ownerId: teacherId!,
            active: true,
            order: lib.items.length,
            ...(opts?.states?.length ? { states: opts.states } : {}),
            ...(opts?.category ? { category: opts.category } : {}),
            ...(opts?.fromSystemId ? { fromSystemId: opts.fromSystemId } : {}),
          }
          return { ...lib, items: [...lib.items, item] }
        })
      },
      edit(id: string, patch: { text?: string; states?: AttV[] }) {
        write("修改常用内容", `edit:${id}`, (lib) => {
          const t = patch.text !== undefined ? cleanPhrase(patch.text) : undefined
          if (t !== undefined && !t) return { error: "内容不能为空" }
          return { ...lib, items: lib.items.map((p) => (p.id === id ? { ...p, ...(t !== undefined ? { text: t } : {}), ...(patch.states ? { states: patch.states } : {}) } : p)) }
        })
      },
      setActive(id: string, active: boolean) {
        write(active ? "启用常用内容" : "停用常用内容", `act:${id}`, (lib) => ({ ...lib, items: lib.items.map((p) => (p.id === id ? { ...p, active } : p)) }))
      },
      remove(id: string) {
        write("删除常用内容", `del:${id}`, (lib) => ({ items: lib.items.filter((p) => p.id !== id), favs: lib.favs.filter((f) => f !== id) }))
      },
      toggleFav(id: string) {
        write("收藏常用内容", `fav:${id}`, (lib) => ({ ...lib, favs: lib.favs.includes(id) ? lib.favs.filter((f) => f !== id) : [...lib.favs, id] }))
      },
      move(id: string, dir: -1 | 1) {
        write("调整常用排序", `mv:${id}:${Date.now()}`, (lib) => {
          const kind = lib.items.find((p) => p.id === id)?.kind
          const same = lib.items.filter((p) => p.kind === kind).sort((a, b) => a.order - b.order)
          const i = same.findIndex((p) => p.id === id)
          const j = i + dir
          if (i < 0 || j < 0 || j >= same.length) return lib
          const oi = same[i].order
          const oj = same[j].order
          return { ...lib, items: lib.items.map((p) => (p.id === same[i].id ? { ...p, order: oj } : p.id === same[j].id ? { ...p, order: oi } : p)) }
        })
      },
    }
  }, [mt, teacherId])
}

function patchRec(s: MtBiz, key: string, base: Rec, fn: (r: Rec) => Rec, fieldNames: string[]): MtBiz {
  const cur = s.records[key] ?? base
  const next = fn({ ...cur, fieldRev: { ...cur.fieldRev } })
  for (const f of fieldNames) next.fieldRev[f] = (cur.fieldRev[f] ?? 0) + 1
  next.revision = cur.revision + 1
  next.stamp = s.stamp + 1
  return { ...s, records: { ...s.records, [key]: next } }
}

type LessonRef = { id: string; endTs: number }
/** 写入时自行解析当日真实课次（不信任调用方传入的范围）；课表未载入时退回已记录课次 */
function eligAt(s: MtBiz, key: string, taskId: string, date: string, fallback?: LessonRef[]): DayElig {
  const rec = s.records[key]
  let lessons: LessonRef[] = lessonsOfWeek(s.variant, weekOfDate(date), [taskId]).filter((l) => l.actual_date === date)
  if (!lessons.length) lessons = fallback?.length ? fallback : Object.keys(rec?.att ?? {}).map((id) => ({ id, endTs: 0 }))
  return dayEligibility(rec, lessons, Date.parse(s.clock))
}

/** 出勤变化后的同一原子写入：评价失效 / 覆盖核对 / 亮点失效，旧值留痕，不自动复活 */
function applyEligibility(prev: MtBiz, s: MtBiz, key: string, fallback: LessonRef[] | undefined, why: string): MtBiz {
  const r = s.records[key]
  if (!r) return s
  const before = eligAt(prev, key, r.taskId, r.date, fallback)
  const e = eligAt(s, key, r.taskId, r.date, fallback)
  const r2 = reconcileGrade(r, e, s.clock, why)
  let out = r2 === r ? s : { ...s, records: { ...s.records, [key]: { ...r2, fieldRev: { ...r2.fieldRev, grade: (r2.fieldRev.grade ?? 0) + 1 } } } }
  const hk = entryKey(r.taskId, weekOfDate(r.date), r.studentId)
  const items = out.highlights[hk]?.items
  if (items?.length) {
    let changed = false
    const next = items.map((h) => {
      if (h.void) return h
      if (h.date === r.date) {
        if (e.kind === "ABSENT" || (h.lessonId && e.absent.includes(h.lessonId))) {
          changed = true
          return { ...h, void: { at: s.clock, reason: why } }
        }
        return h
      }
      if (!h.date && !h.review && e.kind === "ABSENT" && before.kind !== "ABSENT") {
        changed = true
        return { ...h, review: true }
      }
      return h
    })
    if (changed) out = { ...out, highlights: { ...out.highlights, [hk]: { items: next, stamp: s.stamp + 1 } } }
  }
  return out
}

const rejected = (error: string) => ({ error, kind: "rejected" as const })

export function useRecordWriters() {
  const mt = useMt()
  return useMemo(
    () => ({
      setAttendance(d: StudentDay, week: number, lessonIds: string[], v: Attendance) {
        mt.save({
          field: `rec:${d.rec.key}:att:${lessonIds.join("+")}`,
          scope: [scopeTask(d.taskId), scopeStudent(d.taskId, week, d.studentId)],
          label: `${d.date} 出勤`,
          value: v,
          taskId: d.taskId,
          run: (s) =>
            applyEligibility(s, patchRec(
              s,
              d.rec.key,
              blankRec(d.taskId, d.date, d.studentId),
              (r) => {
                const att = { ...r.att }
                for (const l of lessonIds) {
                  // 同一状态保留原因；状态改变时原原因转为“原状态原因”保留可恢复，不冒充新状态的有效原因
                  const old = att[l]
                  if (old && old.v === v) {
                    att[l] = { ...old, origin: "EXPLICIT" }
                    continue
                  }
                  const prevReason = old?.reason ? { v: old.v, text: old.reason } : old?.prevReason
                  att[l] = { v, reason: "", origin: "EXPLICIT", ...(prevReason ? { prevReason } : {}) }
                }
                return { ...r, att }
              },
              lessonIds.map((l) => `att:${l}`),
            ), d.rec.key, d.lessons, `${d.date} 出勤确认为未出席`),
        })
      },
      setReason(d: StudentDay, week: number, lessonId: string, reason: string) {
        mt.save({
          field: `rec:${d.rec.key}:reason:${lessonId}`,
          scope: [scopeTask(d.taskId), scopeStudent(d.taskId, week, d.studentId)],
          label: `${d.date} 原因`,
          value: reason,
          taskId: d.taskId,
          run: (s) => {
            const r = s.records[d.rec.key]
            const a = r?.att[lessonId]
            if (!a || a.v === "NORMAL") return { error: "正常出勤不可填写异常原因" }
            const next: LessonAttT = { ...a, reason: cleanReason(reason) }
            delete next.prevReason
            return patchRec(s, d.rec.key, r, (x) => ({ ...x, att: { ...x.att, [lessonId]: next } }), [`reason:${lessonId}`])
          },
        })
      },
      applyLeave(d: StudentDay, week: number, leaveId: string, lessonIds: string[]) {
        mt.save({
          field: `rec:${d.rec.key}:leave`,
          scope: [scopeTask(d.taskId), scopeStudent(d.taskId, week, d.studentId)],
          label: `${d.date} 采用请假来源`,
          value: leaveId,
          taskId: d.taskId,
          run: (s) =>
            applyEligibility(s, patchRec(
              s,
              d.rec.key,
              blankRec(d.taskId, d.date, d.studentId),
              (r) => {
                const att = { ...r.att }
                for (const l of lessonIds) att[l] = { v: "LEAVE", reason: att[l]?.reason ?? "", origin: "APPROVED_LEAVE" }
                return { ...r, att, leaveSourceId: leaveId }
              },
              lessonIds.map((l) => `att:${l}`),
            ), d.rec.key, d.lessons, `${d.date} 采用请假来源，未出席`),
        })
      },
      /** value: 等级标识 | "EMPTY"（明确清空，不评价）；revId：界面呈现选项所用的对象标准 */
      setGrade(d: StudentDay, week: number, value: string, revId: string) {
        mt.save({
          field: `rec:${d.rec.key}:grade`,
          scope: [scopeTask(d.taskId), scopeStudent(d.taskId, week, d.studentId)],
          label: `${d.date} 课堂评价`,
          value,
          taskId: d.taskId,
          run: (s) => {
            const target = { kind: "CLASSROOM" as const, taskId: d.taskId, week }
            if (generationOf(s, target) !== generationOf(mt.biz, target)) return { error: "课堂评价方案已更换，旧输入已保留但未写入，请按新方案重新选择", kind: "conflict" as const }
            // 提交时按当前已保存出勤重新判定：页面状态过期、旧请求或直接调用都不能给未出席学生写评价
            if (!isMemberOn(s.memberships[d.taskId] ?? [], d.studentId, d.date)) return rejected("该学生当天不在本任务适用名单中")
            const e = eligAt(s, d.rec.key, d.taskId, d.date, d.lessons)
            if (e.kind !== "ELIGIBLE") return rejected(ELIG_REASON[e.kind])
            const covered = e.attended
            const bk = bindingKey(d.taskId, feedbackPeriodId(weekOfDate(d.date)))
            const bound = s.schemes.bindings[bk]
            if (bound && bound !== revId) return { error: "本周期评价标准已固定为另一修订，请刷新后重试", kind: "conflict" as const }
            if (value !== "EMPTY" && !revById(revId)?.levels.some((l) => l.id === value)) return { error: "所选等级不属于本周期标准", kind: "rejected" as const }
            const withBind = bound ? s : { ...s, schemes: { ...s.schemes, bindings: { ...s.schemes.bindings, [bk]: revId } } }
            return patchRec(
              withBind,
              d.rec.key,
              blankRec(d.taskId, d.date, d.studentId),
              (r) =>
                value === "EMPTY"
                  ? { ...r, grade: null, gradeHandling: "EXPLICIT_EMPTY", gradeOrigin: "EXPLICIT_EMPTY", gradeCovered: covered, coverageReview: false }
                  : { ...r, grade: value, gradeHandling: "CONFIRMED", gradeOrigin: "MANUAL", gradeCovered: covered, coverageReview: false },
              ["grade"],
            )
          },
        })
      },
      /** 覆盖核对：保留现有评价，确认其只覆盖当前确认参加的课次 */
      confirmCoverage(d: StudentDay, week: number) {
        mt.save({
          field: `rec:${d.rec.key}:grade`,
          scope: [scopeTask(d.taskId), scopeStudent(d.taskId, week, d.studentId)],
          label: `${d.date} 核对评价覆盖`,
          value: "COVERAGE",
          taskId: d.taskId,
          run: (s) => {
            const e = eligAt(s, d.rec.key, d.taskId, d.date, d.lessons)
            if (e.kind !== "ELIGIBLE") return rejected(ELIG_REASON[e.kind])
            const r = s.records[d.rec.key]
            if (!r || (r.gradeHandling !== "CONFIRMED" && r.gradeHandling !== "EXPLICIT_EMPTY")) return rejected("没有需要核对的评价")
            return patchRec(s, d.rec.key, r, (x) => ({ ...x, gradeCovered: [...e.attended], coverageReview: false }), ["grade"])
          },
        })
      },
      setNote(d: StudentDay, week: number, note: string) {
        mt.save({
          field: `rec:${d.rec.key}:note`,
          scope: [scopeTask(d.taskId), scopeStudent(d.taskId, week, d.studentId)],
          label: `${d.date} 内部课堂备注`,
          value: note,
          taskId: d.taskId,
          run: (s) => patchRec(s, d.rec.key, blankRec(d.taskId, d.date, d.studentId), (r) => ({ ...r, note }), ["note"]),
        })
      },
    }),
    [mt],
  )
}

export function useTextWriters() {
  const mt = useMt()
  return useMemo(
    () => ({
      setSummaryPart(taskId: string, week: number, part: 'teaching' | 'learning', text: string) {
        const k = entryKey(taskId, week)
        mt.save({ field: `sum:${k}:${part}`, scope: [scopeTask(taskId)], label: part === 'teaching' ? '教学介绍' : '学情总结', value: text, taskId,
          run: s => ({ ...s, summaries: { ...s.summaries, [k]: { ...s.summaries[k], text: s.summaries[k]?.text ?? '', [part]: text, stamp: s.stamp + 1 } } }),
        })
      },
      setSummary(taskId: string, week: number, text: string) {
        const k = entryKey(taskId, week)
        mt.save({
          field: `sum:${k}`,
          scope: [scopeTask(taskId)],
          label: "公共总结",
          value: text,
          taskId,
          run: (s) => ({ ...s, summaries: { ...s.summaries, [k]: { ...s.summaries[k], text, stamp: s.stamp + 1 } } }),
        })
      },
      setDaySummary(taskId: string, date: string, text: string) {
        const k = `${taskId}|${date}`
        mt.save({
          field: `dsum:${k}`,
          scope: [scopeTask(taskId)],
          label: `${date} 课堂小结`,
          value: text,
          taskId,
          run: (s) => ({ ...s, daySummaries: { ...s.daySummaries, [k]: { text, stamp: s.stamp + 1 } } }),
        })
      },
      /**
       * 课次参考观察：按实际课次稳定身份 + 作者（+ 学生）唯一，重复重试为覆盖而非新增；空文本即清除误填。
       * 只写 observations，不触碰 records / summaries / comments / publications / 排课。
       */
      setObservation(
        o: { lessonId: string; taskId: string; date: string; periodNo: number; endTs: number; authorId: string; studentId: string | null; allowedStudents: string[] },
        text: string,
      ) {
        const k = obsKey(o.lessonId, o.studentId)
        mt.save({
          field: `obs:${k}`,
          scope: [scopeObs(o.lessonId)],
          label: o.studentId ? "学生课次观察" : "本课教学观察",
          value: text,
          taskId: o.taskId,
          run: (s) => {
            if (Date.parse(s.clock) < o.endTs) return { error: "课堂尚未发生，不能记录课后观察", kind: "rejected" }
            if (o.studentId && !o.allowedStudents.includes(o.studentId)) return { error: "该生不在本次课的适用范围内", kind: "rejected" }
            const prev = s.observations[k]
            if (prev && prev.authorId !== o.authorId) return { error: "不能修改他人的观察", kind: "rejected" }
            const next = { ...s.observations }
            const t = text.trim()
            if (!t) delete next[k]
            else
              next[k] = {
                key: k,
                lessonId: o.lessonId,
                taskId: o.taskId,
                date: o.date,
                periodNo: o.periodNo,
                authorId: o.authorId,
                studentId: o.studentId,
                text,
                createdStamp: prev?.createdStamp ?? s.stamp + 1,
                stamp: s.stamp + 1,
              }
            return { ...s, observations: next }
          },
        })
      },
      setComment(taskId: string, week: number, sid: string, text: string) {
        const k = entryKey(taskId, week, sid)
        mt.save({
          field: `cmt:${k}`,
          scope: [scopeTask(taskId), scopeStudent(taskId, week, sid)],
          label: "个体评语",
          value: text,
          taskId,
          run: (s) => ({ ...s, comments: { ...s.comments, [k]: { text, stamp: s.stamp + 1 } } }),
        })
      },
      /**
       * 教师明确选择 / 输入后加入一条亮点。同一学生、任务、日期（周级为无日期）的同一文字视为同一次操作的重试或误双击，不重复创建；
       * 不同日期的同类行为可以再次记录。
       */
      addHighlight(
        taskId: string,
        week: number,
        sid: string,
        text: string,
        opts?: { date?: string; phraseId?: string; lessonId?: string; obsKey?: string },
      ) {
        const k = entryKey(taskId, week, sid)
        const clean = text.trim()
        if (!clean) return
        mt.save({
          field: `hl:${k}:add:${opts?.date ?? "W"}:${opts?.lessonId ?? ""}:${clean}`,
          scope: [scopeTask(taskId), scopeStudent(taskId, week, sid)],
          label: "新增亮点",
          value: clean,
          taskId,
          run: (s) => {
            if (opts?.date) {
              if (!isMemberOn(s.memberships[taskId] ?? [], sid, opts.date)) return rejected("该学生当天不在本任务适用名单中")
              const e = eligAt(s, `${taskId}|${opts.date}|${sid}`, taskId, opts.date)
              if (opts.lessonId) {
                const p = lessonParticipation(e, opts.lessonId)
                if (p !== "ATTENDED") return rejected(PARTICIPATION_REASON[p])
              } else if (e.kind !== "ELIGIBLE") return rejected(ELIG_REASON[e.kind])
            }
            const cur = s.highlights[k]?.items ?? []
            if (cur.some((h) => !h.void && h.text === clean && (h.date ?? null) === (opts?.date ?? null) && (h.lessonId ?? null) === (opts?.lessonId ?? null))) return s
            const item: Highlight = {
              id: `HL_${s.seq}`,
              text: clean,
              ...(opts?.date ? { date: opts.date } : {}),
              ...(opts?.phraseId ? { phraseId: opts.phraseId } : {}),
              ...(opts?.lessonId ? { lessonId: opts.lessonId } : {}),
              ...(opts?.obsKey ? { obsKey: opts.obsKey } : {}),
            }
            return {
              ...s,
              highlights: { ...s.highlights, [k]: { items: [...cur, item], stamp: s.stamp + 1 } },
              seq: s.seq + 1,
            }
          },
        })
      },
      editHighlight(taskId: string, week: number, sid: string, id: string, text: string | null) {
        const k = entryKey(taskId, week, sid)
        mt.save({
          field: `hl:${k}:${id}`,
          scope: [scopeTask(taskId), scopeStudent(taskId, week, sid)],
          label: text === null ? "删除亮点" : "修改亮点",
          value: text,
          taskId,
          run: (s) => {
            const cur = s.highlights[k]?.items ?? []
            if (text !== null) {
              const h = cur.find((x) => x.id === id)
              if (!h) return rejected("找不到该亮点")
              if (h.void) return rejected("已失效的亮点不能改写为��效亮点，请删除或在参加日重新添加")
              if (h.date) {
                const e = eligAt(s, `${taskId}|${h.date}|${sid}`, taskId, h.date)
                if (highlightStatus(h, e) !== "VALID") return rejected(ELIG_REASON[e.kind === "ELIGIBLE" ? "ABSENT" : e.kind])
              }
            }
            const items = text === null ? cur.filter((h) => h.id !== id) : cur.map((h) => (h.id === id ? { ...h, text } : h))
            return { ...s, highlights: { ...s.highlights, [k]: { items, stamp: s.stamp + 1 } } }
          },
        })
      },
      /** 待核对的旧亮点：教师关���到确认参加的日期后才重新计入 */
      linkHighlight(taskId: string, week: number, sid: string, id: string, date: string) {
        const k = entryKey(taskId, week, sid)
        mt.save({
          field: `hl:${k}:${id}:link`,
          scope: [scopeTask(taskId), scopeStudent(taskId, week, sid)],
          label: "关联亮点日期",
          value: date,
          taskId,
          run: (s) => {
            const e = eligAt(s, `${taskId}|${date}|${sid}`, taskId, date)
            if (e.kind !== "ELIGIBLE") return rejected(ELIG_REASON[e.kind])
            const cur = s.highlights[k]?.items ?? []
            const h = cur.find((x) => x.id === id)
            if (!h || h.void) return rejected("该亮点不可关联")
            const items = cur.map((x) => (x.id === id ? { ...x, date, review: false } : x))
            return { ...s, highlights: { ...s.highlights, [k]: { items, stamp: s.stamp + 1 } } }
          },
        })
      },
    }),
    [mt],
  )
}

export function useDisplayWriters() {
  const mt = useMt()
  return useMemo(
    () => ({
      setTaskPref(teacherId: string, taskId: string, pref: DisplayPref) {
        const k = prefKey(teacherId, taskId)
        mt.save({
          field: `pref:${k}`,
          scope: [scopeTask(taskId)],
          label: "任务默认自定义分工",
          value: pref,
          taskId,
          run: (s) => ({ ...s, taskPrefs: { ...s.taskPrefs, [k]: pref } }),
        })
      },
      setLessonOverride(teacherId: string, taskId: string, lessonId: string, pref: DisplayPref | null) {
        const k = prefKey(teacherId, lessonId)
        mt.save({
          field: `lov:${k}`,
          scope: [scopeTask(taskId)],
          label: pref ? "本课次自定义分工" : "恢复任务默认",
          value: pref,
          taskId,
          run: (s) => {
            const lessonOverrides = { ...s.lessonOverrides }
            if (pref) lessonOverrides[k] = pref
            else delete lessonOverrides[k]
            return { ...s, lessonOverrides }
          },
        })
      },
    }),
    [mt],
  )
}

export function useHomeworkWriters() {
  const mt = useMt()
  return useMemo(() => {
    const scopes = (a: Pick<Assignment, "id" | "taskId">, sid?: string) =>
      [scopeTask(a.taskId), `hw:${a.id}`, ...(sid ? [`hwstu:${a.taskId}|${sid}`] : [])]
    const patchA = (s: MtBiz, id: string, fn: (a: Assignment) => Assignment | { error: string }): MtBiz | { error: string; kind: "rejected" } => {
      const a = s.assignments.find((x) => x.id === id)
      if (!a) return { error: "作业不存在或已被删除", kind: "rejected" }
      const target = { kind: "HOMEWORK" as const, taskId: a.taskId, assignmentId: id }
      if (generationOf(s, target) !== generationOf(mt.biz, target)) return { error: "作业方案已更换，旧输入／批量已拒绝，请按新方案重试", kind: "rejected" }
      const n = fn(a)
      if ("error" in n) return { error: n.error, kind: "rejected" }
      return { ...s, assignments: s.assignments.map((x) => (x.id === id ? { ...n, revision: a.revision + 1, stamp: s.stamp + 1 } : x)) }
    }
    const logA = (a: Assignment, at: string, what: string) => [...(a.log ?? []), { at, what }].slice(-40)
    return {
      /** 单条结果写入：始终针对当前存储状态执行全部守卫 */
      setResult(a: Assignment, sid: string, patch: HwPatch, label: string) {
        mt.save({
          field: `hw:${a.id}:${sid}:${Object.keys(patch).join("+")}`,
          scope: scopes(a, sid),
          label,
          value: patch,
          taskId: a.taskId,
          run: (s) =>
            patchA(s, a.id, (x) => {
              const out = applyHwPatch(x, sid, patch, { nowTs: Date.parse(s.clock), at: s.clock })
              if ("error" in out) return out
              return { ...x, results: { ...x.results, [sid]: out.r } }
            }),
        })
      },
      setRequirement(a: Assignment, sid: string, req: Requirement, reason?: string) {
        mt.save({
          field: `hw:${a.id}:${sid}:req`,
          scope: scopes(a, sid),
          label: "作业要求",
          value: req,
          taskId: a.taskId,
          run: (s) =>
            patchA(s, a.id, (x) => {
              const out = applyHwPatch(x, sid, reason !== undefined ? { reason } : {}, { nowTs: Date.parse(s.clock), at: s.clock, requirement: req })
              if ("error" in out) return out
              return { ...x, requirementOverrides: { ...x.requirementOverrides, [sid]: req }, results: { ...x.results, [sid]: out.r } }
            }),
        })
      },
      setDeadline(a: Assignment, deadline: string | null) {
        mt.save({
          field: `hw:${a.id}:deadline`,
          scope: scopes(a),
          label: "截止时间",
          value: deadline,
          taskId: a.taskId,
          run: (s) => patchA(s, a.id, (x) => (lifecycleOf(x) === "WITHDRAWN" ? { error: "作业已撤回" } : { ...x, deadline, log: logA(x, s.clock, `截止改为 ${deadline ?? "无截止"}`) })),
        })
      },
      setScoreEnabled(a: Assignment, on: boolean) {
        mt.save({
          field: `hw:${a.id}:score`,
          scope: scopes(a),
          label: "分数设置",
          value: on,
          taskId: a.taskId,
          run: (s) => patchA(s, a.id, (x) => ({ ...x, scoreEnabled: on })),
        })
      },
      /** 生命周期：结束检查 / 恢复处理 / 撤回（均保留结果与历史） */
      setLifecycle(a: Assignment, status: HwLifecycle, what: string) {
        return mt.command(what, (s) =>
          patchA(s, a.id, (x) => {
            if (lifecycleOf(x) === "WITHDRAWN" && status !== "WITHDRAWN") return { error: "已撤回的作业不能恢复，请复制为新作业" }
            return { ...x, status, log: logA(x, s.clock, what) }
          }),
        )
      },
      /** 追加对象：按真实追加时点记录；截止已过时必须给出个别截止 */
      addRecipients(a: Assignment, sids: string[], extDeadline: string | null) {
        return mt.command("追加作业对象", (s) =>
          patchA(s, a.id, (x) => {
            if (lifecycleOf(x) !== "ACTIVE") return { error: "只有进行中的作业可以追加对象" }
            const add = sids.filter((id) => !x.recipients.includes(id))
            if (!add.length) return { error: "所选学生已在作业对象中" }
            const results = { ...x.results }
            const addedAt = { ...(x.addedAt ?? {}) }
            for (const id of add) {
              addedAt[id] = s.clock
              if (extDeadline) results[id] = { ...blankResult(), extDeadline }
            }
            return { ...x, recipients: [...x.recipients, ...add], results, addedAt, log: logA(x, s.clock, `追加对象 ${add.length} 人`) }
          }),
        )
      },
      /** 原子批量：提交时重新计划；与确认时预览不一致则拒绝，不按过期预览写入 */
      runBatch(token: string, aId: string, kind: BatchKind, opts: BatchOpts, subset: string[] | null, previewSids: string[]) {
        let result: { batch: HwBatch; reused: boolean } | null = null
        const r = mt.command(BATCH_LABEL[kind], (s) =>
          patchA(s, aId, (x) => {
            const dup = (x.batches ?? []).find((b) => b.token === token)
            if (dup) {
              result = { batch: dup, reused: true }
              return x
            }
            const nowTs = Date.parse(s.clock)
            const plan = planBatch(x, kind, opts, subset, nowTs)
            const sids = plan.writes.map((w) => w.sid).sort()
            if (sids.join() !== [...previewSids].sort().join()) return { error: "确认后范围���变化（有人修改或时间已推进），请重新核对后再执行" }
            if (!plan.writes.length) return { error: "没有符合条件的对象，未写入任何结果" }
            const results = { ...x.results }
            const entries: HwBatchEntry[] = []
            for (const w of plan.writes) {
              const before = results[w.sid] ?? blankResult()
              const out = applyHwPatch({ ...x, results }, w.sid, w.patch, { nowTs, at: s.clock, source: "BATCH" })
              if ("error" in out) return { error: `批量写入被拒绝：${out.error}` }
              for (const f of Object.keys(w.patch) as HwField[]) {
                entries.push({ sid: w.sid, field: f, before: (before as unknown as Record<string, unknown>)[f] ?? null, after: (out.r as unknown as Record<string, unknown>)[f], rev: out.r.rev?.[f] ?? 0 })
              }
              results[w.sid] = out.r
            }
            const batch: HwBatch = {
              id: `HB_${s.seq}`,
              generation: generationOf(s, { kind: "HOMEWORK", taskId: x.taskId, assignmentId: x.id }),
              token,
              kind,
              at: s.clock,
              label: BATCH_LABEL[kind],
              entries,
              skipped: plan.skipped,
            }
            result = { batch, reused: false }
            return { ...x, results, batches: [batch, ...(x.batches ?? [])].slice(0, 20) }
          }),
        )
        if (!r.ok) return r
        const out = result as { batch: HwBatch; reused: boolean } | null
        return out ? { ok: true as const, ...out } : { ok: false as const, error: "批量执行未完成" }
      },
      /** 安全撤销：只撤仍等于本次写入、且之后没有被改动的字段；保持资格不变量 */
      undoBatch(aId: string, batchId: string) {
        let res = { restored: 0, kept: 0 }
        const r = mt.command("撤销批量", (s) =>
          patchA(s, aId, (x) => {
            const b = (x.batches ?? []).find((y) => y.id === batchId)
            if (!b) return { error: "找不到该批量操作" }
            if ((b.generation ?? 0) !== generationOf(s, { kind: "HOMEWORK", taskId: x.taskId, assignmentId: x.id })) return { error: "该���量属于旧评价代次，不能撤销影响新结果" }
            if (b.undone) {
              res = b.undone
              return x
            }
            const results = { ...x.results }
            const order = [...b.entries].sort((p, q) => (p.field === "submission" ? 1 : 0) - (q.field === "submission" ? 1 : 0))
            for (const e of order) {
              const cur = results[e.sid]
              if (!cur || (cur.rev?.[e.field] ?? 0) !== e.rev) {
                res.kept++
                continue
              }
              const n: HwResult = { ...cur, rev: { ...(cur.rev ?? {}), [e.field]: e.rev + 1 } }
              ;(n as unknown as Record<string, unknown>)[e.field] = e.before
              if (e.field === "quality") n.qualitySource = undefined
              // 恢复为“未登记提交”时若仍有有效等级（后续人工写入），保留提交以免产生无提交的等级
              if (e.field === "submission" && !isSubmitted(n.submission) && (n.quality || n.noGrade || (n.score ?? null) !== null)) {
                res.kept++
                continue
              }
              if (e.field === "submission" && !e.before) n.submissionConfirmed = false
              results[e.sid] = n
              res.restored++
            }
            const undone = { ...res, at: s.clock }
            return { ...x, results, batches: (x.batches ?? []).map((y) => (y.id === batchId ? { ...y, undone } : y)) }
          }),
        )
        return r.ok ? { ok: true as const, ...res } : r
      },
      saveDraft(key: string, d: HwDraft | null) {
        return mt.command("作业草稿", (s) => {
          const drafts = { ...(s.hwDrafts ?? {}) }
          if (d) drafts[key] = { ...d, savedAt: s.clock }
          else delete drafts[key]
          return { ...s, hwDrafts: drafts }
        })
      },
    }
  }, [mt])
}

export function usePlanWriter() {
  const mt = useMt()
  return useCallback(
    (taskId: string, items: PlanItem[], action: string, state?: Plan["state"]) => {
      mt.save({
        field: `plan:${taskId}`,
        scope: [scopeTask(taskId)],
        label: `教学计划 · ${action}`,
        value: items,
        taskId,
        run: (s) => {
          const cur = s.plans[taskId] ?? { taskId, state: "DRAFT" as const, items: [], history: [], revision: 0 }
          return {
            ...s,
            plans: {
              ...s.plans,
              [taskId]: {
                ...cur,
                items,
                state: state ?? cur.state,
                revision: cur.revision + 1,
                history: [{ at: s.clock, action }, ...cur.history].slice(0, 20),
              },
            },
          }
        },
      })
    },
    [mt],
  )
}
