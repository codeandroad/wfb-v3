import { type FrozenReport, visibleBlocks } from './reports'
import {
  makeCanvasKit, roundRectPath, paintHeaderBand, paintFooter, paintDataTable,
  composeLongImage, reportTables, INK, CARD_BG, PRIMARY, type Paint,
} from './report-canvas-shared'
import { colorValue } from './report-customization'

const QA_MAP: [string, string][] = [
  ['teaching', '本周学了什么？'],
  ['learning', '孩子们学得怎么样？'],
  ['classroom', '课堂表现如何？'],
  ['homework', '作业完成得怎么样？'],
  ['highlights', '哪些同学值得表扬？'],
  ['next', '下周有什么安排？'],
  ['comment', '老师还想说？'],
]

/** C14 快问快答：Q&A 卡片 + 数据表 */
export function renderQAImages(r: FrozenReport, version = '未发布预览稿', scale = 1): string[] {
  const width = 1080, margin = 48, gap = 28
  const kit = makeCanvasKit(r)
  const { font, wrap } = kit
  const cardW = width - margin * 2
  const accent = r.template.color ?? PRIMARY
  const blocks = visibleBlocks(r)

  const qas = QA_MAP.flatMap(([key, q]) => {
    const lines = blocks.filter(b => b.key === key).flatMap(b => b.lines).map(s => s.trim()).filter(Boolean)
    return lines.length ? [{ q, lines }] : []
  })

  const qaPaints: Paint[] = qas.map(({ q, lines }) => {
    const qLines = wrap(`Q：${q}`, cardW - 72, 20, true)
    const aLines = lines.flatMap(l => wrap(`A：${l}`, cardW - 72, 17))
    const height = 32 + qLines.length * 20 * 1.4 + 14 + aLines.length * 17 * 1.7 + 32
    const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      roundRectPath(ctx, x, y, cardW, height, 20)
      ctx.fillStyle = CARD_BG; ctx.fill()
      ctx.strokeStyle = '#e2eae6'; ctx.lineWidth = 2; ctx.stroke()
      ctx.textAlign = 'left'
      let ly = y + 32
      ctx.font = font(20, true); ctx.fillStyle = colorValue(accent)!
      qLines.forEach(t => { ctx.fillText(t, x + 36, ly + 20); ly += 20 * 1.4 })
      ly += 14
      ctx.strokeStyle = '#eef1f0'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(x + 36, ly - 7); ctx.lineTo(x + cardW - 36, ly - 7); ctx.stroke()
      ctx.font = font(17); ctx.fillStyle = INK
      aLines.forEach(t => { ctx.fillText(t, x + 36, ly + 17); ly += 17 * 1.7 })
    }
    return { height, draw }
  })

  const paints: Paint[] = [
    paintHeaderBand(r, version, width, margin, kit),
    ...qaPaints,
    ...reportTables(r).map(t => paintDataTable(t, cardW, kit, accent)),
    paintFooter(r, width, margin, kit),
  ]
  const totalH = paints.reduce((n, p) => n + p.height + gap, 0) + margin
  if (totalH > 30000) throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度')
  return [composeLongImage(paints, width, margin, gap, scale)]
}
