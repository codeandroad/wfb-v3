"use client"

// 教学组织共享状态（原型）：教学班、按需教学分工、名单派生、排课归属与学生实际去向。
// 逻辑事实取自 contracts/demo_fixture.json（同包）；运行时以稳定目标与有效名单关系派生，
// events.title / placementHomeroomId / studentIds 仅作素材核对快照，不作为第二份权威。
// 只清理本原型命名空间的存储；普通刷新 / 切页 / 切人物不重置。

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import fixture from "./fixture.json"
import { STAFF, STAFF_TEACHER_ID } from "@/lib/demo/staff"
import type { AdminClass } from "@/lib/demo/school"
import { getAdminClasses, useAdminClasses } from "@/lib/school/admin-class-store"

/* ============================================================
 * 类型
 * ========================================================== */

export interface Period {
  id: string
  label: string
  ordinal: number
  start: string
  end: string
  segment: "day" | "midday" | "evening"
}
export interface Homeroom {
  id: string
  name: string
}
export interface Subject {
  id: string
  name: string
}
export interface Course {
  id: string
  subjectId: string
  name: string
}
export interface Teacher {
  id: string
  name: string
  accountAvailable: boolean
}
export interface Student {
  id: string
  name: string
  homeroomId: string
}
export type RosterMode = "INHERIT" | "EXPLICIT_SUBSET"

export interface Responsibility {
  id: string
  teachingClassId: string
  sharedMark: string | null
  teacherIds: string[]
  studentIds: string[]
  validFrom: string
  validToExclusive: string
  rosterMode: RosterMode
  optionalCatalogContentId: string | null
}
export interface TeachingClass {
  id: string
  name: string
  subjectId: string
  placementHomeroomId: string | null
  courseId: string | null
  studentIds: string[]
  wholeTeacherIds: string[]
  validFrom: string
  validToExclusive: string
  courseResponsibleTeacherId: string | null
  sharedShortName: string | null
  nameEdited?: boolean // 用户手改过班名后，不再随学科/归属自动覆盖
}
export interface CalEvent {
  id: string
  date: string
  weekday: number
  periodId: string
  kind: "COURSE" | "ACTIVITY"
  teachingClassId: string | null
  responsibilityId: string | null
  teacherIds: string[]
  locationId: string | null
  title: string
  studentIds: string[]
  placementHomeroomId: string | null
  sourceOmitSharedMark: boolean
  sharedNote: string
  showSharedNoteOnCard: boolean
}
export interface Location {
  id: string
  name: string
  exclusive: boolean
}

interface Fixture {
  semester: { id: string; start: string; endExclusive: string }
  simulatedNow: string
  previewWeekStart: string
  periods: Period[]
  homerooms: Homeroom[]
  subjects: Subject[]
  courses: Course[]
  teachers: Teacher[]
  students: Student[]
  teachingClasses: TeachingClass[]
  responsibilities: Responsibility[]
  locations: Location[]
  events: CalEvent[]
  uiPrototype: { storageNamespace: string; schemaGeneration: string }
}

const FX = fixture as unknown as Fixture

/* 静态参考数据（原型不改） */
export const PERIODS: Period[] = FX.periods
export const HOMEROOMS: Homeroom[] = FX.homerooms
export const SUBJECTS: Subject[] = FX.subjects
export const COURSES: Course[] = FX.courses
export const TEACHERS: Teacher[] = FX.teachers
export const STUDENTS: Student[] = FX.students
export const LOCATIONS: Location[] = FX.locations
export const SEMESTER = FX.semester
export const SIMULATED_NOW = FX.simulatedNow
export const PREVIEW_WEEK_START = FX.previewWeekStart
export const EVENTS: CalEvent[] = FX.events

const STORAGE_KEY = `${FX.uiPrototype.storageNamespace}:${FX.uiPrototype.schemaGeneration}:v1`

/* ============================================================
 * 可变状态：教学班 + 分工（其余为参考数据）
 * ========================================================== */

// 任教关系的任期：同一“教师 × 目标”可有多段（更换、结束后保留历史）。to 为不含当日的结束日期；null 表示未设结束日期。
export interface Tenure {
  from: string
  to: string | null
  role?: "primary" | "co"
}
// 演示用权限档：full = 分工配置 + 任命；configOnly = 仅分工配置
export type TeachPerm = "full" | "configOnly"

interface TeachingState {
  classes: TeachingClass[]
  responsibilities: Responsibility[]
  selfTaught: string[] // 「由我任教」登记的 classId（仅演示本人任务来源）
  displayPrefs: Record<string, DisplayPref> // 键：`${teacherId}|${taskKey}`
  tenures: Record<string, Tenure[]> // 键：`${targetKey}|${teacherId}`；缺省视为目标起始日起、未设结束日期
  commits: Record<string, CommitOk> // 幂等：同一办理令牌只落库一次
  demoPerm: TeachPerm
  seq: number // 生成新 ID 用
}

function freshState(): TeachingState {
  return {
    classes: FX.teachingClasses.map((c) => ({ ...c, studentIds: [...c.studentIds], wholeTeacherIds: [...c.wholeTeacherIds] })),
    responsibilities: FX.responsibilities.map((r) => ({ ...r, teacherIds: [...r.teacherIds], studentIds: [...r.studentIds] })),
    selfTaught: [],
    displayPrefs: {},
    tenures: {},
    commits: {},
    demoPerm: "full",
    seq: 1,
  }
}

function load(): TeachingState {
  if (typeof window === "undefined") return freshState()
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return freshState()
    const p = JSON.parse(raw) as TeachingState
    if (!p || !Array.isArray(p.classes) || !Array.isArray(p.responsibilities)) return freshState()
    return { ...p, tenures: p.tenures ?? {}, commits: p.commits ?? {}, demoPerm: p.demoPerm ?? "full" }
  } catch {
    return freshState()
  }
}

function persist(s: TeachingState) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/* ============================================================
 * 纯派生
 * ========================================================== */

export function subjectName(id: string): string {
  return SUBJECTS.find((s) => s.id === id)?.name ?? id
}
export function courseName(id: string | null): string | null {
  if (!id) return null
  return COURSES.find((c) => c.id === id)?.name ?? id
}
export function teacherName(id: string): string {
  const t = TEACHERS.find((x) => x.id === id)
  if (t) return t.name
  if (id.startsWith("S:")) return STAFF.find((s) => s.id === id.slice(2))?.name ?? id
  if (id.startsWith("P:")) return id.slice(2)
  return id
}
// 真实教职工 → 任教主体 id；不以是否有账号为前提
export function teacherIdForStaff(staffId: string): string {
  return STAFF_TEACHER_ID[staffId] ?? `S:${staffId}`
}
export type TeacherAccess = "open" | "notOpened" | "unavailable"
export function teacherAccess(id: string): TeacherAccess {
  const staffId = id.startsWith("S:") ? id.slice(2) : Object.entries(STAFF_TEACHER_ID).find(([, t]) => t === id)?.[0]
  const staff = staffId ? STAFF.find((s) => s.id === staffId) : undefined
  if (staff) {
    if (staff.accountStatus === "enabled") return "open"
    if (staff.accountStatus === "none" || staff.accountStatus === "pending") return "notOpened"
    return "unavailable"
  }
  if (id.startsWith("P:")) return "notOpened"
  return TEACHERS.find((t) => t.id === id)?.accountAvailable ? "open" : "notOpened"
}
export const TEACHER_ACCESS_LABEL: Record<TeacherAccess, string> = {
  open: "访问可用",
  notOpened: "访问未开通",
  unavailable: "账号不可用",
}
// 行政班选项：名单素材中的行政班 + 行政班管理里新建的班（按名称去重）
function mergeHomerooms(adminClasses: AdminClass[]): Homeroom[] {
  const names = new Set(HOMEROOMS.map((h) => h.name))
  return [...HOMEROOMS, ...adminClasses.filter((c) => !names.has(c.name)).map((c) => ({ id: c.id, name: c.name }))]
}
export function allHomerooms(): Homeroom[] {
  return mergeHomerooms(getAdminClasses())
}
export function useHomerooms(): Homeroom[] {
  const adminClasses = useAdminClasses()
  return useMemo(() => mergeHomerooms(adminClasses), [adminClasses])
}
export function homeroomName(id: string | null): string | null {
  if (!id) return null
  return allHomerooms().find((h) => h.id === id)?.name ?? id
}
export function studentsOfHomeroom(homeroomId: string): Student[] {
  return STUDENTS.filter((st) => st.homeroomId === homeroomId)
}
// 名单按行政班构成（用于“32 人 = 高一1班 20 + 高一2班 12”这类说明）
export function rosterComposition(ids: string[]): { homeroomId: string; name: string; count: number }[] {
  const map = new Map<string, number>()
  for (const id of ids) {
    const hid = studentById(id)?.homeroomId
    if (hid) map.set(hid, (map.get(hid) ?? 0) + 1)
  }
  return Array.from(map.entries()).map(([homeroomId, count]) => ({ homeroomId, name: homeroomName(homeroomId) ?? homeroomId, count }))
}
export function studentById(id: string): Student | undefined {
  return STUDENTS.find((s) => s.id === id)
}
export function locationName(id: string | null): string | null {
  if (!id) return null
  return LOCATIONS.find((l) => l.id === id)?.name ?? id
}
export function periodById(id: string): Period | undefined {
  return PERIODS.find((p) => p.id === id)
}
export function coursesForSubject(subjectId: string): Course[] {
  return COURSES.filter((c) => c.subjectId === subjectId)
}

// 分工有效名单（继承父班或明确子集）
export function responsibilityRoster(s: TeachingState, resp: Responsibility): string[] {
  if (resp.rosterMode === "INHERIT") {
    const parent = s.classes.find((c) => c.id === resp.teachingClassId)
    return parent ? [...parent.studentIds] : []
  }
  return [...resp.studentIds]
}

// 教学班全部有效学生（去重）
export function classRoster(cls: TeachingClass): string[] {
  return Array.from(new Set(cls.studentIds))
}

export function responsibilitiesOf(s: TeachingState, classId: string): Responsibility[] {
  return s.responsibilities.filter((r) => r.teachingClassId === classId)
}

// 事件的有效受众（从稳定目标派生，不读 event.studentIds 快照）
export function eventRoster(s: TeachingState, ev: CalEvent): string[] {
  if (ev.responsibilityId) {
    const resp = s.responsibilities.find((r) => r.id === ev.responsibilityId)
    if (resp) return responsibilityRoster(s, resp)
  }
  if (ev.teachingClassId) {
    const cls = s.classes.find((c) => c.id === ev.teachingClassId)
    if (cls) return classRoster(cls)
  }
  return []
}

// 事件的当前显示标题（从稳定教学班取当前正式名，而非 event.title 快照）
export function eventTitle(s: TeachingState, ev: CalEvent): string {
  if (ev.kind === "ACTIVITY") return ev.title
  if (ev.teachingClassId) {
    const cls = s.classes.find((c) => c.id === ev.teachingClassId)
    if (cls) return cls.name
  }
  return ev.title
}

// 事件的当前排课归属（从稳定教学班取，而非 event 快照）
export function eventPlacement(s: TeachingState, ev: CalEvent): string | null {
  if (ev.teachingClassId) {
    const cls = s.classes.find((c) => c.id === ev.teachingClassId)
    if (cls) return cls.placementHomeroomId
  }
  return ev.placementHomeroomId
}

export interface DestinationRow {
  event: CalEvent
  classId: string | null
  title: string
  subjectId: string | null
  teacherIds: string[]
  locationId: string | null
  memberIds: string[] // 属于该行政班且实际在该课名单内的学生
}

// 行政班「归属安排」：读教学班显式排课归属 ID（section 9.3）
export function placementEvents(s: TeachingState, homeroomId: string, date: string, periodId?: string): CalEvent[] {
  return EVENTS.filter((ev) => {
    if (ev.date !== date) return false
    if (periodId && ev.periodId !== periodId) return false
    return eventPlacement(s, ev) === homeroomId
  })
}

// 行政班「学生实际去向」：该日行政班学生与实际授课名单求交集（section 9.3）
export function destinationEvents(s: TeachingState, homeroomId: string, date: string, periodId?: string): DestinationRow[] {
  const homeroomStudentIds = new Set(STUDENTS.filter((st) => st.homeroomId === homeroomId).map((st) => st.id))
  const out: DestinationRow[] = []
  for (const ev of EVENTS) {
    if (ev.date !== date) continue
    if (periodId && ev.periodId !== periodId) continue
    const roster = eventRoster(s, ev)
    const members = roster.filter((id) => homeroomStudentIds.has(id))
    if (members.length === 0) continue
    const cls = ev.teachingClassId ? s.classes.find((c) => c.id === ev.teachingClassId) : null
    out.push({
      event: ev,
      classId: ev.teachingClassId,
      title: eventTitle(s, ev),
      subjectId: cls?.subjectId ?? null,
      teacherIds: ev.teacherIds,
      locationId: ev.locationId,
      memberIds: members,
    })
  }
  return out
}

// 相似教学班（同学期同归属同学科）
export function findSimilar(s: TeachingState, subjectId: string, placementHomeroomId: string | null, excludeId?: string): TeachingClass[] {
  return s.classes.filter(
    (c) => c.id !== excludeId && c.subjectId === subjectId && c.placementHomeroomId === placementHomeroomId,
  )
}

// 建议班名：<归属行政班名> • <学科名>；无归属时空
export function suggestClassName(subjectId: string, placementHomeroomId: string | null): string {
  const subj = subjectName(subjectId)
  const room = homeroomName(placementHomeroomId)
  if (room) return `${room} • ${subj}`
  return ""
}

// 当前人物任教任务（整科 + 分工）
export interface TaskRow {
  kind: "WHOLE" | "RESPONSIBILITY"
  classId: string
  className: string
  subjectId: string
  responsibilityId?: string
  sharedMark?: string | null
  teacherIds: string[]
  rosterCount: number
}

export const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

// 任务在预览周的实际课节：从 EVENTS 按稳定目标聚合（不硬编码文案）
export function taskSchedule(task: TaskRow): { weekdays: number[]; periods: number } {
  const matched = EVENTS.filter((ev) => {
    if (ev.kind !== "COURSE") return false
    if (ev.teachingClassId !== task.classId) return false
    if (task.kind === "RESPONSIBILITY") return ev.responsibilityId === task.responsibilityId
    return !ev.responsibilityId // 整科：无分工的课次
  })
  const weekdays = Array.from(new Set(matched.map((ev) => ev.weekday))).sort((a, b) => a - b)
  return { weekdays, periods: matched.length }
}

export function scheduleLabel(sch: { weekdays: number[]; periods: number }): string {
  if (sch.periods === 0) return "本周暂无排课"
  const days = sch.weekdays.map((w) => WEEKDAY_LABELS[w]).join("/")
  return `${days} · 共 ${sch.periods} 节`
}

// 个人显示解析：shared 用分工名称 / custom 用自定义文字 / hidden 隐藏文字
export type DisplayMode = "shared" | "custom" | "hidden"
export interface DisplayPref {
  mode: DisplayMode
  customText?: string
}

export function taskKey(task: TaskRow): string {
  return task.kind === "RESPONSIBILITY" ? `R:${task.responsibilityId}` : `W:${task.classId}`
}

export function sharedMarkOf(task: TaskRow): string | null {
  if (task.kind === "WHOLE") return null // 整科无标记
  return task.sharedMark ?? null
}

/* ============================================================
 * 任教目标与任期（教学班侧与教职工侧共用同一份事实）
 * 目标 = 教学班的整科教学（W:classId）或实际教学分工（R:respId）。
 * 团队成员来自 wholeTeacherIds / teacherIds，任期来自 tenures；两端只是不同读取视角。
 * ========================================================== */

export const TODAY = FX.simulatedNow.slice(0, 10)
export const OPEN_END = "9999-12-31"
export const wholeKey = (classId: string) => `W:${classId}`
export const respKey = (respId: string) => `R:${respId}`
export const draftKey = (tempId: string) => `D:${tempId}`

export function defaultTenureFrom(): string {
  return TODAY > SEMESTER.start ? TODAY : SEMESTER.start
}
export function overlaps(a: { from: string; to: string | null }, b: { from: string; to: string | null }): boolean {
  return a.from < (b.to ?? OPEN_END) && b.from < (a.to ?? OPEN_END)
}
export function tenureState(t: Tenure, at = TODAY): "current" | "future" | "ended" {
  if (t.to && t.to <= at) return "ended"
  if (t.from > at) return "future"
  return "current"
}
export function tenureLabel(t: { from: string; to: string | null }): string {
  return `${t.from} 起 · ${t.to ? `${t.to} 止` : "未设结束日期"}`
}

function targetFrom(s: TeachingState, key: string): string {
  if (key.startsWith("W:")) return s.classes.find((c) => c.id === key.slice(2))?.validFrom ?? SEMESTER.start
  if (key.startsWith("R:")) return s.responsibilities.find((r) => r.id === key.slice(2))?.validFrom ?? SEMESTER.start
  return SEMESTER.start
}
function targetTeacherIds(s: TeachingState, key: string): string[] {
  if (key.startsWith("W:")) return s.classes.find((c) => c.id === key.slice(2))?.wholeTeacherIds ?? []
  if (key.startsWith("R:")) return s.responsibilities.find((r) => r.id === key.slice(2))?.teacherIds ?? []
  return []
}
export function tenuresOf(s: TeachingState, key: string, teacherId: string): Tenure[] {
  const rec = s.tenures[`${key}|${teacherId}`]
  if (rec && rec.length) return rec
  return targetTeacherIds(s, key).includes(teacherId) ? [{ from: targetFrom(s, key), to: null }] : []
}
export interface TeamMember {
  teacherId: string
  tenures: Tenure[]
}
export function teamOf(s: TeachingState, key: string): TeamMember[] {
  return targetTeacherIds(s, key).map((teacherId) => ({ teacherId, tenures: tenuresOf(s, key, teacherId) }))
}
// 所选任期内在岗的成员
export function teamDuring(s: TeachingState, key: string, period: { from: string; to: string | null }): TeamMember[] {
  return teamOf(s, key).filter((m) => m.tenures.some((t) => overlaps(t, period)))
}

export interface TeachTarget {
  key: string
  kind: "WHOLE" | "RESP"
  classId: string
  className: string
  classShortName: string | null
  subjectId: string
  courseId: string | null
  respId?: string
  mark: string | null
  divisionLabel: string // 整科教学 / 规范分工名 / 未命名分工 #n
  code: string // 业务编号（非 UUID）
  rosterCount: number
  rosterMode?: RosterMode
}

export function targetLabel(t: Pick<TeachTarget, "className" | "divisionLabel">): string {
  return `${t.className}｜${t.divisionLabel}`
}

// 从真实教学班 / 实际分工出发列出可安排对象，任命信息另行附加，不从既有任命反查
export function teachingTargets(s: TeachingState): TeachTarget[] {
  const out: TeachTarget[] = []
  for (const cls of s.classes) {
    out.push({
      key: wholeKey(cls.id),
      kind: "WHOLE",
      classId: cls.id,
      className: cls.name,
      classShortName: cls.sharedShortName,
      subjectId: cls.subjectId,
      courseId: cls.courseId,
      mark: null,
      divisionLabel: "整科教学",
      code: cls.id,
      rosterCount: classRoster(cls).length,
    })
    responsibilitiesOf(s, cls.id).forEach((r, i) => {
      out.push({
        key: respKey(r.id),
        kind: "RESP",
        classId: cls.id,
        className: cls.name,
        classShortName: cls.sharedShortName,
        subjectId: cls.subjectId,
        courseId: cls.courseId,
        respId: r.id,
        mark: r.sharedMark,
        divisionLabel: r.sharedMark ?? `未命名分工 #${i + 1}`,
        code: r.id,
        rosterCount: responsibilityRoster(s, r).length,
        rosterMode: r.rosterMode,
      })
    })
  }
  return out
}

export function searchTargets(
  all: TeachTarget[],
  f: { query: string; classId?: string; subjectId?: string },
): TeachTarget[] {
  const q = f.query.trim().toLowerCase()
  return all.filter((t) => {
    if (f.classId && t.classId !== f.classId) return false
    if (f.subjectId && t.subjectId !== f.subjectId) return false
    if (!q) return true
    const hay = [t.className, t.classShortName ?? "", t.divisionLabel, courseName(t.courseId) ?? "", t.code]
      .join(" ")
      .toLowerCase()
    return hay.includes(q)
  })
}

/* ---------------- 统一办理命令（校验） ---------------- */

export interface DraftDivision {
  tempId: string
  classId: string
  sharedMark: string | null
  rosterMode: RosterMode
  studentIds: string[]
  optionalCatalogContentId: string | null
}
export interface AssignInput {
  targetKey: string // W: / R: / D:（待创建分工）
  teacherId: string
  from: string
  to: string | null
  role?: "primary" | "co"
}
export interface CommitOk {
  ok: true
  createdIds: Record<string, string> // tempId → 服务端生成的稳定 ID
  created: number
  assigned: number
  notOpened: string[] // 访问未开通的教师名
  replayed?: boolean
}
export type CommitResult = CommitOk | { ok: false; reason: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function draftLabel(s: TeachingState, d: DraftDivision): string {
  const cls = s.classes.find((c) => c.id === d.classId)
  return `${cls?.name ?? d.classId}｜${d.sharedMark ?? "未命名分工（待创建）"}`
}
function keyLabel(s: TeachingState, key: string, drafts: DraftDivision[]): string {
  if (key.startsWith("D:")) {
    const d = drafts.find((x) => x.tempId === key.slice(2))
    return d ? draftLabel(s, d) : "待创建分工"
  }
  const t = teachingTargets(s).find((x) => x.key === key)
  return t ? targetLabel(t) : key
}
function classOfKey(s: TeachingState, key: string, drafts: DraftDivision[]): string | null {
  if (key.startsWith("W:")) return key.slice(2)
  if (key.startsWith("R:")) return s.responsibilities.find((r) => r.id === key.slice(2))?.teachingClassId ?? null
  if (key.startsWith("D:")) return drafts.find((d) => d.tempId === key.slice(2))?.classId ?? null
  return null
}

// 校验与落库共用同一函数；前端提示与“服务端”拒绝规则一致，篡改输入同样被拒
export function validateTeachingCommit(
  s: TeachingState,
  drafts: DraftDivision[],
  assigns: AssignInput[],
  perm: TeachPerm,
): string | null {
  if (!drafts.length && !assigns.length) return "没有需要办理的内容"
  if (assigns.length && perm !== "full") return "当前操作者没有任命权：可以仅创建分工，任教需由具备任命权的人办理"
  for (const d of drafts) {
    const cls = s.classes.find((c) => c.id === d.classId)
    if (!cls) return "所属教学班不存在或已失效"
    if (d.rosterMode === "EXPLICIT_SUBSET") {
      const roster = new Set(cls.studentIds)
      if (!d.studentIds.length) return "明确子集至少选择 1 名学生"
      if (d.studentIds.some((id) => !roster.has(id))) return "学生子集超出父教学班的有效名单"
    }
  }
  const seen = new Set<string>()
  for (const a of assigns) {
    const label = keyLabel(s, a.targetKey, drafts)
    const name = teacherName(a.teacherId)
    if (a.targetKey.startsWith("D:")) {
      if (!drafts.some((d) => draftKey(d.tempId) === a.targetKey)) return "引用的待创建分工不存在"
    } else if (!teachingTargets(s).some((t) => t.key === a.targetKey)) {
      return `${label}：目标不存在或已失效，不能作为任教对象`
    }
    if (!DATE_RE.test(a.from)) return `${name}：请填写开始日期`
    if (a.to !== null && !DATE_RE.test(a.to)) return `${name}：请填写结束日期或选择未设结束日期`
    if (a.to !== null && a.to <= a.from) return `${name}：结束日期必须晚于开始日期`
    if (a.from < SEMESTER.start || (a.to ?? SEMESTER.endExclusive) > SEMESTER.endExclusive) {
      return `${name}：任期超出本学期（${SEMESTER.start} 至 ${SEMESTER.endExclusive} 前）`
    }
    const k = `${a.targetKey}|${a.teacherId}`
    if (seen.has(k)) return `${name} 对 ${label} 重复提交`
    seen.add(k)
    if (!a.targetKey.startsWith("D:")) {
      const existing = tenuresOf(s, a.targetKey, a.teacherId).find((t) => overlaps(t, a))
      if (existing) return `${name} 在所选任期内已任教 ${label}（${tenureLabel(existing)}），如需延长或调整请在任教团队中调整任期`
    }
  }
  // 同一教师在同一教学班同时承担整科与其下分工：范围重复，不悄悄扩大
  const byTeacherClass = new Map<string, { whole: boolean; resp: boolean; period: AssignInput }>()
  for (const a of assigns) {
    const classId = classOfKey(s, a.targetKey, drafts)
    if (!classId) continue
    const k = `${a.teacherId}|${classId}`
    const cur = byTeacherClass.get(k) ?? { whole: false, resp: false, period: a }
    if (a.targetKey.startsWith("W:")) cur.whole = true
    else cur.resp = true
    byTeacherClass.set(k, cur)
  }
  for (const [k, v] of byTeacherClass) {
    const [teacherId, classId] = k.split("|")
    const hasWhole = v.whole || tenuresOf(s, wholeKey(classId), teacherId).some((t) => overlaps(t, v.period))
    const hasResp =
      v.resp ||
      responsibilitiesOf(s, classId).some((r) => tenuresOf(s, respKey(r.id), teacherId).some((t) => overlaps(t, v.period)))
    if (hasWhole && hasResp) {
      const cls = s.classes.find((c) => c.id === classId)
      return `${teacherName(teacherId)} 在 ${cls?.name ?? classId} 同时任教整科教学与其下分工，范围重复；请只保留其一`
    }
  }
  return null
}

// 当前人物任教任务（整科 + 分工）：按任期过滤，已结束的不再出现；未来任期单独标注
export function tasksForTeacher(s: TeachingState, teacherId: string): (TaskRow & { future?: boolean; from?: string })[] {
  const out: (TaskRow & { future?: boolean; from?: string })[] = []
  function live(key: string) {
    const ts = tenuresOf(s, key, teacherId).filter((t) => tenureState(t) !== "ended")
    if (!ts.length) return null
    const current = ts.find((t) => tenureState(t) === "current")
    return current ? { future: false, from: current.from } : { future: true, from: ts[0].from }
  }
  for (const cls of s.classes) {
    if (!cls.wholeTeacherIds.includes(teacherId)) continue
    const l = live(wholeKey(cls.id))
    if (!l) continue
    out.push({
      kind: "WHOLE",
      classId: cls.id,
      className: cls.name,
      subjectId: cls.subjectId,
      teacherIds: cls.wholeTeacherIds,
      rosterCount: classRoster(cls).length,
      ...l,
    })
  }
  for (const resp of s.responsibilities) {
    if (!resp.teacherIds.includes(teacherId)) continue
    const cls = s.classes.find((c) => c.id === resp.teachingClassId)
    if (!cls) continue
    const l = live(respKey(resp.id))
    if (!l) continue
    out.push({
      kind: "RESPONSIBILITY",
      classId: cls.id,
      className: cls.name,
      subjectId: cls.subjectId,
      responsibilityId: resp.id,
      sharedMark: resp.sharedMark,
      teacherIds: resp.teacherIds,
      rosterCount: responsibilityRoster(s, resp).length,
      ...l,
    })
  }
  return out
}

/* ============================================================
 * Context
 * ========================================================== */

export interface CreateClassInput {
  subjectId: string
  placementHomeroomId: string | null
  name: string
  courseId?: string | null
  sharedShortName?: string | null
  nameEdited?: boolean
}

interface TeachingContext extends TeachingState {
  createClass: (input: CreateClassInput) => TeachingClass
  renameClass: (classId: string, name: string, edited: boolean) => void
  setCourse: (classId: string, courseId: string | null) => void
  setPlacement: (classId: string, placementHomeroomId: string | null) => void
  setWholeTeachers: (classId: string, teacherIds: string[]) => void
  addStudentsFromHomeroom: (classId: string, homeroomId: string) => number
  setClassStudents: (classId: string, studentIds: string[]) => void
  addResponsibility: (classId: string, input: { sharedMark: string | null; teacherIds: string[]; rosterMode: RosterMode; studentIds: string[] }) => Responsibility
  editResponsibility: (respId: string, patch: Partial<Pick<Responsibility, "sharedMark" | "teacherIds" | "rosterMode" | "studentIds">>) => void
  removeResponsibility: (respId: string) => void
  registerSelfTeach: (classId: string, teacherId: string) => void
  setDisplayPref: (teacherId: string, key: string, pref: DisplayPref) => void
  // 统一办理命令：新建分工（可选）+ 安排任教，原子提交；同一 token 重复提交返回首次结果
  commitTeaching: (token: string, drafts: DraftDivision[], assigns: AssignInput[]) => CommitResult
  endTenure: (targetKey: string, teacherId: string, endDate: string) => string | null
  adjustTenure: (targetKey: string, teacherId: string, index: number, next: { from: string; to: string | null }) => string | null
  setDemoPerm: (perm: TeachPerm) => void
  reset: () => void
}

// 进行中的办理令牌：拦截同一渲染周期内的连续点击
const INFLIGHT = new Set<string>()

export function displayPrefKey(teacherId: string, key: string) {
  return `${teacherId}|${key}`
}

const Ctx = createContext<TeachingContext | null>(null)

export function TeachingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TeachingState>(() => freshState())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setState(load())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) persist(state)
  }, [state, hydrated])

  const value = useMemo<TeachingContext>(() => {
    function nextId(prefix: string, seq: number) {
      return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-4)}${seq}`
    }
    return {
      ...state,
      createClass: (input) => {
        const cls: TeachingClass = {
          id: nextId("TC", state.seq),
          name: input.name.trim() || suggestClassName(input.subjectId, input.placementHomeroomId) || "新教学班",
          subjectId: input.subjectId,
          placementHomeroomId: input.placementHomeroomId,
          courseId: input.courseId ?? null,
          studentIds: [],
          wholeTeacherIds: [],
          validFrom: SEMESTER.start,
          validToExclusive: SEMESTER.endExclusive,
          courseResponsibleTeacherId: null,
          sharedShortName: input.sharedShortName ?? null,
          nameEdited: input.nameEdited,
        }
        setState((s) => ({ ...s, classes: [...s.classes, cls], seq: s.seq + 1 }))
        return cls
      },
      renameClass: (classId, name, edited) =>
        setState((s) => ({
          ...s,
          classes: s.classes.map((c) => (c.id === classId ? { ...c, name: name.trim() || c.name, nameEdited: edited } : c)),
        })),
      setCourse: (classId, courseId) =>
        setState((s) => ({ ...s, classes: s.classes.map((c) => (c.id === classId ? { ...c, courseId } : c)) })),
      setPlacement: (classId, placementHomeroomId) =>
        setState((s) => ({
          ...s,
          classes: s.classes.map((c) => {
            if (c.id !== classId) return c
            // 改归属只改归属视图；未手改名时同步建议名
            const name = c.nameEdited ? c.name : suggestClassName(c.subjectId, placementHomeroomId) || c.name
            return { ...c, placementHomeroomId, name }
          }),
        })),
      setWholeTeachers: (classId, teacherIds) =>
        setState((s) => ({
          ...s,
          classes: s.classes.map((c) =>
            c.id === classId ? { ...c, wholeTeacherIds: teacherIds, courseResponsibleTeacherId: teacherIds[0] ?? null } : c,
          ),
        })),
      addStudentsFromHomeroom: (classId, homeroomId) => {
        const add = STUDENTS.filter((st) => st.homeroomId === homeroomId).map((st) => st.id)
        const cls = state.classes.find((c) => c.id === classId)
        const existing = new Set(cls?.studentIds ?? [])
        const added = add.filter((id) => !existing.has(id)).length
        setState((s) => ({
          ...s,
          classes: s.classes.map((c) => {
            if (c.id !== classId) return c
            return { ...c, studentIds: Array.from(new Set([...c.studentIds, ...add])) }
          }),
        }))
        return added
      },
      setClassStudents: (classId, studentIds) =>
        setState((s) => ({
          ...s,
          classes: s.classes.map((c) => (c.id === classId ? { ...c, studentIds: Array.from(new Set(studentIds)) } : c)),
        })),
      addResponsibility: (classId, input) => {
        const cls = state.classes.find((c) => c.id === classId)
        const resp: Responsibility = {
          id: nextId("R", state.seq),
          teachingClassId: classId,
          sharedMark: input.sharedMark,
          teacherIds: input.teacherIds,
          studentIds: input.rosterMode === "EXPLICIT_SUBSET" ? input.studentIds : [],
          validFrom: cls?.validFrom ?? SEMESTER.start,
          validToExclusive: cls?.validToExclusive ?? SEMESTER.endExclusive,
          rosterMode: input.rosterMode,
          optionalCatalogContentId: null,
        }
        setState((s) => ({ ...s, responsibilities: [...s.responsibilities, resp], seq: s.seq + 1 }))
        return resp
      },
      editResponsibility: (respId, patch) =>
        setState((s) => ({
          ...s,
          responsibilities: s.responsibilities.map((r) => (r.id === respId ? { ...r, ...patch } : r)),
        })),
      removeResponsibility: (respId) =>
        setState((s) => ({ ...s, responsibilities: s.responsibilities.filter((r) => r.id !== respId) })),
      registerSelfTeach: (classId, teacherId) =>
        setState((s) => ({
          ...s,
          selfTaught: s.selfTaught.includes(classId) ? s.selfTaught : [...s.selfTaught, classId],
          classes: s.classes.map((c) =>
            c.id === classId && !c.wholeTeacherIds.includes(teacherId)
              ? { ...c, wholeTeacherIds: [...c.wholeTeacherIds, teacherId], courseResponsibleTeacherId: c.courseResponsibleTeacherId ?? teacherId }
              : c,
          ),
        })),
      setDisplayPref: (teacherId, key, pref) =>
        setState((s) => ({ ...s, displayPrefs: { ...s.displayPrefs, [displayPrefKey(teacherId, key)]: pref } })),
      commitTeaching: (token, drafts, assigns) => {
        const prior = state.commits[token]
        if (prior) return { ...prior, replayed: true }
        if (INFLIGHT.has(token)) return { ok: false, reason: "正在提交，请勿重复操作" }
        const err = validateTeachingCommit(state, drafts, assigns, state.demoPerm)
        if (err) return { ok: false, reason: err }
        INFLIGHT.add(token)
        const createdIds: Record<string, string> = {}
        const newResps: Responsibility[] = drafts.map((d, i) => {
          const cls = state.classes.find((c) => c.id === d.classId)!
          const id = nextId("R", state.seq + i)
          createdIds[d.tempId] = id
          return {
            id,
            teachingClassId: d.classId,
            sharedMark: d.sharedMark,
            teacherIds: [],
            studentIds: d.rosterMode === "EXPLICIT_SUBSET" ? d.studentIds : [],
            validFrom: cls.validFrom,
            validToExclusive: cls.validToExclusive,
            rosterMode: d.rosterMode,
            optionalCatalogContentId: d.optionalCatalogContentId,
          }
        })
        const resolved = assigns.map((a) => ({
          ...a,
          targetKey: a.targetKey.startsWith("D:") ? respKey(createdIds[a.targetKey.slice(2)]) : a.targetKey,
        }))
        const notOpened = Array.from(
          new Set(resolved.filter((a) => teacherAccess(a.teacherId) !== "open").map((a) => teacherName(a.teacherId))),
        )
        const result: CommitOk = { ok: true, createdIds, created: drafts.length, assigned: assigns.length, notOpened }
        setState((s) => {
          const tenures = { ...s.tenures }
          for (const a of resolved) {
            const k = `${a.targetKey}|${a.teacherId}`
            // 缺省任期先固化，再追加新任期，历史不丢
            const base = tenuresOf(s, a.targetKey, a.teacherId)
            tenures[k] = [...base, { from: a.from, to: a.to, role: a.role }]
          }
          return {
            ...s,
            classes: s.classes.map((c) => {
              const add = resolved.filter((a) => a.targetKey === wholeKey(c.id) && !c.wholeTeacherIds.includes(a.teacherId))
              if (!add.length) return c
              const ids = [...c.wholeTeacherIds, ...add.map((a) => a.teacherId)]
              return { ...c, wholeTeacherIds: ids, courseResponsibleTeacherId: c.courseResponsibleTeacherId ?? ids[0] }
            }),
            responsibilities: [...s.responsibilities, ...newResps].map((r) => {
              const add = resolved.filter((a) => a.targetKey === respKey(r.id) && !r.teacherIds.includes(a.teacherId))
              return add.length ? { ...r, teacherIds: [...r.teacherIds, ...add.map((a) => a.teacherId)] } : r
            }),
            tenures,
            commits: { ...s.commits, [token]: result },
            seq: s.seq + drafts.length + 1,
          }
        })
        INFLIGHT.delete(token)
        return result
      },
      endTenure: (targetKey, teacherId, endDate) => {
        const list = tenuresOf(state, targetKey, teacherId)
        const idx = list.findIndex((t) => tenureState(t) !== "ended")
        if (idx < 0) return "该教师没有进行中的任期"
        const t = list[idx]
        if (!DATE_RE.test(endDate)) return "请选择结束日期"
        if (t.to && endDate > t.to) return "结束日期不能晚于原结束日期；延长请用调整任期"
        const next = endDate <= t.from ? list.filter((_, i) => i !== idx) : list.map((x, i) => (i === idx ? { ...x, to: endDate } : x))
        setState((s) => {
          const tenures = { ...s.tenures, [`${targetKey}|${teacherId}`]: next }
          if (next.length) return { ...s, tenures }
          // 从未生效的任期被撤销：移出团队，不留空记录
          return {
            ...s,
            tenures,
            classes: s.classes.map((c) =>
              wholeKey(c.id) === targetKey ? { ...c, wholeTeacherIds: c.wholeTeacherIds.filter((x) => x !== teacherId) } : c,
            ),
            responsibilities: s.responsibilities.map((r) =>
              respKey(r.id) === targetKey ? { ...r, teacherIds: r.teacherIds.filter((x) => x !== teacherId) } : r,
            ),
          }
        })
        return null
      },
      adjustTenure: (targetKey, teacherId, index, nextT) => {
        const list = tenuresOf(state, targetKey, teacherId)
        if (!list[index]) return "任期不存在"
        if (!DATE_RE.test(nextT.from)) return "请填写开始日期"
        if (nextT.to !== null && (!DATE_RE.test(nextT.to) || nextT.to <= nextT.from)) return "结束日期必须晚于开始日期"
        if (nextT.from < SEMESTER.start || (nextT.to ?? SEMESTER.endExclusive) > SEMESTER.endExclusive) return "任期超出本学期"
        if (list.some((t, i) => i !== index && overlaps(t, nextT))) return "与该教师的其他任期重叠"
        setState((s) => ({
          ...s,
          tenures: {
            ...s.tenures,
            [`${targetKey}|${teacherId}`]: list.map((t, i) => (i === index ? { ...t, ...nextT } : t)),
          },
        }))
        return null
      },
      setDemoPerm: (perm) => setState((s) => ({ ...s, demoPerm: perm })),
      reset: () => {
        if (typeof window !== "undefined") {
          try { window.sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
        }
        setState(freshState())
      },
    }
  }, [state])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTeaching() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useTeaching must be used within TeachingProvider")
  return ctx
}

// 人物 → fixture 教师 ID 映射（原型演示）
export const PERSONA_TEACHER: Record<string, string | null> = {
  admin: null,
  lin: "T-LIN",
  zhou: "T-ZHOU",
  chen: "T-CHEN",
}
