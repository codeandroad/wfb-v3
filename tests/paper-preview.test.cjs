const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const test = require("node:test")
const ts = require("typescript")

// Server-rendered structure and real component-event regressions. The hook slots
// and native dialog portal are stand-ins: this does not claim browser layout,
// focus trapping, React scheduling, native PDF controls or PDF network loading.
const root = path.resolve(__dirname, ".."), resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args)
}
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, file)
require.extensions[".css"] = () => {}

const React = require("react"), { renderToStaticMarkup: render } = require("react-dom/server")
let location = new URL("http://localhost/research"), pushes = []
const load = Module._load
Module._load = function (request, ...args) {
  if (request === "next/navigation") return {
    useSearchParams: () => new URLSearchParams(location.search), usePathname: () => location.pathname,
    useRouter: () => ({ push(href, options) { pushes.push({ href, options }); location = new URL(href, location) } }),
  }
  if (request === "next/link") return ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children)
  return load.call(this, request, ...args)
}
const contextModule = require("../lib/research/context.ts")
const store = require("../lib/research/store.ts")
const modalModule = require("../components/research/modal.tsx")
const { PaperReader } = require("../components/research/paper-reader.tsx")
const { SourcePaperReader } = require("../components/research/source-paper-reader.tsx")
const { PaperTextDialog } = require("../components/research/source-papers.tsx")
const { paperRecords, paperDocumentsSeed } = require("../lib/research/papers.ts")
const { applyResearchCommand } = require("../lib/research/commands.ts")
const { emptyDocument } = require("../lib/research/model.ts")
const { catalogSeed } = require("../lib/school/catalog-store.ts")
const assets = require("../lib/research/paper-assets.json")
Module._load = load

const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" && node.props ? [node, ...nodes(node.props.children)] : []
const text = node => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : node == null || typeof node === "boolean" ? "" : String(node)
const find = (tree, predicate, description) => { const node = nodes(tree).find(predicate); assert(node, `missing ${description}`); return node }
const button = (tree, label) => find(tree, node => typeof node.props.onClick === "function" && text(node) === label, label)
const select = (tree, side) => find(tree, node => node.type === "select" && node.props["aria-label"] === `${side}侧原文件`, `${side} file selector`)
const frames = tree => nodes(tree).filter(node => node.type === "iframe")
const visible = node => {
  if (Array.isArray(node)) return React.Children.map(node, visible)
  if (!node || typeof node !== "object" || !node.props) return node
  if (node.props.hidden || node.props["aria-hidden"] === true || node.props["aria-hidden"] === "true") return null
  return React.cloneElement(node, {}, visible(node.props.children))
}
const paper = paperRecords.find(p => p.subject === "9709" && p.questions.length && assets[p.files.qp] && assets[p.files.ms])
assert(paper, "fixture must contain an imported paired mathematics paper")
const paperDocument = () => structuredClone(paperDocumentsSeed.find(doc => doc.id === paper.id))
const setLocation = extra => { location = new URL(`/research?group=math&tab=courses&course=C101&view=papers&doc=${encodeURIComponent(paper.id)}&year=${paper.year}&${extra || ""}`, "http://localhost"); pushes = [] }
function assertContext() {
  assert.equal(location.pathname, "/research")
  for (const [key, value] of Object.entries({ group: "math", tab: "courses", course: "C101", view: "papers", doc: paper.id, year: paper.year })) assert.equal(location.searchParams.get(key), value, key)
  assert.deepEqual(pushes.at(-1)?.options, { scroll: false })
}

function withReader(run) {
  const saved = { context: contextModule.useResearchContext, getResearch: store.getResearch, modal: modalModule.Modal }
  const doc = paperDocument(), first = doc.items[0]
  // Distinct text makes opposite-mode visibility assertions independent of fixture prose.
  doc.items = [{ ...first, body: "QUESTION_BODY_MARKER", stem: "QUESTION_SHARED_STEM", scoring: "ANSWER_BODY_MARKER" }]
  const context = { state: structuredClone(store.getResearch()), actor: { staff: "u-lin", date: "2026-10-22", enabled: true }, catalog: structuredClone(catalogSeed) }
  context.state.documents = context.state.documents.map(item => item.id === doc.id ? doc : item)
  const calls = []
  context.command = command => {
    calls.push(command)
    context.state = applyResearchCommand(context.state, context.actor, command, context.catalog, () => true)
    return { ok: true }
  }
  contextModule.useResearchContext = () => context
  store.getResearch = () => context.state
  modalModule.Modal = ({ open, title, children, footer }) => open ? React.createElement("section", { role: "dialog", "aria-label": title }, children, footer) : null
  setLocation()
  function instance() {
    const slots = [], callbacks = { closed: 0, saved: 0, created: [] }
    const draw = () => {
      const previous = React.useState
      let cursor = 0
      React.useState = initial => {
        const i = cursor++
        if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial
        return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value }]
      }
      try { return SourcePaperReader({ document: doc, onClose: () => callbacks.closed++, onSave: () => callbacks.saved++, onCreated: id => callbacks.created.push(id) }) }
      finally { React.useState = previous }
    }
    return { draw, callbacks, click: label => button(draw(), label).props.onClick(), html: () => render(visible(draw())) }
  }
  try { return run({ doc, context, calls, instance }) }
  finally { contextModule.useResearchContext = saved.context; store.getResearch = saved.getResearch; modalModule.Modal = saved.modal }
}

test("structured preview retains its existing actions and displays each question before its scoring answer", () => withReader(({ instance }) => {
  const reader = instance(), tree = reader.draw(), html = reader.html()
  for (const label of ["对照", "仅试卷", "仅答案", "选用 / 保存练习", "⇩ 导出 JSON", "原文件", "← 返回真题库"]) button(tree, label)
  assert.match(html, /QUESTION_SHARED_STEM/)
  assert.match(html, /QUESTION_BODY_MARKER/)
  assert.match(html, /ANSWER_BODY_MARKER/)
  assert(html.indexOf("QUESTION_BODY_MARKER") < html.indexOf("ANSWER_BODY_MARKER"))
  reader.click("← 返回真题库")
  assert.equal(reader.callbacks.closed, 1)
}))

test("real question/answer mode actions hide the opposite content and restore it in comparison mode", () => withReader(({ instance }) => {
  const reader = instance()
  reader.click("仅试卷")
  assert.match(reader.html(), /QUESTION_BODY_MARKER/)
  assert.doesNotMatch(reader.html(), /ANSWER_BODY_MARKER/)
  reader.click("仅答案")
  assert.match(reader.html(), /ANSWER_BODY_MARKER/)
  assert.doesNotMatch(reader.html(), /QUESTION_BODY_MARKER|QUESTION_SHARED_STEM/)
  reader.click("对照")
  assert.match(reader.html(), /QUESTION_BODY_MARKER/)
  assert.match(reader.html(), /ANSWER_BODY_MARKER/)
}))

test("original-file panes select actual QP/MS assets without losing course, group, paper or pair context", () => {
  setLocation("pair=1")
  const doc = paperDocument(), draw = () => PaperReader({ document: doc, onStructured: () => {} })
  let tree = draw()
  assert.equal(select(tree, "左").props.value, "qp")
  assert.equal(select(tree, "右").props.value, "ms")
  assert.deepEqual(frames(tree).map(frame => frame.props.src), [assets[paper.files.qp].url, assets[paper.files.ms].url])
  select(tree, "左").props.onChange({ target: { value: "ms" } })
  assertContext()
  assert.equal(location.searchParams.get("pair"), "1")
  select(draw(), "右").props.onChange({ target: { value: "qp" } })
  assertContext()
  tree = draw()
  assert.deepEqual(frames(tree).map(frame => frame.props.src), [assets[paper.files.ms].url, assets[paper.files.qp].url])
  for (const frame of frames(tree)) assert(frame.props.title, "embedded originals need accessible pane titles")
  const html = render(tree)
  assert.match(html, /左侧原文件/)
  assert.match(html, /右侧原文件/)
  const links = nodes(tree).filter(node => node.type === "a" && node.props.target === "_blank")
  assert.equal(links.length, 2)
  for (const link of links) assert.match(link.props.rel, /noopener/)
})

test("single/pair actions retain both file choices and expose one return action", () => {
  setLocation("pair=1&left=ms&right=qp")
  let returned = 0
  const draw = () => PaperReader({ document: paperDocument(), onStructured: () => returned++ })
  button(draw(), "单栏阅读").props.onClick()
  assertContext()
  assert.equal(location.searchParams.get("pair"), "0")
  assert.equal(frames(draw()).length, 1)
  assert.equal(frames(draw())[0].props.src, assets[paper.files.ms].url)
  assert.equal(nodes(draw()).filter(node => node.props["aria-label"] === "右侧原文件").length, 0)
  button(draw(), "双栏对照").props.onClick()
  assertContext()
  assert.equal(location.searchParams.get("pair"), "1")
  assert.deepEqual(frames(draw()).map(frame => frame.props.src), [assets[paper.files.ms].url, assets[paper.files.qp].url])
  const returns = nodes(draw()).filter(node => typeof node.props.onClick === "function" && text(node) === "返回题目对照")
  assert.equal(returns.length, 1)
  returns[0].props.onClick()
  assert.equal(returned, 1)
})

test("personal copies and retained source references still resolve the registered original assets", () => {
  setLocation()
  const copied = { ...paperDocument(), id: "personal-paper-copy", owner: "u-lin", paperSource: { id: paper.id, version: 1 } }
  assert.deepEqual(frames(PaperReader({ document: copied, onStructured: () => {} })).map(frame => frame.props.src), [assets[paper.files.qp].url, assets[paper.files.ms].url])
  const referenced = { ...copied, paperSource: undefined, items: [{ ...copied.items[0], references: [{ documentId: paper.id }] }] }
  assert.deepEqual(frames(PaperReader({ document: referenced, onStructured: () => {} })).map(frame => frame.props.src), [assets[paper.files.qp].url, assets[paper.files.ms].url])
})

test("missing originals keep a working return and non-PDF originals offer downloads instead of empty PDF panes", () => {
  setLocation()
  let returned = 0
  const empty = emptyDocument("no-imported-original", "资源", "待导入试卷", "u-lin", "u-lin", "C101", null)
  const emptyTree = PaperReader({ document: empty, onStructured: () => returned++ })
  assert.equal(frames(emptyTree).length, 0)
  assert.match(render(emptyTree), /尚未导入原文件/)
  button(emptyTree, "返回题目对照").props.onClick()
  assert.equal(returned, 1)
  const source = paperRecords.find(record => Object.values(record.files).some(file => assets[file] && assets[file].kind !== "pdf"))
  assert(source, "fixture must contain an imported non-PDF original")
  const [type, file] = Object.entries(source.files).find(([, file]) => assets[file] && assets[file].kind !== "pdf")
  setLocation(`left=${type}&pair=0`)
  const doc = structuredClone(paperDocumentsSeed.find(doc => doc.id === source.id))
  const tree = PaperReader({ document: doc, onStructured: () => {} })
  assert.equal(frames(tree).length, 0)
  const download = find(tree, node => node.type === "a" && node.props.download !== undefined, "download original source")
  assert.equal(download.props.href, assets[file].url)
  assert.match(render(tree), /下载/)
})

test("saving a personal correction then visiting originals preserves markup, display mode and the shared paper", () => withReader(({ doc, context, calls, instance }) => {
  const before = structuredClone(context.state.documents), reader = instance(), question = doc.items[0]
  context.state.forms["u-zhou|paper-markup"] = { questions: { [question.id]: { stem: "OTHER_TEACHER_TEXT" } } }
  reader.click("✎ 修正题干")
  const editor = () => {
    const node = find(reader.draw(), node => node.type === PaperTextDialog, "real correction dialog")
    return PaperTextDialog(node.props)
  }
  find(editor(), node => node.props.label === "题干文本", "correction input").props.onChange("MY_PERSONAL_CORRECTION")
  button(editor().props.footer, "保存").props.onClick()
  assert.equal(context.state.forms["u-lin|paper-markup"].questions[question.id].stem, "MY_PERSONAL_CORRECTION")
  assert.equal(context.state.forms["u-zhou|paper-markup"].questions[question.id].stem, "OTHER_TEACHER_TEXT")
  assert.match(reader.html(), /MY_PERSONAL_CORRECTION/)
  reader.click("仅试卷")
  reader.click("原文件")
  const original = find(reader.draw(), node => node.type === PaperReader, "real original-file reader")
  const originalTree = PaperReader(original.props)
  assert.equal(nodes(originalTree).filter(node => typeof node.props.onClick === "function" && text(node) === "返回题目对照").length, 1)
  assert.equal((reader.html().match(/>返回题目对照</g) || []).length, 1, "the outer preview must not add a duplicate return above the reader toolbar")
  button(originalTree, "返回题目对照").props.onClick()
  assert.equal(nodes(reader.draw()).filter(node => node.type === PaperReader).length, 0)
  assert.match(reader.html(), /MY_PERSONAL_CORRECTION/)
  assert.doesNotMatch(reader.html(), /ANSWER_BODY_MARKER/)
  assert.equal(reader.callbacks.closed, 0)
  assert.deepEqual(context.state.documents, before)
  assert(calls.every(command => command.type === "form-draft"), "personal corrections must not revise shared paper data")
  const reopened = instance()
  assert.match(reopened.html(), /MY_PERSONAL_CORRECTION/)
}))
