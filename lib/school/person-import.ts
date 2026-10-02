// 人员批量导入：编号列可选，与单条新增共用 person-no.ts 的同一套规则。
// - 有值：必须是新格式且未被占用、批次内唯一；旧格式一律拒绝。
// - 为空：预览阶段只标记“正式导入时自动生成”，不预占流水号；正式导入时才分配。
// - 本流程只创建新人员，不会把某一行绑定或覆盖到已有人员。

import { CURRENT_SCHOOL } from "./instance"
import { checkPersonNo, isIssued, nextPersonNo, registerIssued, yyyymmOf, type PersonType } from "./person-no"

export interface ImportRow {
  id: string
  line: number // 对应文件中的行号（第 1 行为表头）
  name: string
  date: string // 学生：首次正式入学日期；教职工：首次正式入职日期
  group: string // 学生：行政班；教职工：部门
  no: string // 当前（已验证）的编号值，"" 表示自动编号
  originalNo: string // 文件中的原始值，用于标记“已修正”
}

export type RowCheck =
  | { kind: "auto"; yyyymm: string | null }
  | { kind: "ok"; warning?: string }
  | { kind: "error"; title: string; detail: string; relatedLines?: number[] }

export interface ImportResult {
  line: number
  name: string
  group: string
  no: string
  source: "user" | "system"
}

const SCHOOL = CURRENT_SCHOOL.code

// 旧编号格式（历史学号 TG + 入学年月 + 年级段 + 序号；历史工号 EMP + 数字）
const LEGACY_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /^TG\d{6}G\d{5}$/, label: "旧学号格式" },
  { re: /^EMP\d{3,}$/, label: "旧工号格式" },
]

function legacyLabel(raw: string) {
  return LEGACY_PATTERNS.find((p) => p.re.test(raw))?.label ?? null
}

export function checkRows(rows: ImportRow[], type: PersonType): Map<string, RowCheck> {
  const result = new Map<string, RowCheck>()
  const okByNo = new Map<string, ImportRow[]>()

  for (const r of rows) {
    if (r.no === "") {
      const yyyymm = yyyymmOf(r.date)
      result.set(
        r.id,
        yyyymm
          ? { kind: "auto", yyyymm }
          : {
              kind: "error",
              title: `缺少首次正式${type === "S" ? "入学" : "入职"}日期`,
              detail: `编号留空时须按首次正式${type === "S" ? "入学" : "入职"}年月自动生成，请补充日期或填写符合 ${SCHOOL} + 年月 + 三位流水号 + ${type} 的编号。`,
            },
      )
      continue
    }
    const legacy = legacyLabel(r.no)
    if (legacy) {
      result.set(r.id, {
        kind: "error",
        title: "旧格式编号",
        detail: `${r.no} 为${legacy}。新导入数据不再接受旧格式作为正式编号，须为 ${SCHOOL} + 年月 + 三位流水号 + ${type}。`,
      })
      continue
    }
    const c = checkPersonNo(r.no, type, r.date)
    if (c.status === "invalid") {
      result.set(r.id, { kind: "error", title: c.title, detail: c.detail })
      continue
    }
    if (c.status === "valid") {
      const list = okByNo.get(r.no) ?? []
      list.push(r)
      okByNo.set(r.no, list)
      result.set(r.id, {
        kind: "ok",
        warning: c.monthMismatch
          ? `编号年月与${type === "S" ? "入学" : "入职"}日期（${r.date.slice(0, 7)}）不一致，请确认。`
          : undefined,
      })
    }
  }

  for (const [no, list] of okByNo) {
    if (list.length < 2) continue
    for (const r of list) {
      const others = list.filter((o) => o.id !== r.id).map((o) => o.line)
      result.set(r.id, {
        kind: "error",
        title: "文件内编号重复",
        detail: `与第 ${others.join("、")} 行使用相同编号 ${no}。一个编号只能属于一个人。`,
        relatedLines: others,
      })
    }
  }
  return result
}

// 正式导入：先登记用户提供的编号，再按行序为空编号行分配流水号，避免自动号撞上本批次手工号
export function commitRows(rows: ImportRow[], type: PersonType): ImportResult[] {
  const provided = rows.filter((r) => r.no !== "")
  for (const r of provided) {
    if (isIssued(r.no, type)) throw new Error(`${r.no} 已被占用`)
    registerIssued(r.no, type)
  }
  return rows.map((r) => {
    if (r.no !== "") return { line: r.line, name: r.name, group: r.group, no: r.no, source: "user" as const }
    const yyyymm = yyyymmOf(r.date)
    if (!yyyymm) throw new Error(`第 ${r.line} 行缺少首次正式日期`)
    const no = nextPersonNo(type, yyyymm)
    registerIssued(no, type)
    return { line: r.line, name: r.name, group: r.group, no, source: "system" as const }
  })
}

/* ---------------- 示例文件（混合场景） ---------------- */

type Seed = [name: string, date: string, group: string, no: string]

const STUDENT_SEED: Seed[] = [
  ["林予安", "2026-09-01", "高一1班", `${SCHOOL}202609088S`],
  ["陈思远", "2026-09-01", "高一1班", ""],
  ["周亦涵", "2023-09-01", "高一2班", "TG202309G10018"],
  ["何嘉禾", "2026-09-01", "高一2班", "ABC2026090088S"],
  ["许星辰", "2026-09-01", "高一1班", `${SCHOOL}202609088E`],
  ["苏沐阳", "2026-09-01", "高一2班", `${SCHOOL}202613088S`],
  ["顾清和", "2026-09-01", "高一1班", `${SCHOOL}202609028S`],
  ["叶知秋", "2026-09-01", "高一2班", `${SCHOOL}202609088S`],
  ["沈若溪", "2026-09-01", "高一1班", ""],
  ["唐一鸣", "2026-09-01", "高一2班", `${SCHOOL}202609090S`],
]

const STAFF_SEED: Seed[] = [
  ["郑书澜", "2026-08-20", "数学组", `${SCHOOL}202608012E`],
  ["方启明", "2026-08-20", "英语组", ""],
  ["吴静姝", "2019-09-01", "物理组", "EMP20190012"],
  ["罗晓峰", "2026-08-20", "教务处", "ABC2026080013E"],
  ["韩雨桐", "2026-08-20", "化学组", `${SCHOOL}202608014S`],
  ["邱子墨", "2026-08-20", "生物组", `${SCHOOL}202600015E`],
  ["杜若衡", "2026-08-20", "数学组", `${SCHOOL}202109001E`],
  ["蒋明远", "2026-08-20", "英语组", `${SCHOOL}202608012E`],
  ["白芷兰", "2026-09-01", "学生处", ""],
]

export const SAMPLE_FILE: Record<PersonType, { fileName: string; rows: Seed[] }> = {
  S: { fileName: "2026秋季新生名单.xlsx", rows: STUDENT_SEED },
  E: { fileName: "2026秋季新入职教职工.xlsx", rows: STAFF_SEED },
}

export function sampleRows(type: PersonType): ImportRow[] {
  return SAMPLE_FILE[type].rows.map(([name, date, group, no], i) => ({
    id: `${type}-${i}`,
    line: i + 2,
    name,
    date,
    group,
    no,
    originalNo: no,
  }))
}
