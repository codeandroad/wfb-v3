import { type FrozenReport, type ReportTable, visibleBlocks } from './reports'
import { extractChapter, extractChips, parseHighlights, followUps, studentSummaries } from './report-stats'
import {
  makeCanvasKit, roundRectPath, paintHeaderBand, paintFooter, paintDataTable,
  composeLongImage, INK, MUTED, CARD_BG, PRIMARY, darken, type Paint,
} from './report-canvas-shared'
import { colorValue } from './report-customization'

/** C11 微信三卡片 canvas 导出：学了什么 / 高光之星 / 配合事项 + 汇总表（对标 preview.html 样式二） */
export function renderBriefImages(r: FrozenReport, version = '未发布预览稿', scale = 1): string[] {
  const width = 1080, margin = 48, gap = 28
  const kit = makeCanvasKit(r)
  const { font, wrap } = kit
  const cardW = width - margin * 2
  const primary = r.template.color ?? PRIMARY
  const kickerColor = '#b98a2f'

  const paintKickerCard = (kicker: string, title: string, body: (ctx: CanvasRenderingContext2D, x: number, y: number) => number, bodyH: number): Paint => {
    const height = 40 + 20 + 28 + bodyH + 40
    const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      roundRectPath(ctx, x, y, cardW, height, 28)
      ctx.fillStyle = CARD_BG; ctx.fill()
      ctx.strokeStyle = '#eee9db'; ctx.lineWidth = 2; ctx.stroke()
      ctx.textAlign = 'left'
      ctx.font = font(15, true); ctx.fillStyle = kickerColor
      ctx.fillText(kicker.split('').join(' '), x + 44, y + 40 + 15)
      ctx.font = font(26, true); ctx.fillStyle = INK
      ctx.fillText(title, x + 44, y + 40 + 20 + 14 + 26)
      body(ctx, x + 44, y + 40 + 20 + 28 + 26 + 14)
    }
    return { height, draw }
  }

  // ---- 卡1：学了什么 ----
  const teaching = visibleBlocks(r).filter(b => b.key === 'teaching').flatMap(b => b.lines).map(s => s.trim()).filter(Boolean)
  const chapter = extractChapter(r) ?? '本周教学内容'
  const chips = extractChips(r)
  const teachLines = wrap(teaching[0] ?? '本周暂无教学记录', cardW - 88, 20)
  const chipH = chips.length >= 2 ? 44 : 0
  const learnCard = paintKickerCard('本周学了什么', chapter, (ctx, x, y) => {
    ctx.font = font(20); ctx.fillStyle = '#4a463c'; ctx.textAlign = 'left'
    teachLines.forEach((t, i) => ctx.fillText(t, x, y + 20 + i * 20 * 1.6))
    let cy = y + teachLines.length * 20 * 1.6 + 18
    if (chips.length >= 2) {
      let cx = x
      ctx.font = font(17)
      chips.forEach(c => {
        const w = ctx.measureText(c).width + 36
        ctx.fillStyle = '#eef4ec'
        roundRectPath(ctx, cx, cy, w, 38, 19); ctx.fill()
        ctx.fillStyle = colorValue(primary)!; ctx.textAlign = 'center'
        ctx.fillText(c, cx + w / 2, cy + 26)
        ctx.textAlign = 'left'
        cx += w + 14
      })
    }
    return 0
  }, teachLines.length * 20 * 1.6 + chipH)

  // ---- 卡2：高光之星 ----
  const highlights = parseHighlights(r)
  const starRowH = 76
  const starsCard = paintKickerCard('本周高光', '值得点赞的他们', (ctx, x, y) => {
    if (!highlights.length) {
      ctx.font = font(18); ctx.fillStyle = MUTED; ctx.textAlign = 'left'
      ctx.fillText('本周暂无高光记录', x, y + 18)
      return 0
    }
    const colors = [primary, '#b98a2f', '#5a8a9a', '#8a5a9a']
    highlights.forEach((h, i) => {
      const ry = y + i * starRowH
      ctx.fillStyle = colorValue(colors[i % 4])!
      ctx.beginPath(); ctx.arc(x + 28, ry + 28, 28, 0, Math.PI * 2); ctx.fill()
      ctx.font = font(20, true); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'
      ctx.fillText((h.name || '赞')[0], x + 28, ry + 35)
      ctx.textAlign = 'left'
      ctx.font = font(19, true); ctx.fillStyle = INK
      ctx.fillText(h.name || '同学', x + 70, ry + 24)
      ctx.font = font(17); ctx.fillStyle = MUTED
      wrap(h.reason, cardW - 88 - 70, 17).slice(0, 2).forEach((t, j) => ctx.fillText(t, x + 70, ry + 50 + j * 17 * 1.5))
    })
    return 0
  }, highlights.length ? highlights.length * starRowH : 40)

  // ---- 卡3：配合事项 ----
  const next = visibleBlocks(r).filter(b => b.key === 'next').flatMap(b => b.lines).map(s => s.trim()).filter(Boolean)
  const fu = followUps(r)
  const ctaText = `${next[0] ?? '暂无特别事项。'}${fu.homework.length ? `另有 ${fu.homework.length} 位同学作业未交，已单独提醒。` : ''}`
  const ctaLines = wrap(ctaText, cardW - 88, 20)
  const ctaH = 40 + 20 + 14 + ctaLines.length * 20 * 1.7 + 40
  const ctaCard: Paint = {
    height: ctaH,
    draw: (ctx, x, y) => {
      const g = ctx.createLinearGradient(x, y, x + cardW, y + ctaH)
      g.addColorStop(0, colorValue(primary)!); g.addColorStop(1, darken(colorValue(primary)!, 0.85))
      roundRectPath(ctx, x, y, cardW, ctaH, 28)
      ctx.fillStyle = g; ctx.fill()
      ctx.textAlign = 'left'
      ctx.font = font(15, true); ctx.fillStyle = '#ffe9a8'
      ctx.fillText('需要您配合'.split('').join(' '), x + 44, y + 40 + 15)
      ctx.font = font(20); ctx.fillStyle = '#f2f7f1'
      ctaLines.forEach((t, i) => ctx.fillText(t, x + 44, y + 40 + 20 + 14 + 20 + i * 20 * 1.7))
    },
  }

  // ---- 汇总表 ----
  const summaries = studentSummaries(r)
  const summaryTable: ReportTable = {
    title: '详细出勤与成绩表', kind: 'classroom',
    headers: [[{ text: '姓名' }, { text: '出勤' }, { text: '课堂表现' }, { text: '作业' }]],
    rows: summaries.map(s => [s.name, s.attendance, s.classroom, s.homework]),
  }
  const tablePaint = summaries.length ? paintDataTable(summaryTable, cardW, kit, primary) : null

  const paints: Paint[] = [
    paintHeaderBand(r, version, width, margin, kit),
    learnCard, starsCard, ctaCard,
    ...(tablePaint ? [tablePaint] : []),
    paintFooter(r, width, margin, kit),
  ]
  const totalH = paints.reduce((n, p) => n + p.height + gap, 0) + margin
  if (totalH > 30000) throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度')
  return [composeLongImage(paints, width, margin, gap, scale)]
}
