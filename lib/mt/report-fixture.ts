import { freshBiz, entryKey, obsKey } from './store'
import { taskWeek } from './derive'
import { TASKS, blankRec, buildStudentDay, type LessonView, type Assignment, type Attendance } from './model'
import { SYSTEM_TEMPLATES, type Preparation } from './reports'
import { prepareReports } from './report-build'

export function reportFixture(size:12|28|53|72|123=28) {
  const b=freshBiz('BASE');b.clock='2026-10-04T14:00:00+08:00'
  const task=TASKS.find(t=>t.id===`TASK_BIG_${size<=38?38:size<=72?72:123}`)!
  const tw=taskWeek(b,task,5);tw.students=tw.students.slice(0,size)
  const dates=['2026-09-28','2026-09-30','2026-10-02','2026-10-03','2026-10-04']
  const lessons:LessonView[]=dates.flatMap((date,di)=>[1,...(di===0?[3]:[])].map(n=>({id:`TEST_${size}_${date}_${n}`,task_id:task.id,actual_date:date,period_id:`TEST_PERIOD_${n}`,period:{id:`TEST_PERIOD_${n}`,number:n,start:n===1?'08:00':'10:00',end:n===1?'08:40':'10:40'},room:'合成教室',room_id:null,status:'ACTIVE',applied:true,is_non_teaching_activity:false,startTs:Date.parse(`${date}T${n===1?'08:00':'10:00'}:00+08:00`),endTs:Date.parse(`${date}T${n===1?'08:40':'10:40'}:00+08:00`)})))
  tw.days=tw.students.flatMap((id,i)=>dates.map((date,di)=>{
    const ls=lessons.filter(l=>l.actual_date===date),rec=blankRec(task.id,date,id)
    rec.grade='A';rec.gradeHandling='CONFIRMED';rec.gradeCovered=ls.map(l=>l.id)
    ls.forEach((l,j)=>{if(i===3&&j===1)return;const v:Attendance=i===1?'LEAVE':i===0&&j===1?'LEAVE':'NORMAL';rec.att[l.id]={v,reason:'PRIVATE_REASON_SENTINEL',origin:'MANUAL'}})
    rec.gradeCovered=ls.filter(l=>rec.att[l.id]?.v==='NORMAL').map(l=>l.id)
    b.records[rec.key]=rec
    return buildStudentDay({taskId:task.id,date,studentId:id,lessons:ls,nowTs:Date.parse(b.clock),rec,applicable:!(i===2&&di===0),leaves:[]})
  }))
  tw.byStudent=Object.fromEntries(tw.students.map(id=>[id,tw.days.filter(d=>d.studentId===id)]))
  const assignments:Assignment[]=Array.from({length:3},(_,ai)=>({id:`TEST_HW_${size}_${ai}`,taskId:task.id,title:['函数练习 A*／A+ 不互换','统计选择题（无课日截止）','综合练习'][ai],instructions:'完成原有练习要求。',issuedAt:'2026-09-28T12:00:00+08:00',deadline:'2026-10-01T18:00:00+08:00',recipients:[...tw.students],defaultRequirement:'REQUIRED',requirementOverrides:{[tw.students[4]]:'EXEMPT',[tw.students[5]]:'OPTIONAL'},schemeRevId:'SYS_BASIC4@1',results:Object.fromEntries(tw.students.map((id,i)=>[id,{submission:i%6===2?null:i%6===3?'MISSING':'SUBMITTED',submissionConfirmed:i%6===3,quality:i%6===0||i===1?'A':null,score:i===0?0:null,note:i===0?'第4题补充推导 x² + y² = z²；English feedback.':'',memo:'PRIVATE_MEMO_SENTINEL',reason:'PRIVATE_REASON_SENTINEL',...(i===5?{participating:false}:{}),...(i===6?{extDeadline:'2026-10-06T18:00:00+08:00'}:{})}])),revision:1,stamp:1}))
  tw.assignments=assignments;b.assignments=assignments
  b.summaries[entryKey(task.id,5)]={teaching:'本周复习函数与统计，保留每个实际教学日及各项作业。\n'+('长正文验证：中文、English、A*、A+、B-、0分和数学符号 x² + y²。\n').repeat(35),learning:'本段是班级整体学情，不是每个学生的个体结论。',text:'',stamp:1}
  const key=obsKey(lessons[0].id,tw.students[0]);b.observations[key]={key,lessonId:lessons[0].id,taskId:task.id,date:dates[0],periodNo:1,authorId:task.teacher_id,studentId:tw.students[0],text:'PRIVATE_OBSERVATION_SENTINEL',createdStamp:1,stamp:1}
  const prep:Preparation={taskIds:[task.id],personal:true,classReport:true,selected:[...tw.students],personalTemplate:'P02',classTemplate:'C02',stage:true,omitUnverified:false,account:false,link:false,observations:[{key,text:'教师主动选入：本节能清楚解释解题步骤。'}],focus:[{studentId:tw.students[0],taskId:task.id,source:dates[0],suggestion:'请继续保留推导过程。'}]}
  const reports=SYSTEM_TEMPLATES.flatMap(template=>prepareReports(b,[tw],{...prep,personal:template.kind==='personal',classReport:template.kind==='class',selected:tw.students.slice(0,1)},template.kind==='personal'?template:SYSTEM_TEMPLATES[0],template.kind==='class'?template:SYSTEM_TEMPLATES[3]).reports.filter(r=>r.audience==='parent').map(r=>({...r,key:`${template.id}-${r.key}`,name:r.kind==='class'?`合成${size}人教学班`:r.name})))
  return {b,tw,prep,reports}
}
