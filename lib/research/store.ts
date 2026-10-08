"use client"

import { useSyncExternalStore } from "react"
import { CATALOG_COURSES } from "@/lib/demo/school"

export const groups = [{ id: "math", name: "数学组", subject: "S001" }, { id: "physics", name: "物理组", subject: "S002" }]
// Explicit prototype appointments; department labels and teaching assignments never grant access.
export const appointments = [
  { staff: "u-lin", group: "math", role: "组长", start: "2026-09-01", end: "2027-07-31" },
  { staff: "u-lin", group: "physics", role: "成员", start: "2026-09-01", end: "2027-07-31" },
  { staff: "u-chen", group: "physics", role: "组长", start: "2026-09-01", end: "2027-07-31" },
  { staff: "u-zhou", group: "math", role: "成员", start: "2026-09-01", end: "2027-07-31" },
  { staff: "u-wang", group: "math", role: "成员", start: "2026-09-01", end: "2027-07-31" },
  { staff: "u-zhou", group: "physics", role: "成员", start: "2025-09-01", end: "2026-07-31" },
]
export function membership(staff: string, group: string, date: string) {
  return appointments.find(a => a.staff === staff && a.group === group && a.start <= date && date <= a.end)
}
export function schoolScopes(staff: string): string[] {
  return staff === "u-lin" ? ["math", "physics"] : staff === "u-xu" ? ["math"] : []
}
export type Item = { id: string; title: string; body: string; source: string; minutes: number | null; fixed: boolean; week: string; section: string }
export type Document = { id: string; kind: "大纲" | "计划" | "资源" | "练习组合"; title: string; owner: string; course: string; version: number; source: string; notes: string; budget: number | null; reserve: number; period: number | null; items: Item[] }
export type Task = { id: string; title: string; group: string; parent: string; owner: string; due: string; mode: "牵头提交" | "成员各自提交"; status: "待承接" | "进行中" | "已提交"; result?: Document; discussion: { author: string; text: string }[] }
export type ResearchState = { documents: Document[]; tasks: Task[] }
const sampleItems: Item[] = [{ id: "r1", title: "二次函数的表示与图像", body: "演示学校自编要求：比较解析式、表格与图像三种表示；通过配方解释顶点的位置，说明开口方向与系数的关系。\n公式：y = a(x − h)² + k（a ≠ 0）。\nNotes：要求学生说明推理过程，而非仅记忆图像。此段不是考试局官方原文；尚未整理其他章节及官方考核权重。", source: "学校自编演示 · 第1章 §1.1 · v1", minutes: null, fixed: false, week: "", section: "函数" }]
const seed: ResearchState = {
  documents: [{ id: "syllabus-demo", kind: "大纲", title: "函数教学要求 · 共建示例", owner: "math", course: "C101", version: 1, source: "学校自编演示；非官方大纲", notes: "先修：代数式变形。考核结构、组合及权重尚未整理，不据此计算成绩。", budget: null, reserve: 0, period: null, items: sampleItems }, { id: "plan-demo", kind: "计划", title: "函数入门 · 教学计划", owner: "math", course: "C101", version: 1, source: "syllabus-demo@1 / r1", notes: "独立备课，不预设教学班或具体日期。", budget: 120, reserve: 15, period: null, items: sampleItems.map(i => ({ ...i, minutes: 60 })) }],
  tasks: groups.map(g => ({ id: `task-${g.id}`, title: "学期教学内容整理", group: g.id, parent: "school-task-1", owner: "", due: "2026-11-01", mode: "牵头提交", status: "待承接", discussion: [] })),
}
const key = "tgs:research-prototype:v1"
let state: ResearchState = seed
let hydrated = false
const listeners = new Set<() => void>()
function snapshot() {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true
    try { const raw = localStorage.getItem(key); if (raw) { const data = JSON.parse(raw); if (Array.isArray(data.documents) && Array.isArray(data.tasks)) state = data } } catch { /* Keep the seed readable; saves report storage failures. */ }
  }
  return state
}
export function saveResearch(next: ResearchState) {
  localStorage.setItem(key, JSON.stringify(next))
  state = next
  listeners.forEach(l => l())
}
export function useResearch() {
  return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l) } }, snapshot, () => seed)
}
export function coursesFor(group: string) { return CATALOG_COURSES.filter(c => c.subjectCode === groups.find(g => g.id === group)?.subject) }
export function totals(doc: Document) {
  const allocated = doc.items.reduce((n, i) => n + (i.minutes ?? 0), 0)
  return { allocated, remainder: doc.budget === null ? null : doc.budget - doc.reserve - allocated }
}
