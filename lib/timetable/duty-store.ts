"use client"

// 教学分工规范定义：教务按教学班维护（名称 / 停用），教师与课卡只引用。
// 稳定身份 = 教学班 + 分工标记（code）；改名只改规范名称，不改变引用关系。
import { useSyncExternalStore } from "react"
import { SAMPLE_ZHOU_OCT, TEACHER_SCHEDULES, TEACHING_CLASSES, type TemplateEntry } from "@/lib/timetable/data"
import registry from "@/lib/teaching/fixture.json"

// 教学班登记（学校管理 · 教学班）是任教关系与班名的唯一权威来源：课表直接使用登记班名，不再拼接课程名
function registryClassName(c: (typeof registry.teachingClasses)[number]): string {
  return c.name
}

// 旧写法“排课归属 • 课程名”（如 高一1班 • CIE 数学）→ 登记班名，用于修正历史草稿/导入残留
const LEGACY_CLASS_NAMES: Map<string, string> = (() => {
  const homeroom = new Map(registry.homerooms.map((h) => [h.id, h.name]))
  const course = new Map(registry.courses.map((c) => [c.id, c.name]))
  const key = (s: string) => s.replace(/\s+/g, "").replace(/[·・･•]/g, "•")
  const map = new Map<string, string>()
  for (const c of registry.teachingClasses) {
    const home = c.placementHomeroomId ? homeroom.get(c.placementHomeroomId) : undefined
    const crs = c.courseId ? course.get(c.courseId) : undefined
    if (home && crs) map.set(key(`${home} • ${crs}`), c.name)
  }
  return new Map([...map].map(([k, v]) => [k, v]))
})()

export function canonicalClassName(name: string): string {
  return LEGACY_CLASS_NAMES.get(name.replace(/\s+/g, "").replace(/[·・･•]/g, "•")) ?? name
}

const registryTeacherId = (teacherId: string) => `T-${teacherId.toUpperCase()}`

export interface DutyDef {
  id: string
  className: string
  code: string
  name: string
  active: boolean
}

export type DutyActor = "admin" | "teacher"

export function dutyId(className: string, code: string): string {
  return `${className}::${code}`
}

function seed(): DutyDef[] {
  const map = new Map<string, DutyDef>()
  const all: TemplateEntry[] = [
    ...Object.values(TEACHER_SCHEDULES).flatMap((bySeq) => Object.values(bySeq).flat()),
    ...SAMPLE_ZHOU_OCT,
  ]
  // 已登记的教学班只以登记分工为准；课表残留标记仅为未登记教学班兜底
  const registered = new Set(registry.teachingClasses.map(registryClassName))
  for (const e of all) {
    if (!e.group || e.kind === "activity" || registered.has(canonicalClassName(e.className))) continue
    const id = dutyId(e.className, e.group)
    if (!map.has(id)) map.set(id, { id, className: e.className, code: e.group, name: e.group, active: true })
  }
  for (const r of registry.responsibilities) {
    const cls = registry.teachingClasses.find((c) => c.id === r.teachingClassId)
    if (!cls || !r.sharedMark) continue
    const className = registryClassName(cls)
    const id = dutyId(className, r.sharedMark)
    if (!map.has(id)) map.set(id, { id, className, code: r.sharedMark, name: r.sharedMark, active: true })
  }
  return [...map.values()]
}

const SEED = seed()
const KEY = "tt-duties-v3"
let duties: DutyDef[] = load()
const listeners = new Set<() => void>()

function load(): DutyDef[] {
  if (typeof window === "undefined") return SEED
  try {
    const raw = window.sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as DutyDef[]) : SEED
  } catch {
    return SEED
  }
}

function commit(next: DutyDef[]) {
  duties = next
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  listeners.forEach((l) => l())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useDuties(): DutyDef[] {
  return useSyncExternalStore(subscribe, () => duties, () => SEED)
}

export function findDuty(list: DutyDef[], className: string, code?: string): DutyDef | undefined {
  if (!code) return undefined
  return list.find((d) => d.id === dutyId(className, code))
}

// 规范名称：未登记时回退为原标记（整科无分工时为空）
export function dutyName(list: DutyDef[], className: string, code?: string): string | null {
  if (!code) return null
  return findDuty(list, className, code)?.name ?? code
}

export function dutiesForClass(list: DutyDef[], className: string): DutyDef[] {
  return list.filter((d) => d.className === className)
}

// 教师的教学对象候选：教学班登记中的整科 / 课程负责 / 分工任教关系 + 该教师课表中已出现的教学班
export function teachingObjectsFor(teacherId: string): string[] {
  const names = new Set<string>()
  const rid = registryTeacherId(teacherId)
  for (const c of registry.teachingClasses) {
    const teaches =
      c.wholeTeacherIds.includes(rid) ||
      c.courseResponsibleTeacherId === rid ||
      registry.responsibilities.some((r) => r.teachingClassId === c.id && r.teacherIds.includes(rid))
    if (teaches) names.add(registryClassName(c))
  }
  for (const c of TEACHING_CLASSES) if (c.teacherIds.includes(teacherId)) names.add(c.name)
  const bySeq = TEACHER_SCHEDULES[teacherId]
  if (bySeq) {
    for (const e of Object.values(bySeq).flat()) if (e.kind !== "activity" && e.className) names.add(e.className)
  }
  if (teacherId === "zhou") for (const e of SAMPLE_ZHOU_OCT) if (e.kind !== "activity") names.add(e.className)
  return [...names]
}

type Result = { ok: boolean; msg: string }

// 命令层权限：只有教务可以创建 / 改名 / 停用规范分工；教师调用一律拒绝
function guard(actor: DutyActor): Result | null {
  return actor === "admin" ? null : { ok: false, msg: "无权维护教学分工规范，请联系教务" }
}

export function createDuty(actor: DutyActor, className: string, code: string, name?: string): Result {
  const denied = guard(actor)
  if (denied) return denied
  const c = code.trim()
  if (!c) return { ok: false, msg: "请输入分工名称" }
  const id = dutyId(className, c)
  if (duties.some((d) => d.id === id)) return { ok: false, msg: `${c} 已存在于该教学班` }
  commit([...duties, { id, className, code: c, name: name?.trim() || c, active: true }])
  return { ok: true, msg: `已新增分工 ${c}` }
}

export function renameDuty(actor: DutyActor, id: string, name: string): Result {
  const denied = guard(actor)
  if (denied) return denied
  const n = name.trim()
  if (!n) return { ok: false, msg: "规范名称不能为空" }
  commit(duties.map((d) => (d.id === id ? { ...d, name: n } : d)))
  return { ok: true, msg: `已更新规范名称为 ${n}` }
}

export function setDutyActive(actor: DutyActor, id: string, active: boolean): Result {
  const denied = guard(actor)
  if (denied) return denied
  commit(duties.map((d) => (d.id === id ? { ...d, active } : d)))
  return { ok: true, msg: active ? "已启用" : "已停用" }
}

export function resetDuties() {
  commit(SEED)
}
