import { schoolCacheStorage, publishSchoolCache } from "./system-cache"
// 人员编号原型：学校级受控预设 + 完整年月号段。
// 天行使用 TG + YYMM + Type + NNN；品牌代码 TGS 不因此改变。
import { STUDENT_PROFILES } from "@/lib/demo/school"
import { STAFF } from "@/lib/demo/staff"
import { CURRENT_SCHOOL } from "./instance"
import { createNumberingLedger, parseNumber, type Claim, type NumberingConfig } from "./numbering-ledger"
import { IMPORTED_STAFF_STORAGE_KEY } from "./staff-storage-keys"

export type PersonType = "S" | "E"
export type NumberingPreset = "standard" | "short"
export const PERSON_TYPE_LABEL: Record<PersonType, string> = { S: "学生", E: "教职工" }
export const PERSON_DATE_LABEL: Record<PersonType, string> = { S: "首次入学", E: "首次入职" }
export const NUMBERING_PRESETS: Record<NumberingPreset, { label: string; length: number }> = {
  standard: { label: "标准版", length: 12 },
  short: { label: "简短版", length: 10 },
}

export type PersonNoIssue = "illegal_char" | "lowercase" | "format" | "school" | "month" | "serial" | "type" | "conflict"
export type PersonNoCheck =
  | { status: "empty" }
  | { status: "valid"; yyyymm: string; monthMismatch: boolean }
  | { status: "invalid"; issue: PersonNoIssue; title: string; detail: string }

const NUMBERING = CURRENT_SCHOOL.numbering
const CONFIG: NumberingConfig = { schoolId: "teensen-genesis-school", ...NUMBERING }
const STORAGE_KEY = "tgs-proto:number-claims:v2"
const seed: Claim[] = []
for (const type of ["S", "E"] as const) {
  const people = type === "E" ? STAFF.map((p) => ({ id: p.id, no: p.employeeNo })) : STUDENT_PROFILES.map((p) => ({ id: p.id, no: p.studentNo }))
  for (const person of people) {
    // Only the explicitly known demo legacy format can supply a logical claim.
    const legacy = new RegExp(`^TGS(\\d{6})(\\d{3})${type}$`).exec(person.no)
    seed.push({ schoolId: CONFIG.schoolId, type, no: person.no, owner: person.id, ...(legacy ? { yyyymm: legacy[1], serial: legacy[2] } : parseNumber(person.no, type, CONFIG)) })
  }
}
const ledger = createNumberingLedger(seed)
let hydrated = false
let importedRaw: string | null = null
let importedOwnerIds = new Set<string>()

function readImportedClaims() {
  if (typeof window === "undefined" || !window.localStorage) return
  let raw: string | null
  try { raw = schoolCacheStorage("localStorage").getItem(IMPORTED_STAFF_STORAGE_KEY) }
  catch { throw new Error("无法核对本机导入人员的工号，请恢复存储后重试。") }
  if (raw === importedRaw) return
  if (!raw) { importedOwnerIds = new Set(); importedRaw = null; return }
  let data: { schema: number; profiles: { id: string; employeeNo?: string }[]; patches: Record<string, { employeeNo?: string | null }>; numberClaims?: Claim[] }
  try { data = JSON.parse(raw) }
  catch { throw new Error("本机导入人员编号资料无法读取，未分配新工号。") }
  if (data.schema !== 1 || !Array.isArray(data.profiles) || !data.patches || typeof data.patches !== "object" || Array.isArray(data.patches) || data.profiles.some(person => !person || typeof person.id !== "string" || !person.id || person.employeeNo !== undefined && typeof person.employeeNo !== "string") || data.numberClaims !== undefined && (!Array.isArray(data.numberClaims) || data.numberClaims.some(claim => !claim || claim.schoolId !== CONFIG.schoolId || claim.type !== "E" || typeof claim.no !== "string" || !claim.no || typeof claim.owner !== "string" || !claim.owner))) throw new Error("本机导入人员编号资料格式无效，未分配新工号。")
  const next = createNumberingLedger(structuredClone(ledger.claims))
  for (const claim of data.numberClaims ?? []) next.register(claim.no, claim.type, CONFIG, claim.owner)
  for (const person of data.profiles) {
    const patch = data.patches[person.id]
    const no = patch && Object.hasOwn(patch, "employeeNo") ? patch.employeeNo : person.employeeNo
    if (no != null && typeof no !== "string") throw new Error("本机导入人员编号格式无效，未分配新工号。")
    if (no) next.register(no, "E", CONFIG, person.id)
  }
  ledger.claims.splice(0, ledger.claims.length, ...next.claims)
  importedOwnerIds = new Set(data.profiles.map(person => person.id))
  importedRaw = raw
}

function hydrateClaims() {
  if (typeof window === "undefined") return
  if (!hydrated) {
    hydrated = true
    try {
      const saved = JSON.parse(schoolCacheStorage("sessionStorage").getItem(STORAGE_KEY) || "[]") as Claim[]
      for (const claim of saved) if (!ledger.claims.some((existing) => existing.no === claim.no && existing.schoolId === claim.schoolId && existing.type === claim.type)) ledger.claims.push(claim)
    } catch { /* unavailable session storage leaves the in-memory prototype intact */ }
  }
  // Always refresh before allocation, even if no staff page has been opened.
  readImportedClaims()
}

/** Prepare claims without publishing them; staff-store saves claims and number in one write. */
export function prepareImportedStaffNumberClaims(owner: string, previousNo: string, nextNo: string): Claim[] {
  hydrateClaims()
  const next = createNumberingLedger(structuredClone(ledger.claims))
  if (previousNo) next.register(previousNo, "E", CONFIG, owner)
  if (nextNo) {
    const parsed = parseCurrent(nextNo, "E")
    if (!parsed || !/^(?!0000)\d{4}(?:0[1-9]|1[0-2])$/.test(parsed.yyyymm) || parsed.serial === "000") throw new Error("工号格式无效，人员资料未保存。")
    next.register(nextNo, "E", CONFIG, owner)
  }
  return next.claims.filter(claim => claim.type === "E" && claim.schoolId === CONFIG.schoolId && !!claim.owner && (claim.owner === owner || importedOwnerIds.has(claim.owner)))
}
function parseCurrent(no: string, type: PersonType) { return parseNumber(no, type, CONFIG) }
export function personNoMonth(no: string, type: PersonType) {
  hydrateClaims()
  return ledger.claims.find((claim) => claim.no === no && claim.type === type && claim.schoolId === CONFIG.schoolId)?.yyyymm ?? parseCurrent(no, type)?.yyyymm
}
export function historicalNumbers(owner: string) {
  hydrateClaims()
  return ledger.claims.filter((claim) => claim.owner === owner && claim.schoolId === CONFIG.schoolId).map((claim) => claim.no)
}
export function isIssued(no: string, type: PersonType) {
  hydrateClaims()
  return ledger.occupied(no, type, CONFIG)
}
export function registerIssued(no: string, type: PersonType, owner?: string) {
  hydrateClaims()
  if (type === "E" && owner && importedOwnerIds.has(owner)) {
    const numberClaims = prepareImportedStaffNumberClaims(owner, "", no)
    try {
      const raw = schoolCacheStorage("localStorage").getItem(IMPORTED_STAFF_STORAGE_KEY)
      if (!raw) throw new Error("missing imported profiles")
      schoolCacheStorage("localStorage").setItem(IMPORTED_STAFF_STORAGE_KEY, JSON.stringify({ ...JSON.parse(raw), numberClaims }))
    } catch { throw new Error("本机工号保存失败；未分配该号码，请重试。") }
    readImportedClaims()
    return
  }
  ledger.register(no, type, CONFIG, owner)
  try { schoolCacheStorage("sessionStorage").setItem(STORAGE_KEY, JSON.stringify(ledger.claims)) } catch { /* keep in-memory state */ }
}

export function yyyymmOf(date: string): string | null {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(date)
  if (!match || Number(match[1]) === 0) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  if (match[3] && (Number(match[3]) < 1 || Number(match[3]) > new Date(Date.UTC(Number(match[1]), month, 0)).getUTCDate())) return null
  return `${match[1]}${match[2]}`
}

export function formatYyyymm(yyyymm: string) {
  return `${yyyymm.slice(0, 4)}-${yyyymm.slice(4)}`
}

function displayMonth(yyyymm: string) {
  return NUMBERING.preset === "short" ? yyyymm.slice(2) : yyyymm
}

export function patternFor(type: PersonType, yyyymm?: string | null) {
  const month = yyyymm ? displayMonth(yyyymm) : NUMBERING.preset === "short" ? "YYMM" : "YYYYMM"
  return `${NUMBERING.code}${month}${type}NNN`
}

export function nextPersonNo(type: PersonType, yyyymm: string, reserved: ReadonlySet<string> = new Set()): string {
  hydrateClaims()
  return ledger.next(type, yyyymm, CONFIG, reserved)
}

export function nextSerialPreview(type: PersonType, yyyymm: string) {
  return nextPersonNo(type, yyyymm).slice(-3)
}

export function checkPersonNo(raw: string, type: PersonType, sourceDate?: string): PersonNoCheck {
  if (!raw.trim()) return { status: "empty" }
  const example = patternFor(type, "202109").replace("NNN", "028")
  if (/[^A-Za-z0-9]/.test(raw)) return { status: "invalid", issue: "illegal_char", title: "包含非法符号", detail: `编号只能包含 ASCII 大写字母和数字，如 ${example}。` }
  if (/[a-z]/.test(raw)) return { status: "invalid", issue: "lowercase", title: "字母需大写", detail: `请按当前预设填写，如 ${example}。` }
  if (!raw.startsWith(NUMBERING.code)) return { status: "invalid", issue: "school", title: "学校代码不匹配", detail: `本校编号代码为 ${NUMBERING.code}；品牌简称仍为 ${CURRENT_SCHOOL.code}。` }
  const parsed = parseCurrent(raw, type)
  if (!parsed) return { status: "invalid", issue: "format", title: "格式不符合当前预设", detail: `本校使用${NUMBERING_PRESETS[NUMBERING.preset].label}：${patternFor(type)}，如 ${example}。` }
  const month = Number(parsed.yyyymm.slice(4))
  if (month < 1 || month > 12 || Number(parsed.yyyymm.slice(0, 4)) === 0) return { status: "invalid", issue: "month", title: "年月不合法", detail: "年份不能为 0000，月份须为 01—12。" }
  if (parsed.serial === "000") return { status: "invalid", issue: "serial", title: "流水号不合法", detail: "流水号须为 001—999。" }
  if (isIssued(raw, type)) return { status: "invalid", issue: "conflict", title: "编号已存在", detail: `${raw} 已被占用；历史号码不会回收。` }
  const source = sourceDate ? yyyymmOf(sourceDate) : null
  return { status: "valid", yyyymm: parsed.yyyymm, monthMismatch: !!source && source !== parsed.yyyymm }
}

export function refreshSchoolNumberClaims() {
  ledger.claims.splice(0,ledger.claims.length,...structuredClone(seed))
  hydrated=false;importedRaw=null;importedOwnerIds=new Set()
  hydrateClaims()
}

export function schoolStaffNumberClaims(owners:Set<string>):Claim[]{
  hydrateClaims()
  return structuredClone(ledger.claims.filter(claim=>claim.schoolId===CONFIG.schoolId && claim.type==="E" && !!claim.owner && owners.has(claim.owner)))
}
