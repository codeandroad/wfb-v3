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

const { createElement: h } = require("react")
const { renderToStaticMarkup: render } = require("react-dom/server")
const { entryHomeroom, entryStudentRoster, assessSchedule, scheduleEntryKey } = require("../lib/timetable/conflict-display.ts")
const { detectConflicts, BASELINE_TEMPLATES, projectWeek } = require("../lib/timetable/data.ts")
const { effectiveWithCalendar } = require("../lib/timetable/calendar-store.ts")
const { ScheduleIssues, ClassCard, WeekGrid } = require("../components/timetable/week-grid.tsx")
const { DemoProvider } = require("../lib/demo/store.tsx")
const { MtProvider } = require("../lib/mt/store.tsx")
const { TeachingProvider } = require("../lib/teaching/store.tsx")
const { TimetableProvider } = require("../lib/timetable/store.tsx")
const fixture = require("../lib/teaching/fixture.json")
const teaching = () => ({ classes: structuredClone(fixture.teachingClasses), responsibilities: structuredClone(fixture.responsibilities) })
const entry = overrides => ({ key: "test-lesson", teacherId: "lin", date: "2026-10-30", weekday: 5, periodId: "m3", className: "高一1班 • 数学", subject: "数学", room: "D101", ...overrides })
const types = assessment => assessment.conflicts.map(conflict => conflict.type).sort()
const pair = () => [entry(), entry({ key: "other", teacherId: "zhou", room: "D102", className: "高一1班 • 物理", subject: "物理" })]
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test("administrative placement selects classes, not every lesson of their teachers", () => {
  const state = teaching()
  const entries = Object.entries(BASELINE_TEMPLATES).flatMap(([teacher, template]) => projectWeek(template, "2026-10-26", teacher))
  const h2 = entries.filter(item => entryHomeroom(item, state) === "ac-g1c2")
  const fridayThird = h2.filter(item => item.date === "2026-10-30" && item.periodId === "m3")
  assert(fridayThird.some(item => item.className === "高一2班 • 历史"))
  assert(!h2.some(item => item.className === "高一1班 • 数学"))
  assert(!h2.some(item => item.className === "高一1班 • 物理"))
  assert(h2.some(item => item.className === "高一2班 • 数学"))
  assert(h2.some(item => item.className === "高一2班 • 计算机"))
  const h1 = entries.filter(item => entryHomeroom(item, state) === "ac-g1c1")
  assert(h1.some(item => item.className === "高一1班 • 化学" && item.teacherId === "chen"), "H1 chemistry must not be omitted by the old teacher-membership shortcut")
  assert(h1.some(item => item.className === "高一1班 • 数学"))
})

test("registered placement and validity override static fallbacks, including explicit no placement", () => {
  const state = teaching()
  const mathematics = state.classes.find(item => item.id === "MAT1")
  mathematics.placementHomeroomId = "H2"
  assert.equal(entryHomeroom(entry(), state), "ac-g1c2")
  mathematics.placementHomeroomId = null
  assert.equal(entryHomeroom(entry(), state), null)
  mathematics.placementHomeroomId = "H1"
  assert.equal(entryHomeroom(entry({ date: mathematics.validToExclusive }), state), null)
  assert.equal(entryHomeroom(entry({ date: "2026-08-31" }), state), null)
  assert.equal(entryHomeroom(entry({ kind: "activity" }), state), null)
  assert.equal(entryHomeroom(entry({ className: "高一2班 • 历史", subject: "历史", teacherId: "zhao" }), state), "ac-g1c2")
  assert.equal(entryHomeroom(entry({ className: "临时自由组合班" }), state), null)
})

test("task student rosters use the dated membership domain and never silently fall back to catalog students", () => {
  const state = teaching()
  const lesson = entry({ taskId: "TASK_MATH_G1_P1", group: "P1" })
  const memberships = freeze({ TASK_MATH_G1_P1: [
    { studentId: "test-until", from: "2026-09-01", until: "2026-10-30" },
    { studentId: "test-from", from: "2026-10-30", until: "2027-01-31" },
    { studentId: "test-from", from: "2026-10-30", until: "2027-01-31" },
    { studentId: "test-future", from: "2026-10-31", until: "2027-01-31" },
  ] })
  assert.deepEqual(entryStudentRoster(lesson, memberships, state), { namespace: "mt", ids: ["test-from", "test-until"] })
  assert.equal(entryStudentRoster(lesson, null, state), null, "unavailable task memberships must remain unknown, without falling back to catalog students")
  assert.deepEqual(entryStudentRoster({ ...lesson, date: "2026-10-31" }, memberships, state), { namespace: "mt", ids: ["test-from", "test-future"] })
  for (const changed of [lesson, { ...lesson, taskId: "unknown-task" }, { ...lesson, className: "高一2班 • 数学" }, { ...lesson, date: "2027-02-01" }]) {
    const source = changed === lesson ? {} : memberships
    assert.equal(entryStudentRoster(changed, source, state), null)
  }
  assert.deepEqual(entryStudentRoster(lesson, { TASK_MATH_G1_P1: [] }, state), { namespace: "mt", ids: [] })
})

test("catalog rosters respect responsibility subset, inheritance and active dates", () => {
  const state = teaching()
  const lesson = entry({ group: "P1" })
  const cls = state.classes.find(item => item.id === "MAT1")
  const responsibility = state.responsibilities.find(item => item.id === "MAT1-P1")
  responsibility.studentIds = ["subset-student"]
  assert.deepEqual(entryStudentRoster(lesson, {}, state), { namespace: "catalog", ids: ["subset-student"] })
  responsibility.rosterMode = "INHERIT"
  assert.deepEqual(entryStudentRoster(lesson, {}, state), { namespace: "catalog", ids: cls.studentIds })
  responsibility.validToExclusive = lesson.date
  assert.equal(entryStudentRoster(lesson, {}, state), null)
  assert.equal(entryStudentRoster({ ...lesson, group: "unregistered-division" }, {}, state), null)
  assert.equal(entryStudentRoster({ ...lesson, group: undefined }, {}, state), null, "a split class is not assumed to be an authorized whole-class lesson")
  cls.wholeTeacherIds.push("T-LIN")
  assert.deepEqual(entryStudentRoster({ ...lesson, group: undefined }, {}, state), { namespace: "catalog", ids: cls.studentIds })
  assert.equal(entryStudentRoster({ ...lesson, kind: "activity" }, {}, state), null)
})

test("same key in different teachers remains two lessons and simultaneous resource conflicts are all reported", () => {
  const a = entry({ studentGroup: "known-cohort" })
  const b = entry({ teacherId: "zhou", studentGroup: "known-cohort" })
  assert.notEqual(scheduleEntryKey(a), scheduleEntryKey(b))
  assert.deepEqual(detectConflicts([a, b]).map(conflict => conflict.type).sort(), ["room", "student"])
  const sameTeacher = { ...b, key: "another-slot", teacherId: a.teacherId }
  assert.deepEqual(detectConflicts([a, sameTeacher]).map(conflict => conflict.type).sort(), ["room", "student", "teacher"])
  assert.equal(detectConflicts([a, { ...b, date: "2026-10-29" }]).length, 0)
  assert.equal(detectConflicts([a, { ...b, periodId: "m4" }]).length, 0)
})

test("known overlapping students add a conflict independently of teacher and room conflicts", () => {
  const entries = freeze(pair())
  const result = assessSchedule(entries, item => ({ namespace: "mt", ids: item.teacherId === "lin" ? ["one", "one", "two"] : ["one", "three"] }))
  assert.deepEqual(types(result), ["student"])
  assert.equal(result.reviews.length, 0)
  assert.match(result.conflicts[0].reason, /^1 名学生/)
  const sameResources = [{ ...entries[0] }, { ...entries[1], teacherId: "lin", room: "D101" }]
  assert.deepEqual(types(assessSchedule(sameResources, () => ({ namespace: "catalog", ids: ["shared"] }))), ["room", "student", "teacher"])
  const explicit = sameResources.map(item => ({ ...item, studentGroup: "same-known-group" }))
  assert.equal(assessSchedule(explicit, () => ({ namespace: "catalog", ids: ["shared"] })).conflicts.filter(item => item.type === "student").length, 1)
})

test("unknown and cross-domain student scopes are reviews, while known disjoint or empty rosters are not", () => {
  const entries = pair()
  const unknown = assessSchedule(entries)
  assert.equal(unknown.conflicts.length, 0)
  assert.equal(unknown.reviews.length, 1)
  assert.match(unknown.reviews[0].reason, /名单不完整/)
  const crossDomain = assessSchedule(entries, item => ({ namespace: item.teacherId === "lin" ? "mt" : "catalog", ids: ["same-spelling-is-not-identity"] }))
  assert.equal(crossDomain.conflicts.length, 0)
  assert.equal(crossDomain.reviews.length, 1)
  assert.match(crossDomain.reviews[0].reason, /不同数据范围/)
  const disjoint = assessSchedule(entries, item => ({ namespace: "mt", ids: [item.teacherId] }))
  assert.deepEqual(disjoint, { conflicts: [], reviews: [] })
  assert.deepEqual(assessSchedule(entries, () => ({ namespace: "catalog", ids: [] })), { conflicts: [], reviews: [] })
  assert.deepEqual(assessSchedule(entries, item => item.teacherId === "lin" ? { namespace: "mt", ids: [] } : null), { conflicts: [], reviews: [] })
  assert.equal(assessSchedule([entries[0], { ...entries[1], room: "D101" }]).reviews.length, 0, "known room collisions already explain this pair")
})

test("legacy student-group labels cannot overrule authoritative disjoint rosters", () => {
  const entries = freeze(pair().map(item => ({ ...item, studentGroup: "legacy-shared-label" })))
  const result = assessSchedule(entries, item => ({ namespace: "mt", ids: [item.teacherId === "lin" ? "student-a" : "student-b"] }))
  assert.deepEqual(result, { conflicts: [], reviews: [] }, "a shared old label is not evidence of overlapping current students")
})

test("legacy student-group labels cannot join identities across roster namespaces", () => {
  const entries = freeze(pair().map(item => ({ ...item, studentGroup: "legacy-shared-label" })))
  const result = assessSchedule(entries, item => ({ namespace: item.teacherId === "lin" ? "mt" : "catalog", ids: ["same-text-id"] }))
  assert.equal(result.conflicts.length, 0)
  assert.equal(result.reviews.length, 1)
  assert.match(result.reviews[0].reason, /不同数据范围/)
})

test("legacy student-group labels cannot create a conflict when a current roster is known empty", () => {
  const entries = freeze(pair().map(item => ({ ...item, studentGroup: "legacy-shared-label" })))
  for (const other of [{ namespace: "mt", ids: ["student-a"] }, { namespace: "catalog", ids: ["student-a"] }, null]) {
    assert.deepEqual(assessSchedule(entries, item => item.teacherId === "lin" ? { namespace: "mt", ids: [] } : other), { conflicts: [], reviews: [] })
  }
})

test("duplicate projections are deduplicated without removing different teachers or changing input", () => {
  const [a, b] = pair()
  const entries = freeze([a, { ...a }, { ...b, key: a.key, room: a.room }, { ...b, key: a.key, room: a.room }])
  const before = JSON.stringify(entries)
  const result = assessSchedule(entries)
  assert.deepEqual(types(result), ["room"])
  assert.equal(result.reviews.length, 0)
  assert.equal(JSON.stringify(entries), before)
  assert.deepEqual(assessSchedule([a, { ...a }]), { conflicts: [], reviews: [] })
})

test("calendar stops exclude source conflicts while makeup lessons are assessed on their actual target dates", () => {
  const [a, other] = pair()
  const b = { ...other, room: a.room }
  const dates = ["2026-10-30", "2026-10-31"]
  const holiday = { id: "stop", kind: "holiday", date: a.date, scope: "全校", note: "合成停课" }
  const stopped = effectiveWithCalendar([holiday], [a, b], dates)
  assert.equal(stopped.effective.length, 0)
  assert.deepEqual(assessSchedule(stopped.effective), { conflicts: [], reviews: [] })
  const swap = { id: "swap", kind: "swap", date: a.date, targetDate: "2026-10-31", scope: "全校", note: "合成补课" }
  const projected = effectiveWithCalendar([swap], [a, b], dates)
  assert(projected.stopped.has(a.date))
  assert.equal(projected.effective.length, 2)
  assert(projected.effective.every(item => item.date === "2026-10-31" && item.makeupFrom === a.date))
  const result = assessSchedule(projected.effective)
  assert.deepEqual(types(result), ["room"])
  assert.equal(result.conflicts[0].date, "2026-10-31")
  const blockedTarget = effectiveWithCalendar([swap, { ...holiday, date: swap.targetDate }], [a, b], dates)
  assert.deepEqual(assessSchedule(blockedTarget.effective), { conflicts: [], reviews: [] })
})

test("summary and cards distinguish confirmed conflicts from unresolved simultaneous arrangements", () => {
  const entries = pair()
  const conflict = assessSchedule([entries[0], { ...entries[1], room: entries[0].room }])
  const review = assessSchedule(entries)
  const summary = render(h(ScheduleIssues, { assessment: { conflicts: conflict.conflicts, reviews: review.reviews } }))
  assert(summary.includes("1 项冲突 · 1 项待核对"))
  assert(summary.includes("示例林老师") && summary.includes("示例周老师"))
  assert(summary.includes("第3节") && summary.includes("10/30"))
  assert(summary.includes(conflict.conflicts[0].reason))
  assert(summary.includes(review.reviews[0].reason))
  assert.equal(render(h(ScheduleIssues, { assessment: { conflicts: [], reviews: [] } })), "")
  const renderCard = meta => render(h(DemoProvider, null, h(MtProvider, null, h(ClassCard, { entry: entries[0], canonical: true, meta }))))
  const confirmed = renderCard({ conflict: true, conflictLabels: ["教室冲突", "学生冲突"], conflictReasons: ["教室被占用", "学生时间重叠"] })
  assert(confirmed.includes("教室冲突 · 学生冲突"))
  assert(confirmed.includes('title="教室被占用；学生时间重叠"'))
  assert(confirmed.includes("ring-destructive"))
  const unresolved = renderCard({ reviewReasons: ["学生范围尚未核对"] })
  assert(unresolved.includes("同时段安排 · 待核对"))
  assert(unresolved.includes('title="学生范围尚未核对"'))
  assert(!unresolved.includes("ring-destructive"))
})

test("WeekGrid computes real card and summary warnings without supplied conflict metadata, and stops exclude them", () => {
  const renderGrid = (entries, calendarEvents = []) => render(
    h(DemoProvider, null,
      h(TeachingProvider, null,
        h(MtProvider, null,
          h(TimetableProvider, { clock: "2026-10-26T08:00" },
            h(WeekGrid, { weekStart: "2026-10-26", entries, calendarEvents, canonical: true, showTeacher: true, displayControls: "admin" }),
          ),
        ),
      ),
    ),
  )
  const simultaneous = [entry({ className: "未登记教学安排甲" }), entry({ key: "independent-slot", className: "未登记教学安排乙" })]
  const conflict = renderGrid(simultaneous)
  assert(conflict.includes("2 项冲突 · 0 项待核对"), "the live grid summary must assess teacher and room collisions itself")
  assert.equal((conflict.match(/教师冲突 · 教室冲突/g) ?? []).length, 2, "both real lesson cards must receive the computed conflict labels")
  assert.equal((conflict.match(/ring-destructive\/60/g) ?? []).length, 2)
  assert(conflict.includes("同一教师在重叠时间被安排两节独立课次"))
  assert(conflict.includes("教室 D101 在重叠时间被两节课次占用"))

  const unknown = [simultaneous[0], { ...simultaneous[1], teacherId: "zhou", room: "D102" }]
  const review = renderGrid(unknown)
  assert(review.includes("0 项冲突 · 1 项待核对"))
  assert.equal((review.match(/同时段安排 · 待核对/g) ?? []).length, 2, "both cards must show the grid's unknown-student-scope warning")
  assert(!review.includes("ring-destructive/60"))

  const holiday = [{ id: "grid-test-holiday", kind: "holiday", date: "2026-10-30", scope: "全校", note: "合成停课" }]
  const stopped = renderGrid(simultaneous, holiday)
  assert(!stopped.includes("当前范围："), "stopped lessons must not contribute to the summary")
  assert(!stopped.includes("教师冲突") && !stopped.includes("教室冲突") && !stopped.includes("同时段安排 · 待核对"))
  assert.equal((stopped.match(/停课／调休（本日不授课）/g) ?? []).length, 2, "stopped cards remain visible with their proper non-teaching state")
})
