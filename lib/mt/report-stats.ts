import { visibleBlocks, type FrozenReport, type ReportTable } from './reports'

export type MatrixStats = {
  students: number
  /** 出勤正常人次 / 出勤记录总人次 */
  attNormal: number
  attTotal: number
  /** 课堂 A/A* 人次 / 课堂评价总人次 */
  clsA: number
  clsTotal: number
  /** 作业已提交份数 / 作业总份数 */
  hwDone: number
  hwTotal: number
  /** 亮点表扬条数 */
  highlights: number
}

const EMPTY: MatrixStats = { students: 0, attNormal: 0, attTotal: 0, clsA: 0, clsTotal: 0, hwDone: 0, hwTotal: 0, highlights: 0 }

/**
 * 从报告的数据表（classicMatrix）的结构化 facts 计算仪表盘指标。
 * facts 语义（见 report-classic-data.ts）：
 * - field 'attendance' + status: 出勤状态（NORMAL=正常）
 * - field 'classroom' + grade: 课堂等级（A/A* 为优秀）
 * - field 'quality': 作业已提交（含待评价）；field 'submission' + status MISSING_CONFIRMED: 确认未交
 */
export function computeStats(r: FrozenReport): MatrixStats {
  const tables = r.tables ?? []
  const matrix = tables.find(t => t.kind === 'classroom' && t.facts?.length)
  const stats: MatrixStats = { ...EMPTY }
  if (matrix?.facts) {
    stats.students = matrix.rows.length
    for (const row of matrix.facts) {
      for (let c = 1; c < row.length; c++) {
        const f = row[c]
        if (!f) continue
        if (f.field === 'attendance' && f.status) {
          stats.attTotal++
          if (f.status === 'NORMAL') stats.attNormal++
        } else if (f.field === 'classroom' && f.grade) {
          stats.clsTotal++
          if (String(f.grade).replace('*', '').startsWith('A')) stats.clsA++
        } else if (f.field === 'quality') {
          stats.hwTotal++
          stats.hwDone++
        } else if (f.field === 'submission') {
          stats.hwTotal++
        }
      }
    }
  } else if (tables.length) {
    stats.students = tables[0].rows.length
  }
  stats.highlights = visibleBlocks(r)
    .filter(b => b.key === 'highlights')
    .flatMap(b => b.lines).filter(x => x.trim()).length
  return stats
}

export const pct = (n: number, d: number): string | null =>
  d > 0 ? `${Math.round((n / d) * 100)}%` : null

/** 供时间轴使用：从课堂矩阵表头还原按日期分组的列事件 */
export type DayGroup = { label: string; kind: 'day' | 'homework'; columns: number[] }
export function dayGroups(table: ReportTable): DayGroup[] {
  const top = table.headers[0] ?? []
  const identity = table.identityColumns ?? 1
  const groups: DayGroup[] = []
  let col = identity
  for (const h of top.slice(identity)) {
    const span = h.span ?? 1
    const isHomework = (h.field === 'assignment') || /作业/.test(h.text)
    groups.push({
      label: h.text.replace(/\n/g, ' '),
      kind: isHomework ? 'homework' : 'day',
      columns: Array.from({ length: span }, (_, i) => col + i),
    })
    col += span
  }
  return groups
}
