"use client"
import { exportSchoolStaff, adoptSchoolStaff } from "./staff-store"
import { getFoundation, adoptSchoolFoundation, FOUNDATION_STORAGE_KEY } from "./foundation-store"
import { IMPORTED_STAFF_STORAGE_KEY } from "./staff-storage-keys"
import { refreshSchoolNumberClaims } from "./person-no"
import { stageSchoolCache,stagedSchoolWrites,commitAuxiliarySchoolWrites,enableSharedSchoolCache,schoolCacheStorage } from "./system-cache"
import { validateSchoolRecords, type SchoolRecords, type SchoolSnapshot } from "./system-model"
let snapshot:SchoolSnapshot|null=null
let running=false
let identity=""
let configured=false
let connection:Promise<void>|null=null
const MIGRATION_KEY="tgs-school-system-migration-v1"
const exportRecords=():SchoolRecords=>({foundation:structuredClone(getFoundation()),staff:exportSchoolStaff()})
function adopt(value:SchoolSnapshot) {
  validateSchoolRecords(value.records)
  adoptSchoolFoundation(value.records.foundation);adoptSchoolStaff(value.records.staff);refreshSchoolNumberClaims();snapshot=value
}
async function api(body?:unknown,signal?:AbortSignal) {
  const response=await fetch("/api/school/records",{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined,signal})
  if(!response.ok) { const error=await response.json().catch(()=>({}));throw Error(error.error??"学校资料未能保存，请重试。") }
  return await response.json() as SchoolSnapshot
}
export async function connectSchoolSystem(persona:string,signal?:AbortSignal) {
  enableSharedSchoolCache()
  const local=schoolCacheStorage("localStorage"),session=schoolCacheStorage("sessionStorage")
  const before=exportRecords()
  const hasLegacy=[FOUNDATION_STORAGE_KEY,IMPORTED_STAFF_STORAGE_KEY].some(key=>local.getItem(key)) || ["tgs-proto:staff-patches:v1","tgs-proto:staff-created:v1"].some(key=>session.getItem(key))
  const login=await fetch("/api/school/session",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({persona}),signal})
  if(!login.ok)throw Error("当前身份无法读取学校资料。")
  let current=await api(undefined,signal)
  if(signal?.aborted) return
  if(hasLegacy && local.getItem(MIGRATION_KEY)!==`${current.systemId}:v2`) {
    // Both original caches and the migration receipt remain recoverable.
    if(!local.getItem(`tgs-school-legacy-backup:${current.systemId}`))local.setItem(`tgs-school-legacy-backup:${current.systemId}`,JSON.stringify(before))
    local.setItem(`tgs-school-legacy-backup:${current.systemId}:v2`,JSON.stringify(before))
    let browserId=local.getItem("tgs-school-browser-id")
    if(!browserId){browserId=crypto.randomUUID();local.setItem("tgs-school-browser-id",browserId)}
    current=await api({action:"migrate",browserId,records:before},signal)
  }
  if(signal?.aborted)return
  adopt(current);identity=persona
  local.setItem(MIGRATION_KEY,`${current.systemId}:v2`)
}
export function configureSchoolSystem(persona:string,signal?:AbortSignal){configured=true;connection=connectSchoolSystem(persona,signal);return connection}
export function disconnectSchoolSystem(){snapshot=null;identity="";connection=null;configured=false}
export async function commitSchoolChange<T>(action:()=>T):Promise<T> {
  if(!snapshot && connection) await connection
  if(!snapshot){if(configured)throw Error("学校资料尚未完成读取，请稍后重试。");return action()}
  if(running)throw Error("学校资料正在保存，请稍后重试。")
  running=true
  const before=snapshot
  let result:T
  let records:SchoolRecords
  let writes=new Map<string,string|null>()
  try {
    try {stageSchoolCache(()=>{
      try {result=action();records=exportRecords();writes=stagedSchoolWrites()} finally {adopt(before)}
    })} finally {refreshSchoolNumberClaims()}
    const saved=await api({action:"save",revision:before.revision,records:records!})
    adopt(saved);commitAuxiliarySchoolWrites(writes);refreshSchoolNumberClaims()
    return result!
  } finally {running=false}
}
export async function refreshSchoolSystem(){if(snapshot&&identity&&!running)adopt(await api())}
