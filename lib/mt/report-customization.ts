export type ElementStyle = { color?: string; background?: string; cellBackground?: string; size?: number; weight?: number; align?: 'left'|'center'|'right'; padding?: number; width?: number; lineHeight?: number; borderColor?: string; borderWidth?: number; minHeight?: number }
export type CellFact = { parts?: {text:string;fact?:CellFact}[]; related?:CellFact[]; field: string; status?: string; revision?: string; grade?: string; score?: number; maximum?: number; key?: string }
export type FormatRule = { id: string; name: string; enabled: boolean; field: string; statuses?: string[]; submissionStatuses?: string[]; revision?: string; grades?: string[]; minimum?: number; maximum?: number; style: ElementStyle }
export type MetadataRow = { id:string; source:'period'|'scope'|'teacher'|'custom'; label:string; text?:string; visible?:boolean }
export const DEFAULT_METADATA:MetadataRow[]=[{id:'period',source:'period',label:'周次与日期'},{id:'scope',source:'scope',label:'教学班与教学分工'},{id:'teacher',source:'teacher',label:'教师姓名'}]
export type ReportCustomization = { elements?: Record<string,ElementStyle>; rules?: FormatRule[]; metadata?: MetadataRow[] }
export const FIELDS = {date:'日期',name:'姓名',attendance:'出勤',classroom:'课堂评价',submission:'作业提交',quality:'作业质量',score:'分数',assignment:'作业名称',deadline:'截止日期',lesson:'课次',time:'时间',location:'教室',feedback:'公开反馈',observation:'选入观察',source:'来源',fact:'已记录事实',suggestion:'教师建议'}
export function colorValue(value:string):string|undefined {
 if(/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value))return value.length===4?'#'+value.slice(1).split('').map(c=>c+c).join(''):value
 const m=value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
 if(m&&m.slice(1).every(n=>Number(n)<=255))return '#'+m.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join('')
}
export function validElement(s:ElementStyle):boolean {
 const ranges:Record<string,[number,number]>={size:[10,36],weight:[400,700],padding:[0,24],width:[30,600],lineHeight:[1,2],borderWidth:[0,4],minHeight:[0,240]}
 return Object.entries(s).every(([k,v])=>v===undefined?true:['color','background','cellBackground','borderColor'].includes(k)?typeof v==='string'&&!!colorValue(v):k==='align'?['left','center','right'].includes(String(v)):!!ranges[k]&&typeof v==='number'&&Number.isFinite(v)&&v>=ranges[k][0]&&v<=ranges[k][1])
}
export function validCustomization(c?:ReportCustomization):boolean {
 if(!c)return true
 return (!c.metadata||(c.metadata.length<=23&&new Set(c.metadata.map(r=>r.id)).size===c.metadata.length&&c.metadata.every(r=>typeof r.id==='string'&&(r.visible===undefined||typeof r.visible==='boolean')&&['period','scope','teacher','custom'].includes(r.source)&&typeof r.label==='string'&&r.label.length<=100&&(r.text===undefined||typeof r.text==='string'&&r.text.length<=500))))&&Object.values(c.elements??{}).every(validElement)&&(c.rules??[]).every(r=>typeof r.id==='string'&&typeof r.name==='string'&&typeof r.enabled==='boolean'&&typeof r.field==='string'&&validElement(r.style)&&(!r.statuses||r.statuses.every(s=>typeof s==='string'))&&(!r.submissionStatuses||r.submissionStatuses.every(s=>['ON_TIME','LATE','SUBMITTED','MISSING_CONFIRMED'].includes(s)))&&(!r.grades||r.grades.every(s=>typeof s==='string'))&&(!r.grades?.length||!!r.revision)&&[r.minimum,r.maximum].every(n=>n===undefined||Number.isFinite(n)))
}
export function ruleMatches(rule:FormatRule,fact?:CellFact):boolean {
 if(!fact||!rule.enabled||rule.field!==fact.field)return false
 if(rule.revision&&rule.revision!==fact.revision)return false
 if(rule.statuses?.length&&!rule.statuses.includes(fact.status??''))return false
 if(rule.submissionStatuses?.length&&![fact,...(fact.related??[])].some(f=>f.field==='submission'&&rule.submissionStatuses!.includes(f.status??'')))return false
 if(rule.grades?.length&&(!fact.grade||rule.revision!==fact.revision||!rule.grades.includes(fact.grade)))return false
 if(rule.minimum!==undefined&&(fact.score===undefined||fact.score<rule.minimum))return false
 if(rule.maximum!==undefined&&(fact.score===undefined||fact.score>rule.maximum))return false
 return !!(rule.statuses?.length||rule.submissionStatuses?.length||rule.grades?.length||rule.minimum!==undefined||rule.maximum!==undefined)
}
export function resolveElement(c:ReportCustomization|undefined,target:string,base:ElementStyle,fact?:CellFact):ElementStyle {
 const result={...base,...(target==='homework.assignment.body'?{size:10}:{}),...Object.fromEntries(Object.entries(c?.elements?.[target]??{}).filter(([,value])=>value!==undefined))}
 for(const rule of c?.rules??[])if([fact,...(fact?.related??[])].some(f=>ruleMatches(rule,f)))Object.assign(result,Object.fromEntries(Object.entries(rule.style).filter(([,value])=>value!==undefined)))
 return result
}
export function resolveCellBackground(c:ReportCustomization|undefined,target:string,fact?:CellFact):string|undefined {
 let background=c?.elements?.[target]?.cellBackground
 const facts=[fact,...(fact?.related??[]),...(fact?.parts??[]).map(p=>p.fact)].filter(Boolean) as CellFact[]
 for(const f of facts){const value=c?.elements?.[`${target.split('.')[0]}.${f.field}.body`]?.cellBackground;if(value)background=value}
 for(const rule of c?.rules??[])if(rule.style.cellBackground&&facts.some(f=>ruleMatches(rule,f)))background=rule.style.cellBackground
 return background
}
export const INITIAL_RULES:FormatRule[]=[
 {id:'attendance-absent',name:'请假、早退、缺勤提示',enabled:true,field:'attendance',statuses:['LEAVE','EARLY_LEAVE','ABSENT'],style:{color:'#B42318'}},
 {id:'attendance-late',name:'迟到提示',enabled:true,field:'attendance',statuses:['LATE'],style:{color:'#92400E'}},
 {id:'missing',name:'确认未交',enabled:true,field:'submission',statuses:['MISSING_CONFIRMED'],style:{color:'#B42318'}},
]
