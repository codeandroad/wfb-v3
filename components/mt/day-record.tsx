"use client"

import { Badge, Card, EmptyState } from "@/components/kit"
import { AssignForm } from "@/components/mt/homework"
import { RoutineDialog } from "@/components/mt/routine-dialog"
import { AttSelect, GradeSelect, MtDemoBar, MtLoadError, MtLoading, SaveState } from "@/components/mt/shared"
import { LessonDetail } from "@/components/mt/lesson-detail"
import { ReasonInput, StudentDrawer } from "@/components/mt/student-drawer"
import { Btn, Modal, useAutoText } from "@/components/mt/ui"
import { dayCardOf } from "@/lib/mt/daycards"
import { nameOf, permittedTasks, taskWeek, useTeacherId, type TaskWeek } from "@/lib/mt/derive"
import { safeQuery, taskTitle } from "@/lib/mt/display"
import {
  fmtMD,
  homeroomName,
  planCarryForward,
  taskById,
  WEEKDAY_CN,
  weekdayIdx,
  weekOfDate,
  type StudentDay,
} from "@/lib/mt/model"
import { scopeTask, useMt, useRecordWriters, useTextWriters } from "@/lib/mt/store"
import { useClassroomStandard } from "@/lib/mt/use-schemes"
import { cn } from "@/lib/utils"
import { ArrowLeft, ChevronDown, ChevronRight, ClipboardList, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

type DialogMode = "routine" | "attendance" | "carry" | null

export function DayRecordPage({ id, date }: { id: string; date: string }) {
  const mt = useMt()
  const teacherId = useTeacherId()
  const sp = useSearchParams()
  const router = useRouter()
  const [dialog, setDialog] = useState<DialogMode>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigned, setAssigned] = useState<string | null>(null)
  const [onlyPending, setOnlyPending] = useState(false)
  const [lessonOpen, setLessonOpen] = useState<string | null>(null)

  if (!mt.ready) return <MtLoading />
  if (mt.loadError) return <MtLoadError />

  const back = safeQuery(sp.get("back"))
  const backHref = `/teaching/schedule?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(back)), view: "days", focus: `${id}|${date}` }).toString()}`

  const task = taskById(id)
  const permitted = task && teacherId ? permittedTasks(mt.biz, teacherId).some((t) => t.id === id) : false
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const week = dateOk ? weekOfDate(date) : NaN
  const tw = task && permitted && dateOk ? taskWeek(mt.biz, task, week) : null
  const card = tw ? dayCardOf(tw, date, Date.parse(mt.biz.clock)) : null

  if (!task || !tw || !card) {
    const reason = !task ? "任务不存在或已失效。" : !permitted ? "无权访问此任务。" : "该日期没有本任务的课次。"
    return (
      <div>
        <MtDemoBar />
        <EmptyState
          icon={<ShieldAlert className="size-7" />}
          title="无法打开这一天的课堂记录"
          desc={reason}
          action={
            <Btn onClick={() => router.push(backHref)}>
              <ArrowLeft className="size-3.5" aria-hidden />
              返回本周教学安排
            </Btn>
          }
        />
      </div>
    )
  }

  const title = taskTitle(task, teacherId ?? "", mt.biz)
  const studentParam = sp.get("student")
  const setStudent = (sid: string | null) => {
    const q = new URLSearchParams(sp.toString())
    if (sid) q.set("student", sid)
    else q.delete("student")
    router.replace(`?${q.toString()}`, { scroll: false })
  }
  const rows = card.days.filter((d) => !onlyPending || d.state === "PENDING")
  const carry = planCarryForward(card.days).items.length
  const allSids = card.days.map((d) => d.studentId)
  const hwHref = assigned ? `/teaching/task/${id}?week=${week}&tab=homework&hw=${encodeURIComponent(assigned)}` : null

  return (
    <div className="flex flex-col gap-4">
      <MtDemoBar />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href={backHref} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" aria-hidden />
            返回本周教学安排（按日记录）
          </Link>
          <h1 className="text-balance text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {fmtMD(date)}（{WEEKDAY_CN[weekdayIdx(date)]}）· 第 {week} 周 · 本日 {card.lessons.length} 个课次 · 已发生 {card.elapsed.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={card.status.tone}>{card.status.label}</Badge>
          <Link
            href={`/teaching/task/${id}?week=${week}`}
            className="inline-flex h-9 items-center rounded-lg border border-border px-3.5 text-sm font-medium hover:bg-muted"
          >
            本周反馈矩阵
          </Link>
          <Btn variant="primary" onClick={() => (setAssigned(null), setAssignOpen(true))}>
            <ClipboardList className="size-3.5" aria-hidden />
            布置作业
          </Btn>
        </div>
      </header>

      <ol className="flex flex-wrap gap-2" aria-label="本日课次">
        {card.lessons.map((l) => {
          const done = card.elapsed.some((e) => e.id === l.id)
          const obsCount = Object.values(mt.biz.observations).filter((o) => o.lessonId === l.id).length
          return (
            <li key={l.id}>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setLessonOpen(l.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-left text-xs hover:border-primary/50",
                  done ? "border-border bg-card" : "border-dashed border-border text-muted-foreground",
                )}
              >
                <span className="font-medium">第{l.period.number}节</span> · {l.period.start}–{l.period.end}
                {l.room ? ` · ${l.room}` : ""} · {done ? "已发生" : "未发生"}
                {obsCount ? <span className="ml-1 text-muted-foreground">· 观察 {obsCount}</span> : null}
              </button>
            </li>
          )
        })}
      </ol>

      {assigned && hwHref ? (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-[#cfe0d4] bg-[#eef5f0] p-3 text-sm">
          <span>作业已布置，已进入本任务的作业管理（来源：{fmtMD(date)} 日卡）。</span>
          <Link href={hwHref} className="font-medium text-primary underline-offset-4 hover:underline">
            在作业管理中查看
          </Link>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Btn size="sm" onClick={() => setDialog("attendance")} disabled={!card.elapsed.length}>
              出勤快速处理
            </Btn>
            <Btn size="sm" onClick={() => setDialog("routine")} disabled={!card.elapsed.length}>
              常规确认（本日）
            </Btn>
            {carry ? (
              <Btn size="sm" variant="primary" onClick={() => setDialog("carry")}>
                沿用本日评价到新课次（{carry} 人）
              </Btn>
            ) : null}
            <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
              只看待处理
            </label>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              适用 {card.applicable} · 已处理 {card.processed} · 待处理 {card.pending}
            </span>
            <SaveState scope={scopeTask(id)} compact />
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          每位学生每天一条课堂评价；出勤默认按“全部已发生课次”记录，个别课次不同时展开逐节填写。本页与本周反馈矩阵、学生抽屉读写同一份记录。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">学生</th>
                <th className="py-2 pr-3 font-medium">出勤</th>
                <th className="py-2 pr-3 font-medium">本日课堂评价</th>
                <th className="py-2 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <DayRow key={d.studentId} d={d} tw={tw} onOpen={() => setStudent(d.studentId)} />
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="py-6 text-center text-sm text-muted-foreground">没有待处理的学生。</p> : null}
        </div>
      </Card>

      <DaySummary taskId={id} date={date} initial={mt.biz.daySummaries[`${id}|${date}`]?.text ?? ""} />

      {dialog ? (
        <RoutineDialog
          tw={tw}
          sids={allSids}
          date={date}
          mode={dialog}
          scopeLabel={`${title} · ${fmtMD(date)}`}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {assignOpen ? (
        <Modal title="布置作业" desc={`${title} · 来源 ${fmtMD(date)} 日卡；与作业页使用同一布置流程。`} onClose={() => setAssignOpen(false)}>
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

      {lessonOpen && card.lessons.some((l) => l.id === lessonOpen) && teacherId ? (
        <LessonDetail
          lesson={card.lessons.find((l) => l.id === lessonOpen)!}
          task={task}
          teacherId={teacherId}
          back={back}
          inDayRecord
          onClose={() => setLessonOpen(null)}
        />
      ) : null}

      {studentParam && tw.students.includes(studentParam) ? (
        <StudentDrawer tw={tw} sid={studentParam} seq={allSids} onNav={(sid) => setStudent(sid)} onClose={() => setStudent(null)} />
      ) : null}
    </div>
  )
}

function DayRow({ d, tw, onOpen }: { d: StudentDay; tw: TaskWeek; onOpen: () => void }) {
  const rw = useRecordWriters()
  const std = useClassroomStandard(tw.task, tw.week)
  const elapsed = d.elapsed
  const values = elapsed.map((l) => d.rec.att[l.id]?.v ?? null)
  const first = values[0] ?? null
  const mixed = values.some((v) => v !== first)
  const exceptional = values.some((v) => v && v !== "NORMAL")
  const [open, setOpen] = useState(mixed)
  const na = d.state === "NOT_APPLICABLE"
  const name = nameOf(d.studentId)
  return (
    <>
      <tr className={cn("border-b border-border align-top", na && "opacity-50")}>
        <td className="py-2 pr-3">
          <button type="button" onClick={onOpen} className="font-medium hover:text-primary hover:underline">
            {name}
          </button>
          <p className="text-xs text-muted-foreground">{homeroomName(d.studentId)}</p>
        </td>
        <td className="py-2 pr-3">
          {na ? (
            <span className="text-xs text-muted-foreground">本日不适用</span>
          ) : !elapsed.length ? (
            <span className="text-xs text-muted-foreground">课次未发生</span>
          ) : (
            <div className="flex items-center gap-1.5">
              <AttSelect
                label={`${name} 本日出勤（全部已发生课次）`}
                value={first}
                mixed={mixed}
                onChange={(v) => rw.setAttendance(d, tw.week, elapsed.map((l) => l.id), v)}
              />
              {elapsed.length > 1 || exceptional ? (
                <button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  aria-expanded={open}
                  className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                >
                  {open ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
                  {elapsed.length > 1 ? "逐节" : "原因"}
                </button>
              ) : null}
            </div>
          )}
        </td>
        <td className="py-2 pr-3">
          {na ? null : (
            <GradeSelect
              label={`${name} 本日课堂评价`}
              value={d.rec.grade}
              handling={d.rec.gradeHandling}
              rev={std.rev}
              disabled={!elapsed.length}
              onChange={(v) => rw.setGrade(d, tw.week, v, std.revId)}
            />
          )}
        </td>
        <td className="py-2">{na ? null : <NoteInput d={d} week={tw.week} enabled={elapsed.length > 0} />}</td>
      </tr>
      {open && elapsed.length && !na ? (
        <tr className="border-b border-border bg-muted/40">
          <td />
          <td colSpan={3} className="py-2">
            <div className="flex flex-col gap-1.5">
              {elapsed.map((l) => {
                const a = d.rec.att[l.id]
                return (
                  <div key={l.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="w-28 text-muted-foreground">
                      第{l.period.number}节 {l.period.start}
                    </span>
                    <AttSelect
                      label={`${name} 第${l.period.number}节 出勤`}
                      value={a?.v ?? null}
                      onChange={(v) => rw.setAttendance(d, tw.week, [l.id], v)}
                    />
                    <ReasonInput d={d} week={tw.week} lessonId={l.id} value={a?.reason ?? ""} enabled={!!a && a.v !== "NORMAL"} />
                  </div>
                )
              })}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function NoteInput({ d, week, enabled }: { d: StudentDay; week: number; enabled: boolean }) {
  const rw = useRecordWriters()
  const t = useAutoText(d.rec.note, (v) => rw.setNote(d, week, v))
  return (
    <input
      aria-label={`${nameOf(d.studentId)} 本日备注`}
      disabled={!enabled}
      placeholder="备注（选填）"
      value={t.value}
      onChange={(e) => t.onChange(e.target.value)}
      onBlur={t.flush}
      className="h-7 w-full min-w-40 rounded-md border border-input bg-card px-2 text-xs disabled:opacity-50"
    />
  )
}

function DaySummary({ taskId, date, initial }: { taskId: string; date: string; initial: string }) {
  const tx = useTextWriters()
  const t = useAutoText(initial, (v) => tx.setDaySummary(taskId, date, v))
  return (
    <Card className="flex flex-col gap-2 p-4">
      <label htmlFor="day-summary" className="text-sm font-medium">
        本日课堂小结
      </label>
      <textarea
        id="day-summary"
        rows={3}
        value={t.value}
        onChange={(e) => t.onChange(e.target.value)}
        onBlur={t.flush}
        placeholder="选填：本日课堂整体情况。仅保存为日小结，不会自动并入本周公共总结。"
        className="rounded-lg border border-input bg-card p-2 text-sm leading-relaxed"
      />
    </Card>
  )
}
