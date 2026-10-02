"use client"

// 按日记录：日卡 = 同一教学任务在同一实际日期的全部原课次。
// 只从 taskWeek（同一课次来源 + 同一学生日记录）派生，不另存课次或记录。
//
// r2：三个状态分别计算，不混用——
//  - 结构属性 merged：本日原始有效课次数（≥2 显示「合并N节」），与评价无关；
//  - 授课时间 timing：尚未上课 / 正在上课 / 今日还有课 / 已全部发生；
//  - 评价处理 eval：只读同一份学生日评价（gradeHandling + gradeCovered），与周矩阵、抽屉、日记录共用 buildStudentDay；
//  - 考勤处理 att：已发生课次缺少明细或存在冲突的学生数，另行提示。
// 时间经过只改变「可记录」条件，从不使某人「已评价」。

import { taskWeek, type TaskWeek } from "./derive"
import { ABSENT_TYPES, type LessonView, type STask, type StudentDay } from "./model"
import type { MtBiz } from "./store"

export type EvalKey = "FUTURE" | "TODO" | "BACKFILL" | "IN_PROGRESS" | "DONE" | "NONE_NEEDED" | "EMPTY"
type Tone = "neutral" | "warning" | "info" | "success"

export interface DayCard {
  key: string
  task: STask
  week: number
  date: string
  lessons: LessonView[]
  elapsed: LessonView[]
  days: StudentDay[]
  applicable: number
  /** 仍需处理已发生适用评价范围的学生数（按学生去重） */
  evalTodo: number
  /** 已发生课次考勤未核对或存在冲突的学生数 */
  attTodo: number
  /** 兼容旧调用：日记录 PENDING 学生数（评价或考勤任一未处理） */
  pending: number
  processed: number
  merged: number
  timing: { key: "FUTURE" | "LIVE" | "MORE_TODAY" | "ALL_ELAPSED"; label: string | null }
  /** 主状态：评价处理 */
  status: { key: EvalKey; label: string; tone: Tone }
}

function evalHandled(d: StudentDay): boolean {
  return !d.gradeMissing
}
function evalStarted(d: StudentDay): boolean {
  return d.rec.gradeHandling !== "PENDING" || d.rec.gradeCovered.length > 0 || d.rec.grade !== null
}
/** 本人当天应处理评价范围完全无需等级（全部缺席/请假/在他班，或明确不适用） */
function evalNotNeeded(d: StudentDay): boolean {
  const allAbsent = d.elapsed.length > 0 && d.elapsed.every((l) => d.rec.att[l.id] && ABSENT_TYPES.includes(d.rec.att[l.id].v))
  return allAbsent || d.rec.gradeHandling === "NOT_APPLICABLE"
}

export function dayCardOf(tw: TaskWeek, date: string, nowTs: number): DayCard | null {
  const lessons = tw.lessons.filter((l) => l.actual_date === date).sort((a, b) => a.startTs - b.startTs)
  if (!lessons.length) return null
  const elapsed = lessons.filter((l) => l.endTs <= nowTs)
  const live = lessons.some((l) => l.startTs <= nowTs && l.endTs > nowTs)
  const days = tw.days.filter((d) => d.date === date)
  const appl = days.filter((d) => d.state !== "NOT_APPLICABLE")
  const withElapsed = appl.filter((d) => d.elapsed.length > 0)
  const evalTodo = withElapsed.filter((d) => !evalHandled(d)).length
  const attTodo = withElapsed.filter((d) => d.attMissing.length > 0 || d.rec.conflict).length
  const anyStarted = withElapsed.some(evalStarted)
  /** 仍有适用学生的未来课堂（不同学生适用范围可能不同） */
  const futureScope = appl.some((d) => d.lessons.some((l) => l.endTs > nowTs))
  /** 已确认覆盖不得包含尚未发生的课次 */
  const prematurelyCovered = appl.some((d) => d.rec.gradeCovered.some((id) => d.lessons.find((l) => l.id === id && l.endTs > nowTs)))

  const timing: DayCard["timing"] = !elapsed.length && !live
    ? { key: "FUTURE", label: "尚未上课" }
    : live
      ? { key: "LIVE", label: "正在上课" }
      : elapsed.length < lessons.length
        ? { key: "MORE_TODAY", label: "今日还有课" }
        : { key: "ALL_ELAPSED", label: null }

  let status: DayCard["status"]
  if (!appl.length) status = { key: "EMPTY", label: "本日无适用学生", tone: "neutral" }
  else if (!withElapsed.length) status = { key: "FUTURE", label: "尚未上课", tone: "neutral" }
  else if (evalTodo > 0 && !anyStarted) status = { key: "TODO", label: "待评价", tone: "warning" }
  else if (evalTodo > 0) status = { key: "BACKFILL", label: `评价待补 ${evalTodo} 人`, tone: "warning" }
  else if (futureScope || prematurelyCovered) status = { key: "IN_PROGRESS", label: "评价进行中", tone: "info" }
  else if (withElapsed.every(evalNotNeeded)) status = { key: "NONE_NEEDED", label: "无需评价", tone: "neutral" }
  else status = { key: "DONE", label: "评价已完成", tone: "success" }

  return {
    key: `${tw.task.id}|${date}`,
    task: tw.task,
    week: tw.week,
    date,
    lessons,
    elapsed,
    days,
    applicable: appl.length,
    evalTodo,
    attTodo,
    pending: appl.filter((d) => d.state === "PENDING").length,
    processed: appl.filter((d) => d.state === "PROCESSED").length,
    merged: lessons.length,
    timing,
    status,
  }
}

export function dayCardsOfWeek(biz: MtBiz, tasks: STask[], week: number): DayCard[] {
  const nowTs = Date.parse(biz.clock)
  const out: DayCard[] = []
  for (const t of tasks) {
    const tw = taskWeek(biz, t, week)
    for (const d of tw.teachingDates) {
      const c = dayCardOf(tw, d, nowTs)
      if (c) out.push(c)
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.lessons[0].startTs - b.lessons[0].startTs)
}

export function periodsLabel(lessons: LessonView[]): string {
  return `第${lessons.map((l) => l.period.number).join("、")}节`
}

/** 单课次的时间提示：正常已过去的课次不重复写「已结束」 */
export function lessonTimingLabel(l: LessonView, nowTs: number): string | null {
  if (l.startTs > nowTs) return "未上"
  if (l.endTs > nowTs) return "进行中"
  return null
}
