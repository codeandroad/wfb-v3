import { renderTableImages } from './report-table-export'
import { zipSync, strToU8 } from 'fflate'
import type { Publication } from './model'
import { reportFilename, visibleBlocks, type FrozenReport } from './reports'

export async function renderReportImages(report: FrozenReport, version: string): Promise<string[]> {
  const loaded = await document.fonts.load('22px "Noto Report"', '教学反馈')
  if (!loaded.length) throw new Error('中文报告字体加载失败，请重试，未输出空白图片')
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = 900
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('此浏览器无法生成图片')
  const t = report.template
  const family = t.font === 'serif' ? 'Georgia, "Noto Report", serif' : '"Noto Report", sans-serif'
  type Row = { text: string; heading?: boolean }
  const groups: Row[][] = []
  const wrap = (text: string, heading = false): Row[] => {
    ctx.font = `${heading ? '600 ' : ''}${heading ? 25 : 22}px ${family}`
    const out: Row[] = []
    for (const paragraph of text.split('\n')) {
      let line = ''
      for (const char of paragraph) {
        if (ctx.measureText(line + char).width > 800 && line) { out.push({ text: line, heading }); line = '' }
        line += char
      }
      out.push({ text: line, heading })
    }
    return out
  }
  if (t.opening.trim()) groups.push(wrap(t.opening))
  for (const block of visibleBlocks(report)) {
    block.lines.forEach((text, index) => groups.push([...(index === 0 ? wrap(block.title, true) : []), ...wrap(`${t.layout === 'timeline' && block.key === 'classroom' ? '日期 · ' : ''}${text}`)]))
  }
  if (t.closing.trim()) groups.push(wrap(t.closing))
  const pages: Row[][] = [[]]
  const maxRows = 30
  for (const group of groups) {
    if (group.length <= maxRows && pages.at(-1)!.length + group.length > maxRows) pages.push([])
    for (const row of group) { if (pages.at(-1)!.length === maxRows) pages.push([]); pages.at(-1)!.push(row) }
  }
  return pages.map((rows, page) => {
    canvas.height = 260 + rows.length * 36 + 70
    ctx.fillStyle = t.background; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = t.color; ctx.fillRect(0, 0, canvas.width, 8)
    ctx.font = `600 28px ${family}`; ctx.fillText(`${report.kind === 'personal' ? '个人反馈' : report.audience === 'internal' ? '班级反馈 · 校内核对' : '班级反馈'} · ${report.name}`, 48, 55, 802)
    ctx.fillStyle = '#263a33'; ctx.font = `20px ${family}`
    ctx.fillText(report.scope, 48, 92, 802); ctx.fillText(`${report.period}${report.stage ? ' · 本周阶段反馈' : ''}`, 48, 127, 802)
    ctx.fillText(`${version} · 截止 ${report.cutoff.slice(0, 16).replace('T', ' ')}`, 48, 162, 802)
    ctx.fillText(`责任教师：${report.teacher}${report.audience === 'internal' ? ' · 不得向家长交付本核对版' : ''}`, 48, 197, 802)
    rows.forEach((row, i) => {
      const y = 252 + i * 36
      ctx.font = `${row.heading && t.bold ? '600 ' : ''}${row.heading ? 25 : 22}px ${family}`
      ctx.fillStyle = row.heading ? t.color : '#263a33'
      if (t.layout === 'table') { ctx.strokeStyle = '#d8e1dc'; ctx.strokeRect(42, y - 27, 816, 36) }
      ctx.fillText(row.text, 48, y)
    })
    ctx.font = `18px ${family}`; ctx.fillStyle = '#263a33'; ctx.fillText(`第 ${page + 1} / ${pages.length} 张 · ${report.name}`, 48, canvas.height - 28)
    const data = canvas.toDataURL('image/png')
    if (!data.startsWith('data:image/png;base64,') || data.length < 1000) throw new Error('图片生成失败，未得到有效PNG')
    return data
  }).concat(renderTableImages(report, version))
}
export function downloadFile(data: Blob | string, filename: string) {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function exportReportZip(pub: Publication, reports: FrozenReport[]) {
  const files: Record<string, Uint8Array> = {}
  const manifest: { object: string; files: string[]; error?: string }[] = []
  for (const report of reports) {
    const row: typeof manifest[number] = { object: report.name, files: [] }
    try {
      const images = await renderReportImages(report, `第 ${pub.revision} 版 · 发布于 ${pub.publishedAt}`)
      images.forEach((image, index) => {
        const filename = reportFilename(pub, report, index + 1)
        files[filename] = Uint8Array.from(atob(image.split(',')[1]), c => c.charCodeAt(0)); row.files.push(filename)
      })
    } catch (e) { row.error = e instanceof Error ? e.message : '生成失败' }
    manifest.push(row)
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  files['清单.json'] = strToU8(JSON.stringify({ week: pub.week, revision: pub.revision, count: reports.length, reports: manifest }, null, 2))
  if (manifest.every(r => r.error)) throw new Error('全部报告生成失败')
  const bytes = zipSync(files)
  return { blob: new Blob([new Uint8Array(bytes)], { type: 'application/zip' }), failed: manifest.filter(r => r.error).length }
}
