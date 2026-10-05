import { type FrozenReport, visibleBlocks } from './reports'
import { personalDims } from './report-stats'
import {
  makeCanvasKit, roundRectPath, paintHeaderBand, paintFooter, paintDataTable,
  composeLongImage, INK, PRIMARY, type Paint,
} from './report-canvas-shared'
import { colorValue } from './report-customization'

/** P11 个人成长档案 canvas 导出：维度条 + 老师点评 + 下周小目标 + 数据表（对标 preview-2.html 样式三） */
export function renderGrowthImages(r: FrozenReport, version = '未发布预览稿'): string[] {
  const width = 1080, margin = 48, gap = 28
  const kit = makeCanvasKit(r)
  const { font, wrap } = kit
  const cardW = width - margin * 2
  const primary = colorValue(r.template.color ?? PRIMARY) ?? PRIMARY
  const dims = personalDims(r)
  const comment = visibleBlocks(r).filter(b => b.key === 'comment').flatMap(b => b.lines).map(x => x.trim()).filter(Boolean)
  const next = visibleBlocks(r).filter(b => b.key === 'next').flatMap(b => b.lines).map(x => x.trim()).filter(Boolean)

  // ---- 维度条 ----
  const dimH = dims.length * 92
  const dimPanel: Paint | null = dims.length ? {
    height: dimH + 56,
    draw: (ctx, x, y) => {
      roundRectPath(ctx, x, y, cardW, dimH + 56, 24)
      ctx.fillStyle = '#ffffff'; ctx.fill()
      ctx.strokeStyle = '#eee9db'; ctx.lineWidth = 2; ctx.stroke()
      dims.forEach((d, i) => {
        const dy = y + 28 + i * 92
        ctx.font = font(20); ctx.fillStyle = INK; ctx.textAlign = 'left'
        ctx.fillText(d.label, x + 40, dy + 24)
        ctx.font = font(20, true)
        const vw = ctx.measureText(d.value).width
        ctx.fillText(d.value, x + cardW - 40 - vw, dy + 24)
        // 轨道
        const tx = x + 40, tw = cardW - 80
        ctx.fillStyle = '#f2efe9'
        roundRectPath(ctx, tx, dy + 44, tw, 18, 9); ctx.fill()
        ctx.fillStyle = primary
        roundRectPath(ctx, tx, dy + 44, Math.max(18, (d.pct / 100) * tw), 18, 9); ctx.fill()
      })
    },
  } : null

  // ---- 点评 / 小目标 ----
  const noteLines = comment.length ? wrap(`老师点评：${comment.join(' ')}`, cardW - 80, 19) : []
  const notePanel: Paint | null = noteLines.length ? {
    height: noteLines.length * 34 + 56,
    draw: (ctx, x, y) => {
      roundRectPath(ctx, x, y, cardW, noteLines.length * 34 + 56, 24)
      ctx.fillStyle = '#faf8f2'; ctx.fill()
      ctx.strokeStyle = '#eee9db'; ctx.lineWidth = 2; ctx.stroke()
      ctx.font = font(19); ctx.fillStyle = '#4a463c'; ctx.textAlign = 'left'
      noteLines.forEach((t, i) => ctx.fillText(t, x + 40, y + 40 + i * 34))
    },
  } : null
  const goalLines = next.length ? wrap(`下周小目标：${next[0]}`, cardW - 80, 19) : []
  const goalPanel: Paint | null = goalLines.length ? {
    height: goalLines.length * 34 + 56,
    draw: (ctx, x, y) => {
      roundRectPath(ctx, x, y, cardW, goalLines.length * 34 + 56, 24)
      ctx.fillStyle = '#eef4ec'; ctx.fill()
      ctx.font = font(19); ctx.fillStyle = '#3a5a4a'; ctx.textAlign = 'left'
      goalLines.forEach((t, i) => ctx.fillText(t, x + 40, y + 40 + i * 34))
    },
  } : null

  const tables = (r.tables ?? []).filter(t => t.kind === 'classroom' || t.kind === 'homework')

  const paints: Paint[] = [
    paintHeaderBand(r, version, width, margin, kit),
    ...(dimPanel ? [dimPanel] : []),
    ...(notePanel ? [notePanel] : []),
    ...(goalPanel ? [goalPanel] : []),
    ...tables.map(t => paintDataTable(t, cardW, kit, primary)),
    paintFooter(r, width, margin, kit),
  ]
  const totalH = paints.reduce((n, p) => n + p.height + gap, 0) + margin
  if (totalH > 30000) throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度')
  return [composeLongImage(paints, width, margin, gap)]
}
