import { visibleBlocks, type FrozenReport, type ReportTable } from './reports'
import { reportOptions } from './report-options'

type Paint = { height:number; draw:(ctx:CanvasRenderingContext2D,x:number,y:number)=>void }
export function classicMetadata(r:FrozenReport) { return [r.period, r.kind==='class'?r.scope:`${r.name} · ${r.scope}`,r.teacher] }
export function classicNotes(r:FrozenReport) {
  const o=reportOptions(r.template)
  const blocks=visibleBlocks(r).filter(b=>['teaching','learning',...(r.kind==='personal'?['comment','next']:[])].includes(b.key)).map(b=>({...b,title:b.key==='teaching'?o.teachingTitle:b.key==='learning'?o.learningTitle:b.title,lines:[...b.lines]}))
  const highlights=visibleBlocks(r).filter(b=>b.key==='highlights').flatMap(b=>b.lines).filter(x=>x.trim())
  if(highlights.length&&o.highlightPlacement!=='off') {
    const learning=blocks.find(b=>b.key==='learning')
    if(o.highlightPlacement==='merged'&&learning)learning.lines.push(...highlights)
    else blocks.push({key:o.highlightPlacement==='merged'?'learning':'highlights',title:o.highlightPlacement==='merged'?o.learningTitle:'本周亮点',lines:highlights})
  }
  return blocks.filter(b=>b.lines.some(x=>x.trim()))
}
export function renderClassicImages(r:FrozenReport):string[] {
  const o=reportOptions(r.template),personal=r.kind==='personal',compact=o.density==='compact'
  const margin=28,gap=24,ink='#263a33',font=(size:number,bold=false)=>`${bold?'600':'400'} ${size}px "Noto Report", ${r.template.font==='serif'?'serif':'sans-serif'}`
  const scratch=document.createElement('canvas').getContext('2d');if(!scratch)throw new Error('无法创建报告画布')
  const wrap=(text:string,width:number,size:number)=>{scratch.font=font(size);const result:string[]=[];for(const paragraph of text.split('\n')){let line='';for(const char of paragraph){if(line&&scratch.measureText(line+char).width>width){result.push(line);line=''}line+=char}result.push(line)}return result}
  const tablePaint=(table:ReportTable,width:number):Paint=>{
    const count=Math.max(...table.rows.map(row=>row.length),table.headers[0].reduce((n,c)=>n+(c.span??1),0),1)
    const cellWidth=width/count,size=o.tableSize,pad=compact?4:o.padding,line=size*1.3
    const headerHeight=Math.max(32,...table.headers.flat().map(c=>wrap(c.text,cellWidth*(c.span??1)-pad*2,size).length*line+pad*2))
    const rowHeights=table.rows.map(row=>Math.max(size+pad*2,...row.map(c=>wrap(c,cellWidth-pad*2,size).length*line+pad*2)))
    const height=table.headers.length*headerHeight+rowHeights.reduce((a,b)=>a+b,0)
    return {height,draw:(ctx,x,y)=>{
      const occupied=new Set<number>()
      const cell=(text:string,col:number,top:number,h:number,span:number,header:boolean,striped:boolean)=>{
        const w=cellWidth*span,left=x+col*cellWidth
        ctx.fillStyle=header?o.headerBackground:striped?o.stripeColor:r.template.background;ctx.fillRect(left,top,w,h)
        if(o.borders){ctx.strokeStyle=o.borderColor;ctx.lineWidth=o.borderWeight==='strong'?1.5:.7;ctx.strokeRect(left,top,w,h)}
        const lines=wrap(text,w-pad*2,size);ctx.font=font(size,header);ctx.fillStyle=header?o.headerText:ink;ctx.textAlign=personal&&!header?'left':'center'
        lines.forEach((text,i)=>ctx.fillText(text,personal&&!header?left+pad:left+w/2,top+(h-lines.length*line)/2+size+i*line));ctx.textAlign='left'
      }
      table.headers.forEach((row,index)=>{let col=0;row.forEach(c=>{while(index>0&&occupied.has(col))col++;const span=c.span??1;cell(c.text,col,y+index*headerHeight,headerHeight*(c.rowSpan??1),span,true,false);if((c.rowSpan??1)>1)for(let i=0;i<span;i++)occupied.add(col+i);col+=span})})
      let top=y+table.headers.length*headerHeight
      table.rows.forEach((row,index)=>{row.forEach((text,col)=>cell(text,col,top,rowHeights[index],1,false,o.striped&&index%2===1));top+=rowHeights[index]})
    }}
  }
  const notes=classicNotes(r)
  const notesPaint=(width:number):Paint=>{
    const size=o.bodySize,line=size*o.lineHeight
    const entries=notes.map(b=>({title:b.title,lines:b.lines.flatMap(text=>wrap(text.replace(/\*\*/g,''),width,size))}))
    const height=entries.reduce((sum,b)=>sum+size*1.5+b.lines.length*line+18,0)
    return {height,draw:(ctx,x,y)=>{for(const b of entries){ctx.font=font(size,true);ctx.fillStyle=r.template.color;ctx.fillText(b.title,x,y+size);y+=size*1.5;ctx.font=font(size);ctx.fillStyle=ink;for(const text of b.lines){ctx.fillText(text,x,y+size);y+=line}y+=18}}}
  }
  const tables=r.tables??[],main=personal?tables:tables.filter(t=>t.kind==='classroom'),appendices=personal?[]:tables.filter(t=>t.kind!=='classroom')
  const maxColumns=Math.max(1,...main.flatMap(t=>t.rows.map(row=>row.length)))
  const sidebar=!personal&&o.notesPosition==='right'&&notes.length>0
  const width=personal?1000:Math.max(1200,Math.min(3200,maxColumns*(o.gradeText?120:76)+(sidebar?320:0)+margin*2))
  const notesWidth=sidebar?300:width-margin*2,tableWidth=width-margin*2-(sidebar?notesWidth+gap:0)
  const sections=main.map(table=>({table,paint:tablePaint(table,tableWidth)})),note=notesPaint(notesWidth)
  const tableHeight=sections.reduce((sum,s)=>sum+s.paint.height+(main.length>1||personal?34:0)+16,0)
  const headerHeight=116,bodyHeight=sidebar?Math.max(tableHeight,note.height):tableHeight+(notes.length?note.height+12:0)
  const makeCanvas=(height:number)=>{if(height>30000)throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度');const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.ceil(height);const ctx=canvas.getContext('2d');if(!ctx)throw new Error('无法生成报告');ctx.fillStyle=r.template.background;ctx.fillRect(0,0,width,height);return {canvas,ctx}}
  const {canvas,ctx}=makeCanvas(headerHeight+bodyHeight+margin)
  classicMetadata(r).forEach((text,i)=>{ctx.font=font(i===0?24:18,i<2);ctx.fillStyle=i===0?r.template.color:ink;ctx.textAlign='center';ctx.fillText(text,width/2,34+i*28);ctx.textAlign='left'})
  let y=headerHeight
  const notesFirst=personal&&r.template.preset==='P03'&&notes.length>0
  if(notesFirst){note.draw(ctx,margin,y);y+=note.height+12}
  for(const section of sections){if(main.length>1||personal){ctx.font=font(18,true);ctx.fillStyle=r.template.color;ctx.fillText(section.table.title,margin,y+20);y+=34}section.paint.draw(ctx,margin,y);y+=section.paint.height+16}
  if(notes.length&&!notesFirst)note.draw(ctx,sidebar?width-margin-notesWidth:margin,sidebar?headerHeight:y+12)
  const output=[canvas.toDataURL('image/png')]
  for(const table of appendices){const paint=tablePaint(table,width-margin*2),{canvas,ctx}=makeCanvas(paint.height+100);ctx.font=font(22,true);ctx.fillStyle=r.template.color;ctx.fillText(table.title,margin,38);paint.draw(ctx,margin,68);output.push(canvas.toDataURL('image/png'))}
  return output
}
