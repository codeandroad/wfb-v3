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
  const dimH = dims.length * 96
  const dimPanel: Paint | null = dims.length ? {
    height: dimH + 64,
    draw: (ctx, x, y) => {
      roundRectPath(ctx, x, y, cardW, dimH + 64, 28)
      ctx.fillStyle = '#ffffff'; ctx.fill()
      ctx.strokeStyle = '#eee9db'; ctx.lineWidth = 2; ctx.stroke()
      dims.forEach((d, i) => {
        const dy = y + 32 + i * 96
        ctx.font = font(21); ctx.fillStyle = INK; ctx.textAlign = 'left'
        ctx.fillText(d.label, x + 48, dy + 26)
        ctx.font = font(21, true)
        const vw = ctx.measureText(d.value).width
        ctx.fillText(d.value, x + cardW - 48 - vw, dy + 26)
        // 轨道 + 渐变填充
        const tx = x + 48, tw = cardW - 96
        ctx.fillStyle = '#f0ebe0'
        roundRectPath(ctx, tx, dy + 48, tw, 20, 10); ctx.fill()
        const bw = Math.max(20, (d.pct / 100) * tw)
        const g = ctx.createLinearGradient(tx, 0, tx + bw, 0)
        g.addColorStop(0, primary + 'b3'); g.addColorStop(1, primary)
        ctx.fillStyle = g
        roundRectPath(ctx, tx, dy + 48, bw, 20, 10); ctx.fill()
      })
    },
  } : null

  // ---- 点评 / 小目标 ----
  const noteLines = comment.length ? wrap(`老师点评：${comment.join(' ')}`, cardW - 120, 20) : []
  const notePanel: Paint | null = noteLines.length ? {
    height: noteLines.length * 36 + 64,
    draw: (ctx, x, y) => {
      const h = noteLines.length * 36 + 64
      roundRectPath(ctx, x, y, cardW, h, 20)
      ctx.fillStyle = '#faf8f2'; ctx.fill()
      // 金色左侧竖线
      ctx.fillStyle = '#b98a2f'
      ctx.fillRect(x, y + 12, 10, h - 24)
      ctx.font = font(20); ctx.fillStyle = '#4a463c'; ctx.textAlign = 'left'
      noteLines.forEach((t, i) => ctx.fillText(t, x + 48, y + 46 + i * 36))
    },
  } : null
  const goalLines = next.length ? wrap(`下周小目标：${next[0]}`, cardW - 96, 20) : []
  const goalPanel: Paint | null = goalLines.length ? {
    height: goalLines.length * 36 + 64,
    draw: (ctx, x, y) => {
      roundRectPath(ctx, x, y, cardW, goalLines.length * 36 + 64, 20)
      ctx.fillStyle = '#eef4ec'; ctx.fill()
      ctx.font = font(20); ctx.fillStyle = '#3a5a4a'; ctx.textAlign = 'left'
      goalLines.forEach((t, i) => ctx.fillText(t, x + 48, y + 46 + i * 36))
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
