import type { TaskWeek } from './derive'
import type { MtBiz } from './store'
import { ATT_LABEL, requirementOf, studentById, weekDates, type Assignment, type StudentDay } from './model'
import { classroomRevFor, levelOf, parentText, revById } from './schemes'
import type { Preparation, ReportTable, ReportTemplate } from './reports'
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
    if(level&&scheme)return o.gradeText?parentText(scheme,level):level.code
    return r.note?.trim()||empty
  }
  const split=o.mode==='B'
  const homeworkLabel=(e:typeof events[number])=>`作业${assignments.filter(a=>homeworkCheckDate(a,p)===e.date).length>1?`\n${e.assignment?.title}`:''}`
  const top=[{text:'姓名',rowSpan:split?2:1},...events.map(e=>e.assignment?{text:split?classicDate(e.date):`${classicDate(e.date)} ${homeworkLabel(e).replace(/\n/g,' · ')}`}:{text:classicDate(e.date),span:split?2:1})]
  return {kind:'classroom',fields:['name',...events.flatMap(e=>e.assignment?['quality']:split?['attendance','classroom']:['attendance'])],facts:tw.students.map(id=>[undefined,...events.flatMap(e=>{if(e.assignment){const a=e.assignment,r=a.results[id],eligible=a.recipients.includes(id)&&!excluded.some(x=>x.assignmentId===a.id&&x.studentId===id)&&!!r&&!r.review&&requirementOf(a,id)!=='EXEMPT'&&r.participating!==false;return [{field:r?.submission==='MISSING'?'submission':'quality',status:eligible&&r?.submission==='MISSING'&&r.submissionConfirmed?'MISSING_CONFIRMED':undefined,revision:eligible?a.schemeRevId??undefined:undefined,grade:eligible&&r?.submission&&r.submission!=='MISSING'?r.quality??undefined:undefined}]}const d=tw.byStudent[id]?.find(d=>d.date===e.date),states=[...new Set(d?.elapsed.map(l=>d.rec.att[l.id]?.v).filter(Boolean))];const att={field:'attendance',status:states.length===1?states[0]:undefined};return split?[att,{field:'classroom',revision:rev?.id,grade:d?.elig.kind==='ELIGIBLE'&&d.handlingEff==='CONFIRMED'&&d.elapsed.length?d.gradeEff??undefined:undefined}]:[att]})]),title:tw.task.label,identityColumns:1,headers:split?[top,events.flatMap(e=>e.assignment?[{text:homeworkLabel(e)}]:[{text:'出勤'},{text:'课堂'}])]:[top],rows:tw.students.map(id=>[studentById(id)?.name??id,...events.flatMap(e=>{if(e.assignment)return [homework(e.assignment,id)];const day=tw.byStudent[id]?.find(d=>d.date===e.date);return split?[attendance(day),grade(day)]:[`${attendance(day)} / ${grade(day)}`]})])}
}
