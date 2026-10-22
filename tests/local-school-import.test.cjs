const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const test = require("node:test")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")
const resolve = Module._resolveFilename
Module._resolveFilename = function(request, ...args) { return resolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args) }
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)
const data = new Map()
let blockedKey = ""
const storage = { get length() { return data.size }, key: index => [...data.keys()][index] ?? null, getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (key === blockedKey) throw new Error("synthetic quota failure"); data.set(key, value) }, removeItem: key => data.delete(key) }
global.window = { localStorage: storage, sessionStorage: storage, addEventListener() {}, removeEventListener() {} }
const model = require("../lib/school/local-import-model.ts")
const { applyLocalSchoolImport } = require("../lib/school/local-import-commit.ts")
const foundation = require("../lib/school/foundation-store.ts")
const staff = require("../lib/school/staff-store.ts")

function bundle(suffix = "a") {
  const batchId = `school-files-synthetic-${suffix}`
  return {
    schema: 1, batchId,
    staff: [{ id: `local-staff-synthetic-${suffix}`, name: `合成核验人员${suffix}`, employeeNo: "", department: "合成教务处", jobTitle: "合成教师", gender: "未透露", phone: "", email: "", status: "active", accountStatus: "none", systemRoles: [], duties: [], history: [], sourceBatch: batchId, sourceRefs: ["合成人员表!A2:D2"], departmentAffiliations: ["合成教务处"], suggestedResearchSubjects: ["数学"] }],
    departments: [{ id: `local-dept-synthetic-${suffix}`, name: `合成部门${suffix}`, status: "active", order: 1000, referencedBy: 1 }],
    jobs: [{ id: `local-job-synthetic-${suffix}`, name: `合成职务${suffix}`, status: "active", order: 1000, referencedBy: 1 }],
    places: [{ id: `local-place-synthetic-${suffix}`, name: `合成场所${suffix}`, roomCode: `${suffix.toUpperCase()}101`, building: "合成区域", area: "合成区域", floor: "", status: "active", order: 1000, kind: "office", sourceBatch: batchId }],
    summary: { staffRows: 1, departments: { 合成教务处: 1 }, jobs: 1, places: 1, areas: { 合成区域: 1 }, placeKinds: { office: 1 }, suggestedSubjects: { 数学: 1 }, duplicateNameRows: 0, multiUsePlaces: 0, ignoredLayoutMarkers: 0 },
  }
}
const snapshot = () => [...data.entries()].sort(([a], [b]) => a.localeCompare(b))

test("local import accepts only exact loopback hosts", () => {
  for (const host of ["localhost", "localhost:3109", "127.0.0.1:3109", "[::1]:3109"]) assert.equal(model.isLoopbackHost(host), true)
  for (const host of [null, "", "localhost.example.test", "localhost:3109@evil.test", "192.168.1.10:3109", "https://localhost:3109", "127.0.0.2", "[::]:3109"]) assert.equal(model.isLoopbackHost(host), false)
})

test("unauthorized and invalid local imports leave both stores untouched", () => {
  const initial = snapshot()
  assert.throws(() => applyLocalSchoolImport(bundle("unauthorized"), false), /权限/)
  assert.deepEqual(snapshot(), initial)
  const cases = [
    value => { value.schema = 2 },
    value => { value.summary.staffRows = 99 },
    value => { value.staff.push(structuredClone(value.staff[0])); value.summary.staffRows++ },
    value => { value.staff[0].accountStatus = "enabled" },
    value => { value.staff[0].duties = [{ type: "research_lead" }] },
    value => { value.staff[0].joinedAt = "2026-09-01" },
    value => { value.staff[0].jobTitle = null },
    value => { value.places[0].sourceBatch = "other-batch" },
  ]
  for (const change of cases) {
    const value = bundle("invalid")
    change(value)
    assert.throws(() => applyLocalSchoolImport(value, true))
    assert.deepEqual(snapshot(), initial)
  }
})

test("a valid import preserves seeds, supports repeated application and keeps edited staff", () => {
  const seedPeople = structuredClone(staff.getStaffList())
  const seedPlaces = structuredClone(foundation.getFoundation().places)
  const value = bundle()
  assert.deepEqual(applyLocalSchoolImport(value, true), { added: 1, retained: 0 })
  for (const person of seedPeople) assert.deepEqual(staff.getStaffList().find(item => item.id === person.id), person)
  for (const place of seedPlaces) assert.deepEqual(foundation.getFoundation().places.find(item => item.id === place.id), place)
  const personId = value.staff[0].id
  staff.updateStaff(personId, { jobTitle: "合成核验后职务", department: "合成核验后部门" })
  const count = foundation.getFoundation().places.length
  assert.deepEqual(applyLocalSchoolImport(value, true), { added: 0, retained: 1 })
  assert.equal(foundation.getFoundation().places.length, count)
  const person = staff.getStaffList().find(item => item.id === personId)
  assert.equal(person.jobTitle, "合成核验后职务")
  assert.equal(person.department, "合成核验后部门")
  assert.equal(person.accountStatus, "none")
  assert.deepEqual(person.duties, [])
})

test("partial storage failure never reports complete and retry finishes without duplicates", () => {
  const value = bundle("retry")
  blockedKey = staff.IMPORTED_STAFF_STORAGE_KEY
  assert.throws(() => applyLocalSchoolImport(value, true), /未保存/)
  blockedKey = ""
  assert.equal(staff.getStaffList().some(person => person.id === value.staff[0].id), false)
  assert.equal(foundation.getFoundation().places.filter(place => place.id === value.places[0].id).length, 1)
  assert.deepEqual(applyLocalSchoolImport(value, true), { added: 1, retained: 0 })
  assert.deepEqual(applyLocalSchoolImport(value, true), { added: 0, retained: 1 })
  assert.equal(staff.getStaffList().filter(person => person.id === value.staff[0].id).length, 1)
  assert.equal(foundation.getFoundation().places.filter(place => place.id === value.places[0].id).length, 1)
})

test("an explicitly reimported place keeps its reused ID and manual location edits without a false incomplete result", () => {
  const value = bundle("place-alias")
  const existing = { ...value.places[0], id: "existing-place-alias", sourceBatch: undefined }
  foundation.updateFoundationItems("places", places => [...places, existing])
  applyLocalSchoolImport(value, true)
  foundation.updateFoundationItems("places", places => places.map(place => place.id === existing.id ? { ...place, building: "合成人工核对区域", roomCode: "CHECKED-101" } : place))
  const count = foundation.getFoundation().places.length
  assert.deepEqual(applyLocalSchoolImport(value, true), { added: 0, retained: 1 })
  const saved = foundation.getFoundation().places.find(place => place.id === existing.id)
  assert.equal(saved.building, "合成人工核对区域")
  assert.equal(saved.roomCode, "CHECKED-101")
  assert.equal(foundation.getFoundation().places.length, count)
  assert(saved.sourceIds.includes(value.places[0].id))
})

test("malformed source arrays and required staff fields are rejected before any store writes", () => {
  const cases = [
    value => { value.staff[0].history = "invalid" },
    value => { value.staff[0].sourceRefs = "invalid" },
    value => { value.staff[0].departmentAffiliations = "invalid" },
    value => { value.staff[0].suggestedResearchSubjects = "invalid" },
    value => { value.staff[0].phone = null },
    value => { value.staff[0].status = "unrecognized" },
  ]
  for (const change of cases) {
    const value = bundle("bad-shape")
    change(value)
    const before = snapshot()
    assert.throws(() => applyLocalSchoolImport(value, true))
    assert.deepEqual(snapshot(), before)
  }
})
