'use client'
import type { MtBiz } from '@/lib/mt/store'
import { entryKey } from '@/lib/mt/store'
import type { TaskWeek } from '@/lib/mt/derive'
import type { Preparation } from '@/lib/mt/reports'
import { studentById } from '@/lib/mt/model'
import { inputCls, Btn } from './ui'

export function ReportPublicContent({biz,tws,value,onChange}:{biz:MtBiz;tws:TaskWeek[];value:Preparation;onChange:(p:Preparation)=>void}) {
  const observations=Object.values(biz.observations).filter(o=>tws.some(t=>t.task.id===o.taskId&&t.task.teacher_id===o.authorId&&t.days.some(d=>d.date===o.date&&d.lessons.some(l=>l.id===o.lessonId)))&&(!o.studentId||value.selected.includes(o.studentId)))
  return <details className="rounded-lg border border-border bg-card p-4"><summary className="cursor-pointer font-semibold">个人公开内容与本次关注 · 默认不选内部观察</summary><div className="mt-4 flex flex-col gap-4"><p className="text-sm text-muted-foreground">只将主动选入且已整理为适合家长阅读的文字写入报告。这里的选择不改变原记录，也不存入复用模板。</p>
    {observations.map(o=>{const selected=value.observations?.find(x=>x.key===o.key);return <div key={o.key} className="flex flex-col gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!selected} onChange={e=>onChange({...value,observations:e.target.checked?[...(value.observations??[]),{key:o.key,text:o.text}]:(value.observations??[]).filter(x=>x.key!==o.key)})}/>{o.date} 第{o.periodNo}节 · {o.studentId?studentById(o.studentId)?.name:'本课共同观察'}</label>{selected?<textarea aria-label="选入观察的公开文字" className={inputCls} value={selected.text} onChange={e=>onChange({...value,observations:value.observations!.map(x=>x.key===o.key?{...x,text:e.target.value}:x)})}/>:<p className="text-sm text-muted-foreground">内部参考：{o.text}</p>}</div>})}
    {!observations.length?<p className="text-sm text-muted-foreground">本范围没有可选课次观察。</p>:null}
    {value.selected.map(id=><section key={id} className="flex flex-col gap-2 border-t border-border pt-3"><h4 className="font-semibold">{studentById(id)?.name}</h4>{tws.some(t=>biz.comments[entryKey(t.task.id,t.week,id)]?.text)?<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.comments?.includes(id)??false} onChange={e=>onChange({...value,comments:e.target.checked?[...(value.comments??[]),id]:(value.comments??[]).filter(x=>x!==id)})}/>明确向该生家长展示已有个人评语</label>:null}
      {tws.filter(t=>t.students.includes(id)).map(t=><div key={t.task.id} className="flex flex-col gap-2"><label className="text-sm">P03 本次关注来源 · {t.task.label}<select className={inputCls} value="" onChange={e=>{if(e.target.value)onChange({...value,focus:[...(value.focus??[]),{studentId:id,taskId:t.task.id,source:e.target.value,suggestion:''}]})}}><option value="">主动选择已有日期或作业事实</option>{t.byStudent[id]?.map(d=><option value={d.date} key={d.date}>{d.date} 课堂记录</option>)}{t.assignments.filter(a=>a.recipients.includes(id)).map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label>{(value.focus??[]).map((f,i)=>f.studentId===id&&f.taskId===t.task.id?<div key={i} className="flex items-start gap-2"><label className="flex-1 text-sm">{t.assignments.find(a=>a.id===f.source)?.title??f.source}<textarea className={inputCls} aria-label="本次关注建议" value={f.suggestion} onChange={e=>onChange({...value,focus:value.focus!.map((x,j)=>i===j?{...x,suggestion:e.target.value}:x)})}/></label><Btn size="sm" onClick={()=>onChange({...value,focus:value.focus!.filter((_,j)=>j!==i)})}>移除关注</Btn></div>:null)}</div>)}
    </section>)}
  </div></details>
}
