import type { CatalogCourse, CatalogSubject, CatalogUnit } from "@/lib/demo/school"

export type Actor = { staff: string; date: string; enabled: boolean }
export type Group = { id: string; name: string; subject: string }
export const groups: Group[] = [{ id: "math", name: "数学组", subject: "S001" }, { id: "physics", name: "物理组", subject: "S002" }]
export type Appointment = { id: string; staff: string; group: string; role: "组长" | "成员" | "维护者"; start: string; end: string | null }
export type SchoolGrant = { staff: string; group: string; mode: "查看" | "统筹"; start: string; end: string | null }
export type Access = { audience: "owner" | "group" | "school" | "specified"; groups: string[]; staff: string[] }
export type SourceRef = { documentId: string; version: number; itemId: string; title: string; locator: string; retainedBy?: string; retainText: boolean }
export type WeekAllocation = { week: number; minutes: number }
export type Item = {
  id: string; parentId: string | null; title: string; body: string; notes: string; original: string; translation: string; supplement: string;
  origin: "官方原文" | "学校自编" | "教师译注" | "教学补充"; source: string; references: SourceRef[];
  unitIds: string[]; minutes: number | null; fixed: boolean; weeks: WeekAllocation[]; section: string;
  printedPage: string; filePage: string; question: string; subquestion: string; stem: string; maxScore: number | null; scoring: string;
  answer: { documentId: string; itemId: string } | null;
}
export type Assessment = { id: string; title: string; unitIds: string[]; itemIds: string[]; conditions: string; source: string; rubric: string }
export type AssessmentPath = { id: string; target: string; required: string[]; optional: string[]; choose: number | null; weights: Record<string, number | null>; conditions: string; source: string }
export type SourceFile = { id: string; name: string; type: string; data: string; access: Access }
export type ResourceType = "教材" | "练习册" | "真题" | "答案与评分资料" | "讲义课件" | "实验材料" | "教学案例" | "常见错误材料" | "练习组合"
export type Document = {
  id: string; kind: "大纲" | "计划" | "资源" | "练习组合"; title: string; owner: string; author: string; course: string; version: number;
  source: string; sourceVersion: string; language: string; years: string; objectives: string; prerequisites: string; notes: string;
  scope: "whole" | "units"; unitIds: string[]; share: Access; copyPolicy: "retain" | "reference-only"; restricted: boolean; archived: boolean;
  budget: number | null; reserve: number; period: number | null; items: Item[]; assessments: Assessment[]; paths: AssessmentPath[];
  resourceType: ResourceType; edition: string; publisher: string; examYear: string; session: string; paperCode: string; files: SourceFile[];
}
export type DraftDocument = { document: Document; baseVersion: number; savedAt: string }
export type Outcome = { id: string; kind: "document" | "activity"; entityId: string; version: number; title: string; submittedBy: string; submittedAt: string; document?: Document; activity?: Activity }
export type Discussion = { id: string; target: string; author: string; body: string; at: string }
export type SchoolTask = { id: string; title: string; groups: string[]; due: string; requirements: string; acceptance: boolean; createdBy: string; createdAt: string }
export type Task = {
  id: string; title: string; group: string; parent: string | null; schoolTaskId: string | null; course: string; owner: string; collaborators: string[];
  submitters: string[]; due: string; mode: "牵头提交" | "成员各自提交"; requirements: string; acceptance: boolean;
  status: "待承接" | "进行中" | "已提交" | "待验收" | "已完成"; outcomes: Outcome[]; acceptedNote: string;
}
export type Activity = {
  id: string; group: string; title: string; type: "集体备课" | "独立试讲" | "示范课" | "同课异构" | "专题研讨" | "评分校准";
  owner: string; course: string; taskId: string | null; start: string; end: string; participants: string[];
  lesson: { taskId: string; lessonId: string; date: string; period: number; label: string; room: string | null } | null;
  materials: { documentId: string; version: number }[]; conclusion: string; share: Access;
  responses: Record<string, "参加" | "无法参加">; attendance: Record<string, "到场" | "未到场">;
  criterionId: string | null; criterionVersion?: number; criterionSnapshot?: Criterion;
  trials: { id: string; answer: string; notes: string; decisions: Record<string, string> }[]; version: number;
}
export type Notice = { id: string; group: string; title: string; body: string; recipients: string[]; requiresAck: boolean; acknowledged: string[]; author: string; at: string }
export type SupportIssue = { id: string; group: string; title: string; body: string; response: string; status: "待协调" | "已回复"; author: string }
export type Criterion = {
  id: string; group: string; title: string; kind: "课堂表现方案" | "作业质量方案" | "题目评分依据" | "单次考核等级换算";
  version: number; source: string; notes: string; recommended: boolean;
  dimensions: { id: string; name: string; meaning: string }[];
  levels: { id: string; code: string; label: string; guide: string }[];
  documentId: string | null; itemId: string | null; maxScore: number | null; scoring: string;
  testName: string; thresholds: { minimum: number; code: string }[];
}
export type ResearchState = {
  schema: 2; documents: Document[]; revisions: Record<string, Document>; drafts: Record<string, DraftDocument>;
  appointments: Appointment[]; grants: SchoolGrant[]; schoolTasks: SchoolTask[]; tasks: Task[]; activities: Activity[];
  discussions: Discussion[]; notices: Notice[]; issues: SupportIssue[]; criteria: Criterion[];
  criterionRevisions?: Record<string, Criterion>; forms: Record<string, unknown>;
}
export type CatalogState = { subjects: CatalogSubject[]; courses: CatalogCourse[]; units: CatalogUnit[]; settings: Record<string, { active: boolean; groupIds: string[] }> }
export type QuestionScoringBasis = { criterionId: string; version: number; title: string; source: string; maxScore: number | null; scoring: string; adoptedAt: string }
export type PreparedQuestion = { id: string; title: string; text: string; notes?: string; scoringBasis?: QuestionScoringBasis; stem: string; printedPage: string; filePage: string; question: string; subquestion: string; maxScore: number | null; scoring: string; answer: Item["answer"]; source: SourceRef; references: SourceRef[] }
export type TestConversion = { criterionId: string; version: number; title: string; source: string; testName: string; assignmentId: string; participantIds: string[]; thresholds: { minimum: number; code: string }[]; levels?: Criterion["levels"]; adoptedAt: string }
export type TeachingContent = { id: string; title: string; text: string; source: SourceRef | null; references: SourceRef[]; at: string; confirmedBy: string; planItemId?: string; revision?: number }
export type Adoption = { id: string; documentId: string; version: number; taskId: string; itemIds: string[]; adoptedAt: string; items: Item[]; unitIds: string[] }

export function activeAt(start: string, end: string | null, date: string) { return start <= date && (!end || end >= date) }
export function membership(state: ResearchState, staff: string, group: string, date: string) {
  return state.appointments.filter(a => a.staff === staff && a.group === group && activeAt(a.start, a.end, date)).sort((a,b) => (a.role === "组长" ? -1 : b.role === "组长" ? 1 : a.role === "维护者" ? -1 : 1))[0]
}
export function schoolScopes(state: ResearchState, actor: Actor, manage = false) {
  return actor.enabled ? state.grants.filter(g => g.staff === actor.staff && activeAt(g.start, g.end, actor.date) && (!manage || g.mode === "统筹")).map(g => g.group) : []
}
export function canViewGroup(state: ResearchState, actor: Actor, group: string) { return actor.enabled && (!!membership(state, actor.staff, group, actor.date) || schoolScopes(state, actor).includes(group)) }
export function canEditGroup(state: ResearchState, actor: Actor, group: string) { return actor.enabled && !!membership(state, actor.staff, group, actor.date) }
export function canLeadGroup(state: ResearchState, actor: Actor, group: string) { return actor.enabled && membership(state, actor.staff, group, actor.date)?.role === "组长" }
export function canUseAccess(state: ResearchState, actor: Actor, owner: string, access: Access, management = true) {
  if (!actor.enabled) return false
  if (owner === actor.staff) return true
  const ownedGroup = groups.some(g => g.id === owner)
  if (access.audience === "owner") return false
  if (access.audience === "school") return true
  if (access.audience === "specified") return access.staff.includes(actor.staff) || access.groups.some(g => canEditGroup(state, actor, g))
  return ownedGroup && (management ? canViewGroup(state, actor, owner) : canEditGroup(state, actor, owner))
}
export function canReadDocument(state: ResearchState, actor: Actor, doc: Document) {
  return canUseAccess(state, actor, doc.owner, doc.share, !doc.restricted)
}
export function canEditDocument(state: ResearchState, actor: Actor, doc: Document) {
  return canReadDocument(state, actor, doc) && (doc.owner === actor.staff || canEditGroup(state, actor, doc.owner))
}
export function referenceReadable(state: ResearchState, actor: Actor, ref: SourceRef, personalOwner?: string) {
  const source = state.documents.find(d => d.id === ref.documentId) ?? state.revisions[`${ref.documentId}@${ref.version}`]
  if (!source) return false
  if (canReadDocument(state, actor, source)) return true
  return personalOwner === actor.staff && ref.retainedBy === actor.staff && ref.retainText && !source.restricted && source.copyPolicy === "retain"
}
export function itemReadable(state: ResearchState, actor: Actor, item: Item, personalOwner?: string) {
  return item.references.every(ref => referenceReadable(state, actor, ref, personalOwner))
}
export function visibleItems(state: ResearchState, actor: Actor, doc: Document) { return doc.items.filter(i => itemReadable(state, actor, i, doc.owner)) }
export function canRetainItem(state: ResearchState, actor: Actor, item: Item, owner?: string, visited = new Set<string>()): boolean {
  if (!itemReadable(state, actor, item, owner)) return false
  return item.references.every(ref => {
    const source = state.documents.find(d => d.id === ref.documentId)
    if (!source || source.restricted || source.copyPolicy !== "retain" || !ref.retainText) return false
    const key = `${ref.documentId}@${ref.version}:${ref.itemId}`
    if (visited.has(key)) return false
    const revision = state.revisions[`${ref.documentId}@${ref.version}`] ?? (source.version === ref.version ? source : null)
    const original = revision?.items.find(i => i.id === ref.itemId)
    return !!original && canRetainItem(state, actor, original, owner, new Set([...visited, key]))
  })
}
export function canReadCriterion(state: ResearchState, actor: Actor, criterion: Criterion): boolean {
  if (!canViewGroup(state, actor, criterion.group)) return false
  if (!criterion.documentId) return true
  const document = state.documents.find(d => d.id === criterion.documentId)
  const item = document?.items.find(i => i.id === criterion.itemId)
  return !!document && canReadDocument(state, actor, document) && (!criterion.itemId || !!item && itemReadable(state, actor, item, document.owner))
}
export function validateCriterion(criterion: Criterion) {
  if (!criterion.title.trim() || criterion.title.length > 120) throw new Error("依据名称须为 1–120 字。")
  const levels = criterion.levels
  if (new Set(levels.map(l => l.id)).size !== levels.length || new Set(levels.map(l => l.code)).size !== levels.length || levels.some(l => !l.id || !l.code.trim() || !l.label.trim())) throw new Error("等级标识、代码和含义须完整，代码不能重复。")
  if (levels.some(l => l.code === "A" && l.label !== "优秀")) throw new Error("A 沿用既有“优秀”语义，不是 GPA。")
  if (["课堂表现方案", "作业质量方案"].includes(criterion.kind) && (levels.length < 2 || !criterion.dimensions.length || criterion.dimensions.some(d => !d.name.trim()))) throw new Error("课堂／作业方案须至少有一个评价维度和两个有含义的选项。")
  if (criterion.maxScore !== null && (!Number.isFinite(criterion.maxScore) || criterion.maxScore < 0)) throw new Error("题目满分须为非负有限数；未知与 0 分分别保存。")
  if (criterion.kind === "题目评分依据" && (!criterion.documentId || !criterion.itemId)) throw new Error("请明确关联题目或小题。")
  if (new Set(criterion.thresholds.map(t => t.minimum)).size !== criterion.thresholds.length || new Set(criterion.thresholds.map(t => t.code)).size !== criterion.thresholds.length || criterion.thresholds.some(t => !Number.isFinite(t.minimum) || t.minimum < 0 || !levels.some(l => l.code === t.code))) throw new Error("分数线须为非负有限数且不重复，并关联明确等级。")
  if (criterion.kind === "单次考核等级换算" && criterion.thresholds.length && (!criterion.testName.trim() || !criterion.source.trim())) throw new Error("有分数线时须填写明确考核及真实依据，不推定官方规则。")
}
export function referenceFor(doc: Document, item: Item, actor?: Actor): SourceRef {
  return { documentId: doc.id, version: doc.version, itemId: item.id, title: doc.title, locator: [item.source, item.printedPage && `印刷页 ${item.printedPage}`, item.filePage && `文件页 ${item.filePage}`, item.question && `题 ${item.question}${item.subquestion}`].filter(Boolean).join(" · "), retainText: !doc.restricted && doc.copyPolicy === "retain", ...(actor ? { retainedBy: actor.staff } : {}) }
}
export function canReadActivity(state: ResearchState, actor: Actor, activity: Activity) {
  return actor.enabled && (activity.participants.includes(actor.staff) || canUseAccess(state, actor, activity.group, activity.share))
}
export function coursesFor(catalog: CatalogState, group: string) { return catalog.courses.filter(c => catalog.settings[c.code]?.active && catalog.settings[c.code]?.groupIds.includes(group)) }
export function scopeValid(doc: Document, catalog: CatalogState) {
  return catalog.courses.some(c => c.code === doc.course) && (doc.scope === "whole" ? doc.unitIds.length === 0 : doc.unitIds.length > 0 && doc.unitIds.every(id => catalog.units.some(u => u.code === id && u.courseCode === doc.course)))
}
export function emptyAccess(owner: string): Access { return { audience: groups.some(g => g.id === owner) ? "group" : "owner", staff: [], groups: [] } }
export function emptyItem(id: string): Item {
  return { id, parentId: null, title: "新内容项目", body: "", notes: "", original: "", translation: "", supplement: "", origin: "教学补充", source: "", references: [], unitIds: [], minutes: null, fixed: false, weeks: [], section: "", printedPage: "", filePage: "", question: "", subquestion: "", stem: "", maxScore: null, scoring: "", answer: null }
}
export function emptyDocument(id: string, kind: Document["kind"], title: string, owner: string, author: string, course: string, period: number | null): Document {
  return { id, kind, title, owner, author, course, version: 1, source: "", sourceVersion: "", language: "中文", years: "", objectives: "", prerequisites: "", notes: "", scope: "whole", unitIds: [], share: emptyAccess(owner), copyPolicy: "retain", restricted: false, archived: false, budget: null, reserve: 0, period, items: [], assessments: [], paths: [], resourceType: kind === "练习组合" ? "练习组合" : "教材", edition: "", publisher: "", examYear: "", session: "", paperCode: "", files: [] }
}
export function leafItems(doc: Pick<Document,"items">) { const parents = new Set(doc.items.map(i => i.parentId)); return doc.items.filter(i => !parents.has(i.id)) }
export function totals(doc: Document) {
  const leaves = leafItems(doc)
  const allocated = leaves.reduce((sum,i) => sum + (i.minutes ?? 0),0)
  return { allocated, reserve: doc.reserve, unassignedItems: leaves.filter(i => i.minutes === null).length, remainder: doc.budget === null ? null : doc.budget - doc.reserve - allocated }
}
export function descendants(items: Item[], id: string): string[] {
  const out = [id]
  for (let i=0;i<out.length;i++) for (const child of items.filter(x => x.parentId === out[i])) if (!out.includes(child.id)) out.push(child.id)
  return out
}
export function selectItems(doc: Document, ids: string[]) { const selected = new Set(ids.flatMap(id => descendants(doc.items,id))); return doc.items.filter(i => selected.has(i.id)) }
export function moveItem(doc: Document, id: string, parentId: string | null): Document {
  if (parentId && (!doc.items.some(i => i.id === parentId) || descendants(doc.items,id).includes(parentId))) throw new Error("不能把项目移入自身或其子项。")
  const parent = doc.items.find(i => i.id === parentId)
  if (parent && (parent.minutes !== null || parent.weeks.length)) throw new Error("目标有独立课时或周安排，请先拆分为汇总项，避免重复计时。")
  return { ...doc, items: doc.items.map(i => i.id === id ? { ...i, parentId } : i) }
}
export function reorderItem(doc: Document, id: string, direction: -1 | 1) {
  const item = doc.items.find(i => i.id === id)
  if (!item) return doc
  const siblings = doc.items.filter(i => i.parentId === item.parentId)
  const sibling = siblings[siblings.findIndex(i => i.id === id) + direction]
  if (!sibling) return doc
  const aIds = new Set(descendants(doc.items,id)); const bIds = new Set(descendants(doc.items,sibling.id))
  const a = doc.items.filter(i => aIds.has(i.id)); const b = doc.items.filter(i => bIds.has(i.id))
  const first = Math.min(doc.items.findIndex(i => i.id === id),doc.items.findIndex(i => i.id === sibling.id))
  const rest = doc.items.filter(i => !aIds.has(i.id) && !bIds.has(i.id))
  rest.splice(first,0,...(direction === -1 ? [...a,...b] : [...b,...a]))
  return { ...doc, items: rest }
}
export function splitItem(doc: Document, id: string, childIds: [string,string]): Document {
  const item = doc.items.find(i => i.id === id)
  if (!item || doc.items.some(i => i.parentId === id)) throw new Error("请选择尚未拆分的内容项目。")
  const first = item.minutes === null ? null : Math.floor(item.minutes / 2)
  const children: Item[] = childIds.map((childId,index) => ({ ...structuredClone(item), id: childId, parentId: item.id, title: `${item.title} · ${index === 0 ? "第一部分" : "第二部分"}`, minutes: item.minutes === null ? null : index === 0 ? first : item.minutes - first!, weeks: [] }))
  let capacity = first ?? 0
  for (const week of item.weeks) {
    const a = Math.min(capacity,week.minutes)
    if (a) children[0].weeks.push({ week: week.week, minutes: a })
    if (week.minutes - a) children[1].weeks.push({ week: week.week, minutes: week.minutes - a })
    capacity -= a
  }
  const idx = doc.items.findIndex(i => i.id === id)
  return { ...doc, items: [...doc.items.slice(0,idx), { ...item, minutes: null, fixed: false, weeks: [] }, ...children, ...doc.items.slice(idx+1)] }
}
export type AllocationMode = "balance" | "same" | "redistribute" | "reserve"
export type AllocationPreview = { version: number; mode: AllocationMode; ids: string[]; before: Record<string,number|null>; after: Record<string,number>; reserveBefore: number; reserveAfter: number; description: string }
export function allocationPreview(doc: Document, selected: string[], mode: AllocationMode, amount: number): AllocationPreview {
  const selectedIds = new Set(selectItems(doc,selected).map(i => i.id))
  const eligible = leafItems(doc).filter(i => selectedIds.has(i.id) && !i.fixed)
  if (!eligible.length) throw new Error("没有可分配的非固定末级项目。")
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("请输入非负整数分钟。")
  const remainder = totals(doc).remainder
  if (mode === "balance" && (remainder === null || remainder <= 0)) throw new Error("请先设置总预算并保留正余额。")
  if (mode === "reserve" && amount > doc.reserve) throw new Error("转入金额超过机动时间。")
  const pool = mode === "balance" ? remainder! : mode === "same" ? amount * eligible.length : amount
  const each = mode === "same" ? amount : Math.floor(pool / eligible.length)
  const before = Object.fromEntries(eligible.map(i => [i.id,i.minutes]))
  const after = Object.fromEntries(eligible.map(i => [i.id,(mode === "balance" || mode === "reserve" ? i.minutes ?? 0 : 0) + each]))
  if (eligible.some(i => i.weeks.reduce((n,w) => n+w.minutes,0) > after[i.id])) throw new Error("新时长小于已有跨周安排，请先核对周分配；不会无提示覆盖。")
  const reserveAfter = mode === "reserve" ? doc.reserve - each * eligible.length : doc.reserve
  return { version: doc.version, mode, ids: eligible.map(i => i.id), before, after, reserveBefore: doc.reserve, reserveAfter, description: `${eligible.length} 个非固定末级项目，每项${mode === "balance" || mode === "reserve" ? "追加" : "设为"} ${each} 分钟；固定项不变。${mode === "reserve" ? `机动减少 ${doc.reserve-reserveAfter} 分钟。` : "机动不变。"}均分余数 ${pool-each*eligible.length} 分钟保持在原余额或机动池。` }
}
export function applyAllocation(doc: Document, preview: AllocationPreview): Document {
  if (doc.version !== preview.version || doc.reserve !== preview.reserveBefore || preview.ids.some(id => !doc.items.some(i => i.id === id && !i.fixed && i.minutes === preview.before[id]))) throw new Error("分配范围或课时已变化，请重新预览。")
  return { ...doc, reserve: preview.reserveAfter, items: doc.items.map(i => preview.ids.includes(i.id) ? { ...i, minutes: preview.after[i.id] } : i) }
}
export function validateDocument(doc: Document) {
  if (!doc.title.trim()) throw new Error("请输入内容名称。")
  for (const n of [doc.budget,doc.reserve,doc.period,...doc.items.map(i => i.minutes),...doc.items.map(i => i.maxScore)]) if (n !== null && (!Number.isFinite(n) || n < 0)) throw new Error("时长、预算与分值必须是非负有限数；留空与 0 分开保存。")
  if (doc.period !== null && doc.period <= 0) throw new Error("每课时分钟必须大于 0。")
  const ids = doc.items.map(i => i.id)
  if (new Set(ids).size !== ids.length) throw new Error("项目标识重复。")
  for (const item of doc.items) {
    if (item.parentId && !ids.includes(item.parentId)) throw new Error("项目所属章节不存在。")
    let cursor = item.parentId; const visited = new Set([item.id])
    while (cursor) { if (visited.has(cursor)) throw new Error("内容层级存在循环。"); visited.add(cursor); cursor = doc.items.find(i => i.id === cursor)?.parentId ?? null }
    if (doc.items.some(i => i.parentId === item.id) && (item.minutes !== null || item.weeks.length)) throw new Error("汇总父项不能同时有独立时长或周分配。")
    if (new Set(item.weeks.map(w => w.week)).size !== item.weeks.length || item.weeks.some(w => !Number.isInteger(w.week) || w.week < 1 || !Number.isSafeInteger(w.minutes) || w.minutes < 0)) throw new Error("相对周次须为正整数，每周分钟须为非负整数且不能重复。")
    if (item.weeks.length && (item.minutes === null || item.weeks.reduce((s,w) => s+w.minutes,0) > item.minutes)) throw new Error("跨周分钟不能超过该项目时长；未分配项目请先分配时长。")
  }
}
export function copyDocument(state: ResearchState, actor: Actor, doc: Document, id: string, kind = doc.kind, itemIds = doc.items.map(i => i.id)): Document {
  if (!canReadDocument(state,actor,doc)) throw new Error("已失去来源访问权，不能复制。")
  const items = selectItems(doc,itemIds)
  if (doc.restricted || doc.copyPolicy !== "retain" || items.some(i => !canRetainItem(state,actor,i,doc.owner))) throw new Error("来源仅允许受限引用，不能保存为脱离授权的个人副本。")
  const selected = new Set(items.map(i => i.id))
  return { ...structuredClone(doc), id, kind, owner: actor.staff, author: actor.staff, title: `${doc.title} · ${kind === doc.kind ? "个人版" : "选用计划"}`, version: 1, share: emptyAccess(actor.staff), archived: false, files: [],
    items: items.map(i => ({ ...structuredClone(i), parentId: i.parentId && selected.has(i.parentId) ? i.parentId : null, references: [...i.references.map(ref => ({ ...ref,retainedBy: actor.staff })),referenceFor(doc,i,actor)] })), ...(kind === "计划" && doc.kind !== "计划" ? { budget: null, reserve: 0, assessments: [], paths: [], items: items.map(i => ({ ...structuredClone(i), parentId: i.parentId && selected.has(i.parentId) ? i.parentId : null, minutes: null, fixed: false, weeks: [], references: [...i.references.map(ref => ({ ...ref,retainedBy: actor.staff })),referenceFor(doc,i,actor)] })) } : {}) }
}
export function ownTodos(state: ResearchState, actor: Actor, group: string) {
  const rows = state.tasks.filter(t => t.group === group && !["已完成","已提交","待验收"].includes(t.status) && (t.owner === actor.staff || t.mode === "成员各自提交" && t.submitters.includes(actor.staff) && !t.outcomes.some(o => o.submittedBy === actor.staff)))
  const seen = new Set<string>()
  return rows.sort((a,b) => Number(!!b.parent)-Number(!!a.parent)).filter(t => { const key = t.schoolTaskId ?? t.parent ?? t.id; if (seen.has(key)) return false; seen.add(key); return true })
}
export const courseTaskMap: Record<string,string> = { C101: "COURSE_MATH_9709", C501: "COURSE_CS_9618" }
export const dutyUnitMap: Record<string,string> = { DUTY_G1_P1: "U101", DUTY_G2_P1: "U101", DUTY_G2_S1: "U105", DUTY_OTHER_M1: "U104" }
export function taskCompatible(doc: Document, task: { course_id: string; duty_id: string | null }, items = leafItems(doc)) {
  if (courseTaskMap[doc.course] !== task.course_id) return false
  const unit = task.duty_id ? dutyUnitMap[task.duty_id] : null
  if (!task.duty_id) return doc.scope === "whole"
  if (!unit) return false
  if (doc.scope === "units" && !doc.unitIds.includes(unit)) return false
  return items.every(i => i.unitIds.length ? i.unitIds.includes(unit) : doc.scope === "units" && doc.unitIds.length === 1 && doc.unitIds[0] === unit)
}
export function itemText(i: Item) { return [i.stem && `共同题干：${i.stem}`, i.body, i.original && `原文：${i.original}`, i.notes && `Notes：${i.notes}`, i.translation && `译注：${i.translation}`, i.supplement && `教学补充：${i.supplement}`].filter(Boolean).join("\n\n") }
export function safeUrl(value: string) { try { const url = new URL(value); return ["http:","https:"].includes(url.protocol) ? url.href : null } catch { return null } }
