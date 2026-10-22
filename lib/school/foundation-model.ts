import { CLASSROOM_ITEMS, DEPARTMENT_ITEMS, JOB_TITLE_ITEMS, type ClassroomItem, type DepartmentItem, type JobTitleItem } from "../demo/foundation"

export type PlaceKind = "classroom" | "office" | "meeting" | "lab" | "function" | "other"
export const PLACE_KIND_LABEL: Record<PlaceKind, string> = { classroom: "教室", office: "办公室", meeting: "会议室", lab: "实验室", function: "功能场所", other: "其他场所" }
export interface SchoolPlace extends ClassroomItem {
  kind?: PlaceKind
  area?: string
  floor?: string
  roomCode?: string
  usage?: string
  sourceRef?: string
  sourceBatch?: string
  catalogOnly?: boolean
  sourceIds?: string[]
}
export interface FoundationState { departments: DepartmentItem[]; jobs: JobTitleItem[]; places: SchoolPlace[] }
export const foundationSeed: FoundationState = { departments: DEPARTMENT_ITEMS, jobs: JOB_TITLE_ITEMS, places: CLASSROOM_ITEMS.map(place => ({ ...place, kind: "classroom" })) }
const normalize = (value: string) => value.trim().replace(/\s+/g, " ")
// The source uses 区域. Never derive a floor number from a room code.
export function placeLabel(place: SchoolPlace): string {
  const usageLabel = place.usage?.replace(/\s*[（(][^()（）]*[）)]/g, "").trim()
  return [...new Set([place.building, place.area, place.floor, place.roomCode, place.name, usageLabel].filter(Boolean).map(value => normalize(value!)))].join(" · ")
}
function placeIdentity(place: SchoolPlace): string {
  return [place.building, place.area, place.floor, place.roomCode || place.name].map(value => normalize(value ?? "")).join("|")
}
function appendNew<T extends { id: string; sourceBatch?: string; sourceRef?: string; sourceIds?: string[]; sourceReferencedBy?: number; referencedBy?: number; catalogOnly?: boolean; usage?: string; note?: string }>(previous: T[], incoming: T[], identity: (item: T) => string, knownSeeds: T[]): T[] {
  const next = [...previous]
  for (const item of incoming) {
    if (!item.id) continue
    const index = next.findIndex(existing => existing.id === item.id || existing.sourceIds?.includes(item.id) || identity(existing) === identity(item)
      // Earlier imports attached provenance before aliases existed. Recover
      // only known seed identities from that same batch after a user rename.
      || (item.sourceBatch && existing.sourceBatch === item.sourceBatch && !existing.sourceIds?.length && knownSeeds.some(seedItem => seedItem.id === existing.id && identity(seedItem) === identity(item))))
    if (index !== -1) {
      if (next[index].catalogOnly && !item.catalogOnly) next[index] = { ...next[index], usage: item.usage, note: item.note, catalogOnly: false }
      // Add source provenance without replacing an existing ID or human edits.
      if (item.sourceBatch) {
        const sourceIds = [...new Set([...(next[index].sourceIds ?? []), item.id, ...(item.sourceIds ?? [])])].filter(id => id !== next[index].id)
        next[index] = { ...next[index], sourceBatch: next[index].sourceBatch ?? item.sourceBatch, ...(sourceIds.length ? { sourceIds } : {}), ...(item.sourceRef && !next[index].sourceRef ? { sourceRef: item.sourceRef } : {}), ...(item.referencedBy !== undefined ? { sourceReferencedBy: item.sourceReferencedBy ?? item.referencedBy } : {}) }
      }
      continue
    }
    next.push(structuredClone(item))
  }
  return next
}
export function mergeFoundationState(previous: FoundationState, incoming: Partial<FoundationState>): FoundationState {
  return {
    departments: appendNew(previous.departments, incoming.departments ?? [], item => normalize(item.name), foundationSeed.departments),
    jobs: appendNew(previous.jobs, incoming.jobs ?? [], item => normalize(item.name), foundationSeed.jobs),
    places: appendNew(previous.places, incoming.places ?? [], placeIdentity, foundationSeed.places),
  }
}
export function validateFoundation(value: unknown): FoundationState {
  const data = value as FoundationState
  for (const key of ["departments", "jobs", "places"] as const) {
    if (!Array.isArray(data?.[key]) || data[key].some(item => !item || typeof item.id !== "string" || !item.id.trim() || typeof item.name !== "string" || !item.name.trim() || !["active", "inactive"].includes(item.status) || !Number.isFinite(item.order))) throw new Error("基础资料存储格式无法读取。")
    if (new Set(data[key].map(item => item.id)).size !== data[key].length) throw new Error("基础资料存在重复标识。")
    if (data[key].some(item => item.sourceIds !== undefined && (!Array.isArray(item.sourceIds) || item.sourceIds.some(id => typeof id !== "string" || !id)))) throw new Error("基础资料来源标识无效。")
  }
  if ([...data.departments, ...data.jobs].some(item => item.sourceReferencedBy !== undefined && (!Number.isInteger(item.sourceReferencedBy) || item.sourceReferencedBy < 0))) throw new Error("基础资料来源统计无效。")
  if (data.places.some(place => typeof place.building !== "string" || (place.kind && !Object.hasOwn(PLACE_KIND_LABEL, place.kind)) || [place.area, place.floor, place.roomCode, place.usage, place.sourceRef, place.sourceBatch].some(value => value !== undefined && typeof value !== "string"))) throw new Error("场所资料格式无法读取。")
  return data
}
