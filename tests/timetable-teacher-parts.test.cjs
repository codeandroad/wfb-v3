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

const { styleKey, resolveStyle, resolvePreference, saveStylePatch, cardStyle } = require("../lib/mt/styles.ts")
const {
  teacherPartKey, teacherEditorPref, teacherEditorEffective, saveTeacherAppearancePatch,
  teacherSurfaceStyle, teacherObjectBackground, teacherCardTextStyle,
} = require("../lib/timetable/teacher-appearance.ts")
const { createElement: h } = require("react")
const { renderToStaticMarkup: render } = require("react-dom/server")
const mtStore = require("../lib/mt/store.tsx")
const mtDerive = require("../lib/mt/derive.ts")
const { taskById, classOf } = require("../lib/mt/model.ts")
const { StyledLessonTitle, StyledCardText, TimetableCardPreview, TeacherCardStyleEditor, personalAppearanceTask } = require("../components/timetable/display-settings.tsx")
const { ClassCard } = require("../components/timetable/week-grid.tsx")
const { DemoProvider } = require("../lib/demo/store.tsx")
const { TimetableProvider } = require("../lib/timetable/store.tsx")

const teacher = "T01"
const task = { id: "TASK_1", class_id: "CLASS_1", course_id: "COURSE_1", teacher_id: teacher }
const ids = { TASK: task.id, CLASS: task.class_id, COURSE: task.course_id }
const key = level => styleKey(teacher, level, ids[level])
const partKey = (level, part) => teacherPartKey(teacher, level, ids[level], part)
const save = (styles, level, part, patch) => saveTeacherAppearancePatch(styles, teacher, level, ids[level], part, patch)
const effective = (styles, part) => teacherEditorEffective(styles, teacher, task, part)
const restored = styles => JSON.parse(JSON.stringify(styles))
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test("legacy styles remain unchanged when no new teacher part is configured", () => {
  const styles = freeze({
    [key("TASK")]: { color: "ink", font: "mono" },
    [key("CLASS")]: { bg: "mint", weight: "bold" },
    [key("COURSE")]: { color: "brick", bg: "rose", font: "serif" },
  })
  const legacy = resolveStyle({ styles }, teacher, task)
  assert.deepEqual(effective(styles, "CARD_SURFACE"), legacy)
  assert.deepEqual(teacherSurfaceStyle(styles, teacher, task), cardStyle(legacy))
  const title = effective(styles, "CARD_OBJECT_TEXT")
  assert.equal(title.hex, legacy.hex)
  assert.equal(title.font, legacy.font)
  assert.equal(title.weight, legacy.weight)
  assert.equal(title.bg, null, "legacy card background must never become an object text highlight")
  assert.equal(teacherObjectBackground(styles, teacher, task), undefined)
  for (const field of ["teacher", "room"]) assert.deepEqual(teacherCardTextStyle(styles, teacher, task, field), resolvePreference())
  assert.equal(teacherSurfaceStyle({}, teacher, task), undefined)
  assert.equal(teacherSurfaceStyle(styles, null, task), undefined)
})

test("editors preserve legacy keys and scope values while supplemental parts use their own suffix", () => {
  let styles = save({}, "TASK", "CARD_SURFACE", { bg: "mint", borderColor: "#123456", borderWidth: 2 })
  styles = save(styles, "TASK", "CARD_OBJECT_TEXT", { color: "ink", font: "serif", weight: "bold", bg: "sky" })
  styles = save(styles, "TASK", "CARD_TEACHER_TEXT", { color: "plum" })
  styles = save(styles, "TASK", "CARD_ROOM_TEXT", { color: "teal" })
  assert.equal(styles[key("TASK")].bg, "mint")
  assert.equal(styles[key("TASK")].color, "ink")
  assert.equal(styles[key("TASK")].font, "serif")
  assert.equal(styles[`${key("TASK")}|CARD_OBJECT_TEXT`].bg, "sky")
  assert.equal(styles[`${key("TASK")}|CARD_SURFACE`].borderWidth, 2)
  assert.deepEqual(teacherEditorPref(styles, teacher, "TASK", task.id, "CARD_OBJECT_TEXT"), { color: "ink", font: "serif", weight: "bold", bg: "sky" })
  assert.deepEqual(teacherEditorPref(styles, teacher, "TASK", task.id, "CARD_SURFACE"), { bg: "mint", borderColor: "#123456", borderWidth: 2 })
  assert.equal(teacherEditorPref(styles, teacher, "COURSE", task.course_id, "CARD_OBJECT_TEXT").color, undefined, "the editor's own values are distinct from inherited effective values")
})

test("legacy attributes still follow last successful save per attribute across TASK CLASS and COURSE", () => {
  let styles = save({}, "TASK", "CARD_OBJECT_TEXT", { color: "ink", font: "mono" })
  styles = save(styles, "CLASS", "CARD_SURFACE", { bg: "mint" })
  styles = save(styles, "COURSE", "CARD_OBJECT_TEXT", { color: "brick" })
  styles = save(styles, "TASK", "CARD_OBJECT_TEXT", { weight: "normal" })
  assert.equal(effective(styles, "CARD_OBJECT_TEXT").hex, "#a2422e")
  assert.equal(effective(styles, "CARD_OBJECT_TEXT").font, "mono")
  assert.equal(effective(styles, "CARD_OBJECT_TEXT").weight, "normal")
  assert.equal(effective(styles, "CARD_SURFACE").bg.hex, "#e8f3ec")
  styles = restored(save(styles, "CLASS", "CARD_OBJECT_TEXT", { color: undefined }))
  assert.equal(effective(styles, "CARD_OBJECT_TEXT").hex, null)
  assert.equal(effective(styles, "CARD_OBJECT_TEXT").font, "mono")
  styles = restored(save(styles, "COURSE", "CARD_OBJECT_TEXT", null))
  for (const field of ["hex", "weight", "font"]) assert.equal(effective(styles, "CARD_OBJECT_TEXT")[field], null)
  assert.equal(effective(styles, "CARD_SURFACE").bg.hex, "#e8f3ec")
  styles = saveStylePatch(styles, key("TASK"), { color: "pine" })
  assert.equal(effective(styles, "CARD_OBJECT_TEXT").hex, "#2f6b4f", "existing callers and the new adapter share one save sequence")
})

test("border fields follow last-save scope precedence, including zero values and persistent reset tombstones", () => {
  let styles = save({}, "TASK", "CARD_SURFACE", { bg: "mint", borderColor: "#123456", borderWidth: 3, borderStyle: "dashed", radius: 14 })
  styles = save(styles, "CLASS", "CARD_SURFACE", { borderColor: "#abcdef", radius: 0 })
  styles = save(styles, "COURSE", "CARD_SURFACE", { borderWidth: 0 })
  assert.deepEqual(teacherSurfaceStyle(styles, teacher, task), { backgroundColor: "#e8f3ec", borderColor: "#ABCDEF", borderWidth: 0, borderStyle: "dashed", borderRadius: 0 })
  styles = restored(save(styles, "COURSE", "CARD_SURFACE", { borderColor: undefined, radius: undefined }))
  assert.deepEqual(teacherSurfaceStyle(styles, teacher, task), { backgroundColor: "#e8f3ec", borderColor: "#bcd9c6", borderWidth: 0, borderStyle: "dashed" })
  assert(styles[partKey("COURSE", "CARD_SURFACE")].order.borderColor > styles[partKey("CLASS", "CARD_SURFACE")].order.borderColor)
  styles = restored(save(styles, "CLASS", "CARD_SURFACE", null))
  assert.equal(teacherSurfaceStyle(styles, teacher, task), undefined, "all older backgrounds and supplemental border values remain cleared")
  styles = save(styles, "TASK", "CARD_SURFACE", { borderWidth: 2 })
  assert.deepEqual(teacherSurfaceStyle(styles, teacher, task), { borderWidth: 2 })
})

test("supplemental text resolves each field across scopes and clears without reviving an older value", () => {
  let styles = save({}, "TASK", "CARD_TEACHER_TEXT", { color: "ink", bg: "mint", font: "mono" })
  styles = save(styles, "CLASS", "CARD_TEACHER_TEXT", { color: "brick" })
  styles = save(styles, "COURSE", "CARD_TEACHER_TEXT", { weight: "bold", bg: "sky" })
  styles = save(styles, "COURSE", "CARD_ROOM_TEXT", { color: "teal", bg: "sand" })
  const name = teacherCardTextStyle(styles, teacher, task, "teacher")
  assert.equal(name.hex, "#a2422e")
  assert.equal(name.font, "mono")
  assert.equal(name.bg.hex, "#e7eff8")
  assert.equal(name.weight, "bold")
  assert.equal(name.from.color, "CLASS")
  styles = restored(save(styles, "COURSE", "CARD_TEACHER_TEXT", { color: undefined }))
  assert.equal(teacherCardTextStyle(styles, teacher, task, "teacher").hex, null)
  assert.equal(teacherCardTextStyle(styles, teacher, task, "teacher").bg.hex, "#e7eff8")
  styles = restored(save(styles, "CLASS", "CARD_TEACHER_TEXT", null))
  for (const field of ["hex", "bg", "font", "weight"]) assert.equal(teacherCardTextStyle(styles, teacher, task, "teacher")[field], null)
  assert.equal(teacherCardTextStyle(styles, teacher, task, "room").hex, "#1f6f74")
  assert.equal(teacherCardTextStyle(styles, teacher, task, "room").bg.hex, "#f8f0dc")
})

test("object highlight uses its scoped winning value and AUTO follows the final legacy title color", () => {
  let styles = save({}, "TASK", "CARD_OBJECT_TEXT", { color: "#000000", bg: "sky" })
  styles = save(styles, "CLASS", "CARD_SURFACE", { bg: "mint" })
  styles = save(styles, "COURSE", "CARD_OBJECT_TEXT", { bg: "AUTO" })
  assert.equal(teacherObjectBackground(styles, teacher, task), "#e0e0e0")
  assert.equal(effective(styles, "CARD_OBJECT_TEXT").bg.hex, "#e0e0e0")
  assert.equal(effective(styles, "CARD_OBJECT_TEXT").from.bg, "COURSE")
  assert.equal(teacherSurfaceStyle(styles, teacher, task).backgroundColor, "#e8f3ec")
  styles = save(styles, "CLASS", "CARD_OBJECT_TEXT", { color: "#ffffff" })
  assert.equal(teacherObjectBackground(styles, teacher, task), "#ffffff")
  styles = restored(save(styles, "CLASS", "CARD_OBJECT_TEXT", { bg: undefined }))
  assert.equal(teacherObjectBackground(styles, teacher, task), undefined)
  styles = save(styles, "TASK", "CARD_OBJECT_TEXT", { bg: "NONE" })
  assert.equal(teacherObjectBackground(styles, teacher, task), "transparent")
})

test("surface and object resets are independent of one another and metadata text", () => {
  let styles = save({}, "TASK", "CARD_SURFACE", { bg: "mint", borderColor: "#123456", borderWidth: 2 })
  styles = save(styles, "TASK", "CARD_OBJECT_TEXT", { color: "ink", bg: "sky", font: "serif" })
  styles = save(styles, "CLASS", "CARD_TEACHER_TEXT", { color: "plum" })
  styles = save(styles, "COURSE", "CARD_ROOM_TEXT", { color: "teal" })
  freeze(styles)
  const surfaceBefore = teacherSurfaceStyle(styles, teacher, task)
  const objectCleared = restored(save(styles, "COURSE", "CARD_OBJECT_TEXT", null))
  assert.deepEqual(teacherSurfaceStyle(objectCleared, teacher, task), surfaceBefore)
  assert.equal(effective(objectCleared, "CARD_OBJECT_TEXT").hex, null)
  assert.equal(teacherObjectBackground(objectCleared, teacher, task), undefined)
  const surfaceCleared = restored(save(styles, "COURSE", "CARD_SURFACE", null))
  assert.equal(teacherSurfaceStyle(surfaceCleared, teacher, task), undefined)
  assert.equal(effective(surfaceCleared, "CARD_OBJECT_TEXT").hex, "#2d4f7c")
  assert.equal(teacherObjectBackground(surfaceCleared, teacher, task), "#e7eff8")
  for (const next of [objectCleared, surfaceCleared]) {
    assert.equal(teacherCardTextStyle(next, teacher, task, "teacher").hex, "#6e3f6a")
    assert.equal(teacherCardTextStyle(next, teacher, task, "room").hex, "#1f6f74")
  }
})

test("invalid style candidates do not replace valid values or acquire winning timestamps", () => {
  let valid = save({}, "TASK", "CARD_SURFACE", { bg: "mint", borderColor: "#123456", borderWidth: 2, borderStyle: "dashed", radius: 10 })
  valid = freeze(save(valid, "TASK", "CARD_OBJECT_TEXT", { color: "ink", font: "serif", weight: "bold" }))
  const initialSurface = teacherSurfaceStyle(valid, teacher, task)
  const initialTitle = effective(valid, "CARD_OBJECT_TEXT")
  for (const patch of [{ borderColor: 7 }, { borderColor: "nonsense" }, { borderWidth: "2" }, { borderWidth: 4 }, { borderWidth: -1 }, { radius: 9 }, { radius: "10" }, { borderStyle: "double" }, { bg: "not-a-color" }]) {
    assert.deepEqual(teacherSurfaceStyle(save(valid, "COURSE", "CARD_SURFACE", patch), teacher, task), initialSurface)
  }
  for (const patch of [{ color: 7 }, { color: "not-a-color" }, { font: "toString" }, { weight: "constructor" }]) {
    assert.deepEqual(effective(save(valid, "COURSE", "CARD_OBJECT_TEXT", patch), "CARD_OBJECT_TEXT"), initialTitle)
  }
})

test("real teacher identity is isolated from staff-viewer keys and related tasks share only their scope", () => {
  let styles = save({}, "CLASS", "CARD_SURFACE", { bg: "mint", borderWidth: 2 })
  styles = save(styles, "TASK", "CARD_OBJECT_TEXT", { color: "brick" })
  styles = save(styles, "COURSE", "CARD_ROOM_TEXT", { color: "teal" })
  const anotherTask = { ...task, id: "TASK_2" }
  assert.deepEqual(teacherSurfaceStyle(styles, teacher, anotherTask), teacherSurfaceStyle(styles, teacher, task))
  assert.equal(teacherEditorEffective(styles, teacher, anotherTask, "CARD_OBJECT_TEXT").hex, null)
  assert.equal(teacherCardTextStyle(styles, teacher, anotherTask, "room").hex, "#1f6f74")
  const otherTeacher = { ...task, teacher_id: "T02" }
  assert.equal(teacherSurfaceStyle(styles, "T02", otherTeacher), undefined)
  assert.equal(teacherCardTextStyle(styles, "T02", otherTeacher, "room").hex, null)
  const foreign = { ...styles, [`timetable-display|u-lin|teacher|CARD_SURFACE|${task.class_id}`]: { bg: "rose", borderWidth: 3 } }
  assert.deepEqual(teacherSurfaceStyle(foreign, teacher, task), teacherSurfaceStyle(styles, teacher, task))
  assert.equal(teacherSurfaceStyle(styles, "u-lin", task), undefined)
})

test("legacy automatic and transparent backgrounds remain exact, while metadata AUTO follows its own text", () => {
  for (const bg of ["AUTO", "NONE", "#abcdef"]) {
    const styles = { [key("TASK")]: { color: "#000000", bg } }
    assert.deepEqual(teacherSurfaceStyle(styles, teacher, task), cardStyle(resolveStyle({ styles }, teacher, task)))
  }
  let styles = save({}, "TASK", "CARD_OBJECT_TEXT", { color: "brick" })
  styles = save(styles, "CLASS", "CARD_TEACHER_TEXT", { color: "#000000", bg: "AUTO" })
  assert.equal(teacherCardTextStyle(styles, teacher, task, "teacher").bg.hex, "#e0e0e0")
  assert.equal(effective(styles, "CARD_OBJECT_TEXT").hex, "#a2422e")
})

function realTeacherScenario() {
  const realTask = taskById("TASK_MATH_G1_P1")
  const realTeacher = realTask.teacher_id
  const cls = classOf(realTask)
  let styles = saveTeacherAppearancePatch({}, realTeacher, "TASK", realTask.id, "CARD_SURFACE", { bg: "mint", borderColor: "#123456", borderWidth: 2, borderStyle: "dashed", radius: 10 })
  styles = saveTeacherAppearancePatch(styles, realTeacher, "TASK", realTask.id, "CARD_OBJECT_TEXT", { color: "ink", font: "serif", bg: "sky" })
  styles = saveTeacherAppearancePatch(styles, realTeacher, "TASK", realTask.id, "CARD_TEACHER_TEXT", { color: "brick", bg: "rose", weight: "bold" })
  styles = saveTeacherAppearancePatch(styles, realTeacher, "TASK", realTask.id, "CARD_ROOM_TEXT", { color: "teal", bg: "sand", font: "mono" })
  const entry = { key: "synthetic-real-task", taskId: realTask.id, teacherId: "lin", className: cls.name, subject: cls.subject, date: "2026-10-26", weekday: 1, periodId: "m3", room: "D101", group: "P1" }
  const appearance = { mode: "teacher", viewer: "u-lin", teacherId: realTeacher, styles }
  const biz = { ...mtStore.freshBiz("BASE"), styles }
  return { task: realTask, teacher: realTeacher, entry, appearance, biz, base: resolveStyle(biz, realTeacher, realTask) }
}

function withTeacherState(scenario, run) {
  const originalUseMt = mtStore.useMt, originalTeacherId = mtDerive.useTeacherId
  mtStore.useMt = () => ({ biz: scenario.biz, ready: true, loadError: false, command: () => ({ ok: true }) })
  mtDerive.useTeacherId = () => scenario.teacher
  try { return run() } finally { mtStore.useMt = originalUseMt; mtDerive.useTeacherId = originalTeacherId }
}

const openingText = (html, field) => html.match(new RegExp(`<span\\b[^>]*data-card-text="${field}"[^>]*>`))?.[0]
const outerStyle = html => html.slice(0, html.indexOf(">") + 1).match(/\bstyle="([^"]*)"/)?.[1] ?? ""

test("actual title and metadata components resolve teacher-scoped supplemental styles for a real teaching task", () => {
  const scenario = realTeacherScenario()
  const title = render(h(StyledLessonTitle, scenario))
  assert(openingText(title, "object")?.includes("background-color:#e7eff8"))
  assert.equal(title.replace(/<[^>]+>/g, ""), scenario.entry.className)
  const teacherText = render(h(StyledCardText, { ...scenario, field: "teacher" }, "示例林老师"))
  assert(openingText(teacherText, "teacher")?.includes("color:#a2422e"))
  assert(openingText(teacherText, "teacher").includes("background-color:#f8e9e6"))
  assert(openingText(teacherText, "teacher").includes("font-bold"))
  const roomText = render(h(StyledCardText, { ...scenario, field: "room" }, "D101"))
  assert(openingText(roomText, "room")?.includes("color:#1f6f74"))
  assert(openingText(roomText, "room").includes("background-color:#f8f0dc"))
  assert(openingText(roomText, "room").includes("font-mono"))
  const foreign = { ...scenario, appearance: { ...scenario.appearance, teacherId: "ANOTHER_REAL_TEACHER" } }
  assert.equal(openingText(render(h(StyledLessonTitle, foreign)), "object"), undefined)
  assert(!openingText(render(h(StyledCardText, { ...foreign, field: "room" }, "D101")), "room").includes("style="))
})

test("real teacher ClassCard and preview use the same surface, object and location styles and hide redundant names", () => {
  const scenario = realTeacherScenario()
  withTeacherState(scenario, () => {
    const props = { entry: scenario.entry, appearance: scenario.appearance, showTeacher: false }
    const card = render(h(ClassCard, props))
    const preview = render(h(TimetableCardPreview, { ...props, base: scenario.base }))
    const expectedSurface = render(h("div", { style: teacherSurfaceStyle(scenario.biz.styles, scenario.teacher, scenario.task) }))
    assert.equal(outerStyle(card), outerStyle(expectedSurface))
    assert.equal(outerStyle(preview), outerStyle(expectedSurface))
    assert(outerStyle(card).includes("border-width:2px") && outerStyle(card).includes("border-radius:10px"))
    for (const html of [card, preview]) {
      assert(openingText(html, "object")?.includes("background-color:#e7eff8"))
      assert(openingText(html, "room")?.includes("color:#1f6f74"))
      assert(openingText(html, "room").includes("background-color:#f8f0dc"))
      assert.equal(openingText(html, "teacher"), undefined)
      assert(!html.includes("示例林老师"))
      assert(html.includes("color:#2d4f7c") && html.includes("font-serif"))
      assert(html.includes("D101"))
    }
    const withName = render(h(ClassCard, { ...props, showTeacher: true }))
    assert(openingText(withName, "teacher")?.includes("color:#a2422e"))
    assert(withName.includes("示例林老师"))
  })
})

test("teacher-scoped surface styling cannot hide actual ClassCard state surfaces or conflict indications", () => {
  const scenario = realTeacherScenario()
  withTeacherState(scenario, () => {
    const props = { entry: scenario.entry, appearance: scenario.appearance, showTeacher: false }
    for (const changed of [{ meta: { past: true } }, { meta: { voided: true } }, { meta: { draft: true } }, { entry: { ...scenario.entry, kind: "history" } }, { entry: { ...scenario.entry, origin: "personal" } }, { entry: { ...scenario.entry, makeupFrom: "2026-10-25" } }]) {
      const html = render(h(ClassCard, { ...props, ...changed }))
      assert.equal(outerStyle(html), "", "state cards must keep their own outer background and border")
      assert(openingText(html, "room")?.includes("color:#1f6f74"))
    }
    const conflict = render(h(ClassCard, { ...props, meta: { conflict: true, conflictLabels: ["教师冲突"], conflictReasons: ["同一教师同时有课"] } }))
    assert(conflict.includes("ring-destructive/60") && conflict.includes("教师冲突"))
    assert(conflict.includes('title="同一教师同时有课"'))
    const review = render(h(ClassCard, { ...props, meta: { reviewReasons: ["学生名单需核对"] } }))
    assert(review.includes("同时段安排 · 待核对"))
  })
})

test("real teacher editor exposes all legacy scopes and four content tabs including the place field", () => {
  const scenario = realTeacherScenario()
  withTeacherState(scenario, () => {
    const html = render(h(DemoProvider, null, h(TimetableProvider, { clock: "2026-10-26T08:00" }, h(TeacherCardStyleEditor, { teacherId: scenario.teacher, entries: [scenario.entry] }))))
    assert(html.includes("data-teacher-style-editor"))
    assert(html.includes('aria-label="样式范围"'))
    for (const label of ["本任务", "本班级", "本课程"]) assert(html.includes(label), label)
    assert(html.includes('aria-label="课卡内容样式"'))
    for (const label of ["课卡外观", "对象名称", "教师姓名", "场所"]) assert(html.includes(label), label)
    assert(html.includes("同一属性以最后成功保存为准"))
    assert(html.includes('data-appearance-controls="surface"'))
    assert(html.includes("边框粗细") && html.includes("课卡圆角"))
  })
})

function bigDemoScenario() {
  const realTask = taskById("TASK_BIG_38"), realTeacher = "TEACHER_LYNN"
  const cls = classOf(realTask)
  let styles = saveTeacherAppearancePatch({}, realTeacher, "TASK", realTask.id, "CARD_SURFACE", { bg: "mint", borderColor: "#123456", borderWidth: 2, radius: 10 })
  styles = saveTeacherAppearancePatch(styles, realTeacher, "TASK", realTask.id, "CARD_OBJECT_TEXT", { color: "ink", bg: "sky" })
  styles = saveTeacherAppearancePatch(styles, realTeacher, "TASK", realTask.id, "CARD_ROOM_TEXT", { color: "teal", bg: "sand" })
  styles = saveTeacherAppearancePatch(styles, realTask.teacher_id, "TASK", realTask.id, "CARD_SURFACE", { bg: "rose", borderColor: "#ff0000" })
  styles = saveTeacherAppearancePatch(styles, realTask.teacher_id, "TASK", realTask.id, "CARD_OBJECT_TEXT", { color: "brick", bg: "lilac" })
  styles = saveTeacherAppearancePatch(styles, realTask.teacher_id, "TASK", realTask.id, "CARD_ROOM_TEXT", { color: "plum" })
  const biz = { ...mtStore.freshBiz("BASE"), bigDemo: true, styles }
  const entry = { key: "synthetic-allowed-big-task", taskId: realTask.id, teacherId: "lin", className: cls.name, subject: cls.subject, date: "2026-10-26", weekday: 1, periodId: "m3", room: "D105" }
  const appearance = { mode: "teacher", viewer: "u-lin", teacherId: realTeacher, teachingTaskIds: mtDerive.permittedTasks(biz, realTeacher).map(task => task.id), styles }
  return { task: realTask, teacher: realTeacher, entry, appearance, biz, base: resolveStyle(biz, realTeacher, realTask) }
}

test("authorized big-demo tasks render current-teacher title, surface and room styles rather than their synthetic owner's styles", () => {
  const scenario = bigDemoScenario()
  assert.equal(scenario.task.teacher_id, "TEACHER_BIG_DEMO")
  assert(scenario.appearance.teachingTaskIds.includes(scenario.task.id))
  assert.equal(personalAppearanceTask(scenario.appearance, scenario.entry), scenario.task)
  withTeacherState(scenario, () => {
    const title = render(h(StyledLessonTitle, scenario))
    assert(openingText(title, "object")?.includes("background-color:#e7eff8"))
    const card = render(h(ClassCard, { entry: scenario.entry, appearance: scenario.appearance }))
    const preview = render(h(TimetableCardPreview, { ...scenario, showTeacher: false }))
    assert.equal(outerStyle(card), outerStyle(preview))
    for (const html of [card, preview]) {
      assert(outerStyle(html).includes("background-color:#e8f3ec"))
      assert(outerStyle(html).includes("border-color:#123456") && outerStyle(html).includes("border-width:2px"))
      assert(openingText(html, "object")?.includes("background-color:#e7eff8"))
      assert(openingText(html, "room")?.includes("color:#1f6f74"))
      assert(openingText(html, "room").includes("background-color:#f8f0dc"))
      assert(!html.includes("background-color:#f8e9e6") && !html.includes("color:#6e3f6a"), "the synthetic owner's saved preferences must not leak into this teacher's view")
      assert(!html.includes("示例林老师"))
    }
  })
})

test("explicit allowed-task lists are authoritative and excluded tasks receive no supplemental styles", () => {
  const scenario = bigDemoScenario()
  withTeacherState(scenario, () => {
    for (const teachingTaskIds of [[], ["TASK_MATH_G1_P1"], undefined]) {
      const appearance = { ...scenario.appearance, teachingTaskIds }
      assert.equal(personalAppearanceTask(appearance, scenario.entry), null)
      const title = render(h(StyledLessonTitle, { entry: scenario.entry, appearance }))
      assert.equal(openingText(title, "object"), undefined)
      const card = render(h(ClassCard, { entry: scenario.entry, appearance }))
      assert.equal(outerStyle(card), "")
      assert(!openingText(card, "room").includes("style="))
      const preview = render(h(TimetableCardPreview, { entry: scenario.entry, appearance, base: resolvePreference(), showTeacher: false }))
      assert.equal(outerStyle(preview), "")
      assert.equal(openingText(preview, "object"), undefined)
      assert(!openingText(preview, "room").includes("style="))
    }
  })
  const owned = realTeacherScenario()
  assert.equal(personalAppearanceTask(owned.appearance, owned.entry), owned.task, "without a list, legacy owner matching remains compatible")
  assert.equal(personalAppearanceTask({ ...owned.appearance, teachingTaskIds: [] }, owned.entry), null, "an explicit empty list must not fall back to owner matching")
  assert.equal(personalAppearanceTask({ ...owned.appearance, teachingTaskIds: [owned.task.id] }, { ...owned.entry, kind: "activity" }), null)
})
