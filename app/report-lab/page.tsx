'use client'
import { useMemo, useState } from 'react'
import { unzipSync, strFromU8 } from 'fflate'
import { reportFixture } from '@/lib/mt/report-fixture'
import { prepareReports } from '@/lib/mt/report-build'
import { INITIAL_RULES } from '@/lib/mt/report-customization'
import { SYSTEM_TEMPLATES } from '@/lib/mt/reports'
import { exportReportZip, downloadFile, renderReportImages } from '@/lib/mt/report-export'
import type { Publication } from '@/lib/mt/model'
import { ReportView } from '@/components/mt/report-view'
import { Btn } from '@/components/mt/ui'

export default function ReportLab(){
  const [size,setSize]=useState<28|72|123>(28),[index,setIndex]=useState(3),[busy,setBusy]=useState(false),[result,setResult]=useState(''),[artifact,setArtifact]=useState<Blob|null>(null)
  const [custom,setCustom]=useState(false)
  const fixture=useMemo(()=>reportFixture(size),[size])
  const configured=useMemo(()=>{const {b,tw,prep}=fixture;const customization={elements:{metadata:{size:18},'classroom.attendance.header':{background:'#e5efff',color:'#263a33'},'homework.quality.header':{background:'#ecfdf3',color:'#166534'}},rules:[...INITIAL_RULES,{id:'class-excellent',name:'课堂指定等级',enabled:true,field:'classroom',revision:'SYS_BASIC4@1',grades:['A'],style:{color:'#166534'}},{id:'hw-excellent',name:'作业指定等级',enabled:true,field:'quality',revision:'SYS_BASIC4@1',grades:['A'],style:{color:'#166534'}}]};return prepareReports(b,[tw],{...prep,selected:tw.students.slice(0,3),personalOverrides:{[tw.students[0]]:{elements:{'homework.quality.body':{background:'#e5efff'}}}}},{...SYSTEM_TEMPLATES[1],customization},{...SYSTEM_TEMPLATES[3],customization}).reports},[fixture])
  const shown=custom?configured:fixture.reports
  const run=async(batch:boolean)=>{setBusy(true);setResult('正在按正式导出函数生成并逐文件解码…');setArtifact(null)
    try {
      const {b,tw,prep,reports}=fixture
      const output=batch?prepareReports(b,[tw],{...prep,classReport:false},{...SYSTEM_TEMPLATES[1],modules:SYSTEM_TEMPLATES[1].modules.filter(k=>k!=='teaching')},SYSTEM_TEMPLATES[3]).reports:shown
      if(JSON.stringify(output).includes('PRIVATE_'))throw new Error('隐私哨兵泄漏')
      if(batch&&output.length!==size)throw new Error('个人批量名单不完整')
      const pub={week:5,revision:1,publishedAt:'隔离合成验收／不是正式发布'} as Publication
      const zip=await exportReportZip(pub,output);if(zip.failed)throw new Error(`${zip.failed}份生成失败`)
      const files=unzipSync(new Uint8Array(await zip.blob.arrayBuffer())),manifest=JSON.parse(strFromU8(files['清单.json']))
      let decoded=0;const dimensions=[]
      for(const [name,bytes] of Object.entries(files)){if(!name.endsWith('.png'))continue;const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));if(!image.width||!image.height)throw new Error('空图');dimensions.push({name,width:image.width,height:image.height});image.close();decoded++}
      if(!batch) for(let i=0;i<output.length;i++) { const preview=await renderReportImages(output[i],'未发布预览稿');for(let page=0;page<preview.length;page++){const bytes=files[manifest.reports[i].files[page]],expected=Uint8Array.from(atob(preview[page].split(',')[1]),c=>c.charCodeAt(0));if(bytes.length!==expected.length||bytes.some((byte,j)=>byte!==expected[j]))throw new Error('预览与ZIP内PNG不一致')} }
      setArtifact(zip.blob);setResult(JSON.stringify({status:'PASS',previewExportParity:batch?'not_run':'byte-identical',size,mode:batch?'完整个人批量':custom?'r2班级与三人精调':'六套实际报告',reports:output.length,decodedPNGs:decoded,manifestCount:manifest.count,first:manifest.reports[0].object,middle:manifest.reports[Math.floor(manifest.count/2)].object,last:manifest.reports.at(-1).object,privacySentinel:'absent',dimensions},null,2))
    }catch(e){setResult(`FAIL: ${e instanceof Error?e.message:String(e)}`)}finally{setBusy(false)}
  }
  return <main className="mx-auto flex max-w-6xl flex-col gap-5 p-6 font-sans"><header><h1 className="text-2xl font-semibold">报告隔离合成验收</h1><p className="text-sm text-muted-foreground">只使用内存副本与固定测试时钟，不读取或覆盖试填存储，不发布、不通知。使用产品的日资格投影、报告构建与PNG／ZIP函数；不能替代工作台连续操作验收。</p></header><div className="flex flex-wrap gap-3"><label>合成名单<select aria-label="合成名单" value={size} onChange={e=>{setSize(Number(e.target.value) as 28|72|123);setResult('');setArtifact(null)}}>{[28,72,123].map(n=><option key={n} value={n}>{n}人</option>)}</select></label><label>模板<select aria-label="合成模板" value={index} onChange={e=>setIndex(Number(e.target.value))}>{shown.map((r,i)=><option value={i} key={r.key}>{r.template.id} · {r.template.name}</option>)}</select></label><label><input type="checkbox" checked={custom} onChange={e=>{setCustom(e.target.checked);setIndex(0);setResult('');setArtifact(null)}}/>r2 班级＋三人精调样本</label><Btn disabled={busy} onClick={()=>run(false)}>生成当前组合验收ZIP</Btn><Btn disabled={busy} onClick={()=>run(true)}>生成全部个人ZIP并解码核对</Btn>{artifact?<Btn onClick={()=>downloadFile(artifact,`合成${size}人报告验收.zip`)}>下载已验证ZIP</Btn>:null}</div><p role="status">{busy?'生成中，请勿重复操作':artifact?'文件已生成，所有PNG已实际解码':'等待执行验收'}</p>{result?<details open><summary>本次真实运行结果</summary><pre data-testid="lab-result" className="max-h-64 overflow-auto whitespace-pre-wrap text-sm">{result}</pre></details>:null}<ReportView report={shown[Math.min(index,shown.length-1)]} version="隔离合成验收样本 · 非正式发布"/></main>
}
