"use client"

// 教职工资料覆盖层（原型）：编辑资料、请假、销假、离职的结果按会话保存，切页不丢失。
import { useMemo, useSyncExternalStore } from "react"
import { STAFF, type HistoryItem, type StaffProfile } from "@/lib/demo/staff"

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

export function getStaffList() {
  hydrate()
  return [...STAFF, ...created].map((staff) => applyPatch(staff, patches[staff.id]))
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

function applyPatch(s: StaffProfile, p?: StaffPatch): StaffProfile {
  if (!p) return s
  const { extraHistory, ...rest } = p
  return { ...s, ...rest, history: [...s.history, ...(extraHistory ?? [])] }
}

export function useStaffList(): StaffProfile[] {
  const p = useSyncExternalStore(subscribe, getPatches, () => EMPTY)
  return useMemo(() => [...STAFF, ...created].map((s) => applyPatch(s, p[s.id])), [p])
}
