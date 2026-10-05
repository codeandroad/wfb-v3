import { type FrozenReport, visibleBlocks } from './reports'
import { computeStats, pct } from './report-stats'
import {
  makeCanvasKit, roundRectPath, paintHeaderBand, paintFooter, paintDataTable, paintBulletCard,
  composeLongImage, reportTables, INK, MUTED, CARD_BG, PRIMARY, type Paint,
} from './report-canvas-shared'
import { colorValue } from './report-customization'

/** C12 班级仪表盘：指标卡（出勤率/优秀率/提交率/表扬）+ 关注名单 + 总评 + 数据表 */
export function renderDashboardImages(r: FrozenReport, version = '未发布预览稿'): string[] {
  const width = 1080, margin = 48, gap = 28
  const kit = makeCanvasKit(r)
  const { font, wrap } = kit
  const cardW = width - margin * 2
  const accent = r.template.color ?? PRIMARY
  const s = computeStats(r)

  // ---- 4 张指标卡 ----
  const stats = [
    { label: '出勤正常率', value: pct(s.attNormal, s.attTotal) ?? '–', sub: s.attTotal ? `${s.attNormal}/${s.attTotal}人次` : '', color: PRIMARY },
    { label: '课堂优秀率', value: pct(s.clsA, s.clsTotal) ?? '–', sub: s.clsTotal ? `${s.clsA}/${s.clsTotal}人次获A` : '', color: '#b5791f' },
    { label: '作业提交率', value: pct(s.hwDone, s.hwTotal) ?? '–', sub: s.hwTotal ? `${s.hwDone}/${s.hwTotal}份` : '', color: '#2f7d5b' },
    { label: '表扬', value: s.highlights ? `${s.highlights}` : '–', sub: s.highlights ? '条亮点记录' : '', color: '#7a5c9e' },
  ]
  const sw = (cardW - gap * 3) / 4, statH = 168
  const statRow: Paint = {
    height: statH,
    draw: (ctx, x, y) => {
      stats.forEach((st, i) => {
        const sx = x + i * (sw + gap)
        roundRectPath(ctx, sx, y, sw, statH, 20)
        ctx.fillStyle = CARD_BG; ctx.fill()
        ctx.strokeStyle = '#e2eae6'; ctx.lineWidth = 2; ctx.stroke()
        ctx.textAlign = 'center'
        ctx.font = font(44, true); ctx.fillStyle = colorValue(st.color)!
        ctx.fillText(st.value, sx + sw / 2, y + 74)
        ctx.font = font(15); ctx.fillStyle = MUTED
        ctx.fillText(st.label, sx + sw / 2, y + 108)
        if (st.sub) { ctx.font = font(13); ctx.fillStyle = '#8a9a94'; ctx.fillText(st.sub, sx + sw / 2, y + 134) }
        ctx.textAlign = 'left'
      })
    },
  }

  const linesOf = (...keys: string[]) =>
    visibleBlocks(r).filter(b => keys.includes(b.key)).flatMap(b => b.lines).map(t => t.trim()).filter(Boolean)

  // ---- 本周关注（出勤异常 / 确认未交名单，取自真实 facts） ----
  const watch: string[] = []
  const matrix = (r.tables ?? []).find(t => t.kind === 'classroom' && t.facts?.length)
  if (matrix?.facts) {
    const names = matrix.rows.map(row => row[0])
    matrix.facts.forEach((row, i) => {
      const bad = row.some(f => f && ((f.field === 'attendance' && f.status && f.status !== 'NORMAL') || (f.field === 'submission' && f.status === 'MISSING_CONFIRMED')))
      if (bad && names[i] && !watch.includes(names[i])) watch.push(names[i])
    })
  }
  const watchCard: Paint | null = watch.length
    ? paintBulletCard({ title: '本周关注', accent: '#b4342a', lines: [`${watch.join('、')} — 出勤异常或作业未交，请关注`], emptyHint: '', width: cardW, kit })
    : null

  const summaryCard = paintBulletCard({ title: '本周总评', accent, lines: linesOf('teaching', 'learning'), emptyHint: '本周暂无总评', width: cardW, kit })

  const paints: Paint[] = [
    paintHeaderBand(r, version, width, margin, kit),
    statRow,
    ...(watchCard ? [watchCard] : []),
    summaryCard,
    ...reportTables(r).map(t => paintDataTable(t, cardW, kit, accent)),
    paintFooter(r, width, margin, kit),
  ]
  const totalH = paints.reduce((n, p) => n + p.height + gap, 0) + margin
  if (totalH > 30000) throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度')
  return [composeLongImage(paints, width, margin, gap)]
}
