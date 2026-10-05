import { type FrozenReport, type ReportTable, visibleBlocks } from './reports'
import { computeStats, pct, gradeDistribution, parseHighlights, followUps, studentSummaries } from './report-stats'
import {
  makeCanvasKit, roundRectPath, paintHeaderBand, paintFooter, paintDataTable,
  composeLongImage, INK, MUTED, CARD_BG, PRIMARY, darken, type Paint,
} from './report-canvas-shared'
import { colorValue } from './report-customization'

/** C12 班级仪表盘 canvas 导出：3 tiles + 等级分布条形图 + 徽章墙 + 待跟进 + 汇总表（对标 preview.html 样式三） */
export function renderDashboardImages(r: FrozenReport, version = '未发布预览稿', scale = 1): string[] {
  const width = 1080, margin = 48, gap = 28
  const kit = makeCanvasKit(r)
  const { font, wrap } = kit
  const cardW = width - margin * 2
  const primary = r.template.color ?? PRIMARY
  const s = computeStats(r)

  // ---- 3 tiles ----
  const tiles = [
    { num: pct(s.attNormal, s.attTotal) ?? '–', lbl: '本周出勤率', sub: s.attTotal ? `异常 ${s.attTotal - s.attNormal} 人次` : '' },
    { num: pct(s.hwDone, s.hwTotal) ?? '–', lbl: '作业提交率', sub: s.hwTotal ? `${s.hwTotal - s.hwDone} 人次待补交` : '' },
    { num: pct(s.clsA, s.clsTotal) ?? '–', lbl: '课堂 A 及以上', sub: s.clsTotal ? `${s.clsTotal} 人次` : '' },
  ]
  const tw = (cardW - gap * 2) / 3, tileH = 190
  const tileRow: Paint = {
    height: tileH,
    draw: (ctx, x, y) => {
      tiles.forEach((t2, i) => {
        const sx = x + i * (tw + gap)
        roundRectPath(ctx, sx, y, tw, tileH, 24)
        ctx.fillStyle = CARD_BG; ctx.fill()
        ctx.strokeStyle = '#eee9db'; ctx.lineWidth = 2; ctx.stroke()
        ctx.textAlign = 'center'
        ctx.font = font(56, true); ctx.fillStyle = colorValue(primary)!
        ctx.fillText(t2.num, sx + tw / 2, y + 86)
        ctx.font = font(17, true); ctx.fillStyle = INK
        ctx.fillText(t2.lbl, sx + tw / 2, y + 126)
        if (t2.sub) { ctx.font = font(15); ctx.fillStyle = MUTED; ctx.fillText(t2.sub, sx + tw / 2, y + 154) }
        ctx.textAlign = 'left'
      })
    },
  }

  const panelShell = (title: string, contentH: number, drawContent: (ctx: CanvasRenderingContext2D, x: number, y: number) => void): Paint => {
    const height = 36 + 30 + 16 + contentH + 36
    const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      roundRectPath(ctx, x, y, cardW, height, 24)
      ctx.fillStyle = CARD_BG; ctx.fill()
      ctx.strokeStyle = '#eee9db'; ctx.lineWidth = 2; ctx.stroke()
      ctx.font = font(22, true); ctx.fillStyle = INK; ctx.textAlign = 'left'
      ctx.fillText(title, x + 40, y + 36 + 22)
      drawContent(ctx, x + 40, y + 36 + 30 + 16)
    }
    return { height, draw }
  }

  // ---- 等级分布条形图 ----
  const dist = gradeDistribution(r)
  const maxCount = Math.max(1, ...dist.map(d => d.count))
  const barPanel: Paint | null = dist.length ? panelShell(`课堂表现等级分布（三天综合 · ${s.clsTotal} 人次）`, dist.length * 44, (ctx, x, y) => {
    const trackW = cardW - 80 - 120
    dist.forEach((d, i) => {
      const by = y + i * 44
      ctx.font = font(18, true); ctx.fillStyle = MUTED; ctx.textAlign = 'left'
      ctx.fillText(d.grade, x, by + 20)
      const tx = x + 60, bw = Math.max(8, (d.count / maxCount) * trackW)
      ctx.fillStyle = '#f2efe9'
      roundRectPath(ctx, tx, by + 6, trackW, 22, 11); ctx.fill()
      const g = ctx.createLinearGradient(tx, 0, tx + bw, 0)
      const pc = colorValue(primary)!
      g.addColorStop(0, pc + '99'); g.addColorStop(1, pc)
      ctx.fillStyle = g
      roundRectPath(ctx, tx, by + 6, bw, 22, 11); ctx.fill()
      ctx.font = font(17); ctx.fillStyle = MUTED; ctx.textAlign = 'right'
      ctx.fillText(`${d.count}`, x + cardW - 80, by + 22)
      ctx.textAlign = 'left'
    })
  }) : null

  // ---- 徽章墙 ----
  const badges = parseHighlights(r)
  const badgeCols = 2, badgeW = (cardW - 80 - gap) / badgeCols, badgeH = 110
  const badgePanel: Paint | null = badges.length ? panelShell('本周徽章', Math.ceil(badges.length / badgeCols) * (badgeH + 16), (ctx, x, y) => {
    const colors = [primary, '#b98a2f', '#5a8a9a', '#8a5a9a']
    badges.forEach((b, i) => {
      const bx = x + (i % badgeCols) * (badgeW + gap), by = y + Math.floor(i / badgeCols) * (badgeH + 16)
      roundRectPath(ctx, bx, by, badgeW, badgeH, 18)
      ctx.fillStyle = '#faf8f2'; ctx.fill()
      ctx.strokeStyle = '#eee9db'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.fillStyle = colorValue(colors[i % 4])!
      ctx.beginPath(); ctx.arc(bx + 52, by + badgeH / 2, 34, 0, Math.PI * 2); ctx.fill()
      ctx.font = font(26, true); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'
      ctx.fillText((b.name || '赞')[0], bx + 52, by + badgeH / 2 + 9)
      ctx.textAlign = 'left'
      ctx.font = font(19, true); ctx.fillStyle = INK
      ctx.fillText(b.name || '同学', bx + 104, by + 42)
      ctx.font = font(16); ctx.fillStyle = MUTED
      wrap(b.reason, badgeW - 120, 16).slice(0, 2).forEach((t2, j) => ctx.fillText(t2, bx + 104, by + 68 + j * 24))
    })
  }) : null

  // ---- 待跟进 ----
  const fu = followUps(r)
  const next = visibleBlocks(r).filter(b => b.key === 'next').flatMap(b => b.lines).map(x => x.trim()).filter(Boolean)
  const todos = [
    `作业待补交：${fu.homework.length ? fu.homework.join('、') : '无'}`,
    `出勤异常：${fu.leave.length ? fu.leave.join('、') : '无'}`,
    `下周预告：${next[0] ?? '暂无'}`,
  ]
  const todoLines = todos.flatMap(t2 => wrap(t2, cardW - 80, 19))
  const todoPanel = panelShell('待跟进', todoLines.length * 19 * 1.7, (ctx, x, y) => {
    ctx.font = font(19); ctx.fillStyle = '#4a463c'; ctx.textAlign = 'left'
    todoLines.forEach((t2, i) => ctx.fillText(t2, x, y + 19 + i * 19 * 1.7))
  })

  // ---- 汇总表 ----
  const summaries = studentSummaries(r)
  const summaryTable: ReportTable = {
    title: '详细出勤与成绩表', kind: 'classroom',
    headers: [[{ text: '姓名' }, { text: '出勤' }, { text: '课堂表现' }, { text: '作业' }]],
    rows: summaries.map(x => [x.name, x.attendance, x.classroom, x.homework]),
  }

  const paints: Paint[] = [
    paintHeaderBand(r, version, width, margin, kit),
    tileRow,
    ...(barPanel ? [barPanel] : []),
    ...(badgePanel ? [badgePanel] : []),
    todoPanel,
    ...(summaries.length ? [paintDataTable(summaryTable, cardW, kit, primary)] : []),
    paintFooter(r, width, margin, kit),
  ]
  const totalH = paints.reduce((n, p) => n + p.height + gap, 0) + margin
  if (totalH > 30000) throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度')
  return [composeLongImage(paints, width, margin, gap, scale)]
}
