"use client"

// 行政班全局状态（原型）：会话内持久化，切页不丢失；教学班的“行政班”选项由此派生。
import { useSyncExternalStore } from "react"
import { ADMIN_CLASSES, type AdminClass } from "@/lib/demo/school"

const STORAGE_KEY = "tgs-proto:admin-classes:v1"

let current: AdminClass[] = ADMIN_CLASSES
let hydrated = false
const listeners = new Set<() => void>()

function hydrate() {
  if (hydrated || typeof window === "undefined") return
  hydrated = true
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as AdminClass[]) : null
    if (Array.isArray(parsed) && parsed.length) current = parsed
  } catch {
    /* ignore */
  }
}

export function getAdminClasses(): AdminClass[] {
  hydrate()
  return current
}

export function updateAdminClasses(updater: (prev: AdminClass[]) => AdminClass[]) {
  hydrate()
  current = updater(current)
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useAdminClasses(): AdminClass[] {
  return useSyncExternalStore(subscribe, getAdminClasses, () => ADMIN_CLASSES)
}
