'use client'
import { useEffect, useState } from 'react'
import { visibleBlocks, type FrozenReport } from '@/lib/mt/reports'
import { renderReportImages } from '@/lib/mt/report-export'

export function ReportView({report,version='未发布预览稿',thumbnail=false}:{report:FrozenReport;version?:string;thumbnail?:boolean}) {
  const key=JSON.stringify([thumbnail ? {...report,blocks:[],template:{...report.template,opening:'',closing:''}} : report,version])
  const [rendered,setRendered]=useState<{key:string;images:string[];error?:string}>({key:'',images:[]})
  const [scale,setScale]=useState('fit'),[segment,setSegment]=useState('all')
  useEffect(()=>{let active=true;const [snapshot,label]=JSON.parse(key) as [FrozenReport,string];renderReportImages(snapshot,label).then(images=>{if(active)setRendered({key,images})}).catch(e=>{if(active)setRendered({key,images:[],error:e instanceof Error?e.message:'出图失败'})});return()=>{active=false}},[key])
  const ready=rendered.key===key
  return <article data-testid="report-view" data-ready={ready&&!rendered.error} className="flex flex-col gap-3">
    {!thumbnail?<div className="flex flex-wrap items-center gap-3 text-sm"><label>预览比例 <select aria-label="预览比例" className="rounded border border-input p-1" value={scale} onChange={e=>setScale(e.target.value)}><option value="fit">适配查看</option><option value="1">实际输出比例</option><option value="1.5">放大150%</option></select></label><label>分段 <select aria-label="预览分段" className="rounded border border-input p-1" value={segment} onChange={e=>setSegment(e.target.value)}><option value="all">完整报告（{ready?rendered.images.length:0}张）</option>{ready?rendered.images.map((_,i)=><option key={i} value={i}>第{i+1}张</option>):null}</select></label></div>:null}
    {!ready?<p role="status">正在生成同源正式预览…</p>:rendered.error?<p role="alert">{rendered.error}</p>:<div className={`flex flex-col gap-4 overflow-auto ${thumbnail?'max-h-52':''}`}>{rendered.images.map((src,i)=>(thumbnail?i===0:segment==='all'||Number(segment)===i)?<img key={i} src={src} alt={`${report.name} · ${report.period} · 第${i+1}张，共${rendered.images.length}张；下方提供完整可读文本`} className="max-w-none self-start border border-border" style={{width:scale==='fit'?'100%':`${Number(scale)*100}%`}}/>:null)}</div>}
    {!thumbnail?<details><summary className="cursor-pointer text-sm">无障碍文字与表格</summary><h2>{report.name} · {report.period}</h2>{visibleBlocks(report).map((b,i)=><section key={i}><h3>{b.title}</h3>{b.lines.map((line,j)=><p key={j} className="whitespace-pre-wrap">{line}</p>)}</section>)}{report.tables?.map((table,i)=><section key={i} className="overflow-auto"><h3>{table.title}</h3><table><thead>{table.headers.map((row,j)=><tr key={j}>{row.map((c,k)=><th key={k} colSpan={c.span??1} rowSpan={c.rowSpan??1} scope={c.span?'colgroup':'col'}>{c.text}</th>)}</tr>)}</thead><tbody>{table.rows.map((row,j)=><tr key={j}>{row.map((c,k)=><td key={k} className="whitespace-pre-wrap border border-border p-2">{c}</td>)}</tr>)}</tbody></table></section>)}</details>:null}
  </article>
}
