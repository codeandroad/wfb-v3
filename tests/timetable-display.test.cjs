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
const { styleKey, resolveStyle, resolvePreference, saveStylePatch, cardStyle } = require("../lib/mt/styles.ts")
const { appearanceKey, appearancePref, titleParts, EMPTY_CARD_FILTERS, hasCardFilters, matchesCardFilters, cardDisplayLabels } = require("../lib/timetable/display.ts")
const { StyledLessonTitle } = require("../components/timetable/display-settings.tsx")
const { ClassCard } = require("../components/timetable/week-grid.tsx")
const { DemoProvider } = require("../lib/demo/store.tsx")
const { MtProvider } = require("../lib/mt/store.tsx")
const registry = require("../lib/teaching/fixture.json")

const task = { id: "test-task", class_id: "test-class", course_id: "test-course" }
const keys = Object.fromEntries(["TASK", "CLASS", "COURSE"].map((level, index) => [level, styleKey("test-teacher", level, [task.id, task.class_id, task.course_id][index])]))
const styleOf = styles => resolveStyle({ styles }, "test-teacher", task)
const appearance = (styles = {}, mode = "teacher", viewer = "u-lin") => ({ styles, mode, viewer })
const entry = overrides => ({ key: "test-lesson", teacherId: "lin", date: "2026-10-26", weekday: 1, periodId: "m3", className: "高一1班 • 数学", subject: "数学", group: "P1", room: "D101", ...overrides })
const filters = overrides => ({ ...EMPTY_CARD_FILTERS, ...overrides })
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
const titleText = html => html.replace(/<[^>]+>/g, "")
const renderCard = props => render(h(DemoProvider, null, h(MtProvider, null, h(ClassCard, props))))

test("legacy scope preferences retain their original per-field fallback without migration", () => {
  const styles = freeze({
    [keys.TASK]: { color: "pine" },
    [keys.CLASS]: { color: "brick", bg: "sky", font: "serif" },
    [keys.COURSE]: { color: "ink", bg: "sand", weight: "bold" },
  })
  const result = styleOf(styles)
  assert.equal(result.hex, "#2f6b4f")
  assert.equal(result.bg.hex, "#e7eff8")
  assert.equal(result.font, "serif")
  assert.equal(result.weight, "bold")
  assert.deepEqual(result.from, { color: "TASK", bg: "CLASS", font: "CLASS", weight: "COURSE" })
  assert.equal(resolveStyle({ styles }, null, task).hex, null)
  assert.equal(resolveStyle({ styles }, "another-teacher", task).hex, null)
})

test("last successful save wins per attribute across scopes and does not mutate existing preferences", () => {
  const original = freeze({ [keys.TASK]: { color: "pine", bg: "mint" }, [keys.CLASS]: { font: "serif" } })
  let styles = saveStylePatch(original, keys.COURSE, { color: "brick" })
  styles = saveStylePatch(styles, keys.TASK, { bg: "sky" })
  assert.equal(styleOf(styles).hex, "#a2422e", "saving another field must not steal color precedence")
  assert.equal(styleOf(styles).bg.hex, "#e7eff8")
  assert.equal(styleOf(styles).font, "serif")
  assert.deepEqual(original[keys.TASK], { color: "pine", bg: "mint" })
  styles = saveStylePatch(styles, keys.CLASS, { color: "#abc", weight: "normal" })
  assert.equal(styleOf(styles).hex, "#AABBCC")
  assert.equal(styleOf(styles).weight, "normal")
  const invalid = saveStylePatch(styles, keys.COURSE, { color: "invalid-color" })
  assert.equal(styleOf(invalid).hex, "#AABBCC", "invalid input cannot override the last saved valid value")
})

test("field and full resets survive JSON persistence and suppress older scope values", () => {
  let styles = saveStylePatch({}, keys.TASK, { color: "pine", bg: "mint", font: "mono", weight: "bold" })
  styles = saveStylePatch(styles, keys.COURSE, { color: undefined })
  styles = JSON.parse(JSON.stringify(styles))
  assert.equal(styleOf(styles).hex, null)
  assert.equal(styleOf(styles).bg.hex, "#e8f3ec")
  assert.equal(styleOf(styles).from.color, "COURSE")
  styles = JSON.parse(JSON.stringify(saveStylePatch(styles, keys.CLASS, null)))
  for (const field of ["hex", "bg", "font", "weight"]) assert.equal(styleOf(styles)[field], null, `${field} must remain reset`)
  styles = saveStylePatch(styles, keys.TASK, { color: "ink" })
  assert.equal(styleOf(styles).hex, "#2d4f7c")
  assert.equal(styleOf(styles).bg, null, "a later color save cannot resurrect an older background")
})

test("explicit no-tint and automatic backgrounds keep their distinct meanings", () => {
  assert.equal(cardStyle(resolvePreference()), undefined)
  assert.deepEqual(cardStyle(resolvePreference({ bg: "NONE" })), { backgroundColor: "transparent" })
  const automatic = resolvePreference({ color: "#000000", bg: "AUTO" })
  assert.equal(automatic.bg.hex, "#e0e0e0")
  assert.equal(automatic.bg.border, "#00000055")
  assert.equal(automatic.tagHex, "#000000")
})

test("appearance preferences are isolated by active viewer, teacher/admin mode and title part", () => {
  const permutations = ["u-lin", "u-zhou"].flatMap(viewer => ["teacher", "admin"].flatMap(mode => ["CARD", "SUBJECT", "HOMEROOM", "ACTIVITY"].map(part => appearanceKey(viewer, mode, part, "MATH"))))
  assert.equal(new Set(permutations).size, permutations.length)
  const subjectKey = appearanceKey("u-lin", "teacher", "SUBJECT", "MATH")
  const legacyKey = styleKey("TEACHER_LYNN", "COURSE", "MATH")
  const styles = freeze({ [subjectKey]: { color: "brick" }, [legacyKey]: { color: "pine" } })
  assert.equal(appearancePref(appearance(styles), "SUBJECT", "MATH").color, "brick")
  assert.equal(appearancePref(appearance(styles, "admin"), "SUBJECT", "MATH"), undefined)
  assert.equal(appearancePref(appearance(styles, "teacher", "u-zhou"), "SUBJECT", "MATH"), undefined)
  assert.equal(appearancePref(appearance(styles), "CARD", "MATH"), undefined)
  const changed = saveStylePatch(styles, appearanceKey("u-lin", "admin", "SUBJECT", "MATH"), { color: "ink" })
  assert.deepEqual(changed[legacyKey], styles[legacyKey])
  assert.deepEqual(changed[subjectKey], styles[subjectKey])
})

test("recognized subject/class titles preserve original text and normalize only their identity", () => {
  const normal = titleParts(entry())
  assert.equal(normal.subjectId, "MATH")
  assert.equal(normal.homeroomId, "高一1班")
  for (const className of ["高一1班 • 数学", "高一（1）班  ·  数学", "高一(1)班 · 数学 "]) {
    const parts = titleParts(entry({ className }))
    assert(parts, className)
    assert.equal(parts.classText + parts.separator + parts.subjectText, className)
    assert.equal(parts.homeroomId, normal.homeroomId)
    assert.equal(parts.subjectId, normal.subjectId)
  }
})

test("activities, free-form names and mismatched subjects stay whole; a registered group alias is not a homeroom", () => {
  for (const item of [entry({ kind: "activity" }), entry({ className: "数学竞赛A班" }), entry({ className: "自主研讨 · 数学" }), entry({ subject: "物理" }), entry({ className: "高一1班 · 数学 · 研讨" })]) {
    assert.equal(titleParts(item), null, item.className)
  }
  const alias = { ...registry.teachingClasses[0], id: "synthetic-alias-test", name: "创新A组 • 数学" }
  registry.teachingClasses.push(alias)
  try {
    const parts = titleParts(entry({ className: alias.name }))
    assert.equal(parts.subjectId, "MATH")
    assert.equal(parts.homeroomId, null, "placement in H1 must not apply H1 name styling to a group alias")
    assert.equal(parts.classText, "创新A组")
  } finally {
    registry.teachingClasses.splice(registry.teachingClasses.indexOf(alias), 1)
  }
})

test("card filters combine kind, subject, class, teacher and case-insensitive keywords without changing source cards", () => {
  const cards = freeze([entry(), entry({ key: "physics", teacherId: "zhou", className: "高一1班 • 物理", subject: "物理" }), entry({ key: "meeting", kind: "activity", className: "数学教研会", room: "会议室" })])
  const source = JSON.stringify(cards)
  assert.equal(hasCardFilters(filters()), false)
  assert.equal(hasCardFilters(filters({ query: "  " })), false)
  assert.deepEqual(cards.filter(card => matchesCardFilters(card, filters())).map(card => card.key), cards.map(card => card.key))
  const all = filters({ kind: "class", subject: "数学", className: cards[0].className, teacherId: "lin", query: " d101 " })
  assert.deepEqual(cards.filter(card => matchesCardFilters(card, all)).map(card => card.key), ["test-lesson"])
  assert.equal(matchesCardFilters(cards[0], { ...all, teacherId: "zhou" }), false)
  assert.equal(matchesCardFilters(cards[0], { ...all, subject: "物理" }), false)
  assert.equal(matchesCardFilters(cards[0], { ...all, className: "高一2班 • 数学" }), false)
  for (const query of ["P1", "p1", "数学", "示例林老师"]) assert(matchesCardFilters(cards[0], filters({ query })), query)
  assert.deepEqual(cards.filter(card => matchesCardFilters(card, filters({ kind: "activity", subject: "数学" }))).map(card => card.key), ["meeting"])
  assert.equal(matchesCardFilters(cards[2], filters({ kind: "activity", className: cards[2].className })), false, "a class filter never includes an activity with a matching label")
  assert.equal(JSON.stringify(cards), source)
  assert.equal(hasCardFilters(all), true)
})

test("search uses the visible task division and optional course name, including personal labels", () => {
  const lesson = freeze(entry({ taskId: "TASK_MATH_G1_P1" }))
  const biz = freeze({ taskPrefs: { "TEACHER_LYNN|TASK_MATH_G1_P1": { enabled: true, text: "  纯数1  ", showCourse: true } }, lessonOverrides: {} })
  const labels = cardDisplayLabels(lesson, false, "TEACHER_LYNN", biz, "规范分工")
  assert.equal(labels.marker, "纯数1")
  assert.equal(labels.courseLabel, "CIE 数学")
  assert.equal(labels.customShown, true)
  const indexed = { ...lesson, searchText: [labels.marker, labels.courseLabel].filter(Boolean).join(" ") }
  assert(matchesCardFilters(indexed, filters({ kind: "class", subject: "数学", teacherId: "lin", query: "纯数1" })))
  assert(matchesCardFilters(indexed, filters({ query: "cie 数学" })))
  assert.equal(matchesCardFilters(indexed, filters({ query: "规范分工" })), false, "replaced labels must not become invisible search matches")
  const hiddenCourse = cardDisplayLabels(lesson, false, "TEACHER_LYNN", { ...biz, taskPrefs: { "TEACHER_LYNN|TASK_MATH_G1_P1": { enabled: true, text: "纯数1", showCourse: false } } }, "规范分工")
  assert.equal(hiddenCourse.courseLabel, null)
  assert.equal(matchesCardFilters({ ...lesson, searchText: hiddenCourse.marker }, filters({ query: "cie 数学" })), false)
  assert.equal(lesson.searchText, undefined, "indexing cannot write display-only data into the lesson")
})

test("lesson-specific custom division takes priority over task defaults in visible labels and search", () => {
  const lesson = freeze(entry({ taskId: "TASK_MATH_G1_P1", displayMode: "CUSTOM", customLabel: "  本课实验分工  " }))
  const biz = freeze({ taskPrefs: { "TEACHER_LYNN|TASK_MATH_G1_P1": { enabled: true, text: "任务私人分工", showCourse: true } }, lessonOverrides: {} })
  const labels = cardDisplayLabels(lesson, false, "TEACHER_LYNN", biz, "规范分工")
  assert.equal(labels.marker, "本课实验分工")
  assert.equal(labels.courseLabel, "CIE 数学", "a lesson override changes the division, not the task's course visibility")
  assert.equal(labels.customShown, true)
  const indexed = { ...lesson, searchText: [labels.marker, labels.courseLabel].filter(Boolean).join(" ") }
  assert(matchesCardFilters(indexed, filters({ query: "本课实验分工" })))
  assert.equal(matchesCardFilters(indexed, filters({ query: "任务私人分工" })), false)
  assert.equal(matchesCardFilters(indexed, filters({ query: "规范分工" })), false)
  const blankOverride = cardDisplayLabels({ ...lesson, customLabel: "   " }, false, "TEACHER_LYNN", biz, "规范分工")
  assert.equal(blankOverride.marker, "任务私人分工", "an empty lesson override falls back to the current visible task label")
})

test("canonical search resolves shared divisions and excludes private lesson, task and course labels", () => {
  const lesson = freeze(entry({ taskId: "TASK_MATH_G1_P1", displayMode: "CUSTOM", customLabel: "本课私人标记" }))
  const biz = freeze({ taskPrefs: { "TEACHER_LYNN|TASK_MATH_G1_P1": { enabled: true, text: "任务私人标记", showCourse: true } }, lessonOverrides: {} })
  const labels = cardDisplayLabels(lesson, true, "TEACHER_LYNN", biz, "学校规范纯数")
  assert.equal(labels.marker, "学校规范纯数")
  assert.equal(labels.courseLabel, null)
  assert.equal(labels.customShown, false)
  assert.equal(labels.ownTask, undefined)
  const indexed = { ...lesson, searchText: [labels.marker, labels.courseLabel].filter(Boolean).join(" ") }
  assert(matchesCardFilters(indexed, filters({ query: "学校规范纯数" })))
  for (const query of ["本课私人标记", "任务私人标记", "CIE 数学"]) assert.equal(matchesCardFilters(indexed, filters({ query })), false, query)
  assert(!indexed.searchText.includes("私人"))
  assert.equal(cardDisplayLabels(lesson, true, null, biz, null).marker, null)
})

test("title rendering inherits unsaved attributes and keeps the complete original name", () => {
  const lesson = entry({ className: "高一（1）班  ·  数学" })
  const base = render(h(StyledLessonTitle, { entry: lesson, appearance: appearance() }))
  assert.equal(titleText(base), lesson.className)
  assert(!base.includes("style="), "unconfigured title segments must inherit their existing card styles")
  assert(!base.includes("class="), "unconfigured font and weight must remain inherited")
  const styles = { [appearanceKey("u-lin", "teacher", "SUBJECT", "MATH")]: { color: "brick" }, [appearanceKey("u-lin", "teacher", "HOMEROOM", "高一1班")]: { bg: "sky", weight: "bold" } }
  const html = render(h(StyledLessonTitle, { entry: lesson, appearance: appearance(styles) }))
  assert.equal(titleText(html), lesson.className)
  assert.match(html, /data-title-part="subject" style="color:#a2422e"/)
  assert.match(html, /data-title-part="homeroom" class="font-bold" style="background-color:#e7eff8"/)
  const reset = saveStylePatch(styles, appearanceKey("u-lin", "teacher", "SUBJECT", "MATH"), null)
  const inherited = render(h(StyledLessonTitle, { entry: lesson, appearance: appearance(reset) }))
  assert.match(inherited, /data-title-part="subject">数学<\/span>/)
  for (const item of [entry({ kind: "activity" }), entry({ className: "自主研讨 · 数学" })]) assert.equal(render(h(StyledLessonTitle, { entry: item, appearance: appearance(styles) })), item.className)
})

test("rendered lesson cards show teacher names on request while preserving teacher-view content", () => {
  const lesson = entry()
  const teacherView = renderCard({ entry: lesson, canonical: true })
  const classView = renderCard({ entry: lesson, canonical: true, showTeacher: true })
  assert(!teacherView.includes("示例林老师"))
  assert(classView.includes("示例林老师"))
  for (const html of [teacherView, classView]) {
    assert(html.includes(lesson.className))
    assert(html.includes("D101"))
    assert(html.includes("P1"))
  }
  assert(renderCard({ entry: entry({ teacherId: "synthetic-unknown-teacher" }), canonical: true, showTeacher: true }).includes("synthetic-unknown-teacher"))
})

test("admin appearance does not replace locked, stopped, draft or makeup status backgrounds", () => {
  const lesson = entry()
  const styles = { [appearanceKey("u-lin", "admin", "CARD", lesson.className)]: { bg: "rose", color: "ink" } }
  const props = { entry: lesson, canonical: true, appearance: appearance(styles, "admin") }
  assert(renderCard(props).includes("background-color:#f8e9e6"))
  for (const meta of [{ past: true }, { voided: true }, { draft: true }]) assert(!renderCard({ ...props, meta }).includes("background-color:#f8e9e6"))
  assert(!renderCard({ ...props, entry: { ...lesson, makeupFrom: "2026-10-25" } }).includes("background-color:#f8e9e6"))
  const conflict = renderCard({ ...props, meta: { conflict: true } })
  assert(conflict.includes("冲突"))
  assert(conflict.includes("ring-destructive"))
})
