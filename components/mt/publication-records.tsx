'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/kit'
import { useMt } from '@/lib/mt/store'
import { useDemo } from '@/lib/demo/store'
import { moduleEnabled, PERSONAS } from '@/lib/demo/nav'
import { TASKS, TEACHERS, teacherName } from '@/lib/mt/model'
import { trackingWeek, weeklyPublicationTasks, teacherSemester } from '@/lib/mt/publication-tracking'
import { PublicationReader } from './publication-reader'
import { Modal } from './ui'

const control='rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground'
export function PublicationRecords({initialTeacher=''}:{initialTeacher?:string}) {
  const mt=useMt(), demo=useDemo()
  const [teacher,setTeacher]=useState(initialTeacher)
  const [from,setFrom]=useState(1)
  const [to,setTo]=useState<number|null>(null)
  const [mode,setMode]=useState('versions')
  const [opened,setOpened]=useState<string|null>(null)
  const [page,setPage]=useState(1)
  if(!PERSONAS[demo.persona].admin||demo.scenario==='parent'||!moduleEnabled('teaching',demo.config))return <EmptyState title="仅教务管理角色可查看" desc="请切换为教务身份。"/>
  if(!mt.ready)return <p role="status">正在读取教师档案…</p>
  if(mt.loadError)return <EmptyState title="数据读取失败" desc="请先恢复模拟存储。"/>
  const current=trackingWeek(mt.biz), end=to??current
  const rows=Array.from({length:Math.max(0,end-from+1)},(_,i)=>weeklyPublicationTasks(mt.biz,from+i)).flat().filter(r=>!teacher||r.teacherId===teacher)
  const versions=mt.biz.publications.filter(p=>p.week>=from&&p.week<=end&&Date.parse(p.publishedAt)<=Date.parse(mt.biz.clock)&&(!teacher||p.taskIds.some(id=>TASKS.find(t=>t.id===id)?.teacher_id===teacher))).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||b.revision-a.revision)
  const stats=[['已发布任务',rows.filter(r=>r.publication).length],['当前待发布',rows.filter(r=>['待发布','逾期待发布'].includes(r.status)).length],['无需 / 免除发布',rows.filter(r=>r.requirement.known&&!r.requirement.required).length],['发布版本（含撤回）',versions.length]] as const
  const record=mt.biz.publications.find(p=>p.id===opened&&!p.withdrawn)
  const count=mode==='versions'?versions.length:rows.length, pages=Math.max(1,Math.ceil(count/20)), start=(Math.min(page,pages)-1)*20
  return <div className="flex flex-col gap-3 font-sans"><PageHeader title="教师发布档案与汇总" desc="跨周查看发布进度、历史版本及检查事实。当前仅包含本学期、截至演示时点的数据，不作 KPI 评分。"/><nav className="flex flex-wrap gap-4 text-sm"><Link href="/management" className="text-primary underline">返回发布检查</Link><Link href="/management/publication-settings" className="text-primary underline">发布规则与集中管理</Link><Badge tone="info">交互原型 · 仅本浏览器保存</Badge></nav>
    <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm">教师<select className={control} value={teacher} onChange={e=>{setTeacher(e.target.value);setPage(1)}}><option value="">全部教师</option>{TEACHERS.map(t=><option key={t.id} value={t.id}>{teacherName(t.id)}</option>)}</select></label>{[['开始周',from,setFrom],['结束周',end,setTo]].map(([label,value,set])=><label key={String(label)} className="flex items-center gap-2 text-sm">{String(label)}<select className={control} value={Number(value)} onChange={e=>{(set as (v:number)=>void)(+e.target.value);setPage(1)}}>{Array.from({length:current},(_,i)=><option key={i} value={i+1}>第 {i+1} 周</option>)}</select></label>)}</div>
    {from>end&&<p role="alert">开始周不能晚于结束周。</p>}
    <div className="flex flex-wrap gap-x-6 gap-y-2">{stats.map(([label,n])=><div className="flex items-center gap-2 text-sm" key={label}><span className="text-muted-foreground">{label}</span><strong className="tabular-nums">{n}</strong></div>)}</div>
    <Card><CardHeader className="px-3 py-2" title="教师学期汇总" desc="按任务×周期统计（不受上方周次范围影响）。版本数不能替代任务完成数；合并报告可能完成多个任务。"/><div className="overflow-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted"><tr>{['教师','应发布','已发布','补发','逾期','免除 / 无需','待确认','检查曾未完成'].map(h=><th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>{teacherSemester(mt.biz).filter(r=>!teacher||r.teacherId===teacher).map(r=><tr key={r.teacherId} className="border-t border-border"><td className="px-3 py-2"><button className="text-primary underline" onClick={()=>{setTeacher(r.teacherId);setPage(1)}}>{r.teacher}</button></td>{[r.total,r.published,r.late,r.overdue,r.waived+r.notRequired,r.unknown,r.missed].map((n,i)=><td key={i} className="px-3 py-2">{n}</td>)}</tr>)}</tbody></table></div></Card>
    <details className="rounded-xl border border-border bg-card text-card-foreground"><summary className="cursor-pointer px-3 py-2 text-sm font-semibold">发布明细 · {versions.length} 个版本（展开查看）</summary><p className="px-3 text-sm text-muted-foreground">包含修订及撤回记录；撤回版本仅保留审计信息。</p><div className="flex flex-wrap gap-3 p-3">{[['versions','所有发布版本'],['tasks','跨周任务进度']].map(([id,label])=><button className={control} aria-pressed={mode===id} key={id} onClick={()=>{setMode(id);setPage(1)}}>{label}</button>)}</div>
    <div className="overflow-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted"><tr>{(mode==='versions'?['周次 / 范围','发布教师','版本','发布时间','状态','报告']:['周次 / 范围','教师','状态','截止（北京时间）','报告']).map(h=><th className="px-3 py-2" key={h}>{h}</th>)}</tr></thead><tbody>{mode==='versions'?versions.slice(start,start+20).map(p=><tr key={p.id} className="border-t border-border"><td className="px-3 py-2">第 {p.week} 周 · {p.classNameFormal} · {p.courseName}</td><td className="px-3 py-2">{[...new Set(p.taskIds.map(id=>teacherName(TASKS.find(t=>t.id===id)?.teacher_id??'')))].join('、')}</td><td className="px-3 py-2">V{p.revision}</td><td className="px-3 py-2">{new Date(p.publishedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</td><td className="px-3 py-2">{p.withdrawn?'已撤回':'已发布'}</td><td className="px-3 py-2">{!p.withdrawn&&<button className="text-primary underline" onClick={()=>setOpened(p.id)}>查看此版本</button>}</td></tr>):rows.slice(start,start+20).map(r=><tr key={r.key} className="border-t border-border"><td className="px-3 py-2">第 {r.week} 周 · {r.label}</td><td className="px-3 py-2">{r.teacher}</td><td className="px-3 py-2">{r.status}</td><td className="px-3 py-2">{new Date(r.deadline).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</td><td className="px-3 py-2">{r.publication&&<button className="text-primary underline" onClick={()=>setOpened(r.publication!.id)}>查看报告</button>}</td></tr>)}</tbody></table></div>{!count&&<p className="p-3 text-sm">当前范围暂无记录。</p>}<div className="flex items-center gap-3 p-3 text-sm"><button className={control} disabled={page<=1} onClick={()=>setPage(page-1)}>上一页</button><span>{Math.min(page,pages)} / {pages} · 共 {count} 条</span><button className={control} disabled={page>=pages} onClick={()=>setPage(page+1)}>下一页</button></div></details>
    <details className="rounded-lg border border-border bg-card p-3 text-sm"><summary className="cursor-pointer font-medium">检查记录 · 当前周次与教师范围</summary><div className="flex flex-col gap-3 py-4">{(mt.biz.publicationChecks??[]).filter(c=>c.week>=from&&c.week<=end).flatMap(c=>c.entries.filter(e=>!teacher||e.teacherId===teacher).map(e=><p key={`${c.id}-${e.taskId}`}>第 {c.week} 周 · {teacherName(e.teacherId)} · {e.label} · 当时：{e.status} · {c.reviewer} · {new Date(c.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})} · {c.note||'无备注'}</p>))}</div></details>
    {record&&<Modal wide title="历史反馈版本 · 只读" onClose={()=>setOpened(null)}><PublicationReader publication={record}/></Modal>}
  </div>
}
