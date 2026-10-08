// 我的教学 r3：同源模拟场景的类型、校历与纯派生。
// 场景素材来自 lib/mt/scenario.json（r3 交接包 fixtures，已移除 expected 测试答案）。
// 页面上的所有人数/课次/确认度都由此处函数从事实计算，不读取任何预期值。

import raw from "./scenario.json"
import { PERSONAS } from "@/lib/demo/nav"

/* ============================================================
 * 场景素材类型
 * ========================================================== */

export type Attendance = "NORMAL" | "LEAVE" | "LATE" | "EARLY_LEAVE" | "ABSENT" | "ELSEWHERE"
export type GradeHandling = "PENDING" | "CONFIRMED" | "EXPLICIT_EMPTY" | "NOT_APPLICABLE"
export type Origin = "UNSET" | "EXPLICIT" | "ROUTINE" | "APPROVED_LEAVE" | "MANUAL" | "NOT_APPLICABLE" | "EXPLICIT_EMPTY"

export interface SStudent {
  id: string
  name: string
  homeroom_id: string
  membership_from: string
  membership_until: string
  has_verified_guardian_contact: boolean
}
export interface STask {
  id: string
  class_id: string
  duty_id: string | null
  teacher_id: string
  student_ids: string[]
  label: string
  course_id: string
  valid_from: string
  valid_through: string
}
export interface SLesson {
  id: string
  task_id: string
  actual_date: string
  period_id: string
  room_id: string | null
  status: string
  applied: boolean
  is_non_teaching_activity: boolean
  /** 由周规则展开的课次记录其来源课次 */
  rule_of?: string
}
export interface SPeriodDef {
  id: string
  number: number
  start: string
  end: string
}
interface SRecord {
  id: string
  task_id: string
  date: string
  student_id: string
  attendance: Attendance | null
  attendance_confirmed: boolean
  classroom_grade: string | null
  grade_handling: GradeHandling
  internal_reason?: string | null
  source_lesson_ids: string[]
  pending_conflict: boolean
  field_origins: { attendance: string; grade: string }
  leave_source_id?: string
  attendance_covered_lesson_ids: string[]
  grade_covered_lesson_ids: string[]
}
export interface SLeave {
  id: string
  student_id: string
  date: string
  kind: string
  internal_reason: string | null
  outbound_reason: string | null
  /** 部分时段请假：仅这些节次 */
  period_ids?: string[]
}
interface SAssignment {
  id: string
  task_id: string
  title: string
  issued_at: string
  deadline: string | null
  recipient_ids: string[]
  default_requirement: "REQUIRED" | "OPTIONAL"
  is_published: boolean
  results: {
    student_id: string
    participation: string
    submission: string | null
    submission_confirmed?: boolean
    quality: string | null
    quality_confirmed?: boolean
  }[]
  requirement_overrides?: { student_id: string; requirement: string }[]
}
interface SPublication {
  id: string
  task_id: string
  feedback_period_id: string
  revision: number
  published_at: string
  classroom_coverage: string[]
  assignment_ids: string[]
  audience_reference_date: string
  student_ids: string[]
  public_summary: string
  classroom_snapshot: { student_id: string; date: string; attendance: string; classroom_grade: string | null }[]
}
interface SVariant {
  id: string
  add_period_definitions?: SPeriodDef[]
  add_lessons?: SLesson[]
  clock_now?: string
}

interface Scenario {
  school: { id: string; name: string; timezone: string }
  term: { id: string; start: string; end: string }
  period: { id: string; start: string; end_inclusive: string; week_number: number }
  clock: { now: string }
  homerooms: { id: string; name: string; student_ids: string[] }[]
  teachers: { id: string; account_id: string; display_name: string; permitted_task_ids: string[] }[]
  courses: { id: string; name: string; subject: string }[]
  classes: { id: string; name: string; subject: string; scheduling_homeroom_id: string }[]
  duties: { id: string; class_id: string; normative_label: string }[]
  students: SStudent[]
  tasks: STask[]
  period_definitions: SPeriodDef[]
  rooms: { id: string; name: string }[]
  lessons: SLesson[]
  classroom_records: SRecord[]
  leave_sources: SLeave[]
  assignments: SAssignment[]
  plans: {
    id: string
    task_id: string
    state: string
    items: { title: string; content_points: string[]; estimated_lessons: number; objectives: string | null; notes: string | null }[]
    estimated_progress: number
  }[]
  publications: SPublication[]
  task_display_preferences: { teacher_id: string; task_id: string; custom_enabled: boolean; text: string }[]
  lesson_display_overrides: { teacher_id: string; lesson_id: string; custom_enabled: boolean; text: string }[]
  scenario_variants: SVariant[]
}

export const SC = raw as unknown as Scenario

/** 大班分页演示：38/72/123 人隔离任务；归属虚拟教师，仅在原型演示控制开启后并入当前教师可见范围 */
export const BIG_DEMO_TEACHER = "TEACHER_BIG_DEMO"
export const BIG_DEMO_SIZES = [38, 72, 123] as const
export const BIG_DEMO_TASK_IDS = BIG_DEMO_SIZES.map((n) => `TASK_BIG_${n}`)
;(() => {
  if (SC.tasks.some((t) => t.id === BIG_DEMO_TASK_IDS[0])) return
  const pad = (i: number) => String(i).padStart(3, "0")
  const max = Math.max(...BIG_DEMO_SIZES)
  const ids = Array.from({ length: max }, (_, i) => `DEMO_BIG_${pad(i + 1)}`)
  SC.homerooms.push({ id: "HR_BIG", name: "大班演示", student_ids: ids })
  for (const id of ids) {
    SC.students.push({
      id,
      name: `大班学生${id.slice(-3)}`,
      homeroom_id: "HR_BIG",
      membership_from: "2026-09-01",
      membership_until: "2027-01-31",
      has_verified_guardian_contact: true,
    } as SStudent)
  }
  const course = SC.courses[SC.courses.length - 1]
  const slots: [string, string][] = [
    ["2026-09-28", "PERIOD_5"],
    ["2026-09-29", "PERIOD_5"],
    ["2026-09-30", "PERIOD_5"],
  ]
  const tpl = SC.lessons[0]
  BIG_DEMO_SIZES.forEach((n, i) => {
    const classId = `CLASS_BIG_${n}`
    const taskId = BIG_DEMO_TASK_IDS[i]
    const sids = ids.slice(0, n)
    SC.classes.push({ id: classId, name: `大班演示${n}人 • ${course.subject}`, subject: course.subject, scheduling_homeroom_id: "HR_BIG" })
    SC.tasks.push({
      id: taskId,
      class_id: classId,
      duty_id: null,
      teacher_id: BIG_DEMO_TEACHER,
      student_ids: sids,
      label: `大班演示${n}人 • ${course.subject}`,
      course_id: course.id,
      valid_from: "2026-09-01",
      valid_through: "2027-01-31",
    })
    SC.lessons.push({ ...tpl, id: `LESSON_BIG_${n}`, task_id: taskId, actual_date: slots[i][0], period_id: slots[i][1], room_id: "ROOM_D105" })
    SC.assignments.push({
      id: `HW_BIG_${n}`,
      task_id: taskId,
      title: `大班分页演示作业（${n}人）`,
      issued_at: `${slots[i][0]}T12:00:00+08:00`,
      deadline: "2026-09-30T12:00:00+08:00",
      recipient_ids: sids,
      default_requirement: "REQUIRED",
      is_published: true,
      results: [],
    } as unknown as SAssignment)
  })
})()

export const SCHOOL = SC.school
export const TERM = SC.term
export const STUDENTS = SC.students
export const TASKS = SC.tasks
export const TEACHERS = SC.teachers
export const HOMEROOMS = SC.homerooms
export const CLASSES = SC.classes
export const DUTIES = SC.duties
export const ROOMS = SC.rooms
export const COURSES = SC.courses

/* ============================================================
 * 演示变体与时钟（显式原型时钟，不读系统日期）
 * ========================================================== */

export type VariantId = "BASE" | "ADJACENT_LESSONS" | "SEPARATED_LESSONS" | "MIDDAY_PARTIAL"

export const VARIANTS: { id: VariantId; label: string; desc: string }[] = [
  { id: "BASE", label: "基线（第5周 · 9/30 18:00）", desc: "10个本人课次，56条已发生日记录" },
  { id: "ADJACENT_LESSONS", label: "连堂：计算机周三第1+2节", desc: "课���11张，日记录不翻倍" },
  { id: "SEPARATED_LESSONS", label: "不连续：P1周一第3、5节", desc: "两张卡、各自时间" },
  { id: "MIDDAY_PARTIAL", label: "部分当天：连堂 + 9/30 08:45", desc: "第一课已结束、第二课未开始" },
]

export const CLOCK_PRESETS: { iso: string; label: string }[] = [
  { iso: "2026-09-30T08:45:00+08:00", label: "9/30（周三）08:45" },
  { iso: "2026-09-30T09:35:00+08:00", label: "9/30（周三）09:35" },
  { iso: "2026-09-30T18:00:00+08:00", label: "9/30（周三）18:00" },
  { iso: "2026-10-01T18:00:00+08:00", label: "10/1（周四）18:00" },
  { iso: "2026-10-04T18:00:00+08:00", label: "10/4（周日）18:00" },
  { iso: "2026-10-07T18:00:00+08:00", label: "10/7（下周三）18:00" },
]

export function variantInitialClock(v: VariantId): string {
  if (v === "MIDDAY_PARTIAL") return "2026-09-30T08:45:00+08:00"
  return SC.clock.now
}

/** 变体专用的附加请假来源（部分时段），用于核对“上午请假/下午出勤” */
function variantLeaves(v: VariantId): SLeave[] {
  if (v === "ADJACENT_LESSONS" || v === "MIDDAY_PARTIAL") {
    return [
      {
        id: "LEAVE_PARTIAL_21",
        student_id: "DEMO_STU_21",
        date: "2026-09-30",
        kind: "APPROVED_PARTIAL",
        internal_reason: "看牙医",
        outbound_reason: null,
        period_ids: ["PERIOD_2"],
      },
    ]
  }
  return []
}

function variantSource(v: VariantId): SVariant | null {
  if (v === "BASE") return null
  const id = v === "MIDDAY_PARTIAL" ? "ADJACENT_LESSONS" : v
  return SC.scenario_variants.find((x) => x.id === id) ?? null
}

export function periodDefs(v: VariantId): SPeriodDef[] {
  const extra = variantSource(v)?.add_period_definitions ?? []
  return [...SC.period_definitions, ...extra].sort((a, b) => a.number - b.number)
}

export function leaveSources(v: VariantId): SLeave[] {
  return [...SC.leave_sources, ...variantLeaves(v)]
}

/* ============================================================
 * 校历：第1周 = 学期开始日所在周（周一开始）；学校时区 Asia/Shanghai
 * 日期均以 YYYY-MM-DD 字符串运算，避免浏览器时区造成多一天/少一天
 * ========================================================== */

const DAY = 86400000
function toUTC(d: string): number {
  const [y, m, dd] = d.split("-").map(Number)
  return Date.UTC(y, m - 1, dd)
}
function fromUTC(t: number): string {
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}
export function addDays(d: string, n: number): string {
  return fromUTC(toUTC(d) + n * DAY)
}
/** 0=周一 … 6=周日 */
export function weekdayIdx(d: string): number {
  return (new Date(toUTC(d)).getUTCDay() + 6) % 7
}
export const WEEKDAY_CN = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
export function mondayOf(d: string): string {
  return addDays(d, -weekdayIdx(d))
}
const WEEK1_MONDAY = mondayOf(TERM.start)
export const MAX_WEEK = Math.floor((toUTC(mondayOf(TERM.end)) - toUTC(WEEK1_MONDAY)) / (7 * DAY)) + 1

export function weekOfDate(d: string): number {
  return Math.floor((toUTC(mondayOf(d)) - toUTC(WEEK1_MONDAY)) / (7 * DAY)) + 1
}
export function weekStart(n: number): string {
  return addDays(WEEK1_MONDAY, (n - 1) * 7)
}
export function weekDates(n: number): string[] {
  const s = weekStart(n)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}
/** 反馈周期稳定ID（周号只是显示，不是唯一ID） */
export function feedbackPeriodId(n: number): string {
  return `${TERM.id}:W${n}`
}
export function periodIdToWeek(pid: string): number | null {
  const m = /^(?:TERM_DEMO:W|WEEK_DEMO_)(\d+)$/.exec(pid)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= MAX_WEEK ? n : null
}
export function fmtMD(d: string): string {
  const [, m, dd] = d.split("-")
  return `${Number(m)}/${Number(dd)}`
}
export function weekRangeLabel(n: number): string {
  const ds = weekDates(n)
  return `${fmtMD(ds[0])}–${fmtMD(ds[6])}`
}
export function dateOfClock(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso))
}
export function clockLabel(iso: string): string {
  const d = dateOfClock(iso)
  return `${fmtMD(d)}（${WEEKDAY_CN[weekdayIdx(d)]}）${iso.slice(11, 16)}`
}
export function addDaysIso(iso: string, n: number): string {
  return `${addDays(dateOfClock(iso), n)}${iso.slice(10)}`
}
function tsOf(date: string, hhmm: string): number {
  return Date.parse(`${date}T${hhmm}:00+08:00`)
}

/* ============================================================
 * 课次：已应用安排 + 同一周规则展开的后续周（只展开工作日常规课）
 * ========================================================== */

const SCENARIO_WEEK = SC.period.week_number
const LAST_EXPANDED_WEEK = SCENARIO_WEEK + 3

export function allLessons(v: VariantId): SLesson[] {
  const base = [...SC.lessons, ...(variantSource(v)?.add_lessons ?? [])].filter(
    (l) => l.applied && l.status === "EFFECTIVE" && !l.is_non_teaching_activity,
  )
  const out: SLesson[] = [...base]
  for (let w = SCENARIO_WEEK + 1; w <= LAST_EXPANDED_WEEK; w++) {
    for (const l of base) {
      if (weekdayIdx(l.actual_date) >= 5) continue // 周末补课是单次安排，不按周重复
      out.push({ ...l, id: `${l.id}~W${w}`, actual_date: addDays(l.actual_date, (w - SCENARIO_WEEK) * 7), rule_of: l.id })
    }
  }
  return out
}

export interface LessonView extends SLesson {
  period: SPeriodDef
  room: string | null
  endTs: number
  startTs: number
  /** 完整课表中的课次坐标 key（r4 同源解析） */
  scheduleKey?: string
  /** 调休补课：来源日 */
  makeupFrom?: string
  /** 完整课表中的本课备注 */
  scheduleNote?: string
}

/* ------------------------------------------------------------
 * r4：课次同源。
 * 「我的教学」不再自有课次数组：每周课次由 lib/schedule/bridge.tsx 注册的
 * 解析器提供——即完整「我的课表」使用的同一份「已采用学校版本 + 已应用个人调整 + 校历」投影。
 * 场景 fixture 中的 lessons 只用于为已发生的第5周课次保留稳定ID（课堂记录/课次覆盖引用它）。
 * ---------------------------------------------------------- */

export interface EffectiveLessonInput {
  key: string
  taskId: string
  date: string
  periodNo: number
  start: string
  end: string
  room: string | null
  makeupFrom?: string
  /** 完整课表中的本课备注（课前安排性文字，仅显示，不转为课后观察） */
  note?: string
}
export type ScheduleRead =
  | { status: "ok"; lessons: EffectiveLessonInput[]; fullHoliday?: boolean; exclusions?: { date: string; reason: string }[] }
  | { status: "error"; message: string }
  | { status: "unconfirmed"; message: string }

let scheduleSource: ((weekStartIso: string, teacherId?: string) => ScheduleRead) | null = null
export function setScheduleSource(fn: ((weekStartIso: string, teacherId?: string) => ScheduleRead) | null) {
  scheduleSource = fn
}
export function scheduleReadOfWeek(week: number, teacherId?: string): ScheduleRead {
  if (!scheduleSource) return { status: "unconfirmed", message: "课表尚未载入" }
  return scheduleSource(weekStart(week), teacherId)
}

function stableLessonId(e: EffectiveLessonInput, week: number): string {
  const wd = weekdayIdx(e.date)
  const pdNo = (id: string) => SC.period_definitions.find((p) => p.id === id)?.number
  const base = SC.lessons.find(
    (l) => l.task_id === e.taskId && weekdayIdx(l.actual_date) === wd && pdNo(l.period_id) === e.periodNo,
  )
  if (base && !e.makeupFrom) {
    if (base.actual_date === e.date) return base.id
    if (weekdayIdx(base.actual_date) < 5) return `${base.id}~W${week}`
  }
  return `TT:${e.key}@${e.date}`
}

function lessonFromSchedule(e: EffectiveLessonInput, week: number): LessonView {
  const id = stableLessonId(e, week)
  const period: SPeriodDef = { id: `PERIOD_${e.periodNo}`, number: e.periodNo, start: e.start, end: e.end }
  return {
    id,
    task_id: e.taskId,
    actual_date: e.date,
    period_id: period.id,
    room_id: ROOMS.find((r) => r.name === e.room)?.id ?? null,
    status: "EFFECTIVE",
    applied: true,
    is_non_teaching_activity: false,
    rule_of: id.includes("~W") ? id.split("~W")[0] : undefined,
    period,
    room: e.room,
    startTs: tsOf(e.date, e.start),
    endTs: tsOf(e.date, e.end),
    scheduleKey: e.key,
    makeupFrom: e.makeupFrom,
    scheduleNote: e.note,
  }
}
export function lessonView(l: SLesson, v: VariantId): LessonView {
  const period = periodDefs(v).find((p) => p.id === l.period_id)!
  return {
    ...l,
    period,
    room: ROOMS.find((r) => r.id === l.room_id)?.name ?? null,
    startTs: tsOf(l.actual_date, period.start),
    endTs: tsOf(l.actual_date, period.end),
  }
}
export function lessonsOfWeek(_v: VariantId, week: number, taskIds: string[]): LessonView[] {
  const read = scheduleReadOfWeek(week)
  if (read.status !== "ok") return []
  const dates = new Set(weekDates(week))
  const big = BIG_DEMO_TASK_IDS.filter((id) => taskIds.includes(id)).flatMap((id) => {
    const base = SC.lessons.find((l) => l.task_id === id)
    if (!base) return []
    const date = addDays(base.actual_date, (week - SCENARIO_WEEK) * 7)
    const lid = week === SCENARIO_WEEK ? base.id : `${base.id}~W${week}`
    return [lessonView({ ...base, id: lid, actual_date: date, rule_of: week === SCENARIO_WEEK ? undefined : base.id }, _v)]
  })
  return read.lessons
    .filter((e) => dates.has(e.date) && taskIds.includes(e.taskId))
    .map((e) => lessonFromSchedule(e, week))
    .concat(big)
    .sort((a, b) => a.startTs - b.startTs)
}
export function lessonTimeLabel(l: LessonView): string {
  return `第${l.period.number}节 · ${l.period.start}–${l.period.end}`
}

/* ============================================================
 * 任务、名单
 * ========================================================== */

export function taskById(id: string): STask | undefined {
  return TASKS.find((t) => t.id === id)
}
export function classOf(t: STask) {
  return CLASSES.find((c) => c.id === t.class_id)!
}
export function dutyOf(t: STask) {
  return t.duty_id ? DUTIES.find((d) => d.id === t.duty_id) ?? null : null
}
export function normativeLabel(t: STask): string | null {
  return dutyOf(t)?.normative_label ?? null
}
export function courseOf(t: STask) {
  return COURSES.find((c) => c.id === t.course_id) ?? null
}
export function studentById(id: string): SStudent | undefined {
  return STUDENTS.find((s) => s.id === id)
}
export function homeroomName(id: string): string {
  return HOMEROOMS.find((h) => h.id === id)?.name ?? id
}
/** 标准正式身份：班级 + 规范分工（整科无分工） */
export function formalTaskName(t: STask): string {
  const n = normativeLabel(t)
  return n ? `${classOf(t).name} · ${n}` : classOf(t).name
}

export interface Membership {
  studentId: string
  from: string
  until: string
}
export function seedMemberships(t: STask): Membership[] {
  return t.student_ids.map((sid) => {
    const s = studentById(sid)!
    return {
      studentId: sid,
      from: s.membership_from > t.valid_from ? s.membership_from : t.valid_from,
      until: s.membership_until < t.valid_through ? s.membership_until : t.valid_through,
    }
  })
}
export function isMemberOn(ms: Membership[], sid: string, date: string): boolean {
  return ms.some((m) => m.studentId === sid && m.from <= date && date <= m.until)
}
export function membersOn(ms: Membership[], date: string): string[] {
  return [...new Set(ms.filter((m) => m.from <= date && date <= m.until).map((m) => m.studentId))].sort()
}
/** 周内曾在读的学生（用于整周反馈行；逐日适用性另算） */
export function membersInWeek(ms: Membership[], week: number): string[] {
  const ds = weekDates(week)
  return [...new Set(ms.filter((m) => m.from <= ds[6] && ds[0] <= m.until).map((m) => m.studentId))].sort()
}

/* ============================================================
 * 课堂日记录
 * ========================================================== */

export interface LessonAtt {
  v: Attendance
  reason: string
  origin: Origin
  /** r3：状态切换后不再适用的原原因，保留可见可恢复，不冒充新状态原因 */
  prevReason?: { v: Attendance; text: string }
}
export interface Rec {
  key: string
  taskId: string
  date: string
  studentId: string
  /** 每个原课次的出勤（已处理即存在） */
  att: Record<string, LessonAtt>
  grade: string | null
  gradeHandling: GradeHandling
  gradeOrigin: Origin
  gradeCovered: string[]
  note: string
  conflict: boolean
  leaveSourceId: string | null
  revision: number
  /** 字段级版本，用于绑定保存目标、拒绝旧响应 */
  fieldRev: Record<string, number>
  stamp: number
  /** r4：因出勤更正而失效的旧评价（只作变更历史，不再是当前有效结果） */
  gradeVoided?: GradeVoid[]
  /** 兼容旧存储标记；参加日读取和写入时自动清除，不再要求教师核对。 */
  coverageReview?: boolean
}
export interface GradeVoid {
  grade: string | null
  handling: GradeHandling
  covered: string[]
  at: string
  reason: string
}
export function recKey(taskId: string, date: string, sid: string) {
  return `${taskId}|${date}|${sid}`
}
export function blankRec(taskId: string, date: string, sid: string): Rec {
  return {
    key: recKey(taskId, date, sid),
    taskId,
    date,
    studentId: sid,
    att: {},
    grade: null,
    gradeHandling: "PENDING",
    gradeOrigin: "UNSET",
    gradeCovered: [],
    note: "",
    conflict: false,
    leaveSourceId: null,
    revision: 0,
    fieldRev: {},
    stamp: 0,
  }
}
export function seedRecords(clockIso: string): Record<string, Rec> {
  const out: Record<string, Rec> = {}
  const nowTs = Date.parse(clockIso)
  for (const r of SC.classroom_records) {
    // 基线记录在当日 18:00 前后录入；更早的验证时钟重建该时点数据，不把晚上的确认带回上午
    if (tsOf(r.date, "18:00") > nowTs) continue
    const att: Record<string, LessonAtt> = {}
    if (r.attendance && r.attendance_confirmed) {
      for (const l of r.attendance_covered_lesson_ids) {
        att[l] = {
          v: r.attendance,
          reason: r.internal_reason ?? (r.leave_source_id ? "" : ""),
          origin: (r.field_origins.attendance as Origin) ?? "EXPLICIT",
        }
      }
    }
    out[recKey(r.task_id, r.date, r.student_id)] = {
      key: recKey(r.task_id, r.date, r.student_id),
      taskId: r.task_id,
      date: r.date,
      studentId: r.student_id,
      att,
      grade: r.classroom_grade,
      gradeHandling: r.grade_handling,
      gradeOrigin: (r.field_origins.grade as Origin) ?? "UNSET",
      gradeCovered: [...r.grade_covered_lesson_ids],
      note: "",
      conflict: r.pending_conflict,
      leaveSourceId: r.leave_source_id ?? null,
      revision: 1,
      fieldRev: {},
      stamp: 0,
    }
  }
  return out
}

export const ABSENT_TYPES: Attendance[] = ["LEAVE", "ABSENT", "ELSEWHERE"]
export const EXCEPTION_TYPES: Attendance[] = ["LEAVE", "LATE", "EARLY_LEAVE", "ABSENT", "ELSEWHERE"]
export const ATT_LABEL: Record<Attendance, string> = {
  NORMAL: "正常",
  LEAVE: "请假",
  LATE: "迟到",
  EARLY_LEAVE: "早退",
  ABSENT: "缺勤",
  ELSEWHERE: "在他班",
}
/** 当前有效课堂评价字典：A＝优秀 */
export const GRADE_DICT: { v: string; label: string }[] = [
  { v: "A", label: "A 优秀" },
  { v: "B", label: "B 良好" },
  { v: "C", label: "C 合格" },
  { v: "D", label: "D 待改进" },
]

/* ============================================================
 * r4 课堂评价资格：只依据已确认��出勤事实与真实课次，不读显示文字。
 * 请假 / 缺勤 / 在他班 = 未出席本任务课堂；迟到 / 早退 = 实际参加了一部分。
 * 唯一判定来源：日记录、周矩阵、学生抽屉、常用/自由亮点、观察采用、常规确认与发布都读这里。
 * ========================================================== */

export type EligKind = "ELIGIBLE" | "ABSENT" | "NEEDS_ATT" | "FUTURE"
export interface DayElig {
  /** ELIGIBLE：有已发生且确认参加的课次；ABSENT：已发生课次全部确认未出席；NEEDS_ATT：无确认参加且出勤未知/冲突；FUTURE：尚无已发生课次 */
  kind: EligKind
  attended: string[]
  absent: string[]
  unknown: string[]
  future: string[]
}
export const ELIG_REASON: Record<EligKind, string> = {
  ELIGIBLE: "",
  ABSENT: "未出席，本日课堂评价与课堂亮点不适用",
  NEEDS_ATT: "出勤尚未核实，请先确认出勤",
  FUTURE: "课堂尚未发生",
}
export function isAbsentAtt(a: LessonAtt | undefined): boolean {
  return !!a && ABSENT_TYPES.includes(a.v)
}
export function isAttendedAtt(a: LessonAtt | undefined): boolean {
  return !!a && !ABSENT_TYPES.includes(a.v)
}
export function dayEligibility(rec: Rec | undefined, lessons: { id: string; endTs: number }[], nowTs: number): DayElig {
  const att = rec?.att ?? {}
  const e: DayElig = { kind: "FUTURE", attended: [], absent: [], unknown: [], future: [] }
  for (const l of lessons) {
    if (l.endTs > nowTs) e.future.push(l.id)
    else if (isAttendedAtt(att[l.id])) e.attended.push(l.id)
    else if (isAbsentAtt(att[l.id])) e.absent.push(l.id)
    else e.unknown.push(l.id)
  }
  if (e.attended.length) e.kind = "ELIGIBLE"
  else if (rec?.conflict || e.unknown.length) e.kind = "NEEDS_ATT"
  else if (e.absent.length) e.kind = "ABSENT"
  return e
}
/** 单课次参加情况（亮点明确关联某节课时使用） */
export function lessonParticipation(e: DayElig, lessonId: string): "ATTENDED" | "ABSENT" | "UNKNOWN" | "FUTURE" | "NONE" {
  if (e.attended.includes(lessonId)) return "ATTENDED"
  if (e.absent.includes(lessonId)) return "ABSENT"
  if (e.unknown.includes(lessonId)) return "UNKNOWN"
  if (e.future.includes(lessonId)) return "FUTURE"
  return "NONE"
}
export const PARTICIPATION_REASON = {
  ABSENT: "该课次学生未出席，不能作为课堂亮点依据",
  UNKNOWN: "该课次出勤尚未核实",
  FUTURE: "该课次尚未发生",
  NONE: "该课次不属于本日本任务",
} as const

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

/**
 * 出勤改变后的评价联动（纯函数，同一原子写入中调用）：
 * - 全部已发生课次均未出席：当前等级失效为系统“不适用（未出席）”，旧值转入 gradeVoided 历史；
 * - 仍有真实参加：评价仅覆盖参加课次，自动移出缺勤课次，不要求重复核对；
 * - 从不适用恢复为有参加：只恢复为待处理，绝不自动复活旧等级。
 */
export function reconcileGrade(r: Rec, e: DayElig, at: string, why: string): Rec {
  const had = r.grade !== null || r.gradeHandling === "CONFIRMED" || r.gradeHandling === "EXPLICIT_EMPTY"
  if (e.kind === "ABSENT") {
    if (r.gradeHandling === "NOT_APPLICABLE" && r.grade === null && sameSet(r.gradeCovered, e.absent) && !r.coverageReview) return r
    return {
      ...r,
      grade: null,
      gradeHandling: "NOT_APPLICABLE",
      gradeOrigin: "NOT_APPLICABLE",
      gradeCovered: [...e.absent],
      coverageReview: false,
      gradeVoided: had ? [...(r.gradeVoided ?? []), { grade: r.grade, handling: r.gradeHandling, covered: [...r.gradeCovered], at, reason: why }] : r.gradeVoided,
    }
  }
  if (r.gradeHandling === "NOT_APPLICABLE") {
    if (e.kind === "FUTURE") return r
    return { ...r, grade: null, gradeHandling: "PENDING", gradeOrigin: "UNSET", gradeCovered: [], coverageReview: false }
  }
  const stale = r.gradeCovered.filter((id) => e.absent.includes(id))
  if (e.kind === "ELIGIBLE" && (stale.length || r.coverageReview) && (r.gradeHandling === "CONFIRMED" || r.gradeHandling === "EXPLICIT_EMPTY")) {
    return { ...r, gradeCovered: r.gradeCovered.filter((id) => !stale.includes(id)), coverageReview: false }
  }
  return r
}

export type DayState = "FUTURE" | "NOT_APPLICABLE" | "PROCESSED" | "PENDING"

export interface StudentDay {
  taskId: string
  date: string
  studentId: string
  lessons: LessonView[]
  elapsed: LessonView[]
  rec: Rec
  exists: boolean
  state: DayState
  leaves: SLeave[]
  /** 已发生但未处理的原课次（出勤维度） */
  attMissing: string[]
  gradeMissing: boolean
  exception: boolean
  /** r4：评价资格（唯一判定） */
  elig: DayElig
  /** r4：当前有效等级 / 处理状态投影。所有视图、统计、预览与发布只读这两个值，不直接读 rec.grade */
  gradeEff: string | null
  handlingEff: GradeHandling
  /** 兼容旧视图结构；部分缺勤不再产生覆盖冲突。 */
  coverageReview: boolean
}

export function leavesFor(leaves: SLeave[], sid: string, date: string, lessons: LessonView[]): SLeave[] {
  return leaves.filter(
    (l) =>
      l.student_id === sid &&
      l.date === date &&
      (!l.period_ids || lessons.some((x) => l.period_ids!.includes(x.period_id))),
  )
}
export function leaveCoversLesson(l: SLeave, lesson: LessonView): boolean {
  return !l.period_ids || l.period_ids.includes(lesson.period_id)
}

export function buildStudentDay(args: {
  taskId: string
  date: string
  studentId: string
  lessons: LessonView[]
  nowTs: number
  rec: Rec | undefined
  applicable: boolean
  leaves: SLeave[]
}): StudentDay {
  const { taskId, date, studentId, lessons, nowTs, applicable } = args
  const storedRec = args.rec ?? blankRec(taskId, date, studentId)
  const elapsed = lessons.filter((l) => l.endTs <= nowTs)
  const leaves = leavesFor(args.leaves, studentId, date, lessons)
  const attMissing = elapsed.filter((l) => !storedRec.att[l.id]).map((l) => l.id)
  const elig = dayEligibility(storedRec, lessons, nowTs)
  const rec = elig.kind === 'ELIGIBLE' ? reconcileGrade(storedRec, elig, '', '') : storedRec
  // 读取投影：即使存储中残留“未出席 + 等级”，也绝不作为有效评价呈现或输出
  let gradeEff: string | null = rec.grade
  let handlingEff: GradeHandling = rec.gradeHandling
  if (elig.kind === "ABSENT") {
    gradeEff = null
    handlingEff = "NOT_APPLICABLE"
  } else if (elig.kind !== "ELIGIBLE" || rec.gradeHandling === "NOT_APPLICABLE") {
    gradeEff = null
    handlingEff = rec.gradeHandling === "EXPLICIT_EMPTY" && elig.kind === "ELIGIBLE" ? "EXPLICIT_EMPTY" : "PENDING"
  }
  const confirmed = handlingEff === "CONFIRMED" || handlingEff === "EXPLICIT_EMPTY"
  const coverageReview = false
  const gradeHandled =
    elig.kind === "ABSENT" || (elig.kind === "ELIGIBLE" && confirmed && elig.attended.every((id) => rec.gradeCovered.includes(id)))
  const exception = Object.values(rec.att).some((a) => a.v !== "NORMAL")
  let state: DayState
  if (!applicable) state = "NOT_APPLICABLE"
  else if (elapsed.length === 0) state = "FUTURE"
  else if (attMissing.length === 0 && gradeHandled && !rec.conflict) state = "PROCESSED"
  else state = "PENDING"
  return {
    taskId,
    date,
    studentId,
    lessons,
    elapsed,
    rec,
    exists: !!args.rec,
    state,
    leaves,
    attMissing,
    gradeMissing: !gradeHandled,
    exception,
    elig,
    gradeEff,
    handlingEff,
    coverageReview,
  }
}

/* ============================================================
 * 常规确认：全体批量与逐生共用同一规则
 * ========================================================== */

export interface RoutinePlanItem {
  key: string
  taskId: string
  date: string
  studentId: string
  writeAtt: string[] // 将写入“正常”的原课次
  writeGrade: boolean // 将写入该对象标准的常规默认等级
  extendGrade: string[] // 已有常规等级延伸到新发生课次
  /** 写入的���级与其所属修订（来自对象已绑定或本期有效标准） */
  gradeValue: string | null
  revId: string
  /** 标准未设常规默认等级：只处理出勤，评价仍需教师判断 */
  gradeNeedsJudgement: boolean
  /** 日记录出勤快速处理：班主任请假准确覆盖的原课次直接关��为“请假” */
  leaveAtt?: string[]
  leaveSourceId?: string
}
/** 常规确认读取的对象标准 */
export type RoutineStandard = (d: StudentDay) => { revId: string; defaultLevelId: string | null; defaultText: string | null }
export interface RoutineSkip {
  key: string
  studentId: string
  date: string
  reason: string
}
export interface RoutinePlan {
  items: RoutinePlanItem[]
  skipped: RoutineSkip[]
  futureDays: number
  alreadyDone: number
  notApplicable: number
}

export function planRoutine(days: StudentDay[], standard: RoutineStandard): RoutinePlan {
  const plan: RoutinePlan = { items: [], skipped: [], futureDays: 0, alreadyDone: 0, notApplicable: 0 }
  for (const d of days) {
    if (d.state === "NOT_APPLICABLE") {
      plan.notApplicable++
      continue
    }
    if (d.state === "FUTURE") {
      plan.futureDays++
      continue
    }
    const r = d.rec
    const skip = (reason: string) => plan.skipped.push({ key: r.key, studentId: d.studentId, date: d.date, reason })
    // 已确认未出席：不覆盖为正常，不写默认等级或亮点
    if (d.elig.kind === "ABSENT") {
      skip("已确认未出席，课堂评价不适用")
      continue
    }
    if (d.state === "PROCESSED") {
      plan.alreadyDone++
      continue
    }
    if (r.conflict) {
      skip("存在待核对矛盾")
      continue
    }
    const unmappedLeave = d.leaves.some((lv) => d.elapsed.some((l) => leaveCoversLesson(lv, l) && !r.att[l.id]))
    if (unmappedLeave) {
      skip("有班主任请假来源，需人工核对实际出勤")
      continue
    }
    if (Object.values(r.att).some((a) => ABSENT_TYPES.includes(a.v))) {
      skip("部分课次未出席，需逐生处理")
      continue
    }
    if (Object.values(r.att).some((a) => a.v !== "NORMAL")) {
      skip("已有考勤例外，需人工处理")
      continue
    }
    const std = standard(d)
    const h = d.handlingEff
    if (h === "EXPLICIT_EMPTY") {
      skip("评价已明确清空，不以常规默认重填")
      continue
    }
    if (h === "CONFIRMED" && (!std.defaultLevelId || d.gradeEff !== std.defaultLevelId)) {
      skip("已有手动等级，出勤需人工核对")
      continue
    }
    const writeAtt = d.attMissing
    const gradeNeedsJudgement = h === "PENDING" && !std.defaultLevelId
    const writeGrade = h === "PENDING" && !!std.defaultLevelId
    const extendGrade = h === "CONFIRMED" ? d.elapsed.filter((l) => !r.gradeCovered.includes(l.id)).map((l) => l.id) : []
    if (!writeAtt.length && !writeGrade && !extendGrade.length) {
      skip(gradeNeedsJudgement ? "评价标准未设常规默认等级，需教师判断" : "无可常规处理的字段")
      continue
    }
    plan.items.push({
      key: r.key,
      taskId: d.taskId,
      date: d.date,
      studentId: d.studentId,
      writeAtt,
      writeGrade,
      extendGrade,
      gradeValue: writeGrade ? std.defaultLevelId : null,
      revId: std.revId,
      gradeNeedsJudgement,
    })
  }
  return plan
}

export function applyRoutineItem(r: Rec, it: RoutinePlanItem, elapsedIds: string[], stamp: number): Rec {
  const att = { ...r.att }
  for (const l of it.writeAtt) att[l] = { v: "NORMAL", reason: "", origin: "ROUTINE" }
  for (const l of it.leaveAtt ?? []) att[l] = { v: "LEAVE", reason: att[l]?.reason ?? "", origin: "APPROVED_LEAVE" }
  const next: Rec = { ...r, att, revision: r.revision + 1, stamp, fieldRev: { ...r.fieldRev } }
  if (it.leaveSourceId) next.leaveSourceId = it.leaveSourceId
  for (const l of [...it.writeAtt, ...(it.leaveAtt ?? [])]) next.fieldRev[`att:${l}`] = (next.fieldRev[`att:${l}`] ?? 0) + 1
  if (it.writeGrade && it.gradeValue) {
    next.grade = it.gradeValue
    next.gradeHandling = "CONFIRMED"
    next.gradeOrigin = "ROUTINE"
    next.gradeCovered = [...elapsedIds]
    next.fieldRev.grade = (next.fieldRev.grade ?? 0) + 1
  } else if (it.extendGrade.length) {
    next.gradeCovered = [...new Set([...r.gradeCovered, ...it.extendGrade])]
    next.fieldRev.grade = (next.fieldRev.grade ?? 0) + 1
  }
  return next
}

/**
 * 按日记录 · 出勤快速处理：只补已发生、适用、尚未处理的原课次出勤；不连带任何评价。
 * 班主任请假准确覆盖的课次直接关联为请假；其余记为正常。
 */
export function planDayAttendance(days: StudentDay[]): RoutinePlan {
  const plan: RoutinePlan = { items: [], skipped: [], futureDays: 0, alreadyDone: 0, notApplicable: 0 }
  for (const d of days) {
    if (d.state === "NOT_APPLICABLE") {
      plan.notApplicable++
      continue
    }
    if (d.state === "FUTURE") {
      plan.futureDays++
      continue
    }
    if (!d.attMissing.length) {
      plan.alreadyDone++
      continue
    }
    const r = d.rec
    if (r.conflict) {
      plan.skipped.push({ key: r.key, studentId: d.studentId, date: d.date, reason: "存在待核对矛盾" })
      continue
    }
    const missing = d.elapsed.filter((l) => d.attMissing.includes(l.id))
    const leaveAtt: string[] = []
    let leaveSourceId: string | undefined
    for (const l of missing) {
      const lv = d.leaves.find((x) => leaveCoversLesson(x, l))
      if (lv) {
        leaveAtt.push(l.id)
        leaveSourceId = lv.id
      }
    }
    plan.items.push({
      key: r.key,
      taskId: d.taskId,
      date: d.date,
      studentId: d.studentId,
      writeAtt: missing.filter((l) => !leaveAtt.includes(l.id)).map((l) => l.id),
      writeGrade: false,
      extendGrade: [],
      gradeValue: null,
      revId: "",
      gradeNeedsJudgement: false,
      leaveAtt,
      leaveSourceId,
    })
  }
  return plan
}

/**
 * 按日记录 · 沿用确认：阶段记录后新增课次已发生时，保留已有日评价（含明确不评价）与备注，
 * 只把评价覆盖扩展到新发生的适用课次。不改等级、不写默认值、不碰出勤。
 */
export function planCarryForward(days: StudentDay[]): RoutinePlan {
  const plan: RoutinePlan = { items: [], skipped: [], futureDays: 0, alreadyDone: 0, notApplicable: 0 }
  for (const d of days) {
    if (d.state === "NOT_APPLICABLE") {
      plan.notApplicable++
      continue
    }
    if (d.state === "FUTURE") {
      plan.futureDays++
      continue
    }
    const r = d.rec
    if (d.elig.kind === "ABSENT") {
      plan.alreadyDone++
      continue
    }

    const handled = d.handlingEff === "CONFIRMED" || d.handlingEff === "EXPLICIT_EMPTY"
    // 只沿用到新发生且确认参加的课次；缺席课次不能通过“本日综合”获得评价资格
    const newLessons = d.elig.attended.filter((id) => !r.gradeCovered.includes(id))
    if (!handled) {
      if (d.gradeMissing) plan.skipped.push({ key: r.key, studentId: d.studentId, date: d.date, reason: "尚无本日评价，需教师评价或常规确认" })
      else plan.alreadyDone++
      continue
    }
    if (!newLessons.length) {
      plan.alreadyDone++
      continue
    }
    if (r.conflict) {
      plan.skipped.push({ key: r.key, studentId: d.studentId, date: d.date, reason: "存在待核对矛盾" })
      continue
    }
    plan.items.push({
      key: r.key,
      taskId: d.taskId,
      date: d.date,
      studentId: d.studentId,
      writeAtt: [],
      writeGrade: false,
      extendGrade: newLessons,
      gradeValue: null,
      revId: "",
      gradeNeedsJudgement: false,
    })
  }
  return plan
}

/* ============================================================
 * 个人显示：任务默认 + 课次覆盖
 * ========================================================== */

export interface DisplayPref {
  enabled: boolean
  text: string
  /** 仅任务级：显示实际关联课程名称（默认关闭）。课次覆盖不携带此项。 */
  showCourse?: boolean
}

/**
 * 个人课卡/任务显示解析（我的教学列表、本周教学安排、完整本人课表共用）。
 * 课程显隐与分工替代分别处理；空值直接省略，不留分隔符。
 */
export function personalDisplay(
  t: STask,
  teacherId: string,
  taskPrefs: Record<string, DisplayPref>,
  lessonOverrides: Record<string, DisplayPref>,
  lessonId?: string,
): { className: string; subject: string; division: string | null; course: string | null } {
  const cls = classOf(t)
  const division = resolveLabel(t, teacherId, taskPrefs, lessonOverrides, lessonId).text
  const showCourse = !!taskPrefs[prefKey(teacherId, t.id)]?.showCourse
  return { className: cls.name, subject: cls.subject ?? courseOf(t)?.subject ?? "", division, course: showCourse ? courseOf(t)?.name ?? null : null }
}
export function prefKey(teacherId: string, id: string) {
  return `${teacherId}|${id}`
}
export function resolveLabel(
  t: STask,
  teacherId: string,
  taskPrefs: Record<string, DisplayPref>,
  lessonOverrides: Record<string, DisplayPref>,
  lessonId?: string,
): { text: string | null; source: "LESSON" | "TASK" | "NORMATIVE" | "NONE" } {
  const normative = normativeLabel(t)
  if (lessonId) {
    const ov = lessonOverrides[prefKey(teacherId, lessonId)]
    if (ov) {
      if (ov.enabled && ov.text.trim()) return { text: ov.text.trim(), source: "LESSON" }
      return normative ? { text: normative, source: "NORMATIVE" } : { text: null, source: "NONE" }
    }
  }
  const tp = taskPrefs[prefKey(teacherId, t.id)]
  if (tp?.enabled && tp.text.trim()) return { text: tp.text.trim(), source: "TASK" }
  return normative ? { text: normative, source: "NORMATIVE" } : { text: null, source: "NONE" }
}

export function seedTaskPrefs(): Record<string, DisplayPref> {
  const o: Record<string, DisplayPref> = {}
  for (const p of SC.task_display_preferences) o[prefKey(p.teacher_id, p.task_id)] = { enabled: p.custom_enabled, text: p.text }
  return o
}
export function seedLessonOverrides(): Record<string, DisplayPref> {
  const o: Record<string, DisplayPref> = {}
  for (const p of SC.lesson_display_overrides) o[prefKey(p.teacher_id, p.lesson_id)] = { enabled: p.custom_enabled, text: p.text }
  return o
}

/* ============================================================
 * 作业（按真实任务，不按课堂日期）
 * ========================================================== */

export type Requirement = "REQUIRED" | "OPTIONAL" | "EXEMPT"
export type Submission = "ON_TIME" | "LATE" | "SUBMITTED" | "MISSING"
export interface HwResult {
  questionScores?: Record<string, number | null>
  participating?: boolean // 选做：是否参与；未知为 undefined
  submission: Submission | null
  /** 未交是否已核实；未核实的“疑似未交”不能作为已证实负面结果 */
  submissionConfirmed: boolean
  quality: string | null
  score: number | null
  /** 明确不评价（与从未填写不同） */
  noGrade?: boolean
  /** 字段级修订：安全撤销只撤仍未被后续改动的字段 */
  rev?: Partial<Record<HwField, number>>
  qualitySource?: "MANUAL" | "BATCH"
  /** 教师手工明确清空等级：批量不得重新填入 */
  qualityCleared?: boolean
  /** 个别延期：只影响该生 */
  extDeadline?: string | null
  /** 参与安排待核对（显式标记，不自动由请假产生） */
  review?: boolean
  /** 家长可见结果说明 / 内部备注 / 免做或未参与原因（内部） */
  note?: string
  memo?: string
  reason?: string
  /** 退出有效状态的旧结果（不物理删除） */
  history?: HwHistory[]
}
export type HwField = "submission" | "quality" | "score" | "noGrade" | "participating"
export interface HwHistory {
  at: string
  what: string
  from: string
}
export type HwLifecycle = "ACTIVE" | "CLOSED" | "WITHDRAWN"
export interface HwBatchEntry {
  sid: string
  field: HwField
  before: unknown
  after: unknown
  rev: number
}
export interface HwBatch {
  generation?: number
  id: string
  token: string
  kind: "SUBMIT" | "GRADE" | "ROUTINE"
  at: string
  label: string
  entries: HwBatchEntry[]
  skipped: { sid: string; reason: string }[]
  undone?: { restored: number; kept: number; at: string }
}
export interface Assignment {
  questionSources?: import('@/lib/research/model').PreparedQuestion[]
  gradeConversion?: import('@/lib/research/model').TestConversion
  gradeConversionHistory?: import('@/lib/research/model').TestConversion[]
  category?: "课后作业" | "课堂练习" | "模考" | "论文"
  id: string
  taskId: string
  title: string
  instructions: string
  issuedAt: string
  deadline: string | null
  recipients: string[]
  defaultRequirement: "REQUIRED" | "OPTIONAL"
  requirementOverrides: Record<string, Requirement>
  results: Record<string, HwResult>
  revision: number
  stamp: number
  /** 首次成功布置时固定的作业质量修订；缺失表示标准待核对，不回退为最新默认 */
  schemeRevId?: string | null
  /** 一次布置提交的幂等令牌：重试同一提交不重复创建 */
  createToken?: string
  /** 可选来源：从哪一天的日卡发起（仅作来源，不决定归期或截止） */
  sourceDate?: string | null
  /** 生命周期：缺省视为 ACTIVE（已布置／进行中） */
  status?: HwLifecycle
  /** 线下补录：issuedAt 保存原布置日期（日期精度），registeredAt 为真实系统登记时间 */
  offline?: { registeredAt: string }
  /** 是否启用可选数字分数 */
  scoreEnabled?: boolean
  batches?: HwBatch[]
  /** 首次布置后追加的学生及追加时点 */
  addedAt?: Record<string, string>
  copiedFrom?: string | null
  log?: { at: string; what: string }[]
}
export const SUBMISSION_LABEL: Record<Submission, string> = {
  ON_TIME: "按时提交",
  LATE: "迟交",
  SUBMITTED: "已提交",
  MISSING: "未交",
}
export function seedAssignments(clockIso: string): Assignment[] {
  const nowTs = Date.parse(clockIso)
  return SC.assignments
    .filter((a) => Date.parse(a.issued_at) <= nowTs)
    .map((a) => {
      const ov: Record<string, Requirement> = {}
      for (const o of a.requirement_overrides ?? []) ov[o.student_id] = o.requirement as Requirement
      const results: Record<string, HwResult> = {}
      for (const r of a.results) {
        if (r.participation === "EXEMPT") {
          ov[r.student_id] = "EXEMPT"
          continue
        }
        results[r.student_id] = {
          participating: r.participation === "OPTIONAL_NOT_PARTICIPATING" ? false : undefined,
          submission: (r.submission as Submission) ?? null,
          submissionConfirmed: !!r.submission_confirmed,
          quality: r.quality,
          score: null,
        }
      }
      return {
        id: a.id,
        taskId: a.task_id,
        title: a.title,
        instructions: "",
        issuedAt: a.issued_at,
        deadline: a.deadline,
        recipients: [...a.recipient_ids],
        defaultRequirement: a.default_requirement,
        requirementOverrides: ov,
        results,
        revision: 1,
        stamp: 0,
        // 场景作业按原型既有字典（A＝优秀）布置，与系统���础四级第 1 修订一致
        schemeRevId: "SYS_BASIC4@1",
      }
    })
}
export function requirementOf(a: Assignment, sid: string): Requirement {
  return a.requirementOverrides[sid] ?? a.defaultRequirement
}
/**
 * 作业归期（原型回退口径）：有截止按截止日期所在周；无截止按真实布置／补录原布置日期所在周。
 * 个别延期不移动全班归期。这是原型核验口径，不代表已修改���品政策。
 */
export function assignmentWeek(a: Assignment): number {
  return weekOfDate(dateOfClock(a.deadline ?? a.issuedAt))
}

/* ============================================================
 * 教学计划
 * ========================================================== */

export interface PlanItem {
  researchSource?: import('@/lib/research/model').SourceRef
  sourceReferences?: import('@/lib/research/model').SourceRef[]
  plannedDates?: { date: string; minutes: number }[]
  unmappedMinutes?: number | null
  relativeWeeks?: import('@/lib/research/model').WeekAllocation[]
  actualMinutes?: number | null
  id: string
  title: string
  points: string[]
  estimatedLessons: number | null
  objectives: string
  resources: string
  notes: string
}
export interface Plan {
  taskId: string
  state: "DRAFT" | "ADOPTED"
  items: PlanItem[]
  history: { at: string; action: string }[]
  revision: number
}
export function seedPlans(): Record<string, Plan> {
  const o: Record<string, Plan> = {}
  for (const p of SC.plans) {
    o[p.task_id] = {
      taskId: p.task_id,
      state: p.state === "ADOPTED" ? "ADOPTED" : "DRAFT",
      items: p.items.map((it, i) => ({
        id: `${p.id}_${i + 1}`,
        title: it.title,
        points: [...it.content_points],
        estimatedLessons: it.estimated_lessons,
        objectives: it.objectives ?? "",
        resources: "",
        notes: it.notes ?? "",
      })),
      history: [{ at: "2026-09-01T09:00:00+08:00", action: "采用（场景初始）" }],
      revision: 1,
    }
  }
  return o
}

/* ============================================================
 * 发布快照（不可变）
 * ========================================================== */

export interface SnapDay {
  date: string
  lessons: string[] // 如“第3节 09:40–10:20”
  attendance: { lesson: string; v: string; outboundReason: string | null }[]
  /** 发布时冻结的家长可见文字 */
  grade: string | null
  /** 真实等级身份：所属修订 + 等级 */
  gradeRef?: { revId: string; levelId: string }
  status: "RECORDED" | "UNRECORDED" | "EXPLICIT_EMPTY" | "NOT_APPLICABLE"
}
/** 发布时冻结的标准图例；多任务、课堂与作业各自保留 */
export interface SnapLegend {
  revId: string
  purpose: "CLASSROOM" | "HOMEWORK"
  scope: string
  name: string
  parentMode: "CODE_LABEL" | "LABEL_ONLY"
  levels: { code: string; label: string; guide: string }[]
}
export interface SnapStudent {
  studentId: string
  name: string
  homeroomId: string
  hasContact: boolean
  days: SnapDay[]
  homework: { assignmentId: string; title: string; status: string }[]
  highlights: string[]
  comment: string
}
export interface Publication {
  reports?: import('./reports').FrozenReport[]
  sourceVersion?: string
  authorId?: string
  withdrawn?: boolean
  id: string
  taskIds: string[]
  periodId: string
  week: number
  revision: number
  publishedAt: string
  idemKey: string
  classNameFormal: string
  courseName: string
  coverage: Record<string, string[]> // taskId -> dates
  assignmentIds: string[]
  excludedHomework: { assignmentId: string; studentId: string }[]
  publicSummary: string
  students: SnapStudent[]
  diffFromPrev: string[]
  stamp: number
  image: { status: "NONE" | "GENERATING" | "READY" | "FAILED"; attempts: number }
  downloads: Record<string, string> // sid|"ALL" -> 演示时间
  manualSent: Record<string, string>
  legends?: SnapLegend[]
}

export function seedPublications(clockIso: string): Publication[] {
  const nowTs = Date.parse(clockIso)
  return SC.publications
    .filter((p) => Date.parse(p.published_at) <= nowTs)
    .map((p) => {
      const t = taskById(p.task_id)!
      const wk = periodIdToWeek(p.feedback_period_id) ?? SCENARIO_WEEK
      return {
        id: p.id,
        taskIds: [p.task_id],
        periodId: feedbackPeriodId(wk),
        week: wk,
        revision: p.revision,
        publishedAt: p.published_at,
        idemKey: `seed:${p.id}`,
        classNameFormal: formalTaskName(t),
        courseName: courseOf(t)?.name ?? "",
        coverage: { [p.task_id]: [...p.classroom_coverage] },
        assignmentIds: [...p.assignment_ids],
        excludedHomework: [],
        publicSummary: p.public_summary,
        students: p.student_ids.map((sid) => {
          const s = studentById(sid)!
          return {
            studentId: sid,
            name: s.name,
            homeroomId: s.homeroom_id,
            hasContact: s.has_verified_guardian_contact,
            days: p.classroom_snapshot
              .filter((c) => c.student_id === sid)
              .map((c) => ({
                date: c.date,
                lessons: [],
                attendance: [{ lesson: "", v: ATT_LABEL[c.attendance as Attendance] ?? c.attendance, outboundReason: null }],
                grade: c.classroom_grade,
                status: "RECORDED" as const,
              })),
            homework: [],
            highlights: [],
            comment: "",
          }
        }),
        diffFromPrev: ["首次发布"],
        stamp: 0,
        image: { status: "NONE", attempts: 0 },
        downloads: {},
        manualSent: {},
      }
    })
}

/* ============================================================
 * 工具
 * ========================================================== */

export function teacherOfPersona(persona: string): string | null {
  if (persona === "lin") return "TEACHER_LYNN"
  if (persona === "zhou") return "TEACHER_PEER"
  return null
}
export function teacherName(id: string): string {
  // r4：同一真实教师只用全局演示身份的一个显示名（原 fixture 中另有「示例 Lynn 老师」）。
  if (id === "TEACHER_LYNN") return PERSONAS.lin.label
  return TEACHERS.find((t) => t.id === id)?.display_name ?? id
}
export function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}
