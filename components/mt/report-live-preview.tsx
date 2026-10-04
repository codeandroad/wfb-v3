'use client'
import { useState } from 'react'
import { type FrozenReport } from '@/lib/mt/reports'
import { ReportView } from './report-view'

export function ReportLivePreview({ reports }: { reports: FrozenReport[] }) {
  const [selected, setSelected] = useState('')
  const report = reports.find(r => r.key === selected) ?? reports[0]
  return <section aria-label="实时报告预览" className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3 lg:sticky lg:top-20"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">实时预览</h2><span className="text-sm text-muted-foreground">修改自动更新 · 未发布</span></div>{report ? <><select aria-label="实时预览对象" className="w-full min-w-0 rounded border border-input p-1 text-sm" value={report.key} onChange={e => setSelected(e.target.value)}>{reports.map(r => <option key={r.key} value={r.key}>{r.name} · {r.kind === 'personal' ? '个人' : r.audience === 'internal' ? '校内核对' : '班级家长'}</option>)}</select><ReportView report={report} adaptive /></> : <p className="text-sm text-muted-foreground">选择报告类型和受众后，即可实时预览。</p>}</section>
}
