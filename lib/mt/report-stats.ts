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

/** 从单元格显示文本判断是否为 A 系等级。
 * 注意：fact.grade 存的是原始 gradeEff（需经 scheme 映射），不能直接比对；
 * 显示文本才是家长看到的等级代码（如 A / A+ / 优秀）。 */
export const isAGradeText = (text: string) => {
  const t = (text ?? '').trim()
  return /^a[+\-*/]?$/i.test(t) || t === '优秀'
}
export const isEmptyCell = (text: string) => {
  const t = (text ?? '').trim()
  return !t || t === '–' || t === '-'
}

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
    matrix.facts.forEach((row, ri) => {
      for (let c = 1; c < row.length; c++) {
        const f = row[c]
        if (!f) continue
        if (f.field === 'attendance' && f.status) {
          stats.attTotal++
          if (f.status === 'NORMAL') stats.attNormal++
        } else if (f.field === 'classroom') {
          const text = matrix.rows[ri]?.[c] ?? ''
          if (!isEmptyCell(text)) {
            stats.clsTotal++
            if (isAGradeText(text)) stats.clsA++
          }
        } else if (f.field === 'quality') {
          stats.hwTotal++
          stats.hwDone++
        } else if (f.field === 'submission') {
          stats.hwTotal++
        }
      }
    })
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

/** 课堂等级分布（显示文本 → 人次），供仪表盘条形图 */
export function gradeDistribution(r: FrozenReport): { grade: string; count: number }[] {
  const table = (r.tables ?? []).find(t => t.kind === 'classroom' && t.facts?.length)
  const counts = new Map<string, number>()
  if (table?.facts) {
    table.facts.forEach((row, ri) => {
      row.forEach((f, ci) => {
        if (f?.field !== 'classroom') return
        const text = (table.rows[ri]?.[ci] ?? '').trim()
        if (isEmptyCell(text)) return
        counts.set(text, (counts.get(text) ?? 0) + 1)
      })
    })
  }
  const order = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', '优秀', '良好']
  return [...counts.entries()]
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => {
      const ai = order.indexOf(a.grade), bi = order.indexOf(b.grade)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
}

export type StudentSummary = { name: string; attendance: string; classroom: string; homework: string }
/** 按学生汇总：出勤 / 课堂 / 作业（一人一行，供三卡片折叠表与仪表盘） */
export function studentSummaries(r: FrozenReport): StudentSummary[] {
  const table = (r.tables ?? []).find(t => t.kind === 'classroom')
  if (!table) return []
  const fields = table.fields ?? []
  const colDate = new Map<number, string>()
  dayGroups(table).forEach(g => {
    const m = g.label.match(/(\d+\/\d+)/)
    g.columns.forEach(c => colDate.set(c, m ? m[1] : g.label))
  })
  return table.rows.map(row => {
    const att: string[] = [], cls: string[] = [], hw: string[] = []
    row.forEach((cell, ci) => {
      const f = fields[ci]
      const text = (cell ?? '').trim()
      if (isEmptyCell(text)) return
      if (f === 'attendance') {
        if (text !== '正常') att.push(`${text}${colDate.get(ci) ? `(${colDate.get(ci)})` : ''}`)
      } else if (f === 'classroom') cls.push(text)
      else if (f === 'quality' || f === 'submission') hw.push(text)
    })
    return {
      name: row[0],
      attendance: att.length ? att.join('、') : '正常',
      classroom: cls.length ? cls.join(' / ') : '–',
      homework: hw.length ? hw.join(' / ') : '–',
    }
  })
}

export type Highlight = { name: string; reason: string }
/** "姓名：事由" → 结构化，供高光之星与徽章墙 */
export function parseHighlights(r: FrozenReport): Highlight[] {
  const lines = visibleBlocks(r).filter(b => b.key === 'highlights').flatMap(b => b.lines).map(s => s.trim()).filter(Boolean)
  return lines.map(line => {
    const m = line.match(/^(.{2,8}?)[：:](.+)$/)
    return m ? { name: m[1].trim(), reason: m[2].trim() } : { name: '', reason: line }
  }).filter(h => h.reason)
}

/** 从教学介绍提取 "第 X 章 · 主题" */
export function extractChapter(r: FrozenReport): string | null {
  const text = visibleBlocks(r).filter(b => b.key === 'teaching').flatMap(b => b.lines).join(' ')
  const m = text.match(/第\s*([0-9一二三四五六七八九十百]+)\s*章\s*([^，。；,;（(]{2,14})/)
  return m ? `第 ${m[1]} 章 · ${m[2].trim()}` : null
}

/** 尽力提取知识点 chips；提不到就返回空数组（调用方隐藏 chips 行） */
export function extractChips(r: FrozenReport): string[] {
  const text = visibleBlocks(r).filter(b => b.key === 'teaching').flatMap(b => b.lines).join(' ')
  const m = text.match(/(?:包括|包含)[:：]?(.+?)[。；;]/)
  if (!m) return []
  const chips = m[1].split(/[，、]/).map(s =>
    s.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').replace(/向量(的)?/g, '').trim()
  ).filter(s => s.length >= 2 && s.length <= 8)
  return [...new Set(chips)].slice(0, 5)
}

export type FollowUps = { homework: string[]; leave: string[] }
export function followUps(r: FrozenReport): FollowUps {
  const table = (r.tables ?? []).find(t => t.kind === 'classroom' && t.facts?.length)
  const homework: string[] = [], leave: string[] = []
  if (!table?.facts) return { homework, leave }
  const names = table.rows.map(row => row[0])
  const colDate = new Map<number, string>()
  dayGroups(table).forEach(g => {
    const m = g.label.match(/(\d+\/\d+)/)
    g.columns.forEach(c => colDate.set(c, m ? m[1] : ''))
  })
  const ATT: Record<string, string> = { LEAVE: '请假', LATE: '迟到', EARLY_LEAVE: '早退', ABSENT: '缺勤', ELSEWHERE: '在他班' }
  table.facts.forEach((row, ri) => {
    row.forEach((f, ci) => {
      if (!f) return
      const date = colDate.get(ci) ?? ''
      if (f.field === 'submission' && f.status === 'MISSING_CONFIRMED') homework.push(`${names[ri]}${date ? `(${date})` : ''}`)
      if (f.field === 'attendance' && f.status && f.status !== 'NORMAL' && ATT[f.status]) leave.push(`${names[ri]}${ATT[f.status]}${date ? `(${date})` : ''}`)
    })
  })
  return { homework: [...new Set(homework)], leave: [...new Set(leave)] }
}

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

const GRADE_PCT: Record<string, number> = { 'A+': 100, A: 90, 'A-': 80, 'B+': 70, B: 60, 'B-': 50, C: 40 }
const gradePctOf = (g: string) => GRADE_PCT[g.trim()] ?? (isAGradeText(g) ? 90 : 50)
const modeStr = (arr: string[]) => {
  const c = new Map<string, number>()
  arr.forEach(x => c.set(x, (c.get(x) ?? 0) + 1))
  let best = '', n = 0
  c.forEach((v, k) => { if (v > n) { n = v; best = k } })
  return best
}

export type PersonalDim = { label: string; value: string; pct: number }
/** 个人成长档案四维（对标参考设计）：课堂专注度 / 课堂参与度 / 作业质量 / 出勤 */
export function personalDims(r: FrozenReport): PersonalDim[] {
  const dims: PersonalDim[] = []
  const ct = (r.tables ?? []).find(t => t.kind === 'classroom')
  let focusGrade = ''
  let attDim: PersonalDim | null = null
  if (ct) {
    let ab = 0, tot = 0
    const grades: string[] = []
    ct.rows.forEach(row => {
      const a = (row[1] ?? '').trim()
      if (a && !isEmptyCell(a)) { tot++; if (a !== '正常') ab++ }
      const g = (row[2] ?? '').trim()
      if (g && !isEmptyCell(g)) grades.push(g)
    })
    focusGrade = modeStr(grades)
    if (tot) attDim = { label: '出勤', value: ab ? `异常 ${ab} 次` : '全勤', pct: Math.round(((tot - ab) / tot) * 100) }
  }
  if (focusGrade) dims.push({ label: '课堂专注度', value: focusGrade, pct: gradePctOf(focusGrade) })
  // 课堂参与度：本周被表扬过 → 本周突出，否则沿用专注度等级
  const me = (r.name || '').trim()
  const starred = !!me && parseHighlights(r).some(h => h.name && (me.includes(h.name) || h.name.includes(me)))
  if (starred) dims.push({ label: '课堂参与度', value: '本周突出', pct: 100 })
  else if (focusGrade) dims.push({ label: '课堂参与度', value: focusGrade, pct: gradePctOf(focusGrade) })
  // 作业质量：取作业表末列等级众数
  const hwTables = (r.tables ?? []).filter(t => t.kind === 'homework')
  const quals = hwTables.flatMap(t => t.rows.map(row => (row[row.length - 1] ?? '').trim())).filter(g => /^[A-E][+-]?$/.test(g))
  const qm = modeStr(quals)
  if (qm) dims.push({ label: '作业质量', value: qm, pct: gradePctOf(qm) })
  else {
    const total = hwTables.reduce((n, t) => n + t.rows.length, 0)
    const missing = hwTables.flatMap(t => t.rows).filter(row => row.join(' ').includes('未交')).length
    if (total) dims.push({ label: '作业质量', value: missing ? `${missing} 次未交` : '全部提交', pct: Math.round(((total - missing) / total) * 100) })
  }
  if (attDim) dims.push(attDim)
  return dims
}
