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
const { appearanceKey, cardPartForEntry, resolveCardAppearance, resolveCardTextAppearance, titleParts } = require("../lib/timetable/display.ts")
const { appearanceEditorPref, appearanceEditorEffective, saveAppearancePatch, cardSurfaceStyle, objectTextBackground } = require("../lib/timetable/surface.ts")
const { resolvePreference, cardStyle } = require("../lib/mt/styles.ts")
const { ClassCard } = require("../components/timetable/week-grid.tsx")
const { TimetableCardPreview, TimetableDisplaySettings, TeacherCardStyleEditor } = require("../components/timetable/display-settings.tsx")
const { DemoProvider } = require("../lib/demo/store.tsx")
const { TimetableProvider } = require("../lib/timetable/store.tsx")
const { taskById, classOf } = require("../lib/mt/model.ts")
const mtStore = require("../lib/mt/store.tsx")
const mtDerive = require("../lib/mt/derive.ts")
const kit = require("../components/kit.tsx")
const colorInput = require("../components/mt/style-color-input.tsx")

const entry = overrides => ({ key: "activity-1", kind: "activity", teacherId: "lin", date: "2026-10-26", weekday: 1, periodId: "m3", className: "学科研讨", subject: "数学", room: "教研室 A", ...overrides })
const app = (styles = {}, mode = "admin", viewer = "u-lin") => ({ styles, mode, viewer, teacherId: null })
const key = (part, name = entry().className, mode = "admin", viewer = "u-lin") => appearanceKey(viewer, mode, part, name)
const save = (styles, part, patch, mode = "admin", name = entry().className, viewer = "u-lin") => saveAppearancePatch(styles, viewer, mode, part, name, patch)
const restored = styles => JSON.parse(JSON.stringify(styles))
const parts = ["SURFACE", "OBJECT_TEXT", "TEACHER_TEXT", "ROOM_TEXT"]
const surface = (appearance, activity = entry()) => cardSurfaceStyle(appearance, activity, resolveCardAppearance(appearance, activity))
const outerStyle = html => html.slice(0, html.indexOf(">") + 1).match(/\bstyle="([^"]*)"/)?.[1] ?? ""
const textTag = (html, field) => html.match(new RegExp(`<span\\b[^>]*data-card-text="${field}"[^>]*>`))?.[0]
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function configured(mode = "admin", name = entry().className) {
  let styles = save({}, "ACTIVITY_SURFACE", { bg: "mint", borderColor: "#123456", borderWidth: 3, borderStyle: "dotted", radius: 14 }, mode, name)
  styles = save(styles, "ACTIVITY_OBJECT_TEXT", { color: "ink", font: "serif", weight: "bold", bg: "sky" }, mode, name)
  styles = save(styles, "ACTIVITY_TEACHER_TEXT", { color: "brick", font: "mono", bg: "rose" }, mode, name)
  return save(styles, "ACTIVITY_ROOM_TEXT", { color: "teal", weight: "normal", bg: "sand" }, mode, name)
}
function withState(styles, teacherId, run) {
  const previousMt = mtStore.useMt, previousTeacher = mtDerive.useTeacherId
  const state = { biz: { ...mtStore.freshBiz("BASE"), styles }, commands: 0 }
  mtStore.useMt = () => ({ biz: state.biz, ready: true, loadError: false, command: (_label, update) => {
    state.biz = update(state.biz)
    state.commands++
    return { ok: true }
  } })
  mtDerive.useTeacherId = () => teacherId
  try { return run(state) } finally { mtStore.useMt = previousMt; mtDerive.useTeacherId = previousTeacher }
}
const providers = child => h(DemoProvider, null, h(TimetableProvider, { clock: "2026-10-26T08:00" }, child))
const renderCard = props => render(h(DemoProvider, null, h(mtStore.MtProvider, null, h(ClassCard, props))))
function renderSettings(mode, entries, capture = {}) {
  // Only replace the portal shell. The real settings, options, controls and save callbacks render unchanged.
  const previousModal = kit.Modal, previousInput = colorInput.StyleColorInput
  kit.Modal = ({ title, children }) => h("section", { "aria-label": title }, children)
  colorInput.StyleColorInput = props => { capture[props.label] = props; return h(previousInput, props) }
  try { return render(providers(h(TimetableDisplaySettings, { mode, entries, onClose: () => {} }))) }
  finally { kit.Modal = previousModal; colorInput.StyleColorInput = previousInput }
}
const decode = text => text.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&")
const optionValues = html => [...html.matchAll(/<option\b[^>]*value="([^"]*)"/g)].map(match => decode(match[1]))
const categories = html => html.match(/<div\b[^>]*aria-label="样式类别"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? ""

test("activity identity maps all four card parts without splitting its complete name", () => {
  const activity = entry({ className: "高一1班 • 数学" })
  for (const part of parts) {
    assert.equal(cardPartForEntry(`CARD_${part}`, activity), `ACTIVITY_${part}`)
    assert.equal(cardPartForEntry(`CARD_${part}`, { ...activity, kind: "class" }), `CARD_${part}`)
    assert.equal(cardPartForEntry(`ACTIVITY_${part}`, activity), `ACTIVITY_${part}`)
  }
  for (const part of ["TEACHER", "SUBJECT", "HOMEROOM", "ACTIVITY"]) assert.equal(cardPartForEntry(part, activity), part)
  assert.equal(titleParts(activity), null, "a composite-looking activity must retain its full-name style")
})

test("legacy ACTIVITY colors, typography, AUTO and NONE retain their original meaning in both modes", () => {
  for (const mode of ["teacher", "admin"]) for (const bg of ["mint", "AUTO", "NONE", "#ABCDEF"]) {
    const pref = { color: "#000000", bg, font: "mono", weight: "bold" }
    const appearance = app(freeze({ [key("ACTIVITY", undefined, mode)]: pref }), mode)
    const actual = resolveCardAppearance(appearance, entry())
    assert.deepEqual(actual, resolvePreference(pref))
    assert.deepEqual(surface(appearance), cardStyle(resolvePreference(pref)))
    assert.deepEqual(appearanceEditorPref(appearance, "ACTIVITY_SURFACE", entry().className), { bg })
    assert.deepEqual(appearanceEditorPref(appearance, "ACTIVITY_OBJECT_TEXT", entry().className), { color: "#000000", font: "mono", weight: "bold", bg: undefined })
    assert.equal(objectTextBackground(appearance, entry()), undefined)
    for (const field of ["teacher", "room"]) assert.deepEqual(resolveCardTextAppearance(appearance, entry(), field), resolvePreference())
    assert.deepEqual(appearanceEditorEffective(appearance, "ACTIVITY_SURFACE", entry().className, entry()), actual)
  }
})

test("same-name teaching objects and activities keep all legacy and supplemental storage separate", () => {
  const name = "高一1班 • 数学"
  const lesson = entry({ className: name, kind: "class" }), activity = { ...lesson, kind: "activity" }
  let styles = configured("admin", name)
  styles = save(styles, "CARD_SURFACE", { bg: "rose", borderColor: "#654321", radius: 0 }, "admin", name)
  styles = save(styles, "CARD_OBJECT_TEXT", { color: "plum", bg: "lilac", font: "mono" }, "admin", name)
  styles = save(styles, "CARD_TEACHER_TEXT", { color: "olive" }, "admin", name)
  styles = save(styles, "CARD_ROOM_TEXT", { color: "ochre" }, "admin", name)
  const original = freeze(restored(styles)), appearance = app(original)
  assert.equal(resolveCardAppearance(appearance, lesson).hex, "#6e3f6a")
  assert.equal(resolveCardAppearance(appearance, activity).hex, "#2d4f7c")
  assert.equal(surface(appearance, lesson).backgroundColor, "#f8e9e6")
  assert.equal(surface(appearance, activity).backgroundColor, "#e8f3ec")
  assert.equal(objectTextBackground(appearance, lesson), "#f0eaf5")
  assert.equal(objectTextBackground(appearance, activity), "#e7eff8")
  for (const [field, teachingColor, activityColor] of [["teacher", "#5c6b23", "#a2422e"], ["room", "#9a6a12", "#1f6f74"]]) {
    assert.equal(resolveCardTextAppearance(appearance, lesson, field).hex, teachingColor)
    assert.equal(resolveCardTextAppearance(appearance, activity, field).hex, activityColor)
  }
  styles = restored(save(original, "ACTIVITY_OBJECT_TEXT", null, "admin", name))
  for (const part of ["CARD", ...parts.map(value => `CARD_${value}`)]) assert.deepEqual(styles[key(part, name)], original[key(part, name)])
  assert.equal(styles[key("ACTIVITY", name)].bg, "mint")
  assert.equal(styles[key("ACTIVITY", name)].color, undefined)
})

test("each activity part resets independently after JSON persistence and uses the original full-name key", () => {
  for (const mode of ["admin", "teacher"]) for (const resetPart of parts) {
    const initial = freeze(configured(mode))
    const styles = restored(save(initial, `ACTIVITY_${resetPart}`, null, mode))
    const appearance = app(styles, mode), before = app(initial, mode)
    for (const other of parts.filter(part => part !== resetPart)) {
      assert.deepEqual(appearanceEditorPref(appearance, `ACTIVITY_${other}`, entry().className), appearanceEditorPref(before, `ACTIVITY_${other}`, entry().className), `${mode}: resetting ${resetPart} changed ${other}`)
    }
    const cleared = appearanceEditorPref(appearance, `ACTIVITY_${resetPart}`, entry().className)
    const fields = resetPart === "SURFACE" ? ["bg", "borderColor", "borderWidth", "borderStyle", "radius"] : ["color", "bg", "font", "weight"]
    for (const field of fields) assert.equal(cleared[field], undefined, `${resetPart}.${field}`)
    assert(Object.keys(styles).every(savedKey => savedKey.endsWith(`|${entry().className}`)), "selection identity must never leak into preference keys")
  }
})

test("activity partial edits retain other attributes, reject invalid values and keep AUTO colors in sync", () => {
  let styles = configured()
  styles = restored(save(styles, "ACTIVITY_SURFACE", { borderWidth: 0, radius: 0 }))
  assert.deepEqual(surface(app(styles)), { backgroundColor: "#e8f3ec", borderColor: "#123456", borderWidth: 0, borderStyle: "dotted", borderRadius: 0 })
  const before = surface(app(styles))
  for (const patch of [{ borderWidth: -1 }, { borderWidth: "2" }, { radius: 5 }, { borderStyle: "double" }, { borderColor: "invalid" }, { bg: "invalid" }]) {
    assert.deepEqual(surface(app(save(styles, "ACTIVITY_SURFACE", patch))), before)
  }
  styles = save(styles, "ACTIVITY_OBJECT_TEXT", { color: "#000000", bg: "AUTO" })
  styles = save(styles, "ACTIVITY_SURFACE", { bg: "AUTO" })
  for (const part of ["ACTIVITY_OBJECT_TEXT", "ACTIVITY_SURFACE"]) {
    assert.equal(appearanceEditorEffective(app(styles), part, entry().className, entry()).bg.hex, "#e0e0e0")
  }
  assert.equal(objectTextBackground(app(styles), entry()), "#e0e0e0")
  assert.equal(surface(app(styles)).backgroundColor, "#e0e0e0")
  styles = restored(save(styles, "ACTIVITY_OBJECT_TEXT", { bg: undefined }))
  assert.equal(objectTextBackground(app(styles), entry()), undefined)
  assert.equal(surface(app(styles)).backgroundColor, "#e0e0e0")
  assert.equal(resolveCardAppearance(app(styles), entry()).font, "serif")
})

test("activity preferences are viewer/mode scoped but shared across dates and teachers with the same full name", () => {
  const styles = configured("teacher"), appearance = app(styles, "teacher")
  assert.equal(appearance.teacherId, null)
  const anotherOccurrence = entry({ key: "activity-2", teacherId: "zhou", date: "2026-11-02" })
  assert.deepEqual(surface(appearance, anotherOccurrence), surface(appearance))
  for (const field of ["teacher", "room"]) assert.deepEqual(resolveCardTextAppearance(appearance, anotherOccurrence, field), resolveCardTextAppearance(appearance, entry(), field))
  for (const [foreign, activity] of [[app(styles, "admin"), entry()], [app(styles, "teacher", "u-zhou"), entry()], [appearance, entry({ className: "另一活动" })]]) {
    assert.equal(surface(foreign, activity), undefined)
    assert.equal(objectTextBackground(foreign, activity), undefined)
    for (const field of ["teacher", "room"]) assert.deepEqual(resolveCardTextAppearance(foreign, activity, field), resolvePreference())
  }
  assert.equal(objectTextBackground(undefined, entry()), undefined)
  assert.deepEqual(resolveCardTextAppearance(undefined, entry(), "teacher"), resolvePreference())
})

test("real activity cards and previews apply all four parts in both modes without an MT teaching identity", () => {
  for (const mode of ["teacher", "admin"]) withState(configured(mode), null, state => {
    const appearance = app(state.biz.styles, mode), activity = entry()
    const preview = render(h(TimetableCardPreview, { entry: activity, appearance, base: resolveCardAppearance(appearance, activity), showTeacher: true }))
    const card = renderCard({ entry: activity, appearance, showTeacher: true, canonical: mode === "admin" })
    const expected = outerStyle(render(h("div", { style: surface(appearance) })))
    assert.equal(outerStyle(preview), expected)
    assert.equal(outerStyle(card), expected)
    for (const html of [preview, card]) {
      assert.match(html, /color:#2d4f7c/)
      assert(textTag(html, "object").includes("background-color:#e7eff8"))
      assert(textTag(html, "teacher").includes("color:#a2422e") && textTag(html, "teacher").includes("font-mono"))
      assert(textTag(html, "room").includes("color:#1f6f74") && textTag(html, "room").includes("background-color:#f8f0dc"))
      assert(html.includes("示例林老师") && html.includes("教研室 A") && html.includes("学科研讨"))
      assert(!html.includes("data-title-part="), "activities do not receive subject/homeroom fragments")
    }
    const hidden = renderCard({ entry: activity, appearance, showTeacher: false })
    assert.equal(textTag(hidden, "teacher"), undefined)
    assert(!hidden.includes("示例林老师"))
    const noRoom = renderCard({ entry: { ...activity, room: null }, appearance })
    assert(noRoom.includes("未安排场所"))
    assert.equal(textTag(noRoom, "room"), undefined)
  })
})

test("activity surface customization preserves lock, cancellation, draft, personal, makeup and conflict states", () => {
  for (const mode of ["teacher", "admin"]) withState(configured(mode), null, state => {
    const props = { entry: entry(), appearance: app(state.biz.styles, mode) }
    for (const changed of [{ meta: { past: true } }, { meta: { voided: true } }, { meta: { draft: true } }, { entry: entry({ origin: "personal" }) }, { entry: entry({ makeupFrom: "2026-10-25" }) }]) {
      const html = renderCard({ ...props, ...changed })
      assert.equal(outerStyle(html), "", JSON.stringify(changed))
    }
    const conflict = renderCard({ ...props, meta: { conflict: true, conflictLabels: ["教师冲突"], conflictReasons: ["同一教师同时有课"] } })
    assert(conflict.includes("ring-destructive/60") && conflict.includes("教师冲突") && conflict.includes("同一教师同时有课"))
    assert(outerStyle(conflict).includes("border-color:#123456"))
  })
})

test("admin settings group same-name teaching and activity options and save selected activity using its legacy key", () => {
  const name = "高一1班 • 数学", activity = entry({ className: name }), lesson = entry({ key: "lesson", kind: "class", className: name })
  withState(configured("admin", name), null, state => {
    const captures = {}, html = renderSettings("admin", [activity, lesson, { ...activity, key: "activity-2", teacherId: "zhou" }], captures)
    assert(html.includes('<optgroup label="教学对象">') && html.includes('<optgroup label="活动">'))
    const values = optionValues(html).filter(value => value.startsWith("["))
    assert.deepEqual(new Set(values), new Set([JSON.stringify(["activity", name]), JSON.stringify(["teaching", name])]))
    assert.equal(values.length, 2, "repeated activity occurrences should share one settings object")
    for (const label of ["整张课卡", "按教师", "学科文字", "行政班文字"]) assert(categories(html).includes(label))
    assert(!categories(html).includes(">活动</button>"))
    for (const label of ["课卡外观", "对象名称", "教师姓名", "场所"]) assert(html.includes(label))
    assert.equal(captures["课卡背景"].onChange("#ABCDEF"), true)
    assert.equal(state.commands, 1)
    assert.equal(state.biz.styles[key("ACTIVITY", name)].bg, "#ABCDEF")
    assert.equal(state.biz.styles[key("CARD", name)], undefined)
    assert(Object.keys(state.biz.styles).every(savedKey => !savedKey.includes('["')))
    const updated = renderSettings("admin", [activity, lesson])
    assert(updated.includes("background-color:#ABCDEF"), "the real settings preview should reflect the successful save")
  })
})

test("teacher settings remain functional for activity-only viewers with no MT task or teacher id", () => {
  withState(configured("teacher"), null, state => {
    const captures = {}, html = renderSettings("teacher", [entry()], captures)
    assert(html.includes("data-teacher-style-editor") && html.includes('<optgroup label="活动">'))
    assert(!html.includes('aria-label="样式范围"') && !html.includes("当前范围没有可设置"))
    assert(!categories(html).includes(">活动</button>"))
    assert(!categories(html).includes("按教师"))
    for (const label of ["课卡外观", "对象名称", "教师姓名", "场所"]) assert(html.includes(label))
    assert.equal(captures["课卡背景"].onChange("#AABBCC"), true)
    assert.equal(state.biz.styles[key("ACTIVITY", undefined, "teacher")].bg, "#AABBCC")
    assert.equal(state.biz.styles[key("ACTIVITY", undefined, "admin")], undefined)
    assert(!Object.keys(state.biz.styles).some(savedKey => savedKey.startsWith("null|")))
    const updated = renderSettings("teacher", [entry()])
    assert(updated.includes("background-color:#AABBCC"))
  })
})

test("teacher mixed settings retain teaching scopes and keep a same-name activity as a separate selectable object", () => {
  const task = taskById("TASK_MATH_G1_P1"), name = classOf(task).name
  withState({}, "TEACHER_LYNN", () => {
    const html = render(providers(h(TeacherCardStyleEditor, { teacherId: "TEACHER_LYNN", entries: [entry({ className: name })] })))
    assert(html.includes('<optgroup label="教学对象">') && html.includes('<optgroup label="活动">'))
    assert(html.includes('aria-label="样式范围"'))
    for (const label of ["本任务", "本班级", "本课程"]) assert(html.includes(label))
    const values = optionValues(html)
    assert(values.includes(JSON.stringify(["teaching", task.id])))
    assert(values.includes(JSON.stringify(["activity", name])))
    assert.notEqual(JSON.stringify(["teaching", task.id]), JSON.stringify(["activity", name]))
  })
})
