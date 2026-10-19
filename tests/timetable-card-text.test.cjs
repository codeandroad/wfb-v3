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
const { resolvePreference, saveStylePatch } = require("../lib/mt/styles.ts")
const { StyledCardText } = require("../components/timetable/display-settings.tsx")
const { ClassCard } = require("../components/timetable/week-grid.tsx")
const { DemoProvider } = require("../lib/demo/store.tsx")
const { MtProvider } = require("../lib/mt/store.tsx")

const entry = overrides => ({ key: "test-lesson", teacherId: "lin", date: "2026-10-26", weekday: 1, periodId: "m3", className: "高一1班 • 数学", subject: "数学", group: "P1", room: "D101", ...overrides })
const appearance = (styles = {}, mode = "admin", viewer = "u-lin") => ({ styles, mode, viewer })
const key = (part, id = entry().className, mode = "admin", viewer = "u-lin") => appearanceKey(viewer, mode, part, id)
const restored = styles => JSON.parse(JSON.stringify(styles))
const renderCard = props => render(h(DemoProvider, null, h(MtProvider, null, h(ClassCard, props))))
const opening = (html, field) => html.match(new RegExp(`<span\\b[^>]*data-card-text="${field}"[^>]*>`))?.[0]
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test("card teacher and room text are isolated by viewer, display mode, class and field", () => {
  const styles = freeze({
    [key("CARD_TEACHER_TEXT")]: { color: "brick", font: "serif" },
    [key("CARD_ROOM_TEXT")]: { color: "teal", bg: "sky" },
    [key("CARD_TEACHER_TEXT", entry().className, "admin", "u-zhou")]: { color: "plum" },
    [key("CARD_TEACHER_TEXT", "高一2班 • 数学")]: { color: "olive" },
    [key("CARD_TEACHER_TEXT", entry().className, "teacher")]: { color: "ink" },
  })
  assert.equal(resolveCardTextAppearance(appearance(styles), entry(), "teacher").hex, "#a2422e")
  assert.equal(resolveCardTextAppearance(appearance(styles), entry(), "room").hex, "#1f6f74")
  assert.equal(resolveCardTextAppearance(appearance(styles, "admin", "u-zhou"), entry(), "teacher").hex, "#6e3f6a")
  assert.deepEqual(resolveCardTextAppearance(appearance(styles, "admin", "u-chen"), entry(), "teacher"), resolvePreference())
  assert.deepEqual(resolveCardTextAppearance(appearance(styles, "teacher"), entry(), "teacher"), resolvePreference())
  assert.equal(resolveCardTextAppearance(appearance(styles), entry({ className: "高一2班 • 数学" }), "teacher").hex, "#5c6b23")
  assert.deepEqual(resolveCardTextAppearance(appearance(styles), entry({ className: "高一2班 • 数学" }), "room"), resolvePreference())
  assert.equal(resolveCardTextAppearance(appearance(styles), entry({ teacherId: "zhou" }), "teacher").hex, "#a2422e", "these text-field preferences belong to the class, not the inspected teacher")
})

test("text fields do not inherit whole-card or teacher-title appearance and ignore activities or absent appearance", () => {
  const styles = freeze({
    [key("TEACHER", "lin")]: { color: "ink", bg: "mint", font: "mono", weight: "bold" },
    [key("CARD")]: { color: "brick", bg: "rose" },
  })
  for (const field of ["teacher", "room"]) assert.deepEqual(resolveCardTextAppearance(appearance(styles), entry(), field), resolvePreference())
  const withFields = { ...styles, [key("CARD_TEACHER_TEXT")]: { color: "plum" }, [key("CARD_ROOM_TEXT")]: { bg: "sky" } }
  for (const field of ["teacher", "room"]) {
    assert.deepEqual(resolveCardTextAppearance(undefined, entry(), field), resolvePreference())
    assert.deepEqual(resolveCardTextAppearance(appearance(withFields), entry({ kind: "activity" }), field), resolvePreference())
  }
  assert.deepEqual(resolveCardAppearance(appearance(withFields), entry()), resolveCardAppearance(appearance(styles), entry()))
})

test("saving and clearing a text field survives JSON persistence without modifying other style keys", () => {
  const teacherKey = key("CARD_TEACHER_TEXT")
  const initial = freeze({
    [key("CARD")]: { color: "ink", bg: "mint" },
    [key("TEACHER", "lin")]: { weight: "bold" },
    [key("CARD_ROOM_TEXT")]: { color: "teal" },
    [key("SUBJECT", "MATH")]: { color: "plum" },
    [key("CARD_TEACHER_TEXT", entry().className, "admin", "u-zhou")]: { color: "olive" },
  })
  let styles = restored(saveStylePatch(initial, teacherKey, { color: "brick", bg: "sky", font: "serif" }))
  assert.equal(resolveCardTextAppearance(appearance(styles), entry(), "teacher").hex, "#a2422e")
  styles = restored(saveStylePatch(styles, teacherKey, { color: undefined }))
  const partial = resolveCardTextAppearance(appearance(styles), entry(), "teacher")
  assert.equal(partial.hex, null, "clearing field color must not pick up the whole-card color")
  assert.equal(partial.bg.hex, "#e7eff8")
  assert.equal(partial.font, "serif")
  styles = restored(saveStylePatch(styles, teacherKey, null))
  const cleared = resolveCardTextAppearance(appearance(styles), entry(), "teacher")
  for (const field of ["hex", "bg", "weight", "font"]) assert.equal(cleared[field], null)
  for (const [storedKey, value] of Object.entries(initial)) assert.deepEqual(styles[storedKey], value, storedKey)
})

test("shared StyledCardText renders independent font, weight, text color and local background", () => {
  const styles = {
    [key("CARD_TEACHER_TEXT")]: { color: "brick", bg: "sky", font: "serif", weight: "bold" },
    [key("CARD_ROOM_TEXT")]: { color: "#000000", bg: "AUTO", font: "mono", weight: "normal" },
  }
  const teacher = render(h(StyledCardText, { entry: entry(), appearance: appearance(styles), field: "teacher" }, "示例林老师"))
  assert.equal(teacher.replace(/<[^>]+>/g, ""), "示例林老师")
  const teacherSpan = opening(teacher, "teacher")
  assert(teacherSpan?.includes("font-serif") && teacherSpan.includes("font-bold"))
  assert(teacherSpan.includes("color:#a2422e") && teacherSpan.includes("background-color:#e7eff8"))
  const room = render(h(StyledCardText, { entry: entry(), appearance: appearance(styles), field: "room" }, "D101"))
  const roomSpan = opening(room, "room")
  assert(roomSpan?.includes("font-mono") && roomSpan.includes("font-normal"))
  assert(roomSpan.includes("color:#000000") && roomSpan.includes("background-color:#e0e0e0"))
  const plain = render(h(StyledCardText, { entry: entry(), field: "room" }, "D101"))
  assert(!opening(plain, "room").includes("style="), "without a preference the old row style remains inherited")
})

test("real ClassCard applies text-field styles without changing the card title, background, subject or conflict state", () => {
  const styles = {
    [key("CARD")]: { color: "ink", bg: "mint", font: "mono" },
    [key("SUBJECT", "MATH")]: { color: "plum" },
    [key("CARD_TEACHER_TEXT")]: { color: "brick", bg: "sky", font: "serif", weight: "bold" },
    [key("CARD_ROOM_TEXT")]: { color: "teal", bg: "sand", weight: "normal" },
  }
  const html = renderCard({ entry: entry(), canonical: true, showTeacher: true, appearance: appearance(styles), meta: { conflict: true, conflictLabels: ["教师冲突"], conflictReasons: ["同一教师同时有课"] } })
  assert(opening(html, "teacher")?.includes("color:#a2422e"))
  assert(opening(html, "teacher").includes("background-color:#e7eff8"))
  assert(opening(html, "room")?.includes("color:#1f6f74"))
  assert(opening(html, "room").includes("background-color:#f8f0dc"))
  assert(html.startsWith("<div") && html.slice(0, html.indexOf(">")).includes("background-color:#e8f3ec"), "local field backgrounds must not replace the outer card background")
  assert.match(html, /<span[^>]*class="[^"]*font-mono[^"]*"[^>]*style="color:#2d4f7c"/)
  assert.match(html, /data-title-part="subject" style="color:#6e3f6a"/)
  assert(html.includes("教师冲突") && html.includes("ring-destructive/60"))
  assert(html.includes('title="同一教师同时有课"'))
  assert(html.includes("示例林老师") && html.includes("D101"))
})

test("teacher-view cards omit the teacher row and missing room stays an honest placeholder", () => {
  const styles = { [key("CARD_TEACHER_TEXT")]: { color: "brick" }, [key("CARD_ROOM_TEXT")]: { color: "teal", bg: "sky" } }
  const teacherView = renderCard({ entry: entry(), canonical: true, showTeacher: false, appearance: appearance(styles) })
  assert.equal(opening(teacherView, "teacher"), undefined)
  assert(!teacherView.includes("示例林老师"))
  assert(opening(teacherView, "room")?.includes("color:#1f6f74"))
  const missingRoom = renderCard({ entry: entry({ room: null }), canonical: true, showTeacher: true, appearance: appearance(styles) })
  assert(missingRoom.includes("未安排场所"))
  assert(!missingRoom.includes("D101") && !missingRoom.includes("办公室"), "display styling must never supply an invented teaching location")
  assert(missingRoom.includes("示例林老师"))
})

test("real activity cards and cards without appearance do not consume teaching-card text preferences", () => {
  const styles = { [key("CARD_TEACHER_TEXT")]: { color: "brick", bg: "sky" }, [key("CARD_ROOM_TEXT")]: { color: "teal", bg: "sand" } }
  for (const props of [
    { entry: entry({ kind: "activity" }), appearance: appearance(styles) },
    { entry: entry(), appearance: undefined },
    { entry: entry(), appearance: appearance({ [key("CARD_TEACHER_TEXT", entry().className, "teacher")]: { color: "brick" } }, "teacher") },
  ]) {
    const html = renderCard({ ...props, canonical: true, showTeacher: true })
    for (const field of ["teacher", "room"]) assert(!opening(html, field)?.includes("style="), field)
    assert(html.includes("示例林老师") && html.includes("D101"))
  }
})
