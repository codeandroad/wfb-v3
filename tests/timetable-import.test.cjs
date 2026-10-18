const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")
const ts = require("typescript")

require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, file)

const { parseImport, detectSource, isGridSheet, IMPORT_CLASS_OPTIONS } = require("../lib/timetable/grid-import.ts")
const { parseCell, serializeRecord } = require("../lib/timetable/grid-slash.ts")
const { decodeWorkbook } = require("../lib/timetable/xlsx-read.ts")

const root = path.resolve(__dirname, "..")
const importCell = (value, view = "TEACHER", opts = {}) => parseImport({
  sheet: "课表",
  cells: { A1: "课节", B1: "周一", A2: "第1节", B2: value },
  maxRow: 2,
}, view, "2026-10-19", { teacherId: "lin", ...opts })

const onlyRecord = result => {
  assert.deepEqual(result.issues, [])
  assert.equal(result.records.length, 1)
  return result.records[0]
}

const readWorkbook = file => decodeWorkbook(Uint8Array.from(fs.readFileSync(file)).buffer)

test("teacher activities import directly by name without an extra confirmation", () => {
  for (const value of ["班主任会议", "数学教研会/会议室1", "数学答疑/D101", "班会/-/P1"]) {
    const result = importCell(value)
    const record = onlyRecord(result)
    assert.equal(record.isActivity, true, value)
    assert.equal(record.className, value.split("/")[0])
    assert.equal(record.classStatus, "ok")
    assert.equal(record.teacherId, "lin")
    assert.equal(record.periodId, "m1")
    assert.equal(record.status, "ok")
    assert.deepEqual(record.issues, [])
    assert.deepEqual(result.counts, { ok: 1, pending: 0, error: 0, total: 1 })
  }
})

test("class activity example needs only its name, teacher and location", () => {
  const record = onlyRecord(importCell("班会/周老师/A101", "CLASS"))
  assert.equal(record.isActivity, true)
  assert.equal(record.className, "班会")
  assert.equal(record.teacherId, "zhou")
  assert.equal(record.raw.locationText, "A101")
  assert.equal(record.raw.unitGroupShortName, null)
  assert.equal(record.status, "ok")
  assert.deepEqual(record.issues, [])
})

test("legacy ASCII and fullwidth activity prefixes remain readable but are not emitted", () => {
  for (const prefix of ["活动:", "活动："]) {
    const record = onlyRecord(importCell(`${prefix}行政巡查/D101`))
    assert.equal(record.isActivity, true)
    assert.equal(record.className, "行政巡查")
    assert.equal(record.status, "ok")
    assert.equal(serializeRecord(record.raw), "行政巡查/D101")
    const classRecord = onlyRecord(importCell(`${prefix}班会/周老师/A101`, "CLASS"))
    assert.equal(classRecord.isActivity, true)
    assert.equal(classRecord.teacherId, "zhou")
    assert.equal(serializeRecord(classRecord.raw), "班会/周老师/A101")
  }
})

test("registered and ambiguous teaching classes take priority over activity keywords", t => {
  const originalLength = IMPORT_CLASS_OPTIONS.length
  t.after(() => { IMPORT_CLASS_OPTIONS.splice(originalLength) })
  IMPORT_CLASS_OPTIONS.push({ id: "test-practice", name: "综合实践活动", subject: "综合实践", teacherIds: ["lin"], aliases: ["综合实践活动"] })
  const course = onlyRecord(importCell("综合实践活动/D101"))
  assert.equal(course.isActivity, false)
  assert.equal(course.classId, "test-practice")
  assert.equal(course.status, "ok")
  IMPORT_CLASS_OPTIONS.push({ id: "test-practice-duplicate", name: "综合实践活动", subject: "综合实践", teacherIds: ["lin"], aliases: ["综合实践活动"] })
  const ambiguous = onlyRecord(importCell("综合实践活动/D101"))
  assert.equal(ambiguous.isActivity, false)
  assert.equal(ambiguous.classStatus, "ambiguous")
  assert.equal(ambiguous.status, "pending")
  assert.deepEqual(ambiguous.issues, ["CLASS_AMBIGUOUS"])
})

test("unrecognized names remain available for explicit mapping or activity selection", () => {
  for (const name of ["行政巡查", "高三9班 • 数学"]) {
    const record = onlyRecord(importCell(name))
    assert.equal(record.isActivity, false)
    assert.equal(record.classStatus, "unmatched")
    assert.equal(record.status, "pending")
    assert.deepEqual(record.issues, ["CLASS_UNMATCHED"])
  }
})

test("prefix-free activities do not bypass teacher, period or field validation", () => {
  const teacher = onlyRecord(importCell("班主任会议", "TEACHER", { teacherId: null }))
  assert.equal(teacher.status, "pending")
  assert.deepEqual(teacher.issues, ["TEACHER_REQUIRED"])
  const unknownTeacher = onlyRecord(importCell("班会/未登记教师/A101", "CLASS"))
  assert.deepEqual(unknownTeacher.issues, ["TEACHER_UNMATCHED"])
  const period = onlyRecord(parseImport({
    sheet: "课表", cells: { A1: "课节", B1: "周一", A2: "第99节", B2: "班会" }, maxRow: 2,
  }, "TEACHER", "2026-10-19", { teacherId: "lin" }))
  assert.equal(period.isActivity, true)
  assert.equal(period.status, "error")
  assert.deepEqual(period.issues, ["PERIOD_UNMATCHED"])
  assert.deepEqual(importCell("班会//P1").issues, [{ cell: "B2", code: "EMPTY_MIDDLE_FIELD" }])
})

test("serialization preserves literal reserved names, quotes and missing middle fields", () => {
  const literal = parseCell("课程:活动:命名练习/D101", "TEACHER")[0]
  assert.equal(literal.name, "活动:命名练习")
  assert.equal(parseCell(serializeRecord(literal), "TEACHER")[0].name, literal.name)
  const quoted = parseCell('"活动:班会/研讨"/-/P1', "TEACHER")[0]
  assert.equal(serializeRecord(quoted), '"班会/研讨"/-/P1')
  assert.equal(parseCell(serializeRecord(quoted), "TEACHER")[0].name, "班会/研讨")
})

test("downloadable templates contain prefix-free activities and consistent instructions", async () => {
  for (const file of ["blank-templates.xlsx", "teacher-example.xlsx", "class-example.xlsx", "teacher-example-no-time.xlsx"]) {
    const workbook = await readWorkbook(path.join(root, "public/timetable-templates", file))
    const instructions = Object.values(workbook.sheets["填写说明"].cells).join(" ")
    assert.doesNotMatch(instructions, /活动[:：]|无前缀|前缀/)
    for (const sheet of Object.values(workbook.sheets)) {
      for (const value of Object.values(sheet.cells)) assert.doesNotMatch(value, /活动[:：]/, `${file}: ${value}`)
      if (!isGridSheet(sheet)) continue
      const detection = detectSource(sheet, instructions)
      const result = parseImport(sheet, detection.layout ?? "TEACHER", "2026-10-19", { teacherId: detection.teacherId ?? "lin", order: detection.order })
      assert.deepEqual(result.issues, [], file)
      const activities = result.records.filter(record => /教研|讲座|答疑/.test(record.raw.name))
      if (file !== "blank-templates.xlsx") assert.ok(activities.length, file)
      for (const activity of activities) {
        assert.equal(activity.isActivity, true, `${file}: ${activity.raw.name}`)
        assert.equal(activity.classStatus, "ok")
        assert.equal(activity.status, "ok")
        assert.deepEqual(activity.issues, [])
      }
    }
  }
})
