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
const local = new Map(), session = new Map()
let failedWrite = false
const storage = data => ({ get length() { return data.size }, key: index => [...data.keys()][index] ?? null, getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (failedWrite) throw new Error("test quota"); data.set(key, value) }, removeItem: key => data.delete(key) })
global.window = { localStorage: storage(local), sessionStorage: storage(session), addEventListener() {}, removeEventListener() {} }
const storePath = require.resolve("../lib/school/staff-store.ts")
let staff = require(storePath)
const dutyModel = require("../lib/school/duty-model.ts")
const { STAFF } = require("../lib/demo/staff.ts")
const { migrateResearchGroupDepartments } = require("../lib/school/responsibility-scopes.ts")
const profile = (id, overrides = {}) => ({ id, name: "合成导入人员甲", employeeNo: "", department: "教务处", jobTitle: "教师", gender: "未透露", phone: "", email: "", status: "active", accountStatus: "none", systemRoles: [], duties: [], history: [], sourceBatch: "synthetic-test-batch", sourceRefs: ["合成表!B2"], departmentAffiliations: ["教务处", "合成兼任部门"], suggestedResearchSubjects: ["数学"], ...overrides })

test("private staff import is additive, idempotent, and does not grant access from source labels", () => {
  const before = staff.getStaffList()
  const seed = structuredClone(before.find(person => person.id === "u-lin"))
  const input = profile("synthetic-private-a", { accountStatus: "enabled", systemRoles: ["school_admin"], duties: [seed.duties[0]], employeeNo: undefined })
  assert.deepEqual(staff.mergeImportedStaff([input, profile("u-lin", { name: "合成碰撞不可覆盖" })]), { added: 1, retained: 1 })
  const imported = staff.getStaffList().find(person => person.id === input.id)
  assert.equal(imported.department, "教务处")
  assert.equal(imported.employeeNo, "")
  assert.equal(imported.joinedAt, undefined)
  assert.equal(imported.accountStatus, "none")
  assert.deepEqual(imported.systemRoles, [])
  assert.deepEqual(imported.duties, [])
  assert.deepEqual(imported.suggestedResearchSubjects, ["数学"])
  assert.deepEqual(staff.getStaffList().find(person => person.id === "u-lin"), seed)
  assert.deepEqual(staff.mergeImportedStaff([input]), { added: 0, retained: 1 })
  assert.equal(staff.getStaffList().length, before.length + 1)
})

test("imported edits, explicit clearing, and history survive a new session and repeat import", () => {
  staff.updateStaff("synthetic-private-a", { name: "合成已核对姓名", department: "合成更新部门", joinedAt: undefined }, "核对合成资料")
  session.clear()
  delete require.cache[storePath]
  staff = require(storePath)
  staff.mergeImportedStaff([profile("synthetic-private-a")])
  const actual = staff.getStaffList().find(person => person.id === "synthetic-private-a")
  assert.equal(actual.name, "合成已核对姓名")
  assert.equal(actual.department, "合成更新部门")
  assert.equal(actual.joinedAt, undefined)
  assert(actual.history.some(entry => entry.text === "核对合成资料"))
  assert.deepEqual(actual.departmentAffiliations, ["教务处", "合成兼任部门"])
})

test("duplicate names remain separate; malformed batches and storage failure do not partially mutate", () => {
  const before = staff.getStaffList().length
  assert.throws(() => staff.mergeImportedStaff([profile("synthetic-private-b"), profile("synthetic-private-b")]), /未写入/)
  assert.equal(staff.getStaffList().length, before)
  failedWrite = true
  assert.throws(() => staff.mergeImportedStaff([profile("synthetic-private-b")]), /未保存/)
  assert.throws(() => staff.updateStaff("synthetic-private-a", { name: "合成不可保存" }), /未保存/)
  failedWrite = false
  assert.equal(staff.getStaffList().length, before)
  assert.equal(staff.getStaffList().find(person => person.id === "synthetic-private-a").name, "合成已核对姓名")
  staff.mergeImportedStaff([profile("synthetic-private-b", { duplicateName: true }), profile("synthetic-private-c", { duplicateName: true })])
  assert.equal(staff.getStaffList().filter(person => person.name === "合成导入人员甲").length, 2)
  const saved = local.get(staff.IMPORTED_STAFF_STORAGE_KEY)
  local.set(staff.IMPORTED_STAFF_STORAGE_KEY, "malformed")
  assert.throws(() => staff.mergeImportedStaff([profile("synthetic-private-d")]), /未覆盖/)
  assert.equal(local.get(staff.IMPORTED_STAFF_STORAGE_KEY), "malformed")
  local.set(staff.IMPORTED_STAFF_STORAGE_KEY, saved)
})

test("group affiliation migration preserves IDs, custom departments, assignments and permissions", () => {
  const state = dutyModel.staffDutySeed()
  const old = { ...state, groups: state.groups.map(group => ({ ...group, department: group.id === "english" ? "合成自定义归口" : "教学部" })) }
  const next = { ...old, groups: migrateResearchGroupDepartments(old.groups) }
  assert.deepEqual(next.assignments, old.assignments)
  assert.deepEqual(next.groups.map(group => group.id), old.groups.map(group => group.id))
  assert.equal(next.groups.find(group => group.id === "math").department, "教务处")
  assert.equal(next.groups.find(group => group.id === "english").department, "合成自定义归口")
  dutyModel.validateStaffDutyState(next)
  const math = next.groups.find(group => group.id === "math")
  const changed = dutyModel.applyStaffDutyCommand(next, { staff: "u-lin", date: "2026-10-22", enabled: true }, { type: "save-group", group: { ...math, department: "合成其他归口" }, expected: math }, STAFF)
  assert.deepEqual(changed.assignments, old.assignments)
  assert.equal(changed.groups.find(group => group.id === "math").department, "合成其他归口")
  assert.throws(() => dutyModel.validateStaffDutyState({ ...next, groups: [{ ...math, department: " " }] }), /目录格式无效/)
})

test("persisted legacy group affiliation is backed up before migration", () => {
  const key = "tgs:staff-duties-prototype:v1"
  const old = dutyModel.staffDutySeed()
  old.groups = old.groups.map(group => ({ ...group, department: "教学部" }))
  const raw = JSON.stringify(old)
  local.set(key, raw)
  const dutyStore = require("../lib/school/duty-store.ts")
  const actual = dutyStore.refreshStaffDuties()
  assert(actual.groups.every(group => group.department === "教务处"))
  assert.deepEqual(actual.assignments, old.assignments)
  assert.equal(local.get(dutyStore.STAFF_DUTY_DEPARTMENT_BACKUP_KEY), raw)
})

test("imported current and historical numbers hydrate before any new allocation after a new session", () => {
  staff.mergeImportedStaff([profile("synthetic-numbered-a"), profile("synthetic-numbered-b")])
  staff.updateStaff("synthetic-numbered-a", { employeeNo: "TG2810E001" })
  staff.updateStaff("synthetic-numbered-a", { employeeNo: "TG2810E002" })
  staff.updateStaff("synthetic-numbered-a", { employeeNo: "" })
  staff.updateStaff("synthetic-numbered-b", { employeeNo: "TG2810E003" })
  session.clear()
  const numberPath = require.resolve("../lib/school/person-no.ts")
  delete require.cache[numberPath]
  delete require.cache[storePath]
  // Deliberately allocate before even requiring/reading the staff store again.
  const numbers = require(numberPath)
  assert.equal(numbers.nextPersonNo("E", "202810"), "TG2810E004")
  for (const no of ["TG2810E001", "TG2810E002", "TG2810E003"]) assert.equal(numbers.isIssued(no, "E"), true)
  assert.deepEqual(numbers.historicalNumbers("synthetic-numbered-a"), ["TG2810E001", "TG2810E002"])
  assert.throws(() => numbers.registerIssued("TG2810E001", "E", "synthetic-numbered-b"), /其他人员/)
  staff = require(storePath)
  assert.equal(staff.getStaffList().find(person => person.id === "synthetic-numbered-b").employeeNo, "TG2810E003")
  assert.equal(staff.getStaffList().find(person => person.id === "synthetic-numbered-a").employeeNo, "")
})

test("failed imported number save claims no number; retry works and legacy stored current numbers also block reuse", () => {
  const numbers = require("../lib/school/person-no.ts")
  const before = local.get(staff.IMPORTED_STAFF_STORAGE_KEY)
  failedWrite = true
  assert.throws(() => staff.updateStaff("synthetic-numbered-a", { employeeNo: "TG2810E004" }), /未保存/)
  failedWrite = false
  assert.equal(local.get(staff.IMPORTED_STAFF_STORAGE_KEY), before)
  assert.equal(numbers.isIssued("TG2810E004", "E"), false)
  assert.equal(numbers.checkPersonNo("TG2810E004", "E").status, "valid")
  staff.updateStaff("synthetic-numbered-a", { employeeNo: "TG2810E004" })
  assert.equal(numbers.isIssued("TG2810E004", "E"), true)
  assert.equal(numbers.nextPersonNo("E", "202810"), "TG2810E005")
  const old = JSON.parse(local.get(staff.IMPORTED_STAFF_STORAGE_KEY))
  delete old.numberClaims
  old.patches["synthetic-numbered-a"].employeeNo = "TG2910E001"
  local.set(staff.IMPORTED_STAFF_STORAGE_KEY, JSON.stringify(old))
  session.clear()
  const numberPath = require.resolve("../lib/school/person-no.ts")
  delete require.cache[numberPath]
  const refreshed = require(numberPath)
  assert.equal(refreshed.nextPersonNo("E", "202910"), "TG2910E002")
  assert.equal(refreshed.isIssued("TG2910E001", "E"), true)
})
