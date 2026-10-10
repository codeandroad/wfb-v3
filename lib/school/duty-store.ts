"use client"

import { useSyncExternalStore } from "react"
import type { StaffProfile } from "@/lib/demo/staff"
import { applyStaffDutyCommand, migrateLegacyResearchDuties, migrateStaffDutyState, staffDutySeed, validateStaffDutyState, type DutyActor, type StaffDutyCommand, type StaffDutyState } from "./duty-model"

export const STAFF_DUTY_STORAGE_KEY = "tgs:staff-duties-prototype:v1"
export const STAFF_DUTY_REPAIR_BACKUP_KEY = `${STAFF_DUTY_STORAGE_KEY}:before-overlap-repair`
const LEGACY_KEYS = ["tgs:research-prototype:v2", "tgs:research-prototype:v1"]
const seed = staffDutySeed()
const serverStatus = { error: "" }
let state = seed
let status = serverStatus
let hydrated = false
let storedRaw: string | null = null
const listeners = new Set<() => void>()

export function getStaffDuties(): StaffDutyState {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true
    try {
      const raw = window.localStorage.getItem(STAFF_DUTY_STORAGE_KEY)
      let next = seed
      if (raw) next = migrateStaffDutyState(JSON.parse(raw))
      else {
        const legacy = LEGACY_KEYS.map(key => window.localStorage.getItem(key)).find(Boolean)
        if (legacy) {
          const data = JSON.parse(legacy)
          if (Array.isArray(data.staffDuties) && Array.isArray(data.groups)) next = migrateStaffDutyState({ schema: 1, assignments: data.staffDuties, groups: data.groups })
          else {
            const assignments = migrateLegacyResearchDuties(data)
            const groups = structuredClone(seed.groups)
            for (const duty of assignments) for (const ref of duty.scopeRefs) if (!groups.some(group => group.id === ref.id)) groups.push({ id: ref.id, name: duty.scopeLabel, kind: "research_group", department: "教学部", subject: "", active: false })
            next = validateStaffDutyState({ schema: 1, assignments, groups })
          }
        }
      }
      const serialized = JSON.stringify(next)
      if (!raw || JSON.stringify(JSON.parse(raw)) !== serialized) {
        if (raw) {
          const backup = window.localStorage.getItem(STAFF_DUTY_REPAIR_BACKUP_KEY)
          if (backup !== raw) window.localStorage.setItem(backup ? `${STAFF_DUTY_REPAIR_BACKUP_KEY}:${crypto.randomUUID()}` : STAFF_DUTY_REPAIR_BACKUP_KEY, raw)
        }
        // 保留旧教研存储与各次修正前快照；内容服务不再保存第二份授权。
        window.localStorage.setItem(STAFF_DUTY_STORAGE_KEY, serialized)
      }
      state = next
      storedRaw = raw && JSON.stringify(JSON.parse(raw)) === serialized ? raw : serialized
      status = serverStatus
    } catch (error) {
      state = { ...seed, assignments: [] }
      status = { error: `${error instanceof Error ? error.message : "职责存储无法读取。"} 未清空旧数据；在恢复前不启用示例职责替代已有授权。` }
    }
  }
  return state
}

function emit() { listeners.forEach(listener => listener()) }

export function commitStaffDuty(actor: DutyActor, command: StaffDutyCommand, people: StaffProfile[]): { ok: true } | { ok: false; error: string } {
  try {
    const refreshed = window.localStorage.getItem(STAFF_DUTY_STORAGE_KEY) !== storedRaw
    if (refreshed) hydrated = false
    const current = getStaffDuties()
    if (refreshed) emit()
    if (status.error) return { ok: false, error: status.error }
    const next = applyStaffDutyCommand(current, actor, command, people)
    const serialized = JSON.stringify(next)
    try { window.localStorage.setItem(STAFF_DUTY_STORAGE_KEY, serialized) }
    catch { return { ok: false, error: "职责保存失败：本机存储不可用或空间不足，原职责未改变。请保留填写内容，恢复后重试。" } }
    state = next
    storedRaw = serialized
    status = serverStatus
    emit()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "职责未保存；请保留填写内容，检查本机存储后重试。" }
  }
}

export function subscribeStaffDuties(listener: () => void) {
  listeners.add(listener)
  const storage = (event: StorageEvent) => {
    if (event.key !== STAFF_DUTY_STORAGE_KEY) return
    hydrated = false
    getStaffDuties()
    emit()
  }
  window.addEventListener("storage", storage)
  return () => { listeners.delete(listener); window.removeEventListener("storage", storage) }
}

export function useStaffDuties() { return useSyncExternalStore(subscribeStaffDuties, getStaffDuties, () => seed) }
export function useStaffDutyStatus() { return useSyncExternalStore(subscribeStaffDuties, () => status, () => serverStatus) }
