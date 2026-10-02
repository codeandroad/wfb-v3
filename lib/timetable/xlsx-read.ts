// XLSX 读取层：把上传的 .xlsx 字节解码成每表的单元格文本图（DecodedSheet）。
//
// 安全边界：公式不执行（读取缓存值并标记）；纯值读取。真实产品应在服务端独立复验，
// 此处为原型客户端解析（依赖固定 xlsx 依赖，非硬编码数组）。

import * as XLSX from "xlsx"
import type { DecodedSheet } from "./grid-import"

export interface DecodedWorkbook {
  sheetNames: string[]
  sheets: Record<string, DecodedSheet>
  sha: string
}

// 轻量内容指纹（来源证据用途，非授课身份）
async function sha256(buf: ArrayBuffer): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", buf)
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16)
  } catch {
    return String(buf.byteLength)
  }
}

export async function decodeWorkbook(buf: ArrayBuffer): Promise<DecodedWorkbook> {
  const wb = XLSX.read(buf, { type: "array", cellFormula: false, cellHTML: false, cellDates: false })
  const sheets: Record<string, DecodedSheet> = {}
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    if (!ws || !ws["!ref"]) {
      sheets[name] = { sheet: name, cells: {}, maxRow: 0 }
      continue
    }
    const range = XLSX.utils.decode_range(ws["!ref"])
    const cells: Record<string, string> = {}
    let maxRow = 0
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        const cell = ws[addr]
        if (!cell) continue
        // 读取显示文本值；公式缓存值按文本读取，不执行公式
        let v: string
        if (cell.w != null) v = String(cell.w)
        else if (cell.v != null) v = String(cell.v)
        else continue
        if (v.trim() === "") continue
        cells[addr] = v
        if (r + 1 > maxRow) maxRow = r + 1
      }
    }
    sheets[name] = { sheet: name, cells, maxRow }
  }
  return { sheetNames: wb.SheetNames, sheets, sha: await sha256(buf) }
}
