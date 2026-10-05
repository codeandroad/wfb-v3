import { visibleBlocks, type FrozenReport, type ReportTable } from './reports'
import { reportOptions } from './report-options'
import { DEFAULT_METADATA, resolveCellBackground, resolveElement, colorValue, type ElementStyle, type CellFact } from './report-customization'

type Paint = { height:number; draw:(ctx:CanvasRenderingContext2D,x:number,y:number)=>void }
export function classicMetadata(r:FrozenReport) { const scope=r.scope.replace(/\s*[（(]整科[）)]/g,'');const values={period:r.period,scope:r.kind==='class'?scope:`${r.name} · ${scope}`,teacher:r.teacher};return (r.template.customization?.metadata??DEFAULT_METADATA).map(row=>row.source==='custom'?`${row.label}${row.label&&row.text?'：':''}${row.text??''}`:values[row.source]) }
export function classicNotes(r:FrozenReport) {
  const o=reportOptions(r.template)
  const blocks=visibleBlocks(r).filter(b=>['teaching','learning',...(r.kind==='personal'?['comment','next']:[])].includes(b.key)).map(b=>({...b,title:b.key==='teaching'?o.teachingTitle:b.key==='learning'?o.learningTitle:b.title,lines:[...b.lines]}))
  const highlights=visibleBlocks(r).filter(b=>b.key==='highlights').flatMap(b=>b.lines).filter(x=>x.trim())
  if(highlights.length&&o.highlightPlacement!=='off') {
    const grouped=new Map<string,string[]>()
    for(const text of highlights){const match=r.kind==='class'?text.match(/^([^：:]+)[：:]\s*([\s\S]*)$/):null;const name=match?.[1]??'';grouped.set(name,[...(grouped.get(name)??[]),match?.[2]??text])}
    blocks.push({key:'highlights',title:'亮点',lines:[...grouped].map(([name,items])=>`${name?`${name}：`:''}${[...new Set(items)].join('；')}`)})
  }
  return blocks.filter(b=>b.lines.some(x=>x.trim()))
}
export function renderClassicImages(r:FrozenReport):string[] {
  const o=reportOptions(r.template),personal=r.kind==='personal',compact=o.density==='compact'
  const margin=28,gap=24,ink='#263a33',font=(size:number,bold=false)=>`${bold?'600':'400'} ${size}px "Noto Report", ${r.template.font==='serif'?'serif':'sans-serif'}`
  const scratch=document.createElement('canvas').getContext('2d');if(!scratch)throw new Error('无法创建报告画布')
  const wrap=(text:string,width:number,size:number)=>{scratch.font=font(size);const result:string[]=[];for(const paragraph of text.split('\n')){let line='';for(const char of paragraph){if(line&&scratch.measureText(line+char).width>width){result.push(line);line=''}line+=char}result.push(line)}return result}
  const columnWidths=(table:ReportTable)=>{
    const count=Math.max(...table.rows.map(row=>row.length),table.headers[0].reduce((n,c)=>n+(c.span??1),0),1),pad=compact?4:o.padding
    scratch.font=font(o.tableSize)
    const widths=Array.from({length:count},(_,col)=>Math.max(col===0?80:48,...table.rows.map(row=>Math.min(160,scratch.measureText(row[col]??'').width+pad*2+4))))
    scratch.font=font(o.tableSize,true)
    const occupied=new Set<number>()
    table.headers.forEach((row,index)=>{let col=0;for(const c of row){while(index>0&&occupied.has(col))col++;const span=c.span??1,needed=Math.max(...c.text.split('\n').map(text=>scratch.measureText(text).width))+pad*2+4;for(let i=0;i<span;i++){widths[col+i]=Math.max(widths[col+i],needed/span);if((c.rowSpan??1)>1)occupied.add(col+i)}col+=span}})
    return widths.map((w,col)=>r.template.customization?.elements?.[`${table.kind}.${table.fields?.[col]??'body'}.body`]?.width??w)
  }
  const tablePaint=(table:ReportTable,width:number):Paint=>{
    const size=o.tableSize,pad=compact?4:o.padding,line=size*1.3
    const natural=columnWidths(table)
    const total=natural.reduce((a,b)=>a+b,0),widths=natural.map(w=>w*width/total)
    const spanWidth=(col:number,span:number)=>widths.slice(col,col+span).reduce((a,b)=>a+b,0)
    const headerSize=compact&&table.headers.length===1?Math.min(size,14):size
    const fitHeader=(text:string,width:number,requested:number)=>{if(!compact||table.headers.length!==1)return requested;scratch.font=font(requested,true);return Math.max(Math.min(14,requested),Math.min(requested,requested*width/Math.max(1,scratch.measureText(text).width)))}
    const headerOccupied=new Set<number>()
    let headerHeight=Math.max(32,...table.headers.flatMap((row,index)=>{let col=0;return row.map(c=>{while(index>0&&headerOccupied.has(col))col++;const span=c.span??1,hs=resolveElement(r.template.customization,`${table.kind}.${index===0&&table.headers.length>1&&col>0?'date':table.fields?.[col]??(col===0?'name':'body')}.header`,{size:headerSize,padding:pad,lineHeight:1.3}),fs=fitHeader(c.text,spanWidth(col,span)-hs.padding!*2,hs.size!),h=wrap(c.text,spanWidth(col,span)-hs.padding!*2,fs).length*fs*hs.lineHeight!+hs.padding!*2;if((c.rowSpan??1)>1)for(let i=0;i<span;i++)headerOccupied.add(col+i);col+=span;return h})}))
    const richLayout=(fact:CellFact,width:number,base:ElementStyle,header=false)=>{const lines:{glyphs:{text:string;width:number;style:ElementStyle}[];width:number;height:number}[]=[{glyphs:[],width:0,height:0}];for(const part of fact.parts??[]){const style=resolveElement(r.template.customization,part.fact?.field==='assignment'?'homework.assignment.body':`${table.kind}.${part.fact?.field??'body'}.${header?'header':'body'}`,base,part.fact);scratch.font=font(style.size!,style.weight!>=600);for(const text of part.text){const w=scratch.measureText(text).width;let line=lines[lines.length-1];if(text==='\n'||line.width+w>width&&line.glyphs.length){line={glyphs:[],width:0,height:0};lines.push(line)}if(text==='\n')continue;line.glyphs.push({text,width:w,style});line.width+=w;line.height=Math.max(line.height,style.size!*style.lineHeight!)}}return lines}
    const namedOccupied=new Set<number>();table.headers.forEach((row,index)=>{let col=0;for(const c of row){while(index>0&&namedOccupied.has(col))col++;const span=c.span??1;if(c.assignmentName){const lines=richLayout({field:'date',parts:[{text:c.text.slice(0,-c.assignmentName.length),fact:{field:'date'}},{text:c.assignmentName,fact:{field:'assignment'}}]},spanWidth(col,span)-pad*2,{size:headerSize,padding:pad,lineHeight:1.3,weight:600},true);headerHeight=Math.max(headerHeight,lines.reduce((n,l)=>n+l.height,0)+pad*2)}if((c.rowSpan??1)>1)for(let i=0;i<span;i++)namedOccupied.add(col+i);col+=span}})
    const rowHeights=table.rows.map((row,index)=>Math.max(size+pad*2,...row.map((c,col)=>{const s=resolveElement(r.template.customization,`${table.kind}.${table.fields?.[col]??(col===0?'name':'body')}.body`,{size,padding:pad,lineHeight:1.3},table.facts?.[index]?.[col]);const fact=table.facts?.[index]?.[col];return Math.max(s.minHeight??0,(fact?.parts?richLayout(fact,widths[col]-s.padding!*2,{size,padding:pad,lineHeight:1.3,weight:400}).reduce((n,l)=>n+l.height,0):wrap(c,widths[col]-s.padding!*2,s.size!).length*s.size!*s.lineHeight!)+s.padding!*2)})))
    const height=table.headers.length*headerHeight+rowHeights.reduce((a,b)=>a+b,0)
    return {height,draw:(ctx,x,y)=>{
      const occupied=new Set<number>()
      const cell=(text:string,col:number,top:number,h:number,span:number,header:boolean,striped:boolean,fact?:CellFact,dateHeader=false,assignmentName?:string)=>{
        const w=spanWidth(col,span),left=x+spanWidth(0,col)
        const field=dateHeader?'date':table.fields?.[col]??(col===0?'name':'body')
        const s=resolveElement(r.template.customization,`${table.kind}.${field}.${header?'header':'body'}`,{size:header?headerSize:size,padding:pad,weight:header?600:400,color:header?o.headerText:ink,background:header?o.headerBackground:striped?o.stripeColor:r.template.background,align:personal&&!header?'left':'center',lineHeight:1.3,borderColor:o.borderColor,borderWidth:o.borders?(o.borderWeight==='strong'?1.5:.7):0},fact?.parts?undefined:fact)
        const p=s.padding!,fs=header?fitHeader(text,w-p*2,s.size!):s.size!,lh=fs*s.lineHeight!
        const cellBg=(header&&assignmentName?r.template.customization?.elements?.['homework.assignment.body']?.cellBackground:undefined)??resolveCellBackground(r.template.customization,`${table.kind}.${field}.${header?'header':'body'}`,fact)??(header?o.headerBackground:striped?o.stripeColor:r.template.background);ctx.fillStyle=colorValue(cellBg)!;ctx.fillRect(left,top,w,h)
        if(s.borderWidth){ctx.strokeStyle=colorValue(s.borderColor!)!;ctx.lineWidth=s.borderWidth;ctx.strokeRect(left,top,w,h)}
        if(header&&assignmentName)fact={field:'date',parts:[{text:text.slice(0,-assignmentName.length),fact:{field:'date'}},{text:assignmentName,fact:{field:'assignment'}}]}
        if(fact?.parts){const lines=richLayout(fact,w-p*2,{size:header?headerSize:size,padding:pad,weight:header?600:400,lineHeight:1.3,color:header?o.headerText:ink},header);let topY=top+(h-lines.reduce((n,l)=>n+l.height,0))/2;ctx.textAlign='left';for(const line of lines){let cursor=s.align==='left'?left+p:s.align==='right'?left+w-p-line.width:left+(w-line.width)/2;for(const glyph of line.glyphs){const gs=glyph.style;if(gs.background){ctx.fillStyle=colorValue(gs.background)!;ctx.fillRect(cursor,topY,glyph.width,line.height)}ctx.font=font(gs.size!,gs.weight!>=600);ctx.fillStyle=colorValue(gs.color!)!;ctx.fillText(glyph.text,cursor,topY+(line.height-gs.size!*1.3)/2+gs.size!);cursor+=glyph.width}topY+=line.height}return}
        const lines=wrap(text,w-p*2,fs);ctx.font=font(fs,s.weight!>=600);ctx.fillStyle=colorValue(s.color!)!;ctx.textAlign=s.align!
        const textBg=resolveElement(r.template.customization,`${table.kind}.${field}.${header?'header':'body'}`,{},fact).background
        lines.forEach((text,i)=>{const tx=s.align==='left'?left+p:s.align==='right'?left+w-p:left+w/2,ty=top+(h-lines.length*lh)/2+i*lh;if(textBg){const tw=ctx.measureText(text).width;ctx.fillStyle=colorValue(textBg)!;ctx.fillRect(s.align==='left'?tx:s.align==='right'?tx-tw:tx-tw/2,ty,tw,lh)}ctx.fillStyle=colorValue(s.color!)!;ctx.fillText(text,tx,ty+fs)});ctx.textAlign='left'
      }
      table.headers.forEach((row,index)=>{let col=0;row.forEach(c=>{while(index>0&&occupied.has(col))col++;const span=c.span??1;cell(c.text,col,y+index*headerHeight,headerHeight*(c.rowSpan??1),span,true,false,undefined,index===0&&table.headers.length>1&&col>0,c.assignmentName);if((c.rowSpan??1)>1)for(let i=0;i<span;i++)occupied.add(col+i);col+=span})})
      let top=y+table.headers.length*headerHeight
      table.rows.forEach((row,index)=>{row.forEach((text,col)=>cell(text,col,top,rowHeights[index],1,false,o.striped&&index%2===1,table.facts?.[index]?.[col]));top+=rowHeights[index]})
    }}
  }
  const notes=classicNotes(r)
  const notesPaint=(width:number):Paint=>{
    const size=o.bodySize,line=size*o.lineHeight
    const entries=notes.map(b=>{const title=resolveElement(r.template.customization,`${b.key}.title`,{size,weight:600,color:r.template.color,lineHeight:1.5,padding:0}),body=resolveElement(r.template.customization,`${b.key}.body`,{size,weight:400,color:ink,lineHeight:o.lineHeight,padding:0});return {title:b.title,titleStyle:title,body,lines:b.lines.flatMap(text=>wrap(text.replace(/\*\*/g,''),width-body.padding!*2,body.size!))}})
    const height=entries.reduce((sum,b)=>sum+wrap(b.title,width-b.titleStyle.padding!*2,b.titleStyle.size!).length*b.titleStyle.size!*b.titleStyle.lineHeight!+b.titleStyle.padding!*2+b.lines.length*b.body.size!*b.body.lineHeight!+b.body.padding!*2+18,0)
    return {height,draw:(ctx,x,y)=>{for(const b of entries){const draw=(lines:string[],s:ElementStyle)=>{const h=lines.length*s.size!*s.lineHeight!+s.padding!*2;if(s.background){ctx.fillStyle=colorValue(s.background)!;ctx.fillRect(x,y,width,h)}ctx.font=font(s.size!,s.weight!>=600);ctx.fillStyle=colorValue(s.color!)!;ctx.textAlign=s.align??'left';lines.forEach((text,i)=>ctx.fillText(text,s.align==='center'?x+width/2:s.align==='right'?x+width-s.padding!:x+s.padding!,y+s.padding!+s.size!+i*s.size!*s.lineHeight!));ctx.textAlign='left';y+=h};draw(wrap(b.title,width-b.titleStyle.padding!*2,b.titleStyle.size!),b.titleStyle);draw(b.lines,b.body);y+=18}}}
  }
  const tables=r.tables??[],main=personal?tables:tables.filter(t=>t.kind==='classroom'),appendices=personal?[]:tables.filter(t=>t.kind!=='classroom')
  const naturalTableWidth=Math.max(1,...main.map(table=>columnWidths(table).reduce((a,b)=>a+b,0)))
  const sidebar=!personal&&o.notesPosition==='right'&&notes.length>0
  const width=personal?1000:Math.ceil(Math.max(540,Math.min(3200,naturalTableWidth+(sidebar?324:0)+margin*2)))
  const notesWidth=sidebar?300:width-margin*2,tableWidth=width-margin*2-(sidebar?notesWidth+gap:0)
  const sections=main.map(table=>{const titleStyle=resolveElement(r.template.customization,`${table.kind}.title`,{size:18,weight:600,color:r.template.color,padding:6,lineHeight:1.3});const titleLines=wrap(table.title,tableWidth-titleStyle.padding!*2,titleStyle.size!);return {table,paint:tablePaint(table,tableWidth),titleStyle,titleLines,titleHeight:titleLines.length*titleStyle.size!*titleStyle.lineHeight!+titleStyle.padding!*2}}),note=notesPaint(notesWidth)
  const tableHeight=sections.reduce((sum,s)=>sum+s.paint.height+(main.length>1||personal?s.titleHeight:0)+16,0)
  const meta=resolveElement(r.template.customization,'metadata',{size:16,weight:400,lineHeight:1.5,color:ink,padding:12})
  const metaRows=r.template.customization?.metadata??DEFAULT_METADATA
  const metaLines=classicMetadata(r).map((text,i)=>{const s=resolveElement(r.template.customization,`metadata.${metaRows[i].id}`,{...meta,padding:0});const lines=wrap(text,width-margin*2-s.padding!*2,s.size!);return {s,lines,height:lines.length*s.size!*s.lineHeight!+s.padding!*2}})
  const headerHeight=margin+metaLines.reduce((n,row)=>n+row.height,0)+meta.padding!,bodyHeight=sidebar?Math.max(tableHeight,note.height):tableHeight+(notes.length?note.height+12:0)
  const makeCanvas=(height:number)=>{if(height>30000)throw new Error('报告高度超过安全画布范围，请缩小发布范围或调整密度');const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.ceil(height);const ctx=canvas.getContext('2d');if(!ctx)throw new Error('无法生成报告');ctx.fillStyle=r.template.background;ctx.fillRect(0,0,width,height);return {canvas,ctx}}
  const {canvas,ctx}=makeCanvas(headerHeight+bodyHeight+margin)
  if(meta.background){ctx.fillStyle=colorValue(meta.background)!;ctx.fillRect(margin,margin,width-margin*2,headerHeight-margin-meta.padding!)}
  let metaY=margin
  metaLines.forEach(({s,lines,height})=>{if(s.background){ctx.fillStyle=colorValue(s.background)!;ctx.fillRect(margin,metaY,width-margin*2,height)}ctx.font=font(s.size!,s.weight!>=600);ctx.fillStyle=colorValue(s.color!)!;ctx.textAlign=s.align??'left';lines.forEach((text,i)=>ctx.fillText(text,s.align==='center'?width/2:s.align==='right'?width-margin-s.padding!:margin+s.padding!,metaY+s.padding!+s.size!+i*s.size!*s.lineHeight!));metaY+=height});ctx.textAlign='left'
  let y=headerHeight
  const notesFirst=personal&&r.template.preset==='P03'&&notes.length>0
  if(notesFirst){note.draw(ctx,margin,y);y+=note.height+12}
  for(const section of sections){if(main.length>1||personal){const s=section.titleStyle;if(s.background){ctx.fillStyle=colorValue(s.background)!;ctx.fillRect(margin,y,tableWidth,section.titleHeight)}ctx.font=font(s.size!,s.weight!>=600);ctx.fillStyle=colorValue(s.color!)!;ctx.textAlign=s.align??'left';section.titleLines.forEach((text,i)=>ctx.fillText(text,s.align==='center'?margin+tableWidth/2:s.align==='right'?margin+tableWidth-s.padding!:margin+s.padding!,y+s.padding!+s.size!+i*s.size!*s.lineHeight!));ctx.textAlign='left';y+=section.titleHeight}section.paint.draw(ctx,margin,y);y+=section.paint.height+16}
  if(notes.length&&!notesFirst)note.draw(ctx,sidebar?width-margin-notesWidth:margin,sidebar?headerHeight:y+12)
  const output=[canvas.toDataURL('image/png')]
  for(const table of appendices){const paint=tablePaint(table,width-margin*2),{canvas,ctx}=makeCanvas(paint.height+100);ctx.font=font(22,true);ctx.fillStyle=r.template.color;ctx.fillText(table.title,margin,38);paint.draw(ctx,margin,68);output.push(canvas.toDataURL('image/png'))}
  return output
}
