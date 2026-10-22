"use client"

import { schoolCacheStorage, publishSchoolCache } from "./system-cache"

import { useMemo, useSyncExternalStore } from "react"
import { foundationSeed as seed, mergeFoundationState, validateFoundation, placeLabel, PLACE_KIND_LABEL, type FoundationState, type SchoolPlace } from "./foundation-model"
export { mergeFoundationState, placeLabel, PLACE_KIND_LABEL, type FoundationState, type SchoolPlace, type PlaceKind } from "./foundation-model"
export const FOUNDATION_STORAGE_KEY = "tgs-proto:school-foundation:v1"
const emptyStatus = { error: "" }
let current = seed
let status = emptyStatus
let hydrated = false
let storedRaw: string | null = null
const listeners = new Set<() => void>()
const normalize = (value: string) => value.trim().replace(/\s+/g, " ")

export function getFoundation(): FoundationState {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true
    try {
      const raw = schoolCacheStorage("localStorage").getItem(FOUNDATION_STORAGE_KEY)
      current = raw ? validateFoundation(JSON.parse(raw)) : seed
      storedRaw = raw
      status = emptyStatus
    } catch {
      status = { error: "基础资料未能读取；原数据已保留，请恢复本机存储后重试。" }
    }
  }
  return current
}
function emit() { publishSchoolCache(() => listeners.forEach(listener => listener())) }
function save(updater: (value: FoundationState) => FoundationState): FoundationState {
  if (typeof window === "undefined") throw new Error("请在本机页面中保存基础资料。")
  if (schoolCacheStorage("localStorage").getItem(FOUNDATION_STORAGE_KEY) !== storedRaw) hydrated = false
  const previous = getFoundation()
  if (status.error) throw new Error(status.error)
  const next = validateFoundation(updater(structuredClone(previous)))
  const serialized = JSON.stringify(next)
  try { schoolCacheStorage("localStorage").setItem(FOUNDATION_STORAGE_KEY, serialized) }
  catch { throw new Error("基础资料保存失败，本机存储不可用或空间不足；原数据未改变。") }
  current = next
  storedRaw = serialized
  emit()
  return next
}
export function mergeFoundationImport(incoming: Partial<FoundationState>): FoundationState { return save(previous => mergeFoundationState(previous, incoming)) }
export function updateFoundationItems<K extends keyof FoundationState>(key: K, updater: (items: FoundationState[K]) => FoundationState[K]): FoundationState {
  return save(previous => {
    const beforePlaces = structuredClone(previous.places)
    const next = { ...previous, [key]: updater(previous[key]) }
    if (key === "places") next.places = next.places.map(place => {
      const before = beforePlaces.find(item => item.id === place.id)
      const edited = before?.catalogOnly && (["name", "building", "area", "floor", "roomCode", "usage", "note", "kind"] as const).some(field => before[field] !== place[field])
      return edited ? { ...place, catalogOnly: false } : place
    })
    return next
  })
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  const storage = (event: StorageEvent) => { if (event.key === FOUNDATION_STORAGE_KEY || event.key === null) { hydrated = false; getFoundation(); emit() } }
  window.addEventListener?.("storage", storage)
  return () => { listeners.delete(listener); window.removeEventListener?.("storage", storage) }
}
export function useFoundation() { return useSyncExternalStore(subscribe, getFoundation, () => seed) }
export function useFoundationStatus() { return useSyncExternalStore(subscribe, () => { getFoundation(); return status }, () => emptyStatus) }

// Existing schedule room strings remain unchanged. Only choices for future edits are extended.
export function availablePlaceLabels(places: SchoolPlace[], legacy: string[] = [], currentRoom?: string | null): string[] {
  return [...new Set([...legacy, ...places.filter(place => place.status === "active").sort((a, b) => a.order - b.order).map(placeLabel), ...(currentRoom ? [currentRoom] : [])])]
}
export function resolvePlaceLabel(text: string, places: SchoolPlace[]): string | null {
  const key = normalize(text)
  const active = places.filter(place => place.status === "active")
  const exact = active.filter(place => normalize(placeLabel(place)) === key)
  if (exact.length === 1) return placeLabel(exact[0])
  const aliases = active.filter(place => [place.roomCode, place.name].some(value => value && normalize(value) === key))
  return aliases.length === 1 ? placeLabel(aliases[0]) : null
}
export function usePlaceOptions(legacy: string[], currentRoom?: string | null): string[] {
  const { places } = useFoundation()
  return useMemo(() => availablePlaceLabels(places, legacy, currentRoom), [places, legacy, currentRoom])
}

export function adoptSchoolFoundation(value:FoundationState) {
  const next=validateFoundation(structuredClone(value)),raw=JSON.stringify(next)
  schoolCacheStorage("localStorage").setItem(FOUNDATION_STORAGE_KEY,raw)
  current=next;storedRaw=raw;hydrated=true;status=emptyStatus;emit()
}
