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
const { useStyleDrafts } = require("../components/mt/use-style-drafts.ts")
const { StyleColorInput } = require("../components/mt/style-color-input.tsx")
const { AppearanceEditorControls } = require("../components/timetable/display-settings.tsx")
const { appearanceEditorPref, appearanceEditorEffective, saveAppearancePatch } = require("../lib/timetable/surface.ts")
const { teacherEditorPref, teacherEditorEffective, saveTeacherAppearancePatch } = require("../lib/timetable/teacher-appearance.ts")
const { taskById } = require("../lib/mt/model.ts")

function hookHarness(initialKey, initialScope) {
  const slots = []
  let key = initialKey
  let scope = initialScope
  let result
  const render = (nextKey = key, nextScope = scope) => {
    key = nextKey
    scope = nextScope
    const original = React.useState
    let rerender
    let passes = 0
    try {
      do {
        rerender = false
        let cursor = 0
        React.useState = initial => {
          const index = cursor++
          if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
          return [slots[index], next => {
            slots[index] = typeof next === "function" ? next(slots[index]) : next
            rerender = true
          }]
        }
        result = useStyleDrafts(key, scope)
        assert.ok(++passes < 10, "render-time context reset must settle")
      } while (rerender)
    } finally {
      React.useState = original
    }
    return result
  }
  return { render }
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== "object" || !node.props) return []
  return [node, ...elements(node.props.children)]
}

function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join("")
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (typeof node !== "object") return String(node)
  return textContent(node.props?.children)
}

function element(tree, predicate, description) {
  const found = elements(tree).find(predicate)
  assert.ok(found, `missing ${description}`)
  return found
}

const task = taskById("TASK_MATH_G1_P1")
const lesson = { key: "draft-test", taskId: task.id, teacherId: "lin", className: "高一1班 • 数学", subject: "数学", room: "D101", date: "2026-10-26", weekday: 1, periodId: "m3" }

// Connect the real hook/controls/input events to the real persistence reducers.
// The adapter models the documented successful-save boundary; parent modal/provider
// integration and actual browser persistence remain separate integration checks.
function editorHarness(mode, part = "CARD_OBJECT_TEXT", initial = {}) {
  const hook = hookHarness(`${mode}|${part}|A`)
  let stored = {}
  let failSave = false
  const writes = []
  const appearance = styles => ({ mode: "admin", viewer: "u-lin", styles })
  const apply = (styles, patch) => mode === "teacher"
    ? saveTeacherAppearancePatch(styles, "TEACHER_LYNN", "TASK", task.id, part, patch)
    : saveAppearancePatch(styles, "u-lin", "admin", part, lesson.className, patch)
  const pref = styles => mode === "teacher"
    ? teacherEditorPref(styles, "TEACHER_LYNN", "TASK", task.id, part)
    : appearanceEditorPref(appearance(styles), part, lesson.className)
  const effective = styles => mode === "teacher"
    ? teacherEditorEffective(styles, "TEACHER_LYNN", task, part)
    : appearanceEditorEffective(appearance(styles), part, lesson.className, lesson)
  stored = apply(stored, initial)
  const save = patch => {
    if (failSave) return false
    stored = JSON.parse(JSON.stringify(apply(stored, patch)))
    writes.push(patch)
    hook.render().saved(patch)
    return true
  }
  const render = () => {
    const drafts = hook.render()
    const previewStyles = Object.keys(drafts.patch).length ? apply(stored, drafts.patch) : stored
    const controls = AppearanceEditorControls({ part, own: pref(stored), effective: effective(previewStyles), controlKey: `${mode}|${part}|A`, drafts: drafts.values, onDraftChange: drafts.change, onSave: save })
    return { drafts, controls, preview: pref(previewStyles), stored: pref(stored), storedJSON: JSON.stringify(stored) }
  }
  const color = (label, tree = render().controls) => {
    const component = element(tree, node => node.type === StyleColorInput && node.props.label === label, `${label} component`)
    return StyleColorInput(component.props)
  }
  const rawInput = (label, tree) => element(color(label, tree), node => node.type === "input" && node.props["aria-label"] === `${label}HEX`, `${label} HEX input`)
  const saveColor = label => element(color(label), node => node.type === "button", `${label} save button`).props.onClick()
  const control = label => element(render().controls, node => node.props.onClick && textContent(node.props.children) === label, label).props.onClick()
  return { render, hook, save, color, rawInput, saveColor, control, writes, fail: value => { failSave = value } }
}

for (const mode of ["admin", "teacher"]) {
  test(`${mode}: valid color and background input events save immediately without overwriting one another`, () => {
    const editor = editorHarness(mode, "CARD_OBJECT_TEXT", { color: "#111111", bg: "#EEEEEE" })
    const before = editor.render()
    // Both callbacks come from the same render, like two queued input events.
    editor.rawInput("文字颜色", before.controls).props.onChange({ target: { value: "#aa1122" } })
    editor.rawInput("文字底色", before.controls).props.onChange({ target: { value: "#bbccdd" } })
    const state = editor.render()
    assert.deepEqual(editor.writes, [{ color: "#AA1122" }, { bg: "#BBCCDD" }])
    assert.equal(state.stored.color, "#AA1122")
    assert.equal(state.stored.bg, "#BBCCDD")
    assert.deepEqual(state.drafts.values, {})
    assert.equal(state.drafts.pending, false)
    for (const [label, value] of [["文字颜色", "#AA1122"], ["文字底色", "#BBCCDD"]]) {
      assert.equal(editor.rawInput(label).props.value, value)
      const oldInput = element(before.controls, node => node.type === StyleColorInput && node.props.label === label, label)
      const newInput = element(state.controls, node => node.type === StyleColorInput && node.props.label === label, label)
      assert.equal(newInput.key, oldInput.key, "saving must not remount the native color input")
      const button = element(editor.color(label), node => node.type === "button", "automatic-save button")
      assert.equal(button.props.disabled, true)
      assert.equal(textContent(button), "自动保存")
    }
  })

  test(`${mode}: typing six-digit HEX keeps a three-digit prefix editable and short HEX saves on blur`, () => {
    const editor = editorHarness(mode, "CARD_OBJECT_TEXT", { color: "#111111" })
    for (const raw of ["#", "#1", "#12", "#123", "#1234", "#12345"]) {
      editor.rawInput("文字颜色").props.onChange({ target: { value: raw } })
      assert.equal(editor.rawInput("文字颜色").props.value, raw)
      assert.equal(editor.render().stored.color, "#111111")
      assert.equal(editor.writes.length, 0)
    }
    editor.rawInput("文字颜色").props.onChange({ target: { value: "#123456" } })
    assert.equal(editor.render().stored.color, "#123456")
    assert.deepEqual(editor.render().drafts.values, {})
    editor.rawInput("文字颜色").props.onChange({ target: { value: "#abc" } })
    assert.equal(editor.rawInput("文字颜色").props.value, "#abc")
    assert.equal(editor.render().preview.color, "#AABBCC")
    assert.equal(editor.render().stored.color, "#123456")
    editor.rawInput("文字颜色").props.onBlur()
    assert.equal(editor.render().stored.color, "#AABBCC")
    assert.deepEqual(editor.render().drafts.values, {})
  })

  for (const savedField of ["color", "bg"]) {
    test(`${mode}: retrying ${savedField} clears only its failed candidate and never commits its sibling`, () => {
      const editor = editorHarness(mode, "CARD_OBJECT_TEXT", { color: "#111111", bg: "#EEEEEE" })
      const before = editor.render()
      editor.fail(true)
      editor.rawInput("文字颜色", before.controls).props.onChange({ target: { value: "#aa1122" } })
      editor.rawInput("文字底色", before.controls).props.onChange({ target: { value: "#bbccdd" } })
      assert.deepEqual(editor.render().drafts.patch, { color: "#AA1122", bg: "#BBCCDD" })
      assert.equal(editor.render().storedJSON, before.storedJSON)
      const labels = { color: "文字颜色", bg: "文字底色" }
      const candidates = { color: "#AA1122", bg: "#BBCCDD" }
      const raw = { color: "#aa1122", bg: "#bbccdd" }
      const sibling = savedField === "color" ? "bg" : "color"
      editor.fail(false)
      editor.saveColor(labels[savedField])
      const state = editor.render()
      assert.deepEqual(editor.writes, [{ [savedField]: candidates[savedField] }])
      assert.deepEqual(state.drafts.values, { [sibling]: raw[sibling] })
      assert.equal(state.stored[savedField], candidates[savedField])
      assert.equal(state.stored[sibling], sibling === "color" ? "#111111" : "#EEEEEE")
      assert.equal(state.preview[sibling], candidates[sibling])
      assert.equal(editor.rawInput(labels[savedField]).props.value, candidates[savedField])
      assert.equal(editor.rawInput(labels[sibling]).props.value, raw[sibling])
      editor.saveColor(labels[sibling])
      assert.deepEqual(editor.render().drafts.values, {})
    })
  }

  test(`${mode}: invalid input withdraws only its own failed preview and keeps its raw error text`, () => {
    const editor = editorHarness(mode, "CARD_OBJECT_TEXT", { color: "#111111", bg: "#EEEEEE" })
    const before = editor.render().storedJSON
    editor.fail(true)
    editor.rawInput("文字颜色").props.onChange({ target: { value: "#aa1122" } })
    editor.rawInput("文字底色").props.onChange({ target: { value: "#bbccdd" } })
    editor.rawInput("文字颜色").props.onChange({ target: { value: "#oops" } })
    const state = editor.render()
    assert.deepEqual(state.drafts.patch, { bg: "#BBCCDD" })
    assert.equal(state.preview.color, "#111111")
    assert.equal(state.preview.bg, "#BBCCDD")
    assert.equal(state.storedJSON, before)
    assert.equal(editor.rawInput("文字颜色").props.value, "#oops")
    assert.equal(editor.rawInput("文字颜色").props["aria-invalid"], true)
    const button = element(editor.color("文字颜色"), node => node.type === "button", "invalid-color button")
    assert.equal(button.props.disabled, true)
    editor.fail(false)
    button.props.onClick()
    assert.deepEqual(editor.writes, [])
    assert.equal(editor.render().drafts.values.bg, "#bbccdd")
  })

  test(`${mode}: inherit and same-value saves clear raw inputs without clearing sibling candidates`, () => {
    const editor = editorHarness(mode)
    editor.fail(true)
    editor.rawInput("文字颜色").props.onChange({ target: { value: "#aa1122" } })
    editor.rawInput("文字底色").props.onChange({ target: { value: "#bbccdd" } })
    editor.fail(false)
    editor.control("继承文字")
    assert.equal(editor.rawInput("文字颜色").props.value, "")
    assert.deepEqual(editor.render().drafts.values, { bg: "#bbccdd" })
    editor.control("继承背景")
    assert.equal(editor.rawInput("文字底色").props.value, "")
    assert.equal(editor.render().drafts.pending, false)
    editor.save({ color: "#AA1122" })
    editor.rawInput("文字颜色").props.onChange({ target: { value: "#aa1122" } })
    assert.equal(editor.rawInput("文字颜色").props.value, "#AA1122")
    assert.deepEqual(editor.render().drafts.values, {})
    editor.rawInput("文字颜色").props.onChange({ target: { value: "#bad-value" } })
    editor.fail(true)
    editor.rawInput("文字底色").props.onChange({ target: { value: "#aabbcc" } })
    editor.fail(false)
    editor.save(null)
    assert.deepEqual(editor.render().drafts.values, {})
    assert.equal(editor.rawInput("文字颜色").props.value, "")
    assert.equal(editor.rawInput("文字底色").props.value, "")
  })

  test(`${mode}: surface background and native border input save independently with stable input keys`, () => {
    const editor = editorHarness(mode, "CARD_SURFACE", { bg: "#EEEEEE", borderColor: "#333333" })
    const before = editor.render()
    editor.rawInput("课卡背景", before.controls).props.onChange({ target: { value: "#aabbcc" } })
    const picker = element(editor.color("边框颜色", before.controls), node => node.type === "input" && node.props.type === "color", "border native input")
    picker.props.onChange({ target: { value: "#654321" } })
    assert.equal(editor.render().stored.bg, "#AABBCC")
    assert.equal(editor.render().stored.borderColor, "#654321")
    assert.deepEqual(editor.render().drafts.values, {})
    for (const label of ["课卡背景", "边框颜色"]) {
      const input = tree => element(tree, node => node.type === StyleColorInput && node.props.label === label, label)
      assert.equal(input(before.controls).key, input(editor.render().controls).key)
    }
    editor.fail(true)
    editor.rawInput("课卡背景").props.onChange({ target: { value: "#ddeeff" } })
    editor.rawInput("边框颜色").props.onChange({ target: { value: "invalid" } })
    assert.deepEqual(editor.render().drafts.patch, { bg: "#DDEEFF" })
    assert.equal(editor.render().stored.bg, "#AABBCC")
    editor.fail(false)
    editor.control("继承边框")
    assert.deepEqual(editor.render().drafts.values, { bg: "#ddeeff" })
    assert.equal(editor.rawInput("边框颜色").props.value, "")
  })

  test(`${mode}: failed immediate saves and failed retry leave persistence intact; Enter retries one field`, () => {
    const editor = editorHarness(mode, "CARD_OBJECT_TEXT", { color: "#111111", bg: "#EEEEEE" })
    const before = editor.render().storedJSON
    editor.fail(true)
    editor.rawInput("文字颜色").props.onChange({ target: { value: "#aa1122" } })
    editor.rawInput("文字底色").props.onChange({ target: { value: "#bbccdd" } })
    const retry = element(editor.color("文字颜色"), node => node.type === "button", "retry button")
    assert.equal(textContent(retry), "重试保存")
    assert.equal(retry.props.disabled, false)
    retry.props.onClick()
    assert.equal(editor.control("继承背景"), false)
    assert.deepEqual(editor.render().drafts.values, { color: "#aa1122", bg: "#bbccdd" })
    assert.equal(editor.render().storedJSON, before)
    assert.deepEqual(editor.writes, [])
    editor.fail(false)
    let prevented = false
    editor.rawInput("文字颜色").props.onKeyDown({ key: "Enter", preventDefault: () => { prevented = true } })
    assert.equal(prevented, true)
    assert.deepEqual(editor.render().drafts.values, { bg: "#bbccdd" })
    assert.equal(editor.render().stored.color, "#AA1122")
    assert.equal(editor.render().stored.bg, "#EEEEEE")
  })
}

test("actual draft hook preserves sibling part drafts only within the same object scope", () => {
  const hook = hookHarness("A|object", "viewer|A")
  hook.render().change("color", "#aabbcc")
  hook.render().change("bg", "invalid")
  assert.deepEqual(hook.render("A|room").values, {})
  assert.equal(hook.render().pendingElsewhere, true)
  hook.render().change("color", "#ddeeff")
  assert.deepEqual(hook.render("A|object").values, { color: "#aabbcc", bg: "invalid" })
  hook.render().saved({ color: "#AABBCC" })
  assert.deepEqual(hook.render().values, { bg: "invalid" })
  assert.deepEqual(hook.render("A|room").values, { color: "#ddeeff" })
  hook.render().saved(null)
  assert.equal(hook.render().pendingElsewhere, true)
  hook.render().reset()
  assert.deepEqual(hook.render("A|object").values, {})
  assert.equal(hook.render().pendingElsewhere, false)
})

test("actual draft hook does not revive object or viewer drafts after A to B to A", () => {
  const hook = hookHarness("A|object", "viewer1|A")
  hook.render().change("color", "#aabbcc")
  hook.render("A|room").change("bg", "#ddeeff")
  assert.deepEqual(hook.render("B|object", "viewer1|B").values, {})
  hook.render().change("borderColor", "#123")
  assert.deepEqual(hook.render("A|object", "viewer1|A").values, {})
  assert.deepEqual(hook.render("A|room").values, {})
  hook.render().change("bg", "invalid")
  assert.deepEqual(hook.render("A|room", "viewer2|A").values, {})
  assert.deepEqual(hook.render("A|room", "viewer1|A").values, {})
})

test("omitting scope keeps existing key-change isolation and explicit reset clears invalid raw values", () => {
  const hook = hookHarness("A")
  hook.render().change("color", "#aabbcc")
  hook.render().change("bg", "bad")
  hook.render().change("borderColor", "#ddeeff")
  assert.deepEqual(hook.render().patch, { color: "#AABBCC", borderColor: "#DDEEFF" })
  hook.render().reset()
  assert.deepEqual(hook.render().values, {})
  hook.render().change("bg", "bad")
  assert.deepEqual(hook.render("B").values, {})
  assert.deepEqual(hook.render("A").values, {})
})
