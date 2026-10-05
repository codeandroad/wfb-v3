import { type FrozenReport, visibleBlocks } from './reports'
import { resolveElement, colorValue, type ElementStyle } from './report-customization'
import { classicMetadata } from './report-elements'

type Paint = { height: number; draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void }

const briefFont = (r: FrozenReport, size: number, bold = false) =>
  `${bold ? '600' : '400'} ${size}px "Noto Report", ${r.template.font === 'serif' ? 'serif' : 'sans-serif'}`

type BriefCard = { title: string; accent: string; lines: string[]; emptyHint: string }

/** 三卡片内容映射：班级报告取总评 / 数据一览 / 下周预告；个人报告取点评 / 课堂作业 / 下周安排 */
function briefCards(r: FrozenReport): BriefCard[] {
  const blocks = visibleBlocks(r)
  const linesOf = (...keys: string[]) =>
    blocks.filter(b => keys.includes(b.key)).flatMap(b => b.lines).map(s => s.trim()).filter(Boolean)
  if (r.kind === 'personal') {
    return [
      { title: '个人点评', accent: '#245f50', lines: linesOf('comment'), emptyHint: '本周暂无个人点评' },
      { title: '课堂与作业', accent: '#b5791f', lines: linesOf('classroom', 'homework'), emptyHint: '本周暂无记录' },
      { title: '下周安排', accent: '#2f7d5b', lines: linesOf('next', 'highlights'), emptyHint: '暂无' },
    ]
  }
  return [
    { title: '本周总评', accent: '#245f50', lines: linesOf('teaching', 'learning'), emptyHint: '本周暂无总评' },
    { title: '数据一览', accent: '#b5791f', lines: linesOf('classroom', 'homework', 'highlights'), emptyHint: '本周暂无记录' },
    { title: '下周预告', accent: '#2f7d5b', lines: linesOf('next'), emptyHint: '暂无' },
  ]
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) {
  const radC = Math.min(rad, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radC, y)
  ctx.arcTo(x + w, y, x + w, y + h, radC)
  ctx.arcTo(x + w, y + h, x, y + h, radC)
  ctx.arcTo(x, y + h, x, y, radC)
  ctx.arcTo(x, y, x + w, y, radC)
  ctx.closePath()
}

export function renderBriefImages(r: FrozenReport): string[] {
  const width = 1080, margin = 48, gap = 28
  const ink = '#263a33', muted = '#5f7168', pageBg = '#f3f6f5', cardBg = '#ffffff'
  const font = (size: number, bold = false) => briefFont(r, size, bold)
  const scratch = document.createElement('canvas').getContext('2d')
  if (!scratch) throw new Error('无法创建报告画布')
  const wrap = (text: string, w: number, size: number, bold = false): string[] => {
    scratch.font = font(size, bold)
    const result: string[] = []
    for (const paragraph of text.split('\n')) {
      let line = ''
      for (const char of paragraph) {
        if (line && scratch.measureText(line + char).width > w) { result.push(line); line = '' }
        line += char
      }
      result.push(line)
    }
    return result
  }

  // ---- 头部横幅 ----
  const metaText = classicMetadata(r).filter(Boolean).join(' · ')
  const titleStyle = resolveElement(r.template.customization, 'brief.header.title', { size: 36, weight: 600, color: '#ffffff', lineHeight: 1.3 } as ElementStyle)
  const metaStyle = resolveElement(r.template.customization, 'brief.header.meta', { size: 18, weight: 400, color: '#dcebe4', lineHeight: 1.5 } as ElementStyle)
  const titleLines = wrap(r.kind === 'personal' ? `${r.name} · 周反馈` : `${r.name}周反馈`, width - margin * 2 - 40, titleStyle.size!)
  const metaLines = wrap(metaText, width - margin * 2 - 40, metaStyle.size!)
  const headerH = 64 + titleLines.length * titleStyle.size! * titleStyle.lineHeight! + 12 + metaLines.length * metaStyle.size! * metaStyle.lineHeight! + 56

  // ---- 卡片 ----
  const cardW = width - margin * 2
  const cards = briefCards(r).map(card => {
    const tStyle = resolveElement(r.template.customization, 'brief.card.title', { size: 22, weight: 600, color: ink, lineHeight: 1.4, padding: 36 } as ElementStyle)
    const bStyle = resolveElement(r.template.customization, 'brief.card.body', { size: 17, weight: 400, color: ink, lineHeight: 1.7, padding: 36 } as ElementStyle)
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
      ctx.fillStyle = colorValue(cardBg)!; ctx.fill()
      ctx.restore()
      roundRectPath(ctx, x, y, cardW, height, 24)
      ctx.strokeStyle = '#e2eae6'; ctx.lineWidth = 2; ctx.stroke()
      // 左侧强调条
      ctx.fillStyle = colorValue(card.accent)!
      roundRectPath(ctx, x, y + 28, 8, height - 56, 4); ctx.fill()
      // 标题
      ctx.font = font(tStyle.size!, true); ctx.fillStyle = colorValue(tStyle.color!)!; ctx.textAlign = 'left'
      const tY = y + tStyle.padding!
      ctx.fillText(card.title, x + tStyle.padding!, tY + tStyle.size!)
      ctx.fillStyle = colorValue(card.accent)!
      ctx.beginPath(); ctx.arc(x + tStyle.padding! - 16, tY + tStyle.size! * 0.62, 7, 0, Math.PI * 2); ctx.fill()
      // 正文
      ctx.font = font(bStyle.size!); ctx.fillStyle = colorValue(card.lines.length ? bStyle.color! : muted)!
      let ly = y + titleH
      rowLines.forEach(lines => {
        lines.forEach((text, i) => { ctx.fillText(text, x + bStyle.padding! + 14, ly + bStyle.size! + i * bStyle.size! * bStyle.lineHeight!) })
        ly += lines.length * bStyle.size! * bStyle.lineHeight! + 10
      })
      ctx.textAlign = 'left'
    }
    return { height, draw }
  })

  const footerStyle = resolveElement(r.template.customization, 'brief.footer', { size: 14, weight: 400, color: muted, lineHeight: 1.5 } as ElementStyle)
  const footerText = `${r.teacher} · ${r.period}`
  const footerH = footerStyle.size! * footerStyle.lineHeight! + 40
  const totalH = headerH + gap + cards.reduce((n, c) => n + c.height + gap, 0) + footerH + margin
  if (totalH > 30000) throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度')

  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = Math.ceil(totalH)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法生成报告')
  ctx.fillStyle = colorValue(pageBg)!; ctx.fillRect(0, 0, width, totalH)

  // 头部横幅：深绿底
  const headGrad = ctx.createLinearGradient(0, 0, width, headerH)
  headGrad.addColorStop(0, colorValue(r.template.color ?? '#245f50')!); headGrad.addColorStop(1, '#1b4a3e')
  ctx.fillStyle = headGrad; ctx.fillRect(0, 0, width, headerH)
  ctx.textAlign = 'left'
  let hy = 64
  ctx.font = font(titleStyle.size!, true); ctx.fillStyle = colorValue(titleStyle.color!)!
  titleLines.forEach((text, i) => { ctx.fillText(text, margin + 20, hy + titleStyle.size! + i * titleStyle.size! * titleStyle.lineHeight!) })
  hy += titleLines.length * titleStyle.size! * titleStyle.lineHeight! + 12
  ctx.font = font(metaStyle.size!); ctx.fillStyle = colorValue(metaStyle.color!)!
  metaLines.forEach((text, i) => { ctx.fillText(text, margin + 20, hy + metaStyle.size! + i * metaStyle.size! * metaStyle.lineHeight!) })

  // 卡片
  let y = headerH + gap
  for (const card of cards) { card.draw(ctx, margin, y); y += card.height + gap }

  // 页脚
  ctx.font = font(footerStyle.size!); ctx.fillStyle = colorValue(footerStyle.color!)!; ctx.textAlign = 'center'
  ctx.fillText(footerText, width / 2, y + 20 + footerStyle.size!)
  ctx.textAlign = 'left'

  return [canvas.toDataURL('image/png')]
}
