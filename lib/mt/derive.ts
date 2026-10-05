"use client"

import { hwStatus } from "./hw"
import { activeWaiver } from './publication-tracking'
import { scheduleReadOfWeek } from './model'
import { useDemo } from "@/lib/demo/store"
import {
  assignmentWeek,
  buildStudentDay,
  dateOfClock,
  feedbackPeriodId,
  isMemberOn,
  leaveSources,
  lessonsOfWeek,
  membersInWeek,
  membersOn,
  studentById,
  taskById,
  TEACHERS,
  teacherOfPersona,
  BIG_DEMO_TASK_IDS,
  uniq,
  weekDates,
  weekOfDate,
  type Assignment,
  type LessonView,
  type STask,
  type StudentDay,
} from "./model"
import { entryKey, highlightStatus, type MtBiz } from "./store"

export function useTeacherId(): string | null {
  const demo = useDemo()
  return teacherOfPersona(demo.persona)
}

/** 当前教师有权且未被撤权的任务 */
export function permittedTasks(biz: MtBiz, teacherId: string | null): STask[] {
  if (!teacherId) return []
  const t = TEACHERS.find((x) => x.id === teacherId)
  if (!t) return []
  const own = t.permitted_task_ids
    .filter((id) => !biz.revoked.includes(id))
    .map((id) => taskById(id))
    .filter((x): x is STask => !!x && x.teacher_id === teacherId)
  if (!biz.bigDemo || teacherId !== "TEACHER_LYNN") return own
  return [...own, ...BIG_DEMO_TASK_IDS.map((id) => taskById(id)).filter((x): x is STask => !!x)]
}

export function currentWeek(biz: MtBiz): number {
  return weekOfDate(dateOfClock(biz.clock))
}

export interface TaskWeek {
  task: STask
  week: number
  periodId: string
  lessons: LessonView[]
  teachingDates: string[]
  /** 周内曾在读学生（行） */
  students: string[]
  /** 本周基准日有效名单 */
  rosterBaseDate: string
  rosterCount: number
  days: StudentDay[]
  byStudent: Record<string, StudentDay[]>
  elapsedTotal: number
  processed: number
  exceptions: number
  hwPending: number
  assignments: Assignment[]
  published: boolean
  unpublishedChanges: boolean
  latestPublication: MtBiz["publications"][number] | null
  status: { key: string; label: string; action: string; tone: "neutral" | "primary" | "success" | "warning" | "info" }
}

export function taskWeek(biz: MtBiz, task: STask, week: number): TaskWeek {
  const nowTs = Date.parse(biz.clock)
  const ms = biz.memberships[task.id] ?? []
  const lessons = lessonsOfWeek(biz.variant, week, [task.id])
  const teachingDates = uniq(lessons.map((l) => l.actual_date))
  const students = membersInWeek(ms, week)
  const leaves = leaveSources(biz.variant)
  const days: StudentDay[] = []
  const byStudent: Record<string, StudentDay[]> = {}
  for (const sid of students) {
    byStudent[sid] = []
    for (const date of teachingDates) {
      const d = buildStudentDay({
        taskId: task.id,
        date,
        studentId: sid,
        lessons: lessons.filter((l) => l.actual_date === date),
        nowTs,
        rec: biz.records[`${task.id}|${date}|${sid}`],
        applicable: isMemberOn(ms, sid, date),
        leaves,
      })
      days.push(d)
      byStudent[sid].push(d)
    }
  }
  const elapsed = days.filter((d) => d.state === "PROCESSED" || d.state === "PENDING")
  const processed = elapsed.filter((d) => d.state === "PROCESSED").length
  const exceptions = uniq(days.filter((d) => d.exception).map((d) => d.studentId)).length

  const wd = weekDates(week)
  const today = dateOfClock(biz.clock)
  const rosterBaseDate = today < wd[0] ? wd[0] : today > wd[6] ? wd[6] : today
  const rosterCount = membersOn(ms, rosterBaseDate).length

  const assignments = biz.assignments.filter((a) => a.taskId === task.id && assignmentWeek(a) === week && a.status !== "WITHDRAWN")
  let hwPending = 0
  for (const a of assignments) for (const sid of a.recipients) if (hwStatus(a, sid, nowTs).pending) hwPending++

  const periodId = feedbackPeriodId(week)
  const pubs = biz.publications.filter((p) => p.periodId === periodId && p.taskIds.includes(task.id))
  const latestPublication = pubs.length ? pubs.reduce((a, b) => (a.stamp >= b.stamp ? a : b)) : null
  const published = !!latestPublication
  const personalPublishedCount = uniq(pubs.filter(p => !p.withdrawn).flatMap(p => p.students.map(s => s.studentId))).filter(id => students.includes(id)).length
  const classPublished = pubs.some(p => !p.withdrawn && p.reports?.some(r => r.kind === 'class' && r.audience === 'parent'))
  const coverageLabel = latestPublication?.reports ? `个人 ${personalPublishedCount}/${students.length} · 班级${classPublished ? '已发' : '未发'}` : `已发布 V${latestPublication?.revision}`
  const pubStamp = latestPublication?.stamp ?? 0

  const k = entryKey(task.id, week)
  const touched =
    days.some((d) => d.rec.stamp > pubStamp) ||
    (biz.summaries[k]?.stamp ?? 0) > pubStamp ||
    Object.entries(biz.comments).some(([kk, v]) => kk.startsWith(`${k}|`) && v.stamp > pubStamp) ||
    Object.entries(biz.highlights).some(([kk, v]) => kk.startsWith(`${k}|`) && v.stamp > pubStamp) ||
    assignments.some((a) => a.stamp > pubStamp)
  const unpublishedChanges = published && touched

  let status: TaskWeek["status"]
  if (activeWaiver(biz, task.id, week)) status = { key: 'waived', label: '教务已免除发布', action: '继续课堂登记', tone: 'info' }
  else if (scheduleReadOfWeek(week, task.teacher_id).status !== 'ok' && !published) status = { key: 'unknown', label: '课表待确认', action: '查看', tone: 'warning' }
  else if (!lessons.length) status = { key: "none", label: "本周无课", action: "查看", tone: "neutral" }
  else if (!elapsed.length) status = { key: "future", label: "课次未开始", action: "查看", tone: "neutral" }
  else if (published && !unpublishedChanges && processed === elapsed.length)
    status = { key: "published", label: coverageLabel, action: "查看反馈", tone: "success" }
  else if (published && unpublishedChanges)
    status = { key: "changed", label: `已发布 V${latestPublication!.revision} · 有未发布内容`, action: "继续完善", tone: "info" }
  else if (processed === 0 && !days.some((d) => d.rec.revision > 0))
    status = { key: "start", label: "未开始", action: "开始填写", tone: "warning" }
  else if (processed < elapsed.length) status = { key: "progress", label: "填写中", action: "继续填写", tone: "primary" }
  else status = { key: "ready", label: "待发布", action: "准备发布", tone: "primary" }

  return {
    task,
    week,
    periodId,
    lessons,
    teachingDates,
    students,
    rosterBaseDate,
    rosterCount,
    days,
    byStudent,
    elapsedTotal: elapsed.length,
    processed,
    exceptions,
    hwPending,
    assignments,
    published,
    unpublishedChanges,
    latestPublication,
    status,
  }
}

export function studentHwPending(biz: MtBiz, tw: TaskWeek, sid: string): number {
  const nowTs = Date.parse(biz.clock)
  return tw.assignments.filter((a) => a.recipients.includes(sid) && hwStatus(a, sid, nowTs).pending).length
}

export type FilterKey = "all" | "pending" | "exception" | "homework" | "highlight"
export const FILTER_LABEL: Record<FilterKey, string> = {
  all: "全部",
  pending: "课堂待处理",
  exception: "考勤例外",
  homework: "作业待确认",
  highlight: "有亮点",
}
export function filterStudents(biz: MtBiz, tw: TaskWeek, f: FilterKey, q: string): string[] {
  const k = entryKey(tw.task.id, tw.week)
  return tw.students.filter((sid) => {
    if (q && !sid.toLowerCase().includes(q.toLowerCase()) && !(nameOf(sid) ?? "").includes(q)) return false
    const ds = tw.byStudent[sid] ?? []
    if (f === "pending") return ds.some((d) => d.state === "PENDING")
    if (f === "exception") return ds.some((d) => d.exception)
    if (f === "homework") return studentHwPending(biz, tw, sid) > 0
    if (f === "highlight")
      return (biz.highlights[`${k}|${sid}`]?.items ?? []).some(
        (h) => highlightStatus(h, h.date ? ds.find((d) => d.date === h.date)?.elig : undefined) === "VALID",
      )
    return true
  })
}

export function nameOf(sid: string) {
  return studentById(sid)?.name
}
