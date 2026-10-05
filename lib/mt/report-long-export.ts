import { type FrozenReport, visibleBlocks } from './reports'
import {
  makeCanvasKit, paintHeaderBand, paintFooter, paintDataTable,
  composeLongImage, reportTables, INK, MUTED, PRIMARY, type Paint,
} from './report-canvas-shared'
import { colorValue } from './report-customization'

/** C15 一图流长图：全部板块顺排 + 数据表，无卡片装饰 */
export function renderLongImages(r: FrozenReport, version = '未发布预览稿', scale = 1): string[] {
  const width = 1080, margin = 48, gap = 28
  const kit = makeCanvasKit(r)
  const { font, wrap } = kit
  const cardW = width - margin * 2
  const accent = r.template.color ?? PRIMARY
  const blocks = visibleBlocks(r)

  const sectionPaints: Paint[] = blocks.map(b => {
    const lines = b.lines.flatMap(l => wrap(l, cardW - 24, 17))
    const height = 24 + 20 * 1.4 + 12 + (lines.length ? lines.length * 17 * 1.7 : 17 * 1.7) + 12
    const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.fillStyle = colorValue(accent)!
      ctx.fillRect(x, y + 24, 6, 20 * 1.4)
      ctx.font = font(20, true); ctx.fillStyle = colorValue(accent)!; ctx.textAlign = 'left'
      ctx.fillText(b.title, x + 24, y + 24 + 20)
      ctx.font = font(17); ctx.fillStyle = lines.length ? INK : MUTED
      let ly = y + 24 + 20 * 1.4 + 12
      if (lines.length) lines.forEach(t => { ctx.fillText(t, x + 24, ly + 17); ly += 17 * 1.7 })
      else ctx.fillText('暂无', x + 24, ly + 17)
    }
    return { height, draw }
  })

  const paints: Paint[] = [
    paintHeaderBand(r, version, width, margin, kit),
    ...sectionPaints,
    ...reportTables(r).map(t => paintDataTable(t, cardW, kit, accent)),
    paintFooter(r, width, margin, kit),
  ]
  const totalH = paints.reduce((n, p) => n + p.height + gap, 0) + margin
  if (totalH > 30000) throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度')
  return [composeLongImage(paints, width, margin, gap, scale)]
}
