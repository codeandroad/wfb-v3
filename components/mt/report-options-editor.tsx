'use client'
import type { ReportTemplate } from '@/lib/mt/reports'
import { reportOptions, type ReportOptions } from '@/lib/mt/report-options'
import { ReportCustomizationEditor } from './report-customization-editor'
import { ReportThemeEditor } from './report-theme-editor'
import { inputCls } from './ui'

export function ReportOptionsEditor({value,onChange,includeTheme=true}:{value:ReportTemplate;onChange:(t:ReportTemplate)=>void;includeTheme?:boolean}) {
  const o=reportOptions(value)
  const update=<K extends keyof ReportOptions>(key:K,v:ReportOptions[K])=>onChange({...value,options:{...o,classic:true,[key]:v}})
  const select=<K extends keyof ReportOptions>(label:string,key:K,choices:[string,string][]) => <label className="flex flex-col gap-1 text-sm">{label}<select className={inputCls} value={String(o[key])} onChange={e=>update(key,e.target.value as ReportOptions[K])}>{choices.map(([v,text])=><option key={v} value={v}>{text}</option>)}</select></label>
  return <fieldset className="flex min-w-0 flex-col gap-4"><legend className="mb-3 font-semibold">结构与样式</legend><div className="grid gap-3 sm:grid-cols-2">
    {value.kind==='class'?<>{select('说明区位置','notesPosition',[['right','右侧边栏'],['bottom','表格下方']])}{select('表头结构','mode',[['B','两层分组表头'],['A','紧凑日期表头']])}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={o.homeworkAppendix} onChange={e=>update('homeworkAppendix',e.target.checked)}/>附加作业详细表（默认关闭）</label></>:null}
    {value.kind==='personal'?<>{select('作业日期显示','homeworkDateMode',[['check','检查日期'],['deadline','有效截止日期'],['both','分别显示检查与截止']])}{(['lessons','lessonTimes','location','feedback','scores'] as const).map(key=><label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={o[key]} onChange={e=>update(key,e.target.checked)}/>{{lessonTimes:'明细显示时间',lessons:'真实课次明细（不重复日评价）',location:'明细显示教室',feedback:'已有公开作业反馈',scores:'已有真实分数'}[key]}</label>)}</>:null}
    {select('亮点呈现','highlightPlacement',[['off','不显示'],['merged','正文后显示亮点标题'],['separate','独立亮点区']])}
    <label className="flex flex-col gap-1 text-sm">字号密度<select className={inputCls} value={o.density==='compact'?'compact':o.padding>=12?'spacious':'standard'} onChange={e=>{const v=e.target.value;onChange({...value,options:{...o,classic:true,density:v==='compact'?'compact':'comfortable',padding:v==='compact'?4:v==='spacious'?12:7,tableSize:v==='spacious'?18:16}})}}><option value="compact">紧凑</option><option value="standard">标准</option><option value="spacious">舒展</option></select></label>
    {select('边框风格','borderWeight',[['thin','细线'],['strong','加粗']])}{select('空值显示','emptyValue',[['dash','–'],['blank','空白']])}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={o.gradeText} onChange={e=>update('gradeText',e.target.checked)}/>等级附带说明（默认仅 A+）</label>
    {select('教学说明标题','teachingTitle',[['教学介绍','教学介绍'],['教学内容','教学内容']])}{select('学情说明标题','learningTitle',[['学情介绍','学情介绍'],['学情概况','学情概况']])}
    {includeTheme?<div className="sm:col-span-2"><ReportThemeEditor value={value} onChange={onChange}/></div>:null}
  </div><ReportCustomizationEditor value={value} onChange={onChange}/><p className="text-sm text-muted-foreground">仅保存结构与样式，不保存学生、日期或本周正文。无亮点时不占位。</p></fieldset>
}
