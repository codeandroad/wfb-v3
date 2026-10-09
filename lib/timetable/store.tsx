"use client"

// 课表中心共享模拟状态：驱动总览、发布、教师采用、个人差异、拖拽草稿、通知与校历。
// 所有编号/时间/状态由实际模拟动作计算；重置只清本原型状态。

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useDemo } from "@/lib/demo/store"
import { PERSONAS, type Persona } from "@/lib/demo/nav"
import {
  addDays,
  applyTemplateEdits,
  applyWeekEdits,
  BASELINE_TEMPLATES,
  DEFAULT_CLOCK,
  shanghaiNow,
  detectConflicts,
  diffTemplates,
  editAppliesToWeek,
  editLabel,
  fmtClock,
  projectWeek,
  SAMPLE_CHEN_CHANGE,
  SAMPLE_LIN_CHANGE,
  SAMPLE_ZHOU_OCT,
  TEACHER_SCHEDULES,
  TEACHERS,
  TERM_END,
  teacherById,
  weekStartOf,
  type Conflict,
  type DiffRow,
  type DisplayMode,
  type EditAction,
  type ProjectedEntry,
  type SlotEdit,
  type TemplateEntry,
} from "./data"

/* ---------------- 类型 ---------------- */

// 人物由全局 DemoProvider 统一持有，这里仅复用其类型。
export type { Persona }

export interface Release {
  seq: number
  id: string // SCH-2026T1-006
  note: string
  publishedAt: string // 发布成功时的模拟服务时钟
  effectiveDate: string
  changedTeachers: string[]
  templates: Record<string, TemplateEntry[]> // 本次变化教师的完整周模板
}

export interface PerRevision {
  perSeq: number
  effectiveFrom: string
  sourceSch: number
  personalCount: number
  appliedAt: string
}

// 编辑草稿会话（拖拽/弹窗多次修改累积，未应用；可撤销、放弃、保存、应用）
export interface DraftSession {
  scope: "once" | "range"
  effectiveDate: string // 固定区间生效日（区间开始）
  effectiveTo: string // 固定区间结束日（含）；界面要求有界，默认到学期结束日；未设置学期结束日则留空表示未设置到期日
  weekStart: string // 正在编辑的周
  edits: SlotEdit[]
  savedAt: string | null // 模拟保存时间；null=尚未保存
  active: boolean // true：正在编辑；false：已保存草稿（未应用），退出编辑态
}

export interface Adoption {
  teacherId: string
  revisions: PerRevision[]
  personalEdits: SlotEdit[] // 已应用的个人调整
  draft: DraftSession | null // 教师本人编辑会话
  confirmedDiff: boolean
  confirmedDiffSeq?: number // 已确认合法差异时所对标的学校发布 seq；出现更新的发布则重新醒目提示
  applyUndo?: ApplySnapshot[] // 可撤销的“确认应用”（每次应用前快照压栈）
  applyRedo?: ApplySnapshot[] // 可回退撤销的“确认应用”（每次撤销时的应用后快照压栈）
}

// 单次课卡编辑意图：改星期/节次/教室，或顺带重命名教学班 / 单元组
export interface EditPatch {
  action: EditAction
  weekday: number
  periodId: string
  room: string | null
  className?: string
  subject?: string
  group?: string
  note?: string
  noteShow?: boolean
  displayMode?: DisplayMode
  customLabel?: string
}

// “确认应用”前后的采用快照，支持撤销应用与回退撤销
export interface ApplySnapshot {
  personalEdits: SlotEdit[]
  revisions: PerRevision[]
  draft: DraftSession | null
  confirmedDiff: boolean
  confirmedDiffSeq?: number
  label: string
}

export interface SchoolDraft {
  teacherId: string
  baseSeq: number
  weekStart: string
  scope: "once" | "range"
  effectiveDate: string // 固定区间开始
  effectiveTo: string // 固定区间结束（含）
  edits: SlotEdit[]
  savedAt: string | null
  active: boolean // true：正在编辑；false：已保存草稿（未发布），退出编辑态
}

// 已撤销发布的快照，支持正向回退（重做），避免误点撤销
export interface PublishSnapshot {
  releases: Release[]
  adoptions: Record<string, Adoption>
  label: string
}

export interface Faults {
  teacherCurrentLoad: boolean // 教师当前读取失败
  notifyFail: boolean // 通知处理失败（发布仍成功）
  adoptFail: boolean // 采用失败
}

interface TTState {
  clock: string // 演示时钟 YYYY-MM-DDTHH:mm
  weekStart: string
  selectedTeacher: string
  releases: Release[]
  adoptions: Record<string, Adoption>
  schoolDrafts: Record<string, SchoolDraft> // 按教师分别保存，发布时统一合并为一个 SCH
  redoStack: PublishSnapshot[] // 被撤销发布的快照栈，支持正向回退
  notifRead: Record<string, boolean>
  faults: Faults
  lastCacheAt: string | null // 教师当前上次取数时间（用于失败缓存提示）
}

export interface EditResult {
  ok: boolean
  msg: string
  perSeq?: number
}

// 新增课次时携带的完整课节信息（新增与已有课卡编辑共用同一组字段）
export interface LessonCreateData {
  kind?: TemplateEntry["kind"]
  taskId?: string
  studentGroup?: string
  unitName?: string
  className: string
  subject: string
  group?: string
  room: string | null
  note?: string
  noteShow?: boolean
  displayMode?: DisplayMode
  customLabel?: string
}

/* ---------------- 初始种子 ---------------- */

function seedRelease006(): Release {
  return {
    seq: 6,
    id: schLabel(6),
    note: "学期初始基线课表",
    publishedAt: "2026-09-17T15:00",
    effectiveDate: "2026-09-21",
    changedTeachers: ["lin", "zhou", "chen", "shen", "wang", "li", "zhao"],
    templates: { ...BASELINE_TEMPLATES },
  }
}

function seedAdoption(teacherId: string): Adoption {
  return {
    teacherId,
    revisions: [
      { perSeq: 1, effectiveFrom: "2026-09-21", sourceSch: 6, personalCount: 0, appliedAt: "2026-09-17T15:20" },
    ],
    personalEdits: [],
    draft: null,
    confirmedDiff: false,
  }
}

const STORE_KEY = "tt-center-state-v10"

function loadState(): TTState {
  if (typeof window === "undefined") return freshState()
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY)
    if (!raw) return freshState()
    const stored = JSON.parse(raw) as TTState
    if (!stored || !Array.isArray(stored.releases) || !stored.adoptions || !stored.schoolDrafts) return freshState()
    // 基线发布（校版 v6）是代码中的种子，不应被会话快照冻结：否则示例数据更新后，
    // 完整课表仍显示旧模板，而「我的教学」按新任务读取得到 0 课次，两处课表不一致。
    const parsed: TTState = {
      ...stored,
      // 样例发布（校版 v7/v8）同理：其模板也来自代码种子，按版本号回填最新示例数据，避免课卡读到旧快照。
      releases: stored.releases.map((r) => {
        if (r.seq === 6) return { ...r, templates: { ...BASELINE_TEMPLATES } }
        const templates = { ...r.templates }
        for (const tid of Object.keys(templates)) {
          const seeded = TEACHER_SCHEDULES[tid]?.[r.seq]
          if (seeded) templates[tid] = seeded
        }
        return { ...r, templates }
      }),
    }
    // 会话中保存的时钟落后于真实时间时，推进到真实当前时间，避免已过期课次仍可编辑
    const now = shanghaiNow()
    if (!parsed.clock || parsed.clock < now) return { ...parsed, clock: now, weekStart: weekStartOf(now) }
    return parsed
  } catch {
    return freshState()
  }
}

function persistState(s: TTState) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(s))
  } catch {
    /* 忽略存储配额/隐私模式错误 */
  }
}

function clearPersisted() {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(STORE_KEY)
  } catch {
    /* 忽略 */
  }
}

function freshState(): TTState {
  return {
    clock: DEFAULT_CLOCK,
    weekStart: weekStartOf(DEFAULT_CLOCK),
    selectedTeacher: "lin",
    releases: [seedRelease006()],
    adoptions: {
      lin: seedAdoption("lin"),
      zhou: seedAdoption("zhou"),
      chen: seedAdoption("chen"),
      // 沈老师无账号：无采用记录
    },
    schoolDrafts: {},
    redoStack: [],
    notifRead: {},
    faults: { teacherCurrentLoad: false, notifyFail: false, adoptFail: false },
    lastCacheAt: null,
  }
}

/* ---------------- 派生只读计算（纯函数，读取 state） ---------------- */

export function latestSeq(s: TTState): number {
  return s.releases.reduce((m, r) => Math.max(m, r.seq), 0)
}

export function releaseBySeq(s: TTState, seq: number): Release | undefined {
  return s.releases.find((r) => r.seq === seq)
}

// 该教师“学校内容来源”序号：<= uptoSeq 且变化过该教师的最大发布
export function contentSource(s: TTState, teacherId: string, uptoSeq = latestSeq(s)): number {
  let best = 0
  for (const r of s.releases) {
    if (r.seq <= uptoSeq && r.changedTeachers.includes(teacherId) && r.seq > best) best = r.seq
  }
  return best || 6
}

// 该教师在某学校来源 seq 下的完整周模板（继承最近一次变化）
export function schoolTemplateFor(s: TTState, teacherId: string, seq: number): TemplateEntry[] {
  const src = contentSource(s, teacherId, seq)
  const rel = releaseBySeq(s, src)
  return rel?.templates[teacherId] ?? BASELINE_TEMPLATES[teacherId] ?? []
}

// 教师是否有尚未采用的相关新版
export function isPending(s: TTState, teacherId: string): boolean {
  const a = s.adoptions[teacherId]
  if (!a) return false
  const adoptedMax = a.revisions.reduce((m, r) => Math.max(m, r.sourceSch), 0)
  return contentSource(s, teacherId) > adoptedMax
}

export function applicableRevision(a: Adoption, date: string): PerRevision | null {
  let best: PerRevision | null = null
  for (const r of a.revisions) {
    if (r.effectiveFrom <= date) {
      if (!best || r.effectiveFrom >= best.effectiveFrom || r.perSeq > best.perSeq) best = r
    }
  }
  return best
}

export type TeacherCurrentStatus =
  | { kind: "ok"; template: TemplateEntry[]; rev: PerRevision; editedKeys: string[] }
  | { kind: "no_account" }
  | { kind: "no_personal" }
  | { kind: "load_error" }

// 教师当前使用课表（任务/教师共用同一份结果，按日期解析所在周）
export function teacherCurrent(s: TTState, teacherId: string, date: string): TeacherCurrentStatus {
  const teacher = TEACHERS.find((t) => t.id === teacherId)
  if (teacher && !teacher.hasAccount) return { kind: "no_account" }
  if (s.faults.teacherCurrentLoad) return { kind: "load_error" }
  const a = s.adoptions[teacherId]
  if (!a) return { kind: "no_personal" }
  const rev = applicableRevision(a, date)
  if (!rev) return { kind: "no_personal" }
  const base = schoolTemplateFor(s, teacherId, rev.sourceSch)
  const weekStart = weekStartOf(date)
  const { template, editedKeys } = applyWeekEdits(base, a.personalEdits, weekStart)
  return { kind: "ok", template, rev, editedKeys }
}

// 个人使用版编号（每位教师独立计数，含教师标识，便于区分）
export function perLabel(teacherId: string, perSeq: number): string {
  const name = teacherById(teacherId)?.name.replace("示例", "") ?? "个人"
  return `${name} v${perSeq}`
}

// 学校发布版编号（精简显示）
export function schLabel(seq: number): string {
  return `校版 v${seq}`
}

// 差异：学校最新适用内容 vs 教师当前使用内容（同一周解析）
export function diffFor(s: TTState, teacherId: string, date: string): { rows: DiffRow[]; schSeq: number } | null {
  const cur = teacherCurrent(s, teacherId, date)
  if (cur.kind !== "ok") return null
  const schSeq = contentSource(s, teacherId)
  const school = schoolTemplateFor(s, teacherId, schSeq)
  return { rows: diffTemplates(school, cur.template), schSeq }
}

/* ---------------- 冲突校验（落点合法性） ---------------- */

// 其他教师本周投影（用于教室/学生跨教师冲突）
function otherTeachersWeekEntries(s: TTState, weekStart: string, exceptId: string): ProjectedEntry[] {
  const out: ProjectedEntry[] = []
  for (const t of TEACHERS) {
    if (t.id === exceptId) continue
    const st = teacherCurrent(s, t.id, weekStart)
    if (st.kind !== "ok") continue
    out.push(...projectWeek(st.template, weekStart, t.id, "school"))
  }
  return out
}

// 校验某教师某周在应用一组编辑后，候选课次（candKey@candDate）是否产生硬冲突
function validateWeek(
  s: TTState,
  teacherId: string,
  weekStart: string,
  base: TemplateEntry[],
  edits: SlotEdit[],
  candKey: string,
  candDate: string,
  origin: ProjectedEntry["origin"],
): Conflict | null {
  const { template } = applyWeekEdits(base, edits, weekStart)
  const mine = projectWeek(template, weekStart, teacherId, origin)
  const others = otherTeachersWeekEntries(s, weekStart, teacherId)
  const conflicts = detectConflicts([...mine, ...others])
  return (
    conflicts.find(
      (c) =>
        (c.a.teacherId === teacherId && c.a.key === candKey && c.a.date === candDate) ||
        (c.b.teacherId === teacherId && c.b.key === candKey && c.b.date === candDate),
    ) ?? null
  )
}

/* ---------------- 导入批量写入（预检 + 提交共用） ---------------- */

export interface ImportDraftItem {
  sourceId: string
  weekday: number
  periodId: string
  date: string
  data: LessonCreateData
}

export interface ImportDraftRange {
  scope: "once" | "range"
  weekStart: string
  effectiveDate: string
  effectiveTo: string
}

export interface ImportDraftPlan {
  added: string[] // 将新增的 sourceId
  unchanged: string[] // 课表中已有相同安排，跳过
  conflicts: { sourceId: string; reason: string }[] // 与现有课次 / 他人资源冲突，跳过（不静默覆盖）
}

const sameName = (a: string, b: string) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "")

function planImport(
  s: TTState,
  teacherId: string,
  items: ImportDraftItem[],
  range: ImportDraftRange,
): { plan: ImportDraftPlan; edits: SlotEdit[] } {
  const plan: ImportDraftPlan = { added: [], unchanged: [], conflicts: [] }
  const a = s.adoptions[teacherId]
  if (!a) {
    for (const it of items) plan.conflicts.push({ sourceId: it.sourceId, reason: "尚无个人课表，请先采用学校课表" })
    return { plan, edits: [] }
  }
  const rev = applicableRevision(a, range.weekStart)
  const base = schoolTemplateFor(s, teacherId, rev ? rev.sourceSch : contentSource(s, teacherId))
  const pending = [...a.personalEdits, ...(a.draft?.edits ?? [])]
  const { template: current } = applyWeekEdits(base, pending, range.weekStart)
  const edits: SlotEdit[] = []
  const stamp = Date.now().toString(36)
  items.forEach((it, i) => {
    const existing = current.find((e) => e.weekday === it.weekday && e.periodId === it.periodId)
    if (existing && sameName(existing.className, it.data.className) && (existing.group ?? "") === (it.data.group ?? "")) {
      plan.unchanged.push(it.sourceId)
      return
    }
    if (existing) {
      plan.conflicts.push({ sourceId: it.sourceId, reason: `该时段已有「${occLabel2(existing)}」，未覆盖` })
      return
    }
    const key = `imp-${stamp}-${i}`
    const edit: SlotEdit = {
      id: `e${stamp}${i}`,
      key,
      action: "add",
      weekday: it.weekday,
      periodId: it.periodId,
      room: it.data.room,
      scope: range.scope,
      onDate: it.date,
      effectiveDate: range.effectiveDate,
      effectiveTo: range.effectiveTo,
      label: editLabel({ className: it.data.className, group: it.data.group }, "add", it.weekday, it.periodId, it.data.room),
      className: it.data.className,
      subject: it.data.subject,
      group: it.data.group,
      note: it.data.note || undefined,
      noteShow: it.data.noteShow,
    }
    const conflict = validateWeek(s, teacherId, range.weekStart, base, [...pending, ...edits, edit], key, it.date, "personal")
    if (conflict) {
      plan.conflicts.push({ sourceId: it.sourceId, reason: conflict.reason })
      return
    }
    edits.push(edit)
    plan.added.push(it.sourceId)
  })
  return { plan, edits }
}

function occLabel2(e: TemplateEntry): string {
  return [e.className, e.group].filter(Boolean).join(" ") || e.subject || "已有课次"
}

// 目标格现有课次的简称（用于覆盖确认弹窗）
function occLabel(e: ProjectedEntry): string {
  return [e.className, e.group].filter(Boolean).join(" ") || e.subject || "已有课次"
}

// 从冲突中挑出“被移动课次以外、且属于本人”的占用课次（可强制覆盖）；跨教师资源冲突返回 null
function pickOccupant(conflict: Conflict, movingKey: string, teacherId: string): ProjectedEntry | null {
  const cand = conflict.a.key !== movingKey ? conflict.a : conflict.b
  return cand.key !== movingKey && cand.teacherId === teacherId ? cand : null
}

/* ---------------- 编辑草稿投影（含未应用草稿） ---------------- */

export function teacherDraftWeekEntries(
  s: TTState,
  teacherId: string,
  weekStart: string,
): { entries: ProjectedEntry[]; draftKeys: Set<string> } {
  const a = s.adoptions[teacherId]
  const rev = a ? applicableRevision(a, weekStart) : null
  const baseSeq = rev ? rev.sourceSch : contentSource(s, teacherId)
  const base = schoolTemplateFor(s, teacherId, baseSeq)
  const applied = a?.personalEdits ?? []
  const draftEdits = a?.draft?.edits ?? []
  const { template, editedKeys } = applyWeekEdits(base, [...applied, ...draftEdits], weekStart)
  const draftKeys = new Set(draftEdits.filter((e) => editAppliesToWeek(e, weekStart)).map((e) => e.key))
  const entries = projectWeek(template, weekStart, teacherId, "personal").map((e) => ({
    ...e,
    origin: editedKeys.includes(e.key) ? ("personal" as const) : ("school" as const),
  }))
  return { entries, draftKeys }
}

export function schoolDraftWeekEntries(
  s: TTState,
  teacherId: string,
  weekStart: string,
  baseSeq: number,
): { entries: ProjectedEntry[]; draftKeys: Set<string> } {
  const base = schoolTemplateFor(s, teacherId, baseSeq)
  const edits = s.schoolDrafts[teacherId]?.edits ?? []
  const { template } = applyWeekEdits(base, edits, weekStart)
  const draftKeys = new Set(edits.filter((e) => editAppliesToWeek(e, weekStart)).map((e) => e.key))
  const entries = projectWeek(template, weekStart, teacherId, "school")
  return { entries, draftKeys }
}

/* ---------------- Context ---------------- */

interface TTContext extends TTState {
  hydrated: boolean
  persona: Persona // 由全局 DemoProvider 提供（只读）
  setWeekStart: (w: string) => void
  setSelectedTeacher: (id: string) => void
  advanceClockTo: (date: string) => void
  toggleFault: (k: keyof Faults) => void
  reset: () => void

  publishSample: (target: "lin" | "chen" | "zhouOct") => Release | null
  undoLastPublish: () => { ok: boolean; msg: string }
  redoLastPublish: () => { ok: boolean; msg: string }
  oneClickUpdate: (teacherId: string) => EditResult
  confirmFutureAdopt: (teacherId: string) => EditResult
  confirmDiff: (teacherId: string) => void
  markNotifRead: (teacherId: string) => void
  refreshCache: () => void

  // 教师本人编辑会话
  beginDraft: (teacherId: string) => void
  setDraftScope: (teacherId: string, scope: "once" | "range", effectiveDate?: string, effectiveTo?: string) => void
  draftEdit: (teacherId: string, entry: ProjectedEntry, patch: EditPatch) => EditResult
  undoDraft: (teacherId: string) => void
  discardDraft: (teacherId: string) => void
  saveDraft: (teacherId: string) => void
  applyDraft: (teacherId: string) => EditResult
  undoApply: (teacherId: string) => EditResult // 撤销上一次“确认应用”
  redoApply: (teacherId: string) => EditResult // 回退撤销（重新应用）
  resetToSchool: (teacherId: string) => EditResult // 放弃个人调整，回到学校最新课表（可撤销）
  draftAdd: (
    teacherId: string,
    cell: { weekday: number; periodId: string; date: string },
    data: LessonCreateData,
  ) => EditResult
  // 导入：批量写入个人草稿。plan 只做预检（不改状态），commit 写入“新增”项并跳过“已存在 / 冲突”项
  planDraftImport: (teacherId: string, items: ImportDraftItem[], range: ImportDraftRange) => ImportDraftPlan
  draftImport: (teacherId: string, items: ImportDraftItem[], range: ImportDraftRange) => ImportDraftPlan

  // 教务学校草稿会话
  beginSchoolDraft: (teacherId: string, weekStart: string) => void
  setSchoolDraftScope: (teacherId: string, scope: "once" | "range", effectiveDate?: string, effectiveTo?: string) => void
  schoolDraftEdit: (teacherId: string, entry: ProjectedEntry, patch: EditPatch) => EditResult
  undoSchoolDraft: (teacherId: string) => void
  discardSchoolDraft: (teacherId: string) => void
  discardAllSchoolDrafts: () => void
  saveSchoolDraft: (teacherId: string) => void
  schoolDraftAdd: (
    teacherId: string,
    cell: { weekday: number; periodId: string; date: string },
    data: LessonCreateData,
  ) => EditResult
  // 统一发布所有有改动的教师草稿，合并为一个 SCH
  publishSchoolDrafts: (note?: string) => { ok: boolean; msg: string; release?: Release }
}

const Ctx = createContext<TTContext | null>(null)

function newSlotEdit(
  entry: ProjectedEntry,
  patch: EditPatch,
  scope: "once" | "range",
  effectiveDate: string,
  effectiveTo: string,
): SlotEdit {
  const className = patch.className ?? undefined
  const subject = patch.subject ?? undefined
  const group = patch.group ?? undefined
  return {
    id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    key: entry.key,
    action: patch.action,
    weekday: patch.weekday,
    periodId: patch.periodId,
    room: patch.room,
    scope,
    onDate: entry.date,
    effectiveDate,
    effectiveTo,
    label: editLabel(
      { className: className ?? entry.className, group: group ?? entry.group },
      patch.action,
      patch.weekday,
      patch.periodId,
      patch.room,
    ),
    className,
    subject,
    group,
    note: patch.note,
    noteShow: patch.noteShow,
    displayMode: patch.displayMode,
    customLabel: patch.customLabel,
  }
}

/**
 * r4：clock 由全应用共用的演示时钟（「我的教学」MtProvider）传入；不再各页读取真实时间自造一份。
 * onClockChange 把课表内的“推进时钟”操作回写到同一时钟源。
 */
export function TimetableProvider({
  children,
  clock,
  onClockChange,
}: {
  children: ReactNode
  clock?: string
  onClockChange?: (clock: string) => void
}) {
  const { persona } = useDemo()
  const [state, setState] = useState<TTState>(() => (clock ? { ...freshState(), clock, weekStart: weekStartOf(clock) } : freshState()))
  const [hydrated, setHydrated] = useState(false)
  const clockRef = useRef(clock)
  clockRef.current = clock
  const onClockRef = useRef(onClockChange)
  onClockRef.current = onClockChange

  useEffect(() => {
    if (!clock) return
    setState((s) => (s.clock === clock ? s : { ...s, clock }))
  }, [clock])

  // 人物切换时：教师视角默认聚焦本人课表；教务视角保留当前所选教师。
  useEffect(() => {
    if (persona !== "admin")
      setState((s) => ({ ...s, selectedTeacher: PERSONAS[persona].teacherId ?? s.selectedTeacher }))
  }, [persona])

  useEffect(() => {
    const loaded = loadState()
    const c = clockRef.current
    setState(c ? { ...loaded, clock: c } : loaded)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) persistState(state)
  }, [state, hydrated])

  const nextPerSeq = useCallback((a: Adoption) => a.revisions.reduce((m, r) => Math.max(m, r.perSeq), 0) + 1, [])

  const value = useMemo<TTContext>((): TTContext => {
  // 通用校验：已记录/锁定的历史课次为只读；已过去的课次不可修改。
  // 本地对“未来合法课次”开放编排；“与教务处对齐才生效”是确认应用/发布这一单独步骤。
  function guardEntry(entry: ProjectedEntry, patch: { action: EditAction; weekday: number; periodId: string }): string | null {
    if (entry.kind === "history" || entry.locked) return "该课次已记录/锁定，为只读；更正需通过受控的后续修订"
    const today = state.clock.slice(0, 10)
    if (entry.date < today) return "已过去的课次不可修改"
    if (patch.action === "move") {
      if (patch.weekday === entry.weekday && patch.periodId === entry.periodId) return "未改变位置"
    }
      return null
    }

    // 落点是否与学校基线完全一致（星期/节次/教室 + 名称都相同）——用于“拖回原位=撤销”的判定。
    // 若本次编辑携带了改名（教学班名 / 单元组名与基线不同），则不视为撤销，保留为修改。
    function matchesBase(base: TemplateEntry[], key: string, patch: EditPatch): boolean {
      if (patch.action !== "move" && patch.action !== "room") return false
      const b = base.find((e) => e.key === key)
      if (!b) return false
      const posSame = b.weekday === patch.weekday && b.periodId === patch.periodId && (b.room ?? null) === (patch.room ?? null)
  const nameSame =
  (patch.className === undefined || patch.className === b.className) &&
  (patch.group === undefined || (patch.group || undefined) === (b.group || undefined))
  // 信息区（备注 / 显示开关 / 显示模式 / 自定义标签）也须与基线一致，
  // 否则“仅改信息、未移动位置”的编辑会被误判为回到原位而被丢弃。
  const infoSame =
  (patch.note === undefined || (patch.note || undefined) === (b.note || undefined)) &&
  // 备注显示开关默认开启（undefined 视为显示），与弹窗初始化口径一致
  (patch.noteShow === undefined || (patch.noteShow !== false) === (b.noteShow !== false)) &&
  (patch.displayMode === undefined || (patch.displayMode ?? "SHARED") === (b.displayMode ?? "SHARED")) &&
  (patch.customLabel === undefined || (patch.customLabel || undefined) === (b.customLabel || undefined))
  return posSame && nameSame && infoSame
  }

    const api: TTContext = {
      ...state,
      persona,
      hydrated,
      setWeekStart: (weekStart) => setState((s) => ({ ...s, weekStart })),
      setSelectedTeacher: (selectedTeacher) => setState((s) => ({ ...s, selectedTeacher })),
      advanceClockTo: (date) => {
        if (onClockRef.current) onClockRef.current(`${date}T14:30`)
        setState((s) => ({ ...s, clock: `${date}T14:30`, weekStart: weekStartOf(date) }))
      },
      toggleFault: (k) => setState((s) => ({ ...s, faults: { ...s.faults, [k]: !s.faults[k] } })),
      reset: () => {
        clearPersisted()
        setState(freshState())
      },

      publishSample: (target) => {
        let created: Release | null = null
        setState((s) => {
          const seq = latestSeq(s) + 1
          const now = s.clock
          let rel: Release
          if (target === "lin") {
            rel = {
              seq, id: schLabel(seq), note: "调整林老师课表（周五 M1 节次 + 周一教室）",
              publishedAt: now, effectiveDate: "2026-09-28", changedTeachers: ["lin"],
              templates: { lin: SAMPLE_LIN_CHANGE },
            }
          } else if (target === "chen") {
            rel = {
              seq, id: schLabel(seq), note: "调整陈老师课表（周四节次）",
              publishedAt: now, effectiveDate: "2026-09-28", changedTeachers: ["chen"],
              templates: { chen: SAMPLE_CHEN_CHANGE },
            }
          } else {
            rel = {
              seq, id: schLabel(seq), note: "周老师新增实验课（10月起生效）",
              publishedAt: now, effectiveDate: "2026-10-05", changedTeachers: ["zhou"],
              templates: { zhou: SAMPLE_ZHOU_OCT },
            }
          }
          created = rel
          return { ...s, releases: [...s.releases, rel], redoStack: [] }
        })
        return created
      },

      // 撤销最近一次发布：移除最高 seq 的发布，并回滚引用它（或更晚）的教师采用修订。
      // 保留初始基线 SCH-006 与教师个人调整；线下未落实的发布可倒回重新编排。
      undoLastPublish: () => {
        const s = state
        const maxSeq = latestSeq(s)
        if (maxSeq <= 6) return { ok: false, msg: "仅剩初始基线课表，无可撤销的发布" }
        const rel = releaseBySeq(s, maxSeq)
        const label = rel?.id ?? schLabel(maxSeq)
        setState((st) => {
          // 撤销前快照压入重做栈，支持正向回退避免误点
          const snapshot: PublishSnapshot = { releases: st.releases, adoptions: st.adoptions, label }
          const releases = st.releases.filter((r) => r.seq !== maxSeq)
          const adoptions: Record<string, Adoption> = {}
          for (const tid of Object.keys(st.adoptions)) {
            const a = st.adoptions[tid]
            // 丢弃引用被撤销发布（或更晚）的采用修订；至少保留最早的基线修订
            let revisions = a.revisions.filter((r) => r.sourceSch < maxSeq)
            if (revisions.length === 0) revisions = a.revisions.slice(0, 1)
            adoptions[tid] = { ...a, revisions, confirmedDiff: false }
          }
          return { ...st, releases, adoptions, redoStack: [...st.redoStack, snapshot] }
        })
        return { ok: true, msg: `已撤销最近发布 ${label}，相关教师回到上一版本（可正向回退）` }
      },

      // 正向回退：恢复最近一次被撤销的发布快照
      redoLastPublish: () => {
        const s = state
        if (s.redoStack.length === 0) return { ok: false, msg: "没有可回退的撤销操作" }
        const snapshot = s.redoStack[s.redoStack.length - 1]
        setState((st) => ({
          ...st,
          releases: snapshot.releases,
          adoptions: snapshot.adoptions,
          redoStack: st.redoStack.slice(0, -1),
        }))
        return { ok: true, msg: `已回退撤销，恢复发布 ${snapshot.label}` }
      },

      oneClickUpdate: (teacherId) => {
        const s = state
        const teacher = TEACHERS.find((t) => t.id === teacherId)
        if (teacher && !teacher.hasAccount) return { ok: false, msg: "该教师无账号，无法送达/采用" }
        if (s.faults.adoptFail) return { ok: false, msg: "采用失败：保留原使用版，可重试" }
        const src = contentSource(s, teacherId)
        const a = s.adoptions[teacherId]
        if (!a) return { ok: false, msg: "无采用记录" }
        const adoptedMax = a.revisions.reduce((m, r) => Math.max(m, r.sourceSch), 0)
        if (src <= adoptedMax) return { ok: false, msg: "已是本人最新课表，无需更新" }
        const rel = releaseBySeq(s, src)!
        const per = nextPerSeq(a)
        setState((st) => {
          const aa = st.adoptions[teacherId]
          const revision: PerRevision = {
            perSeq: per, effectiveFrom: rel.effectiveDate, sourceSch: src,
            personalCount: aa.personalEdits.length, appliedAt: st.clock,
          }
          return {
            ...st,
            adoptions: { ...st.adoptions, [teacherId]: { ...aa, revisions: [...aa.revisions, revision], confirmedDiff: false } },
            notifRead: { ...st.notifRead, [teacherId]: true },
          }
        })
        return { ok: true, perSeq: per, msg: `已采用 ${rel.id}，${rel.effectiveDate} 起生效` }
      },

      confirmFutureAdopt: (teacherId) => api.oneClickUpdate(teacherId),

      confirmDiff: (teacherId) =>
        setState((s) => ({ ...s, adoptions: { ...s.adoptions, [teacherId]: { ...s.adoptions[teacherId], confirmedDiff: true, confirmedDiffSeq: contentSource(s, teacherId) } } })),

      markNotifRead: (teacherId) => setState((s) => ({ ...s, notifRead: { ...s.notifRead, [teacherId]: true } })),

      refreshCache: () => setState((s) => ({ ...s, lastCacheAt: fmtClock(s.clock) })),

      /* -------- 教师本人编辑会话 -------- */

      beginDraft: (teacherId) =>
        setState((s) => {
          const a = s.adoptions[teacherId]
          if (!a) return s
          // 已有草稿（含已保存待应用）：恢复为编辑态
          // 并跳转到最近一次有修改的周次（edits 按修改先后追加，末项即最近修改）
          if (a.draft) {
            const last = a.draft.edits[a.draft.edits.length - 1]
            const lastDate = last ? last.onDate || last.effectiveDate : undefined
            const weekStart = lastDate ? weekStartOf(lastDate) : a.draft.weekStart || s.weekStart
            return { ...s, weekStart, adoptions: { ...s.adoptions, [teacherId]: { ...a, draft: { ...a.draft, active: true } } } }
          }
          const draft: DraftSession = { scope: "range", effectiveDate: s.weekStart, effectiveTo: TERM_END ?? "", weekStart: s.weekStart, edits: [], savedAt: null, active: true }
          return { ...s, adoptions: { ...s.adoptions, [teacherId]: { ...a, draft } } }
        }),

      setDraftScope: (teacherId, scope, effectiveDate, effectiveTo) =>
        setState((s) => {
          const a = s.adoptions[teacherId]
          if (!a?.draft) return s
          return {
            ...s,
            adoptions: {
              ...s.adoptions,
              [teacherId]: {
                ...a,
                draft: {
                  ...a.draft,
                  scope,
                  effectiveDate: effectiveDate ?? a.draft.effectiveDate,
                  effectiveTo: effectiveTo ?? a.draft.effectiveTo,
                },
              },
            },
          }
        }),

      draftEdit: (teacherId, entry, patch) => {
        const s = state
        const a = s.adoptions[teacherId]
        if (!a) return { ok: false, msg: "无个人课表" }
        const session = a.draft ?? { scope: "range" as const, effectiveDate: s.weekStart, effectiveTo: TERM_END ?? "", weekStart: s.weekStart, edits: [], savedAt: null, active: true }
        // 若正在编辑的是本轮尚未应用的“新增课次”，直接就地更新/移除该 add 编辑
        const existingAdd = session.edits.find((e) => e.key === entry.key && e.action === "add")
        if (patch.action === "remove" && existingAdd) {
          setState((st) => {
            const aa = st.adoptions[teacherId]
            const cur = aa.draft ?? session
            return { ...st, adoptions: { ...st.adoptions, [teacherId]: { ...aa, draft: { ...cur, edits: cur.edits.filter((e) => e.key !== entry.key), savedAt: st.clock } } } }
          })
          return { ok: true, msg: "已移除新增课次（未应用）" }
        }
        const guard = guardEntry(entry, patch)
        if (guard) return { ok: false, msg: guard }
        // 调休补课日的课次：仅对该补课日单次生效（键为补课镜像键），不影响来源日与其他周
        if (entry.makeupFrom) {
          const edit: SlotEdit = { ...newSlotEdit(entry, patch, "once", entry.date, entry.date), onDate: entry.date }
          setState((st) => {
            const aa = st.adoptions[teacherId]
            const cur = aa.draft ?? session
            const edits = [...cur.edits.filter((e) => e.key !== edit.key), edit]
            return { ...st, adoptions: { ...st.adoptions, [teacherId]: { ...aa, draft: { ...cur, edits, savedAt: st.clock } } } }
          })
          return { ok: true, msg: patch.action === "remove" ? "已在草稿中删除该补课课次（未应用）" : "已更新补课日草稿（仅本次，未应用）" }
        }
        const weekStart = session.weekStart
        // 拖回原位：落点与学校基线一致，且该键无已应用的个人调整时，撤销本轮编辑，恢复为学校来源（不再显示琥珀色）。
        if (!existingAdd && !a.personalEdits.some((e) => e.key === entry.key)) {
          const rev0 = applicableRevision(a, weekStart)
          const base0 = schoolTemplateFor(s, teacherId, rev0 ? rev0.sourceSch : contentSource(s, teacherId))
          if (matchesBase(base0, entry.key, patch)) {
            setState((st) => {
              const aa = st.adoptions[teacherId]
              const cur = aa.draft ?? session
              const edits = cur.edits.filter((e) => e.key !== entry.key)
              return { ...st, adoptions: { ...st.adoptions, [teacherId]: { ...aa, draft: { ...cur, edits, savedAt: st.clock } } } }
            })
            return { ok: true, msg: "已回到原位置，恢复为学校课表（未修改）" }
          }
        }
        const edit: SlotEdit =
          existingAdd && patch.action !== "remove"
            ? {
                ...existingAdd,
                weekday: patch.weekday,
                periodId: patch.periodId,
                room: patch.room,
                className: patch.className ?? existingAdd.className,
                subject: patch.subject ?? existingAdd.subject,
                group: patch.group !== undefined ? patch.group || undefined : existingAdd.group,
                note: patch.note !== undefined ? patch.note || undefined : existingAdd.note,
                noteShow: patch.noteShow !== undefined ? patch.noteShow : existingAdd.noteShow,
                displayMode: patch.displayMode !== undefined ? patch.displayMode : existingAdd.displayMode,
                customLabel: patch.customLabel !== undefined ? patch.customLabel || undefined : existingAdd.customLabel,
                label: editLabel(
                  { className: patch.className ?? existingAdd.className ?? entry.className, group: patch.group ?? existingAdd.group ?? entry.group },
                  "add",
                  patch.weekday,
                  patch.periodId,
                  patch.room,
                ),
              }
            : newSlotEdit(entry, patch, session.scope, session.effectiveDate, session.effectiveTo)
        // 校验落点（remove 不产生新占用，无需校验）
        if (patch.action !== "remove") {
          const rev = applicableRevision(a, weekStart)
          const baseSeq = rev ? rev.sourceSch : contentSource(s, teacherId)
          const base = schoolTemplateFor(s, teacherId, baseSeq)
          const candDate = addDays(weekStart, patch.weekday - 1)
          const allEdits = [...a.personalEdits, ...session.edits.filter((e) => e.key !== edit.key), edit]
          const conflict = validateWeek(s, teacherId, weekStart, base, allEdits, edit.key, candDate, "personal")
          if (conflict) {
            const occ = pickOccupant(conflict, edit.key, teacherId)
            // 跨教师资源冲突（教室占用等）无法在个人课表内解决，直接拒绝
            if (!occ) return { ok: false, msg: `落点冲突：${conflict.reason}（不自动交换或覆盖）` }
            // 同一教师落入已有课次：允许两张课卡并存于同一格；原课卡仍可继续拖动或删除
          }
        }
        setState((st) => {
          const aa = st.adoptions[teacherId]
          const cur = aa.draft ?? session
          const edits = [...cur.edits.filter((e) => e.key !== edit.key), edit]
          return { ...st, adoptions: { ...st.adoptions, [teacherId]: { ...aa, draft: { ...cur, edits, savedAt: st.clock } } } }
        })
        return { ok: true, msg: patch.action === "remove" ? "已在草稿中删除该课次（未应用）" : "已更新草稿（未应用）" }
      },

      draftAdd: (teacherId, cell, data) => {
        const s = state
        const a = s.adoptions[teacherId]
        if (!a) return { ok: false, msg: "无个人课表" }
        const session = a.draft ?? { scope: "range" as const, effectiveDate: s.weekStart, effectiveTo: TERM_END ?? "", weekStart: s.weekStart, edits: [], savedAt: null, active: true }
        const key = `add-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
        const edit: SlotEdit = {
          id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          key,
          action: "add",
          weekday: cell.weekday,
          periodId: cell.periodId,
          room: data.room,
          scope: session.scope,
          onDate: cell.date,
          effectiveDate: session.effectiveDate,
          effectiveTo: session.effectiveTo,
          label: editLabel({ className: data.className, group: data.group }, "add", cell.weekday, cell.periodId, data.room),
          className: data.className,
          subject: data.subject,
          group: data.group,
          kind: data.kind,
          taskId: data.taskId,
          studentGroup: data.studentGroup,
          unitName: data.unitName,
          note: data.note || undefined,
          noteShow: data.noteShow,
          displayMode: data.displayMode,
          customLabel: data.customLabel || undefined,
        }
        const rev = applicableRevision(a, session.weekStart)
        const baseSeq = rev ? rev.sourceSch : contentSource(s, teacherId)
        const base = schoolTemplateFor(s, teacherId, baseSeq)
        const allEdits = [...a.personalEdits, ...session.edits, edit]
        const conflict = validateWeek(s, teacherId, session.weekStart, base, allEdits, key, cell.date, "personal")
        if (conflict) return { ok: false, msg: `落点冲突：${conflict.reason}（不自动覆盖）` }
        setState((st) => {
          const aa = st.adoptions[teacherId]
          const cur = aa.draft ?? session
          return { ...st, adoptions: { ...st.adoptions, [teacherId]: { ...aa, draft: { ...cur, edits: [...cur.edits, edit], savedAt: st.clock } } } }
        })
        return { ok: true, msg: "已在草稿中新增课次（未应用）" }
      },

      planDraftImport: (teacherId, items, range) => planImport(state, teacherId, items, range).plan,

      draftImport: (teacherId, items, range) => {
        const { plan, edits } = planImport(state, teacherId, items, range)
        if (!edits.length) return plan
        setState((st) => {
          const aa = st.adoptions[teacherId]
          if (!aa) return st
          const cur = aa.draft ?? { scope: range.scope, effectiveDate: range.effectiveDate, effectiveTo: range.effectiveTo, weekStart: range.weekStart, edits: [], savedAt: null, active: true }
          return { ...st, adoptions: { ...st.adoptions, [teacherId]: { ...aa, draft: { ...cur, edits: [...cur.edits, ...edits], savedAt: st.clock } } } }
        })
        return plan
      },

      undoDraft: (teacherId) =>
        setState((s) => {
          const a = s.adoptions[teacherId]
          if (!a?.draft || a.draft.edits.length === 0) return s
          return { ...s, adoptions: { ...s.adoptions, [teacherId]: { ...a, draft: { ...a.draft, edits: a.draft.edits.slice(0, -1) } } } }
        }),

      discardDraft: (teacherId) =>
        setState((s) => ({ ...s, adoptions: { ...s.adoptions, [teacherId]: { ...s.adoptions[teacherId], draft: null } } })),

      saveDraft: (teacherId) =>
        setState((s) => {
          const a = s.adoptions[teacherId]
          if (!a?.draft) return s
          return { ...s, adoptions: { ...s.adoptions, [teacherId]: { ...a, draft: { ...a.draft, savedAt: s.clock, active: false } } } }
        }),

      applyDraft: (teacherId) => {
        const s = state
        const a = s.adoptions[teacherId]
        if (!a?.draft || a.draft.edits.length === 0) return { ok: false, msg: "无待应用草稿" }
        const draft = a.draft
        const per = nextPerSeq(a)
        const srcRev = applicableRevision(a, draft.effectiveDate)
        const sourceSch = srcRev ? srcRev.sourceSch : contentSource(s, teacherId)
        const effectiveFrom =
          draft.scope === "range" ? draft.effectiveDate : draft.edits.reduce((m, e) => (e.onDate < m ? e.onDate : m), draft.edits[0].onDate)
        const editCount = draft.edits.length
        setState((st) => {
          const aa = st.adoptions[teacherId]
          const revision: PerRevision = {
            perSeq: per, effectiveFrom, sourceSch, personalCount: aa.personalEdits.length + draft.edits.length, appliedAt: st.clock,
          }
          // 应用前快照压入撤销栈，并清空回退栈
          const snapshot: ApplySnapshot = {
            personalEdits: aa.personalEdits, revisions: aa.revisions, draft: aa.draft, confirmedDiff: aa.confirmedDiff, confirmedDiffSeq: aa.confirmedDiffSeq,
            label: `${perLabel(teacherId, per)} · ${editCount} 处调整`,
          }
          return {
            ...st,
            adoptions: {
              ...st.adoptions,
              [teacherId]: {
                ...aa,
                personalEdits: [...aa.personalEdits, ...draft.edits], draft: null, revisions: [...aa.revisions, revision],
                confirmedDiff: true, confirmedDiffSeq: contentSource(st, teacherId),
                applyUndo: [...(aa.applyUndo ?? []), snapshot], applyRedo: [],
              },
            },
          }
        })
        return { ok: true, perSeq: per, msg: `已应用个人调整，生成个人使用版 ${perLabel(teacherId, per)}` }
      },

      // 撤销上一次“确认应用”：恢复应用前的采用快照，并将当前应用后状态压入回退栈
      undoApply: (teacherId) => {
        const s = state
        const a = s.adoptions[teacherId]
        const stack = a?.applyUndo ?? []
        if (!a || stack.length === 0) return { ok: false, msg: "无可撤销的应用" }
        const prev = stack[stack.length - 1]
        setState((st) => {
          const aa = st.adoptions[teacherId]
          const redoSnap: ApplySnapshot = {
            personalEdits: aa.personalEdits, revisions: aa.revisions, draft: aa.draft, confirmedDiff: aa.confirmedDiff, confirmedDiffSeq: aa.confirmedDiffSeq,
            label: prev.label,
          }
          return {
            ...st,
            adoptions: {
              ...st.adoptions,
              [teacherId]: {
                ...aa,
                personalEdits: prev.personalEdits, revisions: prev.revisions, draft: prev.draft, confirmedDiff: prev.confirmedDiff, confirmedDiffSeq: prev.confirmedDiffSeq,
                applyUndo: (aa.applyUndo ?? []).slice(0, -1), applyRedo: [...(aa.applyRedo ?? []), redoSnap],
              },
            },
          }
        })
        return { ok: true, msg: `已撤销应用（${prev.label}），可回退撤销` }
      },

      // 回退撤销：重新应用最近一次被撤销的调整
      redoApply: (teacherId) => {
        const s = state
        const a = s.adoptions[teacherId]
        const stack = a?.applyRedo ?? []
        if (!a || stack.length === 0) return { ok: false, msg: "无可回退的撤销" }
        const next = stack[stack.length - 1]
        setState((st) => {
          const aa = st.adoptions[teacherId]
          const undoSnap: ApplySnapshot = {
            personalEdits: aa.personalEdits, revisions: aa.revisions, draft: aa.draft, confirmedDiff: aa.confirmedDiff, confirmedDiffSeq: aa.confirmedDiffSeq,
            label: next.label,
          }
          return {
            ...st,
            adoptions: {
              ...st.adoptions,
              [teacherId]: {
                ...aa,
                personalEdits: next.personalEdits, revisions: next.revisions, draft: next.draft, confirmedDiff: next.confirmedDiff, confirmedDiffSeq: next.confirmedDiffSeq,
                applyUndo: [...(aa.applyUndo ?? []), undoSnap], applyRedo: (aa.applyRedo ?? []).slice(0, -1),
              },
            },
          }
        })
        return { ok: true, msg: `已重新应用（${next.label}）` }
      },

      // 回到学校最新课表：清空个人调整并重挂到当前学校来源版；即使学校未发布新版也可用，用于“改多了回不去”时的兜底恢复。可撤销。
      resetToSchool: (teacherId) => {
        const s = state
        const a = s.adoptions[teacherId]
        if (!a) return { ok: false, msg: "无采用记录" }
        const src = contentSource(s, teacherId)
        const adoptedMax = a.revisions.reduce((m, r) => Math.max(m, r.sourceSch), 0)
        if (a.personalEdits.length === 0 && src <= adoptedMax) return { ok: false, msg: "当前已是学校课表，无需恢复" }
        const rel = releaseBySeq(s, src)
        const per = nextPerSeq(a)
        setState((st) => {
          const aa = st.adoptions[teacherId]
          const snapshot: ApplySnapshot = {
            personalEdits: aa.personalEdits, revisions: aa.revisions, draft: aa.draft, confirmedDiff: aa.confirmedDiff, confirmedDiffSeq: aa.confirmedDiffSeq,
            label: `恢复学校课表（清空 ${aa.personalEdits.length} 处个人调整）`,
          }
          const revision: PerRevision = {
            perSeq: per, effectiveFrom: rel?.effectiveDate ?? st.clock.slice(0, 10), sourceSch: src,
            personalCount: 0, appliedAt: st.clock,
          }
          return {
            ...st,
            adoptions: {
              ...st.adoptions,
              [teacherId]: {
                ...aa,
                personalEdits: [], draft: null, revisions: [...aa.revisions, revision],
                confirmedDiff: true, confirmedDiffSeq: src,
                applyUndo: [...(aa.applyUndo ?? []), snapshot], applyRedo: [],
              },
            },
            notifRead: { ...st.notifRead, [teacherId]: true },
          }
        })
        return { ok: true, perSeq: per, msg: rel ? `已恢复到学校课表 ${rel.id}` : "已恢复到学校课表" }
      },

      /* -------- 教务学校草稿会话（多教师累积，统一发布） -------- */

      beginSchoolDraft: (teacherId, weekStart) =>
        setState((s) => {
          const existing = s.schoolDrafts[teacherId]
          if (existing) {
            return { ...s, schoolDrafts: { ...s.schoolDrafts, [teacherId]: { ...existing, active: true } } }
          }
          const baseSeq = contentSource(s, teacherId)
          const draft: SchoolDraft = {
            teacherId, baseSeq, weekStart, scope: "range", effectiveDate: weekStart, effectiveTo: TERM_END ?? "",
            edits: [], savedAt: null, active: true,
          }
          return { ...s, schoolDrafts: { ...s.schoolDrafts, [teacherId]: draft } }
        }),

      setSchoolDraftScope: (teacherId, scope, effectiveDate, effectiveTo) =>
        setState((s) => {
          const d = s.schoolDrafts[teacherId]
          if (!d) return s
          return {
            ...s,
            schoolDrafts: {
              ...s.schoolDrafts,
              [teacherId]: { ...d, scope, effectiveDate: effectiveDate ?? d.effectiveDate, effectiveTo: effectiveTo ?? d.effectiveTo },
            },
          }
        }),

      schoolDraftEdit: (teacherId, entry, patch) => {
        const s = state
        const sd = s.schoolDrafts[teacherId]
        if (!sd) return { ok: false, msg: "未进入学校草稿" }
        const writeEdits = (fn: (edits: SlotEdit[]) => SlotEdit[]) =>
          setState((st) => {
            const cur = st.schoolDrafts[teacherId]
            if (!cur) return st
            return { ...st, schoolDrafts: { ...st.schoolDrafts, [teacherId]: { ...cur, edits: fn(cur.edits), savedAt: st.clock } } }
          })
        const existingAdd = sd.edits.find((e) => e.key === entry.key && e.action === "add")
        if (patch.action === "remove" && existingAdd) {
          writeEdits((edits) => edits.filter((e) => e.key !== entry.key))
          return { ok: true, msg: "已移除新增课次" }
        }
        const guard = guardEntry(entry, patch)
        if (guard) return { ok: false, msg: guard }
        const weekStart = sd.weekStart
        // 拖回原位：落点与学校基线一致时撤销本轮编辑，恢复为学校来源
        if (!existingAdd && matchesBase(schoolTemplateFor(s, teacherId, sd.baseSeq), entry.key, patch)) {
          writeEdits((edits) => edits.filter((e) => e.key !== entry.key))
          return { ok: true, msg: "已回到原位置" }
        }
        const edit: SlotEdit =
          existingAdd && patch.action !== "remove"
            ? {
                ...existingAdd,
                weekday: patch.weekday,
                periodId: patch.periodId,
                room: patch.room,
                className: patch.className ?? existingAdd.className,
                subject: patch.subject ?? existingAdd.subject,
                group: patch.group !== undefined ? patch.group || undefined : existingAdd.group,
                note: patch.note !== undefined ? patch.note || undefined : existingAdd.note,
                noteShow: patch.noteShow !== undefined ? patch.noteShow : existingAdd.noteShow,
                displayMode: patch.displayMode !== undefined ? patch.displayMode : existingAdd.displayMode,
                customLabel: patch.customLabel !== undefined ? patch.customLabel || undefined : existingAdd.customLabel,
                label: editLabel(
                  { className: patch.className ?? existingAdd.className ?? entry.className, group: patch.group ?? existingAdd.group ?? entry.group },
                  "add",
                  patch.weekday,
                  patch.periodId,
                  patch.room,
                ),
              }
            : newSlotEdit(entry, patch, sd.scope, sd.effectiveDate, sd.effectiveTo)
        if (patch.action !== "remove") {
          const base = schoolTemplateFor(s, teacherId, sd.baseSeq)
          const candDate = addDays(weekStart, patch.weekday - 1)
          const allEdits = [...sd.edits.filter((e) => e.key !== edit.key), edit]
          const conflict = validateWeek(s, teacherId, weekStart, base, allEdits, edit.key, candDate, "school")
          if (conflict) {
            const occ = pickOccupant(conflict, edit.key, teacherId)
            // 跨教师资源冲突（教室占用等）无法覆盖，直接拒绝；同一教师同格允许并存
            if (!occ) return { ok: false, msg: `落点冲突：${conflict.reason}` }
          }
        }
        writeEdits((edits) => [...edits.filter((e) => e.key !== edit.key), edit])
        return { ok: true, msg: patch.action === "remove" ? "已删除该课次" : "已更新" }
      },

      schoolDraftAdd: (teacherId, cell, data) => {
        const s = state
        const sd = s.schoolDrafts[teacherId]
        if (!sd) return { ok: false, msg: "未进入学校草稿" }
        const key = `add-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
        const edit: SlotEdit = {
          id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          key,
          action: "add",
          weekday: cell.weekday,
          periodId: cell.periodId,
          room: data.room,
          scope: sd.scope,
          onDate: cell.date,
          effectiveDate: sd.effectiveDate,
          effectiveTo: sd.effectiveTo,
          label: editLabel({ className: data.className, group: data.group }, "add", cell.weekday, cell.periodId, data.room),
          className: data.className,
          subject: data.subject,
          group: data.group,
          kind: data.kind,
          taskId: data.taskId,
          studentGroup: data.studentGroup,
          unitName: data.unitName,
          note: data.note || undefined,
          noteShow: data.noteShow,
          displayMode: data.displayMode,
          customLabel: data.customLabel || undefined,
        }
        const base = schoolTemplateFor(s, teacherId, sd.baseSeq)
        const conflict = validateWeek(s, teacherId, sd.weekStart, base, [...sd.edits, edit], key, cell.date, "school")
        if (conflict) return { ok: false, msg: `落点冲突：${conflict.reason}` }
        setState((st) => {
          const cur = st.schoolDrafts[teacherId]
          if (!cur) return st
          return { ...st, schoolDrafts: { ...st.schoolDrafts, [teacherId]: { ...cur, edits: [...cur.edits, edit], savedAt: st.clock } } }
        })
        return { ok: true, msg: "已新增课次" }
      },

      undoSchoolDraft: (teacherId) =>
        setState((s) => {
          const d = s.schoolDrafts[teacherId]
          if (!d || !d.edits.length) return s
          return { ...s, schoolDrafts: { ...s.schoolDrafts, [teacherId]: { ...d, edits: d.edits.slice(0, -1) } } }
        }),

      discardSchoolDraft: (teacherId) =>
        setState((s) => {
          if (!s.schoolDrafts[teacherId]) return s
          const next = { ...s.schoolDrafts }
          delete next[teacherId]
          return { ...s, schoolDrafts: next }
        }),

      discardAllSchoolDrafts: () => setState((s) => ({ ...s, schoolDrafts: {} })),

      // 完成本师调整：退出编辑态，草稿保留，等待与其他教师一起统一发布；无改动则直接移除
      saveSchoolDraft: (teacherId) =>
        setState((s) => {
          const d = s.schoolDrafts[teacherId]
          if (!d) return s
          if (!d.edits.length) {
            const next = { ...s.schoolDrafts }
            delete next[teacherId]
            return { ...s, schoolDrafts: next }
          }
          return { ...s, schoolDrafts: { ...s.schoolDrafts, [teacherId]: { ...d, savedAt: s.clock, active: false } } }
        }),

      publishSchoolDrafts: (note) => {
        const s = state
        const drafts = Object.values(s.schoolDrafts).filter((d) => d.edits.length > 0)
        if (!drafts.length) return { ok: false, msg: "没有可发布的改动" }
        const templates: Record<string, TemplateEntry[]> = {}
        for (const d of drafts) {
          templates[d.teacherId] = applyTemplateEdits(schoolTemplateFor(s, d.teacherId, d.baseSeq), d.edits)
        }
        const seq = latestSeq(s) + 1
        const effectiveDate = drafts.map((d) => d.weekStart).sort()[0]
        const total = drafts.reduce((n, d) => n + d.edits.length, 0)
        const names = drafts.map((d) => teacherById(d.teacherId)?.name.replace("示例", "")).filter(Boolean)
        const rel: Release = {
          seq, id: schLabel(seq),
          note: note || `教务调整 ${names.slice(0, 3).join("、")}${names.length > 3 ? ` 等 ${names.length} 位` : ""}课表（${total} 处）`,
          publishedAt: s.clock, effectiveDate,
          changedTeachers: drafts.map((d) => d.teacherId),
          templates,
        }
        setState((st) => ({ ...st, releases: [...st.releases, rel], schoolDrafts: {}, redoStack: [] }))
        return { ok: true, msg: `已发布 ${rel.id}：${drafts.length} 位教师，${total} 处改动`, release: rel }
      },
    }
    return api
  }, [state, persona, nextPerSeq, hydrated])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTimetable() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useTimetable must be used within TimetableProvider")
  return ctx
}

/* ---------------- 便捷：教师当前一周投影 + 冲突 ---------------- */

export function teacherWeekEntries(s: TTState, teacherId: string, weekStart: string) {
  const days: { date: string; weekday: number; status: TeacherCurrentStatus }[] = []
  for (let wd = 1; wd <= 7; wd++) {
    const date = addDays(weekStart, wd - 1)
    days.push({ date, weekday: wd, status: teacherCurrent(s, teacherId, date) })
  }
  const entries = days.flatMap(({ date, status }) => status.kind !== "ok" ? [] : projectWeek(status.template, weekStart, teacherId, "personal").filter(e => e.date === date).map(e => ({
    ...e,
    origin: status.editedKeys.includes(e.key) ? ("personal" as const) : ("school" as const),
  })))
  const revSeqs = new Set(days.filter((d) => d.status.kind === "ok").map((d) => (d.status as { rev: PerRevision }).rev.perSeq))
  return { days, entries, multiVersion: revSeqs.size > 1 }
}

export function schoolWeekEntries(s: TTState, teacherId: string, weekStart: string, seq: number): ProjectedEntry[] {
  const tpl = schoolTemplateFor(s, teacherId, seq)
  return projectWeek(tpl, weekStart, teacherId, "school")
}

export function weekConflicts(entries: ProjectedEntry[]): Conflict[] {
  return detectConflicts(entries)
}
