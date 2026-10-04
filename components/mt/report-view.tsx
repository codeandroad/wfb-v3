'use client'
import { useEffect, useState } from 'react'
import { visibleBlocks, type FrozenReport } from '@/lib/mt/reports'
import { renderReportImages } from '@/lib/mt/report-export'
import { classicMetadata, classicNotes } from '@/lib/mt/report-classic-export'

export function ReportView({report,version='未发布预览稿',thumbnail=false}:{report:FrozenReport;version?:string;thumbnail?:boolean}) {
  const classic=!!report.template.options?.classic
  const key=JSON.stringify([classic?{...report,cutoff:''}:report,classic?'':version])
  const [rendered,setRendered]=useState<{key:string;images:string[];error?:string}>({key:'',images:[]})
  const [scale,setScale]=useState('fit'),[segment,setSegment]=useState(0)
  useEffect(()=>{let active=true;const timer=setTimeout(()=>{const [snapshot,label]=JSON.parse(key) as [FrozenReport,string];renderReportImages(snapshot,label).then(images=>{if(active)setRendered({key,images})}).catch(e=>{if(active)setRendered({key,images:[],error:e instanceof Error?e.message:'出图失败'})})},120);return()=>{active=false;clearTimeout(timer)}},[key])
  const ready=rendered.key===key, index=Math.min(segment,Math.max(0,rendered.images.length-1))
  return <article data-testid="report-view" data-ready={ready&&!rendered.error} className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><label>查看比例 <select aria-label="预览比例" className="rounded border border-input p-1" value={scale} onChange={e=>setScale(e.target.value)}><option value="fit">适配查看</option><option value="original">原始比例</option><option value="width">宽度适配</option></select></label><label>输出页 <select aria-label="预览输出页" className="rounded border border-input p-1" value={index} onChange={e=>setSegment(Number(e.target.value))}>{rendered.images.length?rendered.images.map((_,i)=><option key={i} value={i}>{i===0?'主报告':`附表 ${i}`}</option>):<option value={0}>主报告</option>}</select></label></div>
    <div data-testid="report-viewport" aria-busy={!ready} className="relative flex h-[560px] items-start justify-center overflow-auto rounded border border-border bg-muted p-3" style={{overflowAnchor:'none'}}>
      {rendered.images[index]?<img src={rendered.images[index]} alt={`${report.name} · ${report.period} · ${index===0?'主报告':`附表 ${index}`}；下方提供完整可读文本`} className="block shrink-0" style={scale==='fit'?{width:'100%',height:'100%',objectFit:'contain',objectPosition:'top'}:scale==='width'?{width:'100%',height:'auto'}:{maxWidth:'none',width:'auto',height:'auto'}}/>:null}
      {!ready?<p role="status" className="absolute left-3 top-3 rounded bg-card p-2 text-sm text-card-foreground">正在更新预览…</p>:rendered.error?<p role="alert" className="absolute left-3 top-3 bg-card p-2 text-sm text-destructive">{rendered.error}</p>:null}
    </div>
    {!thumbnail?<details><summary className="cursor-pointer text-sm text-muted-foreground">无障碍文字与表格</summary>{classic?classicMetadata(report).map((text,i)=><p key={i}>{text}</p>):<h2>{report.name} · {report.period}</h2>}{(classic?classicNotes(report):visibleBlocks(report)).map((b,i)=><section key={i}><h3>{b.title}</h3>{b.lines.map((line,j)=><p key={j} className="whitespace-pre-wrap">{line}</p>)}</section>)}{report.tables?.map((table,i)=><section key={i} className="overflow-auto"><h3>{table.title}</h3><table><thead>{table.headers.map((row,j)=><tr key={j}>{row.map((c,k)=><th key={k} colSpan={c.span??1} rowSpan={c.rowSpan??1} scope={c.span?'colgroup':'col'}>{c.text}</th>)}</tr>)}</thead><tbody>{table.rows.map((row,j)=><tr key={j}>{row.map((c,k)=><td key={k} className="whitespace-pre-wrap border border-border p-2">{c}</td>)}</tr>)}</tbody></table></section>)}</details>:null}
  </article>
}
