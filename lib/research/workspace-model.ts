import {resolveSelection} from "./selection"
import { canParticipateGroup, canReadDocument, canReadActivity, canViewGroup, canRetainItem, canLeadGroup, schoolScopes, type Actor, type Activity, type CatalogState, type Document, type ResearchState, type Task } from "./model"

export type Journal = { id: string; group: string; author: string; date: string; title: string; body: string; conclusion: string; next: string; taskId: string | null; activityId: string | null; course: string; references: { documentId: string; version: number; snapshot: Document }[]; version: number; at: string }
export type MediaFile = { name: string; mime: string; size: number; data: string }
export type ChatMessage = { id: string; group: string; author: string; body: string; at: string; replyTo: string | null; mentions: string[]; meme: string; files: MediaFile[]; references: { documentId: string; version: number; snapshot: Document }[]; reactions: Record<string, string[]>; withdrawn?: boolean }
export type GroupProfile = { office: string; room: string; notes: string }
export const EMOJIS = ["👍", "👏", "✅", "😊", "😂", "🤔", "🎉", "❤️", "📚", "🙏", "💪", "👀"]
export const MEMES: Record<string, [string, string]> = { received: ["👍", "收到，马上安排"], thinking: ["🤔", "让我想一想"], thanks: ["🙏", "辛苦各位老师"], ready: ["📚", "备课搭子已就位"] }
export const MEDIA_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
export type WorkspaceCommand =
  | { type: "journal"; journal: Journal }
  | { type: "chat"; message: ChatMessage }
  | { type: "withdraw-chat"; id: string }
  | { type: "react-chat"; id: string; emoji: string }
  | { type: "favorite-document"; id: string }
  | { type: "group-profile"; group: string; profile: GroupProfile }
  | { type: "return-task"; id: string; note: string }
  | { type: "basket"; ids: string[] }

function need(value: unknown, text: string): asserts value { if (!value) throw new Error(text) }
export function validDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date }
export function localTime(date: string) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date) && validDate(date.slice(0, 10)) && +date.slice(11, 13) < 24 && +date.slice(14) < 60 ? Date.parse(`${date}:00+08:00`) : NaN }
export function activitiesOn(state: ResearchState, actor: Actor, group: string, date: string) { const start = localTime(`${date}T00:00`); return state.activities.filter(a => a.group === group && canReadActivity(state, actor, a) && localTime(a.start) < start + 86400000 && localTime(a.end) > start).sort((a, b) => a.start.localeCompare(b.start)) }
export function activityOverlaps(a: Activity, date: string, start: string, end: string) { return localTime(a.start) < localTime(`${date}T${end}`) && localTime(a.end) > localTime(`${date}T${start}`) }
export function canManageTask(state: ResearchState, actor: Actor, task: Task) { return canParticipateGroup(state, actor, task.group) && (canLeadGroup(state, actor, task.group) || !task.schoolTaskId && task.createdBy === actor.staff) }
export function mediaValid(file: MediaFile) { return MEDIA_TYPES.includes(file.mime) && file.size > 0 && file.size <= 2 * 1024 * 1024 && file.name.length <= 255 && file.data.startsWith(`data:${file.mime};base64,`) && /^[A-Za-z0-9+/]*={0,2}$/.test(file.data.split(",")[1] ?? "") && file.data.length <= 2800000 }
export function referencesFor(state: ResearchState, actor: Actor, refs: { documentId: string; version: number; snapshot?: Document }[]) { return refs.map(ref => { const current = state.documents.find(d => d.id === ref.documentId); const source = state.revisions[`${ref.documentId}@${ref.version}`] ?? (current?.version === ref.version ? current : null); need(current && source && canReadDocument(state, actor, current) && !current.restricted && current.copyPolicy === "retain" && source.items.every(i => canRetainItem(state, actor, i, source.owner)), "引用资料的读取或保留权限已变化，请重新核对。"); return { documentId: source.id, version: source.version, snapshot: { ...structuredClone(source), files: [] } } }) }
export function applyWorkspaceCommand(state: ResearchState, actor: Actor, command: WorkspaceCommand, _catalog: CatalogState): ResearchState {
  const next = { ...state }
  switch (command.type) {
    case "journal": {
      const j = command.journal, old = state.journals?.find(journal => journal.id === j.id)
      need(canParticipateGroup(state, actor, j.group), "只有本组当前有效成员可记录教研日志。")
      need(!old || old.group === j.group && old.author === actor.staff && old.version === j.version, "只能编辑本人日志，且须使用当前版本。")
      need(!j.course || _catalog.courses.some(c => c.code === j.course && _catalog.settings[c.code]?.active && _catalog.settings[c.code]?.groupIds.includes(j.group)),"日志课程不在本组责任范围。")
      need(validDate(j.date) && j.date <= actor.date && j.title.trim() && j.body.trim(), "填写有效且已经发生的日期、日志名称和实际教研内容。")
      need(!j.taskId || state.tasks.some(t => t.id === j.taskId && t.group === j.group), "日志关联任务不属于本组。")
      need(!j.activityId || state.activities.some(a => a.id === j.activityId && a.group === j.group), "日志关联活动不属于本组。")
      const references = j.references.map(ref => old?.references.find(r => r.documentId === ref.documentId && r.version === ref.version) ?? referencesFor(state, actor, [ref])[0])
      const saved = { ...j, author: actor.staff, references, version: old ? old.version + 1 : 1 }
      next.journals = old ? state.journals!.map(item => item.id === j.id ? saved : item) : [...(state.journals ?? []), saved]; break
    }
    case "chat": {
      const m = command.message
      need(canParticipateGroup(state, actor, m.group), "只有本组当前有效成员可以发送群组消息。")
      need(!state.messages?.some(item => item.id === m.id), "消息已保存，不能重复发送。")
      need(m.body.length <= 6000 && (m.body.trim() || m.files.length || m.references.length || MEMES[m.meme]), "请输入消息或添加表情包、文件、资料。")
      need(!m.meme || MEMES[m.meme], "表情包无效。")
      need(m.files.length <= 3 && m.files.every(mediaValid) && m.files.reduce((n, f) => n + f.size, 0) <= 3 * 1024 * 1024, "附件最多 3 个、单个 2 MB、合计 3 MB，仅支持图片与文档。")
      need(m.references.length <= 5, "每条消息最多引用 5 份资料。")
      need(!m.replyTo || state.messages?.some(item => item.id === m.replyTo && item.group === m.group && !item.withdrawn), "回复来源已撤回或不属于本组。")
      next.forms = { ...state.forms }; delete next.forms[`${actor.staff}|chat:${m.group}`];
      next.messages = [...(state.messages ?? []), { ...m, author: actor.staff,at: new Date().toISOString(),mentions: m.mentions.filter(id => state.staffDuties.some(d => d.staffId === id && d.start <= actor.date && (!d.end || d.end >= actor.date) && d.scopeRefs.some(ref => ref.id === m.group))),body: m.body.trim(), references: referencesFor(state, actor, m.references), reactions: {}, withdrawn: false }]; break
    }
    case "withdraw-chat": {
      const m = state.messages?.find(item => item.id === command.id)
      need(m && !m.withdrawn && m.author === actor.staff && canParticipateGroup(state, actor, m.group), "只能撤回本人在有效科组中发送的消息。")
      next.messages = state.messages!.map(item => item.id === m.id ? { ...m, withdrawn: true, body: "", files: [], references: [], reactions: {}, mentions: [], meme: "" } : item); break
    }
    case "react-chat": {
      const m = state.messages?.find(item => item.id === command.id)
      need(m && !m.withdrawn && canParticipateGroup(state, actor, m.group) && EMOJIS.includes(command.emoji), "不能回应这条消息。")
      const people = m.reactions[command.emoji] ?? []
      next.messages = state.messages!.map(item => item.id === m.id ? { ...m, reactions: { ...m.reactions, [command.emoji]: people.includes(actor.staff) ? people.filter(id => id !== actor.staff) : [...people, actor.staff] } } : item); break
    }
    case "favorite-document": {
      const d = state.documents.find(item => item.id === command.id); need(d && canReadDocument(state, actor, d), "当前无法收藏这份资料。")
      const ids = state.favorites?.[actor.staff] ?? []; next.favorites = { ...state.favorites, [actor.staff]: ids.includes(d.id) ? ids.filter(id => id !== d.id) : [...ids, d.id] }; break
    }
    case "group-profile": need(schoolScopes(state, actor, true).includes(command.group), "公共科组信息需要本组的学校统筹授权。"); next.groupProfiles = { ...state.groupProfiles, [command.group]: command.profile }; break
    case "return-task": {
      const t = state.tasks.find(item => item.id === command.id); need(t && t.schoolTaskId && t.acceptance && t.status === "待验收" && schoolScopes(state, actor, true).includes(t.group) && command.note.trim(), "只有待验收的正式提交可以由获授权学校人员退回调整。"); next.tasks = state.tasks.map(item => item.id === t.id ? { ...t, status: "进行中", returnedNote: command.note } : item); break
    }
    case "basket": need(command.ids.length <= 500 && command.ids.every(id=>!!resolveSelection(state,actor,id)),"所选内容已失效或无法用于个人组卷。"); next.baskets = { ...state.baskets, [actor.staff]: [...new Set(command.ids)] }; break
    default: throw new Error("此操作已停用，人员职责请在教职工管理中维护。")
  }
  return next
}
