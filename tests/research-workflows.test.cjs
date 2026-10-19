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
const storage = { get length() { return data.size }, key: index => [...data.keys()][index] ?? null, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
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
  assert.match(workspace, /tab === "schedule" \? <GroupSchedule/)
  assert.doesNotMatch(fs.readFileSync(path.join(root, "components/research/overview.tsx"), "utf8"), /需要学校支持的事项/)
})

test("dated activity overlaps use actual dates and all periods, without repeating with weekly templates", () => {
  const { activitiesOn, activityOverlaps } = require("../lib/research/workspace-model.ts")
  const state = seed(), original = state.activities.find(a => a.group === "math")
  state.activities = [{ ...original, id: "dated-evening", start: "2026-09-30T19:00", end: "2026-10-01T01:00" }]
  assert.equal(activitiesOn(state, actor(), "math", "2026-09-30").length, 1)
  assert.equal(activitiesOn(state, actor(), "math", "2026-10-01").length, 1)
  assert.equal(activitiesOn(state, actor(), "math", "2026-10-07").length, 0)
  assert(activityOverlaps(state.activities[0], "2026-09-30", "19:20", "20:00"))
  assert.equal(activityOverlaps(state.activities[0], "2026-09-30", "08:00", "08:40"), false)
  assert.equal(activityOverlaps(state.activities[0], "2026-10-01", "01:00", "02:00"), false)
  const { effectiveWithCalendar } = require("../lib/timetable/calendar-store.ts")
  const entry = { key: "slot", date: "2026-09-30", periodId: "e2" }
  const calendar = [{ id: "swap", kind: "swap", date: "2026-09-30", targetDate: "2026-10-01" }]
  const projected = effectiveWithCalendar(calendar, [entry], ["2026-09-30", "2026-10-01"])
  assert(projected.stopped.has("2026-09-30"))
  assert.equal(projected.effective[0].date, "2026-10-01")
  assert.equal(state.activities[0].start, "2026-09-30T19:00")
})

test("rendered daily timetable removes empty cards and follows shared slot moves", () => {
  const { createElement } = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  const { DemoProvider } = require("../lib/demo/store.tsx")
  const { MtProvider } = require("../lib/mt/store.tsx")
  const { TimetableProvider } = require("../lib/timetable/store.tsx")
  const { TeachingProvider } = require("../lib/teaching/store.tsx")
  const { ScheduleDays } = require("../components/research/schedule-days.tsx")
  const { GroupSchedule } = require("../components/research/group-schedule.tsx")
  const { addDays } = require("../lib/timetable/data.ts")
  const renderUI = child => renderToStaticMarkup(createElement(DemoProvider, null, createElement(TeachingProvider, null, createElement(MtProvider, null, createElement(TimetableProvider, null, child)))))
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
  // Native workspace daily/period switching is exercised by the browser acceptance script.
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
  assert.match(fs.readFileSync(path.join(root, "lib/research/navigation.ts"), "utf8"), /new URLSearchParams\(params\)/)
  assert.match(fs.readFileSync(path.join(root, "lib/research/navigation.ts"), "utf8"), /scroll: false/)
  assert.match(workspace, /data-testid="research-workspace"/)
})

test("research staffing uses enabled, group-scoped duty arrangers, not leaders or viewers", () => {
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

test("every research template can be arranged, revised and ended without role qualifications", () => {
  const people = structuredClone(STAFF).map(person => ({ ...person, systemRoles: [] }))
  const before = structuredClone(people)
  const administrator = people.find(person => dutyModel.schoolDutyManager(people, actor(person.id)))
  assert(administrator, "the existing school management duty remains the arranging authority")
  let state = seed()
  for (const type of dutyModel.RESEARCH_DUTY_KEYS) {
    const assignment = dutyModel.createResearchDuty(`no-qualification:${type}`, "u-wang", type, "physics", "2027-08-01")
    state = dutyCommand(state, { type: "arrange", assignments: [assignment] }, administrator.id, actor().date, people)
    const saved = state.staffDuties.find(duty => duty.id === assignment.id)
    state = dutyCommand(state, { type: "revise", assignment: { ...saved, end: "2028-07-31" }, expected: saved }, administrator.id, actor().date, people)
    const revised = state.staffDuties.find(duty => duty.id === assignment.id)
    state = dutyCommand(state, { type: "end", assignment: { ...revised, end: "2027-09-30" }, expected: revised }, administrator.id, actor().date, people)
    assert.equal(state.staffDuties.find(duty => duty.id === assignment.id).end, "2027-09-30")
    assert.equal(state.staffDuties.find(duty => duty.id === assignment.id).history.length, 3)
  }
  assert.deepEqual(people, before, "arranging duties does not grant roles or activate accounts")
  assert.equal(people.find(person => person.id === "u-wang").accountStatus, "none")
})

test("arranging authority comes from effective scoped duties, not system role labels", () => {
  const people = structuredClone(STAFF).map(person => ({ ...person, systemRoles: [] }))
  const state = seed()
  const assignment = dutyModel.createResearchDuty("scope-without-qualification", "u-he", "research_participate", "physics", "2026-09-30")
  const action = { type: "arrange", assignments: [assignment] }
  assert(dutyCommand(state, action, "u-lin", actor().date, people).staffDuties.some(duty => duty.id === assignment.id))
  const outOfScope = { ...state, staffDuties: state.staffDuties.filter(duty => duty.type !== "research_manage" || duty.scopeRefs[0].id === "math") }
  assert.throws(() => dutyCommand(outOfScope, action, "u-lin", actor().date, people), /安排权/)
  assert.throws(() => dutyCommand(state, action, "u-lin", "2028-01-01", people), /安排权/)
  assert.throws(() => dutyCommand(state, { type: "arrange", assignments: [{ ...assignment, type: "research_manage" }] }, "u-lin", actor().date, people), /安排权/)
  const roleOnly = people.map(person => person.id === "u-he" ? { ...person, systemRoles: ["SCHOOL_ADMIN", "TEACHING_MANAGER"] } : person)
  assert.equal(dutyModel.schoolDutyManager(roleOnly, actor("u-he")), false)
  assert.throws(() => dutyCommand(state, action, "u-he", actor().date, roleOnly), /安排权/)
  const disabled = people.map(person => person.id === "u-lin" ? { ...person, accountStatus: "disabled" } : person)
  assert.throws(() => dutyCommand(state, action, "u-lin", actor().date, disabled), /账号/)
})

test("duty template groups are complete business categories without qualification UI", () => {
  const { DUTY_GROUPS, DUTY_TYPES } = require("../lib/demo/staff.ts")
  const grouped = DUTY_GROUPS.flatMap(group => group.duties.map(duty => duty.key))
  assert.equal(new Set(grouped).size, grouped.length)
  assert.deepEqual([...grouped].sort(), DUTY_TYPES.map(duty => duty.key).sort())
  const arrange = fs.readFileSync(path.join(root, "components/school/duty-arrange-sheet.tsx"), "utf8")
  assert.match(arrange, /DUTY_GROUPS/)
  assert.doesNotMatch(arrange, /needsQualification|strictQualification|所需任职资格尚未具备|资格对应的职责|systemRoles\.includes/)
  assert.doesNotMatch(fs.readFileSync(path.join(root, "lib/school/duty-model.ts"), "utf8"), /systemRoles\.includes/)
})

test("staff homepages do not require teaching roles while account and privacy rules remain", () => {
  const { hasTeacherHomepage, homepageAccess, DEFAULT_SETTINGS } = require("../lib/profile/store.tsx")
  const person = { ...STAFF.find(person => person.id === "u-lin"), systemRoles: [] }
  assert.equal(hasTeacherHomepage(person), true)
  assert.equal(hasTeacherHomepage({ ...person, status: "left" }), false)
  for (const accountStatus of ["none", "pending", "disabled", "revoked"]) assert.equal(hasTeacherHomepage({ ...person, accountStatus }), false)
  assert.deepEqual(homepageAccess({ kind: "staff", staffId: "u-chen" }, "u-lin", { ...DEFAULT_SETTINGS, visibility: "self" }), { ok: false, reason: "private" })
  assert.deepEqual(homepageAccess({ kind: "parent" }, "u-lin", DEFAULT_SETTINGS), { ok: false, reason: "not_staff" })
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
  const person = getStaffList(actor().date).find(person => person.id === "u-he")
  const offline = createStaff({ ...person, id: "duty-test-offline-no-roles", name: "无账号无角色测试人员", employeeNo: "", accountName: undefined, accountStatus: "none", systemRoles: [], duties: [], history: [] })
  const assignment = dutyModel.createResearchDuty("duty-store-test", offline.id, "research_participate", "physics", "2026-09-30")
  const arrange = value => commitStaffDuty(actor(), { type: "arrange", assignments: [value] }, getStaffList(actor().date))
  assert.match(arrange({ ...assignment, staffId: "missing-staff" }).error, /人员不存在/)
  assert.match(arrange({ ...assignment, staffId: "u-qian" }).error, /离职/)
  for (const staffId of ["u-xu", "u-wang"]) {
    const before = getStaffList(actor().date).find(person => person.id === staffId)
    const direct = { ...assignment, id: `${assignment.id}:${staffId}`, staffId }
    assert.equal(arrange(direct).ok, true)
    const after = getStaffList(actor().date).find(person => person.id === staffId)
    assert(after.duties.some(duty => duty.id === direct.id))
    assert.deepEqual(after.systemRoles, before.systemRoles)
    assert.equal(after.accountStatus, before.accountStatus)
  }
  assert.equal(arrange(assignment).ok, true)
  const registered = getStaffList(actor().date).find(person => person.id === offline.id)
  assert(registered.duties.some(duty => duty.id === assignment.id))
  assert.equal(registered.accountStatus, "none")
  assert.deepEqual(registered.systemRoles, [])
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
  assert.deepEqual(migrated.documents.filter(d => previous.documents.some(old => old.id === d.id)), previous.documents)
  assert(migrated.documents.some(d => d.id.startsWith("html-paper-")))
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

test("same-group leader and participant duties coexist and can each end independently while live", () => {
  const initial = seed()
  const participant = dutyModel.createResearchDuty("lin-math-participant", "u-lin", "research_participate", "math", "2026-09-01", "2027-07-31")
  const state = dutyCommand(initial, { type: "arrange", assignments: [participant] }, "u-lin", "2026-10-10")
  const leader = state.staffDuties.find(duty => duty.id === "app-lin-math")
  const dutyState = { schema: 1, assignments: state.staffDuties, groups: state.groups }
  assert.equal(dutyModel.validateStaffDutyState(dutyState), dutyState)
  assert.deepEqual(dutyModel.staffDutyConflicts(dutyState, participant), [])
  assert.deepEqual(dutyModel.staffDutyConflicts(dutyState, leader), [])
  for (const previous of [leader, state.staffDuties.find(duty => duty.id === participant.id)]) {
    assert(dutyModel.dutyEffective(previous, "2026-10-10"))
    const ended = dutyCommand(state, { type: "end", assignment: { ...previous, end: "2026-10-10" }, expected: previous }, "u-lin", "2026-10-10")
    const saved = ended.staffDuties.find(duty => duty.id === previous.id)
    assert.equal(saved.end, "2026-10-10")
    assert(dutyModel.dutyEffective(saved, "2026-10-10"))
    assert.equal(dutyModel.dutyEffective(saved, "2026-10-11"), false)
    assert.deepEqual(saved.history.slice(0, -1), previous.history)
    assert.match(saved.history.at(-1).text, /登记结束职责/)
    assert.deepEqual(ended.staffDuties.filter(duty => duty.id !== previous.id), state.staffDuties.filter(duty => duty.id !== previous.id))
    assert.deepEqual(ended.documents, state.documents)
    assert(model.canParticipateGroup(ended, actor("u-lin", "2026-10-11"), "math"))
    assert.equal(model.canLeadGroup(ended, actor("u-lin", "2026-10-11"), "math"), previous.type !== "research_lead")
    assert(model.canParticipateGroup(ended, actor("u-lin", "2026-10-11"), "physics"))
  }
})

test("persisted legacy overlaps do not block ending an active duty or alter any other record", () => {
  const source = seed()
  const leader = source.staffDuties.find(duty => duty.id === "app-lin-math")
  const participant = dutyModel.createResearchDuty("legacy-concurrent-participant", "u-lin", "research_participate", "math", "2026-09-01")
  source.staffDuties.push(participant, { ...structuredClone(leader), id: "legacy-duplicate-leader" })
  const unrelated = source.staffDuties.find(duty => duty.id === "app-zhou-math")
  source.staffDuties.push({ ...structuredClone(unrelated), id: "unrelated-legacy-overlap" })
  const before = structuredClone(source)
  const dutyState = { schema: 1, assignments: source.staffDuties, groups: source.groups }
  assert.equal(dutyModel.validateStaffDutyState(dutyState), dutyState)
  assert.equal(dutyModel.staffDutyValidationError(dutyState, { ...leader, end: "2026-10-10" }, leader, "end"), "")
  const ended = dutyCommand(source, { type: "end", assignment: { ...leader, end: "2026-10-10" }, expected: leader }, "u-lin", "2026-10-10")
  assert.equal(ended.staffDuties.find(duty => duty.id === leader.id).end, "2026-10-10")
  assert.deepEqual(ended.staffDuties.filter(duty => duty.id !== leader.id), before.staffDuties.filter(duty => duty.id !== leader.id))
  assert.deepEqual(source, before)
  assert.throws(() => dutyCommand(source, { type: "arrange", assignments: [{ ...participant, id: "new-same-template-duplicate" }] }), /重叠的同类职责/)
})

test("loading stored coexisting duties preserves every original term and writes no repair", () => {
  const source = dutyModel.staffDutySeed()
  source.assignments.push(dutyModel.createResearchDuty("stored-lin-math-participant", "u-lin", "research_participate", "math", "2026-08-01", "2027-09-30"))
  const raw = JSON.stringify(source)
  withDutyStorage([["tgs:staff-duties-prototype:v1", raw]], store => {
    let writes = 0
    const setItem = storage.setItem
    storage.setItem = (...args) => { writes++; return setItem(...args) }
    assert.deepEqual(store.getStaffDuties(), source)
    assert.equal(data.get(store.STAFF_DUTY_STORAGE_KEY), raw)
    assert.equal(data.has(store.STAFF_DUTY_REPAIR_BACKUP_KEY), false)
    assert.equal(writes, 0)
    const previous = store.getStaffDuties().assignments.find(duty => duty.id === "app-lin-math")
    assert.equal(store.commitStaffDuty(actor("u-lin", "2026-10-10"), { type: "end", assignment: { ...previous, end: "2026-10-10" }, expected: previous }, STAFF).ok, true)
    assert.deepEqual(store.getStaffDuties().assignments.filter(duty => duty.id !== previous.id), source.assignments.filter(duty => duty.id !== previous.id))
  })
})

test("legacy migration preserves concurrent templates, original IDs and every original term", () => {
  const legacy = {
    appointments: [
      { id: "app-lin-math", staff: "u-lin", group: "math", role: "组长", start: "2026-09-01", end: "2027-07-31" },
      { id: "old-lin-math-member", staff: "u-lin", group: "math", role: "成员", start: "2026-10-10", end: null },
      { id: "old-lin-math-leader-copy", staff: "u-lin", group: "math", role: "组长", start: "2026-09-01", end: "2027-07-31" },
      { id: "app-lin-physics", staff: "u-lin", group: "physics", role: "成员", start: "2026-09-01", end: "2027-07-31" },
    ],
    grants: [{ staff: "u-lin", group: "math", mode: "统筹", start: "2026-09-01", end: "2027-07-31" }],
  }
  const before = structuredClone(legacy)
  const assignments = dutyModel.migrateLegacyResearchDuties(legacy)
  const state = { schema: 1, assignments, groups: dutyModel.staffDutySeed().groups }
  assert.deepEqual(legacy, before)
  assert.equal(assignments.length, 5)
  for (const original of legacy.appointments) {
    const saved = assignments.find(duty => duty.id === original.id)
    assert.equal(saved.start, original.start)
    assert.equal(saved.end, original.end ?? undefined)
    assert.equal(saved.history.some(entry => entry.text.includes("修正旧职责")), false)
  }
  assert.deepEqual(dutyModel.staffDutyConflicts(state, assignments.find(duty => duty.id === "old-lin-math-member")), [])
  assert.equal(dutyModel.validateStaffDutyState(state), state)
})

test("persisted duty validation protects record structure without enforcing whole-state exclusivity", () => {
  const state = dutyModel.staffDutySeed()
  const member = dutyModel.createResearchDuty("persisted-math-member", "u-lin", "research_participate", "math", "2026-10-10")
  const concurrent = { ...state, assignments: [...state.assignments, member] }
  assert.equal(dutyModel.validateStaffDutyState(concurrent), concurrent)
  for (const patch of [{ start: "2026-02-30" }, { scopeRefs: [] }, { type: "unknown-duty" }]) {
    assert.throws(() => dutyModel.validateStaffDutyState({ ...state, assignments: [...state.assignments, { ...member, ...patch }] }), /格式无效|未清空/)
  }
  assert.throws(() => dutyModel.validateStaffDutyState({ ...state, assignments: [...state.assignments, state.assignments[0]] }), /格式无效/)
})

test("ending an effective migrated leader preserves participation in the same group and all original histories", () => {
  const assignments = dutyModel.migrateLegacyResearchDuties({
    appointments: [
      { id: "legacy-lin-leader", staff: "u-lin", group: "math", role: "组长", start: "2026-09-01", end: "2027-07-31" },
      { id: "legacy-lin-member", staff: "u-lin", group: "math", role: "成员", start: "2026-10-10", end: null },
    ],
    grants: [{ staff: "u-lin", group: "math", mode: "统筹", start: "2026-09-01", end: "2027-07-31" }],
  })
  const state = { ...seed(), staffDuties: assignments }
  const dutyState = { schema: 1, assignments, groups: state.groups }
  const previous = assignments.find(duty => duty.id === "legacy-lin-leader")
  const ending = { ...previous, end: "2026-10-11" }
  assert.deepEqual(dutyModel.staffDutyConflicts(dutyState, previous), [])
  assert.equal(dutyModel.staffDutyValidationError(dutyState, ending, previous, "end"), "")
  const ended = dutyCommand(state, { type: "end", assignment: ending, expected: previous }, "u-lin", "2026-10-11")
  const saved = ended.staffDuties.find(duty => duty.id === previous.id)
  assert.equal(ended.staffDuties.length, assignments.length)
  assert.equal(saved.end, "2026-10-11")
  assert.deepEqual(saved.history.slice(0, -1), previous.history)
  assert.match(saved.history.at(-1).text, /登记结束职责.*原任期/)
  assert.deepEqual(ended.staffDuties.filter(duty => duty.id !== previous.id), assignments.filter(duty => duty.id !== previous.id))
  assert.deepEqual(ended.documents, state.documents)
  assert(model.canLeadGroup(ended, actor("u-lin", "2026-10-11"), "math"))
  assert.equal(model.canLeadGroup(ended, actor("u-lin", "2026-10-12"), "math"), false)
  assert(model.canParticipateGroup(ended, actor("u-lin", "2026-10-12"), "math"))
  assert.equal(ended.staffDuties.find(duty => duty.id === "legacy-lin-member").start, "2026-10-10")
  const member = ended.staffDuties.find(duty => duty.id === "legacy-lin-member")
  assert.throws(() => dutyCommand(ended, { type: "arrange", assignments: [{ ...member, id: "new-duplicate-member" }] }, "u-lin", "2026-10-11"), /重叠的同类职责/)
})

test("legacy same-template overlaps can be ended individually without silently merging or ending other records", () => {
  const state = seed()
  const previous = state.staffDuties.find(duty => duty.id === "app-zhou-math")
  const duplicate = { ...structuredClone(previous), id: "old-duplicate-zhou-math" }
  state.staffDuties.push(duplicate)
  const ended = dutyCommand(state, { type: "end", assignment: { ...previous, end: "2026-10-11" }, expected: previous }, "u-lin", "2026-10-11")
  assert.equal(ended.staffDuties.length, state.staffDuties.length)
  assert.deepEqual(ended.staffDuties.find(duty => duty.id === duplicate.id), duplicate)
  assert(model.canParticipateGroup(ended, actor("u-zhou", "2026-10-12"), "math"))
  const second = dutyCommand(ended, { type: "end", assignment: { ...duplicate, end: "2026-10-11" }, expected: duplicate }, "u-lin", "2026-10-11")
  assert.equal(model.canViewGroup(second, actor("u-zhou", "2026-10-12"), "math"), false)
  assert.deepEqual(second.staffDuties.filter(duty => ![previous.id, duplicate.id].includes(duty.id)), state.staffDuties.filter(duty => ![previous.id, duplicate.id].includes(duty.id)))
})

test("ending a valid duty enforces immutable identity, valid shorter terms, live permissions and stale checks", () => {
  const state = seed()
  const previous = state.staffDuties.find(duty => duty.id === "app-lin-math")
  const ending = { type: "end", assignment: { ...previous, end: "2026-10-11" }, expected: previous }
  for (const patch of [{ start: "2026-09-02" }, { end: "2028-07-31" }, { end: undefined }]) {
    assert.throws(() => dutyCommand(state, { ...ending, assignment: { ...ending.assignment, ...patch } }, "u-lin", "2026-10-11"), /不能延长|保留开始日期/)
  }
  for (const patch of [{ end: "2026-02-30" }, { end: "2026-08-31" }]) {
    assert.throws(() => dutyCommand(state, { ...ending, assignment: { ...ending.assignment, ...patch } }, "u-lin", "2026-10-11"), /日期/)
  }
  for (const patch of [{ staffId: "u-zhou" }, { type: "research_participate" }, { scopeRefs: [{ kind: "research_group", id: "physics" }] }]) {
    assert.throws(() => dutyCommand(state, { ...ending, assignment: { ...ending.assignment, ...patch } }, "u-lin", "2026-10-11"), /修订不能更换/)
  }
  for (const staff of ["u-chen", "u-zhou", "u-xu"]) assert.throws(() => dutyCommand(state, ending, staff, "2026-10-11"), /安排权/)
  assert.throws(() => dutyCommand(state, { ...ending, expected: { ...previous, end: "2027-06-30" } }, "u-lin", "2026-10-11"), /其他操作修订/)
  const grant = state.staffDuties.find(duty => duty.type === "research_manage" && duty.staffId === "u-lin" && duty.scopeRefs[0].id === "math")
  const endGrant = { type: "end", assignment: { ...grant, end: "2026-10-11" }, expected: grant }
  assert.throws(() => dutyCommand(state, endGrant, "u-lin", "2026-10-11"), /安排权/)
  assert.equal(dutyCommand(state, endGrant, "u-zhao", "2026-10-11").staffDuties.find(duty => duty.id === grant.id).end, "2026-10-11")
})

test("shortening a paused or readonly duty never reactivates it or expands its work mode", () => {
  for (const patch of [{ status: "paused", workMode: "paused" }, { status: "active", workMode: "ro" }, { status: "ended", workMode: "rw" }]) {
    const state = seed()
    const previous = state.staffDuties.find(duty => duty.id === "app-zhou-math")
    Object.assign(previous, patch, { note: "保留原始限制" })
    const ended = dutyCommand(state, { type: "end", assignment: { ...previous, end: "2026-10-11", status: "active", workMode: "rw" }, expected: previous }, "u-lin", "2026-10-11")
    const saved = ended.staffDuties.find(duty => duty.id === previous.id)
    assert.equal(saved.status, previous.status)
    assert.equal(saved.workMode, previous.workMode)
    assert.equal(saved.note, previous.note)
    assert.deepEqual(saved.history.slice(0, -1), previous.history)
  }
})

test("reading concurrent duties never splits terms, creates remainder records or changes history", () => {
  const source = dutyModel.staffDutySeed()
  source.assignments.push(dutyModel.createResearchDuty("member-across-leader-term", "u-lin", "research_participate", "math", "2026-08-01", "2027-09-30"))
  const before = structuredClone(source)
  assert.equal(dutyModel.validateStaffDutyState(source), source)
  assert.deepEqual(source, before)
  assert.equal(source.assignments.some(duty => duty.id.includes(":remainder:")), false)
  for (const duty of source.assignments) assert.deepEqual(dutyModel.staffDutyConflicts(source, duty), [])
})

test("legacy duplicate records retain their independent ended, paused, readonly and shorter-term limits", () => {
  for (const patch of [{ status: "paused", workMode: "paused" }, { status: "active", workMode: "ro" }, { status: "ended", workMode: "rw" }]) {
    const source = dutyModel.staffDutySeed()
    const canonical = source.assignments.find(duty => duty.id === "app-zhou-math")
    const limited = { ...structuredClone(canonical), ...patch, id: "limited-duplicate-member", end: "2026-10-11", history: [{ date: "2026-10-11", text: "登记结束职责 · 原任期已缩短" }] }
    source.assignments.push(limited)
    const before = structuredClone(source)
    assert.equal(dutyModel.validateStaffDutyState(source), source)
    assert.deepEqual(source, before)
    const ended = dutyModel.applyStaffDutyCommand(source, actor("u-lin", "2026-10-11"), { type: "end", assignment: { ...canonical, end: "2026-10-11" }, expected: canonical }, STAFF)
    assert.deepEqual(ended.assignments.find(duty => duty.id === limited.id), limited)
    assert.equal(model.canViewGroup({ ...seed(), staffDuties: ended.assignments }, actor("u-zhou", "2026-10-12"), "math"), false)
  }
})

test("legacy competing leaders can be ended without choosing a new holder or allowing new duplicate appointments", () => {
  const source = dutyModel.staffDutySeed()
  const leader = source.assignments.find(duty => duty.id === "app-lin-math")
  const other = dutyModel.createResearchDuty("legacy-other-math-leader", "u-he", "research_lead", "math", "2026-10-01")
  source.assignments.push(other)
  const before = structuredClone(source)
  const ended = dutyModel.applyStaffDutyCommand(source, actor("u-lin", "2026-10-11"), { type: "end", assignment: { ...leader, end: "2026-10-11" }, expected: leader }, STAFF)
  assert.deepEqual(source, before)
  assert.deepEqual(ended.assignments.find(duty => duty.id === other.id), other)
  assert.throws(() => dutyModel.applyStaffDutyCommand(source, actor("u-lin", "2026-10-11"), { type: "arrange", assignments: [{ ...other, id: "new-competing-leader" }] }, STAFF), /教研组长职责重叠/)
})

function withDutyStorage(entries, run) {
  const file = require.resolve("../lib/school/duty-store.ts")
  const cached = require.cache[file]
  const original = new Map(data)
  const setItem = storage.setItem
  data.clear()
  for (const [key, value] of entries) data.set(key, value)
  delete require.cache[file]
  try { run(require(file)) }
  finally {
    data.clear()
    for (const [key, value] of original) data.set(key, value)
    storage.setItem = setItem
    if (cached) require.cache[file] = cached
    else delete require.cache[file]
  }
}

test("stored legacy overlaps are preserved rather than automatically merged or backed up as errors", () => {
  const source = dutyModel.staffDutySeed()
  const original = source.assignments.find(duty => duty.id === "app-zhou-math")
  const duplicate = { ...structuredClone(original), id: "persisted-zhou-duplicate" }
  source.assignments.push(duplicate)
  const raw = JSON.stringify(source)
  withDutyStorage([["tgs:staff-duties-prototype:v1", raw], ["tgs:staff-duties-prototype:v1:before-overlap-repair", raw]], store => {
    assert.deepEqual(store.getStaffDuties(), source)
    assert.equal(data.get(store.STAFF_DUTY_STORAGE_KEY), raw)
    assert.equal(data.has(store.STAFF_DUTY_COEXISTENCE_BACKUP_KEY), false)
    const previous = store.getStaffDuties().assignments.find(duty => duty.id === original.id)
    assert.equal(store.commitStaffDuty(actor(), { type: "end", assignment: { ...previous, end: "2026-10-11" }, expected: previous }, STAFF).ok, true)
    const saved = store.getStaffDuties()
    assert.equal(saved.assignments.find(duty => duty.id === original.id).end, "2026-10-11")
    assert.deepEqual(saved.assignments.find(duty => duty.id === duplicate.id), duplicate)
    assert.equal(data.get(store.STAFF_DUTY_REPAIR_BACKUP_KEY), raw)
  })
})

function wrongParticipationRepair(source, id, intervals) {
  const state = structuredClone(source)
  const original = state.assignments.find(duty => duty.id === id)
  const leader = state.assignments.find(duty => duty.id === "app-lin-math")
  const repair = { date: "2026-10-10", text: `修正旧职责 · 教研参与教师 原记录 ${id}（${original.start} 至 ${original.end || "未设结束日期"}）去除与 ${leader.id} 的重复生效区间；${intervals.length ? "只保留原任期内不重叠的部分" : "不再作为独立生效授权"}，原记录保留在迁移备份。` }
  leader.history = [...leader.history, ...original.history.map(entry => ({ ...entry, text: `${entry.text} · 原记录 ${id}` })), repair]
  state.assignments = state.assignments.flatMap(duty => duty.id !== id ? [duty] : intervals.map(([start, end], index) => ({
    ...duty, id: index === 0 ? id : `${id}:remainder:${start}`, start, end, history: [...duty.history, repair],
  })))
  return state
}

test("exactly backed-up erroneous shifts, deletions and splits are restored once without undoing later endings", () => {
  for (const [start, end, intervals] of [
    ["2026-10-10", undefined, [["2027-08-01", undefined]]],
    ["2026-09-01", "2027-07-31", []],
    ["2026-08-01", "2027-09-30", [["2026-08-01", "2026-08-31"], ["2027-08-01", "2027-09-30"]]],
  ]) {
    const source = dutyModel.staffDutySeed()
    const original = dutyModel.createResearchDuty("wrongly-trimmed-participant", "u-lin", "research_participate", "math", start, end)
    source.assignments.push(original)
    const corrupted = wrongParticipationRepair(source, original.id, intervals)
    const raw = JSON.stringify(corrupted)
    const backup = JSON.stringify(source)
    withDutyStorage([["tgs:staff-duties-prototype:v1", raw], ["tgs:staff-duties-prototype:v1:before-overlap-repair", backup]], store => {
      const restored = store.getStaffDuties()
      const duty = restored.assignments.find(item => item.id === original.id)
      assert.equal(duty.start, original.start)
      assert.equal(duty.end, original.end)
      assert.deepEqual(duty.history.slice(0, original.history.length), original.history)
      assert.match(duty.history.at(-1).text, /撤销错误的职责互斥修正/)
      assert.equal(restored.assignments.length, source.assignments.length)
      assert.equal(restored.assignments.some(item => item.id.includes(":remainder:")), false)
      assert.equal(data.get(store.STAFF_DUTY_REPAIR_BACKUP_KEY), backup)
      assert.equal(data.get(store.STAFF_DUTY_COEXISTENCE_BACKUP_KEY), raw)
      assert.equal(dutyModel.restoreCoexistingResearchDuties(restored, source), restored)
      assert.deepEqual(restored.assignments.filter(item => ![original.id, "app-lin-math"].includes(item.id)), source.assignments.filter(item => ![original.id, "app-lin-math"].includes(item.id)))
      assert.equal(store.commitStaffDuty(actor("u-lin", "2026-10-10"), { type: "end", assignment: { ...duty, end: "2026-10-10" }, expected: duty }, STAFF).ok, true)
      const saved = structuredClone(store.getStaffDuties())
      assert.equal(dutyModel.dutyEffective(saved.assignments.find(item => item.id === original.id), "2026-10-11"), false)
      withDutyStorage([...data.entries()], reloaded => {
        assert.deepEqual(reloaded.getStaffDuties(), saved)
        assert.equal(reloaded.getStaffDuties().assignments.find(item => item.id === original.id).end, "2026-10-10")
      })
    })
  }
})

test("restoring an untouched participant never reverses a later explicit ending of the leader", () => {
  const source = dutyModel.staffDutySeed()
  const original = dutyModel.createResearchDuty("removed-concurrent-participant", "u-lin", "research_participate", "math", "2026-09-01", "2027-07-31")
  source.assignments.push(original)
  const corrupted = wrongParticipationRepair(source, original.id, [])
  const leader = corrupted.assignments.find(duty => duty.id === "app-lin-math")
  leader.end = "2026-10-10"
  leader.history.push({ date: "2026-10-10", text: "登记结束职责 · 原任期已缩短" })
  const before = structuredClone(corrupted)
  const restored = dutyModel.restoreCoexistingResearchDuties(corrupted, source)
  assert.equal(restored.assignments.find(duty => duty.id === leader.id).end, leader.end)
  assert.deepEqual(restored.assignments.find(duty => duty.id === leader.id).history.slice(0, -1), leader.history)
  assert.equal(model.canLeadGroup({ ...seed(), staffDuties: restored.assignments }, actor("u-lin", "2026-10-11"), "math"), false)
  assert(model.canParticipateGroup({ ...seed(), staffDuties: restored.assignments }, actor("u-lin", "2026-10-11"), "math"))
  assert.deepEqual(corrupted, before)
})

test("recovery leaves later participant edits, replacement duties and missing or invalid backups untouched", () => {
  const source = dutyModel.staffDutySeed()
  const original = dutyModel.createResearchDuty("edited-trimmed-participant", "u-lin", "research_participate", "math", "2026-08-01", "2027-09-30")
  source.assignments.push(original)
  const corrupted = wrongParticipationRepair(source, original.id, [["2026-08-01", "2026-08-31"], ["2027-08-01", "2027-09-30"]])
  const edited = corrupted.assignments.find(duty => duty.id === original.id)
  edited.end = "2026-08-15"
  edited.history.push({ date: "2026-10-11", text: "登记结束职责 · 后续正常结束" })
  assert.equal(dutyModel.restoreCoexistingResearchDuties(corrupted, source), corrupted)
  const removedSource = dutyModel.staffDutySeed()
  const removed = dutyModel.createResearchDuty("removed-participant", "u-lin", "research_participate", "math", "2026-09-01", "2027-07-31")
  removedSource.assignments.push(removed)
  const replacementState = wrongParticipationRepair(removedSource, removed.id, [])
  replacementState.assignments.push({ ...structuredClone(removed), id: "new-explicitly-ended-participant", end: "2026-10-10", status: "ended", history: [{ date: "2026-10-10", text: "登记结束职责" }] })
  assert.equal(dutyModel.restoreCoexistingResearchDuties(replacementState, removedSource), replacementState)
  const raw = JSON.stringify(corrupted)
  for (const backups of [[], [["tgs:staff-duties-prototype:v1:before-overlap-repair", "invalid-json"]]]) {
    withDutyStorage([["tgs:staff-duties-prototype:v1", raw], ...backups], store => {
      assert.deepEqual(store.getStaffDuties(), corrupted)
      assert.equal(data.get(store.STAFF_DUTY_STORAGE_KEY), raw)
      assert.equal(data.has(store.STAFF_DUTY_COEXISTENCE_BACKUP_KEY), false)
    })
  }
})

test("recovery also finds additional original snapshots without overwriting any existing backup", () => {
  const source = dutyModel.staffDutySeed()
  const original = dutyModel.createResearchDuty("additional-backup-member", "u-lin", "research_participate", "math", "2026-09-01", "2027-07-31")
  source.assignments.push(original)
  const raw = JSON.stringify(wrongParticipationRepair(source, original.id, []))
  const firstBackup = JSON.stringify(dutyModel.staffDutySeed())
  const matchingBackup = JSON.stringify(source)
  withDutyStorage([
    ["tgs:staff-duties-prototype:v1", raw],
    ["tgs:staff-duties-prototype:v1:before-overlap-repair", firstBackup],
    ["tgs:staff-duties-prototype:v1:before-overlap-repair:second", matchingBackup],
  ], store => {
    assert.equal(store.getStaffDuties().assignments.find(duty => duty.id === original.id).start, original.start)
    assert.equal(data.get(store.STAFF_DUTY_REPAIR_BACKUP_KEY), firstBackup)
    assert.equal(data.get(`${store.STAFF_DUTY_REPAIR_BACKUP_KEY}:second`), matchingBackup)
    assert.equal(data.get(store.STAFF_DUTY_COEXISTENCE_BACKUP_KEY), raw)
  })
})

test("a failed recovery backup leaves both current data and original snapshots intact without seeded permissions", () => {
  const source = dutyModel.staffDutySeed()
  const original = dutyModel.createResearchDuty("backup-failure-member", "u-lin", "research_participate", "math", "2026-09-01", "2027-07-31")
  source.assignments.push(original)
  const raw = JSON.stringify(wrongParticipationRepair(source, original.id, []))
  const backup = JSON.stringify(source)
  withDutyStorage([["tgs:staff-duties-prototype:v1", raw], ["tgs:staff-duties-prototype:v1:before-overlap-repair", backup]], store => {
    storage.setItem = () => { throw new Error("test recovery backup unavailable") }
    assert.deepEqual(store.getStaffDuties().assignments, [])
    assert.equal(data.get(store.STAFF_DUTY_STORAGE_KEY), raw)
    assert.equal(data.get(store.STAFF_DUTY_REPAIR_BACKUP_KEY), backup)
    assert.equal(data.has(store.STAFF_DUTY_COEXISTENCE_BACKUP_KEY), false)
    const assignment = dutyModel.createResearchDuty("should-not-save", "u-he", "research_participate", "math", actor().date)
    const result = store.commitStaffDuty(actor(), { type: "arrange", assignments: [assignment] }, STAFF)
    assert.equal(result.ok, false)
    assert.match(result.error, /未清空旧数据/)
    assert.equal(data.get(store.STAFF_DUTY_STORAGE_KEY), raw)
  })
})

test("legacy source snapshots are migrated without injecting seed duties or modifying their backup", () => {
  const source = dutyModel.staffDutySeed()
  const only = source.assignments.find(duty => duty.id === "app-zhou-math")
  const legacy = JSON.stringify({ schema: 3, staffDuties: [only], groups: source.groups })
  withDutyStorage([["tgs:research-prototype:v2", legacy]], store => {
    assert.deepEqual(store.getStaffDuties().assignments, [only])
    assert.equal(data.get("tgs:research-prototype:v2"), legacy)
    assert.equal(data.has(store.STAFF_DUTY_STORAGE_KEY), true)
    assert.equal(store.getStaffDuties().assignments.some(duty => duty.staffId === "u-lin"), false)
  })
})

test("a commit reads the latest stored term before accepting a stale revision or arranging a duplicate", () => {
  const source = dutyModel.staffDutySeed()
  withDutyStorage([["tgs:staff-duties-prototype:v1", JSON.stringify(source)]], store => {
    const previous = store.getStaffDuties().assignments.find(duty => duty.id === "app-zhou-math")
    const updated = structuredClone(source)
    updated.assignments.find(duty => duty.id === previous.id).end = "2027-06-30"
    const raw = JSON.stringify(updated)
    data.set(store.STAFF_DUTY_STORAGE_KEY, raw)
    const stale = store.commitStaffDuty(actor(), { type: "end", assignment: { ...previous, end: "2026-10-11" }, expected: previous }, STAFF)
    assert.equal(stale.ok, false)
    assert.match(stale.error, /其他操作修订/)
    assert.equal(data.get(store.STAFF_DUTY_STORAGE_KEY), raw)
    assert.equal(store.getStaffDuties().assignments.find(duty => duty.id === previous.id).end, "2027-06-30")
    const first = dutyModel.createResearchDuty("arranged-in-other-tab", "u-he", "research_participate", "math", actor().date)
    updated.assignments.push(first)
    const latest = JSON.stringify(updated)
    data.set(store.STAFF_DUTY_STORAGE_KEY, latest)
    const duplicate = store.commitStaffDuty(actor(), { type: "arrange", assignments: [{ ...first, id: "duplicate-from-stale-tab" }] }, STAFF)
    assert.equal(duplicate.ok, false)
    assert.match(duplicate.error, /重叠的同类职责/)
    assert.equal(data.get(store.STAFF_DUTY_STORAGE_KEY), latest)
  })
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
  assert.match(form, /已生效职责可以结束/)
  assert.match(form, /教研组长与教研参与教师可以在同一教研组同时存在/)
  assert.doesNotMatch(detail, /仅保留原任期内不重叠的安排/)
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

test("disabled responsibility objects permit scoped duty endings without granting unarranged authority", () => {
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
  const noRoles = STAFF.map(person => ({ ...person, systemRoles: [] }))
  assert.equal(dutyCommand(state, ending, "u-lin", actor().date, noRoles).staffDuties.find(duty => duty.id === member.id).end, actor().date)
  const noAuthority = { ...state, staffDuties: state.staffDuties.filter(duty => duty.staffId !== "u-lin" || duty.type !== "research_manage") }
  assert.throws(() => dutyCommand(noAuthority, ending, "u-lin", actor().date, noRoles), /安排权/)
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


test("members create and revise their own tasks and activities without acquiring leader authority", () => {
  const source = seed(), base = source.tasks.find(t => t.group === "math")
  const task = { ...base,id: "member-task",createdBy: undefined,schoolTaskId: null,parent: null,title: "成员自建教研",owner: "u-zhou",collaborators: ["u-lin"],submitters: [],mode: "牵头提交",status: "进行中",outcomes: [],divisions: { "u-lin": "准备共享资料", "u-zhou": "组织讨论" } }
  let state = command(source,{ type: "save-task",task },"u-zhou")
  const saved = state.tasks.find(t => t.id === task.id)
  assert.equal(saved.createdBy,"u-zhou")
  assert.equal(model.canLeadGroup(state,actor("u-zhou"),"math"),false)
  state = command(state,{ type: "save-task",task: { ...saved,title: "修订本人任务" } },"u-zhou")
  assert.throws(() => command(state,{ type: "save-task",task: { ...state.tasks.find(t => t.id === task.id),title: "其他成员篡改" } },"u-he"),/本人|组长/)
  assert.throws(() => applyResearchCommand(state,actor("u-zhou","2028-01-01"),{ type: "save-task",task: saved },catalogSeed),/本人|组长/)
  const a = { ...source.activities.find(a => a.group === "math"),id: "member-activity",title: "成员组织团建",owner: "u-zhou",type: "团建活动",lesson: null,criterionId: null,trials: [],start: "2026-10-01T18:30",end: "2026-10-01T20:00",participants: ["u-zhou","u-lin"],materials: [],responsibilities: { "u-zhou": "协调场地" } }
  state = command(state,{ type: "save-activity",activity: a },"u-zhou")
  assert.equal(state.activities.find(x => x.id === a.id).responsibilities["u-zhou"],"协调场地")
  assert.throws(() => command(state,{ type: "save-activity",activity: { ...a,version: 1,end: "2026-10-01T18:00" } },"u-zhou"),/时间/)
  assert.throws(() => command(state,{ type: "save-group-slot",slot: source.groupSchedules[0] },"u-zhou"),/组长/)
})

test("journal drafts, dated logs and submission snapshots retain actual content independently", () => {
  let state = command(seed(),{ type: "form-draft",key: "journal-dialog:math:new",value: { title: "未完成日志",body: "实际研讨内容" } },"u-zhou")
  const document = documentOf(state,"syllabus-demo")
  const journal = { id: "journal-test",group: "math",author: "u-zhou",date: actor().date,title: "备课记录",body: "讨论函数教学顺序",conclusion: "先讲图像",next: "整理讲义",course: "C101",taskId: null,activityId: null,references: [{ documentId: document.id,version: document.version,snapshot: { ...document,title: "伪造标题" } }],version: 1,at: actor().date }
  state = command(state,{ type: "journal",journal },"u-zhou")
  assert.equal(state.journals[0].references[0].snapshot.title,document.title)
  const restored = migrateResearch(JSON.parse(JSON.stringify(state)))
  assert.equal(restored.forms["u-zhou|journal-dialog:math:new"].body,"实际研讨内容")
  assert.throws(() => command(state,{ type: "journal",journal: { ...journal,date: "2026-10-01" } },"u-zhou"),/日期/)
  assert.throws(() => command(state,{ type: "journal",journal },"u-lin"),/本人日志/)
  const base = state.tasks.find(t => t.group === "math")
  state = command(state,{ type: "save-task",task: { ...base,id: "log-submission",schoolTaskId: null,parent: null,title: "引用日志",owner: "u-zhou",collaborators: [],submitters: [],outcomes: [],status: "进行中" } },"u-zhou")
  state = command(state,{ type: "submit-task",id: "log-submission",outcome: { id: "o",kind: "journal",entityId: journal.id,version: 1,title: "ignored",submittedBy: "forged",submittedAt: "forged" } },"u-zhou")
  state = command(state,{ type: "journal",journal: { ...state.journals[0],body: "后来修订" } },"u-zhou")
  assert.equal(state.tasks.find(t => t.id === "log-submission").outcomes[0].journal.body,"讨论函数教学顺序")
  assert.equal(state.tasks.find(t => t.id === "log-submission").outcomes[0].submittedBy,"u-zhou")
})

test("group chat saves messages and pinned references atomically, isolates drafts and rejects scope misuse", () => {
  let state = command(seed(),{ type: "form-draft",key: "chat:math",value: { body: "本人数学草稿" } },"u-zhou")
  state = command(state,{ type: "form-draft",key: "chat:math",value: { body: "组长草稿" } })
  const d = documentOf(state,"syllabus-demo"), message = { id: "m1",group: "math",author: "forged",body: "@林老师 看看这个资料 👍",at: "forged",replyTo: null,mentions: ["u-lin"],meme: "thanks",files: [],references: [{ documentId: d.id,version: 1,snapshot: d }],reactions: { "👍": ["forged"] } }
  state = command(state,{ type: "chat",message },"u-zhou")
  assert.equal(state.messages[0].author,"u-zhou")
  assert.deepEqual(state.messages[0].reactions,{})
  assert.equal(state.forms["u-zhou|chat:math"],undefined)
  assert.equal(state.forms["u-lin|chat:math"].body,"组长草稿")
  assert.throws(() => command(state,{ type: "chat",message: { ...message,id: "m2",group: "physics" } },"u-zhou"),/有效成员/)
  assert.throws(() => command(state,{ type: "withdraw-chat",id: "m1" }),/本人/)
  state = command(state,{ type: "react-chat",id: "m1",emoji: "👍" })
  assert.deepEqual(state.messages[0].reactions["👍"],["u-lin"])
  state = command(state,{ type: "withdraw-chat",id: "m1" },"u-zhou")
  assert.equal(state.messages[0].body,"")
  assert.equal(state.messages[0].references.length,0)
  assert.throws(() => command(state,{ type: "chat",message: { ...message,id: "m2",replyTo: "m1" } },"u-zhou"),/撤回/)
  const { mediaValid } = require("../lib/research/workspace-model.ts")
  assert.equal(mediaValid({ name: "unsafe.svg",mime: "image/svg+xml",size: 4,data: "data:image/svg+xml;base64,AAAA" }),false)
  assert.equal(mediaValid({ name: "example.gif",mime: "image/gif",size: 3,data: "data:image/gif;base64,AAAA" }),true)
})

test("paper fixtures retain exact course/unit identities and original question bodies; basket is per actor", () => {
  const { paperDocumentsSeed,paperRecords } = require("../lib/research/papers.ts")
  const state = migrateResearch({ ...seed(),schema: 3 })
  assert.equal(paperDocumentsSeed.length,paperRecords.length)
  assert(paperDocumentsSeed.some(d => d.course === "C101") && paperDocumentsSeed.some(d => d.course === "C501"))
  for (const d of paperDocumentsSeed) { assert(model.scopeValid(d,catalogSeed)); model.validateDocument(d); assert.equal(d.files.length,0) }
  const p1 = paperDocumentsSeed.find(d => d.course === "C101" && d.paperCode.startsWith("1") && d.items.length)
  assert.deepEqual(p1.unitIds,["U101"])
  const chosen = command(state,{ type: "basket",ids: [p1.items[0].id] },"u-zhou")
  assert.deepEqual(chosen.baskets["u-zhou"],[p1.items[0].id])
  assert.equal(chosen.baskets["u-lin"],undefined)
  assert.throws(() => command(chosen,{ type: "basket",ids: ["not-existing"] },"u-zhou"),/失效/)
  const fixture = documentOf(chosen,p1.id)
  const custom = { ...fixture,title: "教师已核验的原型试卷名称",version: 2 }
  const persisted = { ...chosen,documents: chosen.documents.map(d => d.id === p1.id ? custom : d) }
  assert.equal(migrateResearch(JSON.parse(JSON.stringify(persisted))).documents.find(d => d.id === p1.id).title,custom.title)
})


test("submitting a journal rechecks current retained-source authorization and freezes the pinned version", () => {
 let state = seed(), d = documentOf(state,"textbook-demo")
 const journal = { id: "source-bound-journal",group: "math",author: "u-lin",date: actor().date,title: "有资料引用的日志",body: "实际讨论",conclusion: "",next: "",course: "C101",taskId: null,activityId: null,references: [{ documentId: d.id,version: d.version,snapshot: d }],version: 1,at: actor().date }
 state = command(state,{ type: "journal",journal })
 const rootTask = state.tasks.find(t => t.id === "task-math")
 state = command(state,{ type: "accept-task",id: rootTask.id,owner: "u-lin",collaborators: [],submitters: [],mode: "牵头提交" })
 const submit = { type: "submit-task",id: rootTask.id,outcome: { id: "log-outcome",kind: "journal",entityId: journal.id,version: 1,title: "ignored",submittedBy: "forged",submittedAt: "forged" } }
 for (const patch of [{ restricted: true },{ copyPolicy: "reference-only" },{ share: { audience: "owner",staff: [],groups: [] },owner: "u-chen" }]) {
  const changed = { ...state,documents: state.documents.map(doc => doc.id === d.id ? { ...doc,...patch } : doc) }
  assert.throws(() => command(changed,submit),/权限|引用/)
 }
 const revised = { ...state,documents: state.documents.map(doc => doc.id === d.id ? { ...doc,version: 2,title: "新修订" } : doc) }
 const submitted = command(revised,submit)
 assert.equal(submitted.tasks.find(t => t.id === rootTask.id).outcomes[0].journal.references[0].version,1)
 assert.equal(submitted.tasks.find(t => t.id === rootTask.id).outcomes[0].journal.references[0].snapshot.title,d.title)
})


test("registered original exam assets retain their binary hashes and all question topic tags", () => {
 const crypto = require("node:crypto"), assets = require("../lib/research/paper-assets.json")
 assert.equal(Object.keys(assets).length,76)
 for (const asset of Object.values(assets)) {
  const raw = fs.readFileSync(path.join(root,"public",decodeURIComponent(asset.url)))
  assert.equal(crypto.createHash("sha256").update(raw).digest("hex"),asset.sha256)
  assert.equal(raw.length,asset.bytes)
  assert.equal(asset.kind === "pdf" ? raw.subarray(0,5).toString() : raw.subarray(0,2).toString(),asset.kind === "pdf" ? "%PDF-" : "PK")
 }
 const { paperDocumentsSeed } = require("../lib/research/papers.ts")
 const item = paperDocumentsSeed.flatMap(d => d.items).find(i => i.id === "9709-2024春-p1v2-7(a)")
 assert(item.topics.some(t => t.id === "T1" && t.name === "二次函数" && t.auto))
})

test("activity edits preserve pinned materials and calibration, while explicit basis update clears old decisions", () => {
 let state = seed(),criterion = state.criteria.find(c => c.group === "math"),doc = documentOf(state,"textbook-demo")
 const base = state.activities.find(a => a.group === "math")
 const activity = { ...base,id: "pinned-activity",owner: "u-lin",type: "评分校准",criterionId: criterion.id,criterionVersion: criterion.version,trials: [{ id: "sample",answer: "匿名示例",notes: "",decisions: {} }],materials: [{ documentId: doc.id,version: doc.version }] }
 state = command(state,{ type: "save-activity",activity })
 state = command(state,{ type: "trial-activity",id: activity.id,trial: "sample",decision: "基于旧依据" })
 const saved = state.activities.find(a => a.id === activity.id)
 state = { ...state,documents: state.documents.map(d => d.id === doc.id ? { ...d,version: 2 } : d),criteria: state.criteria.map(c => c.id === criterion.id ? { ...c,version: 2,title: "新依据" } : c) }
 state = command(state,{ type: "save-activity",activity: { ...saved,place: "新地点" } })
 const edited = state.activities.find(a => a.id === activity.id)
 assert.equal(edited.materials[0].version,1)
 assert.equal(edited.criterionVersion,1)
 assert.equal(edited.trials[0].decisions["u-lin"],"基于旧依据")
 state = command(state,{ type: "save-activity",activity: { ...edited,criterionVersion: 2 } })
 assert.equal(state.activities.find(a => a.id === activity.id).criterionSnapshot.title,"新依据")
 assert.deepEqual(state.activities.find(a => a.id === activity.id).trials[0].decisions,{})
})


test("empty parsed paper copies retain their exact registered original file identity", () => {
 const { paperDocumentsSeed } = require("../lib/research/papers.ts")
 const original = paperDocumentsSeed.find(d => d.course === "C501" && !d.items.length)
 assert(original)
 const state = migrateResearch({ ...seed(),schema: 3 })
 const copy = model.copyDocument(state,actor(),original,"empty-paper-copy")
 assert.equal(copy.items.length,0)
 assert.deepEqual(copy.paperSource,{ id: original.id,version: 1 })
 const next = command(state,{ type: "create-document",document: copy })
 assert.deepEqual(migrateResearch(JSON.parse(JSON.stringify(next))).documents.find(d => d.id === copy.id).paperSource,copy.paperSource)
})

const {sourceDocumentsSeed}=require('../lib/research/source-seed.ts')
const {exportSourceDocument,importSourceDocuments}=require('../lib/research/source-transfer.ts')
const {sourceLayoutFor,sourceAssessmentFor}=require('../lib/research/source-layout.ts')
test('原 HTML 的完整数学节点、考核、方案、量表与计划按真实原数据导入',()=>{
 const d=sourceDocumentsSeed.find(d=>d.id==='s9709');assert.equal(d.items.length,48);assert.equal(d.items.filter(i=>i.layout.kind==='requirement').length,34);assert.equal(d.assessments.length,6);assert.equal(d.layout.schemes.length,5);assert.equal(d.layout.rubrics.length,2);assert(d.items.some(i=>i.notes&&i.supplement));
 for(const doc of sourceDocumentsSeed){model.validateDocument(doc);assert(model.scopeValid(doc,catalogSeed));assert(doc.items.every(i=>i.unitIds.every(id=>catalogSeed.units.some(u=>u.code===id&&u.courseCode===doc.course))))}
 const p=sourceDocumentsSeed.find(d=>d.title==='CAIE 9709 P1 · 教材目录计划（演示）');assert.equal(p.items.length,83);assert.equal(model.leafItems(p).length,72);assert.equal(model.totals(p).allocated,4600);assert.equal(p.budget,4800);assert.equal(p.reserve,200);assert(p.items.some(i=>i.weeks.length===2))
})
test('导出保留合法内容，隐藏不可留存正文并遵守附件独立权限与禁止复制',()=>{
 const s=seed(),privateSource=model.emptyDocument('export-private','资源','受限来源','math','u-lin','C101',null);privateSource.share={audience:'specified',staff:['u-other'],groups:[]};privateSource.restricted=true;privateSource.items=[{...model.emptyItem('export-private-node'),body:'不应导出的正文'}];s.documents.push(privateSource);s.revisions['export-private@1']=privateSource
 const d=model.emptyDocument('export-own','资源','导出核验','math','u-lin','C101',null);d.items=[{...model.emptyItem('visible'),body:'可读正文'},{...model.emptyItem('hidden'),body:'不应导出的正文',references:[{documentId:privateSource.id,version:1,itemId:'export-private-node',title:'受限来源',locator:'',retainText:false}]}];d.files=[{id:'normal',name:'正常文件',type:'text/plain',data:'正常',access:{audience:'group',groups:[],staff:[]}},{id:'limited',name:'不应导出独立原件',type:'text/plain',data:'独立秘密',access:{audience:'specified',groups:[],staff:['u-other']}},{id:'read-only',name:'可读但不得复制',type:'text/plain',data:'只读',allowCopy:false,access:{audience:'group',groups:[],staff:[]}}];s.documents.push(d)
 const out=exportSourceDocument(s,actor(),d);assert.deepEqual(out.items.map(i=>i.id),['visible']);assert.deepEqual(out.files.map(i=>i.id),['normal']);assert(!JSON.stringify(out).includes('不应导出'));assert(!JSON.stringify(out).includes('独立秘密'));d.copyPolicy='reference-only';assert.throws(()=>exportSourceDocument(s,actor(),d),/不允许导出/)
})
test('批量 JSON 资料按原格式导回且整体提交，伪造留存引用拒绝且不写入',()=>{
 const s=seed();for(const d of sourceDocumentsSeed){s.documents.push(d);s.revisions[`${d.id}@${d.version}`]=d}
 const originals=sourceDocumentsSeed.filter(d=>d.course==='C101'&&d.kind==='大纲'),exported=originals.map(d=>exportSourceDocument(s,actor(),d)),imported=importSourceDocuments(exported,s,actor(),catalogSeed,'C101');assert.equal(imported.length,originals.length);assert(imported.every(d=>d.owner==='u-lin'&&d.share.audience==='owner'));assert(imported[0].items.every(i=>!originals[0].items.some(n=>n.id===i.id)));assert.equal(new Set(imported.flatMap(d=>d.items.map(i=>i.id))).size,imported.reduce((n,d)=>n+d.items.length,0));const next=applyResearchCommand(s,actor(),{type:'import-documents',documents:imported},catalogSeed);assert.equal(next.documents.length,s.documents.length+imported.length)
 const invalid={...imported[0],id:'invalid-import',course:'unknown'};assert.throws(()=>applyResearchCommand(s,actor(),{type:'import-documents',documents:[imported[0],invalid]},catalogSeed));assert(!s.documents.some(d=>d.id===imported[0].id));const forged=structuredClone(exported[0]);forged.items[0].references=[{documentId:'not-authorized',version:1,itemId:'secret',retainText:true,retainedBy:'u-lin',title:'伪造',locator:''}];assert.throws(()=>importSourceDocuments(forged,s,actor(),catalogSeed,'C101'),/不可留存/)
})
test('原有无 layout 的大纲、节点和考核可取得完整默认元信息',()=>{const d=seed().documents.find(d=>d.kind==='大纲');const layout=sourceLayoutFor(d);assert(Array.isArray(layout.schemes));assert(Array.isArray(layout.rubrics));const a=d.assessments[0];if(a){const data=sourceAssessmentFor(a);assert.equal(data.name,a.title);assert.deepEqual(data.scopeRefs.map(r=>r.nodeId),a.itemIds)}})
test('迁移中曾创建的未修改资源前向补齐附件，旧版本与用户修改保持原样',()=>{const raw=seed(),source=sourceDocumentsSeed.find(d=>d.id==='ry-math-workbook'),old={...structuredClone(source),files:[]};raw.documents.push(old);raw.revisions[`${old.id}@1`]=structuredClone(old);const next=migrateResearch(raw);assert.equal(next.documents.find(d=>d.id===old.id).version,2);assert.equal(next.revisions[`${old.id}@1`].files.length,0);assert.equal(next.revisions[`${old.id}@2`].files.length,2);const modified=structuredClone(raw);modified.documents.find(d=>d.id===old.id).items[0].body='本人修改';assert.equal(migrateResearch(modified).documents.find(d=>d.id===old.id).files.length,0)})
const {selectionKey,resolveSelection,selectionReferences}=require('../lib/research/selection.ts')
test('选题篮固定文档、版本和条目，不把个人修改版误认成同 ID 原题',()=>{let s=seed();const source=sourceDocumentsSeed.find(d=>d.id==='ry-math-workbook');s.documents.push(source);s.revisions[`${source.id}@1`]=source;s=command(s,{type:'copy-document',sourceId:source.id,sourceVersion:1,id:'private-selected-copy'});const copy=s.documents.find(d=>d.id==='private-selected-copy');copy.items[1].body='个人修改后的题干';const key=selectionKey(copy,copy.items[1]);s=command(s,{type:'basket',ids:[key]});const selected=resolveSelection(s,actor(),key);assert.equal(selected.document.id,copy.id);assert.equal(selected.item.body,'个人修改后的题干');assert.equal(resolveSelection(s,actor(),copy.items[1].id),null);s.revisions[`${copy.id}@1`]=structuredClone(copy);copy.version=2;copy.items[1].body='更新后的正文';s.documents=s.documents.map(d=>d.id===copy.id?copy:d);assert.equal(resolveSelection(s,actor(),key).item.body,'个人修改后的题干')})
test('选取校本小题保留同版本共同题干与明确单元，可由原作业准备链路采用',()=>{let s=seed();const source=sourceDocumentsSeed.find(d=>d.id==='ry-math-workbook');s.documents.push(source);s.revisions[`${source.id}@1`]=source;const selected=resolveSelection(s,actor(),selectionKey(source,source.items[1]));assert(selected.item.stem.includes('$'));const d=model.emptyDocument('selected-workbook','练习组合','校本练习','u-lin','u-lin','C101',null);d.scope='units';d.unitIds=['U101'];d.items=[{...selected.item,id:'chosen-workbook-a',parentId:null,references:[model.referenceFor(source,selected.item,actor())]}];s=command(s,{type:'create-document',document:d});const biz=freshBiz(),task=ownMathTasks(biz)[0];assert(model.taskCompatible(d,task,d.items));const q=prepareHomeworkQuestions(s,actor(),d.id,d.version,['chosen-workbook-a'],task);assert(q[0].stem.includes('$'));assert.equal(q[0].maxScore,2)})

test('共同题干与小题一同冻结版本和来源授权链，父项上游受限后禁止留存导出',()=>{
 const s=seed(),source=structuredClone(sourceDocumentsSeed.find(d=>d.id==='ry-math-workbook')),upstream=model.emptyDocument('shared-stem-source','资源','共同题干原资料','math','u-lin','C101',null);upstream.items=[{...model.emptyItem('shared-condition'),body:'来源条件'}];s.documents.push(upstream);s.revisions[`${upstream.id}@1`]=structuredClone(upstream);source.items[0].references=[model.referenceFor(upstream,upstream.items[0],actor())];s.documents.push(source);s.revisions[`${source.id}@1`]=structuredClone(source)
 const selected=resolveSelection(s,actor(),selectionKey(source,source.items[1])).item,copy=model.emptyDocument('stem-frozen','练习组合','小题','u-lin','u-lin','C101',null);copy.items=[{...selected,id:'frozen-child',parentId:null,references:selectionReferences(source,selected,actor())}];s.documents.push(copy);s.revisions[`${copy.id}@1`]=structuredClone(copy)
 assert(copy.items[0].references.some(r=>r.documentId===source.id&&r.itemId===source.items[0].id&&r.version===1));assert(copy.items[0].references.some(r=>r.documentId===upstream.id));assert(model.canRetainItem(s,actor(),copy.items[0],copy.owner));assert.equal(exportSourceDocument(s,actor(),copy).items.length,1)
 upstream.copyPolicy='reference-only';assert.equal(resolveSelection(s,actor(),selectionKey(source,source.items[1])),null);assert.equal(model.canRetainItem(s,actor(),copy.items[0],copy.owner),false);assert.equal(exportSourceDocument(s,actor(),copy).items.length,0)
})
