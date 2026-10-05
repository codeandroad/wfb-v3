"use client"

import { useState } from 'react'
import { Badge, Card, CardHeader, EmptyState } from '@/components/kit'
import { useMt } from '@/lib/mt/store'
import { taskById, teacherName } from '@/lib/mt/model'
import { homeroomPublications, roomStudents } from '@/lib/mt/publication-tracking'
import { ReportView } from './report-view'

export function HomeroomPublications({ room }: { room: string }) {
  const mt = useMt()
  const [week, setWeek] = useState('')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const all = homeroomPublications(mt.biz, room)
  const rows = all.filter(p => (!week || p.week === Number(week)) && `${p.classNameFormal}${p.courseName}${p.reports?.map(r=>r.teacher).join('') ?? ''}${p.taskIds.map(id=>teacherName(taskById(id)?.teacher_id ?? '')).join('')}`.includes(query))
  if (!mt.ready) return <p role="status">正在读取本班反馈记录…</p>
  if (mt.loadError) return <EmptyState title="反馈记录读取失败" desc="请重试加载模拟存储。" />
  return <Card>
    <CardHeader title="本班关联教学班 · 已发布反馈" desc="按发布快照中的学生主班归属关联，不限学科或教学班。仅显示有效已发布版本；草稿和撤回报告不显示。" />
    <div className="flex flex-wrap items-center gap-3 p-5">
      <select aria-label="主班反馈周次" className="rounded-lg border border-input bg-card px-3 py-2 text-sm" value={week} onChange={e=>setWeek(e.target.value)}><option value="">全部周次</option>{[...new Set(all.map(p=>p.week))].map(w=><option key={w} value={w}>第 {w} 周</option>)}</select>
      <input aria-label="搜索主班反馈" className="rounded-lg border border-input bg-card px-3 py-2 text-sm" placeholder="搜索学科、教学班、教师" value={query} onChange={e=>setQuery(e.target.value)} />
      <span className="text-sm text-muted-foreground">{rows.length} 份反馈 · 只读</span>
    </div>
    <div className="flex flex-col gap-4 px-5 pb-5">{rows.map(p=>{
      const students = roomStudents(p, room)
      const reports = p.reports?.filter(r => r.audience === 'parent' && (r.kind === 'class' || students.some(s=>s.studentId===r.studentId))) ?? []
      return <article key={p.id} className="rounded-lg border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex flex-col gap-1"><h3 className="text-sm font-semibold">{p.classNameFormal} · {p.courseName}</h3><p className="text-sm text-muted-foreground">第 {p.week} 周 · 第 {p.revision} 版 · 本班 {students.length} 人 · {p.reports?.[0]?.teacher ?? [...new Set(p.taskIds.map(id=>teacherName(taskById(id)?.teacher_id ?? '未知教师')))].join('、')} · {new Date(p.publishedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</p></div><div className="flex items-center gap-3"><Badge tone="success">已发布</Badge><button aria-expanded={expanded===p.id} className="text-sm font-medium text-primary underline" onClick={()=>setExpanded(expanded===p.id?null:p.id)}>{expanded===p.id?'收起反馈':'查看反馈'}</button></div></div>
        {expanded===p.id && <div className="flex flex-col gap-4 border-t border-border p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.publicSummary || '未填写公共总结'}</p>
          {reports.map(r=><details key={r.key}><summary className="cursor-pointer text-sm font-medium">{r.kind==='class'?'教学班报告':'本班学生个人报告'} · {r.name}</summary><ReportView report={r} version={`已发布 V${p.revision}`} /></details>)}
          <h4 className="text-sm font-semibold">本班学生反馈摘要</h4>
          {students.map(s=><div key={s.studentId} className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm text-foreground"><p className="font-medium">{s.name}</p>{s.days.map(d=><p key={d.date}>{d.date} · 出勤：{d.attendance.map(a=>a.v).join('、') || '未记录'} · 课堂：{d.grade ?? '未评价'}</p>)}<p className="whitespace-pre-wrap">教师评语：{s.comment||'未填写'}</p><p>亮点：{s.highlights.join('；')||'暂无'}</p>{s.homework.map((h,i)=><p key={`${h.assignmentId}-${i}`}>{h.title}：{h.status}</p>)}</div>)}
        </div>}
      </article>
    })}{!rows.length && <EmptyState title="暂无符合条件的已发布反馈" desc="任课教师发布包含本班学生的反馈后，会自动出现在这里；可尝试清除筛选。" />}</div>
  </Card>
}
