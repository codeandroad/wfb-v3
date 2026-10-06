// 人员编号原型：学校级受控预设 + 完整年月号段。
// 天行使用 TG + YYMM + Type + NNN；品牌代码 TGS 不因此改变。
import { STUDENT_PROFILES } from "@/lib/demo/school"
import { STAFF } from "@/lib/demo/staff"
import { CURRENT_SCHOOL } from "./instance"

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
const issued: Record<PersonType, Set<string>> = {
  S: new Set(STUDENT_PROFILES.map((person) => person.studentNo).filter(Boolean)),
  E: new Set(STAFF.map((person) => person.employeeNo).filter(Boolean)),
}
const logicalClaims = new Set<string>()

function parseCurrent(no: string, type: PersonType) {
  const code = NUMBERING.code
  const expression = NUMBERING.preset === "short"
    ? new RegExp(`^(${code})(\\d{2})(\\d{2})(${type})(\\d{3})$`)
    : new RegExp(`^(${code})(\\d{4})(\\d{2})(${type})(\\d{3})$`)
  const match = expression.exec(no)
  if (!match) return null
  const year = NUMBERING.preset === "short" ? `20${match[2]}` : match[2]
  return { yyyymm: `${year}${match[3]}`, serial: match[5], type: match[4] as PersonType }
}

for (const type of ["S", "E"] as const) {
  for (const no of issued[type]) {
    const parsed = parseCurrent(no, type)
    if (parsed) logicalClaims.add(`${type}:${parsed.yyyymm}:${parsed.serial}`)
  }
}

export function isIssued(no: string, type: PersonType) {
  if (issued[type].has(no)) return true
  const parsed = parseCurrent(no, type)
  return !!parsed && logicalClaims.has(`${type}:${parsed.yyyymm}:${parsed.serial}`)
}

export function registerIssued(no: string, type: PersonType) {
  issued[type].add(no)
  const parsed = parseCurrent(no, type)
  if (parsed) logicalClaims.add(`${type}:${parsed.yyyymm}:${parsed.serial}`)
}

export function yyyymmOf(date: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(date)
  if (!match) return null
  const month = Number(match[2])
  return month >= 1 && month <= 12 ? `${match[1]}${match[2]}` : null
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

export function nextPersonNo(type: PersonType, yyyymm: string): string {
  const year = Number(yyyymm.slice(0, 4))
  if (NUMBERING.preset === "short" && (year < 2000 || year > 2099)) {
    throw new Error("本校简短编号只支持 2000—2099 年；可保持待编号或修正首次年月。")
  }
  for (let serial = 1; serial <= 999; serial += 1) {
    const value = String(serial).padStart(3, "0")
    if (!logicalClaims.has(`${type}:${yyyymm}:${value}`)) return `${NUMBERING.code}${displayMonth(yyyymm)}${type}${value}`
  }
  throw new Error(`${formatYyyymm(yyyymm)} 的${PERSON_TYPE_LABEL[type]}号段已用尽。`)
}

export function nextSerialPreview(type: PersonType, yyyymm: string) {
  return nextPersonNo(type, yyyymm).slice(-3)
}

export function checkPersonNo(raw: string, type: PersonType, sourceDate?: string): PersonNoCheck {
  if (raw === "") return { status: "empty" }
  const example = patternFor(type, "202109").replace("NNN", "028")
  if (/[^A-Za-z0-9]/.test(raw)) return { status: "invalid", issue: "illegal_char", title: "包含非法符号", detail: `编号只能包含 ASCII 大写字母和数字，如 ${example}。` }
  if (/[a-z]/.test(raw)) return { status: "invalid", issue: "lowercase", title: "字母需大写", detail: `请按当前预设填写，如 ${example}。` }
  if (!raw.startsWith(NUMBERING.code)) return { status: "invalid", issue: "school", title: "学校代码不匹配", detail: `本校编号代码为 ${NUMBERING.code}；品牌简称仍为 ${CURRENT_SCHOOL.code}。` }
  const parsed = parseCurrent(raw, type)
  if (!parsed) return { status: "invalid", issue: "format", title: "格式不符合当前预设", detail: `本校使用${NUMBERING_PRESETS[NUMBERING.preset].label}：${patternFor(type)}，如 ${example}。` }
  const month = Number(parsed.yyyymm.slice(4))
  if (month < 1 || month > 12) return { status: "invalid", issue: "month", title: "年月不合法", detail: "月份须为 01—12。" }
  if (parsed.serial === "000") return { status: "invalid", issue: "serial", title: "流水号不合法", detail: "流水号须为 001—999。" }
  if (isIssued(raw, type)) return { status: "invalid", issue: "conflict", title: "编号已存在", detail: `${raw} 已被占用；历史号码不会回收。` }
  const source = sourceDate ? yyyymmOf(sourceDate) : null
  return { status: "valid", yyyymm: parsed.yyyymm, monthMismatch: !!source && source !== parsed.yyyymm }
}
