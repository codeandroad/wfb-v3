"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { PERSONAS, type Persona } from "./nav"
import {
  draftComment,
  draftSummary,
  EMPTY_SUMMARY,
  hasClassroomRecord,
  hasPendingHomework,
  seedAssignments,
  type Assignment,
  type AssignmentRecord,
  type ConfigId,
  type Grade,
  type HomeworkScore,
  type PublicSummary,
  type ScenarioId,
  type StudentFeedback,
  type WeekendHomework,
  seedP1,
  seedS1,
  seedM1,
  STUDENTS,
  UNITS,
  rosterOf,
} from "./data"

type UnitCode = "P1" | "S1" | "M1"

interface UnitState {
  code: UnitCode
  feedback: Record<string, StudentFeedback>
  summary: PublicSummary
  summaryConfirmed: boolean
  weekendHomework: WeekendHomework
  drafted: boolean
}

export type ImageStatus = "idle" | "generating" | "ready" | "failed"

export interface Publication {
  units: UnitCode[]
  publishedAt: string
  version: number
}

// 教学单元组显示方式：完整名（简称 · 单元名）或仅简称
export type UnitNameMode = "full" | "short"

interface DemoState {
  scenario: ScenarioId
  persona: Persona
  config: ConfigId
  units: Record<UnitCode, UnitState>
  assignments: Assignment[]
  publication: Publication | null
  images: Record<string, { status: ImageStatus; dataUrl?: string }>
  manualSent: Record<string, boolean>
  parentReads: Record<string, boolean> // childId -> read
  parentChild: string // 当前家长查看的孩子
  unitNameMode: UnitNameMode // 工作台/我的教学中的教学单元组显示偏好
  unitTitles: Partial<Record<UnitCode, string>> // 教师自定义的教学单元组名称覆盖（演示）
}

function freshWeekendHomework(): WeekendHomework {
  return { none: false, instructions: "", due: "", required: "", optional: "", attachment: "" }
}

function seedForUnit(code: UnitCode): Record<string, StudentFeedback> {
  if (code === "P1") return seedP1()
  if (code === "S1") return seedS1()
  return seedM1()
}

function freshUnit(code: UnitCode): UnitState {
  return {
    code,
    feedback: seedForUnit(code),
    summary: code === "S1" ? draftSummary("S1") : { ...EMPTY_SUMMARY },
    summaryConfirmed: code === "S1",
    weekendHomework: freshWeekendHomework(),
    drafted: code === "S1",
  }
}

function freshState(scenario: ScenarioId = "staff", config: ConfigId = "full", persona: Persona = "lin"): DemoState {
  return {
    scenario,
    persona,
    config,
    units: { P1: freshUnit("P1"), S1: freshUnit("S1"), M1: freshUnit("M1") },
    assignments: seedAssignments(),
    publication: null,
    images: {},
    manualSent: {},
    parentReads: {},
    parentChild: "s01",
    unitNameMode: "full",
    unitTitles: {},
  }
}

interface DemoContextValue extends DemoState {
  setScenario: (s: ScenarioId) => void
  setPersona: (p: Persona) => void
  setConfig: (c: ConfigId) => void
  setParentChild: (id: string) => void
  setUnitNameMode: (m: UnitNameMode) => void
  renameUnit: (code: UnitCode, title: string) => void
  reset: () => void

  setClassroomGrade: (unit: UnitCode, sid: string, date: string, g: Grade) => void
  setClassroomNote: (unit: UnitCode, sid: string, date: string, note: string) => void
  setAttendance: (unit: UnitCode, sid: string, date: string, val: "present" | "leave" | "elsewhere") => void
  confirmStudent: (unit: UnitCode, sid: string) => void
  batchConfirmRoutine: (unit: UnitCode, defaultGrade: Grade) => { affected: number; excluded: string[] }
  resolveHomework: (unit: UnitCode, sid: string, date: string, status: "submitted" | "not_submitted") => void
  toggleHighlight: (unit: UnitCode, sid: string, text: string) => void
  setComment: (unit: UnitCode, sid: string, text: string) => void
  generateDrafts: (unit: UnitCode) => void
  setSummaryField: (unit: UnitCode, field: keyof PublicSummary, value: string) => void
  setWeekendHomework: (unit: UnitCode, patch: Partial<WeekendHomework>) => void

  createAssignment: (input: {
    classId: string
    scope: string
    scopeLabel: string
    scopeTitle: string
    title: string
    type: "required" | "optional"
    assignedDate: string
    dueDate: string
    instructions: string
  }) => void
  deleteAssignment: (id: string) => void
  setAssignmentStatus: (id: string, sid: string, status: AssignmentRecord["status"]) => void
  setAssignmentScore: (id: string, sid: string, score: HomeworkScore) => void
  batchGradeRemaining: (id: string, score: HomeworkScore) => number

  publish: (units: UnitCode[]) => void
  setImage: (key: string, status: ImageStatus, dataUrl?: string) => void
  markManualSent: (key: string) => void
  markParentRead: (childId: string) => void
}

const DemoContext = createContext<DemoContextValue | null>(null)

// 仅持久化「身份」（场景/人物/配置），保证刷新或前进后退后导航与人物一致；
// 业务数据仍为可重置合成状态，不写入存储。
  const IDENTITY_KEY = "demo-identity-v2"
type Identity = { scenario: ScenarioId; config: ConfigId; persona: Persona }
function loadIdentity(): Identity | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(IDENTITY_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Identity
    if (!p || !p.scenario || !p.persona || !p.config) return null
    return p
  } catch {
    return null
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => freshState())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const id = loadIdentity()
    if (id) setState((s) => ({ ...s, scenario: id.scenario, config: id.config, persona: id.persona }))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return
    try {
      window.sessionStorage.setItem(
        IDENTITY_KEY,
        JSON.stringify({ scenario: state.scenario, config: state.config, persona: state.persona }),
      )
    } catch {
      /* ignore quota/availability */
    }
  }, [hydrated, state.scenario, state.config, state.persona])

  const patchUnit = useCallback((unit: UnitCode, fn: (u: UnitState) => UnitState) => {
    setState((s) => ({ ...s, units: { ...s.units, [unit]: fn(s.units[unit]) } }))
  }, [])

  const patchFeedback = useCallback(
    (unit: UnitCode, sid: string, fn: (f: StudentFeedback) => StudentFeedback) => {
      patchUnit(unit, (u) => ({ ...u, feedback: { ...u.feedback, [sid]: fn(u.feedback[sid]) } }))
    },
    [patchUnit],
  )

  const value = useMemo<DemoContextValue>(() => {
    return {
      ...state,
      setScenario: (scenario) =>
        setState((s) => ({
          ...s,
          scenario,
          // 场景切换同步一个匹配人物，保证课表入口与导航一致
          persona: scenario === "teacher" ? "zhou" : scenario === "staff" ? "lin" : s.persona,
        })),
      setPersona: (persona) => setState((s) => ({ ...s, persona, scenario: PERSONAS[persona].scenario })),
      setConfig: (config) => setState((s) => ({ ...s, config })),
      setParentChild: (parentChild) => setState((s) => ({ ...s, parentChild })),
    setUnitNameMode: (unitNameMode) => setState((s) => ({ ...s, unitNameMode })),
    renameUnit: (code, title) =>
      setState((s) => {
        const next = { ...s.unitTitles }
        const t = title.trim()
        if (t) next[code] = t
        else delete next[code]
        return { ...s, unitTitles: next }
      }),
    reset: () => setState(freshState(state.scenario, state.config, state.persona)),

      setClassroomGrade: (unit, sid, date, g) =>
        patchFeedback(unit, sid, (f) => ({
          ...f,
          classroom: { ...f.classroom, [date]: { grade: g, note: f.classroom[date]?.note ?? "" } },
          confirmed: true,
        })),
      setClassroomNote: (unit, sid, date, note) =>
        patchFeedback(unit, sid, (f) => ({
          ...f,
          classroom: { ...f.classroom, [date]: { grade: f.classroom[date]?.grade ?? null, note } },
        })),
      setAttendance: (unit, sid, date, val) =>
        patchFeedback(unit, sid, (f) => ({ ...f, attendance: { ...f.attendance, [date]: val } })),
      confirmStudent: (unit, sid) => patchFeedback(unit, sid, (f) => ({ ...f, confirmed: true })),

      batchConfirmRoutine: (unit, defaultGrade) => {
        const u = state.units[unit]
        const days = UNITS.find((x) => x.code === unit)!.teachingDays
        const excluded: string[] = []
        let affected = 0
        const next: Record<string, StudentFeedback> = {}
        for (const sid of Object.keys(u.feedback)) {
          const f = u.feedback[sid]
          // 已有个别记录不覆盖；有考勤例外的自动排除
          const hasException = Object.values(f.attendance).some((a) => a !== "present")
          if (hasException) {
            excluded.push(sid)
            next[sid] = f
            continue
          }
          if (f.confirmed || hasClassroomRecord(f)) {
            next[sid] = f
            continue
          }
          // 为该学生本周每次课节写入默认课堂表现
          const classroom = { ...f.classroom }
          for (const d of days) classroom[d.date] = { grade: defaultGrade, note: classroom[d.date]?.note ?? "" }
          next[sid] = { ...f, confirmed: true, classroom }
          affected++
        }
        patchUnit(unit, (uu) => ({ ...uu, feedback: next }))
        return { affected, excluded }
      },

      resolveHomework: (unit, sid, date, status) =>
        patchFeedback(unit, sid, (f) => ({
          ...f,
          homework: { ...f.homework, [date]: { ...f.homework[date], status, ungraded: false } },
        })),

      toggleHighlight: (unit, sid, text) =>
        patchFeedback(unit, sid, (f) => ({
          ...f,
          highlights: f.highlights.includes(text)
            ? f.highlights.filter((h) => h !== text)
            : [...f.highlights, text],
        })),

      setComment: (unit, sid, text) =>
        patchFeedback(unit, sid, (f) => ({ ...f, comment: text, commentIsDraft: false })),

      generateDrafts: (unit) => {
        const u = state.units[unit]
        const summary = draftSummary(unit)
        const feedback: Record<string, StudentFeedback> = {}
        for (const sid of Object.keys(u.feedback)) {
          const f = u.feedback[sid]
          const s = STUDENTS.find((x) => x.id === sid)!
          // 仅为有亮点或已确认的学生生成可选草稿，不强制逐人
          if (f.comment) {
            feedback[sid] = f
          } else if (f.highlights.length) {
            feedback[sid] = { ...f, comment: draftComment(s.name, f.highlights), commentIsDraft: true }
          } else {
            feedback[sid] = f
          }
        }
        patchUnit(unit, (uu) => ({ ...uu, summary, drafted: true, feedback }))
      },

      setSummaryField: (unit, field, value) =>
        patchUnit(unit, (u) => ({ ...u, summary: { ...u.summary, [field]: value } })),

      setWeekendHomework: (unit, patch) =>
        patchUnit(unit, (u) => ({ ...u, weekendHomework: { ...u.weekendHomework, ...patch } })),

      createAssignment: (input) =>
        setState((s) => {
          const records: Record<string, AssignmentRecord> = {}
          for (const st of rosterOf(input.classId)) records[st.id] = { status: "submitted" }
          const a: Assignment = {
            id: `hw-${input.classId}-${input.scope.toLowerCase()}-${Date.now().toString(36)}`,
            classId: input.classId,
            scope: input.scope,
            scopeLabel: input.scopeLabel,
            scopeTitle: input.scopeTitle,
            title: input.title.trim() || "未命名作业",
            type: input.type,
            assignedDate: input.assignedDate,
            dueDate: input.dueDate,
            instructions: input.instructions.trim(),
            records,
          }
          return { ...s, assignments: [a, ...s.assignments] }
        }),

      deleteAssignment: (id) =>
        setState((s) => ({ ...s, assignments: s.assignments.filter((a) => a.id !== id) })),

      setAssignmentStatus: (id, sid, status) =>
        setState((s) => ({
          ...s,
          assignments: s.assignments.map((a) =>
            a.id !== id
              ? a
              : {
                  ...a,
                  records: {
                    ...a.records,
                    // 改回未提交/已提交时清除分数
                    [sid]: status === "graded" ? { ...a.records[sid], status } : { status },
                  },
                },
          ),
        })),

      setAssignmentScore: (id, sid, score) =>
        setState((s) => ({
          ...s,
          assignments: s.assignments.map((a) =>
            a.id !== id ? a : { ...a, records: { ...a.records, [sid]: { status: "graded", score } } },
          ),
        })),

      batchGradeRemaining: (id, score) => {
        let affected = 0
        setState((s) => ({
          ...s,
          assignments: s.assignments.map((a) => {
            if (a.id !== id) return a
            const records = { ...a.records }
            for (const st of rosterOf(a.classId)) {
              const r = records[st.id] ?? { status: "submitted" as const }
              // 仅对“已提交待评分”批量评分，不覆盖未交与已评分
              if (r.status === "submitted") {
                records[st.id] = { status: "graded", score }
                affected++
              } else {
                records[st.id] = r
              }
            }
            return { ...a, records }
          }),
        }))
        return affected
      },

      publish: (units) =>
        setState((s) => ({
          ...s,
          publication: {
            units,
            publishedAt: new Date().toISOString(),
            version: (s.publication?.version ?? 0) + 1,
          },
          // 发布新版本时旧图片状态重置
          images: {},
          manualSent: {},
        })),

      setImage: (key, status, dataUrl) =>
        setState((s) => ({ ...s, images: { ...s.images, [key]: { status, dataUrl } } })),

      markManualSent: (key) => setState((s) => ({ ...s, manualSent: { ...s.manualSent, [key]: true } })),

      markParentRead: (childId) =>
        setState((s) => ({ ...s, parentReads: { ...s.parentReads, [childId]: true } })),
    }
  }, [state, patchFeedback, patchUnit])

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error("useDemo must be used within DemoProvider")
  return ctx
}

// —— 派生统计（供工作台/发布使用，保证与同一份数据一致）——

export function unitProgress(u: UnitState) {
  const all = Object.values(u.feedback)
  const total = all.length
  const confirmed = all.filter((f) => f.confirmed || hasClassroomRecord(f)).length
  const pendingHomework = all.filter((f) => hasPendingHomework(f)).length
  const exceptions = all.filter((f) => Object.values(f.attendance).some((a) => a !== "present")).length
  return { total, confirmed, pending: total - confirmed, pendingHomework, exceptions }
}

export function unitStatus(u: UnitState, published: boolean): {
  key: "not_started" | "in_progress" | "pending" | "published"
  label: string
} {
  if (published) return { key: "published", label: "已发布" }
  const p = unitProgress(u)
  if (p.confirmed === 0) return { key: "not_started", label: "未开始" }
  if (p.pending > 0 || p.pendingHomework > 0) return { key: "pending", label: "待处理" }
  return { key: "in_progress", label: "进行中" }
}

export { UNITS }
export type { UnitState }
export { assignmentProgress } from "./data"
export type { Assignment, AssignmentRecord } from "./data"
