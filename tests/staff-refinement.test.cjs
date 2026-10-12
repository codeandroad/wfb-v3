const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const assert = require("node:assert/strict")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")
const resolve = Module._resolveFilename
Module._resolveFilename = function(request, ...args) { return resolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args) }
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file)
const data = new Map()
global.window = { sessionStorage: { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } }
const { createNumberingLedger, parseNumber, numberingForSchool } = require("../lib/school/numbering-ledger.ts")
const { backgroundError, cleanEducation, cleanWork, educationExperiencesOf, workRangeInvalid } = require("../lib/school/staff-background.ts")
const numbers = require("../lib/school/person-no.ts")
const { parseFile } = require("../lib/import/parse.ts")
const { buildPlan, defaultSheetState } = require("../lib/import/validate.ts")
const { commitPeople } = require("../lib/import/commit-people.ts")
const { getStaffList, updateStaff } = require("../lib/school/staff-store.ts")
const XLSX = require("xlsx")
let checks = 0
function check(title, fn) { fn(); checks++; console.log(`PASS ${title}`) }
const short = { schoolId: "test-school-a", code: "TG", preset: "short" }
const standard = { ...short, preset: "standard" }
const ledger = createNumberingLedger()
check("standard 12 / short 10; isolated new school default standard", () => {
  assert.equal(numberingForSchool("new-school", "AB").preset, "standard")
  assert.equal(ledger.next("E", "199809", standard), "TG199809E001")
  assert.equal(ledger.next("E", "202108", short), "TG2108E001")
  assert.equal(ledger.next("S", "200001", short), "TG0001S001")
  assert.equal(ledger.next("E", "209912", short), "TG9912E001")
  assert.throws(() => ledger.next("E", "199809", short))
  assert.throws(() => ledger.next("E", "210001", short))
  assert.throws(() => ledger.next("E", "000001", standard))
})
check("gaps, hand 030, 999-only, types/months/schools independent", () => {
  for (let n = 1; n <= 27; n++) ledger.register(`TG2109E${String(n).padStart(3, "0")}`, "E", short, "owner-a")
  ledger.register("TG2109E030", "E", short, "owner-a")
  assert.equal(ledger.next("E", "202109", short), "TG2109E028")
  ledger.register("TG2109E028", "E", short)
  assert.equal(ledger.next("E", "202109", short), "TG2109E029")
  ledger.register("TG2109E029", "E", short)
  assert.equal(ledger.next("E", "202109", short), "TG2109E031")
  ledger.register("TG2201E999", "E", short)
  assert.equal(ledger.next("E", "202201", short), "TG2201E001")
  assert.equal(ledger.next("S", "202109", short), "TG2109S001")
  assert.equal(ledger.next("E", "202109", { ...short, schoolId: "test-school-b" }), "TG2109E001")
})
check("logical historical claims survive preset changes; owner cannot change", () => {
  assert(ledger.occupied("TG202109E030", "E", standard))
  assert.throws(() => ledger.register("TG202109E030", "E", standard, "other"))
  assert.throws(() => ledger.register("TG2109E030", "E", short, "other"))
  assert.equal(parseNumber("TG9912E001", "E", short).yyyymm, "209912")
})
check("all 999 occupied is exhaustion; no rollover", () => {
  const full = createNumberingLedger()
  for (let n = 1; n <= 999; n++) full.register(`TG2501E${String(n).padStart(3, "0")}`, "E", short)
  assert.throws(() => full.next("E", "202501", short))
})
check("empty dates and names, manual validation, legacy dates preserved", () => {
  assert.equal(numbers.checkPersonNo("  ", "E").status, "empty")
  for (const raw of ["TG2108E000", "TG2113E012", "tg2108e012", "TG2108E012 ", "TG2108S012", "ＴＧ2108E012"]) assert.equal(numbers.checkPersonNo(raw, "E").status, "invalid")
  assert.equal(numbers.checkPersonNo("TG2108E012", "E").status, "valid")
  assert.equal(numbers.checkPersonNo("TG2108E012", "E", "2022-08").monthMismatch, true)
  assert.equal(numbers.yyyymmOf("2021-08"), "202108")
  assert.equal(numbers.yyyymmOf("2021-08-20"), "202108")
  assert.equal(numbers.yyyymmOf("2021-13"), null)
  assert.equal(numbers.yyyymmOf("2021-02-30"), null)
})
check("background optional, partial precision and bounded comparison", () => {
  assert.equal(backgroundError("1998", [{ id: "a", school: "example", graduation: "2014" }], []), "")
  assert.equal(cleanEducation([{ id: "a" }, { id: "b", school: "example" }]).length, 1)
  assert.equal(cleanWork([{ id: "a" }, { id: "b", organization: "example" }]).length, 1)
  assert.equal(workRangeInvalid("2018-09", "2018"), false)
  assert.equal(workRangeInvalid("2018", "2017-12"), true)
  assert(backgroundError("1998-13", [], []))
})
check("education level belongs to each experience and preserves legacy records", () => {
  const education = cleanEducation([{ id: "blank" }, { id: "level-only", educationLevel: " 本科 " }])
  assert.equal(education.length, 1)
  assert.equal(education[0].educationLevel, "本科")
  const legacy = educationExperiencesOf({ id: "legacy", educationLevel: "硕士研究生", educationExperiences: [{ id: "past", school: "原型大学" }] })
  assert.equal(legacy.length, 2)
  assert.equal(legacy[0].school, "原型大学")
  assert.equal(legacy[1].educationLevel, "硕士研究生")
  assert.deepEqual(educationExperiencesOf({ id: "legacy", educationLevel: "硕士研究生", educationExperiences: legacy }), legacy)
})
async function filePlan(rows, csv = false) {
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "11_教职工")
  const bytes = csv ? XLSX.utils.sheet_to_csv(sheet) : XLSX.write(book, { type: "buffer", bookType: "xlsx" })
  const file = await parseFile(new File([bytes], csv ? "staff.csv" : "staff.xlsx"))
  return { file, plan: buildPlan({ file, sheetState: defaultSheetState(file), overrides: {}, excluded: [] }) }
}
;(async () => {
  const missing = await filePlan([{ 人员标识: "MIN1", 姓名: "文件示例空值" }], true)
  check("real CSV bytes; optional columns absent do not block", () => {
    assert.equal(missing.file.fileType, "csv")
    assert.equal(missing.plan.totals.block, 0)
    assert(missing.plan.sheets.length, JSON.stringify(missing.file.sheets.map((sheet) => ({ code: sheet.code, headers: sheet.headers, empty: sheet.empty }))))
    assert.equal(missing.plan.sheets[0].rows[0].numberPreview, undefined)
  })
  const mixed = await filePlan([
    { 人员标识: "AUTO", 姓名: "文件示例自动", 首次入职年月: "2021-08", 编号方式: "自动生成", 员工编号: "", 首次参加工作时间: "1998", 英文名: "Morgan", 毕业学校: "原型大学", 毕业时间: "2014" },
    { 人员标识: "MANUAL", 姓名: "文件示例手工", 首次入职年月: "", 编号方式: "手工填写", 员工编号: "TG2108E001" },
    { 人员标识: "NONE", 姓名: "文件示例待编号", 首次入职年月: "", 编号方式: "", 员工编号: "" },
  ])
  check("real XLSX bytes: mixed auto/manual/none; no preview claims", () => {
    assert.equal(mixed.file.fileType, "xlsx")
    assert.equal(mixed.plan.totals.block, 0)
    assert.equal(mixed.plan.sheets[0].rows[0].numberPreview, "TG2108E002")
    assert.equal(numbers.isIssued("TG2108E002", "E"), false)
    assert.equal(mixed.plan.sheets[0].rows[0].values.firstWorkAt, "1998")
  })
  check("unauthorized submit rejected without claims", () => {
    assert.throws(() => commitPeople(mixed.plan, "deny", false))
    assert.equal(numbers.isIssued("TG2108E001", "E"), false)
  })
  check("shared import receipt creates three stable staff, background not used for numbers", () => {
    const before = getStaffList().length
    commitPeople(mixed.plan, "test-batch", true)
    assert.equal(getStaffList().length, before + 3)
    const person = getStaffList().find((staff) => staff.id === "import-test-batch-11-AUTO")
    assert.equal(person.employeeNo, "TG2108E002")
    assert.equal(person.firstWorkAt, "1998")
    assert.equal(person.englishName, "Morgan")
    assert.equal(person.educationExperiences[0].graduation, "2014")
    assert.equal(getStaffList().find((staff) => staff.id.endsWith("-NONE")).employeeNo, "")
    assert.equal(getStaffList().find((staff) => staff.id.endsWith("-MANUAL")).joinedAt, undefined)
  })
  check("same batch retry does not recreate or issue again", () => {
    const before = getStaffList().length
    const first = commitPeople(mixed.plan, "test-batch", true)
    const second = commitPeople(mixed.plan, "test-batch", true)
    assert.deepEqual(first, second)
    assert.equal(getStaffList().length, before)
    assert.equal(numbers.nextPersonNo("E", "202108"), "TG2108E003")
  })
  check("ordinary patch, clearing and history do not resign or lose internal ID", () => {
    const id = "import-test-batch-11-AUTO"
    updateStaff(id, { joinedAt: "1998-09-18", birthplace: "广东深圳", educationExperiences: [{ id: "new", educationLevel: "本科" }], employeeNo: "" }, "清空工号")
    const person = getStaffList().find((staff) => staff.id === id)
    assert.equal(person.id, id)
    assert.equal(person.status, "active")
    assert.equal(person.englishName, "Morgan")
    assert.equal(person.joinedAt, "1998-09-18")
    assert.equal(person.birthplace, "广东深圳")
    assert.equal(person.educationExperiences[0].educationLevel, "本科")
    assert.equal(numbers.isIssued("TG2108E002", "E"), true)
    assert(numbers.historicalNumbers(id).includes("TG2108E002"))
  })
  const wrong = await filePlan([{ 人员标识: "BAD", 姓名: "错误自动示例", 首次参加工作年月: "1998", 毕业时间: "2014", 编号方式: "自动生成" }])
  check("first work / graduation cannot substitute school start; atomic failure", () => {
    assert(wrong.plan.totals.block > 0)
    const before = getStaffList().length
    assert.throws(() => commitPeople(wrong.plan, "bad-batch", true))
    assert.equal(getStaffList().length, before)
  })
  const duplicate = await filePlan([{ 人员标识: "D1", 姓名: "重复1", 员工编号: "TG2202E030" }, { 人员标识: "D2", 姓名: "重复2", 员工编号: "TG2202E030" }])
  check("duplicates flag every involved row", () => assert(duplicate.plan.sheets[0].rows.every((row) => row.issues.some((issue) => issue.title === "本文件内编号重复"))))
  const legacy = await filePlan([{ 人员标识: "OLD", 姓名: "历史表头", 首次正式入职日期: "2014-06-18", 特长: "ignored" }])
  check("legacy date column remains mapped; specialty is ignored", () => {
    assert.equal(legacy.plan.sheets[0].rows[0].values.firstDate, "2014-06-18")
    assert(legacy.file.sheets[0].unknownCols.includes("特长"))
    assert.equal(legacy.plan.totals.block, 0)
  })
  const { SHEET, PRESETS, dependsOn, TEMPLATE_VERSION } = require("../lib/import/schema.ts")
  const { buildTemplateBytes, buildWorkbookBytes } = require("../lib/import/workbook-out.ts")
  const appointmentData = {
    "18": [{ id: "HEAD-DIRECT", staff: "@existing:T-EMP-1", klass: "@existing:T-AC-10-1", role: "主", start: "2026-09-01" }],
    "23": [{ id: "TEACH-DIRECT", staff: "@existing:T-EMP-1", tc: "@existing:T-TC-MATH-A", target: "整科", work: "主讲", start: "2026-09-01" }],
    "24": [{ id: "MANAGE-DIRECT", staff: "@existing:T-EMP-1", duty: "课表维护", target: "学校", targetRef: "标准教务配置", start: "2026-09-01" }],
  }
  const relationPlan = async bytes => {
    const file = await parseFile(new File([bytes], "appointments.xlsx"))
    return { file, plan: buildPlan({ file, sheetState: defaultSheetState(file), overrides: {}, excluded: [] }) }
  }
  check("new templates retire qualifications without adding a prerequisite to any appointment", () => {
    assert.equal(SHEET["12"].role, "meta")
    assert.equal(SHEET["12"].fields.length, 0)
    for (const code of ["18", "23", "24"]) {
      assert.equal(dependsOn(code).includes("12"), false)
      assert.equal(SHEET[code].fields.some(field => field.key === "qual"), false)
    }
    const book = XLSX.read(buildTemplateBytes(PRESETS.find(preset => preset.id === "full").sheets), { type: "array" })
    assert.equal(book.SheetNames.includes("12_任职资格"), false)
    for (const name of ["18_班主任任命", "23_任教安排", "24_管理委派"]) {
      assert.equal(XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1 })[0].some(label => /资格/.test(label)), false)
    }
  })
  const directBytes = buildWorkbookBytes(appointmentData, "无前置资格的任命回归测试")
  const direct = await relationPlan(directBytes)
  check("real XLSX appointments without a qualification column have no qualification blocks or pending checks", () => {
    assert.equal(direct.file.version, TEMPLATE_VERSION)
    assert.equal(direct.plan.sheets.length, 3)
    assert.equal(direct.plan.totals.block, 0)
    for (const sheet of direct.plan.sheets) {
      assert.equal(sheet.parsed.missingRequired.length, 0)
      assert.equal("qual" in sheet.rows[0].values, false)
      assert.equal(sheet.rows.flatMap(row => row.issues).some(issue => /资格/.test(issue.title) || issue.refSheet === "12"), false)
    }
    assert(direct.plan.sheets.some(sheet => sheet.rows.some(row => row.issues.some(issue => /办理权限|委派权限/.test(issue.title)))))
  })
  const oldBook = XLSX.read(directBytes, { type: "array" })
  XLSX.utils.sheet_add_aoa(oldBook.Sheets["00_使用说明"], [["模板版本", "WFB-IMPORT-PROTO-1.1"]], { origin: "A2" })
  XLSX.utils.book_append_sheet(oldBook, XLSX.utils.json_to_sheet([{ 资格标识: "Q-OLD", 员工引用: "OTHER-EMPLOYEE", 资格类型: "已停用类型", 起始日期: "not-a-date" }]), "12_任职资格")
  XLSX.utils.sheet_add_aoa(oldBook.Sheets["18_班主任任命"], [["资格引用"], ["Q-MISSING"]], { origin: "H1" })
  XLSX.utils.sheet_add_aoa(oldBook.Sheets["23_任教安排"], [["资格引用"], ["Q-OLD"]], { origin: "J1" })
  const old = await relationPlan(XLSX.write(oldBook, { type: "array", bookType: "xlsx" }))
  check("legacy 1.1 qualification sheets and stale references are ignored without blocking appointments", () => {
    assert.equal(old.file.versionStatus, "ok")
    assert(old.plan.metaSheets.some(sheet => sheet.code === "12"))
    assert.equal(old.plan.sheets.some(sheet => sheet.code === "12"), false)
    assert.equal(old.plan.totals.block, 0)
    for (const sheet of old.plan.sheets) {
      assert.equal("qual" in sheet.rows[0].values, false)
      assert.equal(sheet.rows.flatMap(row => row.issues).some(issue => issue.refSheet === "12"), false)
    }
  })
  const duplicateHeads = await relationPlan(buildWorkbookBytes({ "18": [...appointmentData["18"], { ...appointmentData["18"][0], id: "HEAD-CONFLICT" }] }, "主班主任冲突回归测试"))
  check("removing qualifications does not remove overlapping principal homeroom checks", () => {
    assert(duplicateHeads.plan.sheets[0].rows.some(row => row.issues.some(issue => issue.title === "主班主任冲突" && issue.level === "block")))
  })
  const wrongDivision = await relationPlan(buildWorkbookBytes({
    "21": [{ id: "DIV-OTHER", tc: "OTHER-CLASS", name: "其他班分工", mode: "INHERIT" }],
    "23": [{ ...appointmentData["23"][0], target: "分工", div: "DIV-OTHER" }],
  }, "教学目标归属回归测试"))
  check("removing qualifications does not allow assignments to a division in another class", () => {
    assert(wrongDivision.plan.sheets.find(sheet => sheet.code === "23").rows[0].issues.some(issue => issue.title === "分工不属于该教学班" && issue.level === "block"))
  })
  console.log(`${checks} checks passed`)
})().catch((error) => { console.error(error); process.exitCode = 1 })
