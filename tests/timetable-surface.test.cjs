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
const { appearanceKey, resolveCardAppearance, resolveCardTextAppearance } = require("../lib/timetable/display.ts")
const { appearanceEditorPref, appearanceEditorEffective, saveAppearancePatch, cardSurfaceStyle, objectTextBackground } = require("../lib/timetable/surface.ts")
const { cardStyle, resolvePreference } = require("../lib/mt/styles.ts")
const { ClassCard } = require("../components/timetable/week-grid.tsx")
const { TimetableCardPreview, AppearanceEditorControls } = require("../components/timetable/display-settings.tsx")
const { DemoProvider } = require("../lib/demo/store.tsx")
const { MtProvider } = require("../lib/mt/store.tsx")

const entry = overrides => ({ key: "test-lesson", teacherId: "lin", date: "2026-10-26", weekday: 1, periodId: "m3", className: "高一1班 • 数学", subject: "数学", group: "P1", room: "D101", ...overrides })
const appearance = (styles = {}, mode = "admin", viewer = "u-lin") => ({ styles, mode, viewer })
const key = (part, id = entry().className, mode = "admin", viewer = "u-lin") => appearanceKey(viewer, mode, part, id)
const save = (all, part, patch, id = entry().className) => saveAppearancePatch(all, "u-lin", "admin", part, id, patch)
const restored = styles => JSON.parse(JSON.stringify(styles))
const surface = (styles, lesson = entry(), mode = "admin", viewer = "u-lin") => {
  const app = appearance(styles, mode, viewer)
  return cardSurfaceStyle(app, lesson, resolveCardAppearance(app, lesson))
}
const renderCard = props => render(h(DemoProvider, null, h(MtProvider, null, h(ClassCard, props))))
const outerTag = html => html.slice(0, html.indexOf(">") + 1)
const styleOf = html => outerTag(html).match(/\bstyle="([^"]*)"/)?.[1] ?? ""
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test("legacy CARD backgrounds keep their exact palette, transparent and automatic appearance", () => {
  for (const bg of ["mint", "NONE", "AUTO", "#abcdef"]) {
    const pref = { color: "#000000", bg, font: "mono" }
    const styles = freeze({ [key("CARD")]: pref })
    assert.deepEqual(surface(styles), cardStyle(resolvePreference(pref)), bg)
    assert.equal(appearanceEditorPref(appearance(styles), "CARD_SURFACE", entry().className).bg, bg)
    assert.equal(appearanceEditorPref(appearance(styles), "CARD_OBJECT_TEXT", entry().className).bg, undefined, "an old card background must not become a text highlight")
    assert.equal(objectTextBackground(appearance(styles), entry()), undefined)
  }
})

test("editing or resetting object text never changes the explicit card background or border", () => {
  const initial = freeze({
    [key("CARD")]: { color: "ink", bg: "mint", font: "mono", weight: "bold" },
    [key("CARD_SURFACE")]: { borderColor: "#123456", borderWidth: 2, borderStyle: "dashed", radius: 10 },
    [key("CARD_TEACHER_TEXT")]: { color: "plum" },
    [key("CARD_ROOM_TEXT")]: { color: "teal" },
  })
  const originalSurface = surface(initial)
  let styles = save(initial, "CARD_OBJECT_TEXT", { color: "brick", bg: "sky", font: "serif", weight: "normal" })
  assert.deepEqual(surface(styles), originalSurface)
  assert.equal(objectTextBackground(appearance(styles), entry()), "#e7eff8")
  assert.equal(resolveCardAppearance(appearance(styles), entry()).hex, "#a2422e")
  styles = restored(save(styles, "CARD_OBJECT_TEXT", null))
  assert.deepEqual(surface(styles), originalSurface)
  assert.equal(objectTextBackground(appearance(styles), entry()), undefined)
  for (const field of ["hex", "font", "weight"]) assert.equal(resolveCardAppearance(appearance(styles), entry())[field], null)
  for (const part of ["CARD_SURFACE", "CARD_TEACHER_TEXT", "CARD_ROOM_TEXT"]) assert.deepEqual(styles[key(part)], initial[key(part)])
  assert.deepEqual(initial[key("CARD")], { color: "ink", bg: "mint", font: "mono", weight: "bold" })
})

test("editing or resetting the surface preserves all text preferences and restores the teacher background", () => {
  const initial = freeze({
    [key("TEACHER", "lin")]: { color: "pine", bg: "rose" },
    [key("CARD")]: { color: "ink", bg: "mint", font: "mono", weight: "bold" },
    [key("CARD_OBJECT_TEXT")]: { bg: "sky" },
    [key("CARD_TEACHER_TEXT")]: { color: "plum" },
    [key("CARD_ROOM_TEXT")]: { color: "teal", font: "serif" },
  })
  let styles = restored(save(initial, "CARD_SURFACE", { bg: "sand", borderColor: "#123456", borderWidth: 3, borderStyle: "dotted", radius: 14 }))
  assert.equal(surface(styles).backgroundColor, "#f8f0dc")
  const text = appearanceEditorPref(appearance(styles), "CARD_OBJECT_TEXT", entry().className)
  assert.deepEqual(text, { color: "ink", bg: "sky", font: "mono", weight: "bold" })
  styles = restored(save(styles, "CARD_SURFACE", null))
  assert.deepEqual(surface(styles), { backgroundColor: "#f8e9e6", borderColor: "#e6c3bc" })
  assert.deepEqual(appearanceEditorPref(appearance(styles), "CARD_OBJECT_TEXT", entry().className), text)
  for (const part of ["CARD_OBJECT_TEXT", "CARD_TEACHER_TEXT", "CARD_ROOM_TEXT"]) assert.deepEqual(styles[key(part)], initial[key(part)])
  assert.equal(resolveCardTextAppearance(appearance(styles), entry(), "teacher").hex, "#6e3f6a")
})

test("partial saves and explicit zero border/radius values survive JSON persistence and field clearing", () => {
  let styles = save({}, "CARD_SURFACE", { bg: "mint", borderColor: "#abc", borderWidth: 2, borderStyle: "dashed", radius: 10 })
  styles = restored(save(styles, "CARD_SURFACE", { borderWidth: 0, radius: 0 }))
  assert.deepEqual(surface(styles), { backgroundColor: "#e8f3ec", borderColor: "#AABBCC", borderWidth: 0, borderStyle: "dashed", borderRadius: 0 })
  styles = restored(save(styles, "CARD_SURFACE", { borderColor: undefined }))
  assert.deepEqual(surface(styles), { backgroundColor: "#e8f3ec", borderColor: "#bcd9c6", borderWidth: 0, borderStyle: "dashed", borderRadius: 0 })
  styles = restored(save(styles, "CARD_SURFACE", { borderWidth: undefined, borderStyle: undefined, radius: undefined }))
  assert.deepEqual(surface(styles), { backgroundColor: "#e8f3ec", borderColor: "#bcd9c6" })
  styles = save(styles, "CARD_OBJECT_TEXT", { color: "ink", font: "serif", weight: "bold", bg: "sky" })
  styles = restored(save(styles, "CARD_OBJECT_TEXT", { color: "brick" }))
  assert.deepEqual(appearanceEditorPref(appearance(styles), "CARD_OBJECT_TEXT", entry().className), { color: "brick", font: "serif", weight: "bold", bg: "sky" })
  assert.equal(surface(styles).backgroundColor, "#e8f3ec")
})

test("invalid surface values cannot override valid saved properties", () => {
  const valid = freeze(save({}, "CARD_SURFACE", { bg: "mint", borderColor: "#123456", borderWidth: 2, borderStyle: "dashed", radius: 10 }))
  const expected = surface(valid)
  for (const patch of [
    { borderColor: "not-a-color" }, { borderColor: 123 },
    { borderWidth: -1 }, { borderWidth: 4 }, { borderWidth: 1.5 }, { borderWidth: "2" },
    { borderStyle: "double" }, { borderStyle: "inherit" },
    { radius: -1 }, { radius: 5 }, { radius: 100 }, { radius: "10" },
    { bg: "not-a-color" },
  ]) assert.deepEqual(surface(save(valid, "CARD_SURFACE", patch)), expected, JSON.stringify(patch))
  assert.deepEqual(surface(valid), expected)
  assert.equal(surface(save(valid, "CARD_SURFACE", { borderColor: "brick" })).borderColor.toLowerCase(), "#a2422e")
})

test("object text highlighting is independent of card background and uses its own AUTO color", () => {
  let styles = { [key("CARD")]: { color: "#000000", bg: "mint" } }
  styles = save(styles, "CARD_OBJECT_TEXT", { bg: "AUTO" })
  assert.equal(objectTextBackground(appearance(styles), entry()), "#e0e0e0")
  assert.equal(surface(styles).backgroundColor, "#e8f3ec")
  styles = restored(save(styles, "CARD_OBJECT_TEXT", { bg: "NONE" }))
  assert.equal(objectTextBackground(appearance(styles), entry()), "transparent")
  assert.equal(surface(styles).backgroundColor, "#e8f3ec")
  styles = restored(save(styles, "CARD_OBJECT_TEXT", { bg: undefined }))
  assert.equal(objectTextBackground(appearance(styles), entry()), undefined)
  assert.equal(surface(styles).backgroundColor, "#e8f3ec")
})

test("surface and object highlighting are viewer/class scoped and excluded from teacher mode or activities", () => {
  const styles = {
    [key("CARD_SURFACE")]: { borderColor: "#123456", borderWidth: 3, borderStyle: "dotted", radius: 14 },
    [key("CARD_OBJECT_TEXT")]: { bg: "sky" },
    [key("CARD_SURFACE", entry().className, "teacher")]: { borderColor: "#ff0000", radius: 10 },
  }
  assert.equal(surface(styles).borderWidth, 3)
  assert.equal(surface(styles, entry(), "admin", "u-zhou"), undefined)
  assert.equal(surface(styles, entry({ className: "另一个教学班" })), undefined)
  assert.equal(surface(styles, entry(), "teacher"), undefined)
  assert.equal(surface(styles, entry({ kind: "activity" })), undefined)
  assert.equal(cardSurfaceStyle(undefined, entry(), resolvePreference()), undefined)
  for (const [app, lesson] of [[appearance(styles, "teacher"), entry()], [appearance(styles), entry({ kind: "activity" })], [undefined, entry()]]) assert.equal(objectTextBackground(app, lesson), undefined)
})

test("real ClassCard applies surface CSS only to normal cards and retains status borders and conflict indications", () => {
  const styles = save({ [key("CARD")]: { color: "ink", font: "mono" } }, "CARD_SURFACE", { bg: "mint", borderColor: "#123456", borderWidth: 3, borderStyle: "dotted", radius: 14 })
  const props = { entry: entry(), appearance: appearance(styles), canonical: true }
  const normal = renderCard(props)
  assert(styleOf(normal).includes("background-color:#e8f3ec"))
  assert(styleOf(normal).includes("border-color:#123456"))
  assert(styleOf(normal).includes("border-width:3px") && styleOf(normal).includes("border-style:dotted") && styleOf(normal).includes("border-radius:14px"))
  for (const changed of [{ meta: { past: true } }, { meta: { voided: true } }, { meta: { draft: true } }, { entry: entry({ kind: "history" }) }, { entry: entry({ origin: "personal" }) }, { entry: entry({ makeupFrom: "2026-10-25" }) }]) {
    const html = renderCard({ ...props, ...changed })
    assert.equal(styleOf(html), "", "state surfaces must not be overwritten by ordinary appearance preferences")
  }
  const conflict = renderCard({ ...props, meta: { conflict: true, conflictLabels: ["教师冲突"], conflictReasons: ["同一教师同时有课"] } })
  assert(conflict.includes("ring-destructive/60") && conflict.includes("教师冲突"))
  assert(conflict.includes('title="同一教师同时有课"'))
  const review = renderCard({ ...props, meta: { reviewReasons: ["名单需核对"] } })
  assert(review.includes("同时段安排 · 待核对"))
})

test("the actual preview and lesson card render identical shared surface CSS and independent object highlighting", () => {
  const lesson = entry()
  let styles = save({}, "CARD_SURFACE", { bg: "mint", borderColor: "#123456", borderWidth: 3, borderStyle: "dotted", radius: 14 })
  styles = save(styles, "CARD_OBJECT_TEXT", { color: "ink", font: "serif", bg: "sky" })
  const app = appearance(styles), base = resolveCardAppearance(app, lesson)
  const preview = render(h(TimetableCardPreview, { entry: lesson, appearance: app, base, showTeacher: true }))
  const card = renderCard({ entry: lesson, appearance: app, canonical: true, showTeacher: true })
  const expected = render(h("div", { style: cardSurfaceStyle(app, lesson, base) }))
  assert.equal(styleOf(preview), styleOf(expected), "the visible preview must use the shared surface rules")
  assert.equal(styleOf(card), styleOf(expected), "the real lesson card must use the same rules")
  for (const html of [preview, card]) {
    assert(html.includes("background-color:#e7eff8"), "object highlighting must render inside the card")
    assert(styleOf(html).includes("background-color:#e8f3ec"), "the highlight must not recolor the card surface")
    assert(html.includes("示例林老师") && html.includes("D101"))
  }
})

test("object, teacher and location editors share the same text controls while the surface editor separates borders", () => {
  const own = { color: "ink", bg: "sky", font: "serif", weight: "bold" }
  const props = { own, effective: resolvePreference(own), controlKey: "same-editor-test", onSave: () => true, onPreview: () => {} }
  const rendered = ["CARD_OBJECT_TEXT", "CARD_TEACHER_TEXT", "CARD_ROOM_TEXT"].map(part => render(h(AppearanceEditorControls, { ...props, part })))
  assert.equal(rendered[0], rendered[1])
  assert.equal(rendered[1], rendered[2])
  for (const label of ["文字颜色", "文字底色", "字重", "字体"]) assert(rendered[0].includes(label), label)
  const surfaceEditor = render(h(AppearanceEditorControls, { ...props, part: "CARD_SURFACE", own: { bg: "mint", borderColor: "#123456", borderWidth: 2, borderStyle: "dashed", radius: 10 } }))
  assert(surfaceEditor.includes("边框") && surfaceEditor.includes("圆角") && surfaceEditor.includes("背景"))
  assert(!surfaceEditor.includes("文字颜色") && !surfaceEditor.includes("字重") && !surfaceEditor.includes("字体"))
})

test("AUTO editor color values agree with the effective card or object highlight, including inherited teacher color", () => {
  const lesson = entry()
  for (const scenario of [
    { part: "CARD_SURFACE", label: "课卡背景HEX", styles: { [key("CARD")]: { color: "#000000", bg: "AUTO" } } },
    { part: "CARD_SURFACE", label: "课卡背景HEX", styles: { [key("TEACHER", "lin")]: { color: "#000000" }, [key("CARD")]: { bg: "AUTO" } } },
    { part: "CARD_OBJECT_TEXT", label: "文字底色HEX", styles: { [key("TEACHER", "lin")]: { color: "#000000", bg: "mint" }, [key("CARD_OBJECT_TEXT")]: { bg: "AUTO" } } },
  ]) {
    const app = appearance(scenario.styles)
    const effective = appearanceEditorEffective(app, scenario.part, lesson.className, lesson)
    const actualBackground = scenario.part === "CARD_SURFACE" ? surface(scenario.styles).backgroundColor : objectTextBackground(app, lesson)
    assert.equal(effective.bg.hex, "#e0e0e0")
    assert.equal(effective.bg.hex, actualBackground)
    const controls = render(h(AppearanceEditorControls, {
      part: scenario.part, own: appearanceEditorPref(app, scenario.part, lesson.className), effective,
      controlKey: "auto-editor-test", onSave: () => true, onPreview: () => {},
    }))
    const input = controls.match(new RegExp(`<input\\b[^>]*aria-label="${scenario.label}"[^>]*>`))?.[0]
    assert(input, scenario.label)
    assert.match(input, /value="#e0e0e0"/i, "the editable HEX field must display the same background as the actual card")
  }
})
