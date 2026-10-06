// 本地真实解析：读取用户选择的 .xlsx / .csv 字节，识别工作表、表头和数据行。
// 不执行宏、公式或外部链接；日期按日历值解释，编号/电话按文本保留。

import * as XLSX from "xlsx"
import { SHEET, SHEETS, SUPPORTED_VERSIONS, type FieldDef, type SheetCode } from "./schema"

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_ROWS_PER_SHEET = 3000

export interface CellNote {
  field: string
  text: string
}

export interface ParsedRow {
  line: number
  values: Record<string, string>
  cols: Record<string, string>
  notes: CellNote[]
  cellErrors: CellNote[]
}

export interface ParsedHeader {
  label: string
  col: string
  field: string | null
}

export interface ParsedSheet {
  rawName: string
  code: SheetCode | null
  recognizedBy: "name" | "header" | null
  headerLine: number
  headers: ParsedHeader[]
  rows: ParsedRow[]
  unknownCols: string[]
  missingRequired: string[]
  empty: boolean
  truncated: boolean
  meta: Record<string, string>
}

export interface ParsedFile {
  source: "file" | "sample"
  sampleId?: string
  fileName: string
  fileType: "xlsx" | "csv"
  size: number
  fingerprint: string
  version: string | null
  versionStatus: "ok" | "missing" | "unsupported"
  sourceSchool: string | null
  sourcePeriod: string | null
  snapshotAt: string | null
  snapshotStatus: "ok" | "missing" | "invalid"
  sheets: ParsedSheet[]
  parsedAt: string
}

const SNAPSHOT_KEYS = ["快照时点", "源快照时间", "导出时间"]

function normalizeSnapshot(raw: string): string | null {
  const m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0))
  if (date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d) || Number(h ?? 0) > 23) return null
  const pad = (n: string | number) => String(n).padStart(2, "0")
  return `${y}-${pad(mo)}-${pad(d)}${h ? ` ${pad(h)}:${mi}` : ""}`
}

export class ParseFailure extends Error {
  constructor(
    public kind: "format" | "size" | "protected" | "corrupt" | "empty",
    message: string,
  ) {
    super(message)
  }
}

const norm = (s: string) => s.replace(/[\s*＊]/g, "").trim()
const matchesHeader = (field: FieldDef, label: string) => [field.label, ...(field.aliases ?? [])].some((name) => norm(name) === norm(label))

function matchByName(raw: string): SheetCode | null {
  const n = norm(raw)
  const m = /^(\d{2})[_\-－.、]?(.*)$/.exec(n)
  if (m) {
    const def = SHEET[m[1] as SheetCode]
    if (def && (m[2] === "" || m[2] === def.name || m[2].includes(def.name) || def.name.includes(m[2]))) return def.code
  }
  const byTitle = SHEETS.find((s) => s.name === n)
  return byTitle ? byTitle.code : null
}

function matchByHeaders(labels: string[]): SheetCode | null {
  const set = new Set(labels.map(norm))
  let best: { code: SheetCode; score: number } | null = null
  for (const s of SHEETS) {
    if (s.role === "meta" || s.role === "instruction") continue
    const required = s.fields.filter((x) => x.required)
    if (required.length === 0) continue
    const hit = required.filter((x) => [...set].some((label) => matchesHeader(x, label))).length
    const score = hit / required.length
    const allHit = s.fields.filter((x) => [...set].some((label) => matchesHeader(x, label))).length
    if (score === 1 && (!best || allHit > best.score)) best = { code: s.code, score: allHit }
  }
  return best?.code ?? null
}

async function fingerprintOf(buf: ArrayBuffer) {
  try {
    const d = await crypto.subtle.digest("SHA-256", buf)
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12)
  } catch {
    return `len${buf.byteLength}`
  }
}

function pad(n: number, w = 2) {
  return String(n).padStart(w, "0")
}

export function isRealDate(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1) return false
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  return d <= days
}

function readCell(cell: XLSX.CellObject | undefined, field: FieldDef | null): { value: string; note?: string; error?: string } {
  if (!cell) return { value: "" }
  const hasFormula = typeof cell.f === "string" && cell.f.length > 0
  if (hasFormula && (cell.v === undefined || cell.v === null)) {
    return { value: "", error: "公式单元格没有可用的缓存值；原型不执行公式，请填写实际值" }
  }
  const formulaNote = hasFormula ? "公式单元格：按文件保存的缓存值读取，未执行公式" : undefined

  if (field?.kind === "date") {
    if (cell.t === "n" && typeof cell.v === "number") {
      const p = XLSX.SSF.parse_date_code(cell.v)
      if (!p || !p.y) return { value: String(cell.v), error: "无法把数值解释为日期" }
      return { value: `${p.y}-${pad(p.m)}-${pad(p.d)}`, note: formulaNote ?? "Excel 日期值，已按日历日期读取（不做时区换算）" }
    }
    if (cell.t === "d" && cell.v instanceof Date) {
      const d = cell.v
      return { value: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, note: formulaNote }
    }
  }

  if (field?.kind === "time" && cell.t === "n" && typeof cell.v === "number" && cell.v < 1) {
    const mins = Math.round(cell.v * 24 * 60)
    return { value: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`, note: formulaNote }
  }

  const textual = field && (field.kind === "id" || field.kind === "personNo" || field.kind === "phone" || field.kind === "ref")
  if (cell.t === "n" && textual) {
    const shown = cell.w != null ? String(cell.w) : String(cell.v)
    return { value: shown.trim(), note: "单元格为数字格式，已按显示文本读取；前导零若已被 Excel 去掉无法还原，建议该列设为文本" }
  }
  if (cell.t === "b") return { value: cell.v ? "是" : "否", note: formulaNote }
  const v = cell.w != null && cell.t !== "s" ? String(cell.w) : cell.v != null ? String(cell.v) : ""
  return { value: v.trim(), note: formulaNote }
}

function readKeyValue(ws: XLSX.WorkSheet): Record<string, string> {
  const out: Record<string, string> = {}
  if (!ws["!ref"]) return out
  const r = XLSX.utils.decode_range(ws["!ref"])
  for (let row = r.s.r; row <= Math.min(r.e.r, 200); row++) {
    const a = ws[XLSX.utils.encode_cell({ r: row, c: 0 })]
    const b = ws[XLSX.utils.encode_cell({ r: row, c: 1 })]
    if (a?.v != null && b?.v != null) out[norm(String(a.v))] = String(b.w ?? b.v).trim()
  }
  return out
}

function parseSheet(rawName: string, ws: XLSX.WorkSheet, csvFallbackName?: string): ParsedSheet {
  const base: ParsedSheet = {
    rawName, code: null, recognizedBy: null, headerLine: 0, headers: [], rows: [], unknownCols: [], missingRequired: [], empty: true, truncated: false, meta: {},
  }
  if (!ws["!ref"]) {
    base.code = matchByName(csvFallbackName ?? rawName)
    base.recognizedBy = base.code ? "name" : null
    return base
  }
  const range = XLSX.utils.decode_range(ws["!ref"])
  const rowLabels = (row: number) => {
    const labels: { label: string; col: number }[] = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: row, c })]
      if (cell?.v != null && String(cell.v).trim() !== "") labels.push({ label: String(cell.v).trim(), col: c })
    }
    return labels
  }

  let code = matchByName(csvFallbackName ?? rawName)
  let recognizedBy: ParsedSheet["recognizedBy"] = code ? "name" : null

  const def = code ? SHEET[code] : null
  if (def && (def.role === "instruction" || def.role === "meta")) {
    return { ...base, code, recognizedBy, empty: false, meta: readKeyValue(ws) }
  }

  let headerRow = range.s.r
  let best = -1
  for (let r = range.s.r; r <= Math.min(range.s.r + 3, range.e.r); r++) {
    const labels = rowLabels(r).map((x) => norm(x.label))
    const candidate = code ?? matchByHeaders(labels)
    const score = candidate ? SHEET[candidate].fields.filter((x) => labels.some((label) => matchesHeader(x, label))).length : 0
    if (score > best) {
      best = score
      headerRow = r
    }
  }
  const headerCells = rowLabels(headerRow)
  if (!code) {
    code = matchByHeaders(headerCells.map((h) => h.label))
    recognizedBy = code ? "header" : null
  }
  const sheetDef = code ? SHEET[code] : null
  const headers: ParsedHeader[] = headerCells.map((h) => {
    const field = sheetDef?.fields.find((x) => matchesHeader(x, h.label)) ?? null
    return { label: h.label, col: XLSX.utils.encode_col(h.col), field: field?.key ?? null }
  })

  const rows: ParsedRow[] = []
  let truncated = false
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const values: Record<string, string> = {}
    const cols: Record<string, string> = {}
    const notes: CellNote[] = []
    const cellErrors: CellNote[] = []
    let any = false
    for (const h of headerCells) {
      const addr = XLSX.utils.encode_cell({ r, c: h.col })
      const fieldDef = sheetDef?.fields.find((x) => matchesHeader(x, h.label)) ?? null
      const res = readCell(ws[addr], fieldDef)
      const key = fieldDef?.key ?? `?${h.label}`
      values[key] = res.value
      cols[key] = addr
      if (res.value !== "" || res.error) any = true
      if (res.note && res.value !== "") notes.push({ field: key, text: res.note })
      if (res.error) cellErrors.push({ field: key, text: res.error })
    }
    if (!any) continue
    if (rows.length >= MAX_ROWS_PER_SHEET) {
      truncated = true
      break
    }
    rows.push({ line: r + 1, values, cols, notes, cellErrors })
  }

  const present = new Set(headers.map((h) => h.field).filter(Boolean))
  return {
    ...base,
    code,
    recognizedBy,
    headerLine: headerRow + 1,
    headers,
    rows,
    unknownCols: sheetDef ? headers.filter((h) => !h.field).map((h) => h.label) : [],
    missingRequired: sheetDef ? sheetDef.fields.filter((x) => x.required && !present.has(x.key)).map((x) => x.label) : [],
    empty: rows.length === 0,
    truncated,
  }
}

function decodeCsvText(buf: ArrayBuffer) {
  const utf8 = new TextDecoder("utf-8").decode(buf)
  if (!utf8.includes("\uFFFD")) return utf8.replace(/^\uFEFF/, "")
  try {
    return new TextDecoder("gb18030").decode(buf)
  } catch {
    return utf8
  }
}

export async function parseWorkbookBuffer(
  buf: ArrayBuffer,
  fileName: string,
  source: ParsedFile["source"] = "file",
  sampleId?: string,
): Promise<ParsedFile> {
  const lower = fileName.toLowerCase()
  const isCsv = lower.endsWith(".csv")
  const isXlsx = lower.endsWith(".xlsx")
  if (!isCsv && !isXlsx) {
    const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "（无扩展名）"
    throw new ParseFailure("format", `不支持 ${ext} 格式。请使用 .xlsx 工作簿（可含多个工作表）或单表 .csv。含宏的 .xlsm 与旧版 .xls 不在原型支持范围。`)
  }
  if (buf.byteLength === 0) throw new ParseFailure("empty", "文件为空（0 字节）。")
  if (buf.byteLength > MAX_FILE_BYTES) {
    throw new ParseFailure("size", `文件 ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB，超过原型本地处理上限 5 MB。请分批拆分工作表后再选择。`)
  }

  let wb: XLSX.WorkBook
  try {
    wb = isCsv
      ? XLSX.read(decodeCsvText(buf), { type: "string", raw: true, cellFormula: false })
      : XLSX.read(buf, { type: "array", cellFormula: true, cellDates: false, cellHTML: false, bookVBA: false, WTF: false })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/password|encrypt|protect/i.test(msg)) throw new ParseFailure("protected", "文件受密码保护或已加密，原型无法读取。请另存为未加密副本。")
    throw new ParseFailure("corrupt", `文件无法解析：${msg.slice(0, 120)}。可能已损坏或不是有效的 ${isCsv ? "CSV" : "XLSX"}。`)
  }

  const csvName = isCsv ? fileName.replace(/\.csv$/i, "") : undefined
  const sheets = wb.SheetNames.map((n) => parseSheet(isCsv ? csvName! : n, wb.Sheets[n], csvName))
  const intro = sheets.find((s) => s.code === "00")?.meta ?? {}
  const refs = sheets.find((s) => s.code === "90")?.meta ?? {}
  const version = intro["模板版本"] ?? refs["模板版本"] ?? null
  const versionStatus: ParsedFile["versionStatus"] = !version ? "missing" : SUPPORTED_VERSIONS.includes(version) ? "ok" : "unsupported"
  const rawSnapshot = (SNAPSHOT_KEYS.map((k) => refs[k] ?? intro[k]).find((v) => v && v.trim()) ?? "").trim()
  const snapshotAt = normalizeSnapshot(rawSnapshot)
  const snapshotStatus: ParsedFile["snapshotStatus"] = !rawSnapshot ? "missing" : snapshotAt ? "ok" : "invalid"

  return {
    source,
    sampleId,
    fileName,
    fileType: isCsv ? "csv" : "xlsx",
    size: buf.byteLength,
    fingerprint: await fingerprintOf(buf),
    version,
    versionStatus,
    sourceSchool: intro["来源学校"] ?? refs["来源学校"] ?? null,
    sourcePeriod: intro["来源期间"] ?? refs["来源期间"] ?? null,
    snapshotAt: snapshotAt ?? (rawSnapshot || null),
    snapshotStatus,
    sheets,
    parsedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  }
}

export async function parseFile(file: File): Promise<ParsedFile> {
  return parseWorkbookBuffer(await file.arrayBuffer(), file.name, "file")
}
