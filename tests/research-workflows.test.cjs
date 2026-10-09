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
const data = new Map()
const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
global.window = { localStorage: storage, sessionStorage: storage, addEventListener() {}, removeEventListener() {} }

const model = require("../lib/research/model.ts")
const { researchSeed } = require("../lib/research/seed.ts")
const { applyResearchCommand } = require("../lib/research/commands.ts")
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
const ownMathTasks = biz => permittedTasks(biz, "TEACHER_LYNN").filter(task => model.dutyUnitMap[task.duty_id] === "U101")
const success = result => { assert.equal("error" in result, false, result.error); return result }
const assignmentFor = (task, questions = []) => ({
  id: "TEST_RESEARCH_HW", taskId: task.id, title: "合成回归测试作业", instructions: "测试正文，不是正式记录", issuedAt: "2026-09-30T12:00:00+08:00", deadline: null,
  recipients: ["TEST_STUDENT_A", "TEST_STUDENT_B"], defaultRequirement: "REQUIRED", requirementOverrides: {}, results: {}, revision: 1, stamp: 1, schemeRevId: "SYS_BASIC4@1", status: "ACTIVE", questionSources: questions,
})

 test("1. original global navigation stays unchanged; workspace retains query context and persistent form drafts", () => {
  const { NAV } = require("../lib/demo/nav.ts")
  assert.equal(NAV.some(item => item.href.startsWith("/research")), false)
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

 test("2. effective appointments, independent multi-group duties, no-timetable leader, expired and scoped school viewer", () => {
  const state = seed()
  assert(model.canLeadGroup(state, actor(), "math"))
  assert(model.canEditGroup(state, actor(), "physics"))
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
  const old = state.appointments.find(appointment => appointment.id === "app-lin-math")
  state = command(state, { type: "appointment", appointment: { ...old, end: "2026-09-29" } })
  state = command(state, { type: "appointment", appointment: { id: "new-leader-test", staff: "u-zhou", group: "math", role: "组长", start: "2026-09-30", end: null } })
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
