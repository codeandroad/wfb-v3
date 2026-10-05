'use client'

import type { Publication } from '@/lib/mt/model'
import { ReportView } from './report-view'
import { roomStudents } from '@/lib/mt/publication-tracking'

export function PublicationReader({ publication: p, room }: { publication: Publication; room?: string }) {
  const students = room ? roomStudents(p, room) : p.students
  const reports = (p.reports ?? []).filter(r => !room || (r.audience === 'parent' && (r.kind === 'class' || students.some(s => s.studentId === r.studentId))))
  if (p.withdrawn) return <p role="status">此版本已撤回，不再提供报告读取。</p>
  return <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-foreground">
    <h3 className="text-lg font-semibold">{p.classNameFormal} · 第 {p.week} 周 · V{p.revision}</h3>
    <p className="text-sm text-muted-foreground">只读发布快照 · {new Date(p.publishedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
    <p className="whitespace-pre-wrap text-sm">{p.publicSummary || '未填写公共总结'}</p>
    {reports.map(r => <details key={r.key}><summary className="cursor-pointer text-sm font-medium text-primary">查看{r.kind === 'class' ? '教学班' : '个人'}报告 · {r.name}</summary><ReportView report={r} version={`已发布 V${p.revision}`} /></details>)}
    <details open={!reports.length}><summary className="cursor-pointer text-sm font-medium">{room ? '本班' : '报告'}学生反馈摘要（{students.length} 人）</summary>
      <div className="flex flex-col gap-3 py-3">{students.map(s => <div key={s.studentId} className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm text-foreground"><h4 className="font-semibold">{s.name}</h4>{s.days.map(d => <p key={d.date}>{d.date} · 出勤：{d.attendance.map(a => a.v).join('、') || '未记录'} · 课堂：{d.grade ?? '未评价'}</p>)}<p>教师评语：{s.comment || '未填写'}</p><p>亮点：{s.highlights.join('；') || '暂无'}</p>{s.homework.map((h,i) => <p key={`${h.assignmentId}-${i}`}>{h.title}：{h.status}</p>)}</div>)}</div>
    </details>
  </section>
}
