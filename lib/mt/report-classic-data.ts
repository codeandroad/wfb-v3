import type { TaskWeek } from './derive'
import type { MtBiz } from './store'
import { ATT_LABEL, requirementOf, studentById, weekDates, type Assignment, type StudentDay } from './model'
import { classroomRevFor, levelOf, parentText, revById } from './schemes'
import type { Preparation, ReportTable, ReportTemplate } from './reports'
import type { CellFact } from './report-customization'
import { reportOptions } from './report-options'

export const classicDate = (date:string) => `${['周日','周一','周二','周三','周四','周五','周六'][new Date(`${date}T12:00:00+08:00`).getUTCDay()]} ${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`
export function hasHomeworkRecord(a:Assignment) {
  return a.recipients.some(id=>{const r=a.results[id];return !!r && (!!r.submission || !!r.quality || r.score!=null || !!r.note?.trim() || !!r.noGrade)})
}
export function homeworkCheckDate(a:Assignment,p?:Preparation) { return (p?.homeworkDates?.[a.id] || a.deadline || '').slice(0,10) }
export function classicMatrix(b:MtBiz,tw:TaskWeek,t:ReportTemplate,p?:Preparation,excluded:{assignmentId:string;studentId:string}[]=[]):ReportTable {
  const o=reportOptions(t),empty=o.emptyValue==='blank'?'':'–',now=Date.parse(b.clock)
  const rev=revById(classroomRevFor(b.schemes,tw.task.id,tw.task.teacher_id,tw.periodId,tw.week).revId)
  const dates=[...new Set(tw.days.map(d=>d.date))].sort()
  const assignments=b.assignments.filter(a=>a.taskId===tw.task.id&&a.status!=='WITHDRAWN'&&hasHomeworkRecord(a)&&homeworkCheckDate(a,p)>=weekDates(tw.week)[0]&&homeworkCheckDate(a,p)<=weekDates(tw.week)[6]&&Date.parse(`${homeworkCheckDate(a,p)}T00:00:00+08:00`)<=now)
  const events=[...dates.map(date=>({date,assignment:null as Assignment|null})),...assignments.map(assignment=>({date:homeworkCheckDate(assignment,p),assignment}))].sort((a,b)=>a.date.localeCompare(b.date)||Number(!!a.assignment)-Number(!!b.assignment)||((a.assignment?.id??'').localeCompare(b.assignment?.id??'')))
  const attendance=(d:StudentDay|undefined)=>{
    if(!d||d.state==='NOT_APPLICABLE')return empty
    const values=[...new Set(d.elapsed.map(l=>d.rec.att[l.id]?.v?ATT_LABEL[d.rec.att[l.id].v]:empty))]
    return values.length?values.join('/') : empty
  }
  const grade=(d:StudentDay|undefined)=>{
    if(!d||d.elig.kind!=='ELIGIBLE'||d.handlingEff!=='CONFIRMED'||!d.gradeEff||!d.elapsed.length)return empty
    const level=levelOf(rev,d.gradeEff);return level&&rev?(o.gradeText?parentText(rev,level):level.code):empty
  }
  const homework=(a:Assignment,id:string)=>{
    const r=a.results[id]
    if(!a.recipients.includes(id)||excluded.some(x=>x.assignmentId===a.id&&x.studentId===id)||!r||r.review||requirementOf(a,id)==='EXEMPT'||r.participating===false)return empty
    if(r.submission==='MISSING')return r.submissionConfirmed?'未交':empty
    if(!r.submission)return empty
    const scheme=revById(a.schemeRevId),level=levelOf(scheme,r.quality)
    if(level&&scheme)return `${r.submission==='LATE'?'迟交':''}${o.gradeText?parentText(scheme,level):level.code}`
    if(r.submission==='LATE')return `迟交${r.note?.trim()||''}`
    return r.note?.trim()||empty
  }
  const split=o.mode==='B'
  const homeworkLabel=(e:typeof events[number])=>`作业${o.showHomeworkName?`\n${e.assignment?.title}`:''}`
  const top=[{text:'姓名',field:'name',rowSpan:split?2:1},...events.map(e=>e.assignment?{text:split?classicDate(e.date):`${classicDate(e.date)} ${homeworkLabel(e).replace(/\n/g,' · ')}`,field:split?'date':'assignment',assignmentName:!split&&o.showHomeworkName?e.assignment.title:undefined}:{text:classicDate(e.date),field:'date',span:split?2:1})]
  const table:ReportTable = {kind:'classroom',columnKinds:['classroom',...events.flatMap(e=>e.assignment?['homework' as const]:split?['classroom' as const,'classroom' as const]:['classroom' as const])],fields:['name',...events.flatMap(e=>e.assignment?['quality']:split?['attendance','classroom']:['attendance'])],facts:tw.students.map(id=>[undefined,...events.flatMap(e=>{if(e.assignment){const a=e.assignment,r=a.results[id],eligible=a.recipients.includes(id)&&!excluded.some(x=>x.assignmentId===a.id&&x.studentId===id)&&!!r&&!r.review&&requirementOf(a,id)!=='EXEMPT'&&r.participating!==false;return [{field:r?.submission==='MISSING'?'submission':'quality',status:eligible&&r?.submission==='MISSING'&&r.submissionConfirmed?'MISSING_CONFIRMED':undefined,revision:eligible?a.schemeRevId??undefined:undefined,grade:eligible&&r?.submission&&r.submission!=='MISSING'?r.quality??undefined:undefined}]}const d=tw.byStudent[id]?.find(d=>d.date===e.date),states=[...new Set(d?.elapsed.map(l=>d.rec.att[l.id]?.v).filter(Boolean))];const att={field:'attendance',status:states.length===1?states[0]:undefined};return split?[att,{field:'classroom',revision:rev?.id,grade:d?.elig.kind==='ELIGIBLE'&&d.handlingEff==='CONFIRMED'&&d.elapsed.length?d.gradeEff??undefined:undefined}]:[att]})]),title:tw.task.label,identityColumns:1,headers:split?[top,events.flatMap(e=>e.assignment?[{text:homeworkLabel(e),field:'assignment',assignmentName:o.showHomeworkName?e.assignment.title:undefined}]:[{text:'出勤'},{text:'课堂'}])]:[top],rows:tw.students.map(id=>[studentById(id)?.name??id,...events.flatMap(e=>{if(e.assignment)return [homework(e.assignment,id)];const day=tw.byStudent[id]?.find(d=>d.date===e.date);return split?[attendance(day),grade(day)]:[`${attendance(day)} / ${grade(day)}`]})])}
  tw.students.forEach((id,row)=>{let col=1;events.forEach(e=>{if(e.assignment){const fact=table.facts?.[row]?.[col];const result=e.assignment.results[id];if(fact&&result?.submission&&result.submission!=='MISSING'&&fact.revision){fact.related=[{field:'submission',status:result.submission}];const text=table.rows[row][col];if(result.submission==='LATE'&&text.startsWith('迟交'))fact.parts=[{text:'迟交',fact:{field:'submission',status:'LATE'}},{text:text.slice(2),fact:{field:'quality',revision:fact.revision,grade:fact.grade,related:fact.related}}]};col++;return}const day=tw.byStudent[id]?.find(d=>d.date===e.date);const states=day&&day.state!=='NOT_APPLICABLE'?[...new Set(day.elapsed.map(l=>day.rec.att[l.id]?.v))]:[];const parts:NonNullable<CellFact['parts']>=states.length?states.flatMap((status,i)=>[...(i?[{text:'/'}]:[]),{text:status?ATT_LABEL[status]:empty,fact:{field:'attendance',status}}]):[{text:empty}];if(!split)parts.push({text:' / '},{text:grade(day),fact:{field:'classroom',revision:rev?.id,grade:day?.elig.kind==='ELIGIBLE'&&day.handlingEff==='CONFIRMED'&&day.elapsed.length?day.gradeEff??undefined:undefined}} as typeof parts[number]);const fact=table.facts?.[row]?.[col];if(fact)fact.parts=parts;col+=split?2:1})})
  return table
}
