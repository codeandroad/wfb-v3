// 独立周反馈系统 — 合成演示数据（仅用于交互原型，非生产初始化数据）
import { CURRENT_SCHOOL } from "@/lib/school/instance"

export type Grade = "A+" | "A" | "A-" | "B" | "C"
export const GRADES: Grade[] = ["A+", "A", "A-", "B", "C"]

export type ScenarioId = "teacher" | "staff" | "parent"
export type ConfigId = "full" | "identityOnly"

export interface Student {
  id: string
  name: string // 示例学生NN
  homeroom: "高一1班" | "高一2班"
  parentContactMissing?: boolean
  asOnly?: boolean
}

export interface TeachingDay {
  date: string // 2026-09-14
  weekday: string // 周一
  periods: number
}

export interface HomeworkState {
  // submitted 已提交 / not_submitted 未交 / pending 未交待确认
  status: "submitted" | "not_submitted" | "pending"
  ungraded?: boolean // 已提交但未评分
  grade?: string // 分数 / 百分比 / 等级
  corrected?: boolean
}

// 单次课节的课堂表现
export interface SessionClassroom {
  grade: Grade | null // null = 空白/未记录
  note: string
}

export interface StudentFeedback {
  studentId: string
  confirmed: boolean // 是否已确认常规情况
  classroom: Record<string, SessionClassroom> // 按课节日期记录课堂表现
  attendance: Record<string, "present" | "leave" | "elsewhere">
  elsewhereTo?: string
  homework: Record<string, HomeworkState> // 按课节日期记录作业
  highlights: string[]
  suggestedHighlights: string[] // 系统建议、教师需勾选确认
  comment: string
  commentIsDraft?: boolean // 由模板生成、未确认
}

export interface PublicSummary {
  content: string
  overall: string
  highlights: string
  homework: string
  next: string
}

export interface WeekendHomework {
  none: boolean
  instructions: string
  due: string
  required: string
  optional: string
  attachment: string
}

export const SCHOOL_NAME = CURRENT_SCHOOL.nameZh
export const WEEK_LABEL = "2026学年 第3周"
export const WEEK_RANGE = "2026年9月14日 – 9月20日"
export const PUBLISH_BASE_DATE = "2026-09-20"

export const HOMEROOMS = ["高一1班", "高一2班"] as const

export const STUDENTS: Student[] = Array.from({ length: 22 }, (_, i) => {
  const n = i + 1
  const id = `s${String(n).padStart(2, "0")}`
  const homeroom = n <= 12 ? "高一1班" : "高一2班"
  return {
    id,
    name: `示例学生${String(n).padStart(2, "0")}`,
    homeroom,
    parentContactMissing: n === 12,
    asOnly: n === 21,
  } as Student
})

export function studentsByHomeroom(room: string) {
  return STUDENTS.filter((s) => s.homeroom === room)
}

export const TEACHING_CLASS = {
  id: "tc-math-a",
  name: "高一数学A班",
  course: "CIE 9709",
  studentIds: STUDENTS.map((s) => s.id),
}

// —— 教师任教的教学班（用于作业管理：一位教师可能同时教不同年级、不同班级）——

export interface ClassScope {
  code: string // 单元简称码或 ALL
  label: string // 徽标短名，如 P1 / 全部
  title: string // 全称，如 Pure Mathematics 1 / 整门课程
}

export interface RosterStudent {
  id: string
  name: string
}

export interface TeacherClass {
  id: string
  name: string
  grade: string
  courseCode: string // 官方课程代码
  courseName: string
  scopes: ClassScope[] // 可布置作业的范围（课程内各单元）
  roster: RosterStudent[]
}

function synthRoster(prefix: string, count: number, tag: string): RosterStudent[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(2, "0")
    return { id: `${prefix}-${n}`, name: `示例学生${tag}${n}` }
  })
}

export const TEACHER_CLASSES: TeacherClass[] = [
  {
    id: "tc-math-a",
    name: "高一数学A班",
    grade: "高一",
    courseCode: "9709",
    courseName: "CAIE 数学 · 9709",
    scopes: [
      { code: "P1", label: "P1", title: "Pure Mathematics 1" },
      { code: "S1", label: "S1", title: "Probability & Statistics 1" },
      { code: "M1", label: "M1", title: "Mechanics 1" },
    ],
    roster: STUDENTS.map((s) => ({ id: s.id, name: s.name })),
  },
  {
    id: "tc-math-g2a",
    name: "高二数学A班",
    grade: "高二",
    courseCode: "9709",
    courseName: "CAIE 数学 · 9709",
    scopes: [
      { code: "P3", label: "P3", title: "Pure Mathematics 3" },
      { code: "S2", label: "S2", title: "Probability & Statistics 2" },
      { code: "M2", label: "M2", title: "Mechanics 2" },
    ],
    roster: synthRoster("g2a", 18, "B"),
  },
  {
    id: "tc-math-g2b",
    name: "高二数学B班",
    grade: "高二",
    courseCode: "9709",
    courseName: "CAIE 数学 · 9709",
    scopes: [
      { code: "P3", label: "P3", title: "Pure Mathematics 3" },
      { code: "S2", label: "S2", title: "Probability & Statistics 2" },
    ],
    roster: synthRoster("g2b", 15, "C"),
  },
]

export function classById(id: string): TeacherClass | undefined {
  return TEACHER_CLASSES.find((c) => c.id === id)
}

export function rosterOf(classId: string): RosterStudent[] {
  return classById(classId)?.roster ?? STUDENTS.map((s) => ({ id: s.id, name: s.name }))
}

export interface UnitDef {
  code: "P1" | "S1" | "M1"
  title: string
  teachingDays: TeachingDay[]
}

export const UNITS: UnitDef[] = [
  {
    code: "P1",
    title: "Pure Mathematics 1",
    teachingDays: [
      { date: "2026-09-14", weekday: "周一", periods: 2 },
      { date: "2026-09-15", weekday: "周二", periods: 2 },
      { date: "2026-09-17", weekday: "周四", periods: 2 },
    ],
  },
  {
    code: "S1",
    title: "Statistics 1",
    teachingDays: [
      { date: "2026-09-15", weekday: "周二", periods: 2 },
      { date: "2026-09-17", weekday: "周四", periods: 2 },
    ],
  },
  {
    code: "M1",
    title: "Mechanics 1",
    teachingDays: [
      { date: "2026-09-15", weekday: "周二", periods: 1 },
      { date: "2026-09-18", weekday: "周五", periods: 1 },
    ],
  },
]

// —— 初始反馈种子（可通过 reset 重放）——

function unitDays(code: UnitDef["code"]): TeachingDay[] {
  return UNITS.find((u) => u.code === code)!.teachingDays
}

function baseFeedback(studentId: string, days: TeachingDay[]): StudentFeedback {
  const classroom: Record<string, SessionClassroom> = {}
  const homework: Record<string, HomeworkState> = {}
  for (const d of days) {
    classroom[d.date] = { grade: null, note: "" }
    homework[d.date] = { status: "submitted", grade: "A" }
  }
  return {
    studentId,
    confirmed: false,
    classroom,
    attendance: {},
    homework,
    highlights: [],
    suggestedHighlights: [],
    comment: "",
  }
}

export function seedP1(): Record<string, StudentFeedback> {
  const days = unitDays("P1")
  const [mon, tue, thu] = days.map((d) => d.date) // 周一 09-14 / 周二 09-15 / 周四 09-17
  const map: Record<string, StudentFeedback> = {}
  for (const s of STUDENTS) map[s.id] = baseFeedback(s.id, days)

  // 部分学生逐节记录课堂表现（演示“每次课独立评价”，可能三节各不相同）
  const perSession: Record<string, [Grade, Grade, Grade]> = {
    s01: ["A", "A-", "A"],
    s02: ["A+", "A", "A+"],
    s04: ["B", "A-", "A-"],
    s06: ["A-", "A-", "B"],
    s09: ["A", "A", "A-"],
    s10: ["A-", "B", "A-"],
  }
  for (const [sid, grades] of Object.entries(perSession)) {
    map[sid].confirmed = true
    map[sid].classroom[mon] = { grade: grades[0], note: "" }
    map[sid].classroom[tue] = { grade: grades[1], note: "" }
    map[sid].classroom[thu] = { grade: grades[2], note: "" }
  }
  map.s04.classroom[mon].note = "周一开课状态偏慢，后半周回升"

  // 示例学生03：周二请假（当次课堂无法评价，作业单独判断），其余课次正常记录
  map.s03.attendance[tue] = "leave"
  map.s03.classroom[mon] = { grade: "A-", note: "" }
  map.s03.classroom[thu] = { grade: "A-", note: "" }
  map.s03.confirmed = true

  // 示例学生05：周四到“高二数学A班 · CIE 9709”上课（该次课不计入本班表现）
  map.s05.attendance[thu] = "elsewhere"
  map.s05.elsewhereTo = "高二数学A班 · CIE 9709"
  map.s05.classroom[mon] = { grade: "A", note: "" }
  map.s05.classroom[tue] = { grade: "A-", note: "" }
  map.s05.confirmed = true

  // 示例学生07：周二作业已提交但未评分（不得显示为未交）
  map.s07.homework[tue] = { status: "submitted", ungraded: true }
  // 示例学生08：周一作业疑似未交，待确认
  map.s08.homework[mon] = { status: "pending" }
  // 示例学生02、14：具体亮点（系统建议，需教师勾选确认）
  map.s02.suggestedHighlights = ["解题步骤清楚"]
  map.s14.suggestedHighlights = ["主动解释思路"]

  return map
}

export function seedS1(): Record<string, StudentFeedback> {
  const days = unitDays("S1")
  const map: Record<string, StudentFeedback> = {}
  for (const s of STUDENTS) {
    const f = baseFeedback(s.id, days)
    f.confirmed = true
    for (const d of days) {
      f.classroom[d.date] = { grade: "A-", note: "" }
      f.homework[d.date] = { status: "submitted", grade: "B" }
    }
    map[s.id] = f
  }
  return map
}

export function seedM1(): Record<string, StudentFeedback> {
  const days = unitDays("M1")
  const [tue, fri] = days.map((d) => d.date) // 周二 09-15 / 周五 09-18
  const map: Record<string, StudentFeedback> = {}
  for (const s of STUDENTS) map[s.id] = baseFeedback(s.id, days)

  // 部分学生已记录周二课节，整体处于“进行中”，用于演示同一教师第三门单元的独立状态
  for (const sid of ["s01", "s02", "s04", "s06", "s09", "s10"]) {
    map[sid].confirmed = true
    map[sid].classroom[tue] = { grade: "A", note: "" }
  }
  // 示例学生05：周五去“高二数学A班”上课，M1 周五课节不计入本班表现
  map.s05.attendance[fri] = "elsewhere"
  map.s05.elsewhereTo = "高二数学A班 · CIE 9709"
  // 示例学生11：周二作业疑似未交，待确认
  map.s11.homework[tue] = { status: "pending" }
  // 系统建议亮点，需教师勾选确认
  map.s04.suggestedHighlights = ["受力分析规范"]

  return map
}

// —— 派生集合（供发布/家长/班主任等只读视图共享同一份数据）——

const GRADE_RANK: Record<Grade, number> = { "A+": 5, A: 4, "A-": 3, B: 2, C: 1 }

// 计入本班表现的有效评分课节（排除请假/在他班当次）
export function gradedSessions(f: StudentFeedback, days: TeachingDay[]): TeachingDay[] {
  return days.filter((d) => {
    const att = f.attendance[d.date]
    return (!att || att === "present") && !!f.classroom[d.date]?.grade
  })
}

// 代表性课堂等级：取出现最多的等级，并列时取较高
export function overallGrade(f: StudentFeedback, days: TeachingDay[]): Grade | null {
  const graded = gradedSessions(f, days)
  if (!graded.length) return null
  const counts: Partial<Record<Grade, number>> = {}
  for (const d of graded) {
    const g = f.classroom[d.date].grade as Grade
    counts[g] = (counts[g] ?? 0) + 1
  }
  let best: Grade | null = null
  for (const g of GRADES) {
    const c = counts[g] ?? 0
    if (c === 0) continue
    const bc = best ? (counts[best] ?? 0) : -1
    if (!best || c > bc || (c === bc && GRADE_RANK[g] > GRADE_RANK[best])) best = g
  }
  return best
}

export function hasClassroomRecord(f: StudentFeedback): boolean {
  return Object.values(f.classroom).some((c) => c.grade)
}

// 作业聚合：优先暴露需要处理的状态（待确认 > 未交 > 待评分 > 已交）
export function overallHomework(f: StudentFeedback): HomeworkState {
  const list = Object.values(f.homework)
  if (!list.length) return { status: "submitted", grade: "—" }
  return (
    list.find((h) => h.status === "pending") ??
    list.find((h) => h.status === "not_submitted") ??
    list.find((h) => h.status === "submitted" && h.ungraded) ??
    list[list.length - 1]
  )
}

export function hasPendingHomework(f: StudentFeedback): boolean {
  return Object.values(f.homework).some((h) => h.status === "pending")
}

export function homeworkCounts(f: StudentFeedback) {
  const list = Object.values(f.homework)
  return {
    total: list.length,
    pending: list.filter((h) => h.status === "pending").length,
    notSubmitted: list.filter((h) => h.status === "not_submitted").length,
    ungraded: list.filter((h) => h.status === "submitted" && h.ungraded).length,
    submitted: list.filter((h) => h.status === "submitted" && !h.ungraded).length,
  }
}

export const EMPTY_SUMMARY: PublicSummary = {
  content: "",
  overall: "",
  highlights: "",
  homework: "",
  next: "",
}

// 生成草稿用模板（本地模板，非真实模型）
export function draftSummary(unitCode: string): PublicSummary {
  if (unitCode === "P1") {
    return {
      content: "本周学习 Accuracy 与 Lower/Upper Bounds，围绕估算区间与有效数字取舍展开练习。",
      overall: "全班整体掌握良好，能按精度要求写出上下界；部分同学在区间端点取舍上仍需巩固。",
      highlights: "多数同学解题步骤规范，能主动说明取舍依据。",
      homework: "本周完成课堂练习与 Accuracy 巩固作业，提交与订正情况整体正常。",
      next: "下周结合实际测量情境练习误差累积，请提前复习有效数字规则。",
    }
  }
  if (unitCode === "M1") {
    return {
      content: "本周进入 Mechanics 1 的受力分析与力的合成，练习自由体受力图的规范画法。",
      overall: "多数同学能正确标注各力方向，部分同学在斜面分解与摩擦力方向判断上仍需加强。",
      highlights: "课堂上不少同学受力分析规范，能主动说明分解依据。",
      homework: "本周布置受力图基础练习，提交情况整体正常，个别待确认。",
      next: "下周练习匀加速直线运动与力的平衡结合题，请提前复习矢量分解。",
    }
  }
  return {
    content: "本周复习 Statistics 1 的数据表示与集中趋势度量。",
    overall: "整体掌握稳定，能选择合适的图表描述数据。",
    highlights: "课堂讨论积极，能结合数据背景解释结论。",
    homework: "作业提交情况正常。",
    next: "下周进入离散程度度量，注意标准差的意义。",
  }
}

export function draftComment(studentName: string, highlights: string[]): string {
  const hl = highlights.length ? highlights.join("、") : "课堂参与稳定"
  return `${studentName}本周表现：${hl}。建议：继续保持并尝试口头复述一遍解题思路，帮助巩固方法。`
}

// —— 作业管理演示数据（布置作业 + 追踪评分，暂无学生提交入口）——

export type HomeworkScore = Grade
export const HW_SCORES: HomeworkScore[] = GRADES

export interface AssignmentRecord {
  // 由于暂无学生端提交，状态由教师登记
  status: "not_submitted" | "submitted" | "graded"
  score?: HomeworkScore
}

export interface Assignment {
  id: string
  classId: string // 所属教学班
  scope: string // 布置范围码：单元简称或 ALL（整门课程）
  scopeLabel: string // 徽标短名，如 P1 / 全部
  scopeTitle: string // 全称，如 Pure Mathematics 1 / 整门课程
  title: string
  type: "required" | "optional"
  assignedDate: string // 2026-09-15
  dueDate: string // 2026-09-19
  instructions: string
  records: Record<string, AssignmentRecord>
}

// 生成一份学生登记表：默认“已提交待评分”，overrides 覆盖个别学生
function mkRecords(overrides: Record<string, AssignmentRecord> = {}): Record<string, AssignmentRecord> {
  const rec: Record<string, AssignmentRecord> = {}
  for (const s of STUDENTS) rec[s.id] = overrides[s.id] ?? { status: "submitted" }
  return rec
}

export function seedAssignments(): Assignment[] {
  return [
    {
      id: "hw-p1-01",
      classId: "tc-math-a",
      scope: "P1",
      scopeLabel: "P1",
      scopeTitle: "Pure Mathematics 1",
      title: "Accuracy 与 Bounds 巩固练习",
      type: "required",
      assignedDate: "2026-09-15",
      dueDate: "2026-09-19",
      instructions: "完成讲义 Ex 3A 第 1–10 题，写出每题的上下界并标注有效数字取舍依据。",
      records: mkRecords({
        s01: { status: "graded", score: "A" },
        s02: { status: "graded", score: "A+" },
        s04: { status: "graded", score: "A-" },
        s06: { status: "graded", score: "B" },
        s08: { status: "not_submitted" },
        s12: { status: "submitted" },
      }),
    },
    {
      id: "hw-p1-02",
      classId: "tc-math-a",
      scope: "P1",
      scopeLabel: "P1",
      scopeTitle: "Pure Mathematics 1",
      title: "有效数字选做拓展",
      type: "optional",
      assignedDate: "2026-09-17",
      dueDate: "2026-09-21",
      instructions: "选做：结合一道实际测量情境，讨论误差累积对结果精度的影响（约 200 字）。",
      records: mkRecords({
        s01: { status: "submitted" },
        s02: { status: "graded", score: "A" },
        s03: { status: "not_submitted" },
        s09: { status: "not_submitted" },
        s14: { status: "submitted" },
      }),
    },
    {
      id: "hw-s1-01",
      classId: "tc-math-a",
      scope: "S1",
      scopeLabel: "S1",
      scopeTitle: "Probability & Statistics 1",
      title: "数据表示与集中趋势",
      type: "required",
      assignedDate: "2026-09-15",
      dueDate: "2026-09-18",
      instructions: "完成 Ex 1B 全部题目，任选一组数据绘制箱线图并解释离群值。",
      records: mkRecords({
        s01: { status: "graded", score: "A-" },
        s02: { status: "graded", score: "A" },
        s03: { status: "graded", score: "B" },
        s05: { status: "graded", score: "A-" },
        s07: { status: "graded", score: "A-" },
        s11: { status: "graded", score: "B" },
      }),
    },
    {
      id: "hw-m1-01",
      classId: "tc-math-a",
      scope: "M1",
      scopeLabel: "M1",
      scopeTitle: "Mechanics 1",
      title: "受力图基础练习",
      type: "required",
      assignedDate: "2026-09-15",
      dueDate: "2026-09-20",
      instructions: "完成受力分析讲义第 1–6 题，规范画出自由体受力图并标注各力方向。",
      records: mkRecords({
        s01: { status: "graded", score: "A" },
        s04: { status: "graded", score: "A" },
        s11: { status: "not_submitted" },
      }),
    },
    {
      id: "hw-g2a-p3-01",
      classId: "tc-math-g2a",
      scope: "P3",
      scopeLabel: "P3",
      scopeTitle: "Pure Mathematics 3",
      title: "积分技巧综合练习",
      type: "required",
      assignedDate: "2026-09-15",
      dueDate: "2026-09-19",
      instructions: "完成分部积分与部分分式讲义 Ex 5A，写出关键步骤。",
      records: (() => {
        const rec: Record<string, AssignmentRecord> = {}
        for (const s of rosterOf("tc-math-g2a")) rec[s.id] = { status: "submitted" }
        rec["g2a-01"] = { status: "graded", score: "A" }
        rec["g2a-03"] = { status: "graded", score: "A-" }
        rec["g2a-05"] = { status: "not_submitted" }
        return rec
      })(),
    },
  ]
}

export function assignmentProgress(a: Assignment) {
  const list = rosterOf(a.classId).map((s) => a.records[s.id] ?? { status: "submitted" })
  const total = list.length
  const graded = list.filter((r) => r.status === "graded").length
  const submitted = list.filter((r) => r.status === "submitted").length
  const notSubmitted = list.filter((r) => r.status === "not_submitted").length
  return { total, graded, submitted, notSubmitted, gradedPct: total ? Math.round((graded / total) * 100) : 0 }
}

// —— 权限与会话演示数据（自包含，非真实身份服务）——

export type RoleCode = "school_admin" | "teacher" | "homeroom" | "teaching_manager"

export const ROLE_LABEL: Record<RoleCode, string> = {
  school_admin: "学校管理员",
  teacher: "任课教师",
  homeroom: "班主任",
  teaching_manager: "教学管理",
}

export interface StaffRole {
  code: RoleCode
  scope: string
  from: string
  to: string
  source: string
}

export interface StaffMember {
  id: string
  name: string
  username: string
  roles: StaffRole[]
  isCurrent?: boolean
}

export function seedStaff(): StaffMember[] {
  return [
    {
      id: "u-lin",
      name: "示例林老师",
      username: "lin.example",
      isCurrent: true,
      roles: [
        { code: "school_admin", scope: "全校", from: "2025-08-01", to: "长期", source: "学校授予" },
        { code: "teacher", scope: "高一数学A班 · P1、S1", from: "2025-08-01", to: "本学年", source: "任教关系" },
        { code: "homeroom", scope: "高一1班", from: "2025-08-01", to: "本学年", source: "学校授予" },
      ],
    },
    {
      id: "u-wang",
      name: "示例王老师",
      username: "wang.example",
      roles: [
        { code: "teacher", scope: "高一数学A班 · P3", from: "2025-08-01", to: "本学年", source: "任教关系" },
        { code: "homeroom", scope: "高一2班", from: "2025-08-01", to: "本学年", source: "学校授予" },
      ],
    },
    {
      id: "u-zhao",
      name: "示例赵老师",
      username: "zhao.example",
      roles: [{ code: "school_admin", scope: "全校", from: "2024-08-01", to: "长期", source: "学校授予" }],
    },
    {
      id: "u-chen",
      name: "示例陈主任",
      username: "chen.example",
      roles: [{ code: "teaching_manager", scope: "高一年级组", from: "2025-08-01", to: "本学年", source: "学校授予" }],
    },
  ]
}

export interface SessionItem {
  id: string
  device: string
  location: string
  lastActive: string
  current?: boolean
}

export function seedSessions(): SessionItem[] {
  return [
    { id: "会话示例-021", device: "Chrome · Windows（本机）", location: "校内网络", lastActive: "刚刚", current: true },
    { id: "会话示例-018", device: "Safari · iPad", location: "校内网络", lastActive: "2 小时前" },
    { id: "会话示例-014", device: "Chrome · Android", location: "校外网络", lastActive: "3 天前" },
  ]
}
