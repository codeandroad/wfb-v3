"use client"

import { Badge } from "@/components/kit"
import { AssignForm } from "@/components/mt/homework"
import { AttSelect, SaveState } from "@/components/mt/shared"
import { ReasonInput } from "@/components/mt/student-drawer"
import { Btn, Modal, useAutoText } from "@/components/mt/ui"
import { nameOf, taskWeek } from "@/lib/mt/derive"
import { taskTitle } from "@/lib/mt/display"
import { fmtMD, homeroomName, lessonsOfWeek, WEEKDAY_CN, weekdayIdx, weekOfDate, type LessonView, type STask, type StudentDay } from "@/lib/mt/model"
import { obsKey, scopeObs, scopeTask, useMt, useRecordWriters, useTextWriters, type Observation } from "@/lib/mt/store"
import { ClipboardList, Eye } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

/**
 * 单课次详情（原位打开）。
 * - 本课观察 / 指定学生观察：可选参考，只写 observations，不影响评价完成度、排课或发布。
 * - 考勤更正：调用与日卡、整周矩阵同一份课次考勤明细（records[*].att[lessonId]）。
 */
export function findEffectiveLesson(taskId: string, date: string, periodNo: number): LessonView | null {
  return lessonsOfWeek("BASE", weekOfDate(date), [taskId]).find((l) => l.actual_date === date && l.period.number === periodNo) ?? null
}

export function LessonDetail({
  lesson,
  task,
  teacherId,
  back,
  onClose,
  extraActions,
  inDayRecord,
}: {
  lesson: LessonView
  task: STask
  teacherId: string
  back: string
  onClose: () => void
  extraActions?: React.ReactNode
  inDayRecord?: boolean
}) {
  const mt = useMt()
  const tx = useTextWriters()
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigned, setAssigned] = useState<string | null>(null)
  const [sid, setSid] = useState<string>("")
  const week = weekOfDate(lesson.actual_date)
  const tw = taskWeek(mt.biz, task, week)
  const nowTs = Date.parse(mt.biz.clock)
  const elapsed = lesson.endTs <= nowTs
  const live = !elapsed && lesson.startTs <= nowTs
  const title = taskTitle(task, teacherId, mt.biz)
  const date = lesson.actual_date

  const days: StudentDay[] = tw.students
    .map((s) => tw.byStudent[s]?.find((d) => d.date === date))
    .filter((d): d is StudentDay => !!d && d.state !== "NOT_APPLICABLE" && d.lessons.some((l) => l.id === lesson.id))
  const allowed = days.map((d) => d.studentId)
  const classObs = mt.biz.observations[obsKey(lesson.id, null)]
  const stuObs = Object.values(mt.biz.observations).filter((o) => o.lessonId === lesson.id && o.studentId)
  const selDay = days.find((d) => d.studentId === sid) ?? null
  const dayHref = `/teaching/task/${task.id}/day/${date}?back=${encodeURIComponent(back)}`
  const weekHref = `/teaching/task/${task.id}?week=${week}&from=schedule&lesson=${encodeURIComponent(lesson.id)}&back=${encodeURIComponent(back)}`
  const base = {
    lessonId: lesson.id,
    taskId: task.id,
    date,
    periodNo: lesson.period.number,
    endTs: lesson.endTs,
    authorId: teacherId,
    allowedStudents: allowed,
  }

  return (
    <Modal
      wide
      title={`${title} · 第${lesson.period.number}节`}
      desc={`${fmtMD(date)}（${WEEKDAY_CN[weekdayIdx(date)]}）· ${lesson.period.start}–${lesson.period.end}${lesson.room ? ` · ${lesson.room}` : ""}`}
      onClose={onClose}
      footer={
        <>
          {extraActions}
          <Link href={weekHref} className="inline-flex h-9 items-center rounded-lg border border-input bg-card px-3.5 text-sm font-medium hover:bg-muted">
            打开整周反馈
          </Link>
          {inDayRecord ? (
            <Btn variant="primary" onClick={onClose}>
              返回本日正式评价
            </Btn>
          ) : (
            <Link
              href={dayHref}
              className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              进入本日正式评价
            </Link>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5" data-testid="lesson-detail">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone={elapsed ? "success" : live ? "info" : "neutral"}>{elapsed ? "已结束" : live ? "正在上课" : "未开始"}</Badge>
          <span className="text-muted-foreground">适用学生 {allowed.length} 人</span>
          {lesson.makeupFrom ? <span className="text-muted-foreground">调休补课（原 {fmtMD(lesson.makeupFrom)}）</span> : null}
          {lesson.scheduleNote ? <span className="text-muted-foreground">课表备注：{lesson.scheduleNote}</span> : null}
          <span className="ml-auto">
            <SaveState scope={scopeObs(lesson.id)} compact />
          </span>
        </div>

        <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          正式结果以「本日课堂评价」为准（每位学生每天一条）。以下观察均为可选参考，保存后不会改变评价完成度、排课版本或已发布内容，会在学生反馈详情中作为参考显示。
        </p>

        {assigned ? (
          <p className="rounded-lg border border-[#cfe0d4] bg-[#eef5f0] px-3 py-2 text-xs">
            作业已布置并进入作业管理。
            <Link className="ml-1 font-medium text-primary hover:underline" href={`/teaching/task/${task.id}?week=${week}&tab=homework&hw=${encodeURIComponent(assigned)}`}>
              查看
            </Link>
          </p>
        ) : null}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">本课教学观察（选填）</h3>
            <Btn size="sm" onClick={() => setAssignOpen(true)}>
              <ClipboardList className="size-3.5" aria-hidden />
              布置作业
            </Btn>
          </div>
          {elapsed ? (
            <ObsText
              key={`c-${lesson.id}`}
              label="本课教学观察"
              initial={classObs?.text ?? ""}
              locked={!!classObs && classObs.authorId !== teacherId}
              commit={(v) => tx.setObservation({ ...base, studentId: null }, v)}
            />
          ) : (
            <p className="text-xs text-muted-foreground">课堂尚未结束，结束后可记录观察。</p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">指定学生（观察 / 本节考勤更正）</h3>
          <select
            aria-label="选择学生"
            value={sid}
            onChange={(e) => setSid(e.target.value)}
            className="h-9 w-full max-w-xs rounded-lg border border-input bg-card px-2 text-sm"
          >
            <option value="">选择本课适用学生…</option>
            {days.map((d) => (
              <option key={d.studentId} value={d.studentId}>
                {nameOf(d.studentId)} · {homeroomName(d.studentId)}
              </option>
            ))}
          </select>
          {selDay ? (
            <StudentLessonPanel key={selDay.studentId} d={selDay} lesson={lesson} week={week} elapsed={elapsed} teacherId={teacherId} base={base} />
          ) : null}
          {stuObs.length ? (
            <ul className="flex flex-col gap-1 text-xs" aria-label="本课已有学生观察">
              {stuObs.map((o) => (
                <ObsItem key={o.key} o={o} onPick={() => setSid(o.studentId!)} />
              ))}
            </ul>
          ) : null}
        </section>
      </div>
      {assignOpen ? (
        <Modal title="布置作业" desc={`${title} · 来源 ${fmtMD(date)} 第${lesson.period.number}节`} onClose={() => setAssignOpen(false)}>
          <AssignForm
            task={task}
            sourceDate={date}
            onDone={(hid) => {
              setAssignOpen(false)
              if (hid) setAssigned(hid)
            }}
          />
        </Modal>
      ) : null}
    </Modal>
  )
}

function ObsItem({ o, onPick }: { o: Observation; onPick: () => void }) {
  return (
    <li className="flex items-start gap-2 rounded-md border border-border px-2 py-1.5">
      <Eye className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
      <button type="button" onClick={onPick} className="shrink-0 font-medium hover:text-primary">
        {nameOf(o.studentId!)}
      </button>
      <span className="text-muted-foreground">{o.text}</span>
    </li>
  )
}

function ObsText({ label, initial, locked, commit }: { label: string; initial: string; locked?: boolean; commit: (v: string) => void }) {
  const t = useAutoText(initial, commit)
  return (
    <textarea
      aria-label={label}
      rows={2}
      disabled={locked}
      value={t.value}
      onChange={(e) => t.onChange(e.target.value)}
      onBlur={t.flush}
      placeholder={locked ? "由其他老师记录，仅可查看" : "选填：本节课的教学观察，清空即删除"}
      className="w-full rounded-lg border border-input bg-card p-2 text-sm leading-relaxed disabled:opacity-60"
    />
  )
}

function StudentLessonPanel({
  d,
  lesson,
  week,
  elapsed,
  teacherId,
  base,
}: {
  d: StudentDay
  lesson: LessonView
  week: number
  elapsed: boolean
  teacherId: string
  base: { lessonId: string; taskId: string; date: string; periodNo: number; endTs: number; authorId: string; allowedStudents: string[] }
}) {
  const mt = useMt()
  const rw = useRecordWriters()
  const tx = useTextWriters()
  const name = nameOf(d.studentId) ?? d.studentId
  const a = d.rec.att[lesson.id]
  const obs = mt.biz.observations[obsKey(lesson.id, d.studentId)]
  if (!elapsed) return <p className="text-xs text-muted-foreground">课堂尚未结束，暂不能更正考勤或记录观察。</p>
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3" data-testid="student-lesson-panel">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground">第{lesson.period.number}节考勤</span>
        <AttSelect label={`${name} 第${lesson.period.number}节 出勤`} value={a?.v ?? null} onChange={(v) => rw.setAttendance(d, week, [lesson.id], v)} />
        <ReasonInput d={d} week={week} lessonId={lesson.id} value={a?.reason ?? ""} enabled={!!a && a.v !== "NORMAL"} />
        <span className="ml-auto">
          <SaveState scope={scopeTask(d.taskId)} compact />
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">考勤与本日评价页、整周矩阵读写同一份课次考勤明细。</p>
      <ObsText
        label={`${name} 本课观察`}
        initial={obs?.text ?? ""}
        locked={!!obs && obs.authorId !== teacherId}
        commit={(v) => tx.setObservation({ ...base, studentId: d.studentId }, v)}
      />
    </div>
  )
}
