const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const test = require("node:test")
const ts = require("typescript")

const root = path.resolve(__dirname, ".."), originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args)
}
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, file)
require.extensions[".css"] = () => {}

const React = require("react"), { renderToStaticMarkup: render } = require("react-dom/server")
let location = new URL("http://localhost/research"), pushes = []
const originalLoad = Module._load
Module._load = function (request, ...args) {
  if (request === "next/navigation") return {
    useSearchParams: () => new URLSearchParams(location.search),
    usePathname: () => location.pathname,
    useRouter: () => ({ push(href, options) { pushes.push({ href, options }); location = new URL(href, location) } }),
  }
  if (request === "next/link") return ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children)
  return originalLoad.call(this, request, ...args)
}
const navigation = require("../lib/research/navigation.ts")
const contextModule = require("../lib/research/context.ts")
const researchStore = require("../lib/research/store.ts")
const dutyStore = require("../lib/school/duty-store.ts")
const { catalogSeed } = require("../lib/school/catalog-store.ts")
const courseModule = require("../components/research/course-workspace.tsx")
const libraryModule = require("../components/research/source-library.tsx")
const assessmentModule = require("../components/research/source-assessments.tsx")
const { ResearchWorkspace } = require("../components/research/workspace.tsx")
const { SourceMetadataDialog } = require("../components/research/source-metadata.tsx")
const { SchoolWorkspace } = require("../components/research/school-workspace.tsx")
const { documentInWorkspace, documentOwnership } = require("../lib/research/document-presentation.ts")
const { emptyDocument, canReadDocument, membership, schoolScopes } = require("../lib/research/model.ts")
const { applyResearchCommand } = require("../lib/research/commands.ts")
const { STAFF } = require("../lib/demo/staff.ts")
const { schoolSyllabusCourses, createCourseMaterialDuty } = require("../lib/school/course-material.ts")
const mtStore = require("../lib/mt/store.tsx")
const mtDerive = require("../lib/mt/derive.ts")
Module._load = originalLoad

const initialState = structuredClone(researchStore.getResearch())
const realCourse = courseModule.CourseWorkspace, realLibrary = libraryModule.SourceLibrary, realAssessments = assessmentModule.SourceAssessments
const elements = node => Array.isArray(node) ? node.flatMap(elements) : node && typeof node === "object" && node.props ? [node, ...elements(node.props.children)] : []
const text = node => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : node == null || typeof node === "boolean" ? "" : String(node)
const find = (tree, predicate, description) => { const result = elements(tree).find(predicate); assert(result, `missing ${description}`); return result }
const tabsOf = tree => elements(tree).filter(node => node.props.role === "tab" && ["教学大纲", "教学计划", "教学资源", "真题库", "组卷台"].includes(text(node)))
const href = value => new URL(value, "http://localhost")

function setLocation(url) { location = href(url); pushes = [] }
function withWorkspace(url, run) {
  setLocation(url)
  const saved = { context: contextModule.useResearchContext, getResearch: researchStore.getResearch, status: researchStore.useResearchStatus, duties: dutyStore.useStaffDutyStatus, mt: mtStore.useMt, teacher: mtDerive.useTeacherId }
  const context = { state: structuredClone(initialState), actor: { staff: "u-lin", date: "2026-10-22", enabled: true }, people: [], catalog: structuredClone(catalogSeed), period: 40, ready: true, command: () => { throw Error("navigation must not mutate business data") } }
  let courseTree, libraryTree, assessmentTree, courseProps
  contextModule.useResearchContext = () => context
  researchStore.getResearch = () => context.state
  researchStore.useResearchStatus = () => ({ error: "" })
  dutyStore.useStaffDutyStatus = () => ({ error: "" })
  mtStore.useMt = () => ({ biz: { schemes: { schemes: {}, revs: {} } } })
  mtDerive.useTeacherId = () => null
  courseModule.CourseWorkspace = props => { courseProps = props; courseTree = realCourse(props); return courseTree }
  libraryModule.SourceLibrary = props => { libraryTree = realLibrary(props); return libraryTree }
  assessmentModule.SourceAssessments = props => { assessmentTree = realAssessments(props); return assessmentTree }
  const harness = {
    context,
    get state() { return context.state },
    get courseTree() { return courseTree }, get libraryTree() { return libraryTree }, get assessmentTree() { return assessmentTree }, get courseProps() { return courseProps },
    draw(element = React.createElement(ResearchWorkspace)) { courseTree = undefined; libraryTree = undefined; assessmentTree = undefined; courseProps = undefined; return render(element) },
    clickTab(label) { find(courseTree, node => node.props.role === "tab" && text(node) === label, label).props.onClick() },
  }
  try { return run(harness) }
  finally {
    contextModule.useResearchContext = saved.context; researchStore.getResearch = saved.getResearch; researchStore.useResearchStatus = saved.status; dutyStore.useStaffDutyStatus = saved.duties
    mtStore.useMt = saved.mt; mtDerive.useTeacherId = saved.teacher
    courseModule.CourseWorkspace = realCourse; libraryModule.SourceLibrary = realLibrary; assessmentModule.SourceAssessments = realAssessments
  }
}

test("explicit scope changes clean stale scope while an ambiguous existing URL keeps its explicit space", () => {
  const params = new URLSearchParams("group=math&space=personal&tab=resources&course=C101&view=resources&from=catalog")
  const before = params.toString()
  const group = href(navigation.workspaceHref(params, { group: "math", tab: "courses", view: "resources" })).searchParams
  assert.equal(group.get("space"), null)
  assert.equal(group.get("group"), "math")
  assert.equal(group.get("tab"), "courses")
  const personal = href(navigation.workspaceHref(params, { space: "personal", doc: "my-copy", tab: "courses" })).searchParams
  assert.equal(personal.get("group"), null)
  assert.equal(personal.get("space"), "personal")
  const ambiguous = href(navigation.workspaceHref(params, { rview: "favorites" })).searchParams
  assert.equal(ambiguous.get("space"), "personal")
  assert.equal(ambiguous.get("group"), "math")
  assert.equal(params.toString(), before, "the caller's query must stay immutable")
})

test("navigation hook uses the actual school pathname and supports explicit hook and call destinations", () => {
  setLocation("/catalog?tab=syllabi&course=C101&view=syllabus&sub=list")
  navigation.useWorkspaceNavigation().navigate({ sub: "read", sdoc: "school-syllabus", version: "2" })
  assert.equal(location.pathname, "/catalog")
  assert.equal(location.searchParams.get("tab"), "syllabi")
  assert.equal(location.searchParams.get("view"), "syllabus")
  assert.deepEqual(pushes.at(-1).options, { scroll: false })
  navigation.useWorkspaceNavigation("/research").navigate({ space: "personal", doc: "copied", tab: "courses", view: "plans" })
  assert.equal(location.pathname, "/research")
  assert.equal(location.searchParams.get("tab"), "courses")
  setLocation("/catalog?tab=syllabi&course=C101&view=syllabus")
  navigation.useWorkspaceNavigation("/catalog").navigate({ space: "personal", doc: "copy", originGroup: "math" }, "/research")
  assert.equal(location.pathname, "/research")
  assert.equal(location.searchParams.get("space"), "personal")
  assert.equal(location.searchParams.get("tab"), "courses")
  assert.equal(location.searchParams.get("originGroup"), "math")
})

test("school syllabus child navigation stays a school syllabus while research child view changes enter courses", () => {
  const school = new URLSearchParams("tab=syllabi&course=C101&view=syllabus&space=personal&group=math")
  for (const patch of [{ sub: "assess" }, { node: "node-1", version: "3" }, { view: "resources" }]) {
    const target = href(navigation.workspaceHref(school, patch, "/catalog"))
    assert.equal(target.searchParams.get("tab"), "syllabi")
    assert.equal(target.searchParams.get("view"), "syllabus")
    assert.equal(target.searchParams.has("space"), false)
    assert.equal(target.searchParams.has("group"), false)
  }
  const group = href(navigation.workspaceHref(new URLSearchParams("group=math&tab=resources"), { view: "builder", doc: "" }))
  assert.equal(group.searchParams.get("tab"), "courses")
  assert.equal(group.searchParams.get("view"), "builder")
  assert.equal(group.searchParams.get("group"), "math")
})

test("real course tab events retain all five tabs and the group when entering teaching resources and other sections", () => withWorkspace("/research?group=math&tab=courses&course=C101&view=syllabus&sub=list", h => {
  h.draw()
  for (const label of ["教学资源", "教学计划", "真题库", "组卷台", "教学大纲"]) {
    h.clickTab(label)
    const html = h.draw()
    assert.equal(tabsOf(h.courseTree).length, 5)
    assert.equal(tabsOf(h.courseTree).find(node => node.props["aria-selected"]).props.children, label)
    assert.equal(location.searchParams.get("tab"), "courses")
    assert.equal(location.searchParams.get("group"), "math")
    assert.equal(location.searchParams.get("space"), null)
    assert.match(html, /aria-label="课程一级分类"/)
    assert.doesNotMatch(html, /<h1>我的教学资料/)
  }
}))

test("legacy shared-directory URLs with an explicit course, view or document render the full course workspace", () => {
  const resource = initialState.documents.find(doc => doc.course === "C101" && doc.kind === "资源" && doc.owner === "math")
  assert(resource)
  for (const suffix of ["course=C101", "view=resources", `doc=${resource.id}`]) withWorkspace(`/research?group=math&tab=resources&${suffix}`, h => {
    const html = h.draw()
    assert.equal(h.courseProps.resourcesOnly, false)
    assert.equal(tabsOf(h.courseTree).length, 5)
    assert.match(html, /aria-label="课程一级分类"/)
    assert.doesNotMatch(html, /aria-label="教研组页签"/)
  })
})

test("group shared directory keeps its directory layout until a real child action enters the course builder", () => withWorkspace("/research?group=math&tab=resources", h => {
  const directory = h.draw()
  assert.equal(h.courseProps.resourcesOnly, true)
  assert.equal(tabsOf(h.courseTree).length, 0)
  assert.match(directory, /aria-label="教研组页签"/)
  find(h.libraryTree, node => typeof node.props.onClick === "function" && text(node) === "练习组合", "library builder action").props.onClick()
  const builder = h.draw()
  assert.equal(h.courseProps.resourcesOnly, false)
  assert.equal(location.searchParams.get("tab"), "courses")
  assert.equal(location.searchParams.get("view"), "builder")
  assert.equal(tabsOf(h.courseTree).length, 5)
  assert.match(builder, /data-testid="source-builder"/)
}))

test("personal and school-shared course views keep five tabs without silently changing ownership scope", () => {
  for (const space of ["personal", "shared"]) withWorkspace(`/research?space=${space}&tab=resources&course=C101&view=syllabus`, h => {
    h.draw()
    assert.equal(h.courseProps.group, undefined)
    h.clickTab("教学资源")
    h.draw()
    assert.equal(location.searchParams.get("space"), space)
    assert.equal(location.searchParams.get("group"), null)
    assert.equal(h.courseProps.resourcesOnly, false)
    assert.equal(tabsOf(h.courseTree).length, 5)
  })
})

test("workspace document scopes and ownership labels distinguish shared originals from private personal material", () => {
  const actor = { staff: "u-lin", date: "2026-10-22", enabled: true }, state = structuredClone(initialState)
  const group = emptyDocument("scope-group", "大纲", "组内大纲", "math", actor.staff, "C101", null, state.groups)
  const own = emptyDocument("scope-own", "大纲", "本人私有", actor.staff, actor.staff, "C101", null, state.groups)
  const other = emptyDocument("scope-other", "大纲", "另一教师分享", "u-zhou", "u-zhou", "C101", null, state.groups)
  other.share = { audience: "school", groups: [], staff: [] }
  const school = { ...structuredClone(group), id: "scope-school", owner: "school-source-library", share: { audience: "school", groups: [], staff: [] } }
  const readable = docs => docs.filter(doc => canReadDocument(state, actor, doc))
  const documents = readable([group, own, other, school])
  assert.equal(documents.length, 4)
  assert.deepEqual(documents.filter(doc => documentInWorkspace(state, actor, doc, { personal: true })).map(doc => doc.id), [own.id])
  assert.deepEqual(documents.filter(doc => documentInWorkspace(state, actor, doc, { group: "math" })).map(doc => doc.id), [group.id, other.id, school.id])
  assert.deepEqual(documents.filter(doc => documentInWorkspace(state, actor, doc, { school: true })).map(doc => doc.id), [school.id])
  assert.equal(documentOwnership(state, actor, school), "学校大纲")
  assert.equal(documentOwnership(state, actor, other), "教师个人大纲")
  assert.equal(documentOwnership(state, actor, own), "我的大纲")
  other.layout = { sourceId: group.id }
  assert.equal(documentOwnership(state, actor, other), "教师个人副本")
})

test("real metadata dialog creates a personal copy without editing the shared source metadata", () => withWorkspace("/research?group=math&tab=courses&course=C101&view=syllabus", h => {
  const source = h.state.documents.find(doc => doc.owner === "school-source-library" && doc.kind === "大纲" && doc.course === "C101")
  assert(source)
  const before = structuredClone(source), calls = [], created = []
  h.context.command = action => {
    calls.push(action)
    h.context.state = applyResearchCommand(h.context.state, h.context.actor, action, h.context.catalog, () => true)
    return { ok: true }
  }
  let tree
  const draw = () => render(React.createElement(function CaptureMetadata() {
    tree = SourceMetadataDialog({ doc: source, editable: false, patch: () => { throw Error("shared original must not be patched") }, onClose: () => {}, onCreated: id => created.push(id) })
    return null
  }))
  draw()
  find(tree, node => node.props.label === "名称", "metadata title field").props.onChange("我的教学调整")
  draw()
  const footer = find(tree.props.footer, node => typeof node.props.onClick === "function" && text(node) === "创建个人副本", "create personal copy")
  footer.props.onClick()
  assert.equal(created.length, 1)
  const copy = h.state.documents.find(doc => doc.id === created[0])
  assert.equal(copy.owner, h.context.actor.staff)
  assert.equal(copy.title, "我的教学调整")
  assert.equal(copy.share.audience, "owner")
  assert.deepEqual(h.state.documents.find(doc => doc.id === source.id), before)
  assert.equal(calls.some(action => action.type === "save-document" || action.type === "draft-document"), false)
  assert.equal(copy.items.some(item => item.references.some(ref => ref.documentId === source.id)), true)
}))

test("school maintenance authority follows the active course duty rather than the group role or display name", () => {
  const actor = { staff: "u-lin", date: "2026-10-22", enabled: true }
  const person = structuredClone(STAFF.find(person => person.id === actor.staff))
  const duty = createCourseMaterialDuty("test-material", actor.staff, ["C101"], "2026-09-01", "2027-07-31", catalogSeed)
  person.duties = [duty]
  assert.deepEqual(schoolSyllabusCourses([person], actor, catalogSeed), ["C101"])
  assert.deepEqual(schoolSyllabusCourses([person], { ...actor, enabled: false }, catalogSeed), [])
  assert.deepEqual(schoolSyllabusCourses([person], { ...actor, date: "2028-01-01" }, catalogSeed), [])
  for (const update of [{ workMode: "ro" }, { status: "paused" }, { scopeRefs: [{ kind: "course", id: "数学" }] }]) {
    assert.deepEqual(schoolSyllabusCourses([{ ...person, duties: [{ ...duty, ...update }] }], actor, catalogSeed), [])
  }
  assert.deepEqual(schoolSyllabusCourses([{ ...person, status: "left" }], actor, catalogSeed), [])
  assert.deepEqual(schoolSyllabusCourses([{ ...person, accountStatus: "disabled" }], actor, catalogSeed), [])
  assert.deepEqual(schoolSyllabusCourses([{ ...person, duties: person.duties.filter(item => item.type !== "course_material") }], actor, catalogSeed), [])
  const inactive = structuredClone(catalogSeed)
  inactive.settings.C101.active = false
  assert.deepEqual(schoolSyllabusCourses([person], actor, inactive), [])
})

test("the same real school syllabus is read-only in a group and editable only in the school maintenance workspace", () => withWorkspace("/research?group=math&tab=courses&course=C101&view=syllabus&sub=read", h => {
  const source = h.state.documents.find(doc => doc.owner === "school-source-library" && doc.kind === "大纲" && doc.course === "C101")
  assert(source)
  h.context.actor.schoolSyllabusCourses = schoolSyllabusCourses(STAFF, h.context.actor, h.context.catalog)
  assert(h.context.actor.schoolSyllabusCourses.includes("C101"))
  location.searchParams.set("sdoc", source.id)
  const groupHtml = h.draw()
  assert.match(groupHtml, /前往学校大纲维护/)
  assert.match(groupHtml, /复制并编辑资料/)
  assert.doesNotMatch(groupHtml, />编辑基本资料<|>修订学校大纲<|>保存学校修订</)
  setLocation(`/catalog?tab=syllabi&course=C101&view=syllabus&sub=read&doc=${source.id}`)
  const schoolHtml = h.draw(React.createElement(SchoolWorkspace))
  assert.equal(h.courseProps.school, true)
  assert.match(schoolHtml, /修订学校大纲/)
  assert.match(schoolHtml, /编辑基本资料/)
  assert.doesNotMatch(schoolHtml, /前往学校大纲维护/)
  find(h.courseTree, node => node.props.role === "tab" && text(node) === "考核", "school assessment tab").props.onClick()
  h.draw(React.createElement(SchoolWorkspace))
  assert.equal(location.pathname, "/catalog")
  assert.equal(location.searchParams.get("tab"), "syllabi")
  assert.equal(location.searchParams.get("view"), "syllabus")
  assert.equal(location.searchParams.get("sub"), "assess")
}))

test("a real group copy opens its own syllabus and can return to the original group without keeping personal scope", () => withWorkspace("/research?group=math&tab=courses&course=C101&view=syllabus&sub=read", h => {
  const source = h.state.documents.find(doc => doc.owner === "school-source-library" && doc.kind === "大纲" && doc.course === "C101")
  assert(source)
  location.searchParams.set("sdoc", source.id)
  h.context.command = action => {
    h.context.state = applyResearchCommand(h.context.state, h.context.actor, action, h.context.catalog, () => true)
    return { ok: true }
  }
  h.draw()
  find(h.courseTree, node => typeof node.props.onClick === "function" && text(node) === "复制为个人副本", "copy to personal").props.onClick()
  assert.equal(location.searchParams.get("space"), "personal")
  assert.equal(location.searchParams.get("group"), null)
  assert.equal(location.searchParams.get("originGroup"), "math")
  const copy = h.state.documents.find(doc => doc.id === location.searchParams.get("doc"))
  assert.equal(copy.owner, h.context.actor.staff)
  const personalHtml = h.draw()
  assert.doesNotMatch(personalHtml, /内容、指定修订或来源当前不可访问/)
  assert.equal(tabsOf(h.courseTree).length, 5)
  find(h.courseTree, node => typeof node.props.onClick === "function" && text(node) === "返回来源教研组", "return to source group").props.onClick()
  h.draw()
  assert.equal(location.searchParams.get("group"), "math")
  assert.equal(location.searchParams.get("space"), null)
  assert.equal(location.searchParams.get("originGroup"), null)
  assert.equal(tabsOf(h.courseTree).length, 5)
}))

test("the real school assessment past-paper action opens the full research course and can return to school syllabi", () => withWorkspace("/catalog?tab=syllabi&course=C101&view=syllabus&sub=assess", h => {
  const source = h.state.documents.find(doc => doc.owner === "school-source-library" && doc.kind === "大纲" && doc.course === "C101" && doc.assessments.length)
  assert(source)
  location.searchParams.set("doc", source.id)
  location.searchParams.set("sdoc", source.id)
  h.draw(React.createElement(SchoolWorkspace))
  find(h.assessmentTree, node => typeof node.props.onClick === "function" && text(node) === "历年真题", "school assessment past papers").props.onClick()
  assert.equal(location.pathname, "/research")
  assert.equal(location.searchParams.get("tab"), "courses")
  assert.equal(location.searchParams.get("view"), "papers")
  assert.equal(location.searchParams.get("space"), "shared")
  assert.equal(location.searchParams.get("course"), source.course)
  assert.equal(location.searchParams.get("originSchool"), source.course)
  assert.equal(location.searchParams.get("doc"), null)
  assert.equal(location.searchParams.get("sdoc"), null)
  const papersHtml = h.draw()
  assert.equal(tabsOf(h.courseTree).length, 5)
  assert.equal(tabsOf(h.courseTree).find(node => node.props["aria-selected"]).props.children, "真题库")
  assert.match(papersHtml, /data-testid="source-papers"/)
  find(h.courseTree, node => typeof node.props.onClick === "function" && text(node) === "返回学校大纲", "return to school syllabus").props.onClick()
  h.draw(React.createElement(SchoolWorkspace))
  assert.equal(location.pathname, "/catalog")
  assert.equal(location.searchParams.get("tab"), "syllabi")
  assert.equal(location.searchParams.get("view"), "syllabus")
  assert.equal(location.searchParams.get("course"), source.course)
  assert.equal(location.searchParams.get("space"), null)
  assert.equal(location.searchParams.get("originSchool"), null)
  assert.equal(h.courseProps.school, true)
}))

test("an explicit My Resources filter exposes own private material and opens it personally with a group return", () => withWorkspace("/research?group=math&tab=courses&course=C101&view=resources", h => {
  const privateResource = emptyDocument("private-navigation-resource", "资源", "仅我可见的教学备忘", h.context.actor.staff, h.context.actor.staff, "C101", null, h.state.groups)
  assert.equal(privateResource.share.audience, "owner")
  h.state.documents.push(privateResource)
  h.context.command = action => {
    assert.equal(action.type, "form-draft", "changing a resource filter must not edit the document")
    h.context.state = applyResearchCommand(h.context.state, h.context.actor, action, h.context.catalog, () => true)
    return { ok: true }
  }
  const initialHtml = h.draw()
  assert.doesNotMatch(initialHtml, /private-navigation-resource/)
  find(h.libraryTree, node => typeof node.props.onClick === "function" && text(node) === "我的资源", "My Resources filter").props.onClick()
  const mineHtml = h.draw()
  assert.equal(location.searchParams.get("rview"), "mine")
  assert.equal(location.searchParams.get("group"), "math")
  assert.equal(location.searchParams.get("space"), null)
  assert.match(mineHtml, /data-resource-id="private-navigation-resource"/)
  find(h.libraryTree, node => node.type === "button" && text(node) === privateResource.title, "private resource title").props.onClick()
  assert.equal(location.searchParams.get("space"), "personal")
  assert.equal(location.searchParams.get("group"), null)
  assert.equal(location.searchParams.get("doc"), privateResource.id)
  assert.equal(location.searchParams.get("originGroup"), "math")
  const personalHtml = h.draw()
  assert.equal(tabsOf(h.courseTree).length, 5)
  assert.match(personalHtml, /data-testid="source-book"/)
  assert.doesNotMatch(personalHtml, /内容、指定修订或来源当前不可访问/)
  assert.equal(h.state.documents.find(doc => doc.id === privateResource.id).share.audience, "owner")
  find(h.courseTree, node => typeof node.props.onClick === "function" && text(node) === "返回来源教研组", "return from private resource").props.onClick()
  h.draw()
  assert.equal(location.searchParams.get("group"), "math")
  assert.equal(location.searchParams.get("space"), null)
  assert.equal(location.searchParams.get("originGroup"), null)
  assert.equal(tabsOf(h.courseTree).length, 5)
}))

test("a teacher with only a course-material duty can enter school maintenance from research home", () => withWorkspace("/research", h => {
  const person = structuredClone(STAFF.find(person => person.id === "u-chen"))
  assert(person)
  h.context.actor = { staff: person.id, date: "2026-10-22", enabled: true }
  h.state.staffDuties = h.state.staffDuties.filter(duty => duty.staffId !== person.id)
  assert.equal(h.state.groups.some(group => membership(h.state, person.id, group.id, h.context.actor.date)), false)
  assert.deepEqual(schoolScopes(h.state, h.context.actor), [])
  person.duties = []
  h.context.actor.schoolSyllabusCourses = schoolSyllabusCourses([person], h.context.actor, h.context.catalog)
  assert.doesNotMatch(h.draw(), /维护学校大纲/)
  person.duties = [createCourseMaterialDuty("independent-maintainer", person.id, ["C101"], "2026-09-01", "2027-07-31", h.context.catalog)]
  h.context.actor.schoolSyllabusCourses = schoolSyllabusCourses([person], h.context.actor, h.context.catalog)
  const authorizedHtml = h.draw()
  const link = authorizedHtml.match(/href="([^"]+)"[^>]*>维护学校大纲<\/a>/)
  assert(link, "a material maintainer needs an entry even without a group or school oversight scope")
  const target = href(link[1].replaceAll("&amp;", "&"))
  assert.equal(target.pathname, "/catalog")
  assert.equal(target.searchParams.get("tab"), "syllabi")
  assert.equal(target.searchParams.get("course"), "C101")
  assert.equal(target.searchParams.get("view"), "syllabus")
  assert.equal(target.searchParams.get("sub"), "list")
  assert.doesNotMatch(authorizedHtml, />学校课程管理<\/a>/, "a course duty does not grant school-wide oversight")
  h.context.actor.schoolSyllabusCourses = []
  assert.doesNotMatch(h.draw(), /维护学校大纲/, "removing the duty removes the entry")
}))
