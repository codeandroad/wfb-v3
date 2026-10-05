import { type FrozenReport, visibleBlocks } from './reports'
import { resolveElement, colorValue, type ElementStyle } from './report-customization'
import {
  makeCanvasKit, roundRectPath, paintHeaderBand, paintFooter, paintDataTable,
  composeLongImage, reportTables, INK, MUTED, CARD_BG, type Paint,
} from './report-canvas-shared'

type BriefCard = { title: string; accent: string; lines: string[]; emptyHint: string }

/** 三卡片内容映射：班级报告取总评 / 数据一览 / 下周预告；个人报告取点评 / 课堂作业 / 下周安排 */
function briefCards(r: FrozenReport): BriefCard[] {
  const primary = r.template.color ?? '#245f50'
  const blocks = visibleBlocks(r)
  const linesOf = (...keys: string[]) =>
    blocks.filter(b => keys.includes(b.key)).flatMap(b => b.lines).map(s => s.trim()).filter(Boolean)
  if (r.kind === 'personal') {
    return [
      { title: '个人点评', accent: primary, lines: linesOf('comment'), emptyHint: '本周暂无个人点评' },
      { title: '课堂与作业', accent: '#b5791f', lines: linesOf('classroom', 'homework'), emptyHint: '本周暂无记录' },
      { title: '下周安排', accent: '#2f7d5b', lines: linesOf('next', 'highlights'), emptyHint: '暂无' },
    ]
  }
  return [
    { title: '本周总评', accent: primary, lines: linesOf('teaching', 'learning'), emptyHint: '本周暂无总评' },
    { title: '数据一览', accent: '#b5791f', lines: linesOf('classroom', 'homework', 'highlights'), emptyHint: '本周暂无记录' },
    { title: '下周预告', accent: '#2f7d5b', lines: linesOf('next'), emptyHint: '暂无' },
  ]
}

export function renderBriefImages(r: FrozenReport, version = '未发布预览稿'): string[] {
  const width = 1080, margin = 48, gap = 28
  const kit = makeCanvasKit(r)
  const { font, wrap } = kit
  const cardW = width - margin * 2

  // ---- 卡片（保留模板自定义元素覆盖） ----
  const cards: Paint[] = briefCards(r).map(card => {
    const tStyle = resolveElement(r.template.customization, 'brief.card.title', { size: 22, weight: 600, color: INK, lineHeight: 1.4, padding: 36 } as ElementStyle)
    const bStyle = resolveElement(r.template.customization, 'brief.card.body', { size: 17, weight: 400, color: INK, lineHeight: 1.7, padding: 36 } as ElementStyle)
    const bodyW = cardW - bStyle.padding! * 2 - 28
    const rows = card.lines.length ? card.lines : [card.emptyHint]
    const rowLines = rows.map(text => wrap((card.lines.length ? '•  ' : '') + text, bodyW, bStyle.size!))
    const titleH = tStyle.padding! + tStyle.size! * tStyle.lineHeight! + 14
    const bodyH = rowLines.reduce((n, lines) => n + lines.length * bStyle.size! * bStyle.lineHeight! + 10, 0)
    const height = titleH + bodyH + bStyle.padding!
    const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.save()
      ctx.shadowColor = 'rgba(36,95,80,0.08)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6
      roundRectPath(ctx, x, y, cardW, height, 24)
      ctx.fillStyle = colorValue(CARD_BG)!; ctx.fill()
      ctx.restore()
      roundRectPath(ctx, x, y, cardW, height, 24)
      ctx.strokeStyle = '#e2eae6'; ctx.lineWidth = 2; ctx.stroke()
      ctx.fillStyle = colorValue(card.accent)!
      roundRectPath(ctx, x, y + 28, 8, height - 56, 4); ctx.fill()
      ctx.font = font(tStyle.size!, true); ctx.fillStyle = colorValue(tStyle.color!)!; ctx.textAlign = 'left'
      const tY = y + tStyle.padding!
      ctx.fillText(card.title, x + tStyle.padding!, tY + tStyle.size!)
      ctx.fillStyle = colorValue(card.accent)!
      ctx.beginPath(); ctx.arc(x + tStyle.padding! - 16, tY + tStyle.size! * 0.62, 7, 0, Math.PI * 2); ctx.fill()
      ctx.font = font(bStyle.size!); ctx.fillStyle = colorValue(card.lines.length ? bStyle.color! : MUTED)!
      let ly = y + titleH
      rowLines.forEach(lines => {
        lines.forEach((text, i) => { ctx.fillText(text, x + bStyle.padding! + 14, ly + bStyle.size! + i * bStyle.size! * bStyle.lineHeight!) })
        ly += lines.length * bStyle.size! * bStyle.lineHeight! + 10
      })
      ctx.textAlign = 'left'
    }
    return { height, draw }
  })

  const accent = r.template.color ?? '#245f50'
  const paints: Paint[] = [
    paintHeaderBand(r, version, width, margin, kit),
    ...cards,
    ...reportTables(r).map(t => paintDataTable(t, cardW, kit, accent)),
    paintFooter(r, width, margin, kit),
  ]
  const totalH = paints.reduce((n, p) => n + p.height + gap, 0) + margin
  if (totalH > 30000) throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度')
  return [composeLongImage(paints, width, margin, gap)]
}
