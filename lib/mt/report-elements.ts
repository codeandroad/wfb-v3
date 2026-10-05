import { visibleBlocks, type FrozenReport, type ReportTable } from './reports'
import { reportOptions } from './report-options'
import { DEFAULT_METADATA, FIELDS, type MetadataRow } from './report-customization'

export function visibleMetadataRows(r: FrozenReport): MetadataRow[] {
  return (r.template.customization?.metadata ?? DEFAULT_METADATA).filter(row => row.visible !== false)
}

export function classicMetadata(r: FrozenReport) {
  const scope = r.scope.replace(/\s*[（(]整科[）)]/g, '')
  const values = { period: r.period, scope: r.kind === 'class' ? scope : `${r.name} · ${scope}`, teacher: r.teacher }
  return visibleMetadataRows(r).map(row => row.source === 'custom' ? `${row.label}${row.label && row.text ? '：' : ''}${row.text ?? ''}` : values[row.source])
}

export function classicNotes(r: FrozenReport) {
  const o = reportOptions(r.template)
  const blocks = visibleBlocks(r).filter(b => ['teaching', 'learning', ...(r.kind === 'personal' ? ['comment', 'next'] : [])].includes(b.key)).map(b => ({ ...b, title: b.key === 'teaching' ? o.teachingTitle : b.key === 'learning' ? o.learningTitle : b.title, lines: [...b.lines] }))
  const highlights = visibleBlocks(r).filter(b => b.key === 'highlights').flatMap(b => b.lines).filter(x => x.trim())
  if (highlights.length && o.highlightPlacement !== 'off') {
    const grouped = new Map<string, string[]>()
    for (const text of highlights) {
      const match = r.kind === 'class' ? text.match(/^([^：:]+)[：:]\s*([\s\S]*)$/) : null
      const name = match?.[1] ?? ''
      grouped.set(name, [...(grouped.get(name) ?? []), match?.[2] ?? text])
    }
    blocks.push({ key: 'highlights', title: '亮点', lines: [...grouped].map(([name, items]) => `${name ? `${name}：` : ''}${[...new Set(items)].join('；')}`) })
  }
  return blocks.filter(b => b.lines.some(x => x.trim()))
}

export function cellKind(table: ReportTable, col: number) {
  return table.columnKinds?.[col] ?? (table.kind === 'classroom' && ['quality', 'submission'].includes(table.fields?.[col] ?? '') ? 'homework' : table.kind ?? 'classroom')
}

export function cellTarget(table: ReportTable, col: number, part: 'header' | 'body', field?: string) {
  return `${cellKind(table, col)}.${field ?? table.fields?.[col] ?? (col === 0 ? 'name' : 'body')}.${part}`
}

export function tableHeaders(table: ReportTable) {
  const occupied = new Set<number>()
  return table.headers.flatMap((row, index) => {
    let col = 0
    return row.map(header => {
      while (index > 0 && occupied.has(col)) col++
      const start = col, span = header.span ?? 1
      const field = header.field ?? (index === 0 && table.headers.length > 1 && col > 0 ? 'date' : table.fields?.[col] ?? (col === 0 ? 'name' : 'body'))
      if ((header.rowSpan ?? 1) > 1) for (let i = 0; i < span; i++) occupied.add(col + i)
      col += span
      return { header, col: start, field, row: index, target: cellTarget(table, start, 'header', field) }
    })
  })
}

export function reportElementTargets(r?: FrozenReport): [string, string][] {
  if (!r) return []
  const targets = new Map<string, string>()
  const add = (key: string, label: string) => targets.set(key, label)
  const names: Record<string, string> = { classroom: '课堂表', homework: '作业栏', lessons: '课次明细', focus: '关注与建议' }
  const fieldLabel = (field: string) => FIELDS[field as keyof typeof FIELDS] ?? field
  const label = (table: ReportTable, col: number, field: string, part: string) => `${names[cellKind(table, col)]} · ${fieldLabel(field)} · ${part}`
  const rows = visibleMetadataRows(r)
  if (rows.length) add('metadata', '元信息 · 共同默认样式')
  rows.forEach(row => add(`metadata.${row.id}`, `元信息 · ${row.label}`))
  const tables = r.tables ?? [], mainCount = r.kind === 'personal' ? tables.length : tables.filter(t => t.kind === 'classroom').length
  for (const table of tables) {
    if (r.kind === 'personal' || table.kind !== 'classroom' || mainCount > 1) add(`${table.kind}.title`, `${names[table.kind ?? 'classroom']} · 模块标题`)
    for (const { header, col, field, target } of tableHeaders(table)) {
      add(target, label(table, col, field, '表头'))
      if (header.assignmentName) add('homework.assignment.body', '作业栏 · 作业名称小字')
    }
    table.fields?.forEach((field, col) => add(cellTarget(table, col, 'body'), label(table, col, field, '正文')))
    table.facts?.forEach(row => row.forEach((fact, col) => {
      if (!fact) return
      if (!fact.parts) add(cellTarget(table, col, 'body', fact.field), label(table, col, fact.field, '正文'))
      fact.parts?.forEach(part => {
        if (part.fact && part.text.trim()) add(cellTarget(table, col, 'body', part.fact.field), label(table, col, part.fact.field, '正文'))
      })
    }))
  }
  for (const block of classicNotes(r)) {
    add(`${block.key}.title`, `${block.title} · 标题`)
    add(`${block.key}.body`, `${block.title} · 正文`)
  }
  const preset = r.template.preset ?? r.template.id
  if (preset === 'C16') {
    add('newspaper.masthead', '报纸 · 报头标题')
    add('newspaper.headline', '报纸 · 头版头条标题')
    add('newspaper.section', '报纸 · 栏目')
  }
  if (preset === 'P11') {
    add('growth.name', '档案 · 姓名标题')
    add('growth.dim', '档案 · 维度')
    add('growth.note', '档案 · 点评')
  }
  return [...targets]
}
