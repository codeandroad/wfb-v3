const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const test = require('node:test')
const ts = require('typescript')
const root = path.resolve(__dirname, '..'), resolve = Module._resolveFilename
Module._resolveFilename = function(request, ...args) { return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, ...args) }
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)
const React = require('react'), { renderToStaticMarkup: render } = require('react-dom/server')
const data = new Map(), session = new Map()
const storage = values => ({ get length() { return values.size }, key: i => [...values.keys()][i] ?? null, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) })
global.window = { localStorage: storage(data), sessionStorage: storage(session), addEventListener() {}, removeEventListener() {} }
const realFetch = global.fetch
let networkCalls = 0
// Ordinary navigation must work even when every external import source is unavailable.
global.fetch = async () => { networkCalls++; throw Error('import source is unavailable') }
const load = Module._load
Module._load = function(request, ...args) {
  if (request.includes('local-import-server') || request.includes('local-source') || request.includes('use-local-school-source') || request === 'next/headers') throw Error('ordinary school pages must not depend on import files or endpoints')
  if (request === 'next/link') return ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children)
  return load.call(this, request, ...args)
}
let staff, foundation, apply, SchoolHub, SchoolPage
function reopenBrowser(clear = false) {
  if (clear) data.clear()
  session.clear()
  for (const file of Object.keys(require.cache)) if (file.startsWith(path.join(root, 'lib/school/')) || file.startsWith(path.join(root, 'components/school/')) || file === path.join(root, 'app/(app)/school/page.tsx')) delete require.cache[file]
  staff = require('../lib/school/staff-store.ts')
  foundation = require('../lib/school/foundation-store.ts')
  apply = require('../lib/school/local-import-commit.ts').applyLocalSchoolImport
  SchoolHub = require('../components/school/school-hub.tsx').SchoolHub
  SchoolPage = require('../app/(app)/school/page.tsx').default
}
const batchId = 'school-files-synthetic-persistence'
function privateBundle() {
  return { schema: 1, batchId,
    summary: { staffRows: 1, departments: { 合成新部门: 1 }, jobs: 1, places: 1, areas: { 合成区域: 1 }, placeKinds: { office: 1 }, suggestedSubjects: {}, duplicateNameRows: 0, multiUsePlaces: 0, ignoredLayoutMarkers: 0 },
    staff: [{ id: 'local-staff-cross-browser', name: '合成持久化人员', employeeNo: '', department: '合成新部门', jobTitle: '合成职务', gender: '未透露', phone: '', email: '', status: 'active', accountStatus: 'none', systemRoles: [], duties: [], history: [], sourceBatch: batchId, sourceRefs: ['合成表!A3:D3'], departmentAffiliations: ['合成新部门'], suggestedResearchSubjects: [] }],
    departments: [{ id: 'local-dept-cross-browser', name: '合成新部门', status: 'active', order: 100, referencedBy: 1, sourceBatch: batchId }],
    jobs: [{ id: 'local-job-cross-browser', name: '合成职务', status: 'active', order: 100, referencedBy: 1, sourceBatch: batchId }],
    places: [{ id: 'local-place-cross-browser', name: 'Z101', roomCode: 'Z101', building: '合成区域', usage: '合成办公室（合成持久化人员）', kind: 'office', status: 'active', order: 100, sourceBatch: batchId }],
  }
}
// Compatibility fixture for browsers which saved the prior partial catalog.
function publicCatalog() {
  const bundle = privateBundle()
  return { foundation: { departments: bundle.departments, jobs: bundle.jobs, places: bundle.places.map(place => ({ ...place, usage: '合成办公室', catalogOnly: true })) } }
}
function drawSchool(tab, section) {
  const kit = require('../components/kit.tsx')
  const sync = React.useSyncExternalStore, toast = kit.useToast
  const useDutyContext = staff.useStaffDutyContext, usePermission = staff.useStaffPermission
  const create = require('../components/school/staff-create-modal.tsx'), originalCreate = create.StaffCreateModal
  // Simulate mounted client snapshots while keeping actual ordinary panels/rows.
  React.useSyncExternalStore = (_subscribe, snapshot) => snapshot()
  kit.useToast = () => ({ push() {} })
  staff.useStaffPermission = () => true
  staff.useStaffDutyContext = () => ({ people: staff.getStaffList(), ready: true })
  create.StaffCreateModal = ({open}) => { assert.equal(open, false); return null }
  try { return render(React.createElement(SchoolHub, { initialTab: tab, initialSection: section })) }
  finally { React.useSyncExternalStore = sync; kit.useToast = toast; staff.useStaffDutyContext = useDutyContext; staff.useStaffPermission = usePermission; create.StaffCreateModal = originalCreate }
}
test.beforeEach(() => { networkCalls = 0; reopenBrowser(true) })
test.after(() => { Module._load = load; Module._resolveFilename = resolve; global.fetch = realFetch })

test('ordinary school routes need no prepared files, headers, cookie or import endpoint', async () => {
  for (const [tab, section] of [['staff', undefined], ['foundation', 'departments'], ['foundation', 'classrooms']]) {
    const page = await SchoolPage({ searchParams: Promise.resolve({ tab, section }) })
    assert.equal(page.type, SchoolHub)
    assert.deepEqual(page.props, { initialTab: tab, initialSection: section })
    assert.equal(Object.hasOwn(page.props, 'localSource'), false)
  }
  assert.equal(networkCalls, 0)
})

test('one explicit import populates all ordinary panels after a fresh session with no source available', async () => {
  apply(privateBundle(), true)
  const persisted = JSON.stringify([...data])
  reopenBrowser()
  const staffMarkup = drawSchool('staff')
  assert.equal(staffMarkup.includes('已保存导入教职工'), false)
  assert.equal(drawSchool('foundation', 'departments').includes('基础资料范围'), false)
  assert.equal(drawSchool('foundation', 'departments').includes('已导入资料'), false)
  assert(staffMarkup.includes('合成持久化人员'))
  assert(staffMarkup.includes('合成新部门'))
  assert(drawSchool('foundation', 'departments').includes('合成新部门'))
  assert(drawSchool('foundation', 'classrooms').includes('Z101'))
  assert(drawSchool('foundation', 'classrooms').includes('合成办公室（合成持久化人员）'))
  assert.equal(networkCalls, 0)
  assert.equal(JSON.stringify([...data]), persisted)
  reopenBrowser()
  assert(drawSchool('staff').includes('合成持久化人员'))
  assert(drawSchool('foundation', 'departments').includes('合成新部门'))
  assert(drawSchool('foundation', 'classrooms').includes('Z101'))
  assert.equal(networkCalls, 0)
})

test('saved personnel and catalog edits survive refresh without reapplying the source', () => {
  apply(privateBundle(), true)
  staff.updateStaff('local-staff-cross-browser', { jobTitle: '合成人工核对职务' })
  foundation.updateFoundationItems('departments', items => items.map(item => item.id === 'local-dept-cross-browser' ? { ...item, name: '合成人工核对部门', status: 'inactive' } : item))
  foundation.updateFoundationItems('places', items => items.map(item => item.id === 'local-place-cross-browser' ? { ...item, usage: '合成人工核对用途' } : item))
  reopenBrowser()
  assert(drawSchool('staff').includes('合成人工核对职务'))
  assert(drawSchool('foundation', 'departments').includes('合成人工核对部门'))
  assert(drawSchool('foundation', 'classrooms').includes('合成人工核对用途'))
  assert.equal(foundation.getFoundation().departments.find(item => item.id === 'local-dept-cross-browser').status, 'inactive')
  assert.equal(networkCalls, 0)
})

test('a truly separate empty browser does not silently import any source or grant staff access', () => {
  apply(privateBundle(), true)
  reopenBrowser(true)
  assert.equal(staff.getStaffList().some(item => item.sourceBatch === batchId), false)
  assert.equal(foundation.getFoundation().places.some(item => item.sourceBatch === batchId), false)
  drawSchool('foundation', 'departments')
  assert.equal(networkCalls, 0)
})

test('a user-edited public place retains its text and original status when private content later arrives', async () => {
  foundation.mergeFoundationImport(publicCatalog().foundation)
  foundation.updateFoundationItems('places', items => items.map(item => item.id === 'local-place-cross-browser' ? { ...item, usage: '合成人工核对用途', status: 'inactive' } : item))
  assert.equal(foundation.getFoundation().places.find(place => place.id === 'local-place-cross-browser').catalogOnly, false)
  apply(privateBundle(), true)
  const place = foundation.getFoundation().places.find(place => place.id === 'local-place-cross-browser')
  assert.equal(place.usage, '合成人工核对用途')
  assert.equal(place.status, 'inactive')
})

test('a mutating catalog updater also protects edited public text before a full explicit import', async () => {
  foundation.mergeFoundationImport(publicCatalog().foundation)
  foundation.updateFoundationItems('places', items => { const place = items.find(item => item.id === 'local-place-cross-browser'); place.usage = '合成原地修改用途'; return items })
  apply(privateBundle(), true)
  assert.equal(foundation.getFoundation().places.find(place => place.id === 'local-place-cross-browser').usage, '合成原地修改用途')
})

test('a naturally deduplicated job retains its source identity after rename and explicit repeat imports', async () => {
  foundation.updateFoundationItems('jobs', jobs => [...jobs, { id: 'preexisting-job', name: '合成职务', order: 200, status: 'inactive', referencedBy: 0 }])
  foundation.mergeFoundationImport(publicCatalog().foundation)
  foundation.updateFoundationItems('jobs', jobs => jobs.map(job => job.id === 'preexisting-job' ? { ...job, name: '合成核对后职务' } : job))
  foundation.mergeFoundationImport(publicCatalog().foundation)
  const jobs = foundation.getFoundation().jobs
  assert.equal(jobs.some(job => job.name === '合成职务'), false)
  assert.equal(jobs.find(job => job.id === 'preexisting-job').name, '合成核对后职务')
  assert.equal(jobs.find(job => job.id === 'preexisting-job').status, 'inactive')
})

test('a known seed renamed before source aliases existed recovers its identity without another department', () => {
  const previous = foundation.getFoundation()
  const incoming = { id: 'source-affairs', name: '教务处', status: 'active', order: 100, referencedBy: 17, sourceBatch: batchId }
  const renamed = { ...previous, departments: previous.departments.map(item => item.id === 'dep-affairs' ? { ...item, name: '合成核对后的教务部门', sourceBatch: batchId } : item) }
  const merged = foundation.mergeFoundationState(renamed, { departments: [incoming] })
  assert.equal(merged.departments.length, previous.departments.length)
  const recovered = merged.departments.find(item => item.id === 'dep-affairs')
  assert.equal(recovered.name, '合成核对后的教务部门')
  assert.deepEqual(recovered.sourceIds, ['source-affairs'])
  assert.equal(recovered.referencedBy, 2)
  const { foundationPeopleCount } = require('../lib/school/foundation-view.ts')
  assert.deepEqual(foundationPeopleCount(recovered, 'department', []), { count: 17, sourceOnly: true })
})

test('a naturally deduplicated seed uses the incoming file count without replacing its original reference count', () => {
  const previous = foundation.getFoundation()
  const merged = foundation.mergeFoundationState(previous, { jobs: [{ id: 'source-teacher', name: '教师', status: 'active', order: 100, referencedBy: 9, sourceBatch: batchId }] })
  const job = merged.jobs.find(item => item.id === 'job-teacher')
  assert.equal(job.referencedBy, 5)
  const { foundationPeopleCount } = require('../lib/school/foundation-view.ts')
  assert.deepEqual(foundationPeopleCount(job, 'jobTitle', []), { count: 9, sourceOnly: true })
})

test('file reference counts remain explicit when personnel is not connected and become current when it is', () => {
  const { foundationPeopleCount } = require('../lib/school/foundation-view.ts')
  const item = privateBundle().departments[0]
  assert.deepEqual(foundationPeopleCount(item, 'department', []), { count: 1, sourceOnly: true })
  assert.deepEqual(foundationPeopleCount(item, 'department', [{ department: '合成人工调整部门', jobTitle: '合成职务', sourceBatch: batchId }]), { count: 0, sourceOnly: false })
})
