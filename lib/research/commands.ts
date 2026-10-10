import { lessonsOfWeek, taskById, weekOfDate } from "@/lib/mt/model"
import { PERIODS } from "@/lib/timetable/data"
import { canEditDocument, canEditGroup, canParticipateGroup, canLeadGroup, canReadActivity, canReadCriterion, canReadDocument, canRetainItem, copyDocument, courseTaskMap, coursesFor, groupDuties, itemReadable, schoolScopes, scopeValid, validateCriterion, validateDocument, type Actor, type Activity, type CatalogState, type Criterion, type Discussion, type Document, type Notice, type Outcome, type ResearchState, type SchoolTask, type SupportIssue, type Task } from "./model"

export type Command =
  | { type: "save-group-slot"; slot: import("./model").GroupScheduleSlot }
  | { type: "delete-group-slot"; id: string }
  | { type: "form-draft"; key: string; value: unknown }
  | { type: "create-document"; document: Document }
  | { type: "draft-document"; document: Document; baseVersion: number }
  | { type: "save-document"; document: Document; baseVersion: number }
  | { type: "copy-document"; id: string; sourceId: string; sourceVersion?: number; kind?: Document["kind"]; itemIds?: string[]; period?: number | null }
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

function requireCondition(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message) }
export function applyResearchCommand(state: ResearchState, actor: Actor, command: Command, catalog: CatalogState, accountEnabled: (staff: string) => boolean = () => true): ResearchState {
  requireCondition(actor.enabled,"当前账号不能操作教研资料。")
  const next = { ...state }
  const members = (group: string) => new Set(groupDuties(state, group, actor.date).map(duty => duty.staffId))
  switch (command.type) {
    case "save-group-slot": {
      const slot = command.slot
      const current = state.groupSchedules ?? []
      const existing = current.find(s => s.id === slot.id)
      requireCondition(canLeadGroup(state, actor, slot.group), "只有当前有效教研组长可以修改本组课表。")
      requireCondition(!existing || existing.group === slot.group, "不能改变课卡所属科组。")
      requireCondition(state.groups.some(g => g.id === slot.group && g.active) && slot.id && slot.title.trim() && slot.title.length <= 120, "请填写有效科组与教研名称。")
      requireCondition(Number.isInteger(slot.weekday) && slot.weekday >= 1 && slot.weekday <= 7 && PERIODS.some(p => p.id === slot.periodId), "请选择有效星期和节次。")
      requireCondition(!current.some(s => s.id !== slot.id && s.group === slot.group && s.weekday === slot.weekday && s.periodId === slot.periodId), "该位置已有本组教研安排，不会覆盖原课卡。")
      next.groupSchedules = [...current.filter(s => s.id !== slot.id), { ...slot, title: slot.title.trim(), room: slot.room?.trim() || null }]
      break
    }
    case "delete-group-slot": {
      const slot = state.groupSchedules?.find(s => s.id === command.id)
      requireCondition(slot && canLeadGroup(state, actor, slot.group), "只有当前有效教研组长可以删除本组课卡。")
      next.groupSchedules = state.groupSchedules!.filter(s => s.id !== slot.id)
      break
    }
    case "form-draft": next.forms = { ...state.forms, [`${actor.staff}|${command.key}`]: command.value }; break
    case "create-document": {
      const d = command.document
      requireCondition(d.owner === actor.staff || canEditGroup(state,actor,d.owner),"组内公共资料由教研组长维护；参与教师可建立本人资料，学校查看与统筹职责不包含组内编辑权。")
      requireCondition(!state.documents.some(x => x.id === d.id),"内容已存在，请勿重复创建。")
      requireCondition(d.author === actor.staff && (d.owner === actor.staff || coursesFor(catalog,d.owner).some(c => c.code === d.course)),"组内资料只能关联本组负责的有效课程。")
      requireCondition(scopeValid(d,catalog),"课程／单元关联无效；整科范围不需要默认单元。")
      requireCondition(d.items.every(i => i.unitIds.every(id => catalog.units.some(u => u.code === id && u.courseCode === d.course))),"项目含其他课程的同名单元，不能保存。")
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
        requireCondition(d.items.every(i => i.references.every(ref => { const source = state.documents.find(x => x.id === ref.documentId); return source && !source.restricted && (d.share.audience === "owner" || source.share.audience === "school" || d.share.audience === "group" && source.owner === d.owner || d.share.audience === "specified" && source.share.audience === "specified" && d.share.staff.every(id => source.share.staff.includes(id)) && d.share.groups.every(id => source.share.groups.includes(id))) })),"共享会扩大受限�����源的可见范围，请先取得来源授权或移除该引用。")
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
      const current = state.documents.find(d => d.id === command.sourceId)
      requireCondition(current && canReadDocument(state,actor,current),"来源不存在或当前无权读取。")
      const source = command.sourceVersion ? state.revisions[`${current.id}@${command.sourceVersion}`] : current
      requireCondition(source,"指定来源版本不存在，不回退到新版本。")
      const d = copyDocument(state,actor,{ ...source,share: current.share,restricted: current.restricted,copyPolicy: current.copyPolicy },command.id,command.kind,command.itemIds)
      if (d.kind === "计划" && d.period === null && command.period !== undefined) d.period = command.period
      return applyResearchCommand(state,actor,{ type: "create-document", document: d },catalog,accountEnabled)
    }
    case "save-task": {
      const t = command.task; const prev = state.tasks.find(x => x.id === t.id)
      requireCondition(canLeadGroup(state,actor,t.group),"无权维护该事项分工；只有当前有效教研组长可以调整组内分工。")
      requireCondition(!prev || prev.group === t.group && prev.schoolTaskId === t.schoolTaskId && prev.parent === t.parent,"不能改变任务来源关系。")
      if (t.scheduleDate || prev?.scheduleDate) {
        requireCondition(canLeadGroup(state,actor,t.group), "只有当前有效教研组长可以维护日卡教研事项。")
        requireCondition(!!t.scheduleDate && /^\d{4}-\d{2}-\d{2}$/.test(t.scheduleDate) && Number.isFinite(Date.parse(`${t.scheduleDate}T00:00:00Z`)) && new Date(`${t.scheduleDate}T00:00:00Z`).toISOString().slice(0,10) === t.scheduleDate, "请选择有效事项安排日期。")
      }
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
      requireCondition(t && canParticipateGroup(state,actor,t.group) && t.status === "进行中","任务未承接、已提交或当前没有本组参与职责。")
      requireCondition(t.mode === "牵头提交" ? t.owner === actor.staff : t.submitters.includes(actor.staff),"协作人不自动成为独立提交人。")
      const request = command.outcome; let outcome: Outcome
      if (request.kind === "document") {
        const d = state.documents.find(x => x.id === request.entityId)
        requireCondition(d && d.version === request.version && canReadDocument(state,actor,d) && !d.restricted && d.copyPolicy === "retain" && d.items.every(i => canRetainItem(state,actor,i,d.owner)),"成果来源不可用、已更新或包含不能转交的受限内容，请重新核对。")
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
      requireCondition(t && t.status === "进行中" && canParticipateGroup(state,actor,t.group) && t.owner === actor.staff && !t.schoolTaskId && !t.requirements.trim() && t.mode === "牵头提交","学校任务或有明确交付要求的事项��引用成果；普通无交付事项可直接完成。")
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
      requireCondition(t.title.trim() && t.groups.length && new Set(t.groups).size === t.groups.length && t.groups.every(g => schoolScopes(state,actor,true).includes(g)),"只能向获授权统筹的科组下发任务。")
      requireCondition(!state.schoolTasks.some(s => s.id === t.id),"学校事项已存在，不能重复下发。")
      requireCondition(command.groupTasks.length === t.groups.length && new Set(command.groupTasks.map(g => g.group)).size === t.groups.length && new Set(command.groupTasks.map(g => g.id)).size === t.groups.length && command.groupTasks.every(g => g.schoolTaskId === t.id && t.groups.includes(g.group) && !g.parent && !state.tasks.some(x => x.id === g.id) && g.status === "待承接" && !g.outcomes.length && g.acceptance === t.acceptance && g.requirements === t.requirements && g.due === t.due),"各组承接来源或交付要求不一致。")
      next.schoolTasks = [...state.schoolTasks,{ ...t,createdBy: actor.staff }]; next.tasks = [...state.tasks,...command.groupTasks]
      break
    }
    case "save-activity": {
      const a = command.activity; const prev = state.activities.find(x => x.id === a.id)
      requireCondition(canLeadGroup(state,actor,a.group) || !!prev && canParticipateGroup(state,actor,a.group) && prev.owner === actor.staff,"只有组长可以安排本组活动；参与教师只能修订本人已有的活动。")
      requireCondition(!prev || prev.group === a.group && prev.owner === a.owner && prev.version === a.version,"活动归属不可变，已有修订时请重新核对。")
      requireCondition(prev || a.owner === actor.staff,"新活动负责人须为本人。")
      requireCondition(a.title.trim() && Number.isFinite(Date.parse(a.start)) && Number.isFinite(Date.parse(a.end)) && a.start < a.end,"请填写主题及正确活动时间。")
      requireCondition(a.participants.length > 0 && new Set(a.participants).size === a.participants.length,"请核对明确邀请的参与者。")
      requireCondition(a.type === "示范课" ? a.lesson !== null : a.lesson === null,"真实示范课须关联既有课次；其他活动不得生成课堂事实。")
      if (a.lesson) {
        const linked = lessonsOfWeek("BASE",weekOfDate(a.lesson.date),[a.lesson.taskId]).find(l => l.id === a.lesson!.lessonId)
        const task = taskById(a.lesson.taskId)
        requireCondition(linked && task && linked.actual_date === a.lesson.date && linked.period.number === a.lesson.period && courseTaskMap[a.course] === task.course_id && a.start === `${linked.actual_date}T${linked.period.start}` && a.end === `${linked.actual_date}T${linked.period.end}` && a.lesson.room === linked.room,"关联课次不存在、已调整或不属所选课程。请重新核对已有课表，不会另造课次或修改上课时间。")
      }
      requireCondition(!a.course || coursesFor(catalog,a.group).some(c => c.code === a.course),"活动课程不属于本组。")
      requireCondition(!a.taskId || state.tasks.some(t => t.id === a.taskId && t.group === a.group),"活动只能关联本组事项。")
      requireCondition(a.materials.every(ref => { const d = state.documents.find(x => x.id === ref.documentId); return d && canReadDocument(state,actor,d) && d.version === ref.version }),"材料没有当前读取权限或已更新。")
      const criterion = a.criterionId ? state.criteria.find(c => c.id === a.criterionId) : null
      requireCondition(!a.criterionId || a.type === "评分校准" && criterion && criterion.group === a.group && canReadCriterion(state,actor,criterion),"校准依据不在可读取的本组范围。")
      requireCondition(a.type !== "评分校准" || criterion && a.trials.length > 0,"评分校准须明确关联依据和少量匿名示例。")
      const updated: Activity = { ...a,responses: prev?.responses ?? {},attendance: prev?.attendance ?? {},version: prev ? prev.version+1 : 1,...(criterion ? { criterionVersion: criterion.version,criterionSnapshot: structuredClone(criterion) } : { criterionVersion: undefined,criterionSnapshot: undefined }) }
      next.activities = prev ? state.activities.map(x => x.id === a.id ? updated : x) : [...state.activities,updated]
      break
    }
    case "respond-activity": {
      const a = state.activities.find(x => x.id === command.id)
      requireCondition(a && a.participants.includes(actor.staff) && canReadActivity(state,actor,a),"不在本次活动的邀请范围。")
      next.activities = state.activities.map(x => x.id === a.id ? { ...a,responses: { ...a.responses,[actor.staff]: command.response } } : x); break
    }
    case "attend-activity": {
      const a = state.activities.find(x => x.id === command.id)
      requireCondition(a && canParticipateGroup(state,actor,a.group) && (a.owner === actor.staff || canLeadGroup(state,actor,a.group)) && a.participants.includes(command.staff) && a.start.slice(0,10) <= actor.date,"活动尚未发生或无权核对到场。")
      next.activities = state.activities.map(x => x.id === a.id ? { ...a,attendance: { ...a.attendance,[command.staff]: command.status } } : x); break
    }
    case "trial-activity": {
      const a = state.activities.find(x => x.id === command.id)
      requireCondition(a && a.type === "评分校准" && a.participants.includes(actor.staff) && a.trials.some(t => t.id === command.trial),"只能对本人受邀的校准活动示例试评。")
      requireCondition(command.decision.trim() && command.decision.length <= 3000,"请填写 1–3000 字的真实试评与分歧说明。")
      next.activities = state.activities.map(x => x.id === a.id ? { ...a,trials: a.trials.map(t => t.id === command.trial ? { ...t,decisions: { ...t.decisions,[actor.staff]: command.decision } } : t) } : x); break
    }
    case "discussion": {
      const d = command.discussion; const [kind,id] = d.target.split(":")
      const target = kind === "task" ? state.tasks.find(t => t.id === id) : kind === "activity" ? state.activities.find(a => a.id === id) : state.documents.find(x => x.id === id)
      requireCondition(target && (kind === "task" ? canParticipateGroup(state,actor,(target as Task).group) : kind === "activity" ? canReadActivity(state,actor,target as Activity) : canReadDocument(state,actor,target as Document)),"讨论对象不在授权范围。")
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
      requireCondition(n && n.requiresAck && n.recipients.includes(actor.staff) && canParticipateGroup(state,actor,n.group),"此通知无需确认或不在接收范围。")
      next.notices = state.notices.map(x => x.id === n.id ? { ...n,acknowledged: [...new Set([...n.acknowledged,actor.staff])] } : x); break
    }
    case "support": requireCondition(canParticipateGroup(state,actor,command.issue.group) && command.issue.title.trim() && command.issue.body.trim(),"请填写本组协调事项及具体问题。"); requireCondition(!state.issues.some(i => i.id === command.issue.id),"协调事项已提交。"); next.issues = [...state.issues,{ ...command.issue,response: "",status: "待协调",author: actor.staff }]; break
    case "respond-support": {
      const i = state.issues.find(x => x.id === command.id); requireCondition(i && schoolScopes(state,actor,true).includes(i.group),"没有该组学校协调权限。")
      requireCondition(command.response.trim(),"请填写明确的协调回复。")
      next.issues = state.issues.map(x => x.id === i.id ? { ...i,response: command.response,status: "已回复" } : x); break
    }
    case "criterion": {
      const c = command.criterion; const prev = state.criteria.find(x => x.id === c.id)
      requireCondition(canEditGroup(state,actor,c.group) && (!prev || canReadCriterion(state,actor,prev)),"无权维护此评价依据。")
      requireCondition(!prev || c.group === prev.group && c.kind === prev.kind && c.version === prev.version,"依据归属与用途不可变；已有新修订时请重新核对。")
      requireCondition(canReadCriterion(state,actor,c),"关联题目或评分材料没有当前读取权。")
      validateCriterion(c)
      const updated = { ...structuredClone(c),version: prev ? prev.version+1 : 1 }
      next.criteria = prev ? state.criteria.map(x => x.id === c.id ? updated : x) : [...state.criteria,updated]
      next.criterionRevisions = { ...state.criterionRevisions,...(prev ? { [`${prev.id}@${prev.version}`]: structuredClone(prev) } : {}),[`${updated.id}@${updated.version}`]: structuredClone(updated) }
      break
    }
    default: throw new Error("此操作已停用；教研人员与负责对象请通过教职工管理的安排职责维护。")
  }
  return next
}
