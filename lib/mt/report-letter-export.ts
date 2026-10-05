import { type FrozenReport, visibleBlocks } from './reports'
import {
  makeCanvasKit, roundRectPath, paintHeaderBand, paintFooter, paintDataTable,
  composeLongImage, reportTables, INK, MUTED, CARD_BG, PRIMARY, type Paint,
} from './report-canvas-shared'
import { colorValue } from './report-customization'

/** P12 每周一信：称呼 + 正文 + 课堂作业 + 下周安排 + 落款 + 数据表 */
export function renderLetterImages(r: FrozenReport, version = '未发布预览稿'): string[] {
  const width = 1080, margin = 48, gap = 28
  const kit = makeCanvasKit(r)
  const { font, wrap } = kit
  const cardW = width - margin * 2
  const accent = r.template.color ?? PRIMARY
  const blocks = visibleBlocks(r)
  const linesOf = (...keys: string[]) =>
    blocks.filter(b => keys.includes(b.key)).flatMap(b => b.lines).map(s => s.trim()).filter(Boolean)
  const comment = linesOf('comment')
  const body = linesOf('classroom', 'homework', 'highlights')
  const next = linesOf('next')

  const letterPaint: Paint = (() => {
    const W = cardW - 96
    const greetH = 20 * 1.6 + 24
    const cLines = (comment.length ? comment : ['本周暂无评语。']).flatMap(l => wrap(l, W, 17))
    const bodyH = 20 * 1.4 + 12 + (body.length ? body.flatMap(l => wrap(l, W, 17)).length : 1) * 17 * 1.7 + 20
    const nextH = 20 * 1.4 + 12 + (next.length ? next.flatMap(l => wrap(l, W, 17)).length : 1) * 17 * 1.7 + 20
    const signH = 17 * 1.6 + 40
    const height = 48 + greetH + cLines.length * 17 * 1.9 + 24 + bodyH + nextH + signH + 48
    const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      roundRectPath(ctx, x, y, cardW, height, 20)
      ctx.fillStyle = CARD_BG; ctx.fill()
      ctx.strokeStyle = '#e2eae6'; ctx.lineWidth = 2; ctx.stroke()
      ctx.textAlign = 'left'
      let ly = y + 48
      ctx.font = font(20); ctx.fillStyle = INK
      ctx.fillText(`${r.name}同学家长，您好！`, x + 48, ly + 20); ly += greetH
      ctx.font = font(17)
      ctx.fillStyle = comment.length ? INK : MUTED
      cLines.forEach(t => { ctx.fillText(t, x + 48, ly + 17); ly += 17 * 1.9 })
      ly += 24
      const section = (title: string, ls: string[], hint: string) => {
        ctx.font = font(17, true); ctx.fillStyle = colorValue(accent)!
        ctx.fillText(title, x + 48, ly + 17); ly += 17 * 1.4 + 12
        ctx.font = font(17); ctx.fillStyle = ls.length ? INK : MUTED
        const rows = ls.length ? ls.flatMap(l => wrap(`•  ${l}`, W, 17)) : [hint]
        rows.forEach(t => { ctx.fillText(t, x + 48, ly + 17); ly += 17 * 1.7 })
        ly += 20
      }
      section('本周课堂与作业', body, '本周暂无记录')
      section('下周安排', next, '暂无')
      ctx.font = font(17); ctx.fillStyle = MUTED; ctx.textAlign = 'right'
      ctx.fillText(`${r.teacher} · ${r.period}`, x + cardW - 48, ly + 17)
      ctx.textAlign = 'left'
    }
    return { height, draw }
  })()

  const paints: Paint[] = [
    paintHeaderBand(r, version, width, margin, kit),
    letterPaint,
    ...reportTables(r).map(t => paintDataTable(t, cardW, kit, accent)),
    paintFooter(r, width, margin, kit),
  ]
  const totalH = paints.reduce((n, p) => n + p.height + gap, 0) + margin
  if (totalH > 30000) throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度')
  return [composeLongImage(paints, width, margin, gap)]
}
