import { checkPersonNo, nextPersonNo, registerIssued, yyyymmOf, type PersonType } from "@/lib/school/person-no"
import { createStaff } from "@/lib/school/staff-store"
import { cleanEducation, cleanWork } from "@/lib/school/staff-background"
import type { Plan, RowResult } from "./validate"

const receipts = new Map<string, { key: string; no: string; id: string; source: string; mapping: string }[]>()
export function commitPeople(plan: Plan, batchId: string, authorized: boolean) {
  if (!authorized) throw new Error("当前身份无权导入人员。")
  let previous = receipts.get(batchId)
  if (!previous && typeof window !== "undefined") {
    try { previous = JSON.parse(window.sessionStorage.getItem(`tgs-proto:import-receipt:${batchId}`) || "null") ?? undefined } catch { /* use memory-only receipt */ }
  }
  if (previous) {
    for (const receipt of previous) {
      const row = plan.sheets.flatMap((sheet) => sheet.rows).find((entry) => entry.key === receipt.key)
      if (row) { row.numberPreview = receipt.no || "待编号"; row.numberSource = receipt.source; row.personId = receipt.id }
    }
    return previous.map((receipt) => receipt.mapping)
  }
  if (plan.totals.block) throw new Error("当前计划仍有阻断问题，请重新校验。")
  const rows = plan.sheets.filter((sheet) => sheet.state === "import" && (sheet.code === "11" || sheet.code === "13")).flatMap((sheet) => sheet.rows.filter((row) => row.status !== "excluded" && !row.reuse))
  const reserved = new Set<string>()
  const prepared: { row: RowResult; type: PersonType; no: string; id: string; source: string }[] = []
  for (const row of rows) {
    const type = row.sheet === "11" ? "E" : "S"
    const no = row.values.no ?? ""
    if (!no.trim()) continue
    const check = checkPersonNo(no, type, row.values.firstDate)
    if (check.status !== "valid" || check.monthMismatch || reserved.has(no)) throw new Error(`第 ${row.line} 行编号已变化、重复或不合法，请返回重新校验。`)
    reserved.add(no)
  }
  for (const row of rows) {
    const type = row.sheet === "11" ? "E" : "S"
    const manual = row.values.no?.trim() ? row.values.no : ""
    const auto = !manual && row.values.numberIntent === "自动生成"
    const no = manual || (auto ? nextPersonNo(type, yyyymmOf(row.values.firstDate ?? "") ?? "", reserved) : "")
    if (no) reserved.add(no)
    prepared.push({ row, type, no, id: `import-${batchId}-${row.sheet}-${row.values.id}`, source: manual ? "手工填写" : auto ? "自动生成" : "暂不编号" })
  }
  // Validate every number before writing any claim or prototype person.
  for (const item of prepared) if (item.no) registerIssued(item.no, item.type, item.id)
  for (const { row, type, no, id, source } of prepared) {
    const v = row.values
    if (type === "E") {
      const refName = (code: string, ref: string) => plan.sheets.find((sheet) => sheet.code === code)?.rows.find((entry) => entry.values.id === ref)?.values.name ?? ref ?? ""
      createStaff({ id, name: v.name, employeeNo: no, department: refName("04", v.dept), jobTitle: refName("05", v.title), gender: "未透露", joinedAt: v.firstDate || undefined, phone: v.phone || "", email: v.email || "", englishName: v.englishName || undefined, educationLevel: v.educationLevel || undefined, firstWorkAt: v.firstWorkAt || undefined,
        educationExperiences: cleanEducation([{ id: `${id}-education`, school: v.school, major: v.major, graduation: v.graduation }]),
        workExperiences: cleanWork([{ id: `${id}-work`, organization: v.organization, role: v.pastRole, start: v.workStart, end: v.workEnd }]),
        status: "active", accountStatus: "none", systemRoles: [], duties: [], history: [],
      })
    }
    row.numberPreview = no || "待编号"
    row.numberSource = source
    row.personId = id
  }
  const receipt = prepared.map(({ row, no, id, source }) => ({ key: row.key, no, id, source, mapping: `源行 ${row.line} · ${row.values.id} → ${id} · ${no || "待编号"} · ${source}` }))
  receipts.set(batchId, receipt)
  try { window.sessionStorage.setItem(`tgs-proto:import-receipt:${batchId}`, JSON.stringify(receipt)) } catch { /* use in-memory receipt */ }
  return receipt.map((item) => item.mapping)
}
