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
const { MATH_QA_DEMO_TEACHERS, MATH_QA_DEMO_ENTRIES, MATH_QA_DEMO_WEEK, MATH_QA_DEMO_DATE } = require("../lib/timetable/math-qa-demo.ts")
const { TEACHERS, TEACHER_SCHEDULES, BASELINE_TEMPLATES, teacherById } = require("../lib/timetable/data.ts")
const { MathQaDemo } = require("../components/timetable/math-qa-demo.tsx")
const { ActivityGroupCard, ActivityGroupDialog } = require("../components/timetable/activity-group-card.tsx")
const { TimetableFilterBar } = require("../components/timetable/card-filters.tsx")
const { TimetableDisplaySettings } = require("../components/timetable/display-settings.tsx")
const { CardDetail } = require("../components/timetable/detail.tsx")
const weekModule = require("../components/timetable/week-grid.tsx")
const { EMPTY_CARD_FILTERS } = require("../lib/timetable/display.ts")
const demoStore = require("../lib/demo/store.tsx")
const mtStore = require("../lib/mt/store.tsx")
const teachingStore = require("../lib/teaching/store.tsx")
const ttStore = require("../lib/timetable/store.tsx")
const kit = require("../components/kit.tsx")
const realWeekGrid = weekModule.WeekGrid
const fixtureSnapshot = JSON.stringify({ teachers: TEACHERS, schedules: TEACHER_SCHEDULES, baseline: BASELINE_TEMPLATES, entries: MATH_QA_DEMO_ENTRIES })

const elements = node => Array.isArray(node) ? node.flatMap(elements) : node && typeof node === "object" && node.props ? [node, ...elements(node.props.children)] : []
const text = node => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : node == null || typeof node === "boolean" ? "" : String(node)
const find = (tree, predicate) => { const node = elements(tree).find(predicate); assert(node, "expected component missing"); return node }
const component = (tree, type) => find(tree, node => node.type === type)
const gridOnly = html => html.slice(html.indexOf('<div data-layout="'))
const summary = html => html.match(/<button\b[^>]*data-activity-summary[\s\S]*?<\/button>/)?.[0]
const providers = child => h(demoStore.DemoProvider, null, h(teachingStore.TeachingProvider, null, h(mtStore.MtProvider, null, h(ttStore.TimetableProvider, { clock: "2026-10-26T08:00" }, child))))
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

// SSR plus component events: preserve only local UI state/ref slots between server renders.
// All providers, data projections, filters, cards and details execute their actual implementation.
function localState(run, bucket) {
  const previousState = React.useState, previousRef = React.useRef
  let cursor = 0, refCursor = 0
  React.useState = initial => {
    const index = cursor++
    if (!(index in bucket.states)) bucket.states[index] = typeof initial === "function" ? initial() : initial
    return [bucket.states[index], value => { bucket.states[index] = typeof value === "function" ? value(bucket.states[index]) : value }]
  }
  React.useRef = value => { const index = refCursor++; return bucket.refs[index] ?? (bucket.refs[index] = { current: value }) }
  try { return run() } finally { React.useState = previousState; React.useRef = previousRef }
}
function demoHarness() {
  const demoState = { states: [], refs: [] }
  let gridState = { states: [], refs: [] }, currentKey, demoTree, gridTree, gridProps
  const commands = [], writes = [], snapshots = []
  function CaptureGrid(props) {
    gridProps = props
    gridTree = localState(() => realWeekGrid(props), gridState)
    return gridTree
  }
  function CaptureDemo() {
    demoTree = localState(MathQaDemo, demoState)
    const grid = component(demoTree, CaptureGrid)
    if (currentKey !== grid.key) { gridState = { states: [], refs: [] }; currentKey = grid.key }
    return demoTree
  }
  return {
    get demoTree() { return demoTree }, get gridTree() { return gridTree }, get gridProps() { return gridProps },
    commands, writes, snapshots,
    draw() {
      const undo = [], previousWindow = global.window
      const storage = { getItem: () => null, setItem: (...args) => writes.push(args), removeItem: (...args) => writes.push(args), clear: () => writes.push(["clear"]) }
      global.window = { localStorage: storage, sessionStorage: storage }
      for (const [store, hook] of [[demoStore, "useDemo"], [mtStore, "useMt"], [teachingStore, "useTeaching"], [ttStore, "useTimetable"]]) {
        const original = store[hook]
        undo.push(() => { store[hook] = original })
        store[hook] = () => {
          const state = original()
          if (hook === "useTimetable") snapshots.push(JSON.stringify({ clock: state.clock, weekStart: state.weekStart, selectedTeacher: state.selectedTeacher, releases: state.releases, adoptions: state.adoptions, schoolDrafts: state.schoolDrafts }))
          return Object.fromEntries(Object.entries(state).map(([key, value]) => [key, typeof value === "function" ? (...args) => { commands.push([hook, key, args]); throw new Error(`read-only demo invoked ${hook}.${key}`) } : value]))
        }
      }
      const originalModal = kit.Modal
      kit.Modal = ({ open, title, desc, children, footer }) => open ? h("section", { "data-test-dialog": true }, h("h2", null, title), desc ? h("p", null, desc) : null, children, footer) : null
      weekModule.WeekGrid = CaptureGrid
      try { return render(providers(h(CaptureDemo))) }
      finally {
        weekModule.WeekGrid = realWeekGrid
        kit.Modal = originalModal
        undo.reverse().forEach(restore => restore())
        if (previousWindow === undefined) delete global.window; else global.window = previousWindow
      }
    },
  }
}
const chooseTeacher = (harness, teacherId) => {
  const filter = component(harness.gridTree, TimetableFilterBar)
  const tree = TimetableFilterBar(filter.props)
  const select = find(tree, node => node.type === "select" && node.props["aria-label"] === "筛选教师")
  select.props.onChange({ target: { value: teacherId } })
}
const clearFilters = harness => {
  const tree = TimetableFilterBar(component(harness.gridTree, TimetableFilterBar).props)
  find(tree, node => typeof node.props.onClick === "function" && text(node) === "清除筛选").props.onClick()
}

test("the demo has four dedicated mathematics identities and does not add them to school teacher lists or schedules", () => {
  assert.equal(MATH_QA_DEMO_WEEK, "2026-10-26")
  assert.equal(MATH_QA_DEMO_DATE, "2026-10-28")
  assert.equal(MATH_QA_DEMO_TEACHERS.length, 4)
  assert.equal(new Set(MATH_QA_DEMO_TEACHERS.map(teacher => teacher.id)).size, 4)
  assert.deepEqual(MATH_QA_DEMO_ENTRIES.map(entry => entry.room), ["D101", "D102", "D105", "D208"])
  for (const [i, teacher] of MATH_QA_DEMO_TEACHERS.entries()) {
    assert.equal(teacher.subject, "数学")
    assert.equal(teacherById(teacher.id), teacher)
    assert(!TEACHERS.some(person => person.id === teacher.id))
    assert(!Object.hasOwn(TEACHER_SCHEDULES, teacher.id) && !Object.hasOwn(BASELINE_TEMPLATES, teacher.id))
    const entry = MATH_QA_DEMO_ENTRIES[i]
    assert.equal(entry.teacherId, teacher.id)
    assert.equal(entry.date, MATH_QA_DEMO_DATE)
    assert.equal(entry.weekday, 3)
    assert.equal(entry.periodId, "a3")
    assert.equal(entry.className, "数学答疑")
    assert.equal(entry.kind, "activity")
  }
  assert.equal(teacherById("non-existent-demo"), undefined)
  freeze(MATH_QA_DEMO_ENTRIES)
})

test("MathQaDemo renders the actual admin grid as four arrangements in one compact summary with no style mutation entry", () => {
  const harness = demoHarness(), html = harness.draw()
  assert.equal(harness.gridProps.entries, MATH_QA_DEMO_ENTRIES)
  assert.equal(harness.gridProps.weekStart, MATH_QA_DEMO_WEEK)
  assert.equal(harness.gridProps.clockDate, MATH_QA_DEMO_DATE)
  assert.deepEqual(harness.gridProps.calendarEvents, [])
  assert.equal(harness.gridProps.allowStyleEditing, false)
  assert(html.includes("显示 4 / 4 项安排 · 1 张课卡"))
  assert.equal((html.match(/data-activity-summary/g) ?? []).length, 1)
  assert(summary(html).includes("4 位教师 · 4 项安排") && summary(html).includes("4 处场所"))
  for (const teacher of MATH_QA_DEMO_TEACHERS) assert(!summary(html).includes(teacher.name))
  assert(!elements(harness.gridTree).some(node => text(node) === "显示样式"))
  assert(!html.includes("教师冲突") && !html.includes("教室冲突") && !html.includes("学生名单不完整"))
})

test("real teacher filtering shows one named card and clearing restores the four-person summary", () => {
  const harness = demoHarness()
  harness.draw()
  const selected = MATH_QA_DEMO_TEACHERS[2]
  chooseTeacher(harness, selected.id)
  const single = harness.draw()
  assert(single.includes("显示 1 / 4 项安排 · 1 张课卡"))
  assert(!single.includes("data-activity-summary"))
  assert(gridOnly(single).includes(selected.name) && gridOnly(single).includes("D105"))
  for (const other of MATH_QA_DEMO_TEACHERS.filter(teacher => teacher !== selected)) assert(!gridOnly(single).includes(other.name))
  clearFilters(harness)
  const restored = harness.draw()
  assert(restored.includes("显示 4 / 4 项安排 · 1 张课卡") && summary(restored).includes("4 位教师"))
  const filters = TimetableFilterBar(component(harness.gridTree, TimetableFilterBar).props)
  find(filters, node => node.props["aria-label"] === "搜索课卡").props.onChange({ target: { value: MATH_QA_DEMO_TEACHERS[3].name } })
  const byName = harness.draw()
  assert(byName.includes("显示 1 / 4 项安排 · 1 张课卡"))
  assert(gridOnly(byName).includes("演示数学教师 D") && gridOnly(byName).includes("D208"), "teacherById's demo fallback must also power keyword search")
  clearFilters(harness)
  assert(summary(harness.draw()).includes("4 位教师"))
})

test("the summary opens four real individual cards and selecting one opens its original read-only CardDetail", () => {
  const harness = demoHarness()
  harness.draw()
  component(harness.gridTree, ActivityGroupCard).props.onClick()
  const expanded = harness.draw()
  const dialog = component(harness.gridTree, ActivityGroupDialog)
  const cards = elements(dialog).filter(node => node.type === weekModule.ClassCard)
  assert.equal(cards.length, 4)
  for (const [i, card] of cards.entries()) {
    assert.equal(card.props.entry, MATH_QA_DEMO_ENTRIES[i])
    assert.equal(card.props.showTeacher, true)
    assert(expanded.includes(MATH_QA_DEMO_TEACHERS[i].name) && expanded.includes(MATH_QA_DEMO_ENTRIES[i].room))
  }
  cards[1].props.onClick()
  const detailHtml = harness.draw()
  assert(!elements(harness.gridTree).some(node => node.type === ActivityGroupDialog))
  const detail = component(harness.demoTree, CardDetail)
  assert.equal(detail.props.entry, MATH_QA_DEMO_ENTRIES[1])
  assert.equal(detail.props.open, true)
  const renderedDialog = detailHtml.match(/<section\b[^>]*data-test-dialog[\s\S]*?<\/section>/)?.[0]
  assert(renderedDialog.includes("安排教师") && renderedDialog.includes("演示数学教师 B"))
  assert(renderedDialog.includes("D102") && renderedDialog.includes("2026") && renderedDialog.includes("15:15"))
  assert(!renderedDialog.includes("课堂记录") && !renderedDialog.includes("教学分工"))
  detail.props.onClose()
  harness.draw()
  assert.equal(component(harness.demoTree, CardDetail).props.entry, null)
})

test("restarting the demo clears only its local filter/detail UI and never invokes business commands or storage writes", () => {
  const harness = demoHarness()
  harness.draw()
  chooseTeacher(harness, MATH_QA_DEMO_TEACHERS[0].id)
  harness.draw()
  const leaf = elements(harness.gridTree).find(node => node.type === weekModule.ClassCard)
  leaf.props.onClick()
  harness.draw()
  assert(component(harness.demoTree, CardDetail).props.entry)
  find(harness.demoTree, node => typeof node.props.onClick === "function" && text(node) === "重新体验").props.onClick()
  const restarted = harness.draw()
  assert.equal(component(harness.demoTree, CardDetail).props.entry, null)
  assert(restarted.includes("显示 4 / 4 项安排 · 1 张课卡"))
  assert.deepEqual(component(harness.gridTree, TimetableFilterBar).props.value, EMPTY_CARD_FILTERS)
  assert.deepEqual(harness.commands, [])
  assert.deepEqual(harness.writes, [])
  assert.equal(new Set(harness.snapshots).size, 1, "provider timetable state remains unchanged across the full interaction")
  assert.equal(JSON.stringify({ teachers: TEACHERS, schedules: TEACHER_SCHEDULES, baseline: BASELINE_TEMPLATES, entries: MATH_QA_DEMO_ENTRIES }), fixtureSnapshot)
})

test("ordinary grids retain their existing style entry by default while explicit read-only grids hide it", () => {
  const props = { entries: MATH_QA_DEMO_ENTRIES, weekStart: MATH_QA_DEMO_WEEK, clockDate: MATH_QA_DEMO_DATE, calendarEvents: [], canonical: true, displayControls: "admin", showTeacher: true }
  const normal = render(providers(h(realWeekGrid, props)))
  assert(/<button\b[^>]*>[\s\S]*?显示样式<\/button>/.test(normal))
  assert(!normal.includes("data-activity-summary"), "grouping remains opt-in for ordinary teacher/class views")
  const readonly = render(providers(h(realWeekGrid, { ...props, allowStyleEditing: false })))
  assert(!readonly.includes("显示样式"))
  const bucket = { states: [], refs: [] }
  let tree, allowStyleEditing = true
  function Capture() { tree = localState(() => realWeekGrid({ ...props, allowStyleEditing }), bucket); return tree }
  render(providers(h(Capture)))
  find(tree, node => typeof node.props.onClick === "function" && text(node) === "显示样式").props.onClick()
  allowStyleEditing = false
  render(providers(h(Capture)))
  assert(!elements(tree).some(node => node.type === TimetableDisplaySettings), "read-only mode must suppress an already-open settings state as well as its button")
})

test("the dedicated route and demo entry are available to admin personas without changing school navigation state", () => {
  const originalLoad = Module._load
  const redirects = []
  Module._load = function (request, ...args) {
    return request === "next/navigation" ? { useRouter: () => ({ replace: target => redirects.push(target) }) } : originalLoad.call(this, request, ...args)
  }
  let Page, TimetableDemoBar
  try {
    Page = require("../app/(app)/timetable/demo/math-qa/page.tsx").default
    ;({ TimetableDemoBar } = require("../components/timetable/demo-bar.tsx"))
  } finally { Module._load = originalLoad }
  const previousDemo = demoStore.useDemo, previousTt = ttStore.useTimetable, previousEffect = React.useEffect
  try {
    ttStore.useTimetable = () => ({ clock: "2026-10-26T08:00" })
    for (const persona of ["lin", "admin", "zhou", "chen"]) {
      const effects = []
      demoStore.useDemo = () => ({ persona })
      React.useEffect = effect => effects.push(effect)
      const page = Page()
      effects.forEach(effect => effect())
      const bar = localState(TimetableDemoBar, { states: [], refs: [] })
      const links = elements(bar).filter(node => node.props.href === "/timetable/demo/math-qa")
      if (persona === "lin" || persona === "admin") {
        assert.equal(page.type, MathQaDemo)
        assert.equal(links.length, 1)
      } else {
        assert.equal(page, null)
        assert.equal(links.length, 0)
      }
    }
    assert.deepEqual(redirects, ["/timetable/my", "/timetable/my"])
  } finally { demoStore.useDemo = previousDemo; ttStore.useTimetable = previousTt; React.useEffect = previousEffect }
})
