'use client'
import { useState } from 'react'
import { studentById } from '@/lib/mt/model'
import type { ReportCustomization } from '@/lib/mt/report-customization'
import type { ReportTemplate, FrozenReport } from '@/lib/mt/reports'
import { ReportCustomizationEditor } from './report-customization-editor'
import { Btn, inputCls } from './ui'
export function ReportPersonalAdjustment({template,students,overrides,onChange,reports}:{reports:FrozenReport[];template:ReportTemplate;students:string[];overrides:Record<string,ReportCustomization>;onChange:(next:Record<string,ReportCustomization>)=>void}) {
 const [selected,setSelected]=useState(''),id=students.includes(selected)?selected:students[0]
 if(!id)return null
 return <details data-testid="personal-report-override" className="rounded border border-border bg-card p-3"><summary className="cursor-pointer text-sm font-semibold">仅此学生的本次呈现微调</summary><div className="flex flex-col gap-3 pt-3"><label className="text-sm">作用对象（不会改变发送名单）<select className={inputCls} value={id} onChange={e=>setSelected(e.target.value)}>{students.map(s=><option key={s} value={s}>{studentById(s)?.name??s}</option>)}</select></label><p className="text-sm text-muted-foreground">未设置属性继承本批个人报告。批次调整保留这里明确设置的属性；恢复后重新继承。不把学生标识保存到通用模板。</p><ReportCustomizationEditor currentReport={reports.find(r=>r.kind==='personal'&&r.studentId===id)} key={id} value={{...template,id:`individual-${id}`,customization:overrides[id]??{}}} onChange={t=>onChange({...overrides,[id]:t.customization??{}})}/><Btn size="sm" onClick={()=>{const next={...overrides};delete next[id];onChange(next)}}>清除此学生本次微调</Btn></div></details>
}
