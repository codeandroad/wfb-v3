"use client"

import { schoolCacheStorage, publishSchoolCache } from "./system-cache"

// 既有示例人员保留会话覆盖层；本机导入人员及其后续修改持久化保存。
import { useMemo, useSyncExternalStore } from "react"
import { DEMO_TODAY, STAFF, type HistoryItem, type StaffProfile } from "@/lib/demo/staff"
import { PERSONAS } from "@/lib/demo/nav"
import { useMt } from "@/lib/mt/store"
import { dateOfClock } from "@/lib/mt/model"
import { dutyStatusAt, isResearchDuty, type StaffDutyCommand, type StaffDutyState } from "./duty-model"
import { commitStaffDuty, getStaffDuties, useStaffDuties, useStaffDutyStatus } from "./duty-store"
import { researchGroupName } from "./responsibility-scopes"

import { useDemo } from "@/lib/demo/store"
import { prepareImportedStaffNumberClaims, registerIssued, schoolStaffNumberClaims } from "./person-no"
import type { Claim } from "./numbering-ledger"
import { IMPORTED_STAFF_STORAGE_KEY } from "./staff-storage-keys"
export { IMPORTED_STAFF_STORAGE_KEY } from "./staff-storage-keys"

const STORAGE_KEY = "tgs-proto:staff-patches:v1"
const CREATED_KEY = "tgs-proto:staff-created:v1"
let created: StaffProfile[] = []
let imported: StaffProfile[] = []
let importedPatches: Record<string, StaffPatch> = {}
let importedNumberClaims: Claim[] = []
let importError = ""

function baseProfiles() {
  const profiles = new Map<string, StaffProfile>()
  for (const profile of [...STAFF, ...created, ...imported]) if (!profiles.has(profile.id)) profiles.set(profile.id, profile)
  return [...profiles.values()]
}

function readImported() {
  if (typeof window === "undefined" || !window.localStorage) return
  const raw = schoolCacheStorage("localStorage").getItem(IMPORTED_STAFF_STORAGE_KEY)
  if (!raw) { imported = []; importedPatches = {}; importedNumberClaims = []; importError = ""; return }
  const data = JSON.parse(raw)
  if (data?.schema !== 1 || !Array.isArray(data.profiles) || !data.patches || typeof data.patches !== "object" || Array.isArray(data.patches) || data.profiles.some((profile: StaffProfile) => !profile || typeof profile.id !== "string" || !profile.id || typeof profile.name !== "string" || typeof profile.department !== "string" || !Array.isArray(profile.duties) || !Array.isArray(profile.systemRoles) || !Array.isArray(profile.history)) || new Set(data.profiles.map((profile: StaffProfile) => profile.id)).size !== data.profiles.length) throw new Error("本机导入人员资料无法读取；原记录已保留，请恢复数据后重试。")
  imported = data.profiles
  importedPatches = data.patches
  importedNumberClaims = data.numberClaims ?? []
  importError = ""
}

function persistImported(profiles: StaffProfile[], savedPatches: Record<string, StaffPatch>, numberClaims = importedNumberClaims) {
  if (typeof window === "undefined" || !window.localStorage) throw new Error("本机存储不可用，人员资料未保存。")
  try { schoolCacheStorage("localStorage").setItem(IMPORTED_STAFF_STORAGE_KEY, JSON.stringify({ schema: 1, profiles, patches: savedPatches, numberClaims }, (_key, value) => value === undefined ? null : value)) }
  catch { throw new Error("本机存储空间不足或不可用，人员资料未保存。") }
}

/** Fixed source IDs make repeat imports additive; never replace edits or grant access. */
export function mergeImportedStaff(profiles: StaffProfile[]) {
  hydrate()
  try { readImported() } catch { throw new Error("本机导入人员资料无法读取；未覆盖已有数据。") }
  if (importError) throw new Error(importError)
  const incomingIds = new Set<string>()
  const safeProfiles = profiles.map(profile => {
    if (!profile || typeof profile.id !== "string" || !profile.id.trim() || incomingIds.has(profile.id) || typeof profile.name !== "string" || !profile.name.trim() || typeof profile.department !== "string" || typeof profile.jobTitle !== "string") throw new Error("导入人员标识、姓名或部门格式无效，未写入本批。")
    incomingIds.add(profile.id)
    return { ...structuredClone(profile), username: undefined, isCurrent: undefined, employeeNo: profile.employeeNo ?? "", accountStatus: "none" as const, systemRoles: [], duties: [], history: profile.history ?? [] }
  })
  const known = new Set(baseProfiles().map(profile => profile.id))
  const added = safeProfiles.filter(profile => !known.has(profile.id))
  if (!added.length) return { added: 0, retained: profiles.length }
  const next = [...imported, ...added]
  persistImported(next, importedPatches)
  imported = next
  patches = { ...patches }
  publishSchoolCache(() => listeners.forEach(listener => listener()))
  return { added: added.length, retained: profiles.length - added.length }
}

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
  try { schoolCacheStorage("sessionStorage").setItem(CREATED_KEY, JSON.stringify(created)) } catch { /* session storage may be unavailable */ }
  publishSchoolCache(() => listeners.forEach((listener) => listener()))
  return profile
}

export function getStaffList(date = DEMO_TODAY) {
  hydrate()
  const duties = getStaffDuties()
  return baseProfiles().map(staff => withSharedDuties(applyPatch(staff, profilePatch(staff.id)), duties, date))
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
    const raw = schoolCacheStorage("sessionStorage").getItem(STORAGE_KEY)
    if (raw) patches = Object.fromEntries(Object.entries(JSON.parse(raw) as Record<string, StaffPatch>).map(([id, patch]) => [id, Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value === null ? undefined : value]))]))
    const saved = schoolCacheStorage("sessionStorage").getItem(CREATED_KEY)
    if (saved) created = JSON.parse(saved) as StaffProfile[]
  } catch {
    /* ignore */
  }
  try { readImported() } catch { importError = "本机导入人员资料无法读取；原记录已保留。" }
}

function profilePatch(id: string): StaffPatch | undefined {
  const merged = { ...importedPatches[id], ...patches[id] }
  return Object.fromEntries(Object.entries(merged).map(([key, value]) => [key, value === null ? undefined : value])) as StaffPatch
}

function getPatches() {
  hydrate()
  return patches
}

export function updateStaff(id: string, patch: StaffPatch, historyText?: string) {
  hydrate()
  if (imported.some(profile => profile.id === id)) {
    try { readImported() } catch { throw new Error("本机导入人员资料无法读取；本次修改未保存。") }
  }
  const prev = profilePatch(id) ?? {}
  const extraHistory = historyText
    ? [...(prev.extraHistory ?? []), { date: new Date().toISOString().slice(0, 10), text: historyText }]
    : prev.extraHistory
  const nextPatch = { ...prev, ...patch, extraHistory }
  if (imported.some(profile => profile.id === id)) {
    const next = { ...importedPatches, [id]: nextPatch }
    const profile = imported.find(person => person.id === id)!
    const numberClaims = Object.hasOwn(patch, "employeeNo") ? prepareImportedStaffNumberClaims(id, applyPatch(profile, prev).employeeNo, patch.employeeNo ?? "") : importedNumberClaims
    persistImported(imported, next, numberClaims)
    importedPatches = next
    importedNumberClaims = numberClaims
    // Do not keep a stale session copy ahead of the persistent imported edit.
    const { [id]: _previous, ...remaining } = patches
    patches = remaining
    try { schoolCacheStorage("sessionStorage").setItem(STORAGE_KEY, JSON.stringify(patches, (_key, value) => value === undefined ? null : value)) } catch { /* imported changes are already durable */ }
    publishSchoolCache(() => listeners.forEach(listener => listener()))
    return
  }
  patches = { ...patches, [id]: nextPatch }
  try {
    schoolCacheStorage("sessionStorage").setItem(STORAGE_KEY, JSON.stringify(patches, (_key, value) => value === undefined ? null : value))
  } catch {
    /* ignore */
  }
  publishSchoolCache(() => listeners.forEach((l) => l()))
}

function subscribe(l: () => void) {
  listeners.add(l)
  const storage = (event: StorageEvent) => {
    if (event.key !== IMPORTED_STAFF_STORAGE_KEY) return
    try { readImported(); patches = { ...patches }; publishSchoolCache(() => listeners.forEach(listener => listener())) }
    catch { importError = "本机导入人员资料无法读取；原记录已保留。" }
  }
  window.addEventListener("storage", storage)
  return () => { listeners.delete(l); window.removeEventListener("storage", storage) }
}

const LEGACY_DEPARTMENTS: Record<string, string> = { 数学组: "教务处", 物理组: "教务处", 英语组: "教务处", 行政部: "办公室" }

function applyPatch(s: StaffProfile, p?: StaffPatch): StaffProfile {
  const { extraHistory, ...rest } = p ?? {}
  const department = rest.department ?? s.department
  return { ...s, ...rest, department: s.sourceBatch ? department : LEGACY_DEPARTMENTS[department] ?? department, history: [...s.history, ...(extraHistory ?? [])] }
}

function withSharedDuties(staff: StaffProfile, state: StaffDutyState, date: string): StaffProfile {
  const research = state.assignments.filter(duty => duty.staffId === staff.id)
  return {
    ...staff,
    duties: [...staff.duties.filter(duty => !isResearchDuty(duty.type) && (duty.type !== "course_material" || !duty.scopeRefs?.some(ref => ref.kind === "course"))), ...research.map(duty => ({ ...duty, scopeLabel: duty.type === "course_material" ? duty.scopeLabel : duty.scopeRefs.map(ref => researchGroupName(state.groups, ref.id)).join("、"), status: dutyStatusAt(duty, date), ...(state.groups.some(group => duty.scopeRefs.some(ref => ref.kind === "research_group" && ref.id === group.id) && !group.active) ? { scopeSub: "负责对象已停用；历史保留，不授予当前访问" } : {}) }))],
    history: [...staff.history, ...research.flatMap(duty => (duty.history ?? []).map(item => ({ ...item, text: `${item.text} · ${duty.type === "course_material" ? duty.scopeLabel : researchGroupName(state.groups, duty.scopeRefs[0].id)}` })))].sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export function useStaffList(date = DEMO_TODAY): StaffProfile[] {
  const p = useSyncExternalStore(subscribe, getPatches, () => EMPTY)
  const duties = useStaffDuties()
  return useMemo(() => baseProfiles().map(s => withSharedDuties(applyPatch(s, profilePatch(s.id)), duties, date)), [p, duties, date])
}

export function exportSchoolStaff() {
  hydrate()
  return structuredClone({profiles:baseProfiles(),patches:Object.fromEntries(baseProfiles().map(person=>[person.id,profilePatch(person.id)??{}])),numberClaims:schoolStaffNumberClaims(new Set(baseProfiles().map(person=>person.id)))})
}
export function adoptSchoolStaff(value:ReturnType<typeof exportSchoolStaff>) {
  imported=structuredClone(value.profiles); importedPatches=structuredClone(value.patches); importedNumberClaims=structuredClone(value.numberClaims)
  created=[]; patches={}; hydrated=true; importError=""
  persistImported(imported,importedPatches,importedNumberClaims)
  schoolCacheStorage("sessionStorage").setItem(STORAGE_KEY,"{}")
  schoolCacheStorage("sessionStorage").setItem(CREATED_KEY,"[]")
  publishSchoolCache(()=>listeners.forEach(listener=>listener()))
}
