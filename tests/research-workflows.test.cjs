const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const test = require("node:test")
const ts = require("typescript")

const root = path.resolve(__dirname, "..")
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args)
}
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, file)
}
require.extensions[".css"] = () => {}
const data = new Map()
const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
global.window = { localStorage: storage, sessionStorage: storage, addEventListener() {}, removeEventListener() {} }

const model = require("../lib/research/model.ts")
const { researchSeed } = require("../lib/research/seed.ts")
const { applyResearchCommand } = require("../lib/research/commands.ts")
const dutyModel = require("../lib/school/duty-model.ts")
const { STAFF, DEPARTMENTS } = require("../lib/demo/staff.ts")
const { migrateResearch, schoolPeriodMinutes } = require("../lib/research/store.ts")
const { catalogSeed } = require("../lib/school/catalog-store.ts")
const { freshBiz } = require("../lib/mt/store.tsx")
const { permittedTasks } = require("../lib/mt/derive.ts")
const { lessonsOfWeek, dateOfClock, weekOfDate, setScheduleSource } = require("../lib/mt/model.ts")
const { BASELINE_TEMPLATES, PERIODS, projectWeek } = require("../lib/timetable/data.ts")
setScheduleSource((weekStart, teacher = "TEACHER_LYNN") => {
  const id = teacher === "TEACHER_LYNN" ? "lin" : teacher
  const entries = projectWeek(BASELINE_TEMPLATES[id] ?? [], weekStart, id, "personal")
  return { status: "ok", lessons: entries.filter(entry => entry.taskId).map(entry => {
    const period = PERIODS.find(item => item.id === entry.periodId)
    return { key: entry.key, taskId: entry.taskId, date: entry.date, periodNo: period.no, start: period.start, end: period.end, room: entry.room }
  }) }
})
const { applyHwPatch, writeBlock } = require("../lib/mt/hw.ts")
const { adoptResearchPlan, confirmTeachingContent, isTeachingActor, mapTeachingDates } = require("../lib/research/teaching.ts")
const { prepareHomeworkQuestions, validatePreparedQuestions, homeworkQuestionInstructions, preparedQuestionReadable } = require("../lib/research/homework.ts")
const { copyCriterionToScheme, bindTestConversion, bindQuestionScoringBasis, testConversionReference } = require("../lib/research/evaluation.ts")

const actor = (staff = "u-lin", date = "2026-09-30") => ({ staff, date, enabled: true })
const seed = () => researchSeed(schoolPeriodMinutes())
const documentOf = (state, id) => state.documents.find(document => document.id === id)
const command = (state, action, staff = "u-lin", online = () => true) => applyResearchCommand(state, actor(staff), action, structuredClone(catalogSeed), online)
const dutyCommand = (state, action, staff = "u-lin", date = actor().date, people = STAFF) => {
  const duties = dutyModel.applyStaffDutyCommand({ schema: 1, assignments: state.staffDuties, groups: state.groups }, actor(staff, date), action, people)
  return { ...state, staffDuties: duties.assignments, groups: duties.groups }
}
const ownMathTasks = biz => permittedTasks(biz, "TEACHER_LYNN").filter(task => model.dutyUnitMap[task.duty_id] === "U101")
const success = result => { assert.equal("error" in result, false, result.error); return result }
test("group timetable is shared, leader-only, group-scoped and rejects occupied slots", () => {
  let state = seed()
  const slot = state.groupSchedules.find(s => s.id === "math-tue4")
  assert.equal(state.groupSchedules.filter(s => s.group === "math").length, 4)
  assert.equal(model.canViewGroup(state, actor("u-zhou"), "math"), true)
  assert.throws(() => command(state, { type: "save-group-slot", slot: { ...slot, weekday: 3 } }, "u-zhou"), /组长/)
  assert.throws(() => command(state, { type: "delete-group-slot", id: slot.id }, "u-xu"), /组长/)
  assert.throws(() => command(state, { type: "save-group-slot", slot: { ...slot, periodId: "m5" } }), /已有/)
  state = command(state, { type: "save-group-slot", slot: { ...slot, weekday: 3 } })
  assert.equal(state.groupSchedules.find(s => s.id === slot.id).weekday, 3)
  assert.equal(migrateResearch(JSON.parse(JSON.stringify(state))).groupSchedules.find(s => s.id === slot.id).weekday, 3)
  assert.throws(() => command(state, { type: "save-group-slot", slot: { ...slot, group: "physics" } }), /组长|所属/)
  assert.throws(() => applyResearchCommand(state, actor("u-lin", "2028-01-01"), { type: "delete-group-slot", id: slot.id }, catalogSeed), /组长/)
  state = command(state, { type: "delete-group-slot", id: slot.id })
  assert.equal(state.groupSchedules.some(s => s.id === slot.id), false)
  const workspace = fs.readFileSync(path.join(root, "components/research/workspace.tsx"), "utf8")
  assert.ok(workspace.indexOf("<GroupSchedule") < workspace.indexOf('<nav aria-label="教研工作区内容"'))
  assert.doesNotMatch(fs.readFileSync(path.join(root, "components/research/overview.tsx"), "utf8"), /需要学校支持的事项/)
})

test("research timetable switches one shared projection between daily and period views", () => {
  const schedule = fs.readFileSync(path.join(root, "components/research/group-schedule.tsx"), "utf8")
  const days = fs.readFileSync(path.join(root, "components/research/schedule-days.tsx"), "utf8")
  const grid = fs.readFileSync(path.join(root, "components/timetable/week-grid.tsx"), "utf8")
  assert.match(schedule, /useState<"days" \| "periods">\("days"\)/)
  assert.match(schedule, /<ToggleGroup[^>]*value=\{\[view\]\}/)
  assert.match(schedule, /setView\(canEdit \? "days" : "periods"\)/)
  assert.match(schedule, /\{view === "periods" \? <section[\s\S]*<WeekGrid[\s\S]*<\/section> : <section[\s\S]*<ScheduleDays/)
  assert.match(schedule, /data-testid="research-period-grid"/)
  assert.match(schedule, /entries=\{entries\} compact canonical editing=\{canEdit\}/)
  assert.match(schedule, /<ScheduleDays group=\{group\} week=\{week\} entries=\{entries\} \/>/)
  assert.match(days, /<WeekGrid[^>]*weekStart=\{week\} entries=\{entries\} compact canonical renderDay=/)
  assert.match(days, /if \(!dayEntries\.length && !tasks\.length\) return null/)
  assert.match(days, /<ClassCard entry=\{merged\} canonical/)
  assert.match(days, /onClick=\{leader \? \(\) => setDate\(dayDate\) : undefined\}/)
  assert.match(days, /t\.group === group && t\.scheduleDate === dayDate/)
  assert.match(days, /owner: actor\.staff/)
  assert.doesNotMatch(days, /当日无教研事项|暂无当天事项|无固定教研课次|事项负责人|<Plus|grid-cols-|const cardClass/)
  assert.match(grid, /data-layout=\{renderDay \? "days" : "periods"\}/)
  assert.match(grid, /renderEntries\.filter\(entry => entry\.date === day\.date\)\.sort/)
  assert.equal((grid.match(/children \?\? inner/g) || []).length, 2)
})

test("rendered daily timetable removes empty cards and follows shared slot moves", () => {
  const { createElement } = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  const { DemoProvider } = require("../lib/demo/store.tsx")
  const { MtProvider } = require("../lib/mt/store.tsx")
  const { TimetableProvider } = require("../lib/timetable/store.tsx")
  const { ScheduleDays } = require("../components/research/schedule-days.tsx")
  const { GroupSchedule } = require("../components/research/group-schedule.tsx")
  const { addDays } = require("../lib/timetable/data.ts")
  const renderUI = child => renderToStaticMarkup(createElement(DemoProvider, null, createElement(MtProvider, null, createElement(TimetableProvider, null, child))))
  const week = "2026-10-12"
  const render = state => renderUI(createElement(ScheduleDays, {
    group: "math", week,
    entries: state.groupSchedules.filter(slot => slot.group === "math").map(slot => ({ key: slot.id, weekday: slot.weekday, date: addDays(week, slot.weekday - 1), periodId: slot.periodId, className: slot.title, subject: "数学", room: slot.room, kind: "activity", teacherId: "research:math" })),
  }))
  const dayHtml = (html, date) => html.split(`data-day="${date}"`)[1].split('data-day="')[0]
  let state = seed()
  const title = state.groupSchedules.find(slot => slot.id === "math-tue4").title
  const before = render(state)
  assert.equal((dayHtml(before, "2026-10-13").match(new RegExp(title, "g")) || []).length, 1)
  assert.match(dayHtml(before, "2026-10-13"), /第4节/)
  assert.match(dayHtml(before, "2026-10-13"), /第5节/)
  for (const date of ["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-17", "2026-10-18"]) {
    assert.doesNotMatch(dayHtml(before, date), /教研日卡|font-semibold|添加事项/)
  }
  for (const id of ["math-tue4", "math-tue5"]) {
    const slot = state.groupSchedules.find(slot => slot.id === id)
    state = command(state, { type: "save-group-slot", slot: { ...slot, weekday: 3 } })
  }
  const after = render(state)
  assert.doesNotMatch(dayHtml(after, "2026-10-13"), /教研日卡|font-semibold/)
  assert.match(dayHtml(after, "2026-10-14"), new RegExp(title))
  assert.match(dayHtml(after, "2026-10-14"), /第4节/)
  assert.match(dayHtml(after, "2026-10-14"), /第5节/)
  assert.doesNotMatch(after, /暂无当天事项|无固定教研课次|事项负责人/)
  const defaultView = renderUI(createElement(GroupSchedule, { group: "math" }))
  assert.match(defaultView, /data-layout="days"/)
  assert.doesNotMatch(defaultView, /data-layout="periods"|data-testid="research-period-grid"/)
})

test("day-card tasks are dated, leader-only and remain shared without repeating next week", () => {
  const task = { ...seed().tasks.find(t => t.group === "math"), id: "day-task", parent: null, schoolTaskId: null, title: "日卡研讨事项", scheduleDate: "2026-10-13", owner: "u-zhou", collaborators: [], submitters: [], mode: "牵头提交", course: "", status: "进行中", outcomes: [] }
  const state = command(seed(), { type: "save-task", task })
  assert.equal(state.tasks.find(t => t.id === task.id).scheduleDate, "2026-10-13")
  assert.equal(migrateResearch(JSON.parse(JSON.stringify(state))).tasks.find(t => t.id === task.id).scheduleDate, "2026-10-13")
  assert.equal(state.tasks.filter(t => t.scheduleDate === "2026-10-20").length, 0)
  assert.equal(model.canViewGroup(state, actor("u-zhou"), task.group), true)
  assert.throws(() => command(seed(), { type: "save-task", task }, "u-zhou"), /组长/)
  assert.throws(() => command(state, { type: "save-task", task: { ...task, owner: "u-zhou", scheduleDate: undefined } }, "u-zhou"), /组长/)
  assert.throws(() => command(seed(), { type: "save-task", task: { ...task, group: "physics" } }), /组长/)
  assert.throws(() => command(seed(), { type: "save-task", task: { ...task, scheduleDate: "2026-02-30" } }), /日期/)
  assert.throws(() => command(seed(), { type: "save-task", task: { ...task, scheduleDate: "not-a-date" } }), /日期/)
})

test("copied lessons preserve content and teaching links without reusing source identity or date", () => {
  const { applyWeekEdits, applyTemplateEdits } = require("../lib/timetable/data.ts")
  const original = BASELINE_TEMPLATES.lin[2]
  const edit = { ...original, id: "copy-edit", key: "copy-new", action: "add", weekday: 2, periodId: "m1", room: original.room, scope: "once", onDate: "2026-10-13", effectiveDate: "2026-10-12", label: "copy", note: "保留备注", noteShow: false, displayMode: "CUSTOM", customLabel: "实验分工" }
  for (const template of [applyWeekEdits([original], [edit], "2026-10-12").template, applyTemplateEdits([original], [edit])]) {
    const copy = template.find(s => s.key === "copy-new")
    assert.equal(copy.taskId, original.taskId)
    assert.equal(copy.className, original.className)
    assert.equal(copy.group, original.group)
    assert.equal(copy.note, "保留备注")
    assert.equal(copy.noteShow, false)
    assert.equal(copy.customLabel, "实验分工")
    assert.equal(template.find(s => s.key === original.key).weekday, original.weekday)
  }
  assert.equal(applyWeekEdits([], [edit], "2026-10-19").template.length, 0)
  const activity = { ...edit, kind: "activity", taskId: undefined }
  assert.equal(applyTemplateEdits([], [activity])[0].kind, "activity")
})

const assignmentFor = (task, questions = []) => ({
  id: "TEST_RESEARCH_HW", taskId: task.id, title: "合成回归测试作业", instructions: "测试正文，不是正式记录", issuedAt: "2026-09-30T12:00:00+08:00", deadline: null,
  recipients: ["TEST_STUDENT_A", "TEST_STUDENT_B"], defaultRequirement: "REQUIRED", requirementOverrides: {}, results: {}, revision: 1, stamp: 1, schemeRevId: "SYS_BASIC4@1", status: "ACTIVE", questionSources: questions,
})

 test("1. research navigation remains available; workspace retains query context and persistent form drafts", () => {
  const { NAV } = require("../lib/demo/nav.ts")
  assert.equal(NAV.some(item => item.href.startsWith("/research")), true)
  let state = command(seed(), { type: "form-draft", key: "overview:math", value: { issueTitle: "尚未提交的协调事项", issueBody: "保留原草稿" } })
  state = command(state, { type: "form-draft", key: "overview:physics", value: { issueTitle: "另一科组独立草稿" } })
  const restored = migrateResearch(JSON.parse(JSON.stringify(state)))
  assert.equal(restored.forms["u-lin|overview:math"].issueTitle, "尚未提交的协调事项")
  assert.equal(restored.forms["u-lin|overview:physics"].issueTitle, "另一科组独立草稿")
  const workspace = fs.readFileSync(path.join(root, "components/research/workspace.tsx"), "utf8")
  assert.match(workspace, /new URLSearchParams\(params\)/)
  assert.match(workspace, /scroll: false/)
  assert.match(workspace, /data-testid="research-workspace"/)
})

test("research staffing uses qualified, enabled, group-scoped duty arrangers, not leaders or viewers", () => {
  const state = seed()
  const assignment = dutyModel.createResearchDuty("duty-permission-test", "u-he", "research_participate", "physics", "2026-09-30")
  const action = { type: "arrange", assignments: [assignment] }
  assert(model.canLeadGroup(state, actor("u-chen"), "physics"))
  for (const staff of ["u-chen", "u-zhou", "u-xu"]) assert.throws(() => dutyCommand(state, action, staff), /安排权|任命权/)
  assert.throws(() => dutyModel.applyStaffDutyCommand({ schema: 1, assignments: state.staffDuties, groups: state.groups }, { ...actor(), enabled: false }, action, STAFF), /账号/)
  assert.throws(() => dutyCommand(state, action, "u-lin", "2028-01-01"), /安排权/)
  const scoped = { ...state, staffDuties: state.staffDuties.filter(duty => duty.type !== "research_manage" || duty.scopeRefs[0].id === "math") }
  assert.throws(() => dutyCommand(scoped, action), /安排权/)
  assert.equal(dutyCommand(state, action).staffDuties.find(duty => duty.id === assignment.id).staffId, "u-he")
  assert.throws(() => command(state, { type: "appointment", appointment: {} }), /停用|安排职责/)
})

test("template, object and tenure share one duty record; ending one group preserves other work and history", () => {
  let state = seed()
  const assignment = dutyModel.createResearchDuty("duty-lifecycle-test", "u-he", "research_participate", "math", "2026-09-30")
  const physics = dutyModel.createResearchDuty("duty-cross-group-test", "u-he", "research_participate", "physics", "2026-09-30")
  const documents = structuredClone(state.documents)
  const original = structuredClone(state.staffDuties)
  state = dutyCommand(state, { type: "arrange", assignments: [assignment, physics] })
  assert.equal(model.membership(state, "u-he", "math", actor().date).type, "research_participate")
  assert.equal(model.canEditGroup(state, actor("u-he"), "math"), false)
  const saved = state.staffDuties.find(duty => duty.id === assignment.id)
  state = dutyCommand(state, { type: "revise", assignment: { ...saved, end: "2027-07-31" }, expected: saved })
  const revised = state.staffDuties.find(duty => duty.id === assignment.id)
  assert.equal(state.staffDuties.filter(duty => duty.id === assignment.id).length, 1)
  assert(revised.history.some(item => item.text.includes("原任期")))
  state = dutyCommand(state, { type: "end", assignment: { ...revised, end: "2026-10-01" }, expected: revised })
  assert(model.canParticipateGroup(state, actor("u-he", "2026-10-01"), "math"))
  assert.equal(model.canViewGroup(state, actor("u-he", "2026-10-02"), "math"), false)
  assert(model.canParticipateGroup(state, actor("u-he", "2026-10-02"), "physics"))
  assert.equal(model.canParticipateGroup(state, actor("u-he", "2026-09-29"), "math"), false)
  assert.deepEqual(state.documents, documents)
  assert.deepEqual(state.staffDuties.filter(duty => ![assignment.id, physics.id].includes(duty.id)), original)
  assert.deepEqual(migrateResearch(JSON.parse(JSON.stringify(state))).staffDuties, state.staffDuties)
})

test("duty dates, unsupported templates, duplicate memberships and overlapping leader terms are rejected", () => {
  const state = seed()
  const assignment = dutyModel.createResearchDuty("duty-validation-test", "u-he", "research_participate", "math", "2026-09-30")
  const arrange = value => dutyCommand(state, { type: "arrange", assignments: [value] })
  for (const start of ["", "2026-02-30", "2026-13-01", "2026-9-01", "0000-01-01", "not-a-date"]) {
    assert.equal(dutyModel.dutyDateValid(start), false)
    assert.throws(() => arrange({ ...assignment, start }), /日期/)
  }
  assert(dutyModel.dutyDateValid("2024-02-29"))
  for (const end of ["", "2026-09-29", "2027-02-29"]) assert.throws(() => arrange({ ...assignment, end }), /日期/)
  assert.throws(() => arrange({ ...assignment, type: "arbitrary_admin" }), /模板/)
  assert.throws(() => arrange({ ...assignment, type: "research_lead" }), /教研组长职责重叠/)
  assert.throws(() => arrange({ ...assignment, type: "research_lead", start: "2027-07-31" }), /教研组长职责重叠/)
  const successor = arrange({ ...assignment, type: "research_lead", start: "2027-08-01" })
  assert.equal(model.membership(successor, "u-he", "math", "2027-07-31"), undefined)
  assert(model.canLeadGroup(successor, actor("u-he", "2027-08-01"), "math"))
  const existing = state.staffDuties.find(duty => duty.id === "app-zhou-math")
  assert.throws(() => dutyCommand(state, { type: "revise", assignment: { ...existing, staffId: "u-he" }, expected: existing }), /修订不能更换/)
  assert.throws(() => dutyCommand(state, { type: "revise", assignment: { ...existing, scopeRefs: [{ kind: "research_group", id: "physics" }] }, expected: existing }), /修订不能更换/)
  assert.throws(() => dutyCommand(state, { type: "arrange", assignments: [{ ...existing, id: "duplicate-member" }] }), /重叠的同类职责/)
})

test("stale duty revisions cannot overwrite newer terms or histories", () => {
  const before = seed()
  const previous = before.staffDuties.find(duty => duty.id === "app-zhou-math")
  const state = dutyCommand(before, { type: "revise", assignment: { ...previous, end: "2027-06-30" }, expected: previous })
  assert.throws(() => dutyCommand(state, { type: "end", assignment: { ...previous, end: "2026-09-30" }, expected: previous }), /其他操作修订/)
  assert.equal(state.staffDuties.find(duty => duty.id === previous.id).end, "2027-06-30")
})

test("duty storage checks live staff, allows offline registration and remains atomic when saving fails", () => {
  const { getResearch, saveResearch } = require("../lib/research/store.ts")
  const { createStaff, getStaffList } = require("../lib/school/staff-store.ts")
  const { getStaffDuties, commitStaffDuty } = require("../lib/school/duty-store.ts")
  const qualified = getStaffList(actor().date).find(person => person.id === "u-he")
  const offline = createStaff({ ...qualified, id: "duty-test-offline-qualified", name: "无账号资格测试教师", employeeNo: "", accountName: undefined, accountStatus: "none", duties: [], history: [] })
  const assignment = dutyModel.createResearchDuty("duty-store-test", offline.id, "research_participate", "physics", "2026-09-30")
  const arrange = value => commitStaffDuty(actor(), { type: "arrange", assignments: [value] }, getStaffList(actor().date))
  assert.match(arrange({ ...assignment, staffId: "missing-staff" }).error, /人员不存在/)
  assert.match(arrange({ ...assignment, staffId: "u-qian" }).error, /离职/)
  assert.match(arrange({ ...assignment, staffId: "u-xu" }).error, /资格/)
  assert.match(arrange({ ...assignment, staffId: "u-wang" }).error, /资格/)
  assert.equal(arrange(assignment).ok, true)
  const registered = getStaffList(actor().date).find(person => person.id === offline.id)
  assert(registered.duties.some(duty => duty.id === assignment.id))
  assert.equal(registered.accountStatus, "none")
  assert.deepEqual(registered.systemRoles, qualified.systemRoles)
  assert.equal(model.canViewGroup(getResearch(), { ...actor(offline.id), enabled: false }, "physics"), false)
  const before = structuredClone(getStaffDuties())
  const saved = before.assignments.find(duty => duty.id === assignment.id)
  const setItem = storage.setItem
  storage.setItem = () => { throw new Error("test quota exceeded") }
  try {
    const result = commitStaffDuty(actor(), { type: "revise", assignment: { ...saved, end: "2027-07-31" }, expected: saved }, getStaffList(actor().date))
    assert.equal(result.ok, false)
    assert.match(result.error, /保存失败/)
    assert.deepEqual(getStaffDuties(), before)
    assert.equal(getResearch().staffDuties, getStaffDuties().assignments)
  } finally { storage.setItem = setItem }
  saveResearch(getResearch())
  const content = JSON.parse(data.get("tgs:research-prototype:v2"))
  for (const field of ["appointments", "grants", "staffDuties", "groups"]) assert.equal(field in content, false)
  const departed = { ...saved, staffId: "u-qian", id: "departed-duty-test" }
  const state = { ...seed(), staffDuties: [...seed().staffDuties, departed] }
  assert.throws(() => dutyCommand(state, { type: "revise", assignment: { ...departed, end: "2027-07-31" }, expected: departed }), /离职/)
  assert(dutyCommand(state, { type: "end", assignment: { ...departed, end: actor().date }, expected: departed }).staffDuties.some(duty => duty.id === departed.id && duty.end === actor().date))
})

test("legacy appointments and school grants migrate once into template-based duties without losing IDs or terms", () => {
  const previous = seed()
  const legacy = { ...previous, schema: 2, appointments: [{ id: "legacy-maintainer", staff: "u-he", group: "physics", role: "维护者", start: "2025-09-01", end: "2026-07-31" }], grants: [{ staff: "u-xu", group: "math", mode: "查看", start: "2026-09-01", end: null }] }
  delete legacy.staffDuties
  delete legacy.groups
  const migrated = migrateResearch(legacy)
  assert.equal(migrated.schema, 3)
  assert.equal("appointments" in migrated, false)
  assert.equal("grants" in migrated, false)
  assert.deepEqual(migrated.documents, previous.documents)
  const duty = migrated.staffDuties.find(row => row.id === "legacy-maintainer")
  assert.equal(duty.type, "research_participate")
  assert.equal(duty.start, "2025-09-01")
  assert.equal(duty.end, "2026-07-31")
  assert.deepEqual(duty.scopeRefs, [{ kind: "research_group", id: "physics" }])
  assert.match(duty.note, /不保留隐式编辑权/)
  assert.equal(model.canViewGroup(migrated, actor("u-he"), "physics"), false)
  assert.equal(model.canEditGroup(migrated, actor("u-xu"), "math"), false)
  assert.equal(model.schoolScopes(migrated, actor("u-xu"), true).length, 0)
  assert.throws(() => dutyModel.migrateLegacyResearchDuties({ appointments: [{}], grants: [] }), /未清空/)
})

test("the shared staff duty entry replaces separate appointment UI and arbitrary membership editing", () => {
  const detail = fs.readFileSync(path.join(root, "components/school/staff-detail-sheet.tsx"), "utf8")
  const arrange = fs.readFileSync(path.join(root, "components/school/duty-arrange-sheet.tsx"), "utf8")
  const form = fs.readFileSync(path.join(root, "components/school/staff-duty-revision-form.tsx"), "utf8")
  assert.doesNotMatch(detail, /value: "appointments"|StaffAppointmentsPanel/)
  assert.equal(fs.existsSync(path.join(root, "components/school/staff-appointment-form.tsx")), false)
  assert.equal(fs.existsSync(path.join(root, "components/school/staff-appointments-panel.tsx")), false)
  assert.match(arrange, /职责模板/)
  assert.match(arrange, /dutyContext.command\(\{ type: "arrange", assignments: researchAssignments \}\)/)
  assert.match(form, /expected: previous/)
  assert.match(form, /确认结束职责/)
  assert.match(form, /required checked=\{confirmed\}/)
  assert.doesNotMatch(fs.readFileSync(path.join(root, "components/research/members.tsx"), "utf8"), /type: "appointment"|type: "arrange"/)
})

test("group leaders maintain public assets while participants use resources and submit only their own work", () => {
  let state = seed()
  const teacher = actor("u-zhou")
  const plan = documentOf(state, "plan-demo")
  assert(model.canReadDocument(state, teacher, plan))
  assert.equal(model.canEditDocument(state, teacher, plan), false)
  assert.throws(() => command(state, { type: "save-document", document: { ...plan, notes: "不能改写公共原稿" }, baseVersion: 1 }, "u-zhou"), /修订权限/)
  assert.throws(() => command(state, { type: "criterion", criterion: { ...state.criteria[0], title: "不能改写本组依据" } }, "u-zhou"), /评价依据/)
  const own = model.emptyDocument("participant-personal-test", "计划", "我的调整版", "u-zhou", "u-zhou", "C101", 40)
  state = command(state, { type: "create-document", document: own }, "u-zhou")
  assert(model.canEditDocument(state, teacher, documentOf(state, own.id)))
  const task = { ...state.tasks.find(t => t.group === "math"), id: "participant-task-test", owner: "u-zhou", parent: null, schoolTaskId: null, status: "进行中", mode: "牵头提交", collaborators: [], submitters: [] }
  state = command(state, { type: "save-task", task })
  assert.throws(() => command(state, { type: "save-task", task: { ...task, owner: "u-lin" } }, "u-zhou"), /分工/)
  state = command(state, { type: "discussion", discussion: { id: "participant-feedback-test", target: `task:${task.id}`, author: "u-zhou", body: "本人分工反馈", at: actor().date } }, "u-zhou")
  state = command(state, { type: "submit-task", id: task.id, outcome: { id: "participant-outcome-test", kind: "document", entityId: own.id, version: 1, title: own.title, submittedBy: "u-zhou", submittedAt: actor().date } }, "u-zhou")
  assert.equal(state.tasks.find(t => t.id === task.id).outcomes[0].submittedBy, "u-zhou")
  assert.equal(model.canEditDocument(state, actor("u-chen"), plan), false)
  assert.equal(model.canReadDocument(state, teacher, documentOf(state, "answers-demo")), false)
})

test("flat responsibility objects keep stable references through renaming and disabling without creating departments", () => {
  let state = seed()
  assert.deepEqual(DEPARTMENTS, ["校长室", "办公室", "教学部", "教务部", "学生部", "后勤部"])
  assert(state.groups.every(group => group.kind === "research_group" && group.department === "教学部"))
  const original = state.groups.find(group => group.id === "math")
  const assignments = structuredClone(state.staffDuties)
  state = dutyCommand(state, { type: "save-group", group: { ...original, name: "数学与建模教研组" }, expected: original })
  assert.deepEqual(state.staffDuties, assignments)
  assert(model.canLeadGroup(state, actor(), "math"))
  const renamed = state.groups.find(group => group.id === "math")
  state = dutyCommand(state, { type: "save-group", group: { ...renamed, active: false }, expected: renamed })
  assert.equal(model.canViewGroup(state, actor(), "math"), false)
  assert(model.canParticipateGroup(state, actor(), "physics"))
  assert.deepEqual(state.staffDuties, assignments)
  assert.throws(() => dutyCommand(seed(), { type: "save-group", group: original, expected: original }, "u-chen"), /有权人员/)
})

 test("disabled responsibility objects permit scoped duty endings without new grants or qualification bypasses", () => {
  const initial = seed()
  const state = { ...initial, groups: initial.groups.map(group => group.id === "math" ? { ...group, active: false } : group) }
  const dutyState = { schema: 1, assignments: state.staffDuties, groups: state.groups }
  const member = state.staffDuties.find(duty => duty.id === "app-zhou-math")
  const ending = { type: "end", assignment: { ...member, end: actor().date }, expected: member }
  assert.equal(dutyModel.manageableResearchGroups(dutyState, STAFF, actor()).includes("math"), false)
  assert(dutyModel.manageableResearchGroups(dutyState, STAFF, actor(), member.type, true).includes("math"))
  const ended = dutyCommand(state, ending)
  assert.equal(ended.staffDuties.find(duty => duty.id === member.id).end, actor().date)
  assert.deepEqual(ended.documents, state.documents)
  assert.equal(model.canViewGroup(ended, actor("u-zhou"), "math"), false)
  assert.throws(() => dutyCommand(state, { type: "revise", assignment: { ...member, end: "2027-06-30" }, expected: member }), /安排权/)
  const unqualified = STAFF.map(person => person.id === "u-lin" ? { ...person, systemRoles: person.systemRoles.filter(role => role !== "TEACHING_MANAGER") } : person)
  assert.throws(() => dutyCommand(state, ending, "u-lin", actor().date, unqualified), /安排权/)
  const grant = state.staffDuties.find(duty => duty.id === "grant-xu-math")
  const endGrant = { type: "end", assignment: { ...grant, end: actor().date }, expected: grant }
  assert.throws(() => dutyCommand(state, endGrant), /安排权/)
  assert.equal(dutyCommand(state, endGrant, "u-zhao").staffDuties.find(duty => duty.id === grant.id).end, actor().date)
})

test("2. effective appointments, independent multi-group duties, no-timetable leader, expired and scoped school viewer", () => {
  const state = seed()
  assert(model.canLeadGroup(state, actor(), "math"))
  assert(model.canParticipateGroup(state, actor(), "physics"))
  assert.equal(model.canEditGroup(state, actor(), "physics"), false)
  assert.equal(model.canLeadGroup(state, actor(), "physics"), false)
  assert(model.canLeadGroup(state, actor("u-chen"), "physics"))
  assert.equal(isTeachingActor(actor("u-chen"), null), false)
  assert.equal(model.canViewGroup(state, actor("u-zhou"), "physics"), false)
  assert.equal(model.canViewGroup(state, actor("u-zhou", "2028-08-01"), "physics"), false)
  assert(model.canViewGroup(state, actor("u-xu"), "math"))
  assert.equal(model.canViewGroup(state, actor("u-xu"), "physics"), false)
  assert.equal(model.canEditGroup(state, actor("u-xu"), "math"), false)
  assert.equal(model.membership(state, "u-xu", "math", actor().date), undefined)
  assert.equal(model.canReadDocument(state, actor("u-xu"), documentOf(state, "answers-demo")), false)
})

 test("3. same-name units stay course-scoped; whole-course documents create no default unit or catalogue course", () => {
  const state = seed()
  const syllabus = documentOf(state, "syllabus-demo")
  const invalid = { ...syllabus, unitIds: ["U104"], course: "C201" }
  assert.equal(model.scopeValid(invalid, catalogSeed), false)
  const whole = model.emptyDocument("whole-syllabus-test", "大纲", "整科空白大纲", "math", "u-lin", "C101", null)
  assert(model.scopeValid(whole, catalogSeed))
  const before = JSON.stringify(catalogSeed)
  const next = command(state, { type: "create-document", document: whole })
  assert.deepEqual(documentOf(next, whole.id).unitIds, [])
  assert.equal(JSON.stringify(catalogSeed), before)
  const task = ownMathTasks(freshBiz("BASE"))[0]
  assert(task)
  assert.equal(model.taskCompatible(syllabus, { ...task, duty_id: "DUTY_G2_S1" }), false)
  assert.equal(model.taskCompatible(syllabus, { ...task, course_id: "COURSE_MATH_OTHER" }), false)
  const wrongItem = { ...whole, id: "wrong-item-course", items: [{ ...model.emptyItem("wrong-unit"), unitIds: ["U201"] }] }
  assert.throws(() => command(state, { type: "create-document", document: wrongItem }), /课程|单元/)
})

 test("4. readable syllabus maths and long Notes survive supplement edits, partial selection and stale-version failure", () => {
  let state = seed()
  const original = documentOf(state, "syllabus-demo")
  const requirement = original.items.find(item => item.id === "r1")
  assert.match(model.itemText(requirement), /\$\$y=a/)
  assert.match(model.itemText(requirement), /Notes/)
  assert(requirement.notes.length > 70)
  assert.equal(original.paths[0].weights[original.assessments[0].id], null)
  const copy = model.copyDocument(state, actor(), original, "selected-plan-test", "计划", ["r1"])
  assert.equal(copy.items.length, 1)
  assert.equal(copy.items[0].parentId, null)
  assert.equal(copy.items[0].references.at(-1).itemId, "r1")
  assert.equal(copy.items[0].references.at(-1).version, 1)
  assert.equal(copy.items[0].minutes, null)
  const edited = structuredClone(original)
  edited.items.find(item => item.id === "r1").supplement = "新的教师补充，原要求保留"
  state = command(state, { type: "draft-document", document: edited, baseVersion: 1 })
  const draft = state.drafts["u-lin|syllabus-demo"]
  state = command(state, { type: "save-document", document: edited, baseVersion: 1 })
  assert.equal(documentOf(state, "syllabus-demo").items.find(item => item.id === "r1").original, requirement.original)
  assert.equal(state.revisions["syllabus-demo@1"].items.find(item => item.id === "r1").supplement, requirement.supplement)
  assert.throws(() => command(state, { type: "save-document", document: draft.document, baseVersion: 1 }), /新修订/)
})

 test("5. plan budgets distinguish unset and zero; fixed duration, remainder, reserve transfer and overruns are preserved", () => {
  const plan = structuredClone(documentOf(seed(), "plan-demo"))
  assert.equal(model.totals({ ...plan, budget: null }).remainder, null)
  assert.equal(model.totals({ ...plan, budget: 0 }).remainder, -60)
  const preview = model.allocationPreview(plan, plan.items.map(item => item.id), "balance", 0)
  assert.equal(preview.ids.includes("r1"), false)
  const allocated = model.applyAllocation(plan, preview)
  assert.equal(allocated.items.find(item => item.id === "r1").minutes, 40)
  assert.deepEqual(model.totals(allocated), { allocated: 140, reserve: 20, unassignedItems: 0, remainder: 1 })
  const reserve = model.applyAllocation(allocated, model.allocationPreview(allocated, ["r2", "r3"], "reserve", 19))
  assert.equal(reserve.reserve, 2)
  assert.equal(model.totals(reserve).allocated, 158)
  assert.equal(model.totals(reserve).remainder, 1)
  const over = model.applyAllocation(allocated, model.allocationPreview(allocated, ["r2", "r3"], "same", 100))
  assert.equal(model.totals(over).remainder, -99)
  assert.throws(() => model.allocationPreview(over, ["r2"], "balance", 0), /正余额/)
  assert.throws(() => model.applyAllocation({ ...plan, version: 2 }, preview), /变化/)
  assert.equal(model.totals({ ...allocated, period: 50 }).allocated, model.totals(allocated).allocated)
})

 test("5b. split, move, hierarchy, ordering and relative weeks do not lose source or double-count time", () => {
  const plan = structuredClone(documentOf(seed(), "plan-demo"))
  const before = model.totals(plan)
  let split = model.splitItem(plan, "r1", ["part-a", "part-b"])
  model.validateDocument(split)
  assert.equal(model.totals(split).allocated, before.allocated)
  assert.equal(split.items.find(item => item.id === "r1").minutes, null)
  const parts = split.items.filter(item => item.parentId === "r1")
  assert.equal(parts.reduce((sum, item) => sum + item.weeks.reduce((n, week) => n + week.minutes, 0), 0), 40)
  assert(parts.every(item => item.body && item.references[0].documentId === "syllabus-demo"))
  split = model.moveItem(split, "r2", "r1")
  assert.equal(model.totals(split).allocated, before.allocated)
  assert.throws(() => model.moveItem(split, "r1", "part-a"), /自身/)
  const reordered = model.reorderItem(split, "r3", -1)
  assert.equal(model.totals(reordered).allocated, before.allocated)
  const duplicateTime = structuredClone(split)
  duplicateTime.items.find(item => item.id === "r1").minutes = 40
  assert.throws(() => model.validateDocument(duplicateTime), /汇总父项/)
  const overWeeks = structuredClone(plan)
  overWeeks.items[0].weeks = [{ week: 1, minutes: 41 }]
  assert.throws(() => model.validateDocument(overWeeks), /跨周/)
})

 test("6. personal copy and two teaching-task adoptions remain independent through source revisions", () => {
  let state = seed()
  const plan = documentOf(state, "plan-demo")
  const personal = model.copyDocument(state, actor(), plan, "personal-copy-test")
  personal.items[0].supplement = "仅个人修改"
  assert.notEqual(personal.items[0].supplement, plan.items[0].supplement)
  let biz = freshBiz("BASE")
  const tasks = ownMathTasks(biz)
  assert(tasks.length >= 2)
  for (const [index, task] of tasks.slice(0, 2).entries()) {
    biz = success(adoptResearchPlan(biz, state, actor(), "TEACHER_LYNN", { documentId: plan.id, version: 1, itemIds: ["r1"], taskId: task.id, firstWeek: index + 5, mode: "append", replaceIds: [] }))
  }
  const preserved = JSON.stringify(biz)
  const oldRecords = JSON.stringify(biz.records)
  const oldPublications = JSON.stringify(biz.publications)
  assert.notDeepEqual(biz.plans[tasks[0].id].items.find(item => item.researchSource)?.plannedDates, biz.plans[tasks[1].id].items.find(item => item.researchSource)?.plannedDates)
  const changed = structuredClone(plan)
  changed.items[0].body = "修订来源正文，不能自动传播"
  state = command(state, { type: "save-document", document: changed, baseVersion: 1 })
  assert.equal(JSON.stringify(biz), preserved)
  assert.equal(JSON.stringify(biz.records), oldRecords)
  assert.equal(JSON.stringify(biz.publications), oldPublications)
  assert.equal(biz.researchAdoptions[0].version, 1)
  assert.notEqual(biz.researchAdoptions[0].items[0].body, documentOf(state, plan.id).items[0].body)
  const outside = biz.plans[tasks[0].id].items.find(item => item.researchSource?.documentId !== plan.id)
  if (outside) assert("error" in adoptResearchPlan(biz, state, actor(), "TEACHER_LYNN", { documentId: plan.id, version: 2, itemIds: ["r1"], taskId: tasks[0].id, firstWeek: 5, mode: "replace", replaceIds: [outside.id] }))
})

 test("7. appointment expiry preserves personal contents, closes internal access and lets a new leader maintain group assets", () => {
  let state = seed()
  state = command(state, { type: "copy-document", id: "retained-plan-test", sourceId: "plan-demo" })
  const personal = documentOf(state, "retained-plan-test")
  const expired = actor("u-lin", "2028-09-01")
  assert.equal(model.canViewGroup(state, expired, "math"), false)
  assert.equal(model.canReadDocument(state, expired, documentOf(state, "plan-demo")), false)
  assert(model.canReadDocument(state, expired, personal))
  assert(personal.items.every(item => model.itemReadable(state, expired, item, personal.owner)))
  const old = state.staffDuties.find(duty => duty.id === "app-lin-math")
  state = dutyCommand(state, { type: "end", assignment: { ...old, end: "2026-09-29" }, expected: old })
  const participant = state.staffDuties.find(duty => duty.id === "app-zhou-math")
  state = dutyCommand(state, { type: "end", assignment: { ...participant, end: "2026-09-29" }, expected: participant })
  state = dutyCommand(state, { type: "arrange", assignments: [dutyModel.createResearchDuty("new-leader-test", "u-zhou", "research_lead", "math", "2026-09-30")] })
  assert(model.canLeadGroup(state, actor("u-zhou"), "math"))
  assert(model.canEditDocument(state, actor("u-zhou"), documentOf(state, "plan-demo")))
  const edited = { ...documentOf(state, "plan-demo"), notes: "新负责人接续维护" }
  state = command(state, { type: "save-document", document: edited, baseVersion: 1 }, "u-zhou")
  assert.equal(documentOf(state, "plan-demo").author, "u-lin")
  assert.equal(documentOf(state, "retained-plan-test").version, 1)
})

 test("8. multi-source questions retain page offsets, stems, parts and grading; answers and unreleased papers remain restricted", () => {
  const state = seed()
  const task = ownMathTasks(freshBiz("BASE"))[0]
  const questions = prepareHomeworkQuestions(state, actor(), "bundle-demo", 1, ["bundle-1", "bundle-2"], task)
  assert.equal(questions.length, 2)
  assert.equal(questions[0].printedPage, "8")
  assert.equal(questions[0].filePage, "10")
  assert.equal(questions[0].subquestion, "(a)")
  assert(questions[0].stem)
  assert.equal(questions[0].maxScore, 3)
  assert.equal(questions[1].references[0].documentId, "workbook-demo")
  assert.match(homeworkQuestionInstructions(questions), /共同题干/)
  assert.equal(homeworkQuestionInstructions(questions).includes("2(x-2)^2-3"), false)
  assert.equal(validatePreparedQuestions(state, actor(), task, questions), null)
  assert.equal(model.canReadDocument(state, actor("u-zhou"), documentOf(state, "answers-demo")), false)
  assert.throws(() => model.copyDocument(state, actor(), documentOf(state, "unreleased-demo"), "leak-test"), /受限/)
  assert.throws(() => prepareHomeworkQuestions(state, actor(), "unreleased-demo", 1, ["unreleased-q"], task), /不能合法转交/)
  const shared = documentOf(state, "physics-resource-demo")
  assert(model.canReadDocument(state, actor("u-zhou"), shared))
  assert.equal(model.canViewGroup(state, actor("u-zhou"), "physics"), false)
})

 test("8b. question snapshots require explicit acceptance of updates, never bypass restrictions and reject duplicate or altered scores", () => {
  let state = seed()
  const task = ownMathTasks(freshBiz("BASE"))[0]
  const questions = prepareHomeworkQuestions(state, actor(), "textbook-demo", 1, ["textbook-q1a"], task)
  state = command(state, { type: "save-document", document: { ...documentOf(state, "textbook-demo"), notes: "新版" }, baseVersion: 1 })
  assert.match(validatePreparedQuestions(state, actor(), task, questions), /修订|归档/)
  assert.equal(validatePreparedQuestions(state, actor(), task, questions, true), null)
  assert.match(validatePreparedQuestions(state, actor(), task, [...questions, ...questions], true), /重复/)
  assert.match(validatePreparedQuestions(state, actor(), task, [{ ...questions[0], maxScore: 99 }], true), /不一致/)
  const blocked = structuredClone(state)
  documentOf(blocked, "textbook-demo").restricted = true
  documentOf(blocked, "textbook-demo").share = model.emptyAccess("math")
  assert.match(validatePreparedQuestions(blocked, actor("u-zhou"), task, questions, true), /授权/)
  assert.equal(preparedQuestionReadable(blocked, actor("u-xu"), questions[0]), false)
})

 test("9. two groups accept one school task independently, reference existing outcomes and only explicit acceptance creates review", () => {
  let state = seed()
  const schoolTask = { id: "school-test-2", title: "两组各自承接的合成测试事项", groups: ["math", "physics"], due: "2026-11-01", requirements: "引用已有成果", acceptance: false, createdBy: "u-lin", createdAt: actor().date }
  const groupTasks = schoolTask.groups.map(group => ({ ...state.tasks.find(task => task.group === group), id: `school-test-2-${group}`, schoolTaskId: schoolTask.id, title: schoolTask.title, due: schoolTask.due, requirements: schoolTask.requirements }))
  state = command(state, { type: "school-task", task: schoolTask, groupTasks })
  for (const [group, staff, docId] of [["math", "u-lin", "plan-demo"], ["physics", "u-chen", "physics-plan-demo"]]) {
    const id = `school-test-2-${group}`
    state = command(state, { type: "accept-task", id, owner: staff, collaborators: [], submitters: [], mode: "牵头提交" }, staff)
    assert.equal(state.tasks.find(task => task.id === id).status, "进行中")
    const document = documentOf(state, docId)
    state = command(state, { type: "submit-task", id, outcome: { id: `outcome-${group}`, kind: "document", entityId: document.id, version: document.version, title: document.title, submittedBy: staff, submittedAt: actor().date } }, staff)
    const submitted = state.tasks.find(task => task.id === id)
    assert.equal(submitted.status, "已提交")
    assert.equal(submitted.outcomes[0].document.id, document.id)
    assert.equal(submitted.outcomes[0].version, 1)
    assert.throws(() => command(state, { type: "review-task", id, note: "不应进入验收" }), /无需验收/)
  }
  assert.equal(state.schoolTasks.filter(task => task.id === schoolTask.id).length, 1)
  assert.equal(state.tasks.filter(task => task.schoolTaskId === schoolTask.id).length, 2)
  const parent = { ...state.tasks.find(task => task.id === "task-math"), status: "进行中", owner: "u-lin" }
  const child = { ...parent, id: "test-child", parent: parent.id }
  state = { ...state, tasks: [parent, child] }
  assert.equal(model.ownTodos(state, actor(), "math").length, 1)
  const ordinary = { ...parent, id: "ordinary-test", schoolTaskId: null, parent: null, requirements: "", acceptance: false }
  state = { ...state, tasks: [ordinary] }
  state = command(state, { type: "complete-task", id: ordinary.id })
  assert.equal(state.tasks[0].status, "已完成")
  const review = { ...ordinary, id: "explicit-review-test", status: "进行中", acceptance: true }
  state = command({ ...state, tasks: [review] }, { type: "complete-task", id: review.id })
  assert.equal(state.tasks[0].status, "待验收")
})

 test("9b. collaboration does not turn everyone into a submitter and scope-limited viewers cannot issue tasks", () => {
  let state = seed()
  state = command(state, { type: "accept-task", id: "task-math", owner: "u-lin", collaborators: ["u-zhou"], submitters: [], mode: "牵头提交" })
  const document = documentOf(state, "plan-demo")
  const outcome = { id: "not-collaborator-outcome", kind: "document", entityId: document.id, version: 1, title: document.title, submittedBy: "u-zhou", submittedAt: actor().date }
  assert.throws(() => command(state, { type: "submit-task", id: "task-math", outcome }, "u-zhou"), /协作人/)
  assert.throws(() => command(state, { type: "accept-task", id: "task-physics", owner: "u-lin", collaborators: [], submitters: [], mode: "牵头提交" }), /有效组长/)
  assert.throws(() => command(state, { type: "school-task", task: { ...state.schoolTasks[0], id: "viewer-school-task" }, groupTasks: [] }, "u-xu"), /授权统筹/)
})

 test("10. independent demo does not create student facts; real demonstration uses an existing lesson and offline members get no online receipts", () => {
  let state = seed()
  const biz = freshBiz("BASE")
  const before = JSON.stringify(biz)
  const independent = { ...state.activities[0], id: "independent-test", participants: ["u-lin", "u-wang"], start: "2026-09-30T14:00", end: "2026-09-30T14:40" }
  state = command(state, { type: "save-activity", activity: independent })
  assert.equal(state.activities.find(activity => activity.id === independent.id).lesson, null)
  assert.equal(JSON.stringify(biz), before)
  const task = ownMathTasks(biz)[0]
  const lesson = lessonsOfWeek(biz.variant, 5, [task.id])[0]
  assert(lesson)
  const demonstration = { ...independent, id: "real-demonstration-test", type: "示范课", course: "C101", start: `${lesson.actual_date}T${lesson.period.start}`, end: `${lesson.actual_date}T${lesson.period.end}`, lesson: { taskId: task.id, lessonId: lesson.id, date: lesson.actual_date, period: lesson.period.number, label: lesson.id, room: lesson.room } }
  state = command(state, { type: "save-activity", activity: demonstration })
  assert.equal(state.activities.find(activity => activity.id === demonstration.id).lesson.lessonId, lesson.id)
  assert.throws(() => command(state, { type: "save-activity", activity: { ...demonstration, id: "invented-lesson-test", lesson: { ...demonstration.lesson, lessonId: "NOT_AN_EXISTING_LESSON" } } }), /课次不存在/)
  assert.equal(JSON.stringify(biz), before)
  assert.throws(() => command(state, { type: "save-activity", activity: { ...independent, id: "false-lesson-test", lesson: demonstration.lesson } }), /课堂事实/)
  state = command(state, { type: "notice", notice: { id: "offline-notice-test", group: "math", title: "通知", body: "不伪造无账号成员的送达", recipients: ["u-lin", "u-wang"], requiresAck: false, acknowledged: [], author: "u-lin", at: actor().date } }, "u-lin", staff => staff !== "u-wang")
  assert.deepEqual(state.notices.find(notice => notice.id === "offline-notice-test").recipients, ["u-lin"])
  assert.throws(() => command(state, { type: "ack-notice", id: "offline-notice-test" }), /无需确认/)
})

 test("11. recommended quality standards require a personal copy and explicit adoption; revisions never recalculate published records", () => {
  let state = seed()
  const biz = freshBiz("BASE")
  const schemes = JSON.stringify(biz.schemes)
  assert(state.criteria.find(criterion => criterion.id === "criterion-classroom").recommended)
  const copied = success(copyCriterionToScheme(biz, state, actor(), "TEACHER_LYNN", "criterion-classroom", 1))
  const rev = copied.biz.schemes.revs[copied.revId]
  assert.equal(rev.researchBasis.dimensions.length, 1)
  assert.equal(rev.levels.find(level => level.code === "A").label, "优秀")
  assert.equal(JSON.stringify(biz.schemes), schemes)
  assert.deepEqual(copied.biz.assignments, biz.assignments)
  assert.deepEqual(copied.biz.records, biz.records)
  assert.deepEqual(copied.biz.publications, biz.publications)
  assert.deepEqual(copied.biz.schemes.bindings, biz.schemes.bindings)
  const criterion = { ...state.criteria.find(criterion => criterion.id === "criterion-classroom"), notes: "新的推荐说明" }
  state = command(state, { type: "criterion", criterion })
  assert.equal(rev.researchBasis.version, 1)
  assert.equal(state.criteria.find(item => item.id === criterion.id).version, 2)
  assert.equal(state.criterionRevisions[`${criterion.id}@1`].version, 1)
  assert.throws(() => model.validateCriterion({ ...criterion, levels: criterion.levels.map(level => level.code === "A" ? { ...level, label: "GPA 4.0" } : level) }), /优秀/)
  assert("error" in copyCriterionToScheme(biz, state, actor("u-xu"), null, criterion.id, 2))
})

 test("11b. test conversion applies only to one assignment and chosen participants; zero and ungraded question scores stay distinct", () => {
  let state = seed()
  let biz = freshBiz("BASE")
  const task = ownMathTasks(biz)[0]
  const questions = prepareHomeworkQuestions(state, actor(), "textbook-demo", 1, ["textbook-q1a"], task)
  const assignment = assignmentFor(task, questions)
  assignment.results.TEST_STUDENT_A = { submission: "SUBMITTED", score: 0 }
  assignment.results.TEST_STUDENT_B = { submission: "SUBMITTED", score: 3 }
  biz = { ...biz, assignments: [...biz.assignments, assignment] }
  const criterion = { ...state.criteria.find(item => item.id === "criterion-test"), source: "合成测试分数线，仅供回归测试", thresholds: [{ minimum: 2, code: "A" }, { minimum: 0, code: "D" }] }
  state = command(state, { type: "criterion", criterion })
  const conversionInput = { criterionId: criterion.id, version: 2, assignmentId: assignment.id, participantIds: ["TEST_STUDENT_A"], confirmed: true }
  const beforePublications = JSON.stringify(biz.publications)
  biz = success(bindTestConversion(biz, state, catalogSeed, actor(), "TEACHER_LYNN", conversionInput))
  const current = biz.assignments.find(item => item.id === assignment.id)
  assert.match(testConversionReference(current, "TEST_STUDENT_A").text, /D/)
  assert.equal(testConversionReference(current, "TEST_STUDENT_B"), null)
  assert.equal(testConversionReference({ ...current, id: "another-assignment" }, "TEST_STUDENT_A"), null)
  assert.equal(JSON.stringify(biz.publications), beforePublications)
  assert.equal(current.results.TEST_STUDENT_A.score, 0)
  assert("error" in bindTestConversion(biz, state, catalogSeed, actor(), "TEACHER_LYNN", { ...conversionInput, participantIds: ["OUTSIDE_ROSTER"] }))
  biz = success(bindQuestionScoringBasis(biz, state, actor(), "TEACHER_LYNN", { criterionId: "criterion-question", version: 1, assignmentId: current.id, questionId: questions[0].id, confirmed: true }))
  const withBasis = biz.assignments.find(item => item.id === current.id)
  assert.equal(withBasis.questionSources[0].scoringBasis.maxScore, 3)
  const context = { nowTs: Date.parse(biz.clock), at: biz.clock }
  const zero = success(applyHwPatch(withBasis, "TEST_STUDENT_A", { questionScores: { [questions[0].id]: 0 } }, context))
  assert.equal(zero.r.questionScores[questions[0].id], 0)
  const graded = { ...withBasis, results: { ...withBasis.results, TEST_STUDENT_A: zero.r } }
  const clear = success(applyHwPatch(graded, "TEST_STUDENT_A", { questionScores: { [questions[0].id]: null } }, context))
  assert.equal(clear.r.questionScores[questions[0].id], null)
  assert("error" in applyHwPatch(withBasis, "TEST_STUDENT_A", { questionScores: { [questions[0].id]: 4 } }, context))
  assert("error" in applyHwPatch({ ...withBasis, results: {} }, "TEST_STUDENT_A", { questionScores: { [questions[0].id]: 0 } }, context))
  assert("error" in applyHwPatch({ ...withBasis, requirementOverrides: { TEST_STUDENT_A: "EXEMPT" } }, "TEST_STUDENT_A", { questionScores: { [questions[0].id]: 0 } }, context))
  const locked = { ...withBasis, deadline: "2026-09-20T12:00:00+08:00" }
  assert(writeBlock(locked, "TEST_STUDENT_A", context.nowTs))
  assert("error" in applyHwPatch(locked, "TEST_STUDENT_A", { questionScores: { [questions[0].id]: 0 } }, context))
})

 test("12. actual teaching can be recorded without preparation, edited explicitly and never overwrite attendance, mastery or feedback drafts", () => {
  const state = seed()
  const original = freshBiz("BASE")
  const task = ownMathTasks(original)[0]
  const lesson = lessonsOfWeek(original.variant, weekOfDate(dateOfClock(original.clock)), [task.id]).find(item => item.endTs < Date.parse(original.clock))
  assert(lesson)
  const biz = { ...original, plans: {}, summaries: { [task.id]: { teaching: "教师已有草稿，不覆盖", learning: "真实观察后填写", text: "", stamp: 1 } } }
  const input = { id: "actual-teaching-test", taskId: task.id, date: lesson.actual_date, title: "手工实际内容", text: "实际讲授的少量内容；不代表学生已掌握", confirmed: true }
  const next = success(confirmTeachingContent(biz, state, actor(), "TEACHER_LYNN", input))
  assert.deepEqual(next.records, biz.records)
  assert.deepEqual(next.summaries, biz.summaries)
  assert.deepEqual(next.publications, biz.publications)
  assert.deepEqual(next.assignments, biz.assignments)
  const key = `${task.id}|${lesson.actual_date}`
  assert.equal(next.teachingContent[key][0].source, null)
  assert("error" in confirmTeachingContent(next, state, actor(), "TEACHER_LYNN", input))
  const edited = success(confirmTeachingContent(next, state, actor(), "TEACHER_LYNN", { ...input, id: "ignored-new-id", editingId: input.id, baseRevision: 1, text: "教师明确修改实际范围" }))
  assert.equal(edited.teachingContent[key][0].revision, 2)
  assert.equal(edited.teachingContent[key].length, 1)
  assert("error" in confirmTeachingContent(edited, state, actor(), "TEACHER_LYNN", { ...input, editingId: input.id, baseRevision: 1 }))
  assert("error" in confirmTeachingContent(biz, state, actor("u-xu"), "TEACHER_LYNN", input))
  const mapping = mapTeachingDates([{ ...model.emptyItem("unmapped"), minutes: 15 }], task, biz.variant, null)
  assert.deepEqual(mapping.unmapped, { dates: [], unmapped: 15 })
})
