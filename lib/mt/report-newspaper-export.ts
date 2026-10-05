import { type FrozenReport, type ReportTable, visibleBlocks } from './reports'
import { computeStats, pct, extractChapter, extractChips, parseHighlights, studentSummaries } from './report-stats'
import {
  makeCanvasKit, paintFooter, paintDataTable,
  composeLongImage, INK, MUTED, PRIMARY, type Paint,
} from './report-canvas-shared'
import { colorValue } from './report-customization'

/** C16 班级周报（报纸风）canvas 导出：报头 + 头版头条 + 知识速递/光荣榜 + 下期预告 + 汇总表（对标 preview-2.html 样式四） */
export function renderNewspaperImages(r: FrozenReport, version = '未发布预览稿'): string[] {
  const width = 1080, margin = 48, gap = 28
  // 报纸风强制宋体衬线
  const kit = makeCanvasKit({ ...r, template: { ...r.template, font: 'serif' } })
  const { font, wrap } = kit
  const cardW = width - margin * 2
  const primary = r.template.color ?? PRIMARY
  const s = computeStats(r)
  const chapter = extractChapter(r)
  const chips = extractChips(r)
  const stars = parseHighlights(r)
  const teaching = visibleBlocks(r).filter(b => b.key === 'teaching').flatMap(b => b.lines).map(x => x.trim()).filter(Boolean)
  const learning = visibleBlocks(r).filter(b => b.key === 'learning').flatMap(b => b.lines).map(x => x.trim()).filter(Boolean)
  const next = visibleBlocks(r).filter(b => b.key === 'next').flatMap(b => b.lines).map(x => x.trim()).filter(Boolean)
  const subject = (r.scope || '').split('·')[0].trim()
  const qi = /第\s*(\d+)\s*周/.exec(r.period || '')

  // ---- 报头 ----
  const mastTitle = `${r.name}${subject}周报`
  const mastSub = [qi ? `第 ${qi[1]} 期` : '', r.period, `主编 ${r.teacher}`].filter(Boolean).join(' ｜ ')
  const mastSubLines = wrap(mastSub, cardW - 120, 17)
  const masthead: Paint = {
    height: 110 + mastSubLines.length * 30,
    draw: (ctx, x, y) => {
      ctx.textAlign = 'center'
      ctx.font = font(46, true); ctx.fillStyle = INK
      // 字间距：逐字绘制
      const chars = [...mastTitle]
      const widths = chars.map(c => ctx.measureText(c).width)
      const gapX = 10
      const totalW = widths.reduce((a, b) => a + b, 0) + gapX * (chars.length - 1)
      let cx = x + cardW / 2 - totalW / 2
      chars.forEach((c, i) => { ctx.fillText(c, cx + widths[i] / 2, y + 62); cx += widths[i] + gapX })
      ctx.font = font(17); ctx.fillStyle = MUTED
      mastSubLines.forEach((t, i) => ctx.fillText(t, x + cardW / 2, y + 104 + i * 30))
      // 双线
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(x, y + 110 + mastSubLines.length * 30 - 8); ctx.lineTo(x + cardW, y + 110 + mastSubLines.length * 30 - 8); ctx.stroke()
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, y + 110 + mastSubLines.length * 30 - 2); ctx.lineTo(x + cardW, y + 110 + mastSubLines.length * 30 - 2); ctx.stroke()
      ctx.textAlign = 'left'
    },
  }

  // ---- 头版头条 ----
  const headlineText = chapter ? `${chapter}：本周学习纪实` : '本周学习纪实'
  const subBits = [
    chapter && `${chapter}开篇周`,
    s.attTotal ? `${pct(s.attNormal, s.attTotal)} 出勤` : '',
    s.hwTotal ? `${pct(s.hwDone, s.hwTotal)} 作业提交` : '',
  ].filter(Boolean)
  const headLines = wrap(headlineText, cardW - 80, 34, true)
  const headline: Paint = {
    height: headLines.length * 52 + 30 + (subBits.length ? 34 : 0),
    draw: (ctx, x, y) => {
      ctx.textAlign = 'center'
      ctx.font = font(34, true); ctx.fillStyle = INK
      headLines.forEach((t, i) => ctx.fillText(t, x + cardW / 2, y + 44 + i * 52))
      if (subBits.length) {
        ctx.font = font(17); ctx.fillStyle = MUTED
        ctx.fillText(subBits.join(' · '), x + cardW / 2, y + 44 + headLines.length * 52 + 12)
      }
      ctx.textAlign = 'left'
    },
  }

  const secShell = (badge: string, title: string, lines: string[]): Paint => {
    const lh = 32
    const height = 56 + lines.length * lh + 8
    return {
      height,
      draw: (ctx, x, y) => {
        drawSecTitle(ctx, x, y, badge, title)
        ctx.font = font(18); ctx.fillStyle = '#3a372f'
        lines.forEach((t, i) => ctx.fillText(t, x + 8, y + 56 + 22 + i * lh))
      },
    }
  }
  const drawSecTitle = (ctx: CanvasRenderingContext2D, x: number, y: number, badge: string, title: string) => {
    ctx.font = font(16, true)
    const bw = ctx.measureText(badge).width + 32
    ctx.fillStyle = '#2b2b2b'
    ctx.fillRect(x, y + 8, bw, 30)
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'
    ctx.fillText(badge, x + 16, y + 30)
    ctx.font = font(19, true); ctx.fillStyle = INK
    ctx.fillText(title, x + bw + 12, y + 30)
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(x, y + 48); ctx.lineTo(x + cardW, y + 48); ctx.stroke()
  }

  const frontLines = [...teaching.slice(0, 2), ...learning.slice(0, 1)].flatMap(p => wrap(p, cardW - 16, 18))
  const frontSec = secShell('头版', '头版头条', frontLines.length ? frontLines : ['暂无'])

  const chipLines = chips.length ? chips : ['暂无']
  const starLines = stars.length ? stars.slice(0, 6).map(b => `${b.name}${b.reason ? ` —— ${b.reason}` : ''}`) : ['暂无']
  const half = cardW / 2 - 16
  const chipItems = chipLines.flatMap(t => wrap(`• ${t}`, half - 16, 18))
  const starItems = starLines.flatMap(t => wrap(`• ${t}`, half - 16, 18))
  const twoCol: Paint = {
    height: 56 + Math.max(chipItems.length, starItems.length) * 32 + 12,
    draw: (ctx, x, y) => {
      const drawCol = (cx: number, cw: number, badge: string, title: string, items: string[]) => {
        ctx.font = font(16, true)
        const bw = ctx.measureText(badge).width + 32
        ctx.fillStyle = '#2b2b2b'
        ctx.fillRect(cx, y + 8, bw, 30)
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'
        ctx.fillText(badge, cx + 16, y + 30)
        ctx.font = font(19, true); ctx.fillStyle = INK
        ctx.fillText(title, cx + bw + 12, y + 30)
        ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(cx, y + 48); ctx.lineTo(cx + cw, y + 48); ctx.stroke()
        ctx.font = font(18); ctx.fillStyle = '#3a372f'
        items.forEach((t, i) => ctx.fillText(t, cx + 8, y + 56 + 22 + i * 32))
      }
      drawCol(x, half, '速递', '知识速递', chipItems)
      drawCol(x + half + 32, half, '光荣', '本周光荣榜', starItems)
    },
  }

  const nextSec = secShell('预告', '下期预告', next.length ? wrap(next[0], cardW - 16, 18) : ['暂无'])

  // ---- 汇总表 ----
  const summaries = studentSummaries(r)
  const summaryTable: ReportTable = {
    title: '详细出勤与成绩表', kind: 'classroom',
    headers: [[{ text: '姓名' }, { text: '出勤' }, { text: '课堂表现' }, { text: '作业' }]],
    rows: summaries.map(x => [x.name, x.attendance, x.classroom, x.homework]),
  }

  const paints: Paint[] = [
    masthead,
    headline,
    frontSec,
    twoCol,
    nextSec,
    ...(summaries.length ? [paintDataTable(summaryTable, cardW, kit, colorValue(primary) ?? primary)] : []),
    paintFooter(r, width, margin, kit),
  ]
  const totalH = paints.reduce((n, p) => n + p.height + gap, 0) + margin
  if (totalH > 30000) throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度')
  return [composeLongImage(paints, width, margin, gap)]
}
