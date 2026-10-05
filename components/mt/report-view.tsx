'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import { visibleBlocks, type FrozenReport } from '@/lib/mt/reports'
import { renderReportImages, downloadFile } from '@/lib/mt/report-export'
import { classicMetadata, classicNotes } from '@/lib/mt/report-classic-export'
import { ReportHTML } from './report-html'
import { Btn } from './ui'

const ZOOMS = [0.5, 0.6, 0.7, 0.85, 1]

export function ReportView({report,version='未发布预览稿',thumbnail=false,adaptive=false}:{report:FrozenReport;version?:string;thumbnail?:boolean;adaptive?:boolean}) {
  const classic=!!report.template.options?.classic
  const [exporting,setExporting]=useState(false)
  const [error,setError]=useState('')
  const [zoom,setZoom]=useState<number|'fit'>(0.85)
  const [scale,setScale]=useState(2)
  const [fitZoom,setFitZoom]=useState(0.85)
  const viewportRef=useRef<HTMLDivElement>(null)
  const measureRef=useRef<HTMLDivElement>(null)

  // 适配宽度：用隐藏的等宽测量层算出内容自然宽度，再算缩放比（不放大超过 100%）
  useLayoutEffect(()=>{
    if(zoom!=='fit')return
    const viewport=viewportRef.current,measure=measureRef.current
    if(!viewport||!measure)return
    const compute=()=>{
      const natural=measure.scrollWidth||1
      const avail=viewport.clientWidth-24
      setFitZoom(Math.min(1,Math.max(0.2,avail/natural)))
    }
    compute()
    const ro=new ResizeObserver(compute)
    ro.observe(viewport)
    return ()=>ro.disconnect()
  },[zoom,report])

  const effectiveZoom=zoom==='fit'?fitZoom:zoom
  const exportPNG=async()=>{
    setExporting(true);setError('')
    try{
      const images=await renderReportImages(report,version,scale)
      images.forEach((url,i)=>downloadFile(url,`${report.name}-${report.period}-P${i+1}.png`.replace(/[\\/:*?"<>|]/g,'_')))
    }catch(e){setError(e instanceof Error?e.message:'导出失败，请重试')}
    finally{setExporting(false)}
  }
  return <article data-testid="report-view" className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13px] text-muted-foreground">{version}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-muted-foreground">预览缩放</span>
        <Btn size="sm" variant={zoom==='fit'?'primary':'outline'} onClick={()=>setZoom('fit')}>适配宽度</Btn>
        {ZOOMS.map(z=><Btn key={z} size="sm" variant={zoom===z?'primary':'outline'} onClick={()=>setZoom(z)}>{Math.round(z*100)}%</Btn>)}
        <span className="ml-1 text-[12px] text-muted-foreground">清晰度</span>
        <select aria-label="导出清晰度" className="rounded border border-input bg-background px-2 py-1 text-[12px]" value={scale} onChange={e=>setScale(Number(e.target.value))}>
          <option value={1}>标准</option>
          <option value={2}>高清</option>
          <option value={3}>超清</option>
        </select>
        <Btn size="sm" variant="primary" disabled={exporting} onClick={exportPNG}>{exporting?'导出中…':'导出图片'}</Btn>
      </div>
    </div>
    {error?<p role="alert" className="text-[13px] text-destructive">{error}</p>:null}
    <div ref={viewportRef} data-testid="report-viewport" className="relative rounded-lg border border-border bg-muted p-3" style={adaptive?{maxHeight:'calc(100dvh - 260px)',overflow:'auto'}:undefined}>
      <div style={{zoom:effectiveZoom}}><ReportHTML report={report} /></div>
      {zoom==='fit'?(
        <div aria-hidden ref={measureRef} style={{position:'absolute',top:0,left:0,visibility:'hidden',pointerEvents:'none',width:'max-content',maxWidth:'none'}}>
          <ReportHTML report={report} />
        </div>
      ):null}
    </div>
    {!thumbnail?<details><summary className="cursor-pointer text-sm text-muted-foreground">无障碍文字与表格</summary>{classic?classicMetadata(report).map((text,i)=><p key={i}>{text}</p>):<h2>{report.name} · {report.period}</h2>}{(classic?classicNotes(report):visibleBlocks(report)).map((b,i)=><section key={i}><h3>{b.title}</h3>{b.lines.map((line,j)=><p key={j} className="whitespace-pre-wrap">{line}</p>)}</section>)}{report.tables?.map((table,i)=><section key={i} className="overflow-auto"><h3>{table.title}</h3><table><thead>{table.headers.map((row,j)=><tr key={j}>{row.map((c,k)=><th key={k} colSpan={c.span??1} rowSpan={c.rowSpan??1} scope={c.span?'colgroup':'col'}>{c.text}</th>)}</tr>)}</thead><tbody>{table.rows.map((row,j)=><tr key={j}>{row.map((c,k)=><td key={k} className="whitespace-pre-wrap border border-border p-2">{c}</td>)}</tr>)}</tbody></table></section>)}</details>:null}
  </article>
}
