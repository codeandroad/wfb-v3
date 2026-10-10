"use client"

// 教职工资料覆盖层（原型）：编辑资料、请假、销假、离职的结果按会话保存，切页不丢失。
import { useMemo, useSyncExternalStore } from "react"
import { DEMO_TODAY, STAFF, type HistoryItem, type StaffProfile } from "@/lib/demo/staff"
import { PERSONAS } from "@/lib/demo/nav"
import { useMt } from "@/lib/mt/store"
import { dateOfClock } from "@/lib/mt/model"
import { dutyStatusAt, isResearchDuty, type StaffDutyCommand, type StaffDutyState } from "./duty-model"
import { commitStaffDuty, getStaffDuties, useStaffDuties, useStaffDutyStatus } from "./duty-store"
import { researchGroupName } from "./responsibility-scopes"

import { useDemo } from "@/lib/demo/store"
import { registerIssued } from "./person-no"

const STORAGE_KEY = "tgs-proto:staff-patches:v1"
const CREATED_KEY = "tgs-proto:staff-created:v1"
let created: StaffProfile[] = []

export function useStaffPermission() {
  const demo = useDemo()
  return demo.scenario !== "parent" && (demo.persona === "lin" || demo.persona === "admin")
}

export function createStaff(profile: StaffProfile): StaffProfile {
  hydrate()
  const existing = getStaffList().find((item) => item.id === profile.id)
  if (existing) return existing
  if (profile.employeeNo) registerIssued(profile.employeeNo, "E", profile.id)
  created = [...created, profile]
  patches = { ...patches }
  try { window.sessionStorage.setItem(CREATED_KEY, JSON.stringify(created)) } catch { /* session storage may be unavailable */ }
  listeners.forEach((listener) => listener())
  return profile
}

export function getStaffList(date = DEMO_TODAY) {
  hydrate()
  const duties = getStaffDuties()
  return [...STAFF, ...created].map(staff => withSharedDuties(applyPatch(staff, patches[staff.id]), duties, date))
}

export function useStaffDutyContext() {
  const demo = useDemo()
  const mt = useMt()
  const date = dateOfClock(mt.biz.clock)
  const people = useStaffList(date)
  const state = useStaffDuties()
  const status = useStaffDutyStatus()
  const staff = PERSONAS[demo.persona].staffId
  const person = people.find(item => item.id === staff)
  const actor = { staff, date, enabled: mt.ready && demo.scenario !== "parent" && !!person && person.status !== "left" && person.accountStatus === "enabled" }
  return { state, people, actor, ready: mt.ready, error: status.error, command: (command: StaffDutyCommand) => commitStaffDuty(actor, command, getStaffList(date)) }
}

export type StaffPatch = Partial<
  Pick<
    StaffProfile,
    | "name"
    | "employeeNo"
    | "department"
    | "jobTitle"
    | "gender"
    | "joinedAt"
    | "phone"
    | "email"
    | "status"
    | "statusNote"
    | "accountStatus"
    | "englishName"
    | "birthMonth"
  | "birthplace"
    | "educationLevel"
    | "firstWorkAt"
    | "educationExperiences"
    | "workExperiences"
    | "interests"
    | "wechat"
  >
> & { extraHistory?: HistoryItem[] }

let patches: Record<string, StaffPatch> = {}
let hydrated = false
const listeners = new Set<() => void>()
const EMPTY: Record<string, StaffPatch> = {}

function hydrate() {
  if (hydrated || typeof window === "undefined") return
  hydrated = true
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw) patches = Object.fromEntries(Object.entries(JSON.parse(raw) as Record<string, StaffPatch>).map(([id, patch]) => [id, Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value === null ? undefined : value]))]))
    const saved = window.sessionStorage.getItem(CREATED_KEY)
    if (saved) created = JSON.parse(saved) as StaffProfile[]
  } catch {
    /* ignore */
  }
}

function getPatches() {
  hydrate()
  return patches
}

export function updateStaff(id: string, patch: StaffPatch, historyText?: string) {
  hydrate()
  const prev = patches[id] ?? {}
  const extraHistory = historyText
    ? [...(prev.extraHistory ?? []), { date: new Date().toISOString().slice(0, 10), text: historyText }]
    : prev.extraHistory
  patches = { ...patches, [id]: { ...prev, ...patch, extraHistory } }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(patches, (_key, value) => value === undefined ? null : value))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

const LEGACY_DEPARTMENTS: Record<string, string> = { 数学组: "教学部", 物理组: "教学部", 英语组: "教学部", 教务处: "教务部", 行政部: "办公室" }

function applyPatch(s: StaffProfile, p?: StaffPatch): StaffProfile {
  const { extraHistory, ...rest } = p ?? {}
  const department = rest.department ?? s.department
  return { ...s, ...rest, department: LEGACY_DEPARTMENTS[department] ?? department, history: [...s.history, ...(extraHistory ?? [])] }
}

function withSharedDuties(staff: StaffProfile, state: StaffDutyState, date: string): StaffProfile {
  const research = state.assignments.filter(duty => duty.staffId === staff.id)
  return {
    ...staff,
    duties: [...staff.duties.filter(duty => !isResearchDuty(duty.type)), ...research.map(duty => ({ ...duty, scopeLabel: duty.scopeRefs.map(ref => researchGroupName(state.groups, ref.id)).join("、"), status: dutyStatusAt(duty, date), ...(state.groups.some(group => duty.scopeRefs.some(ref => ref.id === group.id) && !group.active) ? { scopeSub: "负责对象已停用；历史保留，不授予当前访问" } : {}) }))],
    history: [...staff.history, ...research.flatMap(duty => (duty.history ?? []).map(item => ({ ...item, text: `${item.text} · ${researchGroupName(state.groups, duty.scopeRefs[0].id)}` })))].sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export function useStaffList(date = DEMO_TODAY): StaffProfile[] {
  const p = useSyncExternalStore(subscribe, getPatches, () => EMPTY)
  const duties = useStaffDuties()
  return useMemo(() => [...STAFF, ...created].map(s => withSharedDuties(applyPatch(s, p[s.id]), duties, date)), [p, duties, date])
}
