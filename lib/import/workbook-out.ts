// 生成可打开、可被本原型重新读取的真实 XLSX（原型格式，不是正式后台模板）。

import * as XLSX from "xlsx"
import type { ParsedFile } from "./parse"
import type { SampleData } from "./samples"
import { SHEET, sheetTitle, TEMPLATE_VERSION, type SheetCode } from "./schema"
import type { Plan } from "./validate"

const headerOf = (code: SheetCode) => SHEET[code].fields.map((f) => (f.required ? `${f.label}*` : f.label))

function textSheet(aoa: string[][]) {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  // 所有单元格按文本写出，保证编号、电话、日期在 Excel 中不被改写
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith("!")) continue
    const c = ws[addr] as XLSX.CellObject
    c.t = "s"
    c.z = "@"
  }
  ws["!cols"] = aoa[0]?.map((h) => ({ wch: Math.max(10, String(h).length * 2 + 2) }))
  return ws
}

function introSheet(purpose: string, extra: Record<string, string> = {}) {
  const rows: string[][] = [
    ["项目", "内容"],
    ["模板版本", TEMPLATE_VERSION],
    ["用途", purpose],
    ["说明", "原型格式：可被本原型读取与校验，不是已适配正式后台的模板。"],
    ["日期格式", "YYYY-MM-DD（按文本填写）"],
    ["编号与联系字段", "导入标识、员工/学生编号、电话均按文本；编号留空默认待编号，明确选择自动生成才发号。背景时间保留年份或年月精度"],
    ["多表规则", "XLSX 可含多个工作表，未填写的表可删除或留空；CSV 只含一类数据"],
    ["授权提示", "参考选项与元数据不是授权；资格与任命须由有权者合法办理"],
    ...Object.entries(extra),
  ]
  return textSheet(rows)
}

export function buildWorkbookBytes(data: SampleData, purpose: string, info: Record<string, string> = {}): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const intro = introSheet(purpose, { 来源学校: "示例国际课程学校（合成）", 来源期间: "2026—2027学年 第一学期", ...info })
  if (info["模板版本"]) {
    XLSX.utils.sheet_add_aoa(intro, [["模板版本", info["模板版本"]]], { origin: "A2" })
  }
  XLSX.utils.book_append_sheet(wb, intro, sheetTitle("00"))
  for (const code of Object.keys(data).sort() as SheetCode[]) {
    const rows = data[code]
    if (!rows) continue
    const def = SHEET[code]
    const aoa = [headerOf(code), ...rows.map((r) => def.fields.map((f) => r[f.key] ?? ""))]
    XLSX.utils.book_append_sheet(wb, textSheet(aoa), sheetTitle(code))
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer
}

export function buildTemplateBytes(codes: SheetCode[]): ArrayBuffer {
  const empty: SampleData = Object.fromEntries(codes.map((c) => [c, []]))
  return buildWorkbookBytes(empty, `空白模板结构：${codes.map(sheetTitle).join("、")}`)
}

export function buildCsvTemplate(code: SheetCode): Blob {
  const csv = headerOf(code).join(",") + "\n"
  return new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
}

export function buildCorrectedCopy(file: ParsedFile, plan: Plan): ArrayBuffer {
  const data: SampleData = {}
  for (const s of plan.sheets) {
    if (s.state !== "import") continue
    data[s.code] = s.rows.filter((r) => r.status !== "excluded").map((r) => ({ ...r.values }))
  }
  return buildWorkbookBytes(data, `修正副本：来自「${file.fileName}」，含本批修正与排除，原文件未被改写`)
}

export function buildReportBytes(file: ParsedFile, plan: Plan): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const summary = [
    ["项目", "内容"],
    ["报告类型", "文件内校验报告（本地生成，不代表已写入学校）"],
    ["来源文件", file.fileName],
    ["来源", file.source === "sample" ? "载入示例" : "用户选择的本地文件"],
    ["解析时间", file.parsedAt],
    ["内容指纹", file.fingerprint],
    ["拟新增对象", String(plan.totals.newObjects)],
    ["拟新增关系", String(plan.totals.newRelations)],
    ["复用/引用已有", String(plan.totals.reuse + plan.totals.externalRefs)],
    ["阻断", String(plan.totals.block)],
    ["待后端核验", String(plan.totals.pending)],
    ["提醒", String(plan.totals.warn)],
  ]
  XLSX.utils.book_append_sheet(wb, textSheet(summary), "摘要")
  const issues: string[][] = [["工作表", "源行", "单元格", "字段", "级别", "问题", "说明"]]
  const lv = { block: "阻断", pending: "待核验", warn: "提醒" }
  for (const i of plan.fileIssues) issues.push(["文件", "", "", "", lv[i.level], i.title, i.detail])
  for (const s of plan.sheets) {
    for (const i of s.sheetIssues) issues.push([sheetTitle(s.code), "", "", "", lv[i.level], i.title, i.detail])
    for (const r of s.rows) for (const i of r.issues) issues.push([sheetTitle(s.code), String(r.line), i.cell ?? "", i.fieldLabel ?? "", lv[i.level], i.title, i.detail])
  }
  XLSX.utils.book_append_sheet(wb, textSheet(issues), "问题清单")
  const mapping: string[][] = [["工作表", "源行", "导入标识", "姓名/名称", "拟操作", "预览编号（不占号）"]]
  for (const s of plan.sheets) {
    for (const r of s.rows) mapping.push([sheetTitle(s.code), String(r.line), r.values.id ?? "", r.values.name ?? "", r.action, r.numberPreview ?? ""])
  }
  XLSX.utils.book_append_sheet(wb, textSheet(mapping), "拟操作与编号映射")
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer
}

export function buildAoaBytes(sheets: { name: string; rows: string[][] }[]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, textSheet(s.rows), s.name.slice(0, 31))
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer
}

export function downloadBytes(bytes: ArrayBuffer | Blob, fileName: string) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
