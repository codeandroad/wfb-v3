// 人员编号原型：学校级受控预设 + 完整年月号段。
// 天行使用 TG + YYMM + Type + NNN；品牌代码 TGS 不因此改变。
import { STUDENT_PROFILES } from "@/lib/demo/school"
import { STAFF } from "@/lib/demo/staff"
import { CURRENT_SCHOOL } from "./instance"
import { createNumberingLedger, parseNumber, type Claim, type NumberingConfig } from "./numbering-ledger"

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
function hydrateClaims() {
  if (hydrated || typeof window === "undefined") return
  hydrated = true
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "[]") as Claim[]
    for (const claim of saved) if (!ledger.claims.some((existing) => existing.no === claim.no && existing.schoolId === claim.schoolId && existing.type === claim.type)) ledger.claims.push(claim)
  } catch { /* unavailable session storage leaves the in-memory prototype intact */ }
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
  ledger.register(no, type, CONFIG, owner)
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ledger.claims)) } catch { /* keep in-memory state */ }
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
