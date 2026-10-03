// 教师教学评价方案 r1：系统预设、个人方案、修订、默认采用历史与对象绑定。
// - 等级只描述评价，不承载出勤、提交、未记录、不适用等处理状态。
// - 修订一经被默认、课堂周期、作业或发布引用即不原地改写；保存只产生修订，不升级任何默认。
// - 系统修订是代码常量，不写入教师存储：系统更新不会覆盖个人副本。

import { SCHOOL } from "./model"

export type Purpose = "CLASSROOM" | "HOMEWORK"
export const PURPOSE_LABEL: Record<Purpose, string> = { CLASSROOM: "课堂评价", HOMEWORK: "作业质量" }
export type ParentMode = "CODE_LABEL" | "LABEL_ONLY"

export interface Level {
  id: string
  code: string
  label: string
  guide: string
}
export interface SchemeRev {
  id: string
  schemeId: string
  n: number
  name: string
  desc: string
  levels: Level[]
  defaultLevelId: string | null
  parentMode: ParentMode
  at: string
}
export interface Scheme {
  id: string
  /** "SYSTEM" 或 `${schoolId}|${teacherId}` */
  owner: string
  source: { schemeId: string; revId: string; name: string } | null
  archived: boolean
  revIds: string[]
  createdAt: string
}
export interface DefaultEntry {
  revId: string
  /** 课堂：自该反馈周期起生效；作业：自 at 起新布置的作业 */
  fromWeek: number
  at: string
}
export interface SchemeState {
  schemes: Record<string, Scheme>
  revs: Record<string, SchemeRev>
  /** `${owner}|${purpose}` -> 采用历史（按生效先后） */
  defaults: Record<string, DefaultEntry[]>
  /** `${taskId}|${periodId}` -> 该任务该周期固定的课堂修订 */
  bindings: Record<string, string>
  /** `${taskId}|${purpose}` -> 本人对该真实任务的覆盖（按生效先后）；仅影响该任务 */
  taskOverrides?: Record<string, DefaultEntry[]>
  classroomChoices?: Record<string, string>
}

export function overrideKey(taskId: string, p: Purpose) {
  return `${taskId}|${p}`
}
/** 任务课堂覆盖：目标周期有效的覆盖修订（无则 null） */
export function taskClassroomOverrideAt(st: SchemeState, taskId: string, week: number): string | null {
  return st.classroomChoices?.[taskId] ?? null
}
/** 任务新作业覆盖：此刻有效的覆盖修订（无则 null） */
export function taskHomeworkOverrideNow(st: SchemeState, taskId: string, nowIso: string): string | null {
  let rev: string | null = null
  const now = Date.parse(nowIso)
  for (const e of st.taskOverrides?.[overrideKey(taskId, "HOMEWORK")] ?? []) if (Date.parse(e.at) <= now) rev = e.revId || null
  return rev
}
/** 新作业候选：任务覆盖 → 教师作业默认 → 系统默认 */
export function homeworkRevForTask(st: SchemeState, taskId: string, teacherId: string, nowIso: string): { revId: string; source: "TASK" | "TEACHER" } {
  const o = taskHomeworkOverrideNow(st, taskId, nowIso)
  if (o) return { revId: o, source: "TASK" }
  return { revId: homeworkDefaultNow(st, ownerKey(teacherId), nowIso), source: "TEACHER" }
}

/* ---------------- 系统预设 ---------------- */

const SYS_AT = "2026-08-20T09:00:00+08:00"
function sysRev(schemeId: string, name: string, desc: string, levels: [string, string, string][], dflt: string, ids?: "CODE"): SchemeRev {
  const revId = `${schemeId}@1`
  return {
    id: revId,
    schemeId,
    n: 1,
    name,
    desc,
    levels: levels.map(([code, label, guide], i) => ({ id: ids === "CODE" ? code : `${revId}:${i + 1}`, code, label, guide })),
    defaultLevelId: ids === "CODE" ? dflt : `${revId}:${levels.findIndex((l) => l[0] === dflt) + 1}`,
    parentMode: "CODE_LABEL",
    at: SYS_AT,
  }
}

/** 基础四级的等级标识沿用原型既有字典值（A/B/C/D），既有记录无需改写即可准确解释。 */
export const SYS_BASIC4 = sysRev(
  "SYS_BASIC4",
  "基础四级",
  "通用起点：A＝优秀。",
  [
    ["A", "优秀", "达成本课目标，参与积极，表现稳定。"],
    ["B", "良好", "基本达成目标，个别环节需提醒。"],
    ["C", "合格", "部分达成，需要较多提示才能完成。"],
    ["D", "待改进", "多数环节未达成，需要单独跟进。"],
  ],
  "A",
  "CODE",
)
export const SYS_FINE8 = sysRev(
  "SYS_FINE8",
  "细化八级",
  "在四级基础上细分相邻档次；常规确认默认 A，而非最高档 A+。",
  [
    ["A+", "表现突出", "超出本课目标，能带动或启发他人。"],
    ["A", "优秀", "完整达成目标，几乎无需提醒。"],
    ["A-", "整体优秀", "达成目标，偶有小疏漏但能自行纠正。"],
    ["B+", "良好偏上", "大部分达成，个别环节经一次提醒即可。"],
    ["B", "良好", "基本达成，需要数次提醒。"],
    ["B-", "基本良好", "勉强达成，关键环节依赖提示。"],
    ["C", "合格", "部分达成，需要较多帮助。"],
    ["D", "待改进", "多数未达成，需要单独跟进。"],
  ],
  "A",
)
export const SYS_TEXT4 = sysRev(
  "SYS_TEXT4",
  "文字四级",
  "不使用字母，直接以文字表达；常规默认“达到目标”。",
  [
    ["表现突出", "表现突出", "明显超出本课目标。"],
    ["达到目标", "达到目标", "完成本课目标，表现稳定。"],
    ["需要巩固", "需要巩固", "部分达成，还需练习巩固。"],
    ["需要支持", "需要支持", "多数未达成，需要老师单独支持。"],
  ],
  "达到目标",
)
export const SYSTEM_REVS: SchemeRev[] = [SYS_BASIC4, SYS_FINE8, SYS_TEXT4]
export const SYSTEM_DEFAULT_REV = SYS_BASIC4.id
export const SYSTEM_SCHEMES: Scheme[] = SYSTEM_REVS.map((r) => ({
  id: r.schemeId,
  owner: "SYSTEM",
  source: null,
  archived: false,
  revIds: [r.id],
  createdAt: SYS_AT,
}))

export function emptySchemeState(): SchemeState {
  return { schemes: {}, revs: {}, defaults: {}, bindings: {} }
}

/* ---------------- 修订注册表（store 每次提交后同步；修订被引用后不可变） ---------------- */

let registry: Record<string, SchemeRev> = Object.fromEntries(SYSTEM_REVS.map((r) => [r.id, r]))
export function syncRevRegistry(revs: Record<string, SchemeRev>) {
  registry = { ...revs, ...Object.fromEntries(SYSTEM_REVS.map((r) => [r.id, r])) }
}
export function revById(id: string | null | undefined): SchemeRev | null {
  return id ? (registry[id] ?? null) : null
}
export function schemeOf(st: SchemeState, schemeId: string): Scheme | null {
  return SYSTEM_SCHEMES.find((s) => s.id === schemeId) ?? st.schemes[schemeId] ?? null
}
export function latestRev(st: SchemeState, schemeId: string): SchemeRev | null {
  const s = schemeOf(st, schemeId)
  return s ? revById(s.revIds[s.revIds.length - 1]) : null
}

/* ---------------- 显示 ---------------- */

export function levelOf(rev: SchemeRev | null, value: string | null): Level | null {
  if (!rev || !value) return null
  return rev.levels.find((l) => l.id === value) ?? null
}
/** 教师选择时的文字：标识与释义相同只显示一次 */
export function levelText(l: Level): string {
  return l.code === l.label ? l.label : `${l.code} ${l.label}`
}
/** 家长看到的文字：整套遵守同一种模式 */
export function parentText(rev: SchemeRev, l: Level): string {
  return rev.parentMode === "LABEL_ONLY" ? l.label : levelText(l)
}
/** 已存值的显示：找不到修订或等级时保留原值并标待核对，不回退为 A 或最新默认 */
export function gradeDisplay(revId: string | null | undefined, value: string | null): { text: string; unresolved: boolean } | null {
  if (!value) return null
  const rev = revById(revId)
  const l = levelOf(rev, value)
  if (l) return { text: levelText(l), unresolved: false }
  return { text: `${value}（标准待核对）`, unresolved: true }
}

/* ---------------- 归属与默认解析 ---------------- */

export function ownerKey(teacherId: string): string {
  return `${SCHOOL.id}|${teacherId}`
}
export function defaultKey(owner: string, p: Purpose) {
  return `${owner}|${p}`
}
export function bindingKey(taskId: string, periodId: string) {
  return `${taskId}|${periodId}`
}

/** 课堂：某周期实际有效的默认修订（不受当前浏览周影响，由调用方传入目标周期） */
export function classroomDefaultAt(st: SchemeState, owner: string, week: number): string {
  const list = st.defaults[defaultKey(owner, "CLASSROOM")] ?? []
  let rev = SYSTEM_DEFAULT_REV
  for (const e of list) if (e.fromWeek <= week) rev = e.revId
  return rev
}
/** 作业：此刻新布置作业所用修订 */
export function homeworkDefaultNow(st: SchemeState, owner: string, nowIso: string): string {
  const list = st.defaults[defaultKey(owner, "HOMEWORK")] ?? []
  let rev = SYSTEM_DEFAULT_REV
  const now = Date.parse(nowIso)
  for (const e of list) if (Date.parse(e.at) <= now) rev = e.revId
  return rev
}
/** 课堂某任务某周期的标准：已绑定用绑定，否则按任务负责教师在该周期的有效默认 */
export function classroomRevFor(st: SchemeState, taskId: string, teacherId: string, periodId: string, week: number): { revId: string; bound: boolean } {
  const b = st.bindings[bindingKey(taskId, periodId)]
  if (b) return { revId: b, bound: true }
  const o = taskClassroomOverrideAt(st, taskId, week)
  if (o) return { revId: o, bound: false }
  return { revId: classroomDefaultAt(st, ownerKey(teacherId), week), bound: false }
}

/** 待生效的课堂选择（生效周期晚于当前周期） */
export function pendingClassroom(st: SchemeState, owner: string, currentWeek: number): DefaultEntry | null {
  return null
}

/* ---------------- 引用判断 ---------------- */

export interface RefIndex {
  business: Set<string>
  defaults: Set<string>
}
export function revRefs(st: SchemeState, extra: { assignmentRevs: (string | null | undefined)[]; publicationRevs: string[] }): RefIndex {
  const business = new Set<string>([...Object.values(st.bindings), ...extra.publicationRevs])
  for (const r of extra.assignmentRevs) if (r) business.add(r)
  const defaults = new Set<string>(Object.values(st.classroomChoices ?? {}))
  for (const entries of Object.values(st.taskOverrides ?? {})) for (const entry of entries) if (entry.revId) defaults.add(entry.revId)
  for (const list of Object.values(st.defaults)) for (const e of list) defaults.add(e.revId)
  return { business, defaults }
}

/* ---------------- 编辑候选与校验 ---------------- */

export interface Draft {
  name: string
  desc: string
  levels: Level[]
  /** "__REMOVED" 表示原默认等级已被删除，必须重新选择或清空 */
  defaultLevelId: string | null
  parentMode: ParentMode
}
export const RESERVED = [
  "正常", "迟到", "早退", "缺勤", "请假", "在他班", "按时提交", "迟交", "未交", "已提交",
  "未记录", "待处理", "不评价", "明确不评价", "不适用", "未参与", "免做", "确认免做", "待评",
]
const UNSAFE = /[<>{}`\\]|javascript:|^\s*[=+@]\s*\w+\(/i
export const LIMITS = { name: 24, desc: 80, code: 8, label: 12, guide: 80, levels: 12 }

export function normCode(s: string): string {
  return s.normalize("NFKC").trim().replace(/\s+/g, "").toUpperCase()
}

export interface DraftIssue {
  field: string
  msg: string
}
export function validateDraft(d: Draft, otherNames: string[]): DraftIssue[] {
  const out: DraftIssue[] = []
  const name = d.name.trim()
  if (!name) out.push({ field: "name", msg: "请填写方案名称" })
  else if (name.length > LIMITS.name) out.push({ field: "name", msg: `名称不超过 ${LIMITS.name} 字` })
  else if (otherNames.some((n) => n.trim() === name)) out.push({ field: "name", msg: "你已有同名方案，请使用可区分的名称" })
  if (d.desc.length > LIMITS.desc) out.push({ field: "desc", msg: `说明不超过 ${LIMITS.desc} 字` })
  for (const [k, v] of [["name", d.name], ["desc", d.desc]] as const) if (UNSAFE.test(v)) out.push({ field: k, msg: "仅支持纯文本，不支持 HTML、脚本或公式" })
  if (d.levels.length < 2) out.push({ field: "levels", msg: "至少需要两个有序等级" })
  if (d.levels.length > LIMITS.levels) out.push({ field: "levels", msg: `等级不超过 ${LIMITS.levels} 档` })
  const seen = new Map<string, number>()
  d.levels.forEach((l, i) => {
    const f = `level:${l.id}`
    const code = l.code.trim()
    const label = l.label.trim()
    if (!code) out.push({ field: `${f}:code`, msg: `第 ${i + 1} 档缺少标识` })
    else if (code.length > LIMITS.code) out.push({ field: `${f}:code`, msg: `标识不超过 ${LIMITS.code} 字` })
    if (!label) out.push({ field: `${f}:label`, msg: `第 ${i + 1} 档缺少简短释义` })
    else if (label.length > LIMITS.label) out.push({ field: `${f}:label`, msg: `释义不超过 ${LIMITS.label} 字` })
    if (l.guide.length > LIMITS.guide) out.push({ field: `${f}:guide`, msg: `判断说明不超过 ${LIMITS.guide} 字` })
    for (const v of [l.code, l.label, l.guide]) if (UNSAFE.test(v)) out.push({ field: f, msg: `第 ${i + 1} 档仅支持纯文本` })
    if (RESERVED.includes(code) || RESERVED.includes(label))
      out.push({ field: f, msg: `“${RESERVED.includes(code) ? code : label}”是系统处理状态，不能作为等级` })
    if (code) {
      const n = normCode(code)
      if (seen.has(n)) out.push({ field: `${f}:code`, msg: `第 ${i + 1} 档标识与第 ${seen.get(n)! + 1} 档重复` })
      else seen.set(n, i)
    }
  })
  if (d.defaultLevelId === "__REMOVED") out.push({ field: "default", msg: "原常规默认等级已被删除，请重新选择或设为“不设置”" })
  else if (d.defaultLevelId && !d.levels.some((l) => l.id === d.defaultLevelId)) out.push({ field: "default", msg: "常规默认等级必须属于本方案" })
  return out
}

export function draftOfRev(r: SchemeRev): Draft {
  return { name: r.name, desc: r.desc, levels: r.levels.map((l) => ({ ...l })), defaultLevelId: r.defaultLevelId, parentMode: r.parentMode }
}
export function cleanDraft(d: Draft): Draft {
  return {
    name: d.name.trim(),
    desc: d.desc.trim(),
    levels: d.levels.map((l) => ({ id: l.id, code: l.code.normalize("NFKC").trim(), label: l.label.trim(), guide: l.guide.trim() })),
    defaultLevelId: d.defaultLevelId === "__REMOVED" ? null : d.defaultLevelId,
    parentMode: d.parentMode,
  }
}
export function sameContent(a: Draft, b: Draft): boolean {
  return JSON.stringify(cleanDraft(a)) === JSON.stringify(cleanDraft(b))
}

/* ---------------- 种子：既有原型数据按基础四级（A＝优秀）解释 ---------------- */

export function seedSchemeState(args: { boundPeriods: string[] }): SchemeState {
  const st = emptySchemeState()
  for (const k of args.boundPeriods) st.bindings[k] = SYSTEM_DEFAULT_REV
  return st
}
