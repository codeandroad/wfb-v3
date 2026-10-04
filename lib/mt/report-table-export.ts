import type { FrozenReport } from './reports'

export function renderTableImages(report: FrozenReport, version: string): string[] {
  const output: string[] = []
  const t = report.template
  for (const table of report.tables ?? []) {
    const columns = table.headers[0].reduce((n,c)=>n+(c.span ?? 1),0)
    const width = Math.max(1000,columns*230+64), cellWidth=(width-64)/columns
    const canvas=document.createElement('canvas'); canvas.width=width
    const ctx=canvas.getContext('2d'); if(!ctx) throw new Error('无法创建表格图片')
    const font=`22px ${t.font === 'serif' ? 'Georgia, ' : ''}"Noto Report", sans-serif`
    const wrap=(text:string,w:number) => { ctx.font=font; const lines:string[]=[]; for(const p of text.split('\n')) { let line=''; for(const c of p) { if(ctx.measureText(line+c).width>w && line){lines.push(line);line=''} line+=c } lines.push(line) } return lines }
    const headers=table.headers.map(row=>row.map(c=>({...c,lines:wrap(c.text,cellWidth*(c.span??1)-24)})))
    const headerHeights=headers.map(row=>Math.max(...row.map(c=>c.lines.length),1)*32+24)
    const rows=table.rows.map(row=>row.map(cell=>wrap(cell,cellWidth-24)))
    const pages:typeof rows[]=[[]]; let height=0
    for(const row of rows){ const h=Math.max(...row.map(c=>c.length),1)*32+24; if(height+h>2100 && pages.at(-1)!.length){pages.push([]);height=0} pages.at(-1)!.push(row);height+=h }
    for(const [page,rows] of pages.entries()) {
      canvas.height=250+headerHeights.reduce((a,b)=>a+b,0)+rows.reduce((a,r)=>a+Math.max(...r.map(c=>c.length),1)*32+24,0)
      if(canvas.height>30000 || width>30000) throw new Error('表格超出画布安全尺寸，请减少日期组后重试')
      ctx.fillStyle=t.background;ctx.fillRect(0,0,width,canvas.height)
      ctx.fillStyle=t.color;ctx.font=`bold ${font}`;ctx.fillText(`${report.name} · ${table.title}`,32,42)
      ctx.fillStyle='#263a33';ctx.font=font;ctx.fillText(`${report.period} · ${version} · ${page+1}/${pages.length}`,32,82);ctx.fillText(report.scope,32,122)
      let y=150
      const draw=(cells:{lines:string[];span?:number}[],h:number,heading=false)=>{let x=32; for(const c of cells){const w=cellWidth*(c.span??1);ctx.strokeStyle='#d8e1dc';ctx.strokeRect(x,y,w,h);ctx.fillStyle=heading?t.color:'#263a33';ctx.font=heading&&t.bold?`bold ${font}`:font;c.lines.forEach((line,i)=>ctx.fillText(line,x+12,y+32+i*32));x+=w}y+=h}
      headers.forEach((row,i)=>draw(row,headerHeights[i],true))
      rows.forEach(row=>draw(row.map(lines=>({lines})),Math.max(...row.map(c=>c.length),1)*32+24))
      ctx.font=font;ctx.fillStyle='#263a33';ctx.fillText(`责任教师：${report.teacher} · 内容截止 ${report.cutoff.slice(0,16).replace('T',' ')}`,32,canvas.height-32)
      const image=canvas.toDataURL('image/png');if(image.length<1000)throw new Error('表格PNG生成失败');output.push(image)
    }
  }
  return output
}
