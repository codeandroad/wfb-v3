"use client"

import { useSyncExternalStore } from "react"
import { CATALOG_COURSES, CATALOG_SUBJECTS, CATALOG_UNITS } from "@/lib/demo/school"
import type { CatalogState } from "@/lib/research/model"

const KEY = "tgs:school-catalog:v1"
export const catalogSeed: CatalogState = {
  subjects: CATALOG_SUBJECTS, courses: CATALOG_COURSES, units: CATALOG_UNITS,
  settings: Object.fromEntries(CATALOG_COURSES.map(c => [c.code,{ active: true, groupIds: ["C101","C102","C103","C104","C105","C106"].includes(c.code) ? ["math"] : c.code === "C201" ? ["physics"] : [] }])),
}
let state = catalogSeed
let hydrated = false
const listeners = new Set<() => void>()
export function getCatalog(): CatalogState {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (!Array.isArray(saved.courses) || !Array.isArray(saved.units) || !Array.isArray(saved.subjects)) throw new Error("目录存储格式不可读取，原数据已保留。")
      state = { ...catalogSeed, ...saved }
    }
  }
  return state
}
export function updateCatalog<K extends keyof CatalogState>(key: K, value: CatalogState[K] | ((prev: CatalogState[K]) => CatalogState[K])) {
  const current = getCatalog()
  const next = { ...current, [key]: typeof value === "function" ? (value as (prev: CatalogState[K]) => CatalogState[K])(current[key]) : value }
  window.localStorage.setItem(KEY,JSON.stringify(next))
  state = next
  listeners.forEach(l => l())
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  const storage = (event: StorageEvent) => { if (event.key === KEY && event.newValue) { hydrated = false; getCatalog(); listeners.forEach(l => l()) } }
  window.addEventListener("storage",storage)
  return () => { listeners.delete(listener); window.removeEventListener("storage",storage) }
}
export function useCatalog() { return useSyncExternalStore(subscribe,getCatalog,() => catalogSeed) }
