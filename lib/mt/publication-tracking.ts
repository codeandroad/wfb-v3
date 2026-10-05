import { TASKS, TEACHERS, MAX_WEEK, TERM, weekDates, weekOfDate, dateOfClock, feedbackPeriodId, formalTaskName, courseOf, homeroomName, teacherName, type Publication } from './model'
import type { MtBiz } from './store'

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
  const deadline = `${dates[6]}T23:59:59+08:00`
  if (week < 1 || week > MAX_WEEK) return []
  return TASKS.filter(t => TEACHERS.some(teacher => teacher.id === t.teacher_id) && t.valid_from <= dates[6] && t.valid_through >= dates[0] && t.valid_from <= TERM.end && t.valid_through >= TERM.start).map(t => {
    const publication = latestTaskPublication(b, t.id, week)
    const firstPublishedAt = publication ? Math.min(...b.publications.filter(p => !p.withdrawn && p.periodId === feedbackPeriodId(week) && p.taskIds.includes(t.id) && Date.parse(p.publishedAt) <= Date.parse(b.clock)).map(p => Date.parse(p.publishedAt))) : Infinity
    const status = publication ? (firstPublishedAt > Date.parse(deadline) ? '补发完成' : '已发布') : Date.parse(b.clock) > Date.parse(deadline) ? '逾期待发布' : '待发布'
    return { key: `${feedbackPeriodId(week)}|${t.id}`, taskId: t.id, teacherId: t.teacher_id, teacher: teacherName(t.teacher_id), label: formalTaskName(t), course: courseOf(t)?.name ?? '', week, deadline, publication, status }
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
    const missed = new Set((b.publicationChecks ?? []).flatMap(c => c.entries.filter(e => e.teacherId === t.id && !e.publicationId).map(e => `${c.week}|${e.taskId}`)))
    return { teacherId: t.id, teacher: teacherName(t.id), total: tasks.length, published: tasks.filter(r => r.publication).length, late: tasks.filter(r => r.status === '补发完成').length, overdue: tasks.filter(r => r.status === '逾期待发布').length, pending: tasks.filter(r => r.status === '待发布').length, missed: missed.size }
  }).filter(r => r.total)
}
