import { type FrozenReport } from './reports'
import { dayGroups } from './report-stats'
import {
  makeCanvasKit, roundRectPath, paintHeaderBand, paintFooter, paintDataTable,
  composeLongImage, reportTables, INK, MUTED, CARD_BG, PRIMARY, type Paint,
} from './report-canvas-shared'
import { colorValue } from './report-customization'

const ATT_TXT: Record<string, string> = { NORMAL: '正常', LEAVE: '请假', LATE: '迟到', EARLY_LEAVE: '早退', ABSENT: '缺勤', ELSEWHERE: '在他班' }

type Node = { label: string; sub?: string; lines: string[] }

/** 与 HTML 时间轴同一数据源：个人取按天行，班级取矩阵日期列组 */
function timelineNodes(r: FrozenReport): Node[] {
  const nodes: Node[] = []
  if (r.kind === 'personal') {
    for (const t of (r.tables ?? []).filter(t => t.kind === 'classroom')) {
      t.rows.forEach(row => nodes.push({ label: row[0] || '', lines: [`出勤：${row[1] || '–'}`, `课堂：${row[2] || '–'}`] }))
    }
    for (const t of (r.tables ?? []).filter(t => t.kind === 'homework')) {
      t.rows.forEach(row => nodes.push({ label: row[1] || row[0] || '', sub: '作业', lines: [row.slice(2).filter(Boolean).join(' · ') || '–'] }))
    }
    return nodes
  }
  const table = (r.tables ?? []).find(t => t.kind === 'classroom' && t.facts?.length)
  if (!table?.facts) return nodes
  const names = table.rows.map(row => row[0])
  for (const g of dayGroups(table)) {
    if (g.kind === 'homework') {
      let done = 0, total = 0
      table.facts.forEach(row => {
        const f = row[g.columns[0]]
        if (f && (f.field === 'quality' || f.field === 'submission')) { total++; if (f.field === 'quality') done++ }
      })
      nodes.push({ label: g.label, sub: '作业', lines: [`共 ${total} 人 · 已交 ${done} 人`] })
      continue
    }
    const abnormal: string[] = [], stars: string[] = []
    let normal = 0, attTotal = 0
    table.facts.forEach((row, i) => {
      const att = row[g.columns[0]], cls = row[g.columns[1]]
      if (att?.field === 'attendance' && att.status) {
        attTotal++
        if (att.status === 'NORMAL') normal++
        else abnormal.push(`${names[i]}${ATT_TXT[att.status] ?? ''}`)
      }
      if (cls?.field === 'classroom' && cls.grade && String(cls.grade).replace('*', '').startsWith('A')) stars.push(names[i])
    })
    const lines = [`出勤 ${normal}/${attTotal} 正常${abnormal.length ? `（${abnormal.join('、')}）` : ''}`]
    if (stars.length) lines.push(`课堂之星：${stars.join('、')}`)
    nodes.push({ label: g.label, lines })
  }
  return nodes
}

/** C13 时间轴周报 / P11 成长档案：纵向时间轴 + 数据表 */
export function renderTimelineImages(r: FrozenReport, version = '未发布预览稿'): string[] {
  const width = 1080, margin = 48, gap = 28
  const kit = makeCanvasKit(r)
  const { font, wrap } = kit
  const cardW = width - margin * 2
  const accent = r.template.color ?? PRIMARY
  const nodes = timelineNodes(r)

  const lineX = 14, cardX = 48, nodeW = cardW - cardX
  const nodePaints = nodes.map(n => {
    const titleH = 20 * 1.4 + 12
    const lineHs = n.lines.flatMap(l => wrap(l, nodeW - 56, 16))
    const height = 28 + titleH + lineHs.length * 16 * 1.6 + 28
    const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      roundRectPath(ctx, x, y, nodeW, height, 18)
      ctx.fillStyle = CARD_BG; ctx.fill()
      ctx.strokeStyle = '#e2eae6'; ctx.lineWidth = 2; ctx.stroke()
      ctx.font = font(20, true); ctx.fillStyle = colorValue(accent)!; ctx.textAlign = 'left'
      ctx.fillText(n.label, x + 28, y + 28 + 20)
      const labelW = ctx.measureText(n.label).width
      if (n.sub) { ctx.font = font(13); ctx.fillStyle = '#8a9a94'; ctx.fillText(n.sub, x + 28 + labelW + 12, y + 28 + 20) }
      ctx.font = font(16); ctx.fillStyle = INK
      let ly = y + 28 + titleH
      lineHs.forEach(text => { ctx.fillText(text, x + 28, ly + 16); ly += 16 * 1.6 })
    }
    return { height, draw }
  })

  const timelinePaint: Paint = {
    height: nodePaints.reduce((n, p) => n + p.height + 20, 0) + 8,
    draw: (ctx, x, y) => {
      if (!nodePaints.length) {
        ctx.font = font(16); ctx.fillStyle = MUTED; ctx.textAlign = 'left'
        ctx.fillText('本周暂无时间轴记录', x + cardX, y + 24)
        return
      }
      const total = nodePaints.reduce((n, p) => n + p.height + 20, 0)
      ctx.strokeStyle = '#dbe3df'; ctx.lineWidth = 4
      ctx.beginPath(); ctx.moveTo(x + lineX, y + 8); ctx.lineTo(x + lineX, y + total); ctx.stroke()
      let ny = y
      for (const p of nodePaints) {
        p.draw(ctx, x + cardX, ny)
        ctx.fillStyle = CARD_BG
        ctx.beginPath(); ctx.arc(x + lineX, ny + 34, 13, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = colorValue(accent)!; ctx.lineWidth = 4; ctx.stroke()
        ny += p.height + 20
      }
    },
  }

  const paints: Paint[] = [
    paintHeaderBand(r, version, width, margin, kit),
    timelinePaint,
    ...reportTables(r).map(t => paintDataTable(t, cardW, kit, accent)),
    paintFooter(r, width, margin, kit),
  ]
  const totalH = paints.reduce((n, p) => n + p.height + gap, 0) + margin
  if (totalH > 30000) throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度')
  return [composeLongImage(paints, width, margin, gap)]
}
