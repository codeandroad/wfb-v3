import { canEditDocument, type Actor, type Document, type ResearchState } from "./model"

// Keep ownership distinct from visibility: sharing a personal copy never changes its owner.
export const isSchoolDocument = (doc: Document) => doc.owner === "school-source-library"
export function isPersonalCopy(doc: Document) {
  return doc.items.some(item => item.references.length > 0) || !!doc.layout?.sourceId && doc.layout.sourceId !== doc.id
}
export function documentOwnership(state: ResearchState, actor: Actor, doc: Document) {
  if (isSchoolDocument(doc)) return `学校${doc.kind}`
  const group = state.groups.find(group => group.id === doc.owner)
  if (group) return `${group.name} · 组内${doc.kind}`
  return `${doc.owner === actor.staff ? "我的" : "教师个人"}${isPersonalCopy(doc) ? "副本" : doc.kind}`
}
export function documentAudience(doc: Document) {
  return { owner: "仅本人", group: "组内共享", school: "校内共享", specified: "指定成员 / 科组可见" }[doc.share.audience]
}
export function documentEditAction(state: ResearchState, doc: Document) {
  if (isSchoolDocument(doc)) return `修订学校${doc.kind}`
  if (state.groups.some(group => group.id === doc.owner)) return `修订组内${doc.kind}`
  return isPersonalCopy(doc) ? "编辑个人副本" : `编辑个人${doc.kind}`
}
export function documentEditIdentity(state: ResearchState, actor: Actor, doc: Document) {
  if (!canEditDocument(state, actor, doc)) return "只读 · 可复制为我的资料"
  if (isSchoolDocument(doc)) return "当前以课程资料维护人身份维护"
  if (state.groups.some(group => group.id === doc.owner)) return "当前以教研组长身份维护"
  return "当前以个人所有者身份编辑"
}
export type DocumentWorkspaceScope = { group?: string; personal?: boolean; school?: boolean; shared?: boolean }
export function documentInWorkspace(state: ResearchState, actor: Actor, doc: Document, scope: DocumentWorkspaceScope) {
  if (scope.school) return isSchoolDocument(doc) && doc.kind === "大纲"
  if (scope.personal) return doc.owner === actor.staff
  if (scope.group) return doc.owner === scope.group || doc.share.audience === "school" || doc.share.audience === "specified" && doc.share.groups.includes(scope.group)
  if (scope.shared) return doc.owner !== actor.staff && doc.share.audience !== "owner"
  return true
}
