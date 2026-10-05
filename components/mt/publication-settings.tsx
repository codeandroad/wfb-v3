'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/kit'
import { useMt } from '@/lib/mt/store'
import { useDemo } from '@/lib/demo/store'
import { moduleEnabled, PERSONAS } from '@/lib/demo/nav'
import { MAX_WEEK, TASKS, TEACHERS, teacherName, formalTaskName, feedbackPeriodId } from '@/lib/mt/model'
import { trackingWeek, weeklyPublicationTasks } from '@/lib/mt/publication-tracking'
import { publicationPolicy, parsePublicationDeadline, type PublicationPolicy } from '@/lib/mt/publication-policy'
import { Modal } from './ui'

const control = 'rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground'
const button = 'rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50'
export function PublicationSettings() {
  const mt = useMt()
  const demo = useDemo()
  const [from, setFrom] = useState<number | null>(null)
  const [to, setTo] = useState<number | null>(null)
  const [teacher, setTeacher] = useState('')
  const [task, setTask] = useState('')
  const [action, setAction] = useState('waive')
  const [deadline, setDeadline] = useState('')
  const [classReport, setClassReport] = useState(true)
  const [allPersonal, setAllPersonal] = useState(false)
  const [summary, setSummary] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [confirming, setConfirming] = useState(false)
  const start = from ?? trackingWeek(mt.biz)
  const end = to ?? start
  const rows = start <= end ? Array.from({length:end-start+1},(_,i)=>weeklyPublicationTasks(mt.biz,start+i)).flat().filter(r=>(!teacher||r.teacherId===teacher)&&(!task||r.taskId===task)) : []
  const authorized = PERSONAS[demo.persona].admin && demo.scenario !== 'parent' && moduleEnabled('teaching',demo.config)
  const deadlineIso = parsePublicationDeadline(deadline)
  const valid = !!rows.length && !!reason.trim() && (action !== 'deadline' || deadlineIso !== null)
  function apply() {
    if (!authorized || !valid) return
    const result = mt.command('集中调整发布任务', b => {
      const actor = PERSONAS[demo.persona].label
      const audit = { actor, at:b.clock, reason:reason.trim() }
      if (action === 'waive' || action === 'restore') return {...b,publicationWaivers:[...(b.publicationWaivers??[]),...rows.map(r=>({...audit,taskId:r.taskId,periodId:feedbackPeriodId(r.week),waived:action==='waive'}))]}
      const changes: PublicationPolicy[] = rows.map(r=>({...audit,taskId:r.taskId,periodId:feedbackPeriodId(r.week),...(action==='deadline'?{deadline:deadlineIso}:action==='resetDeadline'?{deadline:null}:action==='requirements'?{requirements:{classReport,allPersonal,summary,instruction:instruction.trim()}}:{requirements:null})}))
      return {...b,publicationPolicies:[...(b.publicationPolicies??[]),...changes]}
    })
    setMessage(result.ok?`已应用于 ${rows.length} 项任务。教师侧与教务统计已同步更新。`:result.error)
    if(result.ok) {setConfirming(false);setReason('')}
  }
  if (!authorized) return <EmptyState title="仅教务管理角色可查看" desc="请切换至教学模块已开启的教务身份。"/>
  if (!mt.ready) return <p role="status">正在读取发布设置…</p>
  if (mt.loadError) return <EmptyState title="数据读取失败" desc="请先恢复模拟存储。"/>
  const labels: Record<string,string> = {waive:'批量免除发布',restore:'批量恢复发布义务',deadline:'统一设置截止时间',resetDeadline:'恢复默认截止时间',requirements:'设置发布要求',resetRequirements:'清除定制发布要求'}
  return <div className="flex flex-col gap-5 font-sans">
    <PageHeader title="发布规则与集中管理" desc="选择教师、任课范围和周次，一次调整多项任务；整周假期自动免发，无需在这里手动免除。"/>
    <nav className="flex flex-wrap gap-4 text-sm"><Link className="text-primary underline" href="/management">返回发布检查</Link><Link className="text-primary underline" href="/management/records">教师发布档案</Link><Badge tone="info">交互原型 · 仅本浏览器保存</Badge></nav>
    <Card><CardHeader title="选择作用范围" desc="按本学期现有任课任务与指定周次生成明确目标，不会自动影响未来新建任务。"/><div className="flex flex-wrap gap-4 p-5">
      <label className="flex flex-col gap-2 text-sm">任课教师<select className={control} value={teacher} onChange={e=>{setTeacher(e.target.value);setTask('')}}><option value="">全部教师</option>{TEACHERS.map(t=><option key={t.id} value={t.id}>{teacherName(t.id)}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm">教学班 / 分工<select className={control} value={task} onChange={e=>setTask(e.target.value)}><option value="">全部任课任务</option>{TASKS.filter(t=>!teacher||t.teacher_id===teacher).map(t=><option key={t.id} value={t.id}>{formalTaskName(t)}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm">开始周<select className={control} value={start} onChange={e=>{setFrom(+e.target.value);setTo(Math.max(end,+e.target.value))}}>{Array.from({length:MAX_WEEK},(_,i)=><option key={i} value={i+1}>第 {i+1} 周</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm">结束周<select className={control} value={end} onChange={e=>setTo(+e.target.value)}>{Array.from({length:MAX_WEEK},(_,i)=><option disabled={i+1<start} key={i} value={i+1}>第 {i+1} 周</option>)}</select></label>
    </div></Card>
    <Card><CardHeader title={`批量操作 · ${rows.length} 项任务`} desc="截止、发布要求和免除分别管理，修改一项不会清空其他设置。恢复义务仍遵循校历自动免发。"/><form className="flex flex-col gap-4 p-5" onSubmit={e=>{e.preventDefault();if(valid)setConfirming(true)}}>
      <label className="flex flex-col gap-2 text-sm">操作类型<select className={control} value={action} onChange={e=>setAction(e.target.value)}>{Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      {action==='deadline'&&<label className="flex flex-col gap-2 text-sm">截止时间（北京时间；应用于所有所选周期）<input required type="text" placeholder="2026-10-16 18:00" aria-describedby="deadline-help" className={control} value={deadline} onChange={e=>setDeadline(e.target.value)}/><span id="deadline-help" className="text-muted-foreground">格式：年-月-日 时:分，例如 2026-10-16 18:00。{deadline && !deadlineIso ? '请输入有效日期与24小时制时间。' : ''}</span><span className="text-muted-foreground">允许追溯调整；早于当前时点会使未发布任务进入逾期，历史检查快照不变。</span></label>}
      {action==='requirements'&&<fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4"><legend className="text-sm font-medium">发布内容要求</legend>{[['班级反馈报告',classReport,setClassReport],['全部适用学生的个人反馈',allPersonal,setAllPersonal],['必须填写公共总结',summary,setSummary]].map(([label,value,set])=><label key={String(label)} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(value)} onChange={e=>(set as (v:boolean)=>void)(e.target.checked)}/>{String(label)}</label>)}<label className="flex flex-col gap-2 text-sm">补充说明（展示给教师，不自动判断文字是否落实）<textarea className={control} maxLength={1000} value={instruction} onChange={e=>setInstruction(e.target.value)}/></label><p className="text-sm text-muted-foreground">勾选项在发布时强制核验；整周假期自动免发仍然优先。</p></fieldset>}
      <label className="flex flex-col gap-2 text-sm">操作原因（必填）<textarea required maxLength={1000} className={control} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className={button} disabled={!valid}>预览影响并确认</button><p role="status" className="text-sm">{message}</p>
    </form></Card>
    <Card><CardHeader title="范围预览与当前规则" desc="无需发布不等同于课表未确认；已有报告不会因规则调整被删除。"/><div className="max-h-96 overflow-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted"><tr>{['教师 / 分工','周次','当前状态','截止（北京时间）','发布要求'].map(h=><th className="px-4 py-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=>{const p=publicationPolicy(mt.biz,r.taskId,r.week);return <tr key={r.key} className="border-t border-border"><td className="px-4 py-3">{r.teacher} · {r.label}</td><td className="px-4 py-3">{r.week}</td><td className="px-4 py-3">{r.status}</td><td className="px-4 py-3">{new Date(r.deadline).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</td><td className="px-4 py-3">{p.requirements?[p.requirements.classReport&&'班级',p.requirements.allPersonal&&'全体个人',p.requirements.summary&&'公共总结',p.requirements.instruction].filter(Boolean).join('；')||'无额外限制':'默认要求'}</td></tr>})}</tbody></table></div>{!rows.length&&<p className="p-5 text-sm">当前范围没有任务。</p>}</Card>
    <Card><CardHeader title="操作审计" desc="按当前范围显示最近操作，记录逐任务保留。"/><div className="flex max-h-80 flex-col gap-3 overflow-auto p-5 text-sm">{[...(mt.biz.publicationWaivers??[]).map(w=>({...w,operation:w.waived?'免除':'恢复义务'})),...(mt.biz.publicationPolicies??[]).map(p=>({...p,operation:p.deadline!==undefined?(p.deadline?`调整截止至 ${new Date(p.deadline).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}`:'恢复默认截止'):(p.requirements?'调整要求':'清除定制要求')}))].filter(p=>rows.some(r=>r.taskId===p.taskId&&feedbackPeriodId(r.week)===p.periodId)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).map((p,i)=><p key={i}>{formalTaskName(TASKS.find(t=>t.id===p.taskId)!)} · {p.periodId} · {p.operation} · {p.reason} · {p.actor} · {new Date(p.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</p>)}</div></Card>
    {confirming&&<Modal title="确认批量调整" onClose={()=>setConfirming(false)}><div className="flex flex-col gap-4 text-sm"><p>{labels[action]}：第 {start}–{end} 周，共 {rows.length} 项任务，涉及 {new Set(rows.map(r=>r.teacherId)).size} 位教师。</p>{action==='deadline'&&<p>统一截止：{deadline.replace('T',' ')}（北京时间）。</p>}<p>原因：{reason}</p><p>仅更新所选范围，不覆盖历史报告与检查记录。恢复义务不取消整周假期的自动免发。</p><button className={button} onClick={apply}>确认应用到 {rows.length} 项任务</button><p role="status">{message}</p></div></Modal>}
  </div>
}
