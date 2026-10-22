const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)
const storage = new Map()
let failSave = false
let failRead = false
global.window = { localStorage: { getItem: key => { if (failRead) throw new Error('denied'); return storage.get(key) ?? null }, setItem: (key, value) => { if (failSave) throw new Error('quota'); storage.set(key, value) } } }
const modulePath = require.resolve('../lib/school/foundation-store.ts')
const reload = () => { delete require.cache[modulePath]; return require(modulePath) }
const fixture = (id, overrides = {}) => ({ id, name: '演示备课室', building: '合成楼甲', area: '南区', roomCode: '301', kind: 'office', status: 'active', order: 100, ...overrides })
const blank = () => ({ departments: [], jobs: [], places: [] })
let store = reload()
const views = require('../lib/school/foundation-view.ts')

test('imported foundation view is the default and includes a preexisting department reused by source staff', () => {
  const state = {
    departments: [
      { id: 'legacy-subject', name: '合成旧学科组', status: 'active', order: 1, referencedBy: 0 },
      { id: 'shared-dept', name: '合成教务处', status: 'active', order: 2, referencedBy: 0 },
      { id: 'imported-dept', name: '合成新部门', sourceBatch: 'synthetic-source', status: 'active', order: 3, referencedBy: 1 },
    ],
    jobs: [{ id: 'legacy-job', name: '合成旧职务' }, { id: 'imported-job', name: '合成新职务', sourceBatch: 'synthetic-source' }],
    places: [fixture('legacy-room'), fixture('imported-room', { sourceBatch: 'synthetic-source', roomCode: '402' })],
  }
  const before = JSON.stringify(state)
  const imported = views.importedFoundationItems(state, [{ sourceBatch: 'synthetic-source', department: '合成后来更改的部门', departmentAffiliations: ['合成教务处'] }])
  assert.equal(views.defaultFoundationScope(imported), 'imports')
  assert.deepEqual(imported.departments.map(item => item.id), ['shared-dept', 'imported-dept'])
  assert.deepEqual(imported.jobs.map(item => item.id), ['imported-job'])
  assert.deepEqual(imported.places.map(item => item.id), ['imported-room'])
  assert.equal(JSON.stringify(state), before)
})

test('without imported data the entire existing catalog remains the default', () => {
  const state = { departments: [{ id: 'existing', name: '合成旧部门' }], jobs: [], places: [fixture('existing-room')] }
  const imported = views.importedFoundationItems(state, [{ department: '合成旧部门' }])
  assert.equal(views.defaultFoundationScope(imported), 'all')
  assert.deepEqual(imported, blank())
  assert.equal(state.departments.length, 1)
  assert.equal(state.places.length, 1)
})

test('natural-key dedup attaches import provenance while preserving the existing record and edits', () => {
  const previous = { departments: [{ id: 'shared', name: '合成教务处', status: 'inactive', order: 9, referencedBy: 3, note: '手工核验备注' }], jobs: [], places: [] }
  const incoming = { departments: [{ id: 'source-id', name: '合成教务处', status: 'active', order: 100, referencedBy: 5, sourceBatch: 'synthetic-source' }] }
  const next = store.mergeFoundationState(previous, incoming)
  assert.deepEqual(next.departments[0], { ...previous.departments[0], sourceBatch: 'synthetic-source', sourceIds: ['source-id'], sourceReferencedBy: 5 })
  assert.equal(previous.departments[0].sourceBatch, undefined)
  assert.deepEqual(store.mergeFoundationState(next, incoming), next)
  const renamed = { ...next, departments: [{ ...next.departments[0], name: '合成人工修改部门名称' }] }
  assert.equal(views.importedFoundationItems(renamed, []).departments[0].id, 'shared')
  assert.equal(store.mergeFoundationState(renamed, incoming).departments.length, 1)
  assert.equal(store.mergeFoundationState(renamed, incoming).departments[0].name, '合成人工修改部门名称')
})

test('moving a row in imported scope swaps only visible rows and keeps hidden examples untouched', () => {
  const items = [{ id: 'first', order: 10 }, { id: 'hidden', order: 20 }, { id: 'second', order: 30 }]
  const next = views.reorderFoundationItems(items, 'first', 1, ['first', 'second'])
  assert.deepEqual(next, [{ id: 'first', order: 30 }, { id: 'hidden', order: 20 }, { id: 'second', order: 10 }])
  assert.deepEqual(items, [{ id: 'first', order: 10 }, { id: 'hidden', order: 20 }, { id: 'second', order: 30 }])
  assert.equal(views.reorderFoundationItems(items, 'first', -1, ['first', 'second']), items)
})

test('renaming a reused source department from the ordinary catalog retains imported membership without a special-page visit', () => {
  const department = { id: 'legacy-shared', name: '合成教务处', status: 'active', order: 10, referencedBy: 1, note: '保留手工备注' }
  const people = [{ sourceBatch: 'synthetic-older-batch', department: '合成当前人员部门', departmentAffiliations: ['合成教务处'] }]
  const previous = { departments: [department], jobs: [], places: [] }
  assert.equal(views.importedFoundationItems(previous, people).departments.length, 1)
  const renamed = views.renameFoundationDepartment(department, '合成核对后名称', people)
  const next = { ...previous, departments: [renamed] }
  assert.equal(views.importedFoundationItems(next, people).departments.length, 1)
  assert.equal(renamed.sourceBatch, 'synthetic-older-batch')
  assert.equal(renamed.id, department.id)
  assert.equal(renamed.note, department.note)
  assert.equal(department.sourceBatch, undefined)
  const ordinary = views.renameFoundationDepartment({ ...department, name: '合成无关部门' }, '合成普通修改', people)
  assert.equal(ordinary.sourceBatch, undefined)
})

test('additive merge preserves old IDs, edits, demo data and idempotent imports', () => {
  const previous = { departments: [{ id: 'old-dept', name: '合成教务处', status: 'active', order: 1, referencedBy: 0 }], jobs: [], places: [fixture('room-one', { name: '人工修订名称', note: '保留备注' })] }
  const frozen = JSON.stringify(previous)
  const incoming = { departments: [{ id: 'new-dept', name: '合成教务处', status: 'inactive', order: 5, referencedBy: 1 }], places: [fixture('room-one'), fixture('same-location-different-id'), fixture('another-building', { building: '合成楼乙' })] }
  const merged = store.mergeFoundationState(previous, incoming)
  assert.equal(merged.departments.length, 1)
  assert.equal(merged.departments[0].id, 'old-dept')
  assert.equal(merged.places.length, 2)
  assert.equal(merged.places[0].name, '人工修订名称')
  assert.equal(merged.places[0].note, '保留备注')
  assert.deepEqual(store.mergeFoundationState(merged, incoming), merged)
  assert.equal(JSON.stringify(previous), frozen)
})

test('area and room code remain independent; floors are never inferred', () => {
  const room = fixture('area-room')
  assert.equal(store.placeLabel(room), '合成楼甲 · 南区 · 301 · 演示备课室')
  const merged = store.mergeFoundationState(blank(), { places: [room] })
  assert.equal(merged.places[0].floor, undefined)
  assert.equal(merged.places[0].area, '南区')
})

test('place choices show usage while omitting parenthetical office occupants from schedule labels', () => {
  const room = fixture('usage-room', { name: '301', usage: '教研办公室（合成人员甲、合成人员乙）' })
  assert.equal(store.placeLabel(room), '合成楼甲 · 南区 · 301 · 教研办公室')
  assert.equal(room.usage, '教研办公室（合成人员甲、合成人员乙）')
})

test('same names and room codes in different areas remain distinct and ambiguous short labels stay unmatched', () => {
  const places = [fixture('a'), fixture('b', { area: '北区' })]
  assert.equal(store.mergeFoundationState(blank(), { places }).places.length, 2)
  assert.equal(store.resolvePlaceLabel('301', places), null)
  assert.equal(store.resolvePlaceLabel('演示备课室', places), null)
  assert.equal(store.resolvePlaceLabel(store.placeLabel(places[1]), places), store.placeLabel(places[1]))
  assert.equal(store.resolvePlaceLabel('301', [places[0]]), store.placeLabel(places[0]))
})

test('active place choices retain existing schedule labels and a currently selected retired place', () => {
  const places = [fixture('active'), fixture('inactive', { roomCode: '302', status: 'inactive' })]
  const historical = store.placeLabel(places[1])
  const options = store.availablePlaceLabels(places, ['D101', 'D101'], historical)
  assert.equal(options.filter(label => label === 'D101').length, 1)
  assert(options.includes(store.placeLabel(places[0])))
  assert(options.includes(historical))
  assert(!store.availablePlaceLabels(places).includes(historical))
  assert.equal(store.resolvePlaceLabel('302', places), null)
})

test('persistent imports survive module reload and preserve edits when reapplied', () => {
  storage.clear(); store = reload()
  const seedIds = store.getFoundation().places.map(place => place.id)
  store.mergeFoundationImport({ places: [fixture('persist-room')] })
  store.updateFoundationItems('places', places => places.map(place => place.id === 'persist-room' ? { ...place, usage: '人工核验后的用途' } : place))
  store = reload()
  assert(seedIds.every(id => store.getFoundation().places.some(place => place.id === id)))
  store.mergeFoundationImport({ places: [fixture('persist-room', { usage: '导入原始用途' })] })
  assert.equal(store.getFoundation().places.find(place => place.id === 'persist-room').usage, '人工核验后的用途')
})

test('storage failure does not mutate memory or persisted data, including a mutating updater', () => {
  const original = JSON.stringify(store.getFoundation())
  const persisted = storage.get(store.FOUNDATION_STORAGE_KEY)
  failSave = true
  assert.throws(() => store.updateFoundationItems('places', places => { places[0].name = '不得写入'; return places }), /保存失败/)
  failSave = false
  assert.equal(JSON.stringify(store.getFoundation()), original)
  assert.equal(storage.get(store.FOUNDATION_STORAGE_KEY), persisted)
})

test('updates read a newer stored snapshot before merging, without losing another tab changes', () => {
  const external = structuredClone(store.getFoundation())
  external.places.push(fixture('other-tab', { roomCode: '401' }))
  storage.set(store.FOUNDATION_STORAGE_KEY, JSON.stringify(external))
  store.mergeFoundationImport({ places: [fixture('this-tab', { roomCode: '402' })] })
  assert(store.getFoundation().places.some(place => place.id === 'other-tab'))
  assert(store.getFoundation().places.some(place => place.id === 'this-tab'))
})

test('invalid stored content is preserved and cannot be silently overwritten by an import', () => {
  storage.set(store.FOUNDATION_STORAGE_KEY, '{broken')
  store = reload()
  assert.throws(() => store.mergeFoundationImport({ places: [fixture('blocked')] }), /原数据已保留/)
  assert.equal(storage.get(store.FOUNDATION_STORAGE_KEY), '{broken')
  storage.clear(); store = reload()
})

test('timetable import resolves an imported office to its complete label and preserves old room values', () => {
  const office = fixture('import-office', { name: '合成教研办公室', roomCode: 'OFF-DEMO' })
  store.mergeFoundationImport({ places: [office] })
  const { parseImport } = require('../lib/timetable/grid-import.ts')
  const parse = value => parseImport({ sheet: '合成课表', cells: { A1: '课节', B1: '周一', A2: '第1节', B2: value }, maxRow: 2 }, 'TEACHER', '2026-10-19', { teacherId: 'lin' }).records[0]
  assert.equal(parse('数学教研会/OFF-DEMO').roomId, store.placeLabel(office))
  assert.equal(parse('数学教研会/OFF-DEMO').roomStatus, 'ok')
  assert.equal(parse('数学答疑/D101').roomId, 'D101')
})
