'use client'

import { useState } from 'react'
import { useMt } from '@/lib/mt/store'
import { TASKS, teacherName } from '@/lib/mt/model'
import { teacherSemester, trackingWeek, weeklyPublicationTasks } from '@/lib/mt/publication-tracking'
import { PublicationReader } from './publication-reader'
import { Modal } from './ui'

export function TeacherPublicationDashboard() {
  const mt=useMt()
  const [query,setQuery]=useState('')
  const [subject,setSubject]=useState('')
  const [selected,setSelected]=useState('')
  const [week,setWeek]=useState('')
  const [page,setPage]=useState(1)
  const [opened,setOpened]=useState<string|null>(null)
  const current=trackingWeek(mt.biz)
  const weekly=weeklyPublicationTasks(mt.biz,current)
  const subjects=[...new Set(weekly.map(r=>r.course))]
  const teachers=teacherSemester(mt.biz).filter(t=>t.teacher.includes(query)&&(!subject||weekly.some(r=>r.teacherId===t.teacherId&&r.course===subject)))
  const teacher=teachers.find(t=>t.teacherId===selected)??teachers[0]
  const teacherId=teacher?.teacherId
  const rate=teacher?.total?Math.round(teacher.published/teacher.total*100):null
  const teacherTasks=teacherId?Array.from({length:current},(_,i)=>weeklyPublicationTasks(mt.biz,i+1)).flat().filter(r=>r.teacherId===teacherId):[]
  const distribution=teacher?[
    {label:'已发布',value:teacher.published,color:'var(--tm-brand)'},
    {label:'待发布',value:teacher.pending,color:'var(--tm-amber)'},
    {label:'已逾期',value:teacher.overdue,color:'var(--tm-red)'},
    {label:'免除 / 无需',value:teacherTasks.filter(r=>r.requirement.waiver||(r.requirement.known&&!r.requirement.required&&!r.publication)).length,color:'var(--tm-muted)'},
    {label:'课表待确认',value:teacher.unknown,color:'var(--tm-blue)'}
  ]:[]
  const total=distribution.reduce((n,r)=>n+r.value,0)
  let angle=0
  const segments=distribution.map(r=>{const start=angle;angle+=total?r.value/total*360:0;return `${r.color} ${start}deg ${angle}deg`})
  const weeks=Array.from({length:Math.min(6,current)},(_,i)=>current-Math.min(6,current)+1+i).map(w=>{
    const rows=weeklyPublicationTasks(mt.biz,w).filter(r=>r.teacherId===teacherId)
    return {week:w,published:rows.filter(r=>r.publication&&!r.requirement.waiver).length,required:rows.filter(r=>r.requirement.required||(r.publication&&!r.requirement.waiver)).length}
  })
  const max=Math.max(1,...weeks.map(w=>Math.max(w.required,w.published)))
  const versions=mt.biz.publications.filter(p=>teacherId&&p.week<=current&&(!week||p.week===Number(week))&&Date.parse(p.publishedAt)<=Date.parse(mt.biz.clock)&&p.taskIds.some(id=>TASKS.find(t=>t.id===id)?.teacher_id===teacherId)).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||b.revision-a.revision)
  const pages=Math.max(1,Math.ceil(versions.length/20)),activePage=Math.min(page,pages)
  const report=versions.find(p=>p.id===opened&&!p.withdrawn)
  return <>
    <section className="tm-card"><header className="tm-cardhead"><h3>选择教师</h3><span>共 {teacherSemester(mt.biz).length} 位教师 · 支持姓名搜索与学科筛选</span><div className="tm-actions"><input aria-label="搜索教师姓名" placeholder="搜索教师姓名" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/><select aria-label="筛选教师学科" value={subject} onChange={e=>{setSubject(e.target.value);setPage(1)}}><option value="">全部学科</option>{subjects.map(s=><option key={s}>{s}</option>)}</select></div></header>
      <div className="tm-teachers"><div className="tm-teacherlist" aria-label="教师列表">{teachers.map(t=>{const percent=t.total?Math.round(t.published/t.total*100):0;return <button key={t.teacherId} aria-pressed={teacherId===t.teacherId} className={`tm-teacher ${teacherId===t.teacherId?'on':''}`} onClick={()=>{setSelected(t.teacherId);setPage(1)}}><span className="tm-avatar">{t.teacher.replace('示例','')[0]}</span><span className="tm-teachername"><b>{t.teacher}</b><small>{[...new Set(weekly.filter(r=>r.teacherId===t.teacherId).map(r=>r.course))].join(' / ')||'暂无任课任务'}</small></span><span className="tm-meter"><i style={{width:`${percent}%`}}/></span><strong>{t.total?`${percent}%`:'—'}</strong></button>})}{!teachers.length&&<p className="tm-empty">没有匹配的教师</p>}</div>
      {teacher?<div className="min-w-0"><div className="tm-teachersum"><span className="tm-avatar">{teacher.teacher.replace('示例','')[0]}</span><div><b>{teacher.teacher}</b><small>本学期 · 第 1–{current} 周 · {teacher.total} 项应发布任务</small></div><div className="tm-rate"><b>{rate===null?'—':`${rate}%`}</b><small>发布完成率</small></div></div>
        <div className="tm-chartgrid"><section className="tm-card"><header className="tm-cardhead"><h3>本学期发布状态分布</h3></header><div className="tm-distribution"><div className="tm-donut" role="img" aria-label={distribution.map(r=>`${r.label} ${r.value} 项`).join('，')} style={{background:total?`conic-gradient(${segments.join(',')})`:'var(--tm-line)'}}><span><b>{total}</b><small>任务周期</small></span></div><ul>{distribution.map(r=><li key={r.label}><i style={{background:r.color}}/>{r.label}<b>{r.value}</b></li>)}</ul></div></section>
        <section className="tm-card"><header className="tm-cardhead"><h3>近 6 周发布数</h3><span>已发布 / 应发布</span></header><div className="tm-bars">{weeks.map(w=><div key={w.week} className="tm-barcol"><strong>{w.published}/{w.required}</strong><div className="tm-bartrack" style={{height:`${Math.max(4,w.required/max*120)}px`}}><div style={{height:`${w.required?Math.min(100,w.published/w.required*100):0}%`}}/></div><small>第 {w.week} 周</small></div>)}</div></section></div>
      </div>:<p className="tm-empty">调整筛选后查看教师统计。</p>}</div></section>
    <section className="tm-card"><header className="tm-cardhead"><h3>发布明细</h3><span>{teacher?.teacher??'未选择教师'} · {versions.length} 个版本，含撤回记录</span><div className="tm-actions"><select aria-label="发布明细周次" value={week} onChange={e=>{setWeek(e.target.value);setPage(1)}}><option value="">全部周次</option>{Array.from({length:current},(_,i)=><option key={i} value={i+1}>第 {i+1} 周</option>)}</select></div></header><div className="overflow-auto"><table><thead><tr>{['版本','教学班 / 分工','周次','发布时间','状态','操作'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{versions.slice((activePage-1)*20,activePage*20).map(p=><tr key={p.id}><td>V{p.revision}</td><td>{p.classNameFormal} · {p.courseName}</td><td>第 {p.week} 周</td><td>{new Date(p.publishedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</td><td><span className={`tm-status ${p.withdrawn?'free':'ok'}`}>{p.withdrawn?'已撤回':'已发布'}</span></td><td>{!p.withdrawn?<button className="tm-link" onClick={()=>setOpened(p.id)}>查看报告</button>:'仅保留审计信息'}</td></tr>)}</tbody></table></div>{!versions.length&&<p className="tm-empty">当前范围暂无发布记录。</p>}<footer className="tm-pagination"><button disabled={activePage<=1} onClick={()=>setPage(activePage-1)}>上一页</button><span>{activePage} / {pages}</span><button disabled={activePage>=pages} onClick={()=>setPage(activePage+1)}>下一页</button></footer></section>
    {report&&<Modal wide title={`${teacherName(teacherId??'')} · 已发布报告 · 只读`} onClose={()=>setOpened(null)}><PublicationReader publication={report}/></Modal>}
  </>
}
