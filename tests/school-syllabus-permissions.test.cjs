const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..'), resolve = Module._resolveFilename
Module._resolveFilename = function(request, ...args) { return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, ...args) }
for (const ext of ['.ts','.tsx']) require.extensions[ext] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)
require.extensions['.css'] = () => {}
const { STAFF } = require('../lib/demo/staff.ts')
const duties = require('../lib/school/duty-model.ts')
const permissions = require('../lib/school/course-material.ts')
const { catalogSeed } = require('../lib/school/catalog-store.ts')
const model = require('../lib/research/model.ts')
const { researchSeed } = require('../lib/research/seed.ts')
const { applyResearchCommand } = require('../lib/research/commands.ts')
const actor = (staff='u-lin', date='2026-10-22') => ({ staff, date, enabled: true })
const livePeople = state => STAFF.map(person => ({ ...structuredClone(person), duties: [...person.duties.filter(d => d.type !== 'course_material'), ...state.assignments.filter(d => d.type === 'course_material' && d.staffId === person.id)] }))
const withRights = (who, people=STAFF, catalog=catalogSeed) => ({ ...who, schoolSyllabusCourses: permissions.schoolSyllabusCourses(people, who, catalog) })
const grant = (id='grant-chen-C101', course='C101') => permissions.createCourseMaterialDuty(id, 'u-chen', [course], '2026-10-22', '2026-11-30', catalogSeed)
function schoolDocument(id='school-test') { const d = model.emptyDocument(id, '大纲', '学校数学大纲', model.SCHOOL_DOCUMENT_OWNER, 'u-lin', 'C101', 40); d.share={audience:'school',groups:[],staff:[]}; return d }

test('explicit course codes allow maintenance; only standard teaching managers can delegate their two courses', () => {
  assert.deepEqual(permissions.schoolSyllabusCourses(STAFF, actor(), catalogSeed), ['C101'])
  assert.deepEqual(permissions.manageableMaterialCourses(STAFF, actor(), catalogSeed), [])
  for (const id of ['u-xu','u-lu']) {
    assert.deepEqual(permissions.schoolSyllabusCourses(STAFF, actor(id), catalogSeed), ['C101','C201'])
    assert.deepEqual(permissions.manageableMaterialCourses(STAFF, actor(id), catalogSeed), ['C101','C201'])
  }
  assert(permissions.manageableMaterialCourses(STAFF, actor('u-zhao'), catalogSeed).includes('C102'))
  assert.deepEqual(permissions.schoolSyllabusCourses(STAFF, actor('u-zhao'), catalogSeed), [])
})

test('labels, research leadership and management, system roles and stale actor rights never imply course rights', () => {
  const people = STAFF.map(p => p.id === 'u-lin' ? { ...p, duties:p.duties.map(d => d.type === 'course_material' ? { ...d, scopeRefs:undefined } : d) } : p)
  assert.deepEqual(permissions.schoolSyllabusCourses(people, {...actor(),schoolSyllabusCourses:['C101']},catalogSeed), [])
  assert.deepEqual(permissions.manageableMaterialCourses(people,actor(),catalogSeed), [])
  const state=researchSeed(40), d=schoolDocument()
  assert(model.canLeadGroup(state, actor(), 'math'))
  assert.equal(model.canEditDocument(state, actor(),d),false)
})

test('future, ended, paused and readonly grants, invalid dates, absent accounts and leave/left persons fail closed', () => {
  for (const patch of [{ start:'2026-12-01' },{ end:'2026-10-21' },{ status:'paused' },{ status:'ended' },{ workMode:'ro' },{ workMode:'paused' },{ start:'2026-02-30' }]) {
    const people=STAFF.map(p=>p.id==='u-lin'?{...p,duties:p.duties.map(d=>d.type==='course_material'?{...d,...patch}:d)}:p)
    assert.deepEqual(permissions.schoolSyllabusCourses(people,actor(),catalogSeed),[],JSON.stringify(patch))
  }
  for(const patch of [{status:'leave'},{status:'left'},{accountStatus:'disabled'},{accountStatus:'none'}]) {
    const people=STAFF.map(p=>p.id==='u-lin'?{...p,...patch}:p)
    assert.deepEqual(permissions.schoolSyllabusCourses(people,actor(),catalogSeed),[])
  }
  assert.deepEqual(permissions.schoolSyllabusCourses(STAFF,{...actor(),enabled:false},catalogSeed),[])
  const catalog=structuredClone(catalogSeed);catalog.settings.C101.active=false
  assert.deepEqual(permissions.schoolSyllabusCourses(STAFF,actor(),catalog),[])
})

test('school draft/create/revise/archive preserve owner, course, old versions and school visibility', () => {
  const me=withRights(actor()), doc=schoolDocument(); let state=researchSeed(40)
  state=applyResearchCommand(state,me,{type:'create-document',document:doc},catalogSeed)
  const original=structuredClone(state.documents.find(d=>d.id===doc.id)), revision=structuredClone(state.revisions[`${doc.id}@1`])
  const edited={...structuredClone(doc),title:'第二版',archived:true}
  state=applyResearchCommand(state,me,{type:'draft-document',document:edited,baseVersion:1},catalogSeed)
  state=applyResearchCommand(state,me,{type:'save-document',document:edited,baseVersion:1},catalogSeed)
  assert.deepEqual(state.revisions[`${doc.id}@1`], revision)
  const saved=state.documents.find(d=>d.id===doc.id)
  assert.equal(saved.version,2);assert.equal(saved.archived,true);assert.equal(saved.owner,original.owner);assert.equal(saved.course,original.course)
  assert.deepEqual(saved.share,original.share)
  assert.throws(()=>applyResearchCommand(state,me,{type:'save-document',document:edited,baseVersion:1},catalogSeed),/新修订/)
})

test('school maintenance does not authorize other resource kinds or courses; sharing/kind changes are rejected even in drafts', () => {
  const state=researchSeed(40), me=withRights(actor()), doc=schoolDocument()
  for(const patch of [{kind:'资源'},{kind:'计划'},{course:'C201'}]) assert.throws(()=>applyResearchCommand(state,me,{type:'create-document',document:{...doc,...patch}},catalogSeed))
  const created=applyResearchCommand(state,me,{type:'create-document',document:doc},catalogSeed)
  for(const type of ['draft-document','save-document']) for(const patch of [{kind:'资源'},{share:{audience:'owner',groups:[],staff:[]}},{owner:'math'},{course:'C201'}]) assert.throws(()=>applyResearchCommand(created,me,{type,document:{...doc,...patch},baseVersion:1},catalogSeed))
  assert.equal(model.canEditDocument(created,me,{...doc,kind:'资源'}),false)
  assert.equal(model.canEditDocument(created,withRights(actor('u-chen')),doc),false)
  const inactive=structuredClone(catalogSeed);inactive.settings.C101.active=false
  assert.throws(()=>applyResearchCommand(created,me,{type:'save-document',document:doc,baseVersion:1},inactive))
})

test('readonly group leaders can view but cannot edit public documents; personal document rules stay intact', () => {
  const state=researchSeed(40);state.staffDuties=state.staffDuties.map(d=>d.id==='app-lin-math'?{...d,workMode:'ro'}:d)
  assert(model.canLeadGroup(state,actor(),'math'))
  assert.equal(model.canEditGroup(state,actor(),'math'),false)
  const own=model.emptyDocument('own','大纲','个人', 'u-lin','u-lin','C101',40)
  assert(model.canEditDocument(state,actor(),own))
})

test('course delegation is scoped, non-transitive, checks latest shared records, and rejects duplicate or altered scopes', () => {
  const state=duties.staffDutySeed(), people=livePeople(state), item=grant()
  assert.throws(()=>duties.applyStaffDutyCommand(state,actor(),{type:'arrange',assignments:[item]},people,catalogSeed),/安排权/)
  assert.throws(()=>duties.applyStaffDutyCommand(state,actor('u-xu'),{type:'arrange',assignments:[grant('other','C102')]},people,catalogSeed),/安排权/)
  assert.throws(()=>duties.applyStaffDutyCommand(state,actor('u-xu'),{type:'arrange',assignments:[{...item,canDelegateMaterials:true}]},people,catalogSeed),/扩大/)
  const next=duties.applyStaffDutyCommand(state,actor('u-xu'),{type:'arrange',assignments:[item]},people,catalogSeed)
  assert.deepEqual(permissions.schoolSyllabusCourses(livePeople(next),actor('u-chen'),catalogSeed),['C101'])
  assert.deepEqual(permissions.manageableMaterialCourses(livePeople(next),actor('u-chen'),catalogSeed),[])
  assert.throws(()=>duties.applyStaffDutyCommand(next,actor('u-xu'),{type:'arrange',assignments:[{...item,id:'duplicate'}]},people,catalogSeed),/重叠/)
  const stale={...state,assignments:state.assignments.map(d=>d.id==='d-xu-1'?{...d,end:'2026-10-21'}:d)}
  assert.throws(()=>duties.applyStaffDutyCommand(stale,actor('u-xu'),{type:'arrange',assignments:[item]},people,catalogSeed),/安排权/)
  assert.throws(()=>duties.applyStaffDutyCommand(next,actor('u-xu'),{type:'revise',assignment:{...item,scopeRefs:[{kind:'course',id:'C201'}]},expected:next.assignments.find(d=>d.id===item.id)},livePeople(next),catalogSeed),/不能更换/)
})

test('end/revise retain existing delegation metadata and history; ending is inclusive and does not remove other duties', () => {
  const state=duties.staffDutySeed(), old=state.assignments.find(d=>d.id==='d-lin-3')
  const next=duties.applyStaffDutyCommand(state,actor('u-xu'),{type:'end',assignment:{...old,end:'2026-10-22'},expected:old},livePeople(state),catalogSeed)
  assert.deepEqual(permissions.schoolSyllabusCourses(livePeople(next),actor('u-lin','2026-10-22'),catalogSeed),['C101'])
  assert.deepEqual(permissions.schoolSyllabusCourses(livePeople(next),actor('u-lin','2026-10-23'),catalogSeed),[])
  assert.deepEqual(next.assignments.filter(d=>d.id!==old.id),state.assignments.filter(d=>d.id!==old.id))
  assert.deepEqual(next.assignments.find(d=>d.id===old.id).basis,old.basis)
  assert.equal(next.assignments.find(d=>d.id===old.id).history.at(-1).date,'2026-10-22')
  const standard=state.assignments.find(d=>d.id==='d-xu-1')
  const revised=duties.applyStaffDutyCommand(state,actor('u-lu'),{type:'revise',assignment:{...standard,end:'2027-07-31'},expected:standard},livePeople(state),catalogSeed).assignments.find(d=>d.id===standard.id)
  assert.equal(revised.canDelegateMaterials,true);assert.deepEqual(revised.basis,standard.basis);assert.equal(revised.scopeSub,standard.scopeSub)
})

test('one-time known seed migration preserves every legacy record, explicit old term; never reseeds ended grants', () => {
  const seed=duties.staffDutySeed(), source={schema:1,groups:seed.groups,assignments:seed.assignments.filter(d=>d.type!=='course_material')}
  const before=structuredClone(source), migrated=duties.seedCourseMaterialDuties(source)
  assert.deepEqual(migrated.assignments.filter(d=>d.type!=='course_material'),before.assignments)
  assert.deepEqual(source,before);assert.equal(migrated.courseMaterialSeeded,true)
  const old={...seed.assignments.find(d=>d.id==='d-lin-3'),end:'2026-10-01',status:'ended'}
  const known=duties.seedCourseMaterialDuties({...source,assignments:[...source.assignments,old]})
  assert.deepEqual(known.assignments.find(d=>d.id===old.id),old)
  assert.equal(duties.seedCourseMaterialDuties(known),known)
})

test('real stores persist new and ended duties, reject forged/stale actor rights, and leave data unchanged on storage failure', () => {
  const data=new Map(); let fail=false
  const storage={get length(){return data.size},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem(k,v){if(fail)throw Error('full');data.set(k,v)},removeItem:k=>data.delete(k)}
  global.window={localStorage:storage,sessionStorage:storage,addEventListener(){},removeEventListener(){}}
  const dutyStore=require('../lib/school/duty-store.ts'), staffStore=require('../lib/school/staff-store.ts'), researchStore=require('../lib/research/store.ts')
  const current=dutyStore.getStaffDuties(), item=grant('persisted')
  assert.deepEqual(dutyStore.commitStaffDuty(actor('u-xu'),{type:'arrange',assignments:[item]},staffStore.getStaffList(actor().date)),{ok:true})
  assert(data.get(dutyStore.STAFF_DUTY_STORAGE_KEY).includes('persisted'))
  const saved=dutyStore.refreshStaffDuties().assignments.find(d=>d.id===item.id)
  const prior=data.get(dutyStore.STAFF_DUTY_STORAGE_KEY);fail=true
  assert.equal(dutyStore.commitStaffDuty(actor('u-xu'),{type:'end',assignment:{...saved,end:'2026-10-22'},expected:saved},staffStore.getStaffList(actor().date)).ok,false)
  fail=false;assert.equal(data.get(dutyStore.STAFF_DUTY_STORAGE_KEY),prior);assert.deepEqual(dutyStore.getStaffDuties().assignments.find(d=>d.id===item.id),saved)
  assert(dutyStore.commitStaffDuty(actor('u-xu'),{type:'end',assignment:{...saved,end:'2026-10-22'},expected:saved},staffStore.getStaffList(actor().date)).ok)
  const forged={...actor('u-chen','2026-10-23'),schoolSyllabusCourses:['C101','C201']}
  assert.equal(researchStore.researchCommand(forged,{type:'create-document',document:{...schoolDocument('forged'),author:'u-chen'}}).ok,false)
  const author=withRights(actor()), doc=schoolDocument('live-store')
  assert(researchStore.researchCommand(author,{type:'create-document',document:doc}).ok)
  // A duty ended in another tab must be checked synchronously on save, before its storage event fires.
  const latest=JSON.parse(data.get(dutyStore.STAFF_DUTY_STORAGE_KEY));latest.assignments.find(d=>d.id==='d-lin-3').end='2026-10-21';data.set(dutyStore.STAFF_DUTY_STORAGE_KEY,JSON.stringify(latest))
  assert.equal(researchStore.researchCommand(author,{type:'save-document',document:{...doc,title:'unauthorized'},baseVersion:1}).ok,false)
  assert.equal(researchStore.getResearch().documents.find(d=>d.id===doc.id).title,doc.title)
  assert.equal(current.assignments.some(d=>d.id==='persisted'),false)
})
