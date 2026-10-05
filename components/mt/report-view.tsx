'use client'
import { useState } from 'react'
import { visibleBlocks, type FrozenReport } from '@/lib/mt/reports'
import { renderReportImages, downloadFile } from '@/lib/mt/report-export'
import { classicMetadata, classicNotes } from '@/lib/mt/report-classic-export'
import { ReportHTML } from './report-html'
import { Btn } from './ui'

export function ReportView({report,version='未发布预览稿',thumbnail=false,adaptive=false}:{report:FrozenReport;version?:string;thumbnail?:boolean;adaptive?:boolean}) {
  const classic=!!report.template.options?.classic
  const [exporting,setExporting]=useState(false)
  const [error,setError]=useState('')
  const [zoom,setZoom]=useState(0.85)
  const exportPNG=async()=>{
    setExporting(true);setError('')
    try{
      const images=await renderReportImages(report,version)
      images.forEach((url,i)=>downloadFile(url,`${report.name}-${report.period}-P${i+1}.png`.replace(/[\\/:*?"<>|]/g,'_')))
    }catch(e){setError(e instanceof Error?e.message:'导出失败，请重试')}
    finally{setExporting(false)}
  }
  return <article data-testid="report-view" className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13px] text-muted-foreground">{version}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-muted-foreground">预览缩放</span>
        {[0.7,0.85,1].map(z=><Btn key={z} size="sm" variant={zoom===z?'primary':'outline'} onClick={()=>setZoom(z)}>{Math.round(z*100)}%</Btn>)}
        <Btn size="sm" variant="primary" disabled={exporting} onClick={exportPNG}>{exporting?'导出中…':'导出图片'}</Btn>
      </div>
    </div>
    {error?<p role="alert" className="text-[13px] text-destructive">{error}</p>:null}
    <div data-testid="report-viewport" className="rounded-lg border border-border bg-muted p-3" style={adaptive?{maxHeight:'calc(100dvh - 260px)',overflow:'auto'}:undefined}>
      <div style={{zoom}}><ReportHTML report={report} /></div>
    </div>
    {!thumbnail?<details><summary className="cursor-pointer text-sm text-muted-foreground">无障碍文字与表格</summary>{classic?classicMetadata(report).map((text,i)=><p key={i}>{text}</p>):<h2>{report.name} · {report.period}</h2>}{(classic?classicNotes(report):visibleBlocks(report)).map((b,i)=><section key={i}><h3>{b.title}</h3>{b.lines.map((line,j)=><p key={j} className="whitespace-pre-wrap">{line}</p>)}</section>)}{report.tables?.map((table,i)=><section key={i} className="overflow-auto"><h3>{table.title}</h3><table><thead>{table.headers.map((row,j)=><tr key={j}>{row.map((c,k)=><th key={k} colSpan={c.span??1} rowSpan={c.rowSpan??1} scope={c.span?'colgroup':'col'}>{c.text}</th>)}</tr>)}</thead><tbody>{table.rows.map((row,j)=><tr key={j}>{row.map((c,k)=><td key={k} className="whitespace-pre-wrap border border-border p-2">{c}</td>)}</tr>)}</tbody></table></section>)}</details>:null}
  </article>
}
