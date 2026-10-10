import { DUTY_BY_KEY, type DutyKey, type DutyRecord, type StaffProfile } from "@/lib/demo/staff"
import { RESEARCH_GROUPS, researchGroupName, type ResearchGroup } from "./responsibility-scopes"

export const RESEARCH_DUTY_KEYS = ["research_lead", "research_participate", "research_manage", "research_view"] as const
export type ResearchDutyKey = (typeof RESEARCH_DUTY_KEYS)[number]
export type StaffDutyAssignment = DutyRecord & { staffId: string; type: ResearchDutyKey; scopeRefs: { kind: "research_group"; id: string }[] }
export type StaffDutyState = { schema: 1; assignments: StaffDutyAssignment[]; groups: ResearchGroup[] }
export type DutyActor = { staff: string; date: string; enabled: boolean }
export type StaffDutyCommand =
  | { type: "arrange"; assignments: StaffDutyAssignment[] }
  | { type: "revise" | "end"; assignment: StaffDutyAssignment; expected: StaffDutyAssignment }
  | { type: "save-group"; group: ResearchGroup; expected?: ResearchGroup }

export function isResearchDuty(key: DutyKey): key is ResearchDutyKey {
  return (RESEARCH_DUTY_KEYS as readonly string[]).includes(key)
}

export function dutyDateValid(value: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function dutyStatusAt(duty: DutyRecord, date: string): DutyRecord["status"] {
  if (duty.status === "ended" || duty.end && duty.end < date) return "ended"
  if (duty.start > date) return "pending"
  return duty.status === "paused" ? "paused" : "active"
}

export function dutyEffective(duty: DutyRecord, date: string) {
  return dutyDateValid(date) && dutyStatusAt(duty, date) === "active" && duty.workMode !== "paused"
}

export function sameStaffDuty(a: StaffDutyAssignment, b: StaffDutyAssignment) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function createResearchDuty(id: string, staffId: string, type: ResearchDutyKey, group: string, start: string, end?: string, groups = RESEARCH_GROUPS): StaffDutyAssignment {
  return {
    id, staffId, type, scopeRefs: [{ kind: "research_group", id: group }],
    scopeLabel: researchGroupName(groups, group), scopeSub: "教研负责对象，与人事部门独立",
    status: "active", workMode: type === "research_view" ? "ro" : "rw", start, ...(end ? { end } : {}),
    basis: [{ role: DUTY_BY_KEY[type].role, config: "RESEARCH_DUTY_V1", source: "学校安排职责", assignment: `research_group:${group}` }],
    history: [{ date: start, text: `安排职责 · ${DUTY_BY_KEY[type].label}` }],
  }
}

export function staffDutySeed(): StaffDutyState {
  const assignments = [
    createResearchDuty("app-lin-math", "u-lin", "research_lead", "math", "2026-09-01", "2027-07-31"),
    createResearchDuty("app-lin-physics", "u-lin", "research_participate", "physics", "2026-09-01", "2027-07-31"),
    createResearchDuty("app-chen-physics", "u-chen", "research_lead", "physics", "2026-09-01", "2027-07-31"),
    createResearchDuty("app-zhou-math", "u-zhou", "research_participate", "math", "2026-09-01", "2027-07-31"),
    createResearchDuty("app-wang-math", "u-wang", "research_participate", "math", "2026-09-01", "2027-07-31"),
    createResearchDuty("app-zhou-expired", "u-zhou", "research_participate", "physics", "2025-09-01", "2026-07-31"),
    createResearchDuty("app-zhou-future", "u-zhou", "research_participate", "physics", "2027-09-01", "2028-07-31"),
    createResearchDuty("grant-lin-math", "u-lin", "research_manage", "math", "2026-09-01", "2027-07-31"),
    createResearchDuty("grant-lin-physics", "u-lin", "research_manage", "physics", "2026-09-01", "2027-07-31"),
    createResearchDuty("grant-xu-math", "u-xu", "research_view", "math", "2026-09-01", "2027-07-31"),
  ]
  return { schema: 1, assignments, groups: structuredClone(RESEARCH_GROUPS) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function migrateLegacyResearchDuties(value: unknown): StaffDutyAssignment[] {
  if (!isRecord(value) || !Array.isArray(value.appointments) || !Array.isArray(value.grants)) throw new Error("旧教研职责数据格式不完整，原数据未清空。")
  const appointments = value.appointments.map(item => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.staff !== "string" || typeof item.group !== "string" || !["组长", "成员", "维护者"].includes(String(item.role)) || typeof item.start !== "string" || item.end !== null && typeof item.end !== "string") throw new Error("旧任命记录无法迁移，原数据未清空。")
    const duty = createResearchDuty(item.id, item.staff, item.role === "组长" ? "research_lead" : "research_participate", item.group, item.start, item.end ?? undefined)
    duty.history = [{ date: item.start, text: `旧科组记录迁入安排职责 · 原角色 ${item.role} · 原任期 ${item.start} 至 ${item.end || "未设结束日期"}` }]
    if (item.role === "维护者") duty.note = "原“维护者”记录保留为教研参与教师；公共资料维护须另行安排教研组长职责，不保留隐式编辑权。"
    return duty
  })
  const grants = value.grants.map((item, index) => {
    if (!isRecord(item) || typeof item.staff !== "string" || typeof item.group !== "string" || !["统筹", "查看"].includes(String(item.mode)) || typeof item.start !== "string" || item.end !== null && typeof item.end !== "string") throw new Error("旧学校教研授权无法迁移，原数据未清空。")
    const duty = createResearchDuty(`migrated-grant-${item.staff}-${item.group}-${index}`, item.staff, item.mode === "统筹" ? "research_manage" : "research_view", item.group, item.start, item.end ?? undefined)
    duty.history = [{ date: item.start, text: `旧学校${item.mode}授权迁入职责 · 原任期与负责对象保留` }]
    return duty
  })
  const assignments = [...appointments, ...grants]
  const groups = structuredClone(RESEARCH_GROUPS)
  for (const duty of assignments) for (const ref of duty.scopeRefs) if (!groups.some(group => group.id === ref.id)) groups.push({ id: ref.id, name: duty.scopeLabel, kind: "research_group", department: "教学部", subject: "", active: false })
  return migrateStaffDutyState({ schema: 1, assignments, groups }).assignments
}

function readStaffDutyState(value: unknown): StaffDutyState {
  if (!isRecord(value) || value.schema !== 1 || !Array.isArray(value.assignments) || !Array.isArray(value.groups)) throw new Error("统一职责数据无法读取，原数据未清空。")
  const state = value as unknown as StaffDutyState
  if (state.groups.some(group => !isRecord(group) || typeof group.id !== "string" || !group.id.trim() || typeof group.name !== "string" || !group.name.trim() || group.kind !== "research_group" || group.department !== "教学部" || typeof group.active !== "boolean" || typeof group.subject !== "string") || new Set(state.groups.map(group => group.id)).size !== state.groups.length) throw new Error("负责对象目录格式无效，原数据未清空。")
  if (state.assignments.some(duty => !isRecord(duty) || typeof duty.id !== "string" || !duty.id.trim() || typeof duty.staffId !== "string" || !duty.staffId.trim() || !isResearchDuty(duty.type) || !Array.isArray(duty.scopeRefs) || duty.scopeRefs.length !== 1 || !isRecord(duty.scopeRefs[0]) || duty.scopeRefs[0].kind !== "research_group" || !state.groups.some(group => group.id === duty.scopeRefs[0].id) || !dutyDateValid(duty.start) || duty.end !== undefined && (!dutyDateValid(duty.end) || duty.end < duty.start) || !["active", "pending", "paused", "ended"].includes(duty.status) || !["rw", "ro", "paused"].includes(duty.workMode) || duty.history !== undefined && (!Array.isArray(duty.history) || duty.history.some(item => !isRecord(item) || typeof item.date !== "string" || typeof item.text !== "string"))) || new Set(state.assignments.map(duty => duty.id)).size !== state.assignments.length) throw new Error("职责人员、负责对象或任期格式无效，原数据未清空。")
  return state
}

function dutyOrigin(duty: StaffDutyAssignment) {
  return JSON.stringify([duty.staffId, duty.type, duty.scopeRefs[0].id, duty.start])
}

export function validateStaffDutyState(value: unknown): StaffDutyState {
  const state = readStaffDutyState(value)
  const origins = new Set<string>()
  for (const duty of state.assignments) {
    const origin = dutyOrigin(duty)
    if (origins.has(origin) || duty.status !== "ended" && staffDutyConflicts(state, duty).length) throw new Error(`统一职责记录存在重叠：${DUTY_BY_KEY[duty.type].label} · ${researchGroupName(state.groups, duty.scopeRefs[0].id)}。原数据未清空，不会启用冲突授权。`)
    origins.add(origin)
  }
  return state
}

type DutyInterval = { start: number; end: number }
const DUTY_DAY = 86_400_000
const LAST_DUTY_DAY = Date.parse("9999-12-31T00:00:00Z")
const dutyDay = (date: string) => Date.parse(`${date}T00:00:00Z`)
const dutyDate = (day: number) => new Date(day).toISOString().slice(0, 10)
const dutyInterval = (duty: StaffDutyAssignment): DutyInterval => ({ start: dutyDay(duty.start), end: duty.end ? dutyDay(duty.end) : LAST_DUTY_DAY })

function withoutInterval(intervals: DutyInterval[], occupied: DutyInterval): DutyInterval[] {
  return intervals.flatMap(interval => {
    if (occupied.end < interval.start || occupied.start > interval.end) return [interval]
    const remaining: DutyInterval[] = []
    if (interval.start < occupied.start) remaining.push({ start: interval.start, end: occupied.start - DUTY_DAY })
    if (interval.end > occupied.end) remaining.push({ start: occupied.end + DUTY_DAY, end: interval.end })
    return remaining
  })
}

export function migrateStaffDutyState(value: unknown): StaffDutyState {
  const state = readStaffDutyState(value)
  if (new Set(state.assignments.map(dutyOrigin)).size === state.assignments.length && !state.assignments.some(duty => duty.status !== "ended" && staffDutyConflicts(state, duty).length)) return validateStaffDutyState(state)
  const repairedAt = new Date().toISOString().slice(0, 10)
  const originalOrder = new Map(state.assignments.map((duty, index) => [duty.id, index]))
  const origins = new Map<string, StaffDutyAssignment[]>()
  for (const duty of structuredClone(state.assignments)) {
    const origin = dutyOrigin(duty)
    origins.set(origin, [...(origins.get(origin) ?? []), duty])
  }
  const unique = [...origins.values()].map(records => {
    const first = records[0]
    if (records.length === 1) return first
    const end = records.map(duty => duty.end).filter((date): date is string => !!date).sort()[0]
    const status = records.some(duty => duty.status === "ended") ? "ended" : records.some(duty => duty.status === "paused") ? "paused" : first.status
    const workMode = records.some(duty => duty.workMode === "paused") ? "paused" : records.some(duty => duty.workMode === "ro") ? "ro" : first.workMode
    const history = records.flatMap(duty => duty.history ?? []).filter((item, index, items) => items.findIndex(other => other.date === item.date && other.text === item.text) === index)
    history.push({ date: repairedAt, text: `修正旧职责 · 合并同一人员、模板、对象与开始日期的重复记录 ${records.map(duty => duty.id).join("、")}；保留最早结束日期及原有限制，不恢复已结束或暂停的授权。` })
    return { ...first, end, status, workMode, history }
  })
  unique.sort((a, b) => Number(b.type === "research_lead") - Number(a.type === "research_lead") || a.start.localeCompare(b.start) || originalOrder.get(a.id)! - originalOrder.get(b.id)!)
  const assignments: StaffDutyAssignment[] = []
  for (const duty of unique) {
    if (duty.status === "ended") { assignments.push(duty); continue }
    const matching = assignments.filter(item => item.status !== "ended" && item.staffId === duty.staffId && item.scopeRefs[0].id === duty.scopeRefs[0].id && (item.type === duty.type || ["research_lead", "research_participate"].includes(item.type) && ["research_lead", "research_participate"].includes(duty.type)) && overlaps(item, duty))
    if (!matching.length) { assignments.push(duty); continue }
    const remaining = matching.reduce((intervals, item) => withoutInterval(intervals, dutyInterval(item)), [dutyInterval(duty)])
    const text = `修正旧职责 · ${DUTY_BY_KEY[duty.type].label} 原记录 ${duty.id}（${duty.start} 至 ${duty.end || "未设结束日期"}）去除与 ${matching.map(item => item.id).join("、")} 的重复生效区间；${remaining.length ? "只保留原任期内不重叠的部分" : "不再作为独立生效授权"}，原记录保留在迁移备份。`
    for (const item of matching) item.history = [...(item.history ?? []), ...(duty.history ?? []).map(entry => ({ ...entry, text: `${entry.text} · 原记录 ${duty.id}` })), { date: repairedAt, text }]
    remaining.forEach((interval, index) => {
      const start = dutyDate(interval.start)
      const id = index === 0 ? duty.id : `${duty.id}:remainder:${start}`
      originalOrder.set(id, originalOrder.get(duty.id)!)
      assignments.push({ ...duty, id, start, end: duty.end === undefined && interval.end === LAST_DUTY_DAY ? undefined : dutyDate(interval.end), history: [...(duty.history ?? []), { date: repairedAt, text }] })
    })
  }
  assignments.sort((a, b) => originalOrder.get(a.id)! - originalOrder.get(b.id)! || a.start.localeCompare(b.start))
  return validateStaffDutyState({ ...state, assignments })
}

export function schoolDutyManager(people: StaffProfile[], actor: DutyActor) {
  const person = people.find(item => item.id === actor.staff)
  return actor.enabled && !!person && person.status !== "left" && person.accountStatus === "enabled" && person.systemRoles.includes("SCHOOL_ADMIN") && person.duties.some(duty => duty.type === "school_admin" && dutyEffective(duty, actor.date))
}

export function manageableResearchGroups(state: StaffDutyState, people: StaffProfile[], actor: DutyActor, type: ResearchDutyKey = "research_participate", includeInactive = false) {
  const me = people.find(person => person.id === actor.staff)
  if (!actor.enabled || !me || me.status === "left" || me.accountStatus !== "enabled" || !dutyDateValid(actor.date)) return []
  if (schoolDutyManager(people, actor)) return state.groups.filter(group => group.active || includeInactive).map(group => group.id)
  if (type === "research_manage" || type === "research_view" || !me.systemRoles.includes("TEACHING_MANAGER")) return []
  return [...new Set(state.assignments.filter(duty => duty.staffId === actor.staff && duty.type === "research_manage" && dutyEffective(duty, actor.date)).flatMap(duty => duty.scopeRefs.map(ref => ref.id)))].filter(id => state.groups.some(group => group.id === id && (group.active || includeInactive)))
}

export function canMaintainResearchGroups(state: StaffDutyState, people: StaffProfile[], actor: DutyActor) {
  return schoolDutyManager(people, actor) || manageableResearchGroups(state, people, actor).length > 0
}

function overlaps(a: DutyRecord, b: DutyRecord) {
  return (!a.end || a.end >= b.start) && (!b.end || b.end >= a.start)
}

export function staffDutyConflicts(state: StaffDutyState, duty: StaffDutyAssignment) {
  return state.assignments.filter(item => item.id !== duty.id && item.status !== "ended" && item.scopeRefs.some(ref => ref.id === duty.scopeRefs[0].id) && overlaps(item, duty) && (
    duty.type === "research_lead" && item.type === "research_lead" ||
    item.staffId === duty.staffId && (item.type === duty.type || ["research_lead", "research_participate"].includes(item.type) && ["research_lead", "research_participate"].includes(duty.type))
  ))
}

export function staffDutyValidationError(state: StaffDutyState, duty: StaffDutyAssignment, previous?: StaffDutyAssignment, mode: "arrange" | "revise" | "end" = previous ? "revise" : "arrange") {
  if (!duty.id?.trim() || !duty.staffId?.trim() || !isResearchDuty(duty.type) || !Array.isArray(duty.scopeRefs) || duty.scopeRefs.length !== 1 || duty.scopeRefs[0].kind !== "research_group" || !state.groups.some(group => group.id === duty.scopeRefs[0].id)) return "请选择有效人员、职责模板与教研负责对象。"
  if (!dutyDateValid(duty.start) || duty.end !== undefined && (!dutyDateValid(duty.end) || duty.end < duty.start)) return "任期日期无效：请填写真实日期，结束日期不得早于开始日期。"
  if (previous && (previous.id !== duty.id || previous.staffId !== duty.staffId || JSON.stringify(previous.scopeRefs) !== JSON.stringify(duty.scopeRefs) || previous.type !== duty.type)) return "修订不能更换人员、职责模板或负责对象；请结束原职责后另行安排。"
  if (mode === "end") {
    if (!previous || !duty.end || duty.start !== previous.start || previous.end && duty.end > previous.end) return "结束职责必须保留开始日期，且不能延长原任期。"
    return ""
  }
  const conflicts = staffDutyConflicts(state, duty)
  const leader = conflicts.find(item => item.type === "research_lead")
  if (duty.type === "research_lead" && leader) return `该任期与已有教研组长职责重叠。结束日期含当日，接任须从次日或之后开始。已有任期：${leader.start} 至 ${leader.end || "未设结束日期"}。`
  const membership = conflicts.find(item => item.staffId === duty.staffId)
  if (membership) return `该人员在此负责对象内已有重叠的同类职责，请修订原记录，勿重复安排。已有：${DUTY_BY_KEY[membership.type].label} · ${researchGroupName(state.groups, membership.scopeRefs[0].id)}（${membership.start} 至 ${membership.end || "未设结束日期"}）。`
  return ""
}

function requireCondition(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

export function applyStaffDutyCommand(state: StaffDutyState, actor: DutyActor, command: StaffDutyCommand, people: StaffProfile[]): StaffDutyState {
  validateStaffDutyState(state)
  requireCondition(dutyDateValid(actor.date), "当前业务日期无效。")
  const operator = people.find(person => person.id === actor.staff)
  requireCondition(actor.enabled && operator && operator.status !== "left" && operator.accountStatus === "enabled", "当前账号不可办理职责安排。")
  if (command.type === "save-group") {
    requireCondition(canMaintainResearchGroups(state, people, actor), "只有学校有权人员可以维护负责对象目录。")
    const group = { ...command.group, name: command.group.name.trim() }
    const existing = state.groups.find(item => item.id === group.id)
    requireCondition(group.id && group.name && group.name.length <= 40 && group.kind === "research_group" && group.department === "教学部", "请填写有效教研组名称；目录不是二级部门。")
    requireCondition(!existing || command.expected && JSON.stringify(existing) === JSON.stringify(command.expected), "负责对象目录已被修订，请重新打开。")
    requireCondition(!state.groups.some(item => item.id !== group.id && item.name === group.name), "目录已有同名教研组，请使用原对象，勿重复创建。")
    return validateStaffDutyState({ ...state, groups: existing ? state.groups.map(item => item.id === group.id ? group : item) : [...state.groups, group] })
  }
  const assignments = command.type === "arrange" ? command.assignments : [command.assignment]
  requireCondition(assignments.length > 0 && new Set(assignments.map(item => item.id)).size === assignments.length, "请至少安排一项职责，记录不能重复。")
  let next = state
  for (const assignment of assignments) {
    requireCondition(isResearchDuty(assignment.type) && Array.isArray(assignment.scopeRefs) && assignment.scopeRefs.length === 1 && assignment.scopeRefs[0].kind === "research_group", "请选择有效职责模板与负责对象。")
    const previous = next.assignments.find(item => item.id === assignment.id)
    const target = people.find(person => person.id === assignment.staffId)
    requireCondition(target, "安排人员不存在，请从教职工列表重新选择。")
    requireCondition(command.type === "arrange" ? !previous : previous && sameStaffDuty(previous, command.expected), "职责记录已被其他操作修订，请返回列表重新打开；不会覆盖最新记录。")
    const groupId = assignment.scopeRefs[0]?.id
    requireCondition(manageableResearchGroups(next, people, actor, assignment.type, command.type === "end").includes(groupId), "没有该负责对象的职责安排权；组长、查看职责或人事部门不授予任命权。")
    requireCondition(command.type === "end" || target.status !== "left", "离职人员仅可结束已有职责，不能新增、修订或延长任期。")
    requireCondition(command.type === "end" || target.systemRoles.includes(DUTY_BY_KEY[assignment.type].role), "该人员缺少本职责所需的任职资格；不会自动授予资格或开通账号。")
    const error = staffDutyValidationError(next, assignment, previous, command.type)
    requireCondition(!error, error)
    const saved = createResearchDuty(assignment.id, assignment.staffId, assignment.type, groupId, assignment.start, assignment.end, next.groups)
    if (previous) { saved.status = previous.status; saved.workMode = previous.workMode }
    if (previous?.note !== undefined) saved.note = previous.note
    saved.history = previous ? [...(previous.history ?? []), { date: actor.date, text: `${command.type === "end" ? "登记结束职责" : "修订职责任期"} · 原任期 ${previous.start} 至 ${previous.end || "未设结束日期"} → ${assignment.start} 至 ${assignment.end || "未设结束日期"}` }] : [{ date: actor.date, text: `安排职责 · ${DUTY_BY_KEY[saved.type].label} · 任期 ${saved.start} 至 ${saved.end || "未设结束日期"}` }]
    next = { ...next, assignments: previous ? next.assignments.map(item => item.id === saved.id ? saved : item) : [...next.assignments, saved] }
  }
  return validateStaffDutyState(next)
}
