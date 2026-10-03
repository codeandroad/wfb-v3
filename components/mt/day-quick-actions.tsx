"use client"

import { Btn } from "@/components/mt/ui"
import { nameOf, type TaskWeek } from "@/lib/mt/derive"
import { fmtMD, planDayAttendance, planRoutine, uniq } from "@/lib/mt/model"
import { levelText } from "@/lib/mt/schemes"
import { useMt, type RoutineOp } from "@/lib/mt/store"
import { classroomStandard, routineStandard } from "@/lib/mt/use-schemes"
import { useRef, useState } from "react"

type Kind = "routine" | "attendance"
const LABEL: Record<Kind, string> = { routine: "确认本日常规", attendance: "出勤快速处理" }

/**
 * 日卡两项快捷动作：范围＝本日全部合法适用学生（不受搜索/页码影响），点击即执行，无预确认层。
 * 零候选时禁用并原位说明；执行后原位给出真实结果与安全撤销。
 */
export function DayQuickActions({ tw, sids, date, scopeLabel }: { tw: TaskWeek; sids: string[]; date: string; scopeLabel: string }) {
  const mt = useMt()
  const days = tw.days.filter((d) => sids.includes(d.studentId) && d.date === date)
  const stdOf = routineStandard(mt.biz, () => tw.task, () => tw.week)
  const std = classroomStandard(mt.biz, tw.task, tw.week)
  const defLevel = std.rev?.defaultLevelId ? std.rev.levels.find((l) => l.id === std.rev!.defaultLevelId) ?? null : null
  const routine = planRoutine(days, stdOf)
  const attendance = planDayAttendance(days)
  const [result, setResult] = useState<{ kind: Kind; op: RoutineOp; written: number; skipped: { studentId: string; reason: string }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [undoMsg, setUndoMsg] = useState<string | null>(null)
  const busy = useRef(false)

  const run = (kind: Kind) => {
    if (busy.current) return
    const plan = kind === "routine" ? routine : attendance
    if (!plan.items.length) return
    busy.current = true
    const token = `DQ_${tw.task.id}_${date}_${kind}_${mt.biz.seq}`
    const r = mt.runRoutine(token, plan, days, `${scopeLabel} · ${LABEL[kind]}`)
    busy.current = false
    setUndoMsg(null)
    if (!r.ok) {
      setError(r.error)
      setResult(null)
      return
    }
    setError(null)
    setResult({ kind, op: r.op, written: r.written, skipped: plan.skipped.map((s) => ({ studentId: s.studentId, reason: s.reason })) })
  }

  const routineHint = !routine.items.length
    ? "本日无待处理项"
    : defLevel
      ? `${uniq(routine.items.map((i) => i.studentId)).length} 人 · 正常＋${levelText(defLevel)}`
      : `${uniq(routine.items.map((i) => i.studentId)).length} 人 · 仅出勤（未设常规默认等级）`
  const attHint = !attendance.items.length ? "出勤已全部处理" : `${uniq(attendance.items.map((i) => i.studentId)).length} 人待补出勤`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Btn size="sm" variant={routine.items.length ? "primary" : "outline"} disabled={!routine.items.length} onClick={() => run("routine")} data-testid="day-routine">
          {LABEL.routine}
          <span className="ml-1 font-normal opacity-90">{`（${routineHint}）`}</span>
        </Btn>
        <Btn size="sm" disabled={!attendance.items.length} onClick={() => run("attendance")} data-testid="day-attendance">
          {LABEL.attendance}
          <span className="ml-1 font-normal text-muted-foreground">{`（${attHint}）`}</span>
        </Btn>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {`范围：${fmtMD(date)} 本日全部适用学生，与搜索无关。课堂评价按「${std.rev?.name ?? "待核对"}」`}
        {defLevel ? `，常规默认 ${levelText(defLevel)}` : "，未设常规默认，常规确认只补出勤，等级需逐人判断"}
        {"；已填等级、缺席与请假事实受保护，不改作业、亮点，不发布。"}
      </p>
      {error ? (
        <p role="alert" className="rounded-md bg-[#fbf1dd] px-3 py-2 text-xs text-[#7a4d0c]">{error}</p>
      ) : null}
      {result ? (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-[#cfe0d4] bg-[#eef5f0] px-3 py-2 text-xs text-[#1f4d36]">
          <span>
            {`${LABEL[result.kind]}：已写入 `}
            <b className="font-mono">{result.written}</b>
            {" 位学生本日记录"}
            {result.op.undone ? "（已撤销）" : ""}
          </span>
          {result.skipped.length ? (
            <details className="text-[#1f4d36]">
              <summary className="cursor-pointer underline-offset-2 hover:underline">{`保留未写 ${result.skipped.length} 人`}</summary>
              <ul className="mt-1 flex flex-col gap-0.5">
                {result.skipped.map((s, i) => (
                  <li key={`${s.studentId}-${i}`}>{`${nameOf(s.studentId)}：${s.reason}`}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {!result.op.undone && result.written > 0 ? (
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => {
                const u = mt.undoRoutine(result.op.id)
                if ("error" in u) setUndoMsg(u.error)
                else {
                  setUndoMsg(`已撤销 ${u.restored} 条；${u.kept} 条因随后已手改或有新来源而保留。`)
                  setResult({ ...result, op: { ...result.op, undone: true } })
                }
              }}
            >
              撤销本次
            </button>
          ) : null}
          {undoMsg ? <span>{undoMsg}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
