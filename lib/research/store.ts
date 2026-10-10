"use client"

import { useSyncExternalStore } from "react"
import { getStaffList } from "@/lib/school/staff-store"
import { getStaffDuties, subscribeStaffDuties } from "@/lib/school/duty-store"
import { migrateLegacyResearchDuties } from "@/lib/school/duty-model"
import { getCatalog } from "@/lib/school/catalog-store"
import { PERIODS } from "@/lib/timetable/data"
import { emptyDocument, emptyItem, type Actor, type Document, type ResearchState } from "./model"
import { applyResearchCommand, type Command } from "./commands"
import { researchSeed } from "./seed"
export * from "./model"
export type { Command } from "./commands"

export function schoolPeriodMinutes(): number | null {
  const minutes = [...new Set(PERIODS.map(p => { const [a,b] = p.start.split(":").map(Number); const [c,d] = p.end.split(":").map(Number); return (c*60+d)-(a*60+b) }))]
  return minutes.length === 1 && minutes[0] > 0 ? minutes[0] : null
}
const KEY = "tgs:research-prototype:v2"
const LEGACY_KEY = "tgs:research-prototype:v1"
const seed = researchSeed(schoolPeriodMinutes())
let state = seed
let hydrated = false
let status = { error: "", memoryDraft: false }
const listeners = new Set<() => void>()

function normalizeDocument(value: Partial<Document> & { id: string }): Document {
  const defaults = emptyDocument(value.id,value.kind ?? "计划",value.title ?? "未命名内容",value.owner ?? "",value.author ?? "u-lin",value.course ?? "",schoolPeriodMinutes())
  return { ...defaults,...value,items: (value.items ?? []).map(i => ({ ...emptyItem(i.id),...i, weeks: Array.isArray(i.weeks) ? i.weeks : [], references: Array.isArray(i.references) ? i.references : [], notes: i.notes ?? ((i as unknown as { week?: string }).week ? `原版周次备注：${(i as unknown as { week: string }).week}；尚未映射具体分钟。` : "") })) }
}
export function migrateResearch(value: unknown): ResearchState {
  const data = value as Omit<Partial<ResearchState>, "schema"> & { schema?: number; appointments?: unknown[]; grants?: unknown[] }
  if (!data || !Array.isArray(data.documents) || !Array.isArray(data.tasks)) throw new Error("教研存储无法读取。原数据未清空，请保留并检查存储格式。")
  const { appointments, grants, staffDuties, groups, schema: _schema, ...content } = data
  if (data.schema === 2 || data.schema === 3) return { ...seed, ...content, schema: 3, documents: data.documents.map(normalizeDocument), staffDuties: data.schema === 2 ? migrateLegacyResearchDuties({ appointments, grants }) : staffDuties ?? seed.staffDuties, groups: groups ?? seed.groups }
  const documents = data.documents.map(normalizeDocument)
  for (const doc of seed.documents) if (!documents.some(d => d.id === doc.id)) documents.push(structuredClone(doc))
  const legacyTasks = data.tasks as unknown as { id: string; group: string; parent: string; title: string; owner: string; due: string; status: string; mode: string; result?: Document; discussion?: { author: string; text: string }[] }[]
  const tasks = legacyTasks.map(t => ({ ...seed.tasks.find(x => x.group === t.group)!, id: t.id, group: t.group, title: t.title, owner: t.owner, due: t.due, mode: t.mode as ResearchState["tasks"][number]["mode"], schoolTaskId: t.parent || null, status: t.status as ResearchState["tasks"][number]["status"], outcomes: t.result ? [{ id: `migrated-${t.id}`, kind: "document" as const, entityId: t.result.id, title: t.result.title, version: t.result.version, document: normalizeDocument(t.result), submittedBy: t.owner, submittedAt: "旧版提交（日期未记录）" }] : [] }))
  return { ...seed,documents,revisions: { ...seed.revisions,...Object.fromEntries(documents.map(d => [`${d.id}@${d.version}`,structuredClone(d)])) }, tasks, discussions: legacyTasks.flatMap(t => (t.discussion ?? []).map((d,i) => ({ id: `migrated-${t.id}-${i}`, target: `task:${t.id}`, author: d.author, body: d.text, at: "旧版讨论（日期未记录）" }))) }
}
export function getResearch(): ResearchState {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true
    try { const raw = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY); if (raw) state = migrateResearch(JSON.parse(raw)) }
    catch (error) { status = { error: error instanceof Error ? error.message : "浏览器存储读取失败，未替换原数据。", memoryDraft: false } }
  }
  const duties = getStaffDuties()
  if (state.staffDuties !== duties.assignments || state.groups !== duties.groups) state = { ...state, staffDuties: duties.assignments, groups: duties.groups }
  return state
}
function emit() { listeners.forEach(l => l()) }
function persist(next: ResearchState, retainDraft = false) {
  const { staffDuties: _duties, groups: _groups, ...content } = next
  try { window.localStorage.setItem(KEY,JSON.stringify(content)); state = next; status = { error: "",memoryDraft: false }; emit(); return true }
  catch { if (retainDraft) state = next; status = { error: "保存失败：本机存储不可用或空间不足。未完成文本保留在当前页面内存中，请不要关闭页面，恢复后重试。",memoryDraft: retainDraft }; emit(); return false }
}
export function saveResearch(next: ResearchState) { if (!persist(next)) throw new Error(status.error) }
export function researchCommand(actor: Actor, command: Command): { ok: true } | { ok: false; error: string } {
  const current = getResearch()
  const people = getStaffList()
  const me = people.find(p => p.id === actor.staff)
  const liveActor = { ...actor,enabled: actor.enabled && !!me && me.status !== "left" && me.accountStatus === "enabled" }
  try {
    const next = applyResearchCommand(current,liveActor,command,getCatalog(),id => people.some(p => p.id === id && p.status !== "left" && p.accountStatus === "enabled"))
    if (!persist(next,command.type === "draft-document" || command.type === "form-draft")) return { ok: false,error: status.error }
    return { ok: true }
  } catch(error) { return { ok: false,error: error instanceof Error ? error.message : "操作失败，请重新核对。" } }
}
export function retryResearchSave() { return persist(state) }
function subscribe(listener: () => void) {
  listeners.add(listener)
  const stopDuties = subscribeStaffDuties(() => { getResearch(); listener() })
  const storage = (event: StorageEvent) => { if (event.key === KEY && event.newValue) { hydrated = false; getResearch(); emit() } }
  window.addEventListener("storage",storage)
  return () => { stopDuties(); listeners.delete(listener); window.removeEventListener("storage",storage) }
}
export function useResearch() { return useSyncExternalStore(subscribe,getResearch,() => seed) }
const serverStatus = { error: "",memoryDraft: false }
export function useResearchStatus() { return useSyncExternalStore(subscribe,() => status,() => serverStatus) }
