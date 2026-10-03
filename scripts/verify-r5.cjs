const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const original = Module._resolveFilename
Module._resolveFilename = function(id, parent, ...rest) { return original.call(this, id.startsWith('@/') ? path.join(root, id.slice(2)) : id, parent, ...rest) }
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, file)
const {saveStylePatch, resolveStyle, styleKey, normalizeHex} = require('../lib/mt/styles.ts')
const {effectiveWithCalendar} = require('../lib/timetable/calendar-store.ts')
const teacher='T', p1={id:'P1',class_id:'C',course_id:'M'}, s1={...p1,id:'S1'}
let styles={}
const save=(level,id,patch)=>styles=saveStylePatch(styles,styleKey(teacher,level,id),patch)
const bg=t=>resolveStyle({styles},teacher,t).bg?.hex
save('TASK','P1',{bg:'#00f'}); save('TASK','S1',{bg:'#0f0'})
assert.equal(bg(p1),'#0000FF'); assert.equal(bg(s1),'#00FF00')
save('CLASS','C',{bg:'#f8f0dc'}); assert.equal(bg(p1),'#F8F0DC'); assert.equal(bg(s1),'#F8F0DC')
save('TASK','P1',{bg:'#aaf'}); save('CLASS','C',{color:'#345'})
assert.equal(bg(p1),'#AAAAFF'); assert.equal(bg(s1),'#F8F0DC')
assert.equal(resolveStyle({styles},teacher,p1).hex,'#334455')
save('CLASS','C',{bg:'#f8f0dc'}); assert.equal(bg(p1),'#F8F0DC')
save('CLASS','C',{weight:'bold'}); assert.equal(bg(s1),'#F8F0DC')
save('CLASS','C',{bg:undefined}); assert.equal(bg(p1),undefined); assert.equal(bg(s1),undefined)
assert.equal(resolveStyle({styles},teacher,p1).hex,'#334455')
save('COURSE','M',{color:'#456'}); assert.equal(resolveStyle({styles},teacher,s1).hex,'#445566')
assert.equal(resolveStyle({styles},'OTHER',s1).hex,null)
assert.equal(normalizeHex('#ab'),null)
const old=styles; save('CLASS','C',{color:'#invalid'}); assert.equal(resolveStyle({styles},teacher,s1).hex,resolveStyle({styles:old},teacher,s1).hex)
console.log('PASS attribute chain: task → class → task → class theme only → repeat class background → weight → reset → course; teacher isolation; HEX validation')
const source=[{key:'lesson1',teacherId:'T',taskId:'P1',weekday:4,date:'2026-10-01',periodId:'m3'},{key:'lesson2',teacherId:'T',taskId:'P1',weekday:4,date:'2026-10-01',periodId:'m5'}]
const events=[{id:'swap',kind:'swap',date:'2026-10-01',targetDate:'2026-10-10'}]
const past=effectiveWithCalendar(events,source,['2026-10-01'],[],()=>source)
assert.equal(past.effective.length,0)
const future=effectiveWithCalendar(events,[],['2026-10-10'],[],()=>source)
assert.equal(future.effective.length,2)
assert(future.effective.every(e=>e.date==='2026-10-10'&&e.makeupFrom==='2026-10-01'))
assert.equal(new Set(future.effective.map(e=>e.key)).size,2)
const holiday=effectiveWithCalendar([{id:'holiday',kind:'holiday',date:'2026-10-01'}],source,['2026-10-01'])
assert.equal(holiday.effective.length,0); assert(holiday.stopped.has('2026-10-01'))
assert.equal(effectiveWithCalendar([],source,['2026-10-01']).effective.length,2)
console.log('PASS isolated calendar: no cancellation, actual cancellation, cross-week weekend makeup retains source and appears once per original lesson')
const { regrade, generationOf } = require('../lib/mt/regrading.ts')
const { emptySchemeState, bindingKey, classroomRevFor, SYS_BASIC4, SYS_FINE8 } = require('../lib/mt/schemes.ts')
const { feedbackPeriodId } = require('../lib/mt/model.ts')
const tid='TASK_MATH_G1_P1', owner='TEACHER_LYNN', target={kind:'CLASSROOM',taskId:tid,week:5}
const record={key:'record',taskId:tid,date:'2026-09-28',grade:'A',gradeHandling:'CONFIRMED',gradeOrigin:'MANUAL',gradeCovered:['L1'],revision:1,fieldRev:{grade:1},att:{L1:'NORMAL'},reason:'保留',note:'保留备注'}
const state={schemes:emptySchemeState(),records:{record},revoked:[],publications:[],assignments:[],stamp:1,clock:'2026-10-03T10:00:00+08:00'}
state.schemes.bindings[bindingKey(tid,feedbackPeriodId(5))]=SYS_BASIC4.id
state.schemes.bindings[bindingKey(tid,feedbackPeriodId(6))]=SYS_BASIC4.id
state.schemes.taskOverrides={[tid+'|CLASSROOM']:[{fromWeek:7,revId:SYS_BASIC4.id,at:state.clock}]}
const adopted=regrade(state,owner,target,SYS_FINE8.id,0,'first')
assert(!adopted.error); assert.equal(adopted.records.record.grade,null)
assert.deepEqual(adopted.records.record.att,record.att); assert.equal(adopted.records.record.note,record.note)
assert.equal(adopted.schemes.classroomChoices[tid],SYS_FINE8.id)
for(const w of [5,6,7]) assert.equal(classroomRevFor(adopted.schemes,tid,owner,feedbackPeriodId(w),w).revId,SYS_FINE8.id)
assert(!('regradeHistory' in adopted))
assert.strictEqual(regrade(adopted,owner,target,SYS_FINE8.id,0,'first'),adopted)
assert(regrade(adopted,owner,target,SYS_BASIC4.id,0,'late').error)
const withNewGrade={...adopted,records:{record:{...adopted.records.record,grade:SYS_FINE8.levels[0].id}},schemes:{...adopted.schemes,classroomChoices:{[tid]:SYS_BASIC4.id}}}
const same=regrade(withNewGrade,owner,target,SYS_FINE8.id,1,'same')
assert.equal(same.records.record.grade,SYS_FINE8.levels[0].id)
assert.equal(generationOf(same,target),1)
const returned=regrade(adopted,owner,target,SYS_BASIC4.id,1,'return')
assert.equal(returned.records.record.grade,null)
console.log('PASS regrading: precise reset, persistent weeks 5/6/7, empty old binding and legacy plan ignored, idempotency, stale request rejection, same-period grade preservation, no old-grade resurrection')
console.log('Execution date:',new Date().toISOString())
