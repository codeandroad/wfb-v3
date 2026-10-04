'use client'
import { type ReportTemplate, validTemplate } from '@/lib/mt/reports'
import { ReportOptionsEditor } from './report-options-editor'
import { Btn } from './ui'

export function ReportStyleAdjustment({ personal, classTemplate, onChange, onSave }: { personal?: ReportTemplate; classTemplate?: ReportTemplate; onChange: (t: ReportTemplate) => void; onSave: (t: ReportTemplate) => void }) {
  return <details className="rounded-lg border border-border bg-card p-3"><summary className="cursor-pointer text-sm font-semibold">修改报告样式（仅本次）</summary><div className="flex flex-col gap-3 pt-3">{[classTemplate, personal].filter((t): t is ReportTemplate => !!t).map(t => <section key={t.kind} className="flex flex-col gap-2"><h3 className="text-sm font-semibold">{t.kind === 'class' ? '班级报告' : '个人报告'}</h3><ReportOptionsEditor value={t} onChange={onChange}/><Btn size="sm" disabled={!validTemplate(t)} onClick={() => onSave(t)}>保存为我的{t.kind === 'class' ? '班级' : '个人'}样式</Btn></section>)}</div></details>
}
