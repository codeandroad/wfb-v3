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

const { groupActivityEntries } = require("../lib/timetable/activity-groups.ts")
const { EMPTY_CARD_FILTERS, matchesCardFilters } = require("../lib/timetable/display.ts")
const { assessSchedule } = require("../lib/timetable/conflict-display.ts")
const React = require("react"), { createElement: h } = React
const { renderToStaticMarkup: render } = require("react-dom/server")
const { ActivityGroupCard, ActivityGroupDialog, activityPlaceSummary } = require("../components/timetable/activity-group-card.tsx")
const { WeekGrid, ClassCard } = require("../components/timetable/week-grid.tsx")
const { TimetableFilterBar } = require("../components/timetable/card-filters.tsx")
const { appearanceKey } = require("../lib/timetable/display.ts")
const { DemoProvider } = require("../lib/demo/store.tsx")
const { TeachingProvider } = require("../lib/teaching/store.tsx")
const { TimetableProvider } = require("../lib/timetable/store.tsx")
const mtStore = require("../lib/mt/store.tsx")
const kit = require("../components/kit.tsx")

const entry = overrides => ({ key: "meeting", kind: "activity", className: "学科研讨", date: "2026-10-26", weekday: 1, periodId: "m3", teacherId: "lin", subject: "数学", room: "教研室", ...overrides })
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test("same-date, slot and complete activity names form one display group with distinct teachers and places", () => {
  const entries = [entry(), entry({ key: "zhou-meeting", teacherId: "zhou" }), entry({ key: "lin-followup", room: "第二会议室" })]
  const [group] = groupActivityEntries(entries)
  assert.equal(groupActivityEntries(entries).length, 1)
  assert.deepEqual(group.entries, entries)
  assert.deepEqual(group.teacherIds, ["lin", "zhou"])
  assert.deepEqual(group.rooms, ["教研室", "第二会议室"])
  assert.equal(group.unknownRoomCount, 0)
})

test("different dates, periods, exact names and non-activity kinds never merge", () => {
  const entries = [entry(), entry({ date: "2026-10-27" }), entry({ periodId: "m4" }), entry({ className: "学科研讨 " }), entry({ kind: "class" }), entry({ kind: undefined }), entry({ kind: "history" }), entry({ kind: "class", key: "second-lesson" })]
  const groups = groupActivityEntries(entries)
  assert.equal(groups.length, entries.length)
  assert(groups.every(group => group.entries.length === 1))
  assert.equal(new Set(groups.map(group => group.key)).size, groups.length)
})

test("repeated business entries remain separate arrangements even when their display group is shared", () => {
  const activity = entry()
  const groups = groupActivityEntries([activity, activity, { ...activity, teacherId: "zhou" }])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].entries.length, 3, "grouping cannot discard records or infer duplicate business identities")
  assert.deepEqual(groups[0].teacherIds, ["lin", "zhou"])
  const lesson = { ...activity, kind: "class" }
  const lessons = groupActivityEntries([lesson, lesson])
  assert.equal(lessons.length, 2)
  assert.notEqual(lessons[0].key, lessons[1].key)
})

test("unknown places count per arrangement while known room labels deduplicate without inventing an assignment", () => {
  const entries = [entry({ room: null }), entry({ room: undefined }), entry({ room: "" }), entry({ room: "  " }), entry({ room: " D101 " }), entry({ room: "D101" }), entry({ room: "D102" })]
  const [group] = groupActivityEntries(entries)
  assert.equal(group.unknownRoomCount, 4)
  assert.deepEqual(group.rooms, ["D101", "D102"])
  assert.equal(group.entries[0].room, null)
  assert.equal(group.entries[4].room, " D101 ", "normalizing a summary label must not rewrite its source arrangement")
})

test("grouping preserves first occurrence order, stable activity keys, and immutable source records", () => {
  const a = entry(), b = entry({ key: "second", className: "另一活动" }), c = entry({ key: "third", teacherId: "zhou" })
  const source = freeze([a, b, c]), groups = groupActivityEntries(source)
  assert.deepEqual(groups.map(group => group.entries.map(item => item.key)), [["meeting", "third"], ["second"]])
  assert.equal(groups[0].entries[0], source[0])
  assert.equal(groups[0].entries[1], source[2])
  assert.equal(groupActivityEntries([c, a])[0].key, groups[0].key)
  groups[0].teacherIds.push("display-only")
  groups[0].entries.pop()
  assert.equal(source.length, 3)
  assert.equal(source[2].teacherId, "zhou")
  assert.deepEqual(groupActivityEntries([]), [])
})

test("structured keys cannot collide through delimiter characters in dates, periods or activity names", () => {
  const groups = groupActivityEntries([entry({ periodId: "m3|planning", className: "day" }), entry({ periodId: "m3", className: "planning|day" }), entry({ className: '["activity","2026-10-26","m3"]' })])
  assert.equal(groups.length, 3)
  assert.equal(new Set(groups.map(group => group.key)).size, 3)
})

test("filtering before grouping yields only visible arrangements without removing full-source conflicts", () => {
  const entries = [entry(), entry({ key: "same-teacher-double-booking" }), entry({ key: "zhou", teacherId: "zhou", room: "第二会议室" })]
  const conflicts = assessSchedule(entries)
  assert.deepEqual(conflicts.conflicts.map(issue => issue.type).sort(), ["room", "teacher"])
  const visible = entries.filter(item => matchesCardFilters(item, { ...EMPTY_CARD_FILTERS, kind: "activity", teacherId: "zhou" }))
  const [group] = groupActivityEntries(visible)
  assert.deepEqual(group.teacherIds, ["zhou"])
  assert.equal(group.entries.length, 1)
  assert.equal(group.entries[0], entries[2])
  assert.deepEqual(assessSchedule(entries), conflicts)
})

const elements = node => Array.isArray(node) ? node.flatMap(elements) : node && typeof node === "object" && node.props ? [node, ...elements(node.props.children)] : []
const find = (tree, type) => { const node = elements(tree).find(node => node.type === type); assert(node, `missing ${type.name}`); return node }
const outerStyle = html => html.slice(0, html.indexOf(">") + 1).match(/\bstyle="([^"]*)"/)?.[1] ?? ""
const gridOnly = html => html.slice(html.indexOf('<div data-layout="'))
const appearance = styles => ({ styles, viewer: "u-lin", mode: "admin" })
const key = (part, id = "学科研讨") => appearanceKey("u-lin", "admin", part, id)
const providers = child => h(DemoProvider, null, h(TeachingProvider, null, h(mtStore.MtProvider, null, h(TimetableProvider, { clock: "2026-10-26T08:00" }, child))))
const gridProps = entries => ({ entries, weekStart: "2026-10-26", clockDate: "2026-10-26", canonical: true, showTeacher: true, displayControls: "admin", filterScope: { kind: "activity" }, groupActivities: true, calendarEvents: [] })

// The real providers, grid, cards, assessment and filters render through SSR. Only the
// grid's local state/ref slots persist across renders; no browser or layout is claimed.
function gridHarness(initial, styles = {}) {
  let props = initial, tree
  const slots = [], refs = []
  function Capture() {
    const oldState = React.useState, oldRef = React.useRef
    let stateCursor = 0, refCursor = 0
    React.useState = initial => {
      const index = stateCursor++
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
      return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next }]
    }
    React.useRef = value => { const index = refCursor++; return refs[index] ?? (refs[index] = { current: value }) }
    try { tree = WeekGrid(props); return tree }
    finally { React.useState = oldState; React.useRef = oldRef }
  }
  return {
    get tree() { return tree },
    draw(patch = {}) {
      props = { ...props, ...patch }
      const previousMt = mtStore.useMt, previousModal = kit.Modal
      mtStore.useMt = () => { const mt = previousMt(); return { ...mt, biz: { ...mt.biz, styles } } }
      kit.Modal = ({ title, desc, children, footer }) => h("section", { "data-test-dialog": true }, h("h2", null, title), h("p", null, desc), children, footer)
      try { return render(providers(h(Capture))) }
      finally { mtStore.useMt = previousMt; kit.Modal = previousModal }
    },
  }
}

test("summary cards show distinct counts and place coverage without stacking teacher names or inheriting the first teacher's defaults", () => {
  const group = groupActivityEntries([entry(), entry({ key: "zhou", teacherId: "zhou", room: "另一会议室" }), entry({ key: "lin-unknown", room: null })])[0]
  assert.equal(activityPlaceSummary(group), "2 处场所 · 1 项未安排场所")
  const styles = { [key("TEACHER", "lin")]: { bg: "rose", color: "brick" }, [key("TEACHER", "zhou")]: { bg: "sky", color: "ink" } }
  const plain = render(h(ActivityGroupCard, { group, metas: [{}, {}, {}], appearance: appearance(styles), onClick: () => {} }))
  assert(plain.includes("2 位教师 · 3 项安排") && plain.includes("2 处场所 · 1 项未安排场所"))
  assert(!plain.includes("示例林老师") && !plain.includes("示例周老师"))
  assert.equal(outerStyle(plain), "", "summary must not arbitrarily use a member teacher's surface")
  const specific = { ...styles, [key("ACTIVITY")]: { bg: "mint", color: "teal" }, [key("ACTIVITY_SURFACE")]: { borderWidth: 2 }, [key("ACTIVITY_ROOM_TEXT")]: { color: "plum" } }
  const styled = render(h(ActivityGroupCard, { group, metas: [{}, {}, {}], appearance: appearance(specific), onClick: () => {} }))
  assert(outerStyle(styled).includes("background-color:#e8f3ec") && outerStyle(styled).includes("border-width:2px"))
  assert(styled.includes("color:#1f6f74") && styled.includes("color:#6e3f6a"))
  const oneTeacher = groupActivityEntries([entry(), entry({ key: "another-arrangement" })])[0]
  assert(render(h(ActivityGroupCard, { group: oneTeacher, metas: [{}, {}], onClick: () => {} })).includes("1 位教师 · 2 项安排"))
  assert.equal(activityPlaceSummary(groupActivityEntries([entry({ room: null }), entry({ room: null })])[0]), "2 项未安排场所")
})

test("summary states count affected arrangements instead of copying the first member's state to everyone", () => {
  const group = groupActivityEntries([entry(), entry({ key: "swap", teacherId: "zhou", makeupFrom: "2026-10-19" }), entry({ key: "personal", teacherId: "chen", origin: "personal" })])[0]
  const metas = [{}, { conflict: true, conflictLabels: ["教师冲突"], conflictReasons: ["与隐藏课程冲突"] }, {}]
  const html = render(h(ActivityGroupCard, { group, metas, appearance: appearance({ [key("ACTIVITY")]: { bg: "mint" } }), onClick: () => {} }))
  assert.equal(outerStyle(html), "")
  assert(html.includes("1 项补课") && html.includes("1 项草稿／个人调整"))
  assert(!html.includes("3 项补课") && !html.includes("3 项草稿"))
  assert(html.includes("教师冲突 · 1 项安排") && html.includes("ring-destructive/60"))
  const stopped = render(h(ActivityGroupCard, { group, metas: [{ voided: true }, { voided: true }, { voided: true }], onClick: () => {} }))
  assert(stopped.includes("3 项停课／调休") && stopped.includes("border-dashed"))
})

test("the real grid groups only visible same-slot activities and keeps singleton names and hidden-course conflicts", () => {
  const entries = [entry(), entry({ key: "zhou", teacherId: "zhou", room: "第二会议室" }), entry({ key: "chen-later", teacherId: "chen", periodId: "m4", room: "第三会议室" }), entry({ key: "hidden-lesson", kind: "class", className: "隐藏教学安排" })]
  const harness = gridHarness(gridProps(entries), { [key("TEACHER", "lin")]: { bg: "mint", color: "brick" } })
  const html = harness.draw()
  assert(html.includes("显示 3 / 3 项安排 · 2 张课卡"))
  assert.equal((html.match(/data-activity-summary/g) ?? []).length, 1)
  const summary = html.match(/<button\b[^>]*data-activity-summary[\s\S]*?<\/button>/)?.[0]
  assert(summary.includes("2 位教师 · 2 项安排"))
  assert(!summary.includes("示例林老师") && !summary.includes("示例周老师"))
  assert(gridOnly(html).includes("示例陈老师"), "a different-time singleton retains its original card")
  assert(summary.includes("教师冲突 · 教室冲突"))
  assert(!gridOnly(html).includes("隐藏教学安排"))
  find(harness.tree, TimetableFilterBar).props.onChange({ ...EMPTY_CARD_FILTERS, teacherId: "lin" })
  const filtered = harness.draw()
  assert(filtered.includes("显示 1 / 3 项安排 · 1 张课卡"))
  assert(!filtered.includes("data-activity-summary"))
  assert(gridOnly(filtered).includes("示例林老师") && !gridOnly(filtered).includes("示例周老师"))
  assert(gridOnly(filtered).includes("background-color:#e8f3ec") && gridOnly(filtered).includes("color:#a2422e"), "the remaining singleton regains its own teacher's default appearance")
  assert(gridOnly(filtered).includes("教师冲突 · 教室冲突"), "display filtering must not remove the hidden teaching conflict")
})

test("grouping remains opt-in for the read-only admin activity view", () => {
  const entries = [entry(), entry({ key: "zhou", teacherId: "zhou", room: "第二会议室" })]
  for (const override of [{ groupActivities: false }, { editing: true }, { displayControls: "teacher" }, { filterScope: undefined }]) {
    const html = gridHarness({ ...gridProps(entries), ...override }).draw()
    assert(!html.includes("data-activity-summary"), JSON.stringify(override))
    assert(gridOnly(html).includes("示例林老师") && gridOnly(html).includes("示例周老师"))
  }
})

test("opening a real grouped card reveals all individual cards with their own styles, states and detail callbacks", () => {
  const entries = [entry(), entry({ key: "zhou", teacherId: "zhou", room: null, makeupFrom: "2026-10-19" })]
  let selected
  const styles = { [key("TEACHER", "lin")]: { color: "brick", bg: "rose" }, [key("TEACHER", "zhou")]: { color: "ink", bg: "sky" } }
  const harness = gridHarness({ ...gridProps(entries), onCardClick: value => { selected = value } }, styles)
  harness.draw()
  find(harness.tree, ActivityGroupCard).props.onClick()
  const html = harness.draw()
  const dialog = find(harness.tree, ActivityGroupDialog)
  const cards = elements(dialog).filter(node => node.type === ClassCard)
  assert.equal(cards.length, 2)
  assert.equal(cards[0].props.entry, entries[0])
  assert.equal(cards[1].props.entry, entries[1])
  assert(html.includes("示例林老师") && html.includes("示例周老师") && html.includes("未安排场所"))
  const dialogHtml = html.match(/<section\b[^>]*data-test-dialog[\s\S]*?<\/section>/)?.[0]
  assert(dialogHtml.includes("background-color:#f8e9e6") && dialogHtml.includes("color:#a2422e"))
  assert(dialogHtml.includes("color:#2d4f7c") && !dialogHtml.includes("background-color:#e7eff8"), "makeup cards retain their status surface while keeping personal text color")
  assert.equal((dialogHtml.match(/补 10\/19/g) ?? []).length, 1)
  cards[1].props.onClick()
  assert.equal(selected, entries[1])
  harness.draw()
  assert(!elements(harness.tree).some(node => node.type === ActivityGroupDialog))
})

test("an open activity group closes when week, filters or selected object changes and does not revive when returning", () => {
  const entries = [entry(), entry({ key: "zhou", teacherId: "zhou", room: "第二会议室" })]
  for (const context of ["week", "filter", "scope"]) {
    const harness = gridHarness(gridProps(entries))
    harness.draw()
    find(harness.tree, ActivityGroupCard).props.onClick()
    harness.draw()
    assert(elements(harness.tree).some(node => node.type === ActivityGroupDialog))
    if (context === "filter") find(harness.tree, TimetableFilterBar).props.onChange({ ...EMPTY_CARD_FILTERS, query: "学科" })
    harness.draw(context === "week" ? { weekStart: "2026-11-02" } : context === "scope" ? { filterScope: { kind: "activity", activityName: "学科研讨" } } : {})
    assert(!elements(harness.tree).some(node => node.type === ActivityGroupDialog), context)
    if (context === "filter") find(harness.tree, TimetableFilterBar).props.onChange({ ...EMPTY_CARD_FILTERS })
    harness.draw({ weekStart: "2026-10-26", filterScope: { kind: "activity" } })
    assert(!elements(harness.tree).some(node => node.type === ActivityGroupDialog), `${context}: old dialog must not revive`)
  }
})

test("open group membership recomputes from source updates and closes when only a singleton remains", () => {
  const entries = [entry(), entry({ key: "zhou", teacherId: "zhou", room: "第二会议室" }), entry({ key: "chen", teacherId: "chen", room: "第三会议室" })]
  const harness = gridHarness(gridProps(entries))
  harness.draw()
  find(harness.tree, ActivityGroupCard).props.onClick()
  harness.draw()
  assert.equal(find(harness.tree, ActivityGroupDialog).props.group.entries.length, 3)
  const revised = harness.draw({ entries: [entries[0], { ...entries[1], room: "更新后的会议室" }] })
  assert.equal(find(harness.tree, ActivityGroupDialog).props.group.entries.length, 2)
  assert.equal(find(harness.tree, ActivityGroupDialog).props.group.entries[1].room, "更新后的会议室")
  assert(revised.includes("更新后的会议室"), "same-key source changes must replace dialog details without reopening")
  assert(!revised.includes("示例陈老师"))
  const singleton = harness.draw({ entries: entries.slice(0, 1) })
  assert(!elements(harness.tree).some(node => node.type === ActivityGroupDialog))
  assert(!singleton.includes("data-activity-summary") && singleton.includes("示例林老师"))
})
