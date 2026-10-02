"use client"

// 教职工资料覆盖层（原型）：编辑资料、请假、销假、离职的结果按会话保存，切页不丢失。
import { useMemo, useSyncExternalStore } from "react"
import { STAFF, type HistoryItem, type StaffProfile } from "@/lib/demo/staff"

const STORAGE_KEY = "tgs-proto:staff-patches:v1"

export type StaffPatch = Partial<
  Pick<
    StaffProfile,
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
    if (raw) patches = JSON.parse(raw) as Record<string, StaffPatch>
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
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(patches))
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
  return useMemo(() => STAFF.map((s) => applyPatch(s, p[s.id])), [p])
}
