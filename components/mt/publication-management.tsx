"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Badge, Card, CardHeader, EmptyState } from '@/components/kit'
import { useMt } from '@/lib/mt/store'
import { useDemo } from '@/lib/demo/store'
import { moduleEnabled, PERSONAS } from '@/lib/demo/nav'
import { MAX_WEEK, TEACHERS, TERM, teacherName, weekDates, weekRangeLabel } from '@/lib/mt/model'
import { createPublicationCheck, teacherSemester, trackingWeek, weeklyPublicationTasks, isIncomplete } from '@/lib/mt/publication-tracking'
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
  const rows = all.filter(r => (!teacher || r.teacherId === teacher) && (!status || (status === 'pending' ? ['待发布','逾期待发布'].includes(r.status) : status === 'published' ? !!r.publication : status === 'waived' ? !!r.requirement.waiver : status === 'unknown' ? !r.requirement.known && !r.publication : r.requirement.known && !r.requirement.required && !r.requirement.waiver)) && `${r.teacher}${r.label}${r.course}`.includes(query))
  const checks = (mt.biz.publicationChecks ?? []).filter(c => c.week === week).slice().reverse()
  const semester = teacherSemester(mt.biz).filter(r => (!teacher || r.teacherId === teacher) && r.teacher.includes(query))
  const weekend = Date.parse(mt.biz.clock) >= Date.parse(`${weekDates(week)[5]}T00:00:00+08:00`)
  const published = rows.filter(r => r.publication && !r.requirement.waiver).length
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
  if (!moduleEnabled('teaching', demo.config)) return <EmptyState title="教学模块未接入" desc="请切换至演示配置 A。" />
  if (!PERSONAS[demo.persona].admin || demo.scenario === 'parent') return <EmptyState title="仅教务管理角色可查看" desc="请在原型演示控制中切换为教务管理员或兼任教务的林老师。" />
  if (!mt.ready) return <p role="status">正在读取发布任务…</p>
  if (mt.loadError) return <EmptyState title="模拟数据读取失败" desc="请通过原型控制重试加载后再检查。" />
  return <div className="flex flex-col gap-3 font-sans">
    {opened && all.find(r=>r.publication?.id===opened)?.publication && <Modal wide title="已发布反馈报告 · 只读" onClose={()=>setOpened(null)}><PublicationReader publication={all.find(r=>r.publication?.id===opened)!.publication!}/></Modal>}
    {waiveTask && <Modal title="免除此周发布任务" onClose={()=>setWaiveTask(null)}><form className="flex flex-col gap-4" onSubmit={e=>{e.preventDefault();saveWaiver()}}><p className="text-sm">第 {week} 周 · {all.find(r=>r.taskId===waiveTask)?.label}。仅改变此任务此周期的发布义务，不删除课堂记录、已发布报告或检查历史。</p><label className="flex flex-col gap-2 text-sm">操作原因（必填）<textarea autoFocus required maxLength={1000} className={control} value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={!reason.trim()} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">确认保存</button><p role="status" className="text-sm">{message}</p></form></Modal>}
    <header className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-semibold">教学管理</h1><nav className="flex flex-wrap gap-3 text-sm"><Link href="/management/publication-settings" className="text-primary underline">发布规则与集中管理</Link><Link href="/management/records" className="text-primary underline">教师发布档案与汇总</Link></nav></header>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="发布管理视图" className="flex gap-2">{[['weekly','每周发布任务'],['semester','学期教师概况']].map(([id,label]) => <button key={id} role="tab" aria-selected={tab===id} onClick={() => setTab(id)} className={`${control} ${tab===id ? 'bg-primary text-primary-foreground' : ''}`}>{label}</button>)}</div>
      <Badge tone="info">交互原型 · 仅本浏览器保存</Badge>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      {tab === 'weekly' && <select aria-label="检查周次" className={control} value={week} onChange={e => { setWeek(Number(e.target.value)); setMessage('') }}>{Array.from({length:MAX_WEEK},(_,i)=>i+1).map(w=><option key={w} value={w}>第 {w} 周 · {weekRangeLabel(w)}</option>)}</select>}
      <select aria-label="任课教师" className={control} value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="">全部任课教师</option>{TEACHERS.map(t=><option key={t.id} value={t.id}>{teacherName(t.id)}</option>)}</select>
      {tab === 'weekly' && <select aria-label="发布状态" className={control} value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部状态</option><option value="pending">待发布（含逾期）</option><option value="published">已发布（含补发）</option><option value="waived">教务已免除</option><option value="other">无需发布</option><option value="unknown">课表待确认</option></select>}
      <input aria-label="搜索发布任务" className={control} value={query} onChange={e=>setQuery(e.target.value)} placeholder={tab==='weekly'?'搜索教师、教学班、学科':'搜索教师'} />
    </div>
    {all.some(r=>!r.requirement.known && !r.publication) && <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">存在课表待确认任务，不计入待发布或无需发布，也不视为全部完成。请先确认相关教师已采用有效课表，或由教务明确免除此周任务后再登记检查。</p>}
    {tab === 'weekly' ? <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">{[['应发布任务',rows.filter(r=>r.requirement.required || (r.publication && !r.requirement.waiver)).length],['已发布',published],['待发布',rows.filter(r=>['待发布','逾期待发布'].includes(r.status)).length]].map(([label,value])=><div key={label} className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">{label}</span><strong className="tabular-nums">{value}</strong></div>)}</div>
      <Card><CardHeader className="px-3 py-2" title={`第 ${week} 周 · 发布任务清单`} desc="整周假期自动免发；默认周日 23:59 截止，调整后的期限见任务详情。" />
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{['任课教师','教学班 / 分工','学科','发布情况','发布时间','检查记录','报告 / 发布义务'].map(h=><th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.key} className="border-t border-border"><td className="px-3 py-2 font-medium">{r.teacher}</td><td className="px-3 py-2">{r.label}</td><td className="px-3 py-2 text-muted-foreground">{r.course}</td><td className="px-3 py-2"><Badge tone={r.publication?'success':r.status==='逾期待发布'?'warning':'neutral'}>{r.status}</Badge><details className="text-sm text-muted-foreground"><summary className="cursor-pointer">详情{r.requirement.required ? ` · 截止 ${new Date(r.deadline).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}` : ''}</summary><p className="max-w-64 py-1">{r.requirement.reason}</p></details></td><td className="px-3 py-2 text-muted-foreground">{r.publication ? new Date(r.publication.publishedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}) : r.requirement.known && !r.requirement.required ? '—' : '尚未发布'}</td><td className="px-3 py-2">{checks.some(c=>c.entries.some(e=>e.taskId===r.taskId&&isIncomplete(e)))?'曾记录未完成':checks.some(c=>c.entries.some(e=>e.taskId===r.taskId))?'已检查':'未检查'}</td><td className="px-3 py-2"><div className="flex flex-col items-start gap-3">{r.publication && <button className="text-primary underline" onClick={()=>setOpened(r.publication!.id)}>查看报告 · V{r.publication.revision}</button>}{!r.requirement.waiver && (r.requirement.required || !r.requirement.known) && <button className="text-primary underline" onClick={()=>{setWaiveTask(r.taskId);setReason('')}}>免除此周任务</button>}</div></td></tr>)}</tbody></table></div>
        {!rows.length && <EmptyState title="没有符合条件的发布任务" desc="调整教师、状态或搜索条件后重试。" />}
      </Card>
      <Card><CardHeader className="px-3 py-2" title="周末检查登记" desc={`登记第 ${week} 周全部 ${all.length} 个任务的当前结果，不受上方筛选影响。可重复检查，每次记录独立保留。`} /><div className="flex flex-col gap-3 p-5"><label className="flex flex-col gap-2 text-sm">检查备注（可选）<textarea className={control} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="例如：已提醒相关教师补发；请假情况待核实。仅记录事实，不计算 KPI。" /></label><div className="flex flex-wrap items-center gap-3"><button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={!weekend||!all.length||all.some(r=>!r.requirement.known&&!r.publication)} onClick={recordCheck}>登记本周检查结果</button><span className="text-sm text-muted-foreground">{weekend?'记录检查人、时间、未完成任务及备注。':'周六起可登记；当前可提前查看任务进度。'}</span></div><p role="status" className="text-sm text-primary">{message}</p></div></Card>
      <Card><CardHeader className="px-3 py-2" title={`检查历史 · ${checks.length} 次`} desc="当时未完成与目前已补发并存，历史检查结果不会随发布状态改变。" /><div className="flex flex-col gap-3 p-5">{checks.length?checks.map(c=><details key={c.id} className="rounded-lg border border-border p-4"><summary className="cursor-pointer text-sm font-medium">{new Date(c.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})} · {c.reviewer} · 未完成 {c.entries.filter(isIncomplete).length}/{c.entries.length}</summary><p className="my-3 text-sm text-muted-foreground">{c.note||'无备注'}</p><ul className="flex flex-col gap-2 text-sm">{c.entries.map(e=><li key={e.taskId}>{teacherName(e.teacherId)} · {e.label} · 当时：{e.status}</li>)}</ul></details>):<p className="text-sm text-muted-foreground">暂无检查记录。</p>}</div></Card>
    </> : <Card><CardHeader className="px-3 py-2" title="任课教师 · 学期发布概况" desc={`${TERM.start} 至 ${TERM.end}；统计第 1–${trackingWeek(mt.biz)} 周，不将未来周计入。任务以任课分工计数，未完成记录按周与任务去重；不涉及 KPI。`} /><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{['任课教师','应发布','已发布','其中补发','逾期待发布','未到期待发布','已免除','课表待确认','检查时未完成','追溯'].map(h=><th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{semester.map(r=><tr key={r.teacherId} className="border-t border-border"><td className="px-4 py-4 font-medium">{r.teacher}</td>{[r.total,r.published,r.late,r.overdue,r.pending,r.waived,r.unknown,r.missed].map((n,i)=><td key={i} className="px-4 py-4 tabular-nums">{n}</td>)}<td className="px-4 py-4"><button className="text-primary underline" onClick={()=>{setTeacher(r.teacherId);setStatus('');setQuery('');setTab('weekly')}}>按周查看</button><Link className="ml-3 text-primary underline" href={`/management/records?teacher=${encodeURIComponent(r.teacherId)}`}>全部记录</Link></td></tr>)}</tbody></table></div>{!semester.length&&<EmptyState title="没有符合条件的教师" desc="清除筛选后重试。" />}</Card>}
    <details className="rounded-lg border border-border bg-card px-3 py-2 text-sm"><summary className="cursor-pointer font-medium">第 {week} 周 · 免除 / 恢复操作记录</summary><ul className="flex flex-col gap-2 py-2">{(mt.biz.publicationWaivers??[]).filter(w=>w.periodId===feedbackPeriodId(week)).map((w,i)=><li key={i}>{all.find(r=>r.taskId===w.taskId)?.label} · {w.waived?'免除':'恢复'} · {w.reason} · {w.actor} · {new Date(w.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</li>)}</ul></details>
  </div>
}
