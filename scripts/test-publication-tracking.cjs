const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const assert = require('node:assert/strict')
const resolve = Module._resolveFilename
Module._resolveFilename = function(name,parent,...rest) { return resolve.call(this,name.startsWith('@/')?path.join(process.cwd(),name.slice(2)):name,parent,...rest) }
for(const ext of ['.ts','.tsx']) require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,resolveJsonModule:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,f)
const { TASKS, feedbackPeriodId, homeroomName, HOMEROOMS } = require('../lib/mt/model.ts')
const { weeklyPublicationTasks, createPublicationCheck, teacherSemester, homeroomPublications, roomStudents } = require('../lib/mt/publication-tracking.ts')
const b = {clock:'2026-10-04T18:00:00+08:00',seq:1,stamp:1,publications:[]}
const rows = weeklyPublicationTasks(b,5)
assert.ok(rows.length)
assert.equal(new Set(rows.map(r=>r.key)).size, rows.length)
assert.ok(rows.every(r=>r.status==='待发布'))
const check = createPublicationCheck(b,5,'测试教务','已提醒')
b.publicationChecks = [check]
const task=TASKS.find(t=>t.id===rows[0].taskId)
const p={id:'test-pub',taskIds:[task.id],periodId:feedbackPeriodId(5),week:5,revision:1,publishedAt:'2026-10-04T17:00:00+08:00',students:[{studentId:'a',homeroomId:HOMEROOMS[0].id},{studentId:'b',homeroomId:HOMEROOMS[1].id}]}
b.publications.push(p)
assert.equal(weeklyPublicationTasks(b,5).find(r=>r.taskId===task.id).status,'已发布')
assert.equal(check.entries.find(e=>e.taskId===task.id).publicationId,null)
assert.equal(teacherSemester(b).find(r=>r.teacherId===task.teacher_id).missed, check.entries.filter(e=>e.teacherId===task.teacher_id).length)
assert.equal(homeroomPublications(b,homeroomName(HOMEROOMS[0].id)).length,1)
assert.equal(homeroomPublications(b,homeroomName(HOMEROOMS[1].id)).length,1)
assert.equal(homeroomPublications(b,'不存在的主班').length,0)
assert.deepEqual(roomStudents(p,homeroomName(HOMEROOMS[0].id)).map(s=>s.studentId),['a'])
b.clock='2026-10-06T18:00:00+08:00'
assert.ok(weeklyPublicationTasks(b,5).some(r=>r.status==='逾期待发布'))
b.publications.push({...p,id:'revision',revision:2,publishedAt:'2026-10-06T17:00:00+08:00'})
assert.equal(weeklyPublicationTasks(b,5).find(r=>r.taskId===task.id).status,'已发布','按时发布后的修订不算逾期补发')
assert.equal(homeroomPublications(b,homeroomName(HOMEROOMS[0].id))[0].id,'revision')
b.publications[1].withdrawn=true
assert.equal(weeklyPublicationTasks(b,5).find(r=>r.taskId===task.id).status,'逾期待发布')
assert.equal(homeroomPublications(b,homeroomName(HOMEROOMS[0].id)).length,0,'撤回不能使旧版重新可见')
b.publications=[{...p,publishedAt:'2026-10-06T17:00:00+08:00'}]
assert.equal(weeklyPublicationTasks(b,5).find(r=>r.taskId===task.id).status,'补发完成')
assert.equal(check.entries.find(e=>e.taskId===task.id).publicationId,null,'补发不覆盖检查历史')
b.publicationChecks.push({...check,id:'repeat'})
assert.equal(teacherSemester(b).find(r=>r.teacherId===task.teacher_id).missed,check.entries.filter(e=>e.teacherId===task.teacher_id).length,'重复检查按任务去重')
console.log('PASS weekly generation, live publication, immutable checks, semester rollup, late publication, revision, withdrawal, cross-homeroom visibility and student scoping')
