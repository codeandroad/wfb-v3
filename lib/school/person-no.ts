// 人员编号规则：SchoolCode + YYYYMM + NNN + Type
// - SchoolCode 来自当前部署实例（CURRENT_SCHOOL.code），不是全局常量。
// - YYYYMM：学生 = 首次正式入学年月；教职工 = 首次正式入职年月（不是录入 / 创建时间）。
// - NNN：001–999；学生（S）与教职工（E）各自维护流水号池，按 YYYYMM 分段。
// - 年级、班级、课程体系、部门、职务、角色等均不进入编号，这些变化不触发重新编号。
// - 编号一经创建即为稳定正式编号；已发放编号不回收。

import { STUDENT_PROFILES } from "@/lib/demo/school"
import { STAFF } from "@/lib/demo/staff"
import { CURRENT_SCHOOL } from "./instance"

export type PersonType = "S" | "E"

export const PERSON_TYPE_LABEL: Record<PersonType, string> = { S: "学生", E: "教职工" }
export const PERSON_DATE_LABEL: Record<PersonType, string> = { S: "首次正式入学", E: "首次正式入职" }

export type PersonNoIssue =
  | "illegal_char"
  | "lowercase"
  | "format"
  | "school"
  | "month"
  | "serial"
  | "type"
  | "conflict"

export type PersonNoCheck =
  | { status: "empty" }
  | { status: "valid"; yyyymm: string; monthMismatch: boolean }
  | { status: "invalid"; issue: PersonNoIssue; title: string; detail: string }

const SCHOOL = CURRENT_SCHOOL.code

/* ---------------- 已占用编号（演示态注册表） ---------------- */

// 学生 202609 段 001–006 为早先已发放编号（含已离校），编号不回收，仍视为占用
const RETIRED_STUDENT_NOS = Array.from({ length: 6 }, (_, i) => `${SCHOOL}202609${String(i + 1).padStart(3, "0")}S`)

const issued: Record<PersonType, Set<string>> = {
  S: new Set([...RETIRED_STUDENT_NOS, ...STUDENT_PROFILES.map((s) => s.studentNo)]),
  E: new Set(STAFF.map((s) => s.employeeNo)),
}

export function isIssued(no: string, type: PersonType) {
  return issued[type].has(no)
}

// 创建成功后登记，保证本会话内后续新增不会重复占用
export function registerIssued(no: string, type: PersonType) {
  issued[type].add(no)
}

/* ---------------- 工具 ---------------- */

export function yyyymmOf(date: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(date)
  return m ? `${m[1]}${m[2]}` : null
}

export function formatYyyymm(yyyymm: string) {
  return `${yyyymm.slice(0, 4)}-${yyyymm.slice(4)}`
}

export function patternFor(type: PersonType, yyyymm?: string | null) {
  return `${SCHOOL}${yyyymm ?? "YYYYMM"}···${type}`
}

// 按 “类型 + 年月” 的独立流水号池取下一个号：学生与教职工互不占用
export function nextPersonNo(type: PersonType, yyyymm: string): string {
  const prefix = `${SCHOOL}${yyyymm}`
  let max = 0
  for (const no of issued[type]) {
    if (no.startsWith(prefix) && no.endsWith(type)) {
      const serial = Number(no.slice(prefix.length, prefix.length + 3))
      if (serial > max) max = serial
    }
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}${type}`
}

export function nextSerialPreview(type: PersonType, yyyymm: string) {
  return nextPersonNo(type, yyyymm).slice(SCHOOL.length + 6, SCHOOL.length + 9)
}

/* ---------------- 校验 ---------------- */

// 不对输入做任何自动修正（去空格、转大写等），仅报告原因
export function checkPersonNo(raw: string, type: PersonType, sourceDate?: string): PersonNoCheck {
  if (raw === "") return { status: "empty" }
  const expect = `${SCHOOL} + 年月 YYYYMM + 三位流水号 + ${type}，共 ${SCHOOL.length + 10} 位，如 ${SCHOOL}202609088${type}`

  if (/[^A-Za-z0-9]/.test(raw)) {
    return {
      status: "invalid",
      issue: "illegal_char",
      title: "包含非法符号",
      detail: `编号只能由大写字母和数字组成，不能包含空格、“-”、“/”等符号。应为：${expect}。`,
    }
  }
  if (/[a-z]/.test(raw)) {
    return { status: "invalid", issue: "lowercase", title: "字母需大写", detail: `学校代码与类型字母须为大写。应为：${expect}。` }
  }

  const m = /^([A-Z]+)(\d{4})(\d{2})(\d{3})([A-Z])$/.exec(raw)
  if (!m || m[1].length !== SCHOOL.length) {
    return { status: "invalid", issue: "format", title: "格式错误", detail: `编号结构不符合规则。应为：${expect}。` }
  }
  const [, code, yyyy, mm, serial, t] = m

  if (code !== SCHOOL) {
    return {
      status: "invalid",
      issue: "school",
      title: "学校代码不匹配",
      detail: `“${code}” 不是本校代码。本实例为 ${CURRENT_SCHOOL.nameEn}，学校代码须为 ${SCHOOL}。`,
    }
  }
  const year = Number(yyyy)
  const month = Number(mm)
  if (month < 1 || month > 12 || year < 1990 || year > 2099) {
    return {
      status: "invalid",
      issue: "month",
      title: "年月不合法",
      detail: `“${yyyy}${mm}” 不是有效年月（月份须为 01–12）。年月应为${PERSON_DATE_LABEL[type]}年月。`,
    }
  }
  if (serial === "000") {
    return { status: "invalid", issue: "serial", title: "流水号不合法", detail: "三位流水号须在 001–999 之间。" }
  }
  if (t !== type) {
    const other = t === "S" || t === "E" ? `“${t}” 表示${PERSON_TYPE_LABEL[t as PersonType]}编号，` : ""
    return {
      status: "invalid",
      issue: "type",
      title: "人员类型不符",
      detail: `${other}${PERSON_TYPE_LABEL[type]}编号末位须为 ${type}。`,
    }
  }
  if (isIssued(raw, type)) {
    return {
      status: "invalid",
      issue: "conflict",
      title: "编号已存在",
      detail: `${raw} 已被现有${PERSON_TYPE_LABEL[type]}占用（已发放编号不回收），不能重复使用。`,
    }
  }
  const yyyymm = `${yyyy}${mm}`
  const src = sourceDate ? yyyymmOf(sourceDate) : null
  return { status: "valid", yyyymm, monthMismatch: !!src && src !== yyyymm }
}
