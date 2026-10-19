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
for (const ext of [".ts", ".tsx"]) require.extensions[ext] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, file)
require.extensions[".css"] = () => {}

const React = require("react"), { createElement: h } = React
const { renderToStaticMarkup: render } = require("react-dom/server")
const { TEACHERS } = require("../lib/timetable/data.ts")
const { schoolOverviewTeacherIds, schoolOverviewEntries, schoolActivityEntries, schoolActivityObjects } = require("../lib/timetable/activities.ts")
const { EMPTY_CARD_FILTERS, changeCardFilterKind, matchesCardFilters, hasCardFilters } = require("../lib/timetable/display.ts")
const { assessSchedule, entryHomeroom } = require("../lib/timetable/conflict-display.ts")
const { TimetableFilterBar } = require("../components/timetable/card-filters.tsx")
const { ActivityView, OverviewPanel } = require("../components/timetable/overview-panel.tsx")
const { WeekGrid } = require("../components/timetable/week-grid.tsx")
const { DemoProvider } = require("../lib/demo/store.tsx")
const { MtProvider } = require("../lib/mt/store.tsx")
const { TeachingProvider } = require("../lib/teaching/store.tsx")
const ttStore = require("../lib/timetable/store.tsx")
const calendar = require("../lib/timetable/calendar-store.ts")
const fixture = require("../lib/teaching/fixture.json")

const activity = overrides => ({ key: "meeting", kind: "activity", className: "学科研讨", subject: "数学", weekday: 1, periodId: "m3", room: "教研室", ...overrides })
const stateFor = templates => ({
  clock: "2026-10-26T08:00", weekStart: "2026-10-26", selectedTeacher: "lin", adoptions: {}, schoolDrafts: {},
  releases: [{ seq: 6, id: "SCH-006", publishedAt: "2026-09-17T15:00", effectiveDate: "2026-09-21", changedTeachers: [...TEACHERS.map(t => t.id), ...Object.keys(templates)], templates: { ...Object.fromEntries(TEACHERS.map(t => [t.id, []])), ...templates } }],
  faults: {}, redoStack: [], notifRead: {}, lastCacheAt: null,
})
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
const elements = node => Array.isArray(node) ? node.flatMap(elements) : node && typeof node === "object" && node.props ? [node, ...elements(node.props.children)] : []
const text = node => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : node == null || typeof node === "boolean" ? "" : String(node)
const find = (tree, predicate) => { const node = elements(tree).find(predicate); assert(node, "expected element missing"); return node }
const select = (tree, label) => find(tree, node => node.type === "select" && node.props["aria-label"] === label)
const providers = child => h(DemoProvider, null, h(TeachingProvider, null, h(MtProvider, null, h(ttStore.TimetableProvider, { clock: "2026-10-26T08:00" }, child))))
function withSchool(state, run, events = []) {
  const original = ttStore.useTimetable, previousEvents = calendar.useCalendarEvents
  ttStore.useTimetable = () => state
  calendar.useCalendarEvents = () => events
  try { return run() } finally { ttStore.useTimetable = original; calendar.useCalendarEvents = previousEvents }
}
const renderActivity = (state, name = "", events = [], weekStart = "2026-10-26") => withSchool(state, () => render(providers(h(ActivityView, { activityName: name, weekStart, clockDate: "2026-10-26", onCard: () => {} }))), events)
const gridOnly = html => html.slice(html.indexOf('<div data-layout="'))
function withOverview(state, run, events = []) {
  const slots = [], oldState = React.useState
  let cursor = 0
  React.useState = initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next }] }
  try { return withSchool(state, () => run(() => { cursor = 0; return OverviewPanel() }), events) }
  finally { React.useState = oldState }
}

test("school activity directory uses every latest published teacher source and excludes drafts and personal arrangements", () => {
  const state = stateFor({ lin: [activity()], zhou: [activity({ className: "物理备课", subject: "物理" })], shen: [activity({ className: "年级会议" })], guest: [activity({ className: "校外教研" })] })
  state.schoolDrafts.lin = { edits: [{ kind: "activity", className: "未发布草稿" }] }
  state.adoptions.lin = { personalEdits: [{ kind: "activity", className: "教师私有安排" }] }
  state.releases.push({ seq: 7, changedTeachers: ["zhou"], templates: { zhou: [activity({ className: "物理实验研讨", subject: "物理", room: "实验室" })] } })
  freeze(state)
  assert(schoolOverviewTeacherIds(state).includes("guest"))
  const objects = schoolActivityObjects(state)
  assert.deepEqual(objects.map(item => item.name).sort(), ["学科研讨", "年级会议", "校外教研", "物理实验研讨"].sort())
  assert.equal(objects.find(item => item.name === "年级会议").teacherIds[0], "shen", "staff without a teacher account remain visible")
  assert.equal(schoolActivityEntries(state, "2026-10-26").length, 4)
  assert(schoolActivityEntries(state, "2026-10-26").every(entry => entry.origin === "school"))
})

test("same-name activities merge directory options but retain teacher occurrences, and off-week activities remain selectable", () => {
  const name = "高一1班 • 数学"
  const state = stateFor({
    lin: [activity({ className: name }), activity({ key: "class", kind: "class", className: name }), activity({ key: "future", className: "下周培训", validFrom: "2026-11-02", validTo: "2026-11-02" })],
    zhou: [activity({ className: name, room: "第二会议室" })],
  })
  const objects = schoolActivityObjects(state)
  assert.equal(objects.length, 2)
  assert.deepEqual(objects.find(item => item.name === name), { name, teacherIds: ["lin", "zhou"], rooms: ["教研室", "第二会议室"] })
  assert(objects.some(item => item.name === "下周培训"))
  assert.equal(schoolActivityEntries(state, "2026-10-26").length, 2)
  assert.equal(schoolOverviewEntries(state, "2026-10-26").length, 3, "full conflict source retains the same-name teaching lesson")
  const teaching = { classes: fixture.teachingClasses, responsibilities: fixture.responsibilities }
  for (const entry of schoolActivityEntries(state, "2026-10-26")) assert.equal(entryHomeroom(entry, teaching), null)
})

test("activity filters are strict, composable and immutable, and type transitions clear incompatible course constraints", () => {
  const entries = schoolOverviewEntries(stateFor({ lin: [activity(), activity({ key: "class", kind: "class" })], zhou: [activity()] }), "2026-10-26")
  const initial = freeze({ ...EMPTY_CARD_FILTERS, kind: "class", subject: "数学", className: "学科研讨", teacherId: "lin", query: "教研室" })
  const active = changeCardFilterKind(initial, "activity")
  assert.deepEqual(active, { ...initial, kind: "activity", subject: "", className: "" })
  const byName = { ...active, activityName: "学科研讨" }
  assert.deepEqual(entries.filter(entry => matchesCardFilters(entry, byName)).map(entry => entry.key), ["meeting"])
  assert.equal(hasCardFilters(byName), true)
  assert(!matchesCardFilters(entries.find(entry => entry.kind === "class"), byName))
  assert.equal(changeCardFilterKind(byName, "class").activityName, "")
  assert.equal(initial.kind, "class")
})

test("the real filter controls switch course/activity types, select names, and recover from zero results", () => {
  const entries = schoolOverviewEntries(stateFor({ lin: [activity(), activity({ key: "class", kind: "class", className: "高一1班 • 数学" })] }), "2026-10-26")
  let value = { ...EMPTY_CARD_FILTERS, subject: "数学", className: "高一1班 • 数学", teacherId: "lin" }
  const tree = () => TimetableFilterBar({ entries, value, onChange: next => { value = next }, showTeacher: true })
  select(tree(), "筛选课卡类型").props.onChange({ target: { value: "activity" } })
  assert.equal(value.className, "")
  assert.equal(value.subject, "")
  assert.equal(value.teacherId, "lin")
  assert(!elements(tree()).some(node => node.props["aria-label"] === "筛选教学班"))
  select(tree(), "筛选活动").props.onChange({ target: { value: "学科研讨" } })
  assert.equal(value.activityName, "学科研讨")
  select(tree(), "筛选课卡类型").props.onChange({ target: { value: "class" } })
  assert.equal(value.activityName, "")
  assert(!elements(tree()).some(node => node.props["aria-label"] === "筛选活动"))
  select(tree(), "筛选课卡类型").props.onChange({ target: { value: "all" } })
  select(tree(), "筛选活动").props.onChange({ target: { value: "不存在活动" } })
  assert.equal(value.kind, "activity")
  assert.equal(entries.filter(entry => matchesCardFilters(entry, value)).length, 0)
  assert(text(select(tree(), "筛选活动")).includes("不存在活动（本周无课卡）"))
  find(tree(), node => typeof node.props.onClick === "function" && text(node) === "清除筛选").props.onClick()
  assert.deepEqual(value, EMPTY_CARD_FILTERS)
})

test("Overview's real object selector exposes activities independently of the selected teacher", () => {
  const state = stateFor({ zhou: [activity({ className: "物理教研" })], shen: [activity({ className: "周末培训", validFrom: "2026-11-02" })] })
  withOverview(state, draw => {
    let tree = draw()
    const kinds = find(tree, node => node.props.ariaLabel === "对象类型")
    assert(kinds.props.options.some(item => item.value === "activity" && item.label === "活动"))
    kinds.props.onChange("activity")
    tree = draw()
    assert(text(tree).includes("全部活动") && text(tree).includes("物理教研") && text(tree).includes("周末培训"))
    assert(text(tree).includes("1 位教师 · 学校发布"))
    find(tree, node => node.type === "button" && text(node).startsWith("物理教研")).props.onClick()
    tree = draw()
    const view = find(tree, node => node.type === ActivityView)
    assert.equal(view.props.activityName, "物理教研")
    assert.equal(state.selectedTeacher, "lin")
  })
})

test("ActivityView renders teacher and location, connects details, and retains collisions with hidden teaching lessons", () => {
  const state = stateFor({ lin: [activity(), activity({ key: "lesson", kind: "class", className: "教师同时授课", room: "教研室" })], zhou: [activity({ className: "另一活动", weekday: 2 })] })
  const html = renderActivity(state, "学科研讨")
  assert(html.includes("显示 1 / 1 项安排 · 1 张课卡"))
  const grid = gridOnly(html)
  assert(grid.includes("学科研讨") && grid.includes("示例林老师") && grid.includes("教研室"))
  assert(!grid.includes("教师同时授课") && !grid.includes("另一活动"))
  assert(grid.includes("教师冲突 · 教室冲突"))
  assert(html.includes("教师同时授课"), "the collision explanation retains its hidden teaching counterpart")
  let opened
  withSchool(state, () => {
    const tree = ActivityView({ activityName: "学科研讨", weekStart: "2026-10-26", clockDate: "2026-10-26", onCard: entry => { opened = entry } })
    const week = find(tree, node => node.type === WeekGrid)
    assert.equal(week.props.entries.length, 3)
    const event = week.props.entries.find(entry => entry.kind === "activity")
    week.props.onCardClick(event)
    assert.equal(opened, event)
    assert.equal(week.props.calendarSourceEntries("2026-10-26").length, 3)
  })
})

test("unrelated simultaneous activities do not create student-roster reviews, but teacher and room collisions remain", () => {
  const one = { ...activity(), date: "2026-10-26", teacherId: "lin" }
  const other = { ...one, key: "two", teacherId: "zhou", room: "另一会议室" }
  assert.deepEqual(assessSchedule([one, other]), { conflicts: [], reviews: [] })
  const lesson = { ...other, kind: "class" }
  assert.deepEqual(assessSchedule([one, lesson]), { conflicts: [], reviews: [] })
  const overlap = assessSchedule([one, { ...lesson, teacherId: "lin", room: "教研室" }])
  assert.deepEqual(overlap.conflicts.map(issue => issue.type).sort(), ["room", "teacher"])
  assert.equal(overlap.reviews.length, 0)
})

test("activity view projects cross-week makeup sources and holiday cancellation through the existing calendar", () => {
  const state = stateFor({ shen: [activity({ validFrom: "2026-10-19", validTo: "2026-10-19" })] })
  const swap = { id: "activity-swap", kind: "swap", date: "2026-10-19", targetDate: "2026-10-31", scope: "全校", note: "跨周调休" }
  assert.equal(schoolActivityEntries(state, "2026-10-26").length, 0)
  withOverview(state, draw => {
    find(draw(), node => node.props.ariaLabel === "对象类型").props.onChange("activity")
    const tree = draw()
    assert(text(tree).includes("学科研讨") && text(tree).includes("1 位教师 · 学校发布"))
    assert(!text(tree).includes("本周暂无安排"), "the directory must not contradict the calendar-projected weekly grid")
  }, [swap])
  const moved = renderActivity(state, "学科研讨", [swap])
  assert(moved.includes("显示 1 / 1 项安排 · 1 张课卡"))
  assert(gridOnly(moved).includes("示例沈老师") && gridOnly(moved).includes("学科研讨"))
  assert(gridOnly(moved).includes("补 10/19"))
  const holiday = { id: "cancel-makeup", kind: "holiday", date: "2026-10-31", scope: "全校" }
  const stopped = renderActivity(state, "学科研讨", [swap, holiday])
  assert(stopped.includes("显示 0 / 0 项安排 · 0 张课卡") && stopped.includes("本周暂无活动安排"))
  assert(!gridOnly(stopped).includes("学科研讨"))
})

test("zero-result activity filtering keeps an actionable filter bar and counts only the selected activity scope", () => {
  const state = stateFor({ lin: [activity(), activity({ key: "class", kind: "class" })] })
  const html = withSchool(state, () => render(providers(h(WeekGrid, {
    entries: schoolOverviewEntries(state, "2026-10-26"), weekStart: "2026-10-26", clockDate: "2026-10-26",
    displayControls: "admin", showTeacher: true, canonical: true,
    filterScope: { kind: "activity" }, initialFilters: { query: "不存在" },
  }))))
  assert(html.includes("显示 0 / 1 张课卡"))
  assert(html.includes("没有符合条件的课卡") && html.includes("清除筛选"))
  assert(html.includes('aria-label="筛选活动"') && !html.includes('aria-label="筛选教学班"'))
})
