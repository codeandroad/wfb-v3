import type { StaffProfile } from "../demo/staff"
import type { StaffPatch } from "./staff-store"
import { parseNumber, type Claim } from "./numbering-ledger"
import { validateFoundation, type FoundationState } from "./foundation-model"

export const SCHOOL_ID = "teensen-genesis-school"
export interface SchoolRecords { foundation: FoundationState; staff: { profiles: StaffProfile[]; patches: Record<string, StaffPatch>; numberClaims: Claim[] } }
export interface SchoolSnapshot { systemId: string; revision: number; records: SchoolRecords }
const patchKeys = new Set(["accountStatus","name","employeeNo","department","jobTitle","gender","joinedAt","phone","email","status","statusNote","englishName","birthMonth","birthplace","educationLevel","firstWorkAt","educationExperiences","workExperiences","interests","wechat","extraHistory"])
export function validateSchoolRecords(input: unknown): SchoolRecords {
  const value = input as SchoolRecords
  validateFoundation(value?.foundation)
  const staff = value.staff
  if (!staff || !Array.isArray(staff.profiles) || staff.profiles.length > 10000 || !staff.patches || typeof staff.patches !== "object" || Array.isArray(staff.patches) || !Array.isArray(staff.numberClaims)) throw Error("学校资料格式无效。")
  const ids = new Set<string>()
  for (const profile of staff.profiles) {
    if (!profile || typeof profile.id !== "string" || !profile.id || ids.has(profile.id) || typeof profile.name !== "string" || !profile.name.trim() || typeof profile.employeeNo !== "string" || typeof profile.department !== "string" || typeof profile.jobTitle !== "string" || !Array.isArray(profile.systemRoles) || !Array.isArray(profile.duties) || !Array.isArray(profile.history)) throw Error("人员资料格式无效。")
    ids.add(profile.id)
  }
  for (const [id, patch] of Object.entries(staff.patches)) {
    if (!ids.has(id) || !patch || typeof patch !== "object" || Array.isArray(patch) || Object.keys(patch).some(key => !patchKeys.has(key))) throw Error("人员修改字段无效。")
    for (const [key, field] of Object.entries(patch)) {
      if (field == null) continue
      if (["interests","educationExperiences","workExperiences","extraHistory"].includes(key) ? !Array.isArray(field) : typeof field !== "string") throw Error("人员修改内容无效。")
    }
    if (patch.name !== undefined && (typeof patch.name !== "string" || !patch.name.trim()) || patch.status != null && !["active","leave","left"].includes(patch.status)) throw Error("人员状态或姓名无效。")
  }
  const assigned = new Map<string,string>()
  const logical = new Map<string,string>()
  const register=(no:string,owner:string,claim?:Claim)=>{
    const legacy=/^TGS(\d{6})(\d{3})E$/.exec(no)
    const parsed=parseNumber(no,"E",{schoolId:SCHOOL_ID,code:"TG",preset:"short"})??(legacy?{yyyymm:legacy[1],serial:legacy[2]}:null)
    const key=claim?.yyyymm&&claim.serial?`${claim.yyyymm}:${claim.serial}`:parsed?`${parsed.yyyymm}:${parsed.serial}`:null
    if(assigned.has(no)&&assigned.get(no)!==owner || key&&logical.has(key)&&logical.get(key)!==owner)throw Error("工号或其历史号段已被其他人员占用。")
    assigned.set(no,owner);if(key)logical.set(key,owner)
  }
  for (const claim of staff.numberClaims) {
    if (!claim || claim.schoolId !== SCHOOL_ID || claim.type !== "E" || typeof claim.no !== "string" || !claim.no || typeof claim.owner !== "string" || !ids.has(claim.owner)) throw Error("学校工号归属无效。")
    register(claim.no,claim.owner,claim)
  }
  for (const person of staff.profiles) {
    const patch = staff.patches[person.id]
    const no = patch && Object.hasOwn(patch,"employeeNo") ? patch.employeeNo : person.employeeNo
    if(no)register(no,person.id)
  }
  return value
}
export const canonical = (value: unknown): string => value === undefined ? "null" : JSON.stringify(value)
function mergeObject(base: Record<string,unknown>, current: Record<string,unknown>, incoming: Record<string,unknown>, conflicts: string[], path: string) {
  const next = { ...current }
  for (const [key,value] of Object.entries(incoming)) {
    if (["__proto__","prototype","constructor"].includes(key)) throw Error("无效字段。")
    if (canonical(value) === canonical(base[key]) || canonical(value) === canonical(current[key])) continue
    if (canonical(current[key]) === canonical(base[key])) next[key] = value
    else conflicts.push(`${path}.${key}`)
  }
  return next
}
export function migrateSchoolRecords(base: SchoolRecords, current: SchoolRecords, incoming: SchoolRecords) {
  const conflicts: string[] = []
  const next = structuredClone(current)
  for (const key of ["departments","jobs","places"] as const) {
    for (const row of incoming.foundation[key]) {
      const target = next.foundation[key].find(item => item.id === row.id || item.sourceIds?.includes(row.id) || row.sourceIds?.includes(item.id))
      if (!target) { (next.foundation[key] as unknown[]).push(structuredClone(row)); continue }
      const original = base.foundation[key].find(item => item.id === target.id)
      const candidate={...row,id:target.id} as unknown as Record<string,unknown>
      if(key==="places" && "catalogOnly" in row && row.catalogOnly && original && !("catalogOnly" in original && original.catalogOnly)){delete candidate.usage;delete candidate.note;delete candidate.catalogOnly}
      Object.assign(target,mergeObject((original ?? {}) as unknown as Record<string,unknown>,target as unknown as Record<string,unknown>,candidate,conflicts,`${key}.${target.id}`))
    }
  }
  for (const person of incoming.staff.profiles) {
    const existing = next.staff.profiles.find(item => item.id === person.id)
    if (!existing) {
      if (person.isCurrent || person.username || person.accountStatus !== "none" || person.systemRoles.length || person.duties.length) throw Error("迁移不创建账号或授予职责。")
      next.staff.profiles.push(structuredClone(person))
    }
  }
  for (const [id,patch] of Object.entries(incoming.staff.patches)) next.staff.patches[id] = mergeObject((base.staff.patches[id] ?? {}) as Record<string,unknown>, (next.staff.patches[id] ?? {}) as Record<string,unknown>,patch as Record<string,unknown>,conflicts,`staff.${id}`) as StaffPatch
  for (const claim of incoming.staff.numberClaims) if (!next.staff.numberClaims.some(item => item.no === claim.no && item.owner === claim.owner)) next.staff.numberClaims.push(structuredClone(claim))
  validateSchoolRecords(next)
  return { records:next, conflicts }
}
export function validateSchoolChange(before: SchoolRecords, after: SchoolRecords, migration=false) {
  validateSchoolRecords(after)
  for (const key of ["departments","jobs","places"] as const) if (before.foundation[key].some(item => !after.foundation[key].some(row => row.id === item.id))) throw Error("已有目录记录必须保留，可停用。")
  if(!migration)for(const key of ["departments","jobs","places"] as const)for(const item of before.foundation[key]){
    const next=after.foundation[key].find(row=>row.id===item.id)!
    for(const field of ["sourceBatch","sourceIds","sourceRef"] as const)if(canonical(item[field])!==canonical(next[field]))throw Error("来源标识不能由资料编辑改写。")
  }
  for (const person of before.staff.profiles) {
    const candidate = after.staff.profiles.find(item => item.id === person.id)
    if (!candidate || [...new Set([...Object.keys(person),...Object.keys(candidate)])].some(key=>canonical((person as unknown as Record<string,unknown>)[key])!==canonical((candidate as unknown as Record<string,unknown>)[key]))) throw Error("已有人员标识和原档案必须保留，修改通过资料字段保存。")
  }
  for(const person of before.staff.profiles){const old=before.staff.patches[person.id]?.accountStatus??person.accountStatus;const next=after.staff.patches[person.id]?.accountStatus??person.accountStatus;if(next!==old&&next!=="disabled")throw Error("资料编辑不能开通或恢复账号权限。")}
  for (const person of after.staff.profiles.filter(item => !before.staff.profiles.some(row => row.id === item.id))) if (person.accountStatus !== "none" || person.systemRoles.length || person.duties.length || person.username || person.isCurrent) throw Error("新增档案不能自动取得账号或职责。")
  for (const claim of before.staff.numberClaims) if (!after.staff.numberClaims.some(item => canonical(item) === canonical(claim))) throw Error("历史工号归属必须保留。")
}

// The database owns historical numbers, even if a caller omits its claims.
export function retainSchoolNumbers(before:SchoolRecords|null,after:SchoolRecords):SchoolRecords{
  const next=structuredClone(after),claims=[...(before?.staff.numberClaims??[]),...next.staff.numberClaims]
  const records=before?[before,next]:[next]
  for(const record of records)for(const person of record.staff.profiles){
    const patch=record.staff.patches[person.id],current=patch&&Object.hasOwn(patch,"employeeNo")?patch.employeeNo:person.employeeNo
    for(const no of [person.employeeNo,current])if(no&&!claims.some(claim=>claim.no===no&&claim.owner===person.id)){
      const legacy=/^TGS(\d{6})(\d{3})E$/.exec(no),parsed=parseNumber(no,"E",{schoolId:SCHOOL_ID,code:"TG",preset:"short"})??(legacy?{yyyymm:legacy[1],serial:legacy[2]}:null)
      claims.push({schoolId:SCHOOL_ID,type:"E",no,owner:person.id,...parsed})
    }
  }
  next.staff.numberClaims=claims.filter((item,index)=>claims.findIndex(other=>other.no===item.no&&other.owner===item.owner)===index)
  validateSchoolRecords(next);return next
}
