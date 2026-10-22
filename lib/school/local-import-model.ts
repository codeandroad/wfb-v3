import type { StaffProfile } from "@/lib/demo/staff"
import type { FoundationState } from "./foundation-store"

export interface LocalSchoolImportBundle extends FoundationState {
  schema: 1
  batchId: string
  staff: StaffProfile[]
  summary: {
    staffRows: number; departments: Record<string, number>; jobs: number; places: number
    areas: Record<string, number>; placeKinds: Record<string, number>; suggestedSubjects: Record<string, number>
    duplicateNameRows: number; multiUsePlaces: number; ignoredLayoutMarkers: number
  }
}
export type LocalSchoolImportMetadata = Pick<LocalSchoolImportBundle, "batchId" | "summary">
export const LOCAL_SCHOOL_SESSION_COOKIE = "tgs-local-school-access"

export function localSchoolCookieToken(cookie: string | null): string {
  const matches = (cookie ?? "").split(";").map(part => part.trim()).filter(part => part.startsWith(`${LOCAL_SCHOOL_SESSION_COOKIE}=`))
  return matches.length === 1 ? matches[0].slice(LOCAL_SCHOOL_SESSION_COOKIE.length + 1) : ""
}

export function isLoopbackHost(host: string | null): boolean {
  return !!host && /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/.test(host)
}

export function validateLocalSchoolImport(value: unknown): LocalSchoolImportBundle {
  const data = value as LocalSchoolImportBundle
  if (!data || data.schema !== 1 || typeof data.batchId !== "string" || !data.batchId.startsWith("school-files-")) throw new Error("本机导入包版本无效。")
  for (const key of ["staff", "departments", "jobs", "places"] as const) {
    const records = data[key]
    if (!Array.isArray(records) || records.length > 10000 || new Set(records.map(item => item?.id)).size !== records.length || records.some(item => !item || typeof item.id !== "string" || typeof item.name !== "string" || !item.name.trim())) throw new Error("本机导入包有缺失或重复的来源标识。")
  }
  if (!data.summary || data.summary.staffRows !== data.staff.length || data.summary.places !== data.places.length) throw new Error("本机导入包数量不一致。")
  const strings = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === "string")
  for (const person of data.staff) {
    // File import does not appoint people or create login accounts.
    if (!person.id.startsWith("local-staff-") || typeof person.department !== "string" || typeof person.jobTitle !== "string" || person.sourceBatch !== data.batchId || person.employeeNo !== "" || person.accountStatus !== "none" || person.systemRoles?.length !== 0 || person.duties?.length !== 0 || person.username || person.isCurrent || person.joinedAt) throw new Error("人员导入仅可建立未开户、未安排职责的档案。")
    if (typeof person.phone !== "string" || typeof person.email !== "string" || !["男", "女", "未透露"].includes(person.gender) || person.status !== "active" || !Array.isArray(person.history) || person.history.length || !strings(person.sourceRefs) || !strings(person.departmentAffiliations) || !strings(person.suggestedResearchSubjects) || (person.duplicateName !== undefined && typeof person.duplicateName !== "boolean")) throw new Error("人员资料或来源字段格式无效。")
  }
  for (const item of [...data.departments, ...data.jobs, ...data.places]) if (!["active", "inactive"].includes(item.status) || !Number.isFinite(item.order)) throw new Error("基础资料状态或排序无效。")
  for (const item of [...data.departments, ...data.jobs]) if (!Number.isFinite(item.referencedBy) || item.referencedBy < 0) throw new Error("基础资料引用数量无效。")
  for (const place of data.places) {
    if (!place.id.startsWith("local-place-") || typeof place.building !== "string" || !place.roomCode || place.sourceBatch !== data.batchId) throw new Error("场所缺少区域、门牌或来源。")
    if (place.kind && !["classroom", "office", "meeting", "lab", "function", "other"].includes(place.kind)) throw new Error("场所类型无效。")
    for (const field of ["floor", "area", "usage", "sourceRef", "note"] as const) if (place[field] !== undefined && typeof place[field] !== "string") throw new Error("场所资料字段格式无效。")
  }
  return data
}
