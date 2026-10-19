import { ADMIN_CLASSES, TEACHING_CLASSES, detectConflicts, periodsOverlap, type Conflict, type ProjectedEntry } from "./data"
import { classOf, membersOn, taskById, type Membership } from "../mt/model"
import type { TeachingClass, Responsibility } from "../teaching/store"

interface TeachingRelations { classes: TeachingClass[]; responsibilities: Responsibility[] }

export const scheduleEntryKey = (entry: ProjectedEntry) => `${entry.teacherId}-${entry.key}-${entry.date}-${entry.periodId}`
export type StudentRoster = { namespace: "mt" | "catalog"; ids: string[] } | null

/** Placement is explicit metadata, never the list of teachers teaching somewhere in the homeroom. */
export function entryHomeroom(entry: ProjectedEntry, teaching: Pick<TeachingRelations, "classes">): string | null {
  if (entry.kind === "activity") return null
  const registered = teaching.classes.find(c => c.name === entry.className)
  if (registered) {
    if (entry.date < registered.validFrom || entry.date >= registered.validToExclusive) return null
    return ADMIN_CLASSES.find(h => h.teachingHomeroomId === registered.placementHomeroomId && !!registered.placementHomeroomId)?.id ?? null
  }
  return TEACHING_CLASSES.find(c => c.name === entry.className)?.placementHomeroomId ?? null
}

/** The two prototype rosters are distinct domains; never join students by their names or ordinal numbers. */
export function entryStudentRoster(entry: ProjectedEntry, memberships: Record<string, Membership[]> | null, teaching: Pick<TeachingRelations, "classes" | "responsibilities">): StudentRoster {
  if (entry.kind === "activity") return null
  if (entry.taskId) {
    const task = taskById(entry.taskId)
    if (!task || classOf(task)?.name !== entry.className || !memberships?.[task.id] || entry.date < task.valid_from || entry.date > task.valid_through) return null
    return { namespace: "mt", ids: membersOn(memberships[task.id], entry.date) }
  }
  const cls = teaching.classes.find(c => c.name === entry.className)
  if (!cls || entry.date < cls.validFrom || entry.date >= cls.validToExclusive) return null
  const responsibilities = teaching.responsibilities.filter(r => r.teachingClassId === cls.id)
  if (entry.group && responsibilities.length) {
    const responsibility = responsibilities.find(r => r.sharedMark === entry.group && r.validFrom <= entry.date && entry.date < r.validToExclusive)
    if (!responsibility) return null
    return { namespace: "catalog", ids: responsibility.rosterMode === "INHERIT" ? cls.studentIds : responsibility.studentIds }
  }
  if (responsibilities.length && !cls.wholeTeacherIds.includes(`T-${entry.teacherId.toUpperCase()}`)) return null
  return { namespace: "catalog", ids: cls.studentIds }
}

export interface ScheduleReview { a: ProjectedEntry; b: ProjectedEntry; reason: string }
export interface ScheduleAssessment { conflicts: Conflict[]; reviews: ScheduleReview[] }
export function assessSchedule(entries: ProjectedEntry[], rosterOf: (entry: ProjectedEntry) => StudentRoster = () => null): ScheduleAssessment {
  const unique = [...new Map(entries.map(entry => [scheduleEntryKey(entry), entry])).values()]
  // Legacy group labels cannot establish student identity or override a dated roster.
  const conflicts = detectConflicts(unique).filter(conflict => conflict.type !== "student")
  const reviews: ScheduleReview[] = []
  for (let i = 0; i < unique.length; i++) for (let j = i + 1; j < unique.length; j++) {
    const a = unique[i], b = unique[j]
    if (a.date !== b.date || !periodsOverlap(a.periodId, b.periodId)) continue
    // Non-teaching activities have no student roster; teacher/room conflicts were already assessed.
    if (a.kind === "activity" || b.kind === "activity") continue
    const known = conflicts.filter(c => c.a === a && c.b === b)
    const ar = rosterOf(a), br = rosterOf(b)
    if (ar && br && ar.namespace === br.namespace) {
      const overlap = ar.ids.filter(id => br.ids.includes(id))
      if (overlap.length && !known.some(c => c.type === "student")) conflicts.push({ type: "student", date: a.date, a, b, reason: `${new Set(overlap).size} 名学生在重叠时间被安排到两项课程` })
    } else if (!known.length && !(ar?.ids.length === 0 || br?.ids.length === 0)) {
      reviews.push({ a, b, reason: ar && br ? "学生名单来自不同数据范围，尚不能确认是否重叠" : "同一时段有多项安排，学生名单不完整，需核对是否为走班或分层教学" })
    }
  }
  return { conflicts, reviews }
}
