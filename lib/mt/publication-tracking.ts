import { TASKS, TEACHERS, MAX_WEEK, TERM, weekDates, weekOfDate, dateOfClock, feedbackPeriodId, formalTaskName, courseOf, homeroomName, teacherName, type Publication } from './model'
import type { MtBiz } from './store'
import { publicationPolicy } from './publication-policy'
import { scheduleReadOfWeek, taskById, assignmentWeek, membersInWeek, studentById } from './model'

export interface PublicationWaiver {
  taskId: string
  periodId: string
  reason: string
  actor: string
  at: string
  waived: boolean
}
export function activeWaiver(b: MtBiz, taskId: string, week: number) {
  const last = (b.publicationWaivers ?? []).filter(w => w.taskId === taskId && w.periodId === feedbackPeriodId(week)).at(-1)
  return last?.waived ? last : undefined
}
export function publicationRequirement(b: MtBiz, taskId: string, week: number) {
  const waiver = activeWaiver(b, taskId, week)
  if (waiver) return { required: false, known: true, label: '教务已免除', reason: waiver.reason, waiver }
  const task = taskById(taskId)
  const read = scheduleReadOfWeek(week, task?.teacher_id)
  if (read.status !== 'ok') return { required: false, known: false, label: '课表待确认', reason: read.message }
  if (read.fullHoliday) return { required: false, known: true, label: '假期无需发布', reason: '本周完整位于校历假期且无调入补课，系统自动免发，无需教务操作；假期作业及课堂记录保留。' }
  const dates = weekDates(week)
  const lessons = read.lessons.filter(l => l.taskId === taskId && dates.includes(l.date) && l.date >= TERM.start && l.date <= TERM.end && (!task || (l.date >= task.valid_from && l.date <= task.valid_through)))
  const homework = (b.assignments ?? []).some(a => a.taskId === taskId && a.status !== 'WITHDRAWN' && assignmentWeek(a) === week)
  const required = !!lessons.length || homework
  return { required, known: true, label: required ? '应发布' : '本周无需发布', reason: required ? `按实际授课日期归周：${lessons.length} 节有效课次${homework ? '；含本周作业' : ''}` : `校历及有效课表确认本周无课且无本周作业${read.exclusions?.length ? '（含停课 / 调休）' : ''}` }
}
export function isIncomplete(e: { publicationId: string | null; status: string }) {
  return !e.publicationId && ['待发布', '逾期待发布'].includes(e.status)
}
export function homeroomTasks(b: MtBiz, room: string, week: number) {
  return weeklyPublicationTasks(b, week).filter(r => membersInWeek(b.memberships[r.taskId] ?? [], week).some(id => homeroomName(studentById(id)?.homeroom_id ?? '') === room))
}

export interface PublicationCheck {
  id: string
  at: string
  reviewer: string
  week: number
  note: string
  entries: { taskId: string; teacherId: string; label: string; publicationId: string | null; status: string }[]
}
export function trackingWeek(b: MtBiz) {
  return Math.max(1, Math.min(MAX_WEEK, weekOfDate(dateOfClock(b.clock))))
}
export function latestTaskPublication(b: MtBiz, taskId: string, week: number) {
  const latest = b.publications.filter(p => p.periodId === feedbackPeriodId(week) && p.taskIds.includes(taskId) && Date.parse(p.publishedAt) <= Date.parse(b.clock))
    .sort((a, c) => Date.parse(c.publishedAt) - Date.parse(a.publishedAt) || c.revision - a.revision)[0]
  return latest?.withdrawn ? undefined : latest
}
export function weeklyPublicationTasks(b: MtBiz, week: number) {
  const dates = weekDates(week)
  if (week < 1 || week > MAX_WEEK) return []
  return TASKS.filter(t => TEACHERS.some(teacher => teacher.id === t.teacher_id) && t.valid_from <= dates[6] && t.valid_through >= dates[0] && t.valid_from <= TERM.end && t.valid_through >= TERM.start).map(t => {
    const publication = latestTaskPublication(b, t.id, week)
    const firstPublishedAt = publication ? Math.min(...b.publications.filter(p => !p.withdrawn && p.periodId === feedbackPeriodId(week) && p.taskIds.includes(t.id) && Date.parse(p.publishedAt) <= Date.parse(b.clock)).map(p => Date.parse(p.publishedAt))) : Infinity
    const deadline = publicationPolicy(b, t.id, week).deadline
    const requirement = publicationRequirement(b, t.id, week)
    const status = requirement.waiver ? requirement.label : publication ? (firstPublishedAt > Date.parse(deadline) ? '补发完成' : '已发布') : !requirement.required ? requirement.label : Date.parse(b.clock) > Date.parse(deadline) ? '逾期待发布' : '待发布'
    return { requirement, key: `${feedbackPeriodId(week)}|${t.id}`, taskId: t.id, teacherId: t.teacher_id, teacher: teacherName(t.teacher_id), label: formalTaskName(t), course: courseOf(t)?.name ?? '', week, deadline, publication, status }
  })
}
export function createPublicationCheck(b: MtBiz, week: number, reviewer: string, note: string): PublicationCheck {
  return { id: `check-${b.seq + 1}-${b.stamp + 1}`, at: b.clock, reviewer, week, note: note.trim(), entries: weeklyPublicationTasks(b, week).map(r => ({ taskId: r.taskId, teacherId: r.teacherId, label: r.label, publicationId: r.publication?.id ?? null, status: r.status })) }
}
export function homeroomPublications(b: MtBiz, room: string) {
  const publications = b.publications.filter(p => !p.withdrawn && Date.parse(p.publishedAt) <= Date.parse(b.clock) && p.taskIds.some(id => latestTaskPublication(b, id, p.week)?.id === p.id))
  return publications.filter(p => p.students.some(s => homeroomName(s.homeroomId) === room)).sort((a, c) => c.week - a.week || Date.parse(c.publishedAt) - Date.parse(a.publishedAt))
}
export function roomStudents(p: Publication, room: string) {
  return p.students.filter(s => homeroomName(s.homeroomId) === room)
}
export function teacherSemester(b: MtBiz) {
  const rows = Array.from({ length: trackingWeek(b) }, (_, i) => weeklyPublicationTasks(b, i + 1)).flat()
  return TEACHERS.map(t => {
    const tasks = rows.filter(r => r.teacherId === t.id)
    const missed = new Set((b.publicationChecks ?? []).flatMap(c => c.entries.filter(e => e.teacherId === t.id && isIncomplete(e)).map(e => `${c.week}|${e.taskId}`)))
    return { teacherId: t.id, teacher: teacherName(t.id), total: tasks.filter(r => r.requirement.required || (r.publication && !r.requirement.waiver)).length, notRequired: tasks.filter(r => r.requirement.known && !r.requirement.required && !r.requirement.waiver).length, waived: tasks.filter(r => r.requirement.waiver).length, unknown: tasks.filter(r => !r.requirement.known && !r.publication).length, published: tasks.filter(r => r.publication && !r.requirement.waiver).length, late: tasks.filter(r => r.status === '补发完成').length, overdue: tasks.filter(r => r.status === '逾期待发布').length, pending: tasks.filter(r => r.status === '待发布').length, missed: missed.size }
  }).filter(r => r.total || r.waived || r.unknown || r.notRequired)
}
