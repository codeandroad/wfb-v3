import { activeAt, canEditDocument, canEditGroup, canLeadGroup, canReadActivity, canReadDocument, canViewGroup, copyDocument, coursesFor, groups, itemReadable, membership, schoolScopes, scopeValid, validateDocument, type Actor, type Activity, type Appointment, type CatalogState, type Criterion, type Discussion, type Document, type Notice, type Outcome, type ResearchState, type SchoolTask, type SupportIssue, type Task } from "./model"

export type Command =
  | { type: "form-draft"; key: string; value: unknown }
  | { type: "create-document"; document: Document }
  | { type: "draft-document"; document: Document; baseVersion: number }
  | { type: "save-document"; document: Document; baseVersion: number }
  | { type: "copy-document"; id: string; sourceId: string; kind?: Document["kind"]; itemIds?: string[] }
  | { type: "discard-draft"; id: string }
  | { type: "save-task"; task: Task }
  | { type: "accept-task"; id: string; owner: string; collaborators: string[]; submitters: string[]; mode: Task["mode"] }
  | { type: "submit-task"; id: string; outcome: Outcome }
  | { type: "complete-task"; id: string }
  | { type: "review-task"; id: string; note: string }
  | { type: "school-task"; task: SchoolTask; groupTasks: Task[] }
  | { type: "save-activity"; activity: Activity }
  | { type: "respond-activity"; id: string; response: "参加" | "无法参加" }
  | { type: "attend-activity"; id: string; staff: string; status: "到场" | "未到场" }
  | { type: "trial-activity"; id: string; trial: string; decision: string }
  | { type: "discussion"; discussion: Discussion }
  | { type: "notice"; notice: Notice }
  | { type: "ack-notice"; id: string }
  | { type: "support"; issue: SupportIssue }
  | { type: "respond-support"; id: string; response: string }
  | { type: "criterion"; criterion: Criterion }
  | { type: "appointment"; appointment: Appointment }

function requireCondition(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message) }
export function applyResearchCommand(state: ResearchState, actor: Actor, command: Command, catalog: CatalogState, accountEnabled: (staff: string) => boolean = () => true): ResearchState {
  requireCondition(actor.enabled,"当前账号不能操作教研资料。")
  const next = { ...state }
  const members = (group: string) => new Set(state.appointments.filter(a => a.group === group && activeAt(a.start,a.end,actor.date)).map(a => a.staff))
  switch (command.type) {
    case "form-draft": next.forms = { ...state.forms, [`${actor.staff}|${command.key}`]: command.value }; break
    case "create-document": {
      const d = command.document
      requireCondition(d.owner === actor.staff || canEditGroup(state,actor,d.owner),"学校查看授权不包含组内编辑权。")
      requireCondition(!state.documents.some(x => x.id === d.id),"内容已存在，请勿重复创建。")
      requireCondition(d.author === actor.staff && (d.owner === actor.staff || coursesFor(catalog,d.owner).some(c => c.code === d.course)),"组内资料只能关联本组负责的有效课程。")
      requireCondition(scopeValid(d,catalog),"课程／单元关联无效；整科范围不需要默认单元。")
      validateDocument(d)
      next.documents = [...state.documents,structuredClone(d)]
      next.revisions = { ...state.revisions, [`${d.id}@${d.version}`]: structuredClone(d) }
      break
    }
    case "draft-document": {
      const saved = state.documents.find(d => d.id === command.document.id)
      requireCondition(saved && canEditDocument(state,actor,saved),"当前没有修订权限，草稿未写入。")
      requireCondition(command.document.owner === saved.owner && command.document.course === saved.course,"不能在编辑中改变归属或课程标识。")
      next.drafts = { ...state.drafts, [`${actor.staff}|${saved.id}`]: { document: structuredClone(command.document), baseVersion: command.baseVersion, savedAt: new Date().toISOString() } }
      break
    }
    case "save-document": {
      const saved = state.documents.find(d => d.id === command.document.id)
      const d = command.document
      requireCondition(saved && canEditDocument(state,actor,saved),"当前没有修订权限。")
      requireCondition(saved.version === command.baseVersion,"来源已有新修订，请先核对；你的草稿已保留，不会覆盖他人的内容。")
      requireCondition(d.owner === saved.owner && d.course === saved.course,"归属与课程不能通过修订变更。")
      requireCondition(scopeValid(d,catalog),"请选择该课程的真实单元；整科范围不含默认单元。")
      requireCondition(d.items.every(i => i.unitIds.every(id => catalog.units.some(u => u.code === id && u.courseCode === d.course))),"项目含其他课程的同名单元，不能保存。")
      for (const i of d.items) requireCondition(!itemReadable(state,actor,i,d.owner) ? JSON.stringify(i) === JSON.stringify(saved.items.find(x => x.id === i.id)) : true,"无权改写受限引用内容。")
      if (d.share.audience !== saved.share.audience || JSON.stringify(d.share) !== JSON.stringify(saved.share)) {
        requireCondition(d.owner === actor.staff || canLeadGroup(state,actor,d.owner),"组内共享范围由当前有效组长维护。")
        requireCondition(!d.restricted || JSON.stringify(d.share) === JSON.stringify(saved.share),"受限答案／未公开试卷不能通过编辑解除限制。")
        requireCondition(d.items.every(i => i.references.every(ref => { const source = state.documents.find(x => x.id === ref.documentId); return source && !source.restricted && (d.share.audience === "owner" || source.share.audience === "school" || d.share.audience === "group" && source.owner === d.owner || d.share.audience === "specified" && source.share.audience === "specified" && d.share.staff.every(id => source.share.staff.includes(id)) && d.share.groups.every(id => source.share.groups.includes(id))) })),"共享会扩大受限来源的可见范围，请先取得来源授权或移除该引用。")
      }
      validateDocument(d)
      const updated = { ...structuredClone(d), version: saved.version+1 }
      next.documents = state.documents.map(x => x.id === d.id ? updated : x)
      next.revisions = { ...state.revisions, [`${saved.id}@${saved.version}`]: structuredClone(saved), [`${d.id}@${updated.version}`]: structuredClone(updated) }
      next.drafts = { ...state.drafts }; delete next.drafts[`${actor.staff}|${d.id}`]
      break
    }
    case "discard-draft": next.drafts = { ...state.drafts }; delete next.drafts[`${actor.staff}|${command.id}`]; break
    case "copy-document": {
      const source = state.documents.find(d => d.id === command.sourceId)
      requireCondition(source,"来源不存在。")
      const d = copyDocument(state,actor,source,command.id,command.kind,command.itemIds)
      return applyResearchCommand(state,actor,{ type: "create-document", document: d },catalog,accountEnabled)
    }
    case "save-task": {
      const t = command.task; const prev = state.tasks.find(x => x.id === t.id)
      requireCondition(canEditGroup(state,actor,t.group) && (!prev || prev.owner === actor.staff || canLeadGroup(state,actor,t.group)),"无权维护该事项分工。")
      requireCondition(!prev || prev.group === t.group && prev.schoolTaskId === t.schoolTaskId && prev.parent === t.parent,"不能改变任务来源关系。")
      requireCondition(t.title.trim(),"请填写任务名称。")
      requireCondition(!t.schoolTaskId || state.schoolTasks.some(s => s.id === t.schoolTaskId && s.groups.includes(t.group)),"学校任务来源无效。")
      requireCondition(!t.parent || state.tasks.some(p => p.id === t.parent && p.group === t.group && p.schoolTaskId === t.schoolTaskId),"分工须关联本组同一事项。")
      requireCondition(!t.course || coursesFor(catalog,t.group).some(c => c.code === t.course),"课程不在本组有效责任范围。")
      requireCondition([t.owner,...t.collaborators,...t.submitters].filter(Boolean).every(id => members(t.group).has(id)),"负责人、协作者和提交人须是当前有效成员。")
      requireCondition(t.mode !== "成员各自提交" || t.submitters.length > 0,"各自提交模式需要明确指定提交人。")
      next.tasks = prev ? state.tasks.map(x => x.id === t.id ? { ...t, outcomes: prev.outcomes, status: prev.status } : x) : [...state.tasks,t]
      break
    }
    case "accept-task": {
      const t = state.tasks.find(x => x.id === command.id)
      requireCondition(t && t.status === "待承接" && canLeadGroup(state,actor,t.group),"只有当前有效组长可以承接待承接事项。")
      const updated: Task = { ...t, owner: command.owner, collaborators: command.collaborators, submitters: command.submitters, mode: command.mode, status: "进行中" }
      requireCondition(updated.owner && [updated.owner,...updated.collaborators,...updated.submitters].every(id => members(t.group).has(id)),"请核对有效负责人及分工。")
      requireCondition(updated.mode !== "成员各自提交" || updated.submitters.length > 0,"请明确指定独立提交人。")
      next.tasks = state.tasks.map(x => x.id === t.id ? updated : x)
      break
    }
    case "submit-task": {
      const t = state.tasks.find(x => x.id === command.id)
      requireCondition(t && canEditGroup(state,actor,t.group) && t.status === "进行中","任务尚未承接或已提交。")
      requireCondition(t.mode === "牵头提交" ? t.owner === actor.staff : t.submitters.includes(actor.staff),"协作人不自动成为独立提交人。")
      const request = command.outcome; let outcome: Outcome
      if (request.kind === "document") {
        const d = state.documents.find(x => x.id === request.entityId)
        requireCondition(d && d.version === request.version && canReadDocument(state,actor,d) && !d.restricted && d.copyPolicy === "retain" && d.items.every(i => itemReadable(state,actor,i,d.owner)),"成果来源不可用、已更新或包含受限内容，请重新核对。")
        const snapshot = { ...structuredClone(d), files: [] }
        outcome = { ...request, title: d.title, document: snapshot, submittedBy: actor.staff, submittedAt: actor.date }
      } else {
        const a = state.activities.find(x => x.id === request.entityId)
        requireCondition(a && a.group === t.group && canReadActivity(state,actor,a) && a.version === request.version,"活动成果不在本组范围或已有更新。")
        outcome = { ...request, title: a.title, activity: structuredClone(a), submittedBy: actor.staff, submittedAt: actor.date }
      }
      const outcomes = [...t.outcomes.filter(o => o.submittedBy !== actor.staff),outcome]
      const complete = t.mode === "牵头提交" || t.submitters.every(id => outcomes.some(o => o.submittedBy === id))
      const status = !complete ? "进行中" : t.acceptance ? "待验收" : t.schoolTaskId ? "已提交" : "已完成"
      next.tasks = state.tasks.map(x => x.id === t.id ? { ...t,outcomes,status } : x)
      break
    }
    case "complete-task": {
      const t = state.tasks.find(x => x.id === command.id)
      requireCondition(t && canEditGroup(state,actor,t.group) && t.owner === actor.staff && !t.schoolTaskId && !t.requirements.trim() && t.mode === "牵头提交","学校任务或有明确交付要求的事项须引用成果；普通无交付事项可直接完成。")
      next.tasks = state.tasks.map(x => x.id === t.id ? { ...t,status: t.acceptance ? "待验收" : "已完成" } : x)
      break
    }
    case "review-task": {
      const t = state.tasks.find(x => x.id === command.id)
      requireCondition(t && t.acceptance && t.status === "待验收" && (t.schoolTaskId ? schoolScopes(state,actor,true).includes(t.group) : canLeadGroup(state,actor,t.group)),"此事项无需验收、尚未提交或没有验收权限。")
      next.tasks = state.tasks.map(x => x.id === t.id ? { ...t,status: "已完成",acceptedNote: command.note } : x)
      break
    }
    case "school-task": {
      const t = command.task
      requireCondition(t.title.trim() && t.groups.length && t.groups.every(g => schoolScopes(state,actor,true).includes(g)),"只能向获授权统筹的科组下发任务。")
      requireCondition(command.groupTasks.length === t.groups.length && command.groupTasks.every(g => g.schoolTaskId === t.id && t.groups.includes(g.group)),"各组承接来源不一致。")
      next.schoolTasks = [...state.schoolTasks,{ ...t,createdBy: actor.staff }]; next.tasks = [...state.tasks,...command.groupTasks]
      break
    }
    case "save-activity": {
      const a = command.activity; const prev = state.activities.find(x => x.id === a.id)
      requireCondition(canEditGroup(state,actor,a.group) && (!prev || prev.owner === actor.staff || canLeadGroup(state,actor,a.group)),"只能维护本人负责或组长有权管理的活动。")
      requireCondition(a.title.trim() && a.start && a.end && a.start < a.end,"请填写主题及正确活动时间。")
      requireCondition(a.type === "示范课" ? a.lesson !== null : a.lesson === null,"真实示范课须关联既有课次；其他活动不得生成课堂事实。")
      requireCondition(!a.course || coursesFor(catalog,a.group).some(c => c.code === a.course),"活动课程不属于本组。")
      requireCondition(!a.taskId || state.tasks.some(t => t.id === a.taskId && t.group === a.group),"活动只能关联本组事项。")
      requireCondition(a.materials.every(ref => { const d = state.documents.find(x => x.id === ref.documentId); return d && canReadDocument(state,actor,d) && d.version === ref.version }),"材料没有当前读取权限或已更新。")
      next.activities = prev ? state.activities.map(x => x.id === a.id ? { ...a,version: prev.version+1 } : x) : [...state.activities,a]
      break
    }
    case "respond-activity": {
      const a = state.activities.find(x => x.id === command.id)
      requireCondition(a && a.participants.includes(actor.staff) && canReadActivity(state,actor,a),"不在本次活动的邀请范围。")
      next.activities = state.activities.map(x => x.id === a.id ? { ...a,responses: { ...a.responses,[actor.staff]: command.response } } : x); break
    }
    case "attend-activity": {
      const a = state.activities.find(x => x.id === command.id)
      requireCondition(a && (a.owner === actor.staff || canLeadGroup(state,actor,a.group)) && a.participants.includes(command.staff) && a.start.slice(0,10) <= actor.date,"活动尚未发生或无权核对到场。")
      next.activities = state.activities.map(x => x.id === a.id ? { ...a,attendance: { ...a.attendance,[command.staff]: command.status } } : x); break
    }
    case "trial-activity": {
      const a = state.activities.find(x => x.id === command.id)
      requireCondition(a && a.type === "评分校准" && a.participants.includes(actor.staff) && a.trials.some(t => t.id === command.trial),"只能对本人受邀的校准活动示例试评。")
      next.activities = state.activities.map(x => x.id === a.id ? { ...a,trials: a.trials.map(t => t.id === command.trial ? { ...t,decisions: { ...t.decisions,[actor.staff]: command.decision } } : t) } : x); break
    }
    case "discussion": {
      const d = command.discussion; const [kind,id] = d.target.split(":")
      const target = kind === "task" ? state.tasks.find(t => t.id === id) : kind === "activity" ? state.activities.find(a => a.id === id) : state.documents.find(x => x.id === id)
      requireCondition(target && (kind === "task" ? canEditGroup(state,actor,(target as Task).group) : kind === "activity" ? canReadActivity(state,actor,target as Activity) : canReadDocument(state,actor,target as Document)),"讨论对象不在授权范围。")
      requireCondition(d.body.trim() && d.body.length <= 3000,"讨论内容须为 1–3000 字。")
      next.discussions = [...state.discussions,{ ...d,author: actor.staff }]; break
    }
    case "notice": {
      const n = command.notice
      requireCondition(canLeadGroup(state,actor,n.group) && n.title.trim() && n.body.trim(),"只有有效组长可以发布本组通知。")
      requireCondition(n.recipients.every(id => members(n.group).has(id)),"通知接收人须在本组有效成员范围。")
      next.notices = [...state.notices,{ ...n,recipients: n.recipients.filter(accountEnabled),acknowledged: [],author: actor.staff }]; break
    }
    case "ack-notice": {
      const n = state.notices.find(x => x.id === command.id)
      requireCondition(n && n.requiresAck && n.recipients.includes(actor.staff) && canEditGroup(state,actor,n.group),"此通知无需确认或不在接收范围。")
      next.notices = state.notices.map(x => x.id === n.id ? { ...n,acknowledged: [...new Set([...n.acknowledged,actor.staff])] } : x); break
    }
    case "support": requireCondition(canEditGroup(state,actor,command.issue.group),"无权提出本组协调事项。"); next.issues = [...state.issues,{ ...command.issue,author: actor.staff }]; break
    case "respond-support": {
      const i = state.issues.find(x => x.id === command.id); requireCondition(i && schoolScopes(state,actor,true).includes(i.group),"没有该组学校协调权限。")
      next.issues = state.issues.map(x => x.id === i.id ? { ...i,response: command.response,status: "已回复" } : x); break
    }
    case "criterion": {
      const c = command.criterion; const prev = state.criteria.find(x => x.id === c.id)
      requireCondition(canEditGroup(state,actor,c.group) && c.title.trim(),"无权维护评价依据或名称为空。")
      requireCondition(c.levels.every(l => l.code !== "A" || l.label === "优秀"),"A 沿用既有“优秀”语义，不是 GPA。")
      requireCondition(c.thresholds.every(t => Number.isFinite(t.minimum) && t.minimum >= 0 && c.levels.some(l => l.code === t.code)),"换算需使用有效分数及现有等级字典。")
      next.criteria = prev ? state.criteria.map(x => x.id === c.id ? { ...c,version: prev.version+1 } : x) : [...state.criteria,c]; break
    }
    case "appointment": {
      const a = command.appointment
      requireCondition(schoolScopes(state,actor,true).includes(a.group),"组内分工不授予正式任命权，请使用学校人员任命流程。")
      requireCondition(a.start && (!a.end || a.end >= a.start),"任期日期无效。")
      const prev = state.appointments.find(x => x.id === a.id)
      requireCondition(!prev || prev.staff === a.staff && prev.group === a.group,"任命对象不可通过修订变更。")
      requireCondition(a.role !== "组长" || !state.appointments.some(x => x.id !== a.id && x.group === a.group && x.role === "组长" && (!x.end || x.end >= a.start) && (!a.end || a.end >= x.start)),"该任期与已有组长重叠，请先结束原任命。")
      next.appointments = prev ? state.appointments.map(x => x.id === a.id ? a : x) : [...state.appointments,a]; break
    }
  }
  return next
}
