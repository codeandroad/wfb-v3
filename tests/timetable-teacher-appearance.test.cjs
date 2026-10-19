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
const { appearanceKey, resolveCardAppearance } = require("../lib/timetable/display.ts")
const { resolvePreference, saveStylePatch, cardStyle } = require("../lib/mt/styles.ts")
const { ClassCard } = require("../components/timetable/week-grid.tsx")
const { DemoProvider } = require("../lib/demo/store.tsx")
const { MtProvider } = require("../lib/mt/store.tsx")

const entry = overrides => ({ key: "test-lesson", teacherId: "lin", date: "2026-10-26", weekday: 1, periodId: "m3", className: "高一1班 • 数学", subject: "数学", group: "P1", room: "D101", ...overrides })
const appearance = (styles = {}, mode = "admin", viewer = "u-lin") => ({ styles, mode, viewer })
const key = (part, id, mode = "admin", viewer = "u-lin") => appearanceKey(viewer, mode, part, id)
const restored = styles => JSON.parse(JSON.stringify(styles))
const resolveCard = (styles, lesson = entry(), mode = "admin", viewer = "u-lin") => resolveCardAppearance(appearance(styles, mode, viewer), lesson)
const renderCard = props => render(h(DemoProvider, null, h(MtProvider, null, h(ClassCard, props))))
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test("unconfigured teacher appearance preserves existing whole-card and activity preferences exactly", () => {
  const lesson = entry()
  const activity = entry({ kind: "activity", className: "学科研讨" })
  const cardPref = { color: "brick", bg: "sky", weight: "bold", font: "serif" }
  const activityPref = { color: "#123456", bg: "AUTO", weight: "normal" }
  const styles = freeze({ [key("CARD", lesson.className)]: cardPref, [key("ACTIVITY", activity.className)]: activityPref })
  assert.deepEqual(resolveCard(styles, lesson), resolvePreference(cardPref))
  assert.deepEqual(resolveCard(styles, activity), resolvePreference(activityPref))
  assert.deepEqual(resolveCard({}, lesson), resolvePreference())
})

test("teacher appearance follows teacher identity across courses, renamed titles and activities", () => {
  const styles = freeze({ [key("TEACHER", "lin")]: { color: "ink", bg: "mint", font: "mono" } })
  const expected = resolvePreference({ color: "ink", bg: "mint", font: "mono" })
  for (const lesson of [entry(), entry({ className: "高一2班 • 计算机", subject: "计算机" }), entry({ className: "改名后的教学班" }), entry({ kind: "activity", className: "班主任会议" })]) {
    assert.deepEqual(resolveCard(styles, lesson), expected, lesson.className)
  }
  assert.deepEqual(resolveCard(styles, entry({ teacherId: "zhou" })), resolvePreference(), "the same course name taught by another teacher must not inherit Lin's style")
  assert.deepEqual(resolveCard(styles, entry({ teacherId: undefined })), resolvePreference())
})

test("teacher styles remain isolated by viewer and admin/teacher display mode", () => {
  const styles = freeze({
    [key("TEACHER", "lin")]: { color: "ink" },
    [key("TEACHER", "lin", "admin", "u-zhou")]: { color: "brick" },
    [key("TEACHER", "lin", "teacher")]: { color: "plum", bg: "rose" },
  })
  assert.equal(resolveCard(styles).hex, "#2d4f7c")
  assert.equal(resolveCard(styles, entry(), "admin", "u-zhou").hex, "#a2422e")
  assert.deepEqual(resolveCard(styles, entry(), "admin", "u-chen"), resolvePreference())
  assert.deepEqual(resolveCard(styles, entry(), "teacher"), resolvePreference(), "teacher mode ignores even an explicit TEACHER preference in that namespace")
  const activity = entry({ kind: "activity", className: "学科研讨" })
  const withPersonalActivity = { ...styles, [key("ACTIVITY", activity.className, "teacher")]: { bg: "sky" } }
  assert.deepEqual(resolveCard(withPersonalActivity, activity, "teacher"), resolvePreference({ bg: "sky" }))
})

test("specific card attributes override teacher defaults while untouched attributes inherit independently of save order", () => {
  const lesson = entry()
  let styles = saveStylePatch({}, key("CARD", lesson.className), { color: "brick", weight: "normal" })
  styles = saveStylePatch(styles, key("TEACHER", "lin"), { color: "ink", bg: "mint", weight: "bold", font: "mono" })
  freeze(styles)
  const before = JSON.stringify(styles)
  const result = resolveCard(styles, lesson)
  assert.equal(result.hex, "#a2422e", "a later teacher-default save must not erase a specific course's color")
  assert.equal(result.weight, "normal")
  assert.equal(result.font, "mono")
  assert.equal(result.bg.hex, "#e8f3ec")
  assert.equal(JSON.stringify(styles), before)
  const activity = entry({ kind: "activity", className: "班主任会议" })
  const withActivity = { ...styles, [key("ACTIVITY", activity.className)]: { color: "plum" }, [key("CARD", activity.className)]: { color: "brick", bg: "sand" } }
  assert.equal(resolveCard(withActivity, activity).hex, "#6e3f6a")
  assert.equal(resolveCard(withActivity, activity).bg.hex, "#e8f3ec", "activity cards use ACTIVITY overrides, not similarly named teaching-card preferences")
})

test("specific field clearing restores teacher inheritance and teacher clearing persists without reviving old values", () => {
  const lesson = entry()
  const teacherKey = key("TEACHER", "lin"), cardKey = key("CARD", lesson.className)
  let styles = saveStylePatch({}, teacherKey, { color: "ink", bg: "mint", font: "mono", weight: "bold" })
  styles = saveStylePatch(styles, cardKey, { color: "brick", bg: "sky" })
  styles = restored(saveStylePatch(styles, cardKey, { color: undefined }))
  assert.equal(resolveCard(styles).hex, "#2d4f7c")
  assert.equal(resolveCard(styles).bg.hex, "#e7eff8")
  styles = restored(saveStylePatch(styles, teacherKey, null))
  const withoutTeacher = resolveCard(styles)
  assert.equal(withoutTeacher.hex, null)
  assert.equal(withoutTeacher.font, null)
  assert.equal(withoutTeacher.weight, null)
  assert.equal(withoutTeacher.bg.hex, "#e7eff8", "clearing a teacher never deletes a specific card override")
  styles = restored(saveStylePatch(styles, cardKey, null))
  assert.equal(resolveCard(styles).bg, null)
  styles = restored(saveStylePatch(styles, teacherKey, { color: "pine" }))
  assert.equal(resolveCard(styles).hex, "#2f6b4f")
  assert.equal(resolveCard(styles).bg, null, "saving just teacher color cannot revive the cleared teacher background")
})

test("explicit transparent backgrounds override the teacher tint while cleared backgrounds inherit it", () => {
  const lesson = entry()
  let styles = { [key("TEACHER", "lin")]: { bg: "mint" }, [key("CARD", lesson.className)]: { bg: "NONE" } }
  assert.deepEqual(cardStyle(resolveCard(styles)), { backgroundColor: "transparent" })
  styles = restored(saveStylePatch(styles, key("CARD", lesson.className), { bg: undefined }))
  assert.equal(resolveCard(styles).bg.hex, "#e8f3ec")
})

test("automatic backgrounds derive from the final merged color, including specific color overrides", () => {
  const lesson = entry()
  const styles = { [key("TEACHER", "lin")]: { color: "brick", bg: "AUTO" }, [key("CARD", lesson.className)]: { color: "#000000" } }
  const result = resolveCard(styles)
  assert.equal(result.hex, "#000000")
  assert.equal(result.bg.hex, "#e0e0e0")
  assert.equal(result.bg.border, "#00000055")
  const inverse = { [key("TEACHER", "lin")]: { color: "#000000", bg: "mint" }, [key("CARD", lesson.className)]: { bg: "AUTO" } }
  assert.equal(resolveCard(inverse).bg.hex, "#e0e0e0")
})

test("real ClassCard applies teacher appearance to lessons and activities while title segments remain independent", () => {
  const lesson = entry()
  const styles = {
    [key("TEACHER", "lin")]: { color: "ink", bg: "mint", font: "mono" },
    [key("SUBJECT", "MATH")]: { color: "brick", weight: "bold" },
    [key("HOMEROOM", "高一1班")]: { bg: "sky" },
  }
  const props = { entry: lesson, canonical: true, appearance: appearance(styles), showTeacher: true }
  const html = renderCard(props)
  assert(html.includes("background-color:#e8f3ec"), "the real card must call the merged teacher-style resolver")
  assert(html.includes("color:#2d4f7c") && html.includes("font-mono"))
  assert.match(html, /data-title-part="subject" class="font-bold" style="color:#a2422e"/)
  assert.match(html, /data-title-part="homeroom" style="background-color:#e7eff8"/)
  assert(html.includes("示例林老师") && html.includes("D101"))
  const activity = renderCard({ ...props, entry: entry({ kind: "activity", className: "班主任会议" }) })
  assert(activity.includes("background-color:#e8f3ec") && activity.includes("color:#2d4f7c"))
  assert(!activity.includes("data-title-part="), "activity titles must stay whole")
  const otherTeacher = renderCard({ ...props, entry: { ...lesson, teacherId: "zhou" } })
  assert(!otherTeacher.includes("background-color:#e8f3ec"))
  assert(!otherTeacher.includes("color:#2d4f7c"))
  assert(otherTeacher.includes("color:#a2422e"), "independent subject styling still applies to the same subject taught by another teacher")
})

test("teacher appearance retains real locked, stopped, draft, makeup and conflict indications", () => {
  const styles = { [key("TEACHER", "lin")]: { color: "ink", bg: "rose" } }
  const props = { entry: entry(), canonical: true, appearance: appearance(styles) }
  assert(renderCard(props).includes("background-color:#f8e9e6"))
  for (const meta of [{ past: true }, { voided: true }, { draft: true }]) assert(!renderCard({ ...props, meta }).includes("background-color:#f8e9e6"))
  for (const changes of [{ kind: "history" }, { origin: "personal" }, { makeupFrom: "2026-10-25" }]) assert(!renderCard({ ...props, entry: { ...props.entry, ...changes } }).includes("background-color:#f8e9e6"))
  const conflict = renderCard({ ...props, meta: { conflict: true, conflictLabels: ["教师冲突"], conflictReasons: ["同一教师同时有课"] } })
  assert(conflict.includes("教师冲突") && conflict.includes("ring-destructive/60"))
  assert(conflict.includes('title="同一教师同时有课"'))
  const review = renderCard({ ...props, meta: { reviewReasons: ["学生范围需核对"] } })
  assert(review.includes("同时段安排 · 待核对") && review.includes('title="学生范围需核对"'))
})
