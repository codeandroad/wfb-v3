"use client"

import { useState } from 'react'
import { Check, Clock3, LayoutGrid, Minus } from 'lucide-react'
import { PublicationSettings } from './publication-settings'
import { TeacherPublicationDashboard } from './teacher-publication-dashboard'
import './teaching-management.css'
import { Card, CardHeader, EmptyState } from '@/components/kit'
import { useMt } from '@/lib/mt/store'
import { useDemo } from '@/lib/demo/store'
import { moduleEnabled, PERSONAS } from '@/lib/demo/nav'
import { MAX_WEEK, TEACHERS, teacherName, weekDates, weekRangeLabel } from '@/lib/mt/model'
import { createPublicationCheck, trackingWeek, weeklyPublicationTasks, isIncomplete } from '@/lib/mt/publication-tracking'
import { feedbackPeriodId } from '@/lib/mt/model'
import { PublicationReader } from './publication-reader'
import { Modal } from './ui'

const control = 'rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground'
export function PublicationManagement() {
  const mt = useMt()
  const demo = useDemo()
  const [selectedWeek, setWeek] = useState<number | null>(null)
  const [tab, setTab] = useState('weekly')
  const [teacher, setTeacher] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [opened, setOpened] = useState<string | null>(null)
  const [waiveTask, setWaiveTask] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const week = selectedWeek ?? trackingWeek(mt.biz)
  function saveWaiver() {
    if (!waiveTask || !reason.trim() || !PERSONAS[demo.persona].admin || demo.scenario === 'parent') return
    const result = mt.command('教务发布任务免除 / 恢复', b => {
      const row = weeklyPublicationTasks(b, week).find(r => r.taskId === waiveTask)
      if (!row || row.requirement.waiver || (row.requirement.known && !row.requirement.required)) return { error: '任务已无需发布，请刷新；恢复操作仅在集中管理页进行。' }
      return { ...b, publicationWaivers: [...(b.publicationWaivers ?? []), { taskId: row.taskId, periodId: feedbackPeriodId(week), waived: true, reason: reason.trim(), actor: PERSONAS[demo.persona].label, at: b.clock }] }
    })
    setMessage(result.ok ? '任务发布义务已更新，教师侧同步生效，课堂记录及检查历史保持不变。' : result.error)
    if (result.ok) { setWaiveTask(null); setReason('') }
  }
  const all = weeklyPublicationTasks(mt.biz, week)
  const rows = all.filter(r => (!teacher || r.teacherId === teacher) && (!status || (status === 'free' ? r.requirement.known && !r.requirement.required : status === 'overdue' ? r.status==='逾期待发布' : status === 'pending' ? ['待发布','逾期待发布'].includes(r.status) : status === 'published' ? !!r.publication : status === 'waived' ? !!r.requirement.waiver : status === 'unknown' ? !r.requirement.known && !r.publication : r.requirement.known && !r.requirement.required && !r.requirement.waiver)) && `${r.teacher}${r.label}${r.course}`.includes(query))
  const checks = (mt.biz.publicationChecks ?? []).filter(c => c.week === week).slice().reverse()
  const weekend = Date.parse(mt.biz.clock) >= Date.parse(`${weekDates(week)[5]}T00:00:00+08:00`)
  function exportTasks() {
    const cells = (value: string) => `"${value.replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`
    const csv = [['任课教师','教学班 / 分工','学科','发布情况','发布时间'],...rows.map(r=>[r.teacher,r.label,r.course,r.status,r.publication?.publishedAt??''])].map(row=>row.map(cells).join(',')).join('\r\n')
    const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}))
    const a=document.createElement('a');a.href=url;a.download=`第${week}周发布任务.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  function recordCheck() {
    if (!PERSONAS[demo.persona].admin || demo.scenario === 'parent') return
    const result = mt.command('教务周反馈检查', b => {
      if (Date.parse(b.clock) < Date.parse(`${weekDates(week)[5]}T00:00:00+08:00`)) return { error: '周六起可登记本周检查' }
      if (weeklyPublicationTasks(b, week).some(r => !r.requirement.known && !r.publication)) return { error: '仍有课表待确认任务，请先恢复课表来源再登记完整检查结果。' }
      const check = createPublicationCheck(b, week, PERSONAS[demo.persona].label, note)
      return { ...b, publicationChecks: [...(b.publicationChecks ?? []), check] }
    })
    setMessage(result.ok ? '检查记录已保存到模拟存储，后续补发不会覆盖本次结果。' : result.error)
    if (result.ok) setNote('')
  }
  const weekSelect=<select aria-label="检查周次" className={control} value={week} onChange={e=>{setWeek(Number(e.target.value));setMessage('')}}>{Array.from({length:MAX_WEEK},(_,i)=>i+1).map(w=><option key={w} value={w}>第 {w} 周 · {weekRangeLabel(w)}</option>)}</select>
  if (!moduleEnabled('teaching', demo.config)) return <EmptyState title="教学模块未接入" desc="请切换至演示配置 A。" />
  if (!PERSONAS[demo.persona].admin || demo.scenario === 'parent') return <EmptyState title="仅教务管理角色可查看" desc="请在原型演示控制中切换为教务管理员或兼任教务的林老师。" />
  if (!mt.ready) return <p role="status">正在读取发布任务…</p>
  if (mt.loadError) return <EmptyState title="模拟数据读取失败" desc="请通过原型控制重试加载后再检查。" />
  return <div className="teaching-management flex flex-col gap-3 font-sans">
    {opened && all.find(r=>r.publication?.id===opened)?.publication && <Modal wide title="已发布反馈报告 · 只读" onClose={()=>setOpened(null)}><PublicationReader publication={all.find(r=>r.publication?.id===opened)!.publication!}/></Modal>}
    {waiveTask && <Modal title="免除此周发布任务" onClose={()=>setWaiveTask(null)}><form className="flex flex-col gap-4" onSubmit={e=>{e.preventDefault();saveWaiver()}}><p className="text-sm">第 {week} 周 · {all.find(r=>r.taskId===waiveTask)?.label}。仅改变此任务此周期的发布义务，不删除课堂记录、已发布报告或检查历史。</p><label className="flex flex-col gap-2 text-sm">操作原因（必填）<textarea autoFocus required maxLength={1000} className={control} value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={!reason.trim()} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">确认保存</button><p role="status" className="text-sm">{message}</p></form></Modal>}
    <header className="tm-pagehead"><div><h1>教学管理</h1><p>每周根据教学安排刷新反馈任务。教务可在此查看每位教师的发布进度、打开已发布报告、管理发布规则与免除，并查看教师发布统计。</p></div><div className="tm-actions"><button className={control} onClick={exportTasks}>导出清单</button><button className="tm-primary" onClick={()=>setTab('check')}>周末检查登记</button></div></header>
    <div className="tm-tabs" aria-label="发布管理视图">{[['weekly','本周发布任务'],['rules','发布规则与集中管理'],['records','教师发布统计'],['check','周末检查登记']].map(([id,label])=><button key={id} aria-pressed={tab===id} className={tab===id?'on':''} onClick={()=>{setTab(id);setMessage('')}}>{label}{id==='weekly'&&<span>{all.length}</span>}{id==='check'&&<span>{checks.length} 次</span>}</button>)}</div>
    {tab==='check'&&<div className="tm-filters">{weekSelect}</div>}
    {all.some(r=>!r.requirement.known && !r.publication) && <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">存在课表待确认任务，可能涉及教师账号、课表版本生效范围或读取异常。此类任务不计入待发布或无需发布，请在课表中心核实后再登记检查。</p>}
    {tab === 'weekly' ? <>
      <div className="tm-tip"><strong>自动刷新机制</strong>：按「任课任务 × 教学周」计算反馈任务；整周假期自动免发。默认周日 23:59（北京时间）截止，定制期限优先。当前为演示数据，随系统演示时点计算。</div>
      <div className="tm-stats">{[
        {id:'',label:'应发布任务',value:all.filter(r=>r.requirement.required||(r.publication&&!r.requirement.waiver)).length,detail:`第 ${week} 周 · ${weekRangeLabel(week)}`,Icon:LayoutGrid,tone:'info'},
        {id:'published',label:'已发布',value:all.filter(r=>r.publication).length,detail:'点击查看报告 →',Icon:Check,tone:'ok'},
        {id:'pending',label:'待发布 · 含逾期',value:all.filter(r=>['待发布','逾期待发布'].includes(r.status)).length,detail:`${all.filter(r=>r.status==='逾期待发布').length} 项已逾期`,Icon:Clock3,tone:'wait'},
        {id:'free',label:'免除 / 无需发布',value:all.filter(r=>r.requirement.known&&!r.requirement.required).length,detail:'不计入完成率',Icon:Minus,tone:'free'}
      ].map(({id,label,value,detail,Icon,tone})=><button key={id} className={`tm-stat ${status===id?'on':''}`} aria-pressed={status===id} onClick={()=>setStatus(id)}><span className={`tm-icon ${tone}`}><Icon size={22}/></span><span><b>{value}</b><small>{label}</small><span className="tm-stat-detail">{detail}</span></span></button>)}</div>
      <Card><header className="tm-cardhead"><h3>第 {week} 周 · 发布任务清单</h3><span>{weekRangeLabel(week)}</span><div className="tm-actions tm-filters">{weekSelect}<select aria-label="任课教师" value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="">全部任课教师</option>{TEACHERS.map(t=><option key={t.id} value={t.id}>{teacherName(t.id)}</option>)}</select><select aria-label="发布状态" value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部状态</option><option value="pending">待发布（含逾期）</option><option value="published">已发布（含补发）</option><option value="overdue">已逾期</option><option value="free">免除 / 无需发布</option><option value="waived">教务已免除</option><option value="other">无需发布</option><option value="unknown">课表待确认</option></select><input aria-label="搜索发布任务" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索教师 / 教学班 / 学科"/></div></header>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{['任课教师','教学班 / 分工','学科','发布情况','发布时间','报告','发布义务'].map(h=><th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.key} className="border-t border-border"><td className="px-3 py-2 font-medium">{r.teacher}</td><td className="px-3 py-2">{r.label}</td><td className="px-3 py-2 text-muted-foreground">{r.course}</td><td className="px-3 py-2"><span className={`tm-status ${r.requirement.waiver?'free':r.publication?'ok':r.status==='逾期待发布'?'over':r.status==='待发布'?'wait':!r.requirement.known?'info':'none'}`}>{r.status==='逾期待发布'?'已逾期':r.requirement.known&&!r.requirement.required&&!r.requirement.waiver&&!r.publication?'无需发布':r.status}</span></td><td className="px-3 py-2 text-muted-foreground">{r.publication ? new Date(r.publication.publishedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '—'}</td><td className="px-3 py-2">{r.publication?<button className="tm-link" onClick={()=>setOpened(r.publication!.id)}>查看报告 · V{r.publication.revision}</button>:<span className="text-muted-foreground">发布后可查看</span>}</td><td className="px-3 py-2">{!r.requirement.waiver&&(r.requirement.required||!r.requirement.known)?<button className="tm-link tm-obligation" onClick={()=>{setWaiveTask(r.taskId);setReason('')}}>免除此周任务</button>:<span className="text-muted-foreground">{r.requirement.waiver?'已免除':'—'}</span>}</td></tr>)}</tbody></table></div>
        {!rows.length && <EmptyState title="没有符合条件的发布任务" desc="调整教师、状态或搜索条件后重试。" />}
      </Card>
    </> : tab === 'check' ? <>
      <div className="tm-tip">登记第 {week} 周全部 {all.length} 个任务的当前结果，不受任务筛选影响。可重复检查；后续补发不改写历史快照。</div>
      <Card><CardHeader className="px-3 py-2" title="周末检查登记" desc={`登记第 ${week} 周全部 ${all.length} 个任务的当前结果，不受上方筛选影响。可重复检查，每次记录独立保留。`} /><div className="flex flex-col gap-3 p-5"><label className="flex flex-col gap-2 text-sm">检查备注（可选）<textarea className={control} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="例如：已提醒相关教师补发；请假情况待核实。仅记录事实，不计算 KPI。" /></label><div className="flex flex-wrap items-center gap-3"><button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={!weekend||!all.length||all.some(r=>!r.requirement.known&&!r.publication)} onClick={recordCheck}>登记本周检查结果</button><span className="text-sm text-muted-foreground">{weekend?'记录检查人、时间、未完成任务及备注。':'周六起可登记；当前可提前查看任务进度。'}</span></div><p role="status" className="text-sm text-primary">{message}</p></div></Card>
      <Card><CardHeader className="px-3 py-2" title={`检查历史 · ${checks.length} 次`} desc="当时未完成与目前已补发并存，历史检查结果不会随发布状态改变。" /><div className="flex flex-col gap-3 p-5">{checks.length?checks.map(c=><details key={c.id} className="rounded-lg border border-border p-4"><summary className="cursor-pointer text-sm font-medium">{new Date(c.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})} · {c.reviewer} · 未完成 {c.entries.filter(isIncomplete).length}/{c.entries.length}</summary><p className="my-3 text-sm text-muted-foreground">{c.note||'无备注'}</p><ul className="flex flex-col gap-2 text-sm">{c.entries.map(e=><li key={e.taskId}>{teacherName(e.teacherId)} · {e.label} · 当时：{e.status}</li>)}</ul></details>):<p className="text-sm text-muted-foreground">暂无检查记录。</p>}</div></Card>
    </> : tab === 'rules' ? <PublicationSettings embedded /> : <TeacherPublicationDashboard />}
    {tab==='check'&&<details className="rounded-lg border border-border bg-card px-3 py-2 text-sm"><summary className="cursor-pointer font-medium">第 {week} 周 · 免除 / 恢复操作记录</summary><ul className="flex flex-col gap-2 py-2">{(mt.biz.publicationWaivers??[]).filter(w=>w.periodId===feedbackPeriodId(week)).map((w,i)=><li key={i}>{all.find(r=>r.taskId===w.taskId)?.label} · {w.waived?'免除':'恢复'} · {w.reason} · {w.actor} · {new Date(w.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</li>)}</ul></details>}
  </div>
}
