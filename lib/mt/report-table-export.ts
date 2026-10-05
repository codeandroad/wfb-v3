import { visibleBlocks, type FrozenReport, type ReportTable } from './reports'
import { reportOptions } from './report-options'

export function tableSegments(table:ReportTable, maxGroups:number):ReportTable[] {
  if(!table.identityColumns || !table.groupSize) return [table]
  const identity=table.identityColumns, size=table.groupSize
  const top=table.headers[0], grouped=top.slice(identity).filter(c=>size===1 ? /^周[一二三四五六日]/.test(c.text) : c.span===size)
  if(grouped.length<=maxGroups) return [table]
  const tail=top.slice(identity+grouped.length)
  return Array.from({length:Math.ceil(grouped.length/maxGroups)},(_,page)=>{
    const start=page*maxGroups, groups=grouped.slice(start,start+maxGroups), indices=[...Array.from({length:identity},(_,i)=>i),...Array.from({length:groups.length*size},(_,i)=>identity+start*size+i),...Array.from({length:tail.length},(_,i)=>identity+grouped.length*size+i)]
    return {...table,title:`${table.title} · 组 ${start+1}—${start+groups.length}`,headers:[[...top.slice(0,identity),...groups,...tail],...(table.headers.length>1?[table.headers[1].slice(start*size,(start+groups.length)*size)]:[])],rows:table.rows.map(row=>indices.map(i=>row[i]??''))}
  })
}

export function renderTableImages(report:FrozenReport,version:string, scale = 1):string[] {
  const t=report.template,o=reportOptions(t), width=o.orientation==='portrait'?1000:1440, margin=36, available=width-margin*2
  const family=t.font==='serif'?'Georgia, "Noto Report", serif':'"Noto Report", sans-serif'
  const measure=document.createElement('canvas').getContext('2d');if(!measure)throw new Error('无法创建图片画布')
  const font=(size:number,bold=false)=>`${bold?'600 ':''}${size}px ${family}`
  const wrap=(text:string,w:number,size:number,bold=false)=>{
    measure.font=font(size,bold);const lines:string[]=[]
    for(const paragraph of text.split('\n')){let line='';for(const char of paragraph){if(measure.measureText(line+char).width>w&&line){lines.push(line);line=''}line+=char}lines.push(line)}return lines
  }
  type Paint=(ctx:CanvasRenderingContext2D,y:number)=>void
  type Part={height:number;paint:Paint}
  type Page={title:string;parts:Part[]}
  const pages:Page[]=[], limit=o.output==='long'?6000:1800
  const textPart=(text:string,size=o.bodySize,bold=false,color='#263a33'):Part=>{const lines=wrap(text,available,size,bold),step=size*o.lineHeight;return{height:lines.length*step+12,paint:(ctx,y)=>{ctx.font=font(size,bold);ctx.fillStyle=color;ctx.textAlign=o.align;lines.forEach((line,i)=>ctx.fillText(line,o.align==='center'?width/2:margin,y+size+i*step));ctx.textAlign='left'}}}
  const textPages=(title:string,texts:string[])=>{
    let parts:Part[]=[],used=0
    for(const text of texts){
      type Run={text:string;bold:boolean;width:number}
      const lines:Run[][]=[]
      for(const paragraph of text.split('\n')){let row:Run[]=[],usedWidth=0,strong=false;const input=paragraph.replace(/^[-*] /,'• ')
        for(let i=0;i<input.length;){if(input.slice(i,i+2)==='**'){strong=!strong;i+=2;continue}const char=String.fromCodePoint(input.codePointAt(i)!);i+=char.length;measure.font=font(o.bodySize,strong);const w=measure.measureText(char).width;if(usedWidth+w>available&&row.length){lines.push(row);row=[];usedWidth=0}row.push({text:char,bold:strong,width:w});usedWidth+=w}lines.push(row)
      }
      const maxLines=Math.floor((limit-30)/(o.bodySize*o.lineHeight))
      for(let i=0;i<lines.length;i+=maxLines){const chunk=lines.slice(i,i+maxLines);const part:Part={height:chunk.length*o.bodySize*o.lineHeight+12,paint:(ctx,y)=>chunk.forEach((runs,j)=>{let x=o.align==='center'?margin+(available-runs.reduce((n,r)=>n+r.width,0))/2:margin;for(const run of runs){ctx.font=font(o.bodySize,run.bold);ctx.fillStyle=run.bold?o.emphasis:'#263a33';ctx.fillText(run.text,x,y+o.bodySize+j*o.bodySize*o.lineHeight);x+=run.width}})};if(used+part.height>limit&&parts.length){pages.push({title,parts});parts=[];used=0}parts.push(part);used+=part.height}
    }
    if(parts.length)pages.push({title,parts})
  }
  if(t.opening.trim()) textPages('导语',[t.opening])
  const blocks=visibleBlocks(report)
  const tables=report.tables??[]
  const seen=new Set<string>()
  const drawTable=(table:ReportTable)=>{
    for(const segment of tableSegments(table,o.orientation==='portrait'?Math.min(o.groupsPerPage,3):o.groupsPerPage)){
      const columns=segment.rows[0]?.length??segment.headers[0].reduce((n,c)=>n+(c.span??1),0)
      if(!columns)continue
      const cell=available/columns,size=o.tableSize,line=size*o.lineHeight,pad=o.density==='compact'?Math.min(o.padding,6):o.padding
      const headerHeights=segment.headers.map(row=>Math.max(1,...row.map(c=>wrap(c.text,(c.span??1)*cell-pad*2,size,t.bold).length))*line+pad*2)
      const headerHeight=headerHeights.reduce((a,b)=>a+b,0)
      const heading:Part={height:headerHeight,paint:(ctx,y)=>{
        let top=y
        segment.headers.forEach((row,ri)=>{let col=ri===1?(segment.identityColumns??0):0
          row.forEach(c=>{const span=c.span??1,w=span*cell,h=c.rowSpan===2?headerHeight:headerHeights[ri],x=margin+col*cell
            ctx.fillStyle=o.headerBackground;ctx.fillRect(x,top,w,h);if(o.borders){ctx.strokeStyle=o.borderColor;ctx.strokeRect(x,top,w,h)}ctx.fillStyle=o.headerText;ctx.font=font(size,t.bold)
            const lines=wrap(c.text,w-pad*2,size,t.bold);lines.forEach((v,i)=>ctx.fillText(v,x+pad,top+pad+size+i*line));col+=span
          });top+=headerHeights[ri]
        })
      }}
      let parts:Part[]=[heading],used=headerHeight,count=0
      const flush=()=>{pages.push({title:segment.title,parts});parts=[heading];used=headerHeight;count=0}
      if(!segment.rows.length){parts.push(textPart(table.kind==='homework'?'本周无适用作业':'本周无适用记录'));flush();continue}
      segment.rows.forEach((row,index)=>{
        const cells=row.map(text=>wrap(text,cell-pad*2,size)),lines=Math.max(1,...cells.map(x=>x.length))
        const maxLines=Math.max(1,Math.floor((limit-headerHeight-pad*2)/line))
        for(let start=0;start<lines;start+=maxLines){const length=Math.min(maxLines,lines-start),h=length*line+pad*2
          if((used+h>limit||count>=o.rowsPerPage)&&parts.length>1)flush()
          const chunks=cells.map((c,i)=>start&&i<(segment.identityColumns??0)?c:c.slice(start,start+length))
          parts.push({height:h,paint:(ctx,y)=>{chunks.forEach((values,col)=>{const x=margin+col*cell
            if(o.striped&&index%2){ctx.fillStyle=o.stripeColor;ctx.fillRect(x,y,cell,h)}if(o.borders){ctx.strokeStyle=o.borderColor;ctx.strokeRect(x,y,cell,h)}ctx.font=font(size);ctx.fillStyle='#263a33';ctx.textAlign=o.align;values.forEach((v,i)=>ctx.fillText(v,o.align==='center'?x+cell/2:x+pad,y+pad+size+i*line));ctx.textAlign='left'
          })}});used+=h;count++
        }
      })
      if(parts.length>1)flush()
    }
  }
  if((t.preset??t.id)==='P03')for(const table of tables.filter(x=>x.kind==='focus'))drawTable(table)
  for(const key of t.modules){
    for(const block of blocks.filter(b=>b.key===key))textPages(block.title,block.lines)
    if(key==='classroom'||key==='homework'){for(const table of tables.filter(x=>key==='classroom'?x.kind==='classroom'||x.kind==='lessons':x.kind==='homework')){drawTable(table);seen.add(table.title)}}
  }
  // Core facts cannot disappear when a legacy template hides its former text module.
  for(const table of tables.filter(x=>x.kind!=='focus'&&!seen.has(x.title)))drawTable(table)
  if(t.closing.trim())textPages('结语',[t.closing])
  if(!pages.length)throw new Error('报告没有可输出内容')
  const canvases = pages.map((page,index)=>{
    const title=o.title||`${report.kind==='personal'?'个人周反馈':'班级周反馈'} · ${report.name}`
    const heading=wrap(title,available,o.titleSize,true),context=wrap(`${o.school?`${o.school} · `:''}${report.scope}\n${report.period}${report.stage?' · 阶段反馈':''}\n${page.title}`,available,o.bodySize)
    const top=margin+heading.length*o.titleSize*1.5+context.length*o.bodySize*1.5+24
    const bottom=wrap(`${version} · ${o.output==='long'?'内容段 ':''}${index+1}/${pages.length}\n责任教师：${o.signature||report.teacher} · 截止 ${report.cutoff.slice(0,16).replace('T',' ')}`,available,14)
    const height=Math.ceil(top+page.parts.reduce((n,p)=>n+p.height,0)+bottom.length*22+margin*2)
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale)
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('无法创建图片')
    ctx.scale(scale,scale)
    ctx.fillStyle=t.background;ctx.fillRect(0,0,width,height);ctx.fillStyle=t.color;ctx.fillRect(margin,margin-12,48,4);ctx.font=font(o.titleSize,true)
    heading.forEach((v,i)=>ctx.fillText(v,margin,margin+o.titleSize+i*o.titleSize*1.5))
    ctx.fillStyle='#263a33';ctx.font=font(o.bodySize);context.forEach((v,i)=>ctx.fillText(v,margin,margin+heading.length*o.titleSize*1.5+o.bodySize+i*o.bodySize*1.5))
    let y=top;for(const part of page.parts){part.paint(ctx,y);y+=part.height}
    ctx.fillStyle=o.emphasis;ctx.font=font(14);bottom.forEach((v,i)=>ctx.fillText(v,margin,y+margin+14+i*22))
    return canvas
  })
  const output:HTMLCanvasElement[]=[]
  if(o.output==='long') {
    let group:HTMLCanvasElement[]=[],height=0
    const flush=()=>{if(!group.length)return;const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);const ctx=canvas.getContext('2d');if(!ctx)throw new Error('无法拼接长图');let y=0;for(const page of group){ctx.drawImage(page,0,y);y+=page.height}output.push(canvas);group=[];height=0}
    for(const page of canvases){if(height+page.height>14000)flush();group.push(page);height+=page.height}flush()
  }else output.push(...canvases)
  return output.map(canvas=>{const data=canvas.toDataURL('image/png');if(!data.startsWith('data:image/png;base64,')||data.length<1000)throw new Error('PNG生成失败');return data})
}
