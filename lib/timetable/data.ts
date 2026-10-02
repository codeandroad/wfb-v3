// 课表中心 — 合成演示数据与纯计算引擎（仅用于交互原型，非生产数据/服务）
//
// 说明：
// - 学校发布版编号 SCH-学期-序号；个人使用版编号 PER-学期-教师-序号。
// - 数据以“周模板 + 投影到实际日期”组织，保持紧凑；差异与冲突基于真实条目计算。
// - 演示时区 Asia/Shanghai，演示时钟默认取该时区的真实当前时间。

export const TERM_TAG = "2026T1"
export const TERM_LABEL = "2026学年 第一学期"
export const TIMEZONE = "Asia/Shanghai"
// 演示时钟跟随 Asia/Shanghai 真实当前时间（YYYY-MM-DDTHH:mm），过期判定以此为准
export function shanghaiNow(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00"
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
}
export const DEFAULT_CLOCK = shanghaiNow()
export const TERM_START = "2026-09-01"
export const TERM_END = "2027-01-29"

/* ---------------- 节次配置（合成，非真实学校作息） ---------------- */

export type Block = "morning" | "afternoon" | "evening"

export interface Period {
  id: string
  no: number // 第 N 节（显示用）
  label: string // 第1节
  start: string // HH:mm
  end: string
  block: Block
}

// 每节 40 分钟作息（合成，非真实学校作息）。
// 全应用唯一的系统课节时间来源：完整课表与「我的教学」简版均由此解析节次时间（r4 统一，原两处各自定义）。
export const PERIODS: Period[] = [
  { id: "m1", no: 1, label: "第1节", start: "08:00", end: "08:40", block: "morning" },
  { id: "m2", no: 2, label: "第2节", start: "08:50", end: "09:30", block: "morning" },
  { id: "m3", no: 3, label: "第3节", start: "09:40", end: "10:20", block: "morning" },
  { id: "m4", no: 4, label: "第4节", start: "10:30", end: "11:10", block: "morning" },
  { id: "m5", no: 5, label: "第5节", start: "11:20", end: "12:00", block: "morning" },
  { id: "a1", no: 6, label: "第6节", start: "13:40", end: "14:20", block: "afternoon" },
  { id: "a2", no: 7, label: "第7节", start: "14:25", end: "15:05", block: "afternoon" },
  { id: "a3", no: 8, label: "第8节", start: "15:15", end: "15:55", block: "afternoon" },
  { id: "a4", no: 9, label: "第9节", start: "16:05", end: "16:45", block: "afternoon" },
  { id: "a5", no: 10, label: "第10节", start: "16:50", end: "17:30", block: "afternoon" },
  { id: "e1", no: 11, label: "晚1节", start: "18:30", end: "19:10", block: "evening" },
  { id: "e2", no: 12, label: "晚2节", start: "19:20", end: "20:00", block: "evening" },
  { id: "e3", no: 13, label: "晚3节", start: "20:10", end: "20:50", block: "evening" },
  { id: "e4", no: 14, label: "晚4节", start: "20:50", end: "21:30", block: "evening" },
]

export const LUNCH = { start: "12:00", end: "13:40", label: "午间" }

// 合成教室清单（用于手动调整/拖拽落点的教室选择）
export const ROOMS = ["D101", "D102", "机房1", "机房2", "D105", "D208", "D210", "D302", "D110"]

export function periodById(id: string): Period | undefined {
  return PERIODS.find((p) => p.id === id)
}

export const WEEKDAYS = [
  { n: 1, label: "周一", short: "一" },
  { n: 2, label: "周二", short: "二" },
  { n: 3, label: "周三", short: "三" },
  { n: 4, label: "周四", short: "四" },
  { n: 5, label: "周五", short: "五" },
  { n: 6, label: "周六", short: "六" },
  { n: 7, label: "周日", short: "日" },
]

/* ---------------- 校历 / 调休（教务与课表共用同一来源） ---------------- */

export type CalKind = "holiday" | "exception" | "swap"

export interface CalEvent {
  id: string
  kind: CalKind
  date: string // 开始日期
  endDate?: string // 结束日期（含）；为空=单日。长假按区间整体停课
  targetDate?: string // 调休来源日（原安排日）
  scope: string
  note: string
  title?: string
  traceable?: boolean
}

// 合成校历事项：教务「校历与调休」页与课表页共享，保证一处变更两处一致
// r4：原示例把 9/28 设为停课、10/1–10/7 设为长假，与「我的教学」同一学校第5周已确认的课堂事实
// （9/28 已记录日记录、10/1–10/3 有效课次）互相矛盾——同一学校只能有一份校历。
// 保留全部三类事项（不删除），整体移到第6周，不与既有课堂事实冲突，并继续覆盖停课/调休/周末补课核验。
export const CALENDAR_EVENTS: CalEvent[] = [
  { id: "c3", kind: "holiday", date: "2026-10-05", endDate: "2026-10-07", title: "示例长假", scope: "全校", note: "长假期间课表整体失效（合成，非法定校历）" },
  { id: "c1", kind: "holiday", date: "2026-10-08", scope: "全校", note: "示例停课日（合成，非法定假日）" },
  { id: "c2", kind: "swap", date: "2026-10-08", targetDate: "2026-10-11", scope: "全校", note: "10/11（周日）执行 10/8（周四）安排；来源周四在相同范围停课", traceable: true },
]

/* ---------------- 演示日期工具 ---------------- */

// 按学期起止日期生成全部自然周（周一为一周起点），第 1 周为开学日所在周
export const WEEKS: { no: number; start: string; end: string }[] = (() => {
  const weeks: { no: number; start: string; end: string }[] = []
  for (let start = weekStartOf(TERM_START), no = 1; start <= TERM_END; start = addDays(start, 7), no++) {
    weeks.push({ no, start, end: addDays(start, 6) })
  }
  return weeks
})()

export function addDays(iso: string, days: number): string {
  // 统一用 UTC 计算，避免 new Date(+08:00) 经 toISOString() 转回 UTC 时整体回退一天，
  // 该回退会让投影日期比实际早一天，进而破坏“仅本次”编辑的按周命中（editAppliesToWeek）。
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function weekStartOf(dateIso: string): string {
  const d = new Date(dateIso.slice(0, 10) + "T00:00:00Z")
  const wd = (d.getUTCDay() + 6) % 7 // 周一=0
  return addDays(dateIso.slice(0, 10), -wd)
}

export function weekOfStart(start: string) {
  return WEEKS.find((w) => w.start === start)
}

export function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-")
  return `${Number(m)}/${Number(d)}`
}

export function fmtDateFull(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${y}年${Number(m)}月${Number(d)}日`
}

export function fmtClock(iso: string): string {
  // iso: 2026-09-24T14:30
  const [date, time] = iso.split("T")
  return `${fmtDate(date)} ${time ?? ""}`.trim()
}

// 分钟数（用于 [start,end) 重叠判断）
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

export function periodsOverlap(a: string, b: string): boolean {
  const pa = periodById(a)
  const pb = periodById(b)
  if (!pa || !pb) return false
  return toMin(pa.start) < toMin(pb.end) && toMin(pb.start) < toMin(pa.end)
}

/* ---------------- 教师、教学班、学生群体 ---------------- */

export interface Teacher {
  id: string
  name: string
  subject: string
  hasAccount: boolean
}

export const TEACHERS: Teacher[] = [
  { id: "lin", name: "示例林老师", subject: "数学", hasAccount: true },
  { id: "zhou", name: "示例周老师", subject: "物理", hasAccount: true },
  { id: "chen", name: "示例陈老师", subject: "化学", hasAccount: true },
  { id: "shen", name: "示例沈老师", subject: "地理", hasAccount: false },
  { id: "wang", name: "示例王老师", subject: "英语", hasAccount: true },
  { id: "li", name: "示例李老师", subject: "生物", hasAccount: true },
  { id: "zhao", name: "示例赵老师", subject: "历史", hasAccount: true },
]

export function teacherById(id: string): Teacher | undefined {
  return TEACHERS.find((t) => t.id === id)
}

// 教务可查看的对象（教师 + 教学班）
export interface TeachingClassRef {
  id: string
  name: string
  subject: string
  teacherIds: string[]
}

export const TEACHING_CLASSES: TeachingClassRef[] = [
  { id: "c-math-a", name: "高一1班 • 数学", subject: "数学", teacherIds: ["lin"] },
  { id: "c-math-b", name: "高一2班 • 数学", subject: "数学", teacherIds: ["lin"] },
  { id: "c-cs-b", name: "高一2班 • 计算机", subject: "计算机", teacherIds: ["lin"] },
  { id: "c-phys-a", name: "高一1班 • 物理", subject: "物理", teacherIds: ["zhou"] },
  { id: "c-chem-a", name: "高一1班 • 化学", subject: "化学", teacherIds: ["chen"] },
  { id: "c-geo-a", name: "高一3班 • 地理", subject: "地理", teacherIds: ["shen"] },
  { id: "c-eng-a", name: "高一1班 • 英语", subject: "英语", teacherIds: ["wang"] },
  { id: "c-bio-a", name: "高二1班 • 生物", subject: "生物", teacherIds: ["li"] },
  { id: "c-his-a", name: "高一2班 • 历史", subject: "历史", teacherIds: ["zhao"] },
]

// 行政班（教务对象之一）：按年级归属的自然班，其课表为所含教学任务的聚合只读视图
export interface AdminClassRef {
  id: string
  name: string
  grade: string
  // 该行政班学生参与的教师课表来源（合成映射，用于聚合投影）
  memberTeacherIds: string[]
}

export const ADMIN_CLASSES: AdminClassRef[] = [
  { id: "ac-g1c1", name: "高一(1)班", grade: "高一", memberTeacherIds: ["lin", "zhou", "shen", "wang"] },
  { id: "ac-g1c2", name: "高一(2)班", grade: "高一", memberTeacherIds: ["lin", "zhou", "zhao"] },
  { id: "ac-g2c1", name: "高二(1)班", grade: "高二", memberTeacherIds: ["chen", "li"] },
]

export function adminClassById(id: string): AdminClassRef | undefined {
  return ADMIN_CLASSES.find((c) => c.id === id)
}

// 教学分工候选（轻量分工简称；空字符串表示整科不分工）
export const RESP_OPTIONS = ["P1", "S1", "M1", "F1", "F2", "C1", "G1", "答疑"]

/* ---------------- 课表条目（周模板） ---------------- */

export type EntryKind = "class" | "activity" | "history"

// 稳定课次身份 key 在同一教师内唯一，用于跨版本差异匹配
export interface TemplateEntry {
  key: string
  weekday: number // 1..7
  periodId: string
  className: string // 安排名称 = 教学班正式名：<班组标识> • <课程显示名>
  subject: string
  group?: string // 教学单元组简称，如 P1 / S1（父教学班上下文内展示）
  unitName?: string // 教学单元组完整单元名，如 纯数学1（可选，用于详情/悬浮）
  room: string | null // null = 未匹配教室，不纳入教室冲突
  kind?: EntryKind
  locked?: boolean // 受保护/已记录历史，只读
  note?: string
  noteShow?: boolean // 本课备注是否在课卡显示（关闭仅隐藏摘要，正文保留）
  displayMode?: DisplayMode // 是否显示自定义分工（个人显示偏好）
  customLabel?: string // 自定义分工正文（关闭时保留不清空）
  // 学生群体标识（用于冲突演示）：同 groupId 表示同一批学生
  studentGroup?: string
  // 实际教学任务ID（与「我的教学」共用；非教学活动为空）
  taskId?: string
  // 安排适用日期区间（含端点）；单次周末安排 validFrom = validTo
  validFrom?: string
  validTo?: string
}

// 分工内容来源（唯一开关）：SHARED=教务规范名称；CUSTOM=本人自定义分工替代。不存在“隐藏全部分工”
export type DisplayMode = "SHARED" | "CUSTOM"

// 课卡分工内容：自定义与规范名互斥替代，不拼接。canonical=true（教务/他人规范视图）时不读取个人自定义。
// canonicalName 为教务规范当前名称（由分工注册表解析），缺省回退为分工标记。
export function finalMarker(
  e: { group?: string; displayMode?: DisplayMode; customLabel?: string },
  canonical = false,
  canonicalName?: string | null,
): string | null {
  if (!canonical && e.displayMode === "CUSTOM" && e.customLabel?.trim()) return e.customLabel.trim()
  return canonicalName !== undefined ? canonicalName : e.group || null
}

// 投影后的实际课次
export interface ProjectedEntry extends TemplateEntry {
  date: string
  teacherId: string
  origin?: "school" | "personal" | "calendar" // 来源标注
  makeupFrom?: string // 补课来源日
  movedTo?: string // 调至目标日（来源日显示）
}

/* ---------------- 学校发布内容（按教师的周模板，按 SCH 来源版本） ---------------- */
// schedules[teacherId][schSeq] = 该教师在该学校来源下的周模板
// 若某 seq 未定义，表示沿用更早的来源版本（继承）

type TeacherSchedules = Record<string, Record<number, TemplateEntry[]>>

// 林老师（「我的教学」中的 TEACHER_LYNN，同一真实教师）的学校规范安排。
// r4：与「我的教学」共用本模板；简版课卡由此经采用版本 + 已应用个人调整 + 校历解析得到，不再另存课次数组。
// 合成场景安排自第5周起（validFrom），此前各周无本人教学安排，避免凭空产生未记录课次。
const LIN_FROM = "2026-09-28"
const G1_MATH = "高一1班 • 数学"
const G2_MATH = "高一2班 • 数学"
const G2_CS = "高一2班 • 计算机"
const LIN_006: TemplateEntry[] = [
  { key: "lin-cs-mon", weekday: 1, periodId: "m1", className: G2_CS, subject: "计算机", room: "机房1", taskId: "TASK_CS_WHOLE", validFrom: LIN_FROM },
  { key: "lin-cs-wed", weekday: 3, periodId: "m1", className: G2_CS, subject: "计算机", room: "机房1", taskId: "TASK_CS_WHOLE", validFrom: LIN_FROM },
  { key: "lin-g1p1-mon", weekday: 1, periodId: "m3", className: G1_MATH, subject: "数学", group: "P1", room: "D101", taskId: "TASK_MATH_G1_P1", validFrom: LIN_FROM },
  { key: "lin-g1p1-fri", weekday: 5, periodId: "m3", className: G1_MATH, subject: "数学", group: "P1", room: "D101", taskId: "TASK_MATH_G1_P1", validFrom: LIN_FROM },
  { key: "lin-g1p1-fri5", weekday: 5, periodId: "m5", className: G1_MATH, subject: "数学", group: "P1", room: "D101", taskId: "TASK_MATH_G1_P1", validFrom: LIN_FROM },
  // 单次周末安排：只在 10/3 执行，不按周重复
  { key: "lin-g1p1-sat", weekday: 6, periodId: "m3", className: G1_MATH, subject: "数学", group: "P1", room: "D101", taskId: "TASK_MATH_G1_P1", validFrom: "2026-10-03", validTo: "2026-10-03" },
  { key: "lin-g2p1-tue", weekday: 2, periodId: "m3", className: G2_MATH, subject: "数学", group: "P1", room: "D102", taskId: "TASK_MATH_G2_P1", validFrom: LIN_FROM },
  { key: "lin-g2s1-thu3", weekday: 4, periodId: "m3", className: G2_MATH, subject: "数学", group: "S1", room: "D105", taskId: "TASK_MATH_G2_S1", validFrom: LIN_FROM },
  { key: "lin-g2s1-wed", weekday: 3, periodId: "m3", className: G2_MATH, subject: "数学", group: "S1", room: "D102", taskId: "TASK_MATH_G2_S1", validFrom: LIN_FROM },
  { key: "lin-g2s1-thu", weekday: 4, periodId: "m5", className: G2_MATH, subject: "数学", group: "S1", room: "D102", taskId: "TASK_MATH_G2_S1", validFrom: LIN_FROM },
  // 非教学活动：只在完整课表出现，不进入简版教学课卡
  { key: "lin-qa-mon", weekday: 1, periodId: "a3", className: "数学答疑", subject: "数学", room: "D101", kind: "activity", validFrom: LIN_FROM },
]

// SCH-007：仅改林老师两处 —— (1) 高一1班 P1 周五第5节→第4节（节次变化）(2) 周一计算机教室 机房1→机房2
const LIN_007: TemplateEntry[] = LIN_006.map((e) => {
  if (e.key === "lin-g1p1-fri5") return { ...e, periodId: "m4" }
  if (e.key === "lin-cs-mon") return { ...e, room: "机房2" }
  return e
})

const ZHOU_CLS = "高一1班 • 物理"
const ZHOU_006: TemplateEntry[] = [
  { key: "zhou-mon", weekday: 1, periodId: "a1", className: ZHOU_CLS, subject: "物理", group: "F1", unitName: "力学与运动", room: "D302" },
  { key: "zhou-wed", weekday: 3, periodId: "a1", className: ZHOU_CLS, subject: "物理", group: "F1", unitName: "力学与运动", room: "D302" },
  { key: "zhou-fri", weekday: 5, periodId: "a2", className: ZHOU_CLS, subject: "物理", group: "F1", unitName: "力学与运动", room: "D302" },
]

const CHEN_CLS = "高一1班 • 化学"
const CHEN_006: TemplateEntry[] = [
  { key: "chen-tue", weekday: 2, periodId: "m1", className: CHEN_CLS, subject: "化学", group: "C1", unitName: "有机化学1", room: "D210" },
  { key: "chen-thu", weekday: 4, periodId: "m1", className: CHEN_CLS, subject: "化学", group: "C1", unitName: "有机化学1", room: "D210" },
]

// SCH-008：仅改陈老师一处 —— 周四第1节→第3节
const CHEN_008: TemplateEntry[] = CHEN_006.map((e) => (e.key === "chen-thu" ? { ...e, periodId: "m3" } : e))

const SHEN_006: TemplateEntry[] = [
  { key: "shen-mon", weekday: 1, periodId: "m3", className: "高一3班 • 地理", subject: "地理", group: "G1", unitName: "自然地理基础", room: "D110" },
]

const WANG_CLS = "高一1班 • 英语"
const WANG_006: TemplateEntry[] = [
  { key: "wang-tue", weekday: 2, periodId: "m2", className: WANG_CLS, subject: "英语", group: "R1", unitName: "阅读与写作", room: "D201" },
  { key: "wang-thu", weekday: 4, periodId: "m2", className: WANG_CLS, subject: "英语", group: "R1", unitName: "阅读与写作", room: "D201" },
  { key: "wang-fri", weekday: 5, periodId: "a1", className: WANG_CLS, subject: "英语", group: "L1", unitName: "听力与口语", room: "D201" },
]

const LI_CLS = "高二1班 • 生物"
const LI_006: TemplateEntry[] = [
  { key: "li-mon", weekday: 1, periodId: "m1", className: LI_CLS, subject: "生物", group: "B1", unitName: "细胞与分子", room: "D215" },
  { key: "li-wed", weekday: 3, periodId: "m3", className: LI_CLS, subject: "生物", group: "B1", unitName: "细胞与分子", room: "D215" },
]

const ZHAO_CLS = "高一2班 • 历史"
const ZHAO_006: TemplateEntry[] = [
  { key: "zhao-tue", weekday: 2, periodId: "a2", className: ZHAO_CLS, subject: "历史", group: "H1", unitName: "中国近现代史", room: "D112" },
  { key: "zhao-fri", weekday: 5, periodId: "m3", className: ZHAO_CLS, subject: "历史", group: "H1", unitName: "中国近现代史", room: "D112" },
]

export const TEACHER_SCHEDULES: TeacherSchedules = {
  lin: { 6: LIN_006, 7: LIN_007 },
  zhou: { 6: ZHOU_006 },
  chen: { 6: CHEN_006, 8: CHEN_008 },
  shen: { 6: SHEN_006 },
  wang: { 6: WANG_006 },
  li: { 6: LI_006 },
  zhao: { 6: ZHAO_006 },
}

// 学校基线 SCH-006 各教师周模板
export const BASELINE_TEMPLATES: Record<string, TemplateEntry[]> = {
  lin: LIN_006,
  zhou: ZHOU_006,
  chen: CHEN_006,
  shen: SHEN_006,
  wang: WANG_006,
  li: LI_006,
  zhao: ZHAO_006,
}

// 样例发布：改林老师两处（→SCH-007），改陈老师一处（→SCH-008）
export const SAMPLE_LIN_CHANGE = LIN_007
export const SAMPLE_CHEN_CHANGE = CHEN_008

// 晚发布只影响 10 月：给周老师加一节 10/5 起生效（验证不吞掉 9 月更新）
export const SAMPLE_ZHOU_OCT: TemplateEntry[] = [
  ...ZHOU_006,
  { key: "zhou-oct-add", weekday: 2, periodId: "a3", className: ZHOU_CLS, subject: "物理", group: "F2", unitName: "力学实验", room: "D302" },
]

// 取该教师在 <= schSeq 的最近一次定义（继承）
export function schoolTemplate(teacherId: string, schSeq: number): TemplateEntry[] {
  const map = TEACHER_SCHEDULES[teacherId]
  if (!map) return []
  let best = 0
  for (const k of Object.keys(map)) {
    const n = Number(k)
    if (n <= schSeq && n > best) best = n
  }
  return best ? map[best] : []
}

// 该教师“内容来源”序号：<= 全校最新 seq 且该教师有定义变化的最大 seq
export function contentSourceSeq(teacherId: string, latestSeq: number): number {
  const map = TEACHER_SCHEDULES[teacherId]
  if (!map) return 6
  let best = 6
  for (const k of Object.keys(map)) {
    const n = Number(k)
    if (n <= latestSeq && n > best) best = n
  }
  return best
}

/* ---------------- 差异计算 ---------------- */

export type DiffKind = "added" | "removed" | "moved" | "room" | "same"

export interface DiffRow {
  key: string
  kind: DiffKind
  label: string // 课程标签，如 高一1班 • 数学 · P1
  school?: { weekday: number; periodId: string; room: string | null }
  personal?: { weekday: number; periodId: string; room: string | null }
  text: string // 文字说明（正负变化都有文字，不靠颜色）
}

function slotText(e: { weekday: number; periodId: string; room: string | null }): string {
  const wd = WEEKDAYS.find((w) => w.n === e.weekday)?.label ?? ""
  const p = periodById(e.periodId)?.label ?? e.periodId
  return `${wd} ${p} · ${e.room ?? "未排教室"}`
}

// 比较“学校内容(school)”与“教师使用内容(personal)”两套模板
export function diffTemplates(school: TemplateEntry[], personal: TemplateEntry[]): DiffRow[] {
  const rows: DiffRow[] = []
  const keys = new Set([...school.map((e) => e.key), ...personal.map((e) => e.key)])
  for (const key of keys) {
    const s = school.find((e) => e.key === key)
    const p = personal.find((e) => e.key === key)
    const label = (s ?? p)!.className + (( s ?? p)!.group ? ` · ${(s ?? p)!.group}` : "")
    if (s && !p) {
      // 学校版有、我的版没有 —— 从“学校有新版”的视角，这是学校新增（采用后我会多出这节课）
      rows.push({ key, kind: "added", label, school: s, text: `学校新增：${slotText(s)}` })
    } else if (!s && p) {
      // 我的版有、学校版没有 —— 学校未包含此课（你的个人安排仍保留）
      rows.push({ key, kind: "removed", label, personal: p, text: `学校未包含：${slotText(p)}` })
    } else if (s && p) {
      const moved = s.weekday !== p.weekday || s.periodId !== p.periodId
      const roomChanged = s.room !== p.room
      if (moved) {
        rows.push({ key, kind: "moved", label, school: s, personal: p, text: `时间调整：我的 ${slotText(p)} → 学校 ${slotText(s)}` })
      } else if (roomChanged) {
        rows.push({ key, kind: "room", label, school: s, personal: p, text: `教室调整：我的 ${p.room ?? "未排"} → 学校 ${s.room ?? "未排"}` })
      } else {
        rows.push({ key, kind: "same", label, school: s, personal: p, text: "无变化" })
      }
    }
  }
  // 稳定排序：变化在前
  const order: Record<DiffKind, number> = { moved: 0, room: 1, added: 2, removed: 3, same: 4 }
  return rows.sort((a, b) => order[a.kind] - order[b.kind] || a.key.localeCompare(b.key))
}

export function changedRows(rows: DiffRow[]): DiffRow[] {
  return rows.filter((r) => r.kind !== "same")
}

/* ---------------- 冲突检测（真实计算，非固定值） ---------------- */

export type ConflictType = "teacher" | "room" | "student" | "time" | "unknown"

export interface Conflict {
  type: ConflictType
  date: string
  a: ProjectedEntry
  b: ProjectedEntry
  reason: string
}

// 对一批投影后的课次做资源冲突检测（同日 + 时间[start,end)重叠）
export function detectConflicts(entries: ProjectedEntry[]): Conflict[] {
  const out: Conflict[] = []
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]
      if (a.date !== b.date) continue
      if (!periodsOverlap(a.periodId, b.periodId)) continue
      // 明确共同授课（同 key）不算冲突
      if (a.key === b.key) continue
      if (a.teacherId === b.teacherId) {
        out.push({ type: "teacher", date: a.date, a, b, reason: "同一教师在重叠时间被安排两节独立课次" })
      } else if (a.room && b.room && a.room === b.room) {
        out.push({ type: "room", date: a.date, a, b, reason: `教室 ${a.room} 在重叠时间被两节课次占用` })
      } else if (a.studentGroup && b.studentGroup && a.studentGroup === b.studentGroup) {
        out.push({ type: "student", date: a.date, a, b, reason: "同一批学生在重叠时间被安排两节独立课次" })
      }
    }
  }
  return out
}

/* ---------------- 投影：周模板 → 实际日期 ---------------- */

export function projectWeek(
  template: TemplateEntry[],
  weekStart: string,
  teacherId: string,
  origin: ProjectedEntry["origin"] = "school",
): ProjectedEntry[] {
  return template
    .map((e) => ({
      ...e,
      date: addDays(weekStart, e.weekday - 1),
      teacherId,
      origin,
    }))
    .filter((e) => (!e.validFrom || e.date >= e.validFrom) && (!e.validTo || e.date <= e.validTo))
}

/* ---------------- 拖拽 / 手动编辑：草稿与已应用共用的“槽位编辑” ---------------- */

export type EditAction = "move" | "remove" | "room" | "add"

// 单条槽位编辑：move=改到目标星期/节次/教室；room=仅改教室；remove=删除该课次。
// scope=once 仅影响 onDate 所在周；scope=range 影响 effectiveDate 起各周。
export interface SlotEdit {
  id: string
  key: string
  action: EditAction
  weekday: number
  periodId: string
  room: string | null
  scope: "once" | "range"
  onDate: string // 仅本次：受影响课次原始日期（也用于按周命中）
  effectiveDate: string // 固定区间：自该日起生效（区间开始）
  effectiveTo?: string // 固定区间：区间结束（含）；缺省表示自开始日起持续，但界面要求填写有界范围
  label: string
  // 新增课次（action="add"）时携带的完整字段
  className?: string
  subject?: string
  group?: string
  // 课节信息（改名/信息编辑均可顺带携带；仅在显式携带时覆盖）
  note?: string
  noteShow?: boolean
  displayMode?: DisplayMode
  customLabel?: string
}

export function editAppliesToWeek(ed: SlotEdit, weekStart: string): boolean {
  const weekEnd = addDays(weekStart, 6)
  if (ed.scope === "range") {
    if (weekEnd < ed.effectiveDate) return false
    if (ed.effectiveTo && weekStart > ed.effectiveTo) return false
    return true
  }
  return ed.onDate >= weekStart && ed.onDate <= weekEnd
}

// 将编辑携带的教学班名 / 单元组名覆盖应用到模板项（move / room 编辑均可顺带改名）。
// 仅当编辑显式携带对应字段时才覆盖；拖拽等未改名的编辑不受影响。
function applyRename(t: TemplateEntry, ed: SlotEdit): TemplateEntry {
  const next = { ...t }
  if (ed.className !== undefined) next.className = ed.className
  if (ed.subject !== undefined) next.subject = ed.subject
  if (ed.group !== undefined) next.group = ed.group || undefined
  if (ed.note !== undefined) next.note = ed.note || undefined
  if (ed.noteShow !== undefined) next.noteShow = ed.noteShow
  if (ed.displayMode !== undefined) next.displayMode = ed.displayMode
  if (ed.customLabel !== undefined) next.customLabel = ed.customLabel || undefined
  return next
}

// 逐周计算：仅本次编辑只影响其所在周；固定区间编辑影响生效日之后各周。
export function applyWeekEdits(
  base: TemplateEntry[],
  edits: SlotEdit[],
  weekStart: string,
): { template: TemplateEntry[]; editedKeys: string[] } {
  const out = base.map((e) => ({ ...e }))
  const editedKeys: string[] = []
  for (const ed of edits) {
    if (!editAppliesToWeek(ed, weekStart)) continue
    if (ed.action === "add") {
      if (!out.some((e) => e.key === ed.key)) {
        out.push({
          key: ed.key,
          weekday: ed.weekday,
          periodId: ed.periodId,
          className: ed.className ?? "新课次",
          subject: ed.subject ?? "",
          group: ed.group,
          room: ed.room,
          kind: "class",
          note: ed.note || undefined,
          noteShow: ed.noteShow,
          displayMode: ed.displayMode,
          customLabel: ed.customLabel || undefined,
        })
      }
      if (!editedKeys.includes(ed.key)) editedKeys.push(ed.key)
      continue
    }
    const idx = out.findIndex((e) => e.key === ed.key)
    if (idx < 0) continue
    if (ed.action === "remove") {
      out.splice(idx, 1)
    } else if (ed.action === "room") {
      out[idx] = applyRename({ ...out[idx], room: ed.room }, ed)
    } else {
      out[idx] = applyRename({ ...out[idx], weekday: ed.weekday, periodId: ed.periodId, room: ed.room }, ed)
    }
    if (!editedKeys.includes(ed.key)) editedKeys.push(ed.key)
  }
  return { template: out, editedKeys }
}

// 模板级应用（发布学校草稿：产生新的完整周模板，不分周）
export function applyTemplateEdits(base: TemplateEntry[], edits: SlotEdit[]): TemplateEntry[] {
  const out = base.map((e) => ({ ...e }))
  for (const ed of edits) {
    if (ed.action === "add") {
      if (!out.some((e) => e.key === ed.key)) {
        out.push({
          key: ed.key,
          weekday: ed.weekday,
          periodId: ed.periodId,
          className: ed.className ?? "新课次",
          subject: ed.subject ?? "",
          group: ed.group,
          room: ed.room,
          kind: "class",
          note: ed.note || undefined,
          noteShow: ed.noteShow,
          displayMode: ed.displayMode,
          customLabel: ed.customLabel || undefined,
        })
      }
      continue
    }
    const idx = out.findIndex((e) => e.key === ed.key)
    if (idx < 0) continue
    if (ed.action === "remove") out.splice(idx, 1)
    else if (ed.action === "room") out[idx] = applyRename({ ...out[idx], room: ed.room }, ed)
    else out[idx] = applyRename({ ...out[idx], weekday: ed.weekday, periodId: ed.periodId, room: ed.room }, ed)
  }
  return out
}

export function editLabel(
  e: { className: string; group?: string },
  action: EditAction,
  weekday: number,
  periodId: string,
  room: string | null,
): string {
  const name = `${e.className}${e.group ? " · " + e.group : ""}`
  if (action === "remove") return `${name}：删除该课次`
  const wd = WEEKDAYS.find((w) => w.n === weekday)?.label ?? ""
  const p = periodById(periodId)?.label ?? periodId
  if (action === "add") return `${name}：新增 ${wd} ${p} · ${room ?? "未排教室"}`
  return `${name}：${wd} ${p} · ${room ?? "未排教室"}`
}
