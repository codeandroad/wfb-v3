"use client"

import { feedbackPeriodId, type RoutineStandard, type STask, type StudentDay } from "./model"
import { classroomRevFor, levelOf, levelText, revById, type SchemeRev } from "./schemes"
import { useMt, type MtBiz } from "./store"

/** 某任务某周期的课堂标准：已固定用绑定，未固定用负责教师在该周期的有效默认 */
export function classroomStandard(biz: MtBiz, task: Pick<STask, "id" | "teacher_id">, week: number): { rev: SchemeRev | null; revId: string; bound: boolean } {
  const r = classroomRevFor(biz.schemes, task.id, task.teacher_id, feedbackPeriodId(week), week)
  return { rev: revById(r.revId), revId: r.revId, bound: r.bound }
}

export function useClassroomStandard(task: Pick<STask, "id" | "teacher_id">, week: number) {
  const mt = useMt()
  return classroomStandard(mt.biz, task, week)
}

/** 常规确认：每个学生日按其所属任务与周期读取标准 */
export function routineStandard(biz: MtBiz, taskOf: (d: StudentDay) => Pick<STask, "id" | "teacher_id">, weekOf: (d: StudentDay) => number): RoutineStandard {
  return (d) => {
    const s = classroomStandard(biz, taskOf(d), weekOf(d))
    const l = levelOf(s.rev, s.rev?.defaultLevelId ?? null)
    return { revId: s.revId, defaultLevelId: l?.id ?? null, defaultText: l ? levelText(l) : null }
  }
}
