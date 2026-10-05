import { type FrozenReport, type ReportTable } from './reports'
import { colorValue } from './report-customization'
import { classicMetadata } from './report-elements'

export type Paint = { height: number; draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void }

export type CanvasKit = {
  font: (size: number, bold?: boolean) => string
  wrap: (text: string, w: number, size: number, bold?: boolean) => string[]
}

/** 与 HTML 预览同一套视觉语言：深绿头图、13-14px 级正文 */
export function makeCanvasKit(r: FrozenReport): CanvasKit {
  const scratch = document.createElement('canvas').getContext('2d')
  if (!scratch) throw new Error('无法创建报告画布')
  const font = (size: number, bold = false) =>
    `${bold ? '600' : '400'} ${size}px "Noto Report", ${r.template.font === 'serif' ? 'serif' : 'sans-serif'}`
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
  return { font, wrap }
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) {
  const radC = Math.min(rad, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radC, y)
  ctx.arcTo(x + w, y, x + w, y + h, radC)
  ctx.arcTo(x + w, y + h, x, y + h, radC)
  ctx.arcTo(x, y + h, x, y, radC)
  ctx.arcTo(x, y, x + w, y, radC)
  ctx.closePath()
}

export const INK = '#263a33', MUTED = '#5f7168', PAGE_BG = '#f3f6f5', CARD_BG = '#ffffff', PRIMARY = '#245f50'

/** 把十六进制颜色按比例加深（用于头图渐变尾端，随主题走） */
export function darken(hex: string, factor = 0.72): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex) ?? /^#([0-9a-f]{3})$/i.exec(hex)
  if (!m) return '#1b4a3e'
  const full = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]
  const v = [0, 2, 4].map(i => Math.round(parseInt(full.slice(i, i + 2), 16) * factor))
  return `#${v.map(n => n.toString(16).padStart(2, '0')).join('')}`
}

export function reportTitle(r: FrozenReport) {
  return `${r.name} · ${r.kind === 'personal' ? '个人' : '班级'}周反馈`
}

/** 深绿头图：标题 + 元信息（含版本） */
export function paintHeaderBand(r: FrozenReport, version: string, width: number, margin: number, kit: CanvasKit): Paint {
  const { font, wrap } = kit
  const metaText = [version, ...classicMetadata(r)].filter(Boolean).join(' · ')
  const titleLines = wrap(reportTitle(r), width - margin * 2 - 40, 36, true)
  const metaLines = wrap(metaText, width - margin * 2 - 40, 18)
  const height = 64 + titleLines.length * 36 * 1.3 + 12 + metaLines.length * 18 * 1.5 + 56
  const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const primary = colorValue(r.template.color ?? PRIMARY)!
    const g = ctx.createLinearGradient(0, y, width, y + height)
    g.addColorStop(0, primary); g.addColorStop(1, darken(primary))
    ctx.fillStyle = g
    roundRectPath(ctx, x, y, width - margin * 2, height, 24); ctx.fill()
    ctx.textAlign = 'left'
    let ty = y + 64
    ctx.font = font(36, true); ctx.fillStyle = '#ffffff'
    titleLines.forEach((text, i) => { ctx.fillText(text, x + 40, ty + 36 + i * 36 * 1.3) })
    ty += titleLines.length * 36 * 1.3 + 12
    ctx.font = font(18); ctx.fillStyle = '#dcebe4'
    metaLines.forEach((text, i) => { ctx.fillText(text, x + 40, ty + 18 + i * 18 * 1.5) })
  }
  return { height, draw }
}

/** 页脚：教师 · 周期 */
export function paintFooter(r: FrozenReport, width: number, margin: number, kit: CanvasKit): Paint {
  const { font, wrap } = kit
  const lines = wrap(`${r.teacher} · ${r.period}`, width - margin * 2, 14)
  const height = lines.length * 14 * 1.5 + 40
  const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.font = font(14); ctx.fillStyle = MUTED; ctx.textAlign = 'center'
    lines.forEach((text, i) => ctx.fillText(text, x + (width - margin * 2) / 2, y + 20 + 14 + i * 14 * 1.5))
    ctx.textAlign = 'left'
  }
  return { height, draw }
}

/** 左侧强调条 + 标题 + 要点列表的通用卡片 */
export function paintBulletCard(opts: {
  title: string; accent: string; lines: string[]; emptyHint: string
  width: number; kit: CanvasKit; numbered?: boolean
}): Paint {
  const { title, accent, lines, emptyHint, width, kit, numbered } = opts
  const { font, wrap } = kit
  const bodyW = width - 72 - 28
  const rows = lines.length ? lines : [emptyHint]
  const rowLines = rows.map((text, i) => wrap((lines.length ? (numbered ? `${i + 1}. ` : '•  ') : '') + text, bodyW, 17))
  const titleH = 36 + 22 * 1.4 + 14
  const bodyH = rowLines.reduce((n, ls) => n + ls.length * 17 * 1.7 + 10, 0)
  const height = titleH + bodyH + 36
  const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save()
    ctx.shadowColor = 'rgba(36,95,80,0.08)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6
    roundRectPath(ctx, x, y, width, height, 24)
    ctx.fillStyle = CARD_BG; ctx.fill()
    ctx.restore()
    roundRectPath(ctx, x, y, width, height, 24)
    ctx.strokeStyle = '#e2eae6'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = colorValue(accent)!
    roundRectPath(ctx, x, y + 28, 8, height - 56, 4); ctx.fill()
    ctx.font = font(22, true); ctx.fillStyle = INK; ctx.textAlign = 'left'
    const tY = y + 36
    ctx.fillText(title, x + 36, tY + 22)
    ctx.fillStyle = colorValue(accent)!
    ctx.beginPath(); ctx.arc(x + 36 - 16, tY + 22 * 0.62, 7, 0, Math.PI * 2); ctx.fill()
    ctx.font = font(17); ctx.fillStyle = lines.length ? INK : MUTED
    let ly = y + titleH
    rowLines.forEach(ls => {
      ls.forEach((text, i) => { ctx.fillText(text, x + 36 + 14, ly + 17 + i * 17 * 1.7) })
      ly += ls.length * 17 * 1.7 + 10
    })
  }
  return { height, draw }
}

/** 数据表：标题 + 表头 + 斑马纹行（与 HTML 预览一致，核心数据不缺席） */
export function paintDataTable(table: ReportTable, availW: number, kit: CanvasKit, accent = PRIMARY): Paint {
  const { font, wrap } = kit
  const cols = Math.max(1, table.headers[0]?.reduce((n, c) => n + (c.span ?? 1), 0) ?? 1)
  const cellW = availW / cols
  const size = 13, pad = 6, lineH = size * 1.4, tSize = 16
  const titleLines = wrap(table.title, availW, tSize, true)
  const titleH = titleLines.length * tSize * 1.35 + 12
  const hHs = table.headers.map(row => {
    let h = lineH + pad * 2
    row.forEach(c => {
      if (c.rowSpan === 2) return
      const w = (c.span ?? 1) * cellW - pad * 2
      h = Math.max(h, wrap(c.text, Math.max(24, w), size, true).length * lineH + pad * 2)
    })
    return h
  })
  const headerH = hHs.reduce((a, b) => a + b, 0)
  const rowHs = table.rows.map(row => {
    let h = lineH + pad * 2
    row.forEach(cell => { h = Math.max(h, wrap(cell || '', Math.max(24, cellW - pad * 2), size).length * lineH + pad * 2) })
    return h
  })
  const height = titleH + 8 + headerH + rowHs.reduce((a, b) => a + b, 0) + 8
  const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.textAlign = 'left'
    ctx.font = font(tSize, true); ctx.fillStyle = colorValue(accent)!
    titleLines.forEach((text, i) => ctx.fillText(text, x, y + tSize + i * tSize * 1.35))
    let ty = y + titleH + 8
    table.headers.forEach((row, ri) => {
      let col = ri === 1 ? (table.identityColumns ?? 0) : 0
      row.forEach(c => {
        const span = c.span ?? 1, w = span * cellW
        const h = c.rowSpan === 2 ? headerH : hHs[ri]
        const cx = x + col * cellW
        ctx.fillStyle = '#edf2ef'; ctx.fillRect(cx, ty, w, h)
        ctx.strokeStyle = '#dbe3df'; ctx.lineWidth = 1; ctx.strokeRect(cx, ty, w, h)
        ctx.font = font(size, true); ctx.fillStyle = colorValue(accent)!
        const lines = wrap(c.text, Math.max(24, w - pad * 2), size, true)
        lines.forEach((text, i) => ctx.fillText(text, cx + pad, ty + pad + size + i * lineH))
        col += span
      })
      ty += hHs[ri]
    })
    table.rows.forEach((row, i) => {
      const rh = rowHs[i]
      row.forEach((cell, ci) => {
        const cx = x + ci * cellW
        if (i % 2) { ctx.fillStyle = '#f6f8f7'; ctx.fillRect(cx, ty, cellW, rh) }
        ctx.strokeStyle = '#dbe3df'; ctx.lineWidth = 1; ctx.strokeRect(cx, ty, cellW, rh)
        ctx.font = font(size); ctx.fillStyle = INK
        const lines = wrap(cell || '', Math.max(24, cellW - pad * 2), size)
        lines.forEach((text, li) => ctx.fillText(text, cx + pad, ty + pad + size + li * lineH))
      })
      ty += rh
    })
  }
  return { height, draw }
}

/** 组装整张长图：各 Paint 纵向堆叠 */
export function composeLongImage(paints: Paint[], width: number, margin: number, gap: number): string {
  const totalH = paints.reduce((n, p) => n + p.height + gap, 0) + margin
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = Math.ceil(totalH)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建报告画布')
  ctx.fillStyle = PAGE_BG; ctx.fillRect(0, 0, canvas.width, canvas.height)
  let y = margin
  for (const p of paints) { p.draw(ctx, margin, y); y += p.height + gap }
  return canvas.toDataURL('image/png')
}

export const reportTables = (r: FrozenReport) =>
  (r.tables ?? []).filter(t => t.kind === 'classroom' || t.kind === 'homework' || t.kind === 'lessons')
