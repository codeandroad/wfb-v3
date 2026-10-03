import { visibleBlocks, type FrozenReport } from '@/lib/mt/reports'
import { cn } from '@/lib/utils'

export function ReportView({ report, version = '未发布预览稿' }: { report: FrozenReport; version?: string }) {
  const t = report.template
  return <article data-testid="report-view" className={cn('flex flex-col gap-5 rounded-lg border border-border p-6 text-sm leading-relaxed', t.font === 'serif' ? 'font-serif' : 'font-sans')} style={{ background: t.background, color: '#263a33', fontFamily: t.font === 'serif' ? 'Georgia, "Noto Report", serif' : '"Noto Report", sans-serif' }}>
    <header className="flex flex-col gap-1 border-b border-border pb-4">
      <p className="text-sm" style={{ color: t.color }}>{report.kind === 'personal' ? '个人反馈' : report.audience === 'internal' ? '班级反馈 · 校内核对版' : '班级反馈 · 家长阅读版'}</p>
      <h2 className="text-xl font-semibold text-balance">{report.name}</h2><p>{report.scope}</p><p>{report.period}{report.stage ? ' · 本周阶段反馈' : ''}</p><p className="text-sm">{version} · 责任教师：{report.teacher}</p>
      {report.audience === 'internal' ? <p>仅供有权教职工核对，不向家长交付。</p> : null}
    </header>
    {t.opening.trim() ? <p className="whitespace-pre-wrap break-words">{t.opening}</p> : null}
    {visibleBlocks(report).map(block => <section key={block.key} className="flex flex-col gap-2">
      <h3 className={cn('text-base', t.bold && 'font-semibold')} style={{ color: t.color }}>{block.title}</h3>
      {t.layout === 'table' ? <table className="w-full table-fixed border-collapse"><tbody>{block.lines.map((text, i) => <tr key={i}><td className="whitespace-pre-wrap break-words border border-border p-2">{text}</td></tr>)}</tbody></table> : t.layout === 'timeline' && block.key === 'classroom' ? <ol className="flex flex-col gap-3">{block.lines.map((text, i) => <li key={i} className="whitespace-pre-wrap break-words border-b border-border pb-2">{text}</li>)}</ol> : <div className={cn('flex flex-col', t.layout === 'letter' ? 'gap-4 leading-loose' : 'gap-2')}>{block.lines.map((text, i) => <p className="whitespace-pre-wrap break-words" key={i}>{text}</p>)}</div>}
    </section>)}
    {t.closing.trim() ? <p className="whitespace-pre-wrap break-words">{t.closing}</p> : null}
    <footer className="border-t border-border pt-3 text-sm">内容截止：{report.cutoff.replace('T', ' ').slice(0, 16)}</footer>
  </article>
}
