const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const test = require("node:test")
const ts = require("typescript")

// Component-event and hook-state regression tests. No DOM, browser, native color dialog,
// layout, hydration, or React scheduler behavior is claimed by this harness.
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

const React = require("react")
const mtStore = require("../lib/mt/store.tsx")
const mtDerive = require("../lib/mt/derive.ts")
const demoStore = require("../lib/demo/store.tsx")
const ttStore = require("../lib/timetable/store.tsx")
const { taskById, classOf } = require("../lib/mt/model.ts")
const { TimetableDisplaySettings, TeacherCardStyleEditor, AppearanceEditorControls } = require("../components/timetable/display-settings.tsx")
const { StyleColorInput } = require("../components/mt/style-color-input.tsx")
const { appearanceEditorPref } = require("../lib/timetable/surface.ts")
const { teacherEditorPref } = require("../lib/timetable/teacher-appearance.ts")
const { PERSONAS } = require("../lib/demo/nav.ts")

const task = taskById("TASK_MATH_G1_P1")
const lesson = { key: "lesson", kind: "class", taskId: task.id, className: classOf(task).name, subject: classOf(task).subject, teacherId: "lin", room: "D101", date: "2026-10-26", weekday: 1, periodId: "m3" }
// A same-name activity catches accidental sharing of teaching-object preference keys.
const activity = { ...lesson, key: "activity", kind: "activity", taskId: undefined, room: "教研室" }
const entries = [lesson, activity, { ...activity, key: "other-activity", className: "另一场活动" }]
const objectValue = (mode, kind) => JSON.stringify([kind === "activity" ? "activity" : "teaching", kind === "activity" || mode === "admin" ? lesson.className : task.id])
const clone = value => JSON.parse(JSON.stringify(value))

function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== "object" || !node.props) return []
  return [node, ...nodes(node.props.children)]
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join("")
  if (node === null || node === undefined || typeof node === "boolean") return ""
  return typeof node === "object" ? text(node.props?.children) : String(node)
}
function find(tree, predicate, label) {
  const node = nodes(tree).find(predicate)
  assert.ok(node, `missing ${label}`)
  return node
}

// Invoke the real parent component and its actual controls/input event callbacks.
// Only React's useState slots and provider/storage boundary are replaced. The command
// updater uses the real persistence reducers; JSON round-trips model reopening storage.
// This does not simulate DOM focus, native picker UI, portals, React scheduling or browser storage.
function withEditor(mode, run) {
  const previous = { useMt: mtStore.useMt, useTeacherId: mtDerive.useTeacherId, useDemo: demoStore.useDemo, useTimetable: ttStore.useTimetable }
  const state = { biz: { ...mtStore.freshBiz("BASE"), styles: {} }, fail: false, writes: 0, attempts: 0, persona: "lin", teacherId: "TEACHER_LYNN" }
  mtStore.useMt = () => ({ biz: state.biz, ready: true, loadError: false, command: (_label, update) => {
    state.attempts++
    if (state.fail) return { ok: false, error: "模拟存储写入失败" }
    state.biz = clone(update(state.biz))
    state.writes++
    return { ok: true }
  } })
  mtDerive.useTeacherId = () => state.teacherId
  demoStore.useDemo = () => ({ persona: state.persona })
  ttStore.useTimetable = () => ({ weekStart: "2026-10-26" })
  function instance() {
    const slots = []
    const render = () => {
      const original = React.useState
      let tree, pending, passes = 0
      try {
        do {
          pending = false
          let cursor = 0
          React.useState = initial => {
            const i = cursor++
            if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial
            return [slots[i], update => { slots[i] = typeof update === "function" ? update(slots[i]) : update; pending = true }]
          }
          tree = mode === "admin" ? TimetableDisplaySettings({ mode, entries, onClose: () => {} }) : TeacherCardStyleEditor({ teacherId: state.teacherId, entries })
          assert.ok(++passes < 10, "render-time scope reset must settle")
        } while (pending)
      } finally { React.useState = original }
      return tree
    }
    const controlsNode = () => find(render(), node => node.type === AppearanceEditorControls, "real parent controls")
    const controlTree = () => { const node = controlsNode(); return AppearanceEditorControls(node.props) }
    const colorNode = label => find(controlTree(), node => node.type === StyleColorInput && node.props.label === label, label)
    const colorTree = label => StyleColorInput(colorNode(label).props)
    const input = (label, native = false) => find(colorTree(label), node => node.type === "input" && node.props["aria-label"] === `${label}${native ? "取色" : "HEX"}`, `${label} input`)
    const write = (label, value, native = false) => input(label, native).props.onChange({ target: { value } })
    const select = value => find(render(), node => node.type === "select" && node.props["aria-label"] === (mode === "admin" ? "细分样式对象" : "教师样式对象"), "object selector").props.onChange({ target: { value } })
    const click = label => find(render(), node => typeof node.props.onClick === "function" && text(node.props.children) === label, label).props.onClick()
    const retry = label => find(colorTree(label), node => node.type === "button", "retry button").props.onClick()
    return { render, controlsNode, colorNode, input, write, select, click, retry }
  }
  const pref = (kind, part, level = "TASK", id = task.id) => mode === "teacher" && kind !== "activity"
    ? teacherEditorPref(state.biz.styles, state.teacherId, level, id, part)
    : appearanceEditorPref({ styles: state.biz.styles, mode, viewer: PERSONAS[state.persona].staffId }, kind === "activity" ? part.replace("CARD_", "ACTIVITY_") : part, lesson.className)
  try { return run({ state, instance, pref }) }
  finally { mtStore.useMt = previous.useMt; mtDerive.useTeacherId = previous.useTeacherId; demoStore.useDemo = previous.useDemo; ttStore.useTimetable = previous.useTimetable }
}

const fields = [
  { tab: "对象名称", part: "CARD_OBJECT_TEXT", values: [["文字颜色", "#123456", "color"], ["文字底色", "#E1E2E3", "bg"]] },
  { tab: "教师姓名", part: "CARD_TEACHER_TEXT", values: [["文字颜色", "#234567", "color"], ["文字底色", "#D1D2D3", "bg"]] },
  { tab: "场所", part: "CARD_ROOM_TEXT", values: [["文字颜色", "#345678", "color"], ["文字底色", "#C1C2C3", "bg"]] },
  { tab: "课卡外观", part: "CARD_SURFACE", values: [["课卡背景", "#B1B2B3", "bg"], ["边框颜色", "#456789", "borderColor"]] },
]

for (const mode of ["admin", "teacher"]) for (const kind of ["teaching", "activity"]) {
  test(`${mode} ${kind}: real parent preserves every text/background/surface setting through part switches and reopen`, () => withEditor(mode, ({ state, instance, pref }) => {
    let editor = instance()
    editor.select(objectValue(mode, kind))
    for (const field of fields) {
      editor.click(field.tab)
      for (const [index, [label, value, attribute]] of field.values.entries()) {
        const key = editor.colorNode(label).key
        const before = state.writes
        editor.write(label, value.toLowerCase(), index === 1)
        assert.equal(state.writes, before + 1, "complete HEX/native input must persist without an extra click")
        assert.equal(pref(kind, field.part)[attribute], value)
        assert.equal(editor.input(label).props.value, value)
        assert.equal(editor.colorNode(label).key, key, "successful persistence must not remount the color picker")
      }
    }
    assert.equal(state.writes, 8)
    const saved = clone(state.biz.styles)
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) { state.biz = clone(state.biz); editor = instance(); editor.select(objectValue(mode, kind)) }
      for (const field of [...fields].reverse()) {
        editor.click(field.tab)
        for (const [label, value, attribute] of field.values) {
          assert.equal(editor.input(label).props.value, value, `${field.tab}/${label} after ${pass ? "reopen" : "part switch"}`)
          assert.equal(pref(kind, field.part)[attribute], value)
        }
      }
      assert.deepEqual(state.biz.styles, saved, "switching/reopening saved parts must not alter persistence")
    }
    // Same display name must not link an activity to a teaching object.
    const other = kind === "activity" ? "teaching" : "activity"
    for (const field of fields) for (const [, , attribute] of field.values) assert.equal(pref(other, field.part)[attribute], undefined)
  }))

  test(`${mode} ${kind}: real part navigation commits short HEX and retains failed/invalid inputs only on their original part`, () => withEditor(mode, ({ state, instance, pref }) => {
    const editor = instance()
    editor.select(objectValue(mode, kind))
    editor.click("对象名称")
    editor.write("文字颜色", "#abc")
    assert.equal(state.writes, 0)
    assert.equal(editor.input("文字颜色").props.value, "#abc")
    editor.click("教师姓名")
    assert.equal(pref(kind, "CARD_OBJECT_TEXT").color, "#AABBCC", "part click must commit valid short HEX even without a blur event")
    editor.click("对象名称")
    state.fail = true
    editor.write("文字颜色", "#123456")
    editor.write("文字底色", "#invalid")
    const before = clone(state.biz.styles)
    editor.click("场所")
    assert(text(editor.render()).includes("其他部位有未保存的颜色输入"))
    state.fail = false
    editor.write("文字颜色", "#456789")
    editor.click("对象名称")
    assert.equal(editor.input("文字颜色").props.value, "#123456")
    assert.equal(editor.input("文字底色").props.value, "#invalid")
    assert.equal(editor.input("文字底色").props["aria-invalid"], true)
    assert.equal(pref(kind, "CARD_OBJECT_TEXT").color, "#AABBCC")
    assert.equal(pref(kind, "CARD_OBJECT_TEXT").bg, undefined)
    assert.equal(pref(kind, "CARD_ROOM_TEXT").color, "#456789")
    assert.notDeepEqual(state.biz.styles, before, "unrelated successful room save should persist")
    editor.retry("文字颜色")
    assert.equal(pref(kind, "CARD_OBJECT_TEXT").color, "#123456")
    assert.equal(editor.input("文字底色").props.value, "#invalid", "retry clears only the saved field")
    editor.click("恢复此文字部位默认")
    assert.equal(editor.input("文字底色").props.value, "")
    assert.equal(pref(kind, "CARD_ROOM_TEXT").color, "#456789")
  }))
}

for (const mode of ["admin", "teacher"]) {
  test(`${mode}: real object and viewer changes discard raw candidates without reviving A after B`, () => withEditor(mode, ({ state, instance, pref }) => {
    const editor = instance()
    const a = objectValue(mode, "activity"), b = JSON.stringify(["activity", "另一场活动"])
    editor.select(a)
    editor.click("对象名称")
    editor.write("文字颜色", "#123456")
    editor.write("文字底色", "#invalid")
    editor.select(b)
    assert.equal(editor.input("文字底色").props.value, "")
    editor.write("文字底色", "#bad-value")
    editor.select(a)
    assert.equal(editor.input("文字颜色").props.value, "#123456")
    assert.equal(editor.input("文字底色").props.value, "")
    editor.write("文字底色", "#unfinished")
    state.persona = "zhou"
    state.teacherId = null
    assert.equal(editor.input("文字颜色").props.value, "")
    assert.equal(editor.input("文字底色").props.value, "")
    editor.write("文字颜色", "#234567")
    state.persona = "lin"
    state.teacherId = "TEACHER_LYNN"
    assert.equal(editor.input("文字颜色").props.value, "#123456")
    assert.equal(editor.input("文字底色").props.value, "")
    assert.equal(pref("activity", "CARD_OBJECT_TEXT").color, "#123456")
  }))
}
