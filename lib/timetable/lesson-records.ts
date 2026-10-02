"use client"

// 课后课堂记录（演示内存态）：按 教师+课次+日期 唯一。
import { useSyncExternalStore } from "react"
import { STUDENTS, type Student } from "@/lib/demo/data"
import type { ProjectedEntry } from "@/lib/timetable/data"

export type Attendance = "present" | "late" | "leave" | "absent"
export type Performance = "active" | "normal" | "attention"

export interface LessonRecord {
  attendance: Record<string, Attendance>
  performance: Record<string, Performance>
  summary: string
  homework: string
  savedAt: string
}

export const ATTENDANCE_META: Record<Attendance, { label: string; short: string }> = {
  present: { label: "到课", short: "到" },
  late: { label: "迟到", short: "迟" },
  leave: { label: "请假", short: "假" },
  absent: { label: "缺勤", short: "缺" },
}

export const PERFORMANCE_META: Record<Performance, { label: string }> = {
  active: { label: "积极" },
  normal: { label: "正常" },
  attention: { label: "需关注" },
}

const EMPTY: Record<string, LessonRecord> = {}
let records: Record<string, LessonRecord> = EMPTY
const listeners = new Set<() => void>()

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function recordKey(e: Pick<ProjectedEntry, "teacherId" | "key" | "date">): string {
  return `${e.teacherId}:${e.key}@${e.date}`
}

export function useLessonRecords(): Record<string, LessonRecord> {
  return useSyncExternalStore(subscribe, () => records, () => EMPTY)
}

export function saveLessonRecord(key: string, rec: LessonRecord) {
  records = { ...records, [key]: rec }
  listeners.forEach((l) => l())
}

// 演示名单：按课程名中的行政班前缀取学生，否则取前 12 名
export function rosterFor(className: string): Student[] {
  const hit = STUDENTS.filter((s) => className.startsWith(s.homeroom))
  return hit.length ? hit : STUDENTS.slice(0, 12)
}
