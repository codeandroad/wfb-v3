// 网格式 Excel 导入引擎（SYSTEM_PERIOD_ONLY_R1）
//
// 职责：把“已解码的工作表单元格图”解析成结构化安排 —— 自动识别源布局 / 表级教师 / 字段顺序，
// 定位日期列与课节列、逐格走词法、绑定到系统课节（唯一时间权威，来自 PERIODS，不读 Excel 时间列）、
// 按教学班登记匹配教学对象。不静默创建对象：未识别项交由界面逐项处理。

import { parseCell, type FieldOrder, type GridView, type ParsedRecord } from "./grid-slash"
import {
  PERIODS,
  WEEKDAYS,
  TEACHERS,
  TEACHING_CLASSES,
  ROOMS,
  addDays,
  periodById,
  toMin,
  type Period,
} from "./data"
import registry from "../teaching/fixture.json"

/* ---------------- 系统课节权威（由 PERIODS 派生别名，绝不从上传文件建立） ---------------- */

export interface SystemSlot {
  id: string // 应用内 periodId（m1..e4）
  label: string
  start: string
  end: string
  aliases: string[]
}

export const SYSTEM_SCHEDULE = {
  id: "DEMO-BELL-2026T1",
  revision: "BELL-DEMO-001",
  timezone: "Asia/Shanghai",
  slots: PERIODS.map((p: Period): SystemSlot => ({
    id: p.id,
    label: p.label,
    start: p.start,
    end: p.end,
    aliases: [String(p.no), `P${String(p.no).padStart(2, "0")}`, `第${p.no}节`, `第${p.no}课节`, p.label],
  })),
}

function resolveSystemPeriod(label: unknown): { slot: SystemSlot } | { error: string } {
  if (label === null || label === undefined || String(label).trim() === "") return { error: "PERIOD_UNMAPPED" }
  const key = String(label).trim()
  const hits = SYSTEM_SCHEDULE.slots.filter((s) => [s.id, s.label, ...s.aliases].includes(key))
  if (!hits.length) return { error: "PERIOD_UNMATCHED" }
  if (hits.length > 1) return { error: "PERIOD_AMBIGUOUS" }
  return { slot: hits[0] }
}

/* ---------------- 日期列表头解析 ---------------- */

const WEEKDAY_DICT: Record<string, number> = {
  周一: 1, 周二: 2, 周三: 3, 周四: 4, 周五: 5, 周六: 6, 周日: 7, 周天: 7,
  星期一: 1, 星期二: 2, 星期三: 3, 星期四: 4, 星期五: 5, 星期六: 6, 星期日: 7,
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7,
}
const DAY_RE = /^(周[一二三四五六日天]|星期[一二三四五六日]|Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)(?:[\s\n]+(.+))?$/u

const isoWeekday = (iso: string) => (new Date(iso + "T00:00:00Z").getUTCDay() || 7)

// 表头只写“周一”时按目标起始周定日期；写了具体日期（与目标周不同）时仍按星期几落位——
// 课表是周循环的，表头日期只用于核对星期
function resolveDateHeader(text: string, weekStart: string): { date: string; weekday: number } | { error: string } {
  const m = String(text).trim().match(DAY_RE)
  if (!m) return { error: "NOT_A_DATE_HEADER" }
  const wd = WEEKDAY_DICT[m[1]]
  const rest = (m[2] || "").trim()
  if (rest) {
    let iso: string | null = null
    if (/^\d{4}-\d{2}-\d{2}$/.test(rest)) iso = rest
    if (iso && isoWeekday(iso) !== wd) return { error: "WEEKDAY_MISMATCH" }
    if (!iso && !/^\d{1,2}\/\d{1,2}$/.test(rest)) return { error: "DATE_HEADER_UNRESOLVED" }
  }
  return { date: addDays(weekStart, wd - 1), weekday: wd }
}

/* ---------------- 已解码工作表结构 ---------------- */

export interface DecodedSheet {
  sheet: string
  cells: Record<string, string> // "C4" -> 文本值（xlsx 读取层已按纯文本解码）
  maxRow: number
}

export type MatchStatus = "ok" | "pending" | "unmatched" | "ambiguous"

export interface ImportRecord {
  id: string
  provenance: { sheet: string; cell: string; line: number; rawPeriod: string | null; rawReferenceTime: string | null }
  raw: ParsedRecord
  date: string
  weekday: number
  // 系统课节绑定
  periodId: string | null
  periodLabel: string | null
  start: string | null
  end: string | null
  timingStatus: "RESOLVED" | "PENDING"
  timingError?: string
  // 对象匹配
  classId: string | null
  className: string | null // 课表中使用的规范名称（排课归属 • 本期课程）
  subject: string | null
  classStatus: MatchStatus
  teacherId: string | null
  teacherStatus: MatchStatus
  roomId: string | null
  roomStatus: MatchStatus
  isActivity: boolean
  activitySuggested: boolean // 未写“活动:”前缀，但名称像会议/教研等非课程活动
  // 汇总
  status: "ok" | "pending" | "error"
  issues: string[] // 阻断项：需要处理后才能写入
  notes: string[] // 提示项：不阻断写入
}

export interface ParseIssue {
  cell: string
  code: string
  line?: number
}

export interface ImportResult {
  layout: GridView
  weekStart: string
  records: ImportRecord[]
  issues: ParseIssue[]
  mapping: { periodColumn: string | null; dayColumns: { col: string; date: string; weekday: number }[]; ignoredReferenceColumns: string[]; headerRow: number }
  counts: { ok: number; pending: number; error: number; total: number }
}

const colOf = (addr: string) => addr.match(/^[A-Z]+/)![0]
const rowOf = (addr: string) => Number(addr.match(/\d+$/)![0])
const colNum = (col: string) => [...col].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0)

/* ---------------- 教学对象目录（教学班登记为权威 + 课表已有教学班） ---------------- */

const norm = (s: string) => s.replace(/\s+/g, "").replace(/[·・･•]/g, "•").toLowerCase()
const regTeacherId = (id: string) => id.replace(/^T-/, "").toLowerCase()

export interface ClassOption {
  id: string
  name: string // 课表规范名称
  subject: string
  teacherIds: string[]
  aliases: string[]
}

export const IMPORT_CLASS_OPTIONS: ClassOption[] = (() => {
  const homeroom = new Map(registry.homerooms.map((h) => [h.id, h.name]))
  const course = new Map(registry.courses.map((c) => [c.id, c.name]))
  const subject = new Map(registry.subjects.map((s) => [s.id, s.name]))
  const out: ClassOption[] = []
  for (const c of registry.teachingClasses) {
    const home = c.placementHomeroomId ? homeroom.get(c.placementHomeroomId) : undefined
    const crs = c.courseId ? course.get(c.courseId) : undefined
    // 规范名称以教学班登记为准；“排课归属 • 课程名”仅作为旧写法别名参与匹配
    const name = c.name
    const legacy = home && crs ? `${home} • ${crs}` : c.name
    const tids = new Set<string>()
    for (const t of c.wholeTeacherIds ?? []) tids.add(regTeacherId(t))
    if (c.courseResponsibleTeacherId) tids.add(regTeacherId(c.courseResponsibleTeacherId))
    for (const r of registry.responsibilities) if (r.teachingClassId === c.id) r.teacherIds.forEach((t) => tids.add(regTeacherId(t)))
    out.push({ id: c.id, name, subject: subject.get(c.subjectId) ?? "", teacherIds: [...tids], aliases: [...new Set([name, legacy])] })
  }
  for (const c of TEACHING_CLASSES) {
    const hit = out.find((o) => o.aliases.some((a) => norm(a) === norm(c.name)))
    if (hit) {
      hit.teacherIds = [...new Set([...hit.teacherIds, ...c.teacherIds])]
      continue
    }
    out.push({ id: c.id, name: c.name, subject: c.subject, teacherIds: c.teacherIds, aliases: [c.name] })
  }
  return out
})()

export function classOptionById(id: string | null | undefined): ClassOption | undefined {
  return id ? IMPORT_CLASS_OPTIONS.find((c) => c.id === id) : undefined
}

const KNOWN_ROOMS = new Set([...ROOMS, ...registry.locations.map((l) => l.id)])
const ACTIVITY_RE = /(教研|会议|例会|班会|讲座|培训|值班|备课|集会|活动)/u

function matchClass(name: string, teacherId: string | null): { option: ClassOption | null; status: MatchStatus } {
  const key = norm(name)
  const hits = IMPORT_CLASS_OPTIONS.filter((c) => c.aliases.some((a) => norm(a) === key))
  if (hits.length === 1) return { option: hits[0], status: "ok" }
  if (hits.length > 1) {
    const mine = teacherId ? hits.filter((h) => h.teacherIds.includes(teacherId)) : []
    if (mine.length === 1) return { option: mine[0], status: "ok" }
    return { option: null, status: "ambiguous" }
  }
  return { option: null, status: "unmatched" }
}

export function matchTeacherText(text: string | null): { id: string | null; status: MatchStatus } {
  if (!text) return { id: null, status: "ok" }
  const n = text.replace(/^示例/, "").replace(/(老师|教师)$/u, "")
  const hits = TEACHERS.filter((t) => {
    const tn = t.name.replace(/^示例/, "").replace(/(老师|教师)$/u, "")
    return t.name === text || tn === n
  })
  if (hits.length === 1) return { id: hits[0].id, status: "ok" }
  if (hits.length > 1) return { id: null, status: "ambiguous" }
  return { id: null, status: "unmatched" }
}

/* ---------------- 源信息自动识别（布局 / 表级教师 / 字段顺序） ---------------- */

export interface SourceDetection {
  layout: GridView | null // null = 未能识别，界面默认教师视角并请用户确认
  teacherId: string | null
  order: FieldOrder
  reasons: string[]
}

const GROUP_RE = /^[A-Z]{1,2}\d{1,2}$/

function looksLikeRoom(s: string | undefined) {
  return !!s && (KNOWN_ROOMS.has(s) || /(室|楼|馆|厅|场|LAB)/iu.test(s))
}

export function detectSource(sheet: DecodedSheet, instructionsText = ""): SourceDetection {
  const reasons: string[] = []
  const headerRow = detectHeaderRow(sheet, "2026-09-28")
  const above = Object.keys(sheet.cells)
    .filter((a) => rowOf(a) < headerRow)
    .map((a) => String(sheet.cells[a]))
  const titleText = [sheet.sheet, ...above].join(" ")

  // 1) 布局：说明页 / 标题关键词 → 表级教师名 → 单元格字段数
  let layout: GridView | null = null
  if (/教师视角|教师周课表|教师课表/u.test(titleText)) layout = "TEACHER"
  else if (/班级视角|班级周课表|班级课表/u.test(titleText)) layout = "CLASS"

  let teacherId: string | null = null
  for (const t of TEACHERS) {
    const short = t.name.replace(/^示例/, "")
    if (titleText.includes(t.name) || titleText.includes(short)) {
      teacherId = t.id
      break
    }
  }
  if (!layout && teacherId) layout = "TEACHER"

  const bodyCells = Object.keys(sheet.cells)
    .filter((a) => rowOf(a) > headerRow)
    .map((a) => String(sheet.cells[a]))
    .flatMap((v) => v.split(/\r?\n/))
    .filter((v) => v.includes("/"))
  const fieldsOf = (v: string) => v.split("/").map((s) => s.trim())
  if (!layout) {
    const hasFour = bodyCells.some((v) => fieldsOf(v).length === 4)
    const hasTeacherField = bodyCells.some((v) => matchTeacherText(fieldsOf(v)[1] ?? null).status === "ok" && !!fieldsOf(v)[1])
    if (hasFour || hasTeacherField) layout = "CLASS"
  }
  if (layout) reasons.push(layout === "TEACHER" ? "表头显示为教师课表" : "单元格含教师字段，判定为班级课表")
  if (teacherId) reasons.push(`表头识别到教师「${TEACHERS.find((t) => t.id === teacherId)?.name}」`)

  // 2) 字段顺序：说明页声明优先，其次按“地点 / 分工”所在位置打分
  let order: FieldOrder = "V1"
  if (/TEACHING_TARGET_GRID_V1/.test(instructionsText)) {
    reasons.push("说明页声明协议 TEACHING_TARGET_GRID_V1")
  } else {
    const locIdx = layout === "CLASS" ? 2 : 1
    let v1 = 0
    let legacy = 0
    for (const v of bodyCells) {
      const f = fieldsOf(v)
      if (looksLikeRoom(f[locIdx]) || GROUP_RE.test(f[f.length - 1] ?? "")) v1 += 1
      if (GROUP_RE.test(f[1] ?? "") || looksLikeRoom(f[f.length - 1])) legacy += 1
    }
    if (legacy > v1) {
      order = "LEGACY"
      reasons.push("按单元格内容判定为旧版字段顺序（名称/分工/地点）")
    }
  }
  return { layout, teacherId, order, reasons }
}

/* ---------------- 解析 ---------------- */

export function parseImport(
  sheet: DecodedSheet,
  view: GridView,
  weekStart: string,
  opts: { teacherId?: string | null; order?: FieldOrder; headerRow?: number } = {},
): ImportResult {
  const headerRow = opts.headerRow ?? detectHeaderRow(sheet, weekStart)
  const rowAddrs = Object.keys(sheet.cells).filter((a) => rowOf(a) === headerRow)
  let periodColumn: string | null = null
  const dayColumns: { col: string; date: string; weekday: number }[] = []
  const ignoredReferenceColumns: string[] = []
  const issues: ParseIssue[] = []

  for (const addr of rowAddrs.sort((a, b) => colNum(colOf(a)) - colNum(colOf(b)))) {
    const col = colOf(addr)
    const t = String(sheet.cells[addr]).trim()
    if (["节次", "课节", "课节编号"].includes(t)) {
      periodColumn = col
      continue
    }
    if (/^时间/u.test(t)) {
      ignoredReferenceColumns.push(col)
      continue
    }
    const dr = resolveDateHeader(t, weekStart)
    if ("date" in dr) dayColumns.push({ col, date: dr.date, weekday: dr.weekday })
  }

  const mapping = { periodColumn, dayColumns, ignoredReferenceColumns, headerRow }
  if (!periodColumn) issues.push({ cell: `行${headerRow}`, code: "PERIOD_COLUMN_REQUIRED" })
  if (!dayColumns.length) issues.push({ cell: `行${headerRow}`, code: "DATE_COLUMNS_REQUIRED" })

  const records: ImportRecord[] = []
  if (periodColumn && dayColumns.length) {
    let seq = 0
    for (let r = headerRow + 1; r <= sheet.maxRow; r++) {
      const rawPeriod = sheet.cells[periodColumn + r] ?? null
      for (const d of dayColumns) {
        const value = sheet.cells[d.col + r]
        if (value === null || value === undefined || String(value).trim() === "") continue
        let parts: ParsedRecord[]
        try {
          parts = parseCell(value, view, opts.order ?? "V1")
        } catch (e) {
          const err = e as { code?: string }
          issues.push({ cell: d.col + r, code: err.code || "PARSE_ERROR" })
          continue
        }
        for (const part of parts) {
          seq += 1
          const rawRefTime = ignoredReferenceColumns.length ? String(sheet.cells[ignoredReferenceColumns[0] + r] ?? "") || null : null
          const recIssues: string[] = []
          const notes: string[] = []

          const pr = resolveSystemPeriod(rawPeriod)
          const slot = "slot" in pr ? pr.slot : null
          if (!slot) recIssues.push((pr as { error: string }).error)

          const teacherText = view === "TEACHER" ? null : part.teacherText
          const tch = view === "TEACHER" ? { id: opts.teacherId ?? null, status: (opts.teacherId ? "ok" : "unmatched") as MatchStatus } : matchTeacherText(teacherText)
          if (tch.status === "unmatched") recIssues.push(view === "TEACHER" ? "TEACHER_REQUIRED" : "TEACHER_UNMATCHED")
          if (tch.status === "ambiguous") recIssues.push("TEACHER_AMBIGUOUS")

          const isActivity = part.kindHint === "ACTIVITY"
          const cls = isActivity ? { option: null, status: "ok" as MatchStatus } : matchClass(part.name, tch.id)
          const activitySuggested = !isActivity && cls.status === "unmatched" && ACTIVITY_RE.test(part.name)
          if (cls.status === "unmatched") recIssues.push(activitySuggested ? "ACTIVITY_SUGGESTED" : "CLASS_UNMATCHED")
          if (cls.status === "ambiguous") recIssues.push("CLASS_AMBIGUOUS")
          if (cls.option && tch.id && cls.option.teacherIds.length && !cls.option.teacherIds.includes(tch.id)) notes.push("TEACHER_NOT_ASSIGNED")

          const roomText = part.locationText
          const roomOk = !roomText || KNOWN_ROOMS.has(roomText)
          if (!roomOk) notes.push("ROOM_TEXT_ONLY")

          const status: ImportRecord["status"] = !slot ? "error" : recIssues.length ? "pending" : "ok"

          records.push({
            id: `imp-${seq}`,
            provenance: { sheet: sheet.sheet, cell: d.col + r, line: part.line, rawPeriod: rawPeriod ? String(rawPeriod) : null, rawReferenceTime: rawRefTime },
            raw: part,
            date: d.date,
            weekday: d.weekday,
            periodId: slot?.id ?? null,
            periodLabel: slot?.label ?? null,
            start: slot?.start ?? null,
            end: slot?.end ?? null,
            timingStatus: slot ? "RESOLVED" : "PENDING",
            timingError: slot ? undefined : (pr as { error: string }).error,
            classId: cls.option?.id ?? null,
            className: cls.option?.name ?? (isActivity ? part.name : null),
            subject: cls.option?.subject ?? null,
            classStatus: cls.status,
            teacherId: tch.id,
            teacherStatus: tch.status,
            roomId: roomText && roomOk ? roomText : null,
            roomStatus: roomOk ? "ok" : "pending",
            isActivity,
            activitySuggested,
            status,
            issues: recIssues,
            notes,
          })
        }
      }
    }
  }

  const counts = {
    ok: records.filter((r) => r.status === "ok").length,
    pending: records.filter((r) => r.status === "pending").length,
    error: records.filter((r) => r.status === "error").length,
    total: records.length,
  }

  return { layout: view, weekStart, records, issues, mapping, counts }
}

export function detectHeaderRow(sheet: DecodedSheet, weekStart: string): number {
  for (let r = 1; r <= Math.min(sheet.maxRow, 12); r++) {
    const rowAddrs = Object.keys(sheet.cells).filter((a) => rowOf(a) === r)
    const hasPeriod = rowAddrs.some((a) => ["节次", "课节", "课节编号"].includes(String(sheet.cells[a]).trim()))
    const hasDay = rowAddrs.some((a) => "date" in resolveDateHeader(String(sheet.cells[a]).trim(), weekStart))
    if (hasPeriod && hasDay) return r
  }
  return 3
}

// 是否为课表数据工作表（含课节列 + 日期列）；说明页等返回 false
export function isGridSheet(sheet: DecodedSheet): boolean {
  const r = detectHeaderRow(sheet, "2026-09-28")
  const rowAddrs = Object.keys(sheet.cells).filter((a) => rowOf(a) === r)
  return rowAddrs.some((a) => ["节次", "课节", "课节编号"].includes(String(sheet.cells[a]).trim()))
}

/* ---------------- 文件内部冲突检查（用系统课节时刻） ---------------- */

export interface ImportConflict {
  type: "teacher" | "room"
  date: string
  periodId: string
  label: string
  recordIds: string[]
}

export function importConflicts(records: ImportRecord[]): ImportConflict[] {
  const resolved = records.filter((r) => r.timingStatus === "RESOLVED" && r.periodId)
  const out: ImportConflict[] = []
  const byTeacher = new Map<string, ImportRecord[]>()
  const byRoom = new Map<string, ImportRecord[]>()
  for (const r of resolved) {
    if (r.teacherId) {
      const k = `${r.teacherId}@${r.date}@${r.periodId}`
      byTeacher.set(k, [...(byTeacher.get(k) || []), r])
    }
    if (r.roomId) {
      const k = `${r.roomId}@${r.date}@${r.periodId}`
      byRoom.set(k, [...(byRoom.get(k) || []), r])
    }
  }
  const wd = (n: number) => WEEKDAYS.find((w) => w.n === n)?.label ?? ""
  for (const [k, rs] of byTeacher) if (rs.length > 1) {
    const [, , pid] = k.split("@")
    out.push({ type: "teacher", date: rs[0].date, periodId: pid, label: `${wd(rs[0].weekday)} ${periodById(pid)?.label ?? pid} 教师重复占用`, recordIds: rs.map((r) => r.id) })
  }
  for (const [k, rs] of byRoom) if (rs.length > 1) {
    const [, , pid] = k.split("@")
    out.push({ type: "room", date: rs[0].date, periodId: pid, label: `${wd(rs[0].weekday)} ${periodById(pid)?.label ?? pid} 教室 ${rs[0].roomId} 二次占用`, recordIds: rs.map((r) => r.id) })
  }
  return out
}

export function recordMinutes(r: ImportRecord): number | null {
  if (!r.start || !r.end) return null
  return toMin(r.end) - toMin(r.start)
}
