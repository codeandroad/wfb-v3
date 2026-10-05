import { renderClassicImages } from './report-classic-export'
import { renderTableImages } from './report-table-export'
import { renderBriefImages } from './report-brief-export'
import { zipSync, strToU8 } from 'fflate'
import type { Publication } from './model'
import { reportFilename, validTemplate, type FrozenReport } from './reports'

export async function renderReportImages(report: FrozenReport, version: string): Promise<string[]> {
  if(!validTemplate(report.template)) throw new Error('报告配置无效，请检查字号、颜色对比度与分页设置。')
  const loaded = await document.fonts.load('22px "Noto Report"', '教学反馈')
  if (!loaded.length) throw new Error('中文报告字体加载失败，请重试，未输出空白图片')
  await document.fonts.ready
  if (report.template.layout === 'brief') return renderBriefImages(report)
  return report.template.options?.classic ? renderClassicImages(report) : renderTableImages(report,version)
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
