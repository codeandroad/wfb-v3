"use client"

import { Btn, Modal } from "@/components/mt/ui"
import { nameOf, type TaskWeek } from "@/lib/mt/derive"
import { fmtMD, planCarryForward, planDayAttendance, planRoutine, uniq, WEEKDAY_CN, weekdayIdx } from "@/lib/mt/model"

const MODE_TITLE = { routine: "确认常规情况", attendance: "出勤快速处理", carry: "沿用本日评价" } as const
import { useMt, type RoutineOp } from "@/lib/mt/store"
import { levelText } from "@/lib/mt/schemes"
import { classroomStandard, routineStandard } from "@/lib/mt/use-schemes"
import { useState } from "react"

/**
 * 全体“批量确认常规情况”与详情“确认该生常规情况”共用：同一规则 planRoutine，只是学生集合不同。
 */
export function RoutineDialog({
  tw,
  sids,
  scopeLabel,
  onClose,
  date,
  mode = "routine",
}: {
  tw: TaskWeek
  sids: string[]
  scopeLabel: string
  onClose: () => void
  /** 仅限某一实际日期（按日记录） */
  date?: string
  /** routine：正常＋默认等级；attendance：只补出勤；carry：沿用已有日评价到新发生课次 */
  mode?: "routine" | "attendance" | "carry"
}) {
  const mt = useMt()
  const [token, setToken] = useState(() => `RT_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`)
  const days = tw.days.filter((d) => sids.includes(d.studentId) && (!date || d.date === date))
  const stdOf = routineStandard(mt.biz, () => tw.task, () => tw.week)
  const plan = mode === "attendance" ? planDayAttendance(days) : mode === "carry" ? planCarryForward(days) : planRoutine(days, stdOf)
  const leaveLessons = plan.items.reduce((n, i) => n + (i.leaveAtt?.length ?? 0), 0)
  const std = classroomStandard(mt.biz, tw.task, tw.week)
  const defaultText = std.rev && std.rev.defaultLevelId ? (std.rev.levels.find((l) => l.id === std.rev!.defaultLevelId) ?? null) : null
  const defaultLabel = defaultText ? levelText(defaultText) : null
  const sig = plan.items.map((i) => `${i.key}:${i.writeAtt.join(",")}:${i.writeGrade}:${i.extendGrade.join(",")}`).join("|")
  const [previewSig, setPreviewSig] = useState(sig)
  const [result, setResult] = useState<{ op: RoutineOp; written: number } | null>(null)
  const [error, setError] = useState("")
  const [undoMsg, setUndoMsg] = useState("")
  const stale = !result && sig !== previewSig

  const attLessons = plan.items.reduce((n, i) => n + i.writeAtt.length, 0)
  const gradeDays = plan.items.filter((i) => i.writeGrade).length
  const extend = plan.items.reduce((n, i) => n + i.extendGrade.length, 0)
  const dates = uniq(plan.items.map((i) => i.date)).sort()
  const people = uniq(plan.items.map((i) => i.studentId)).length

  const confirm = () => {
    if (stale) {
      setPreviewSig(sig)
      setError("名单或来源已变化，已按最新情况重新计算。请再次核对后确认。")
      return
    }
    const r = mt.runRoutine(token, plan, days, scopeLabel)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setError("")
    setResult({ op: r.op, written: r.written })
  }

  return (
    <Modal
      title={result ? `${MODE_TITLE[mode]}结果` : MODE_TITLE[mode]}
      desc={
        mode === "attendance"
          ? `${scopeLabel} · 只为已发生、尚未处理出勤的原课次补出勤：班主任请假准确覆盖的课次记为“请假”，其余记为“正常”；不写任何课堂评价。`
          : mode === "carry"
            ? `${scopeLabel} · 本日后续课次已发生：保留每位学生已有的本日评价（含“明确不评价”）与备注，只把覆盖范围扩展到新发生课次；不改等级、不补默认值、不碰出勤。`
            : `${scopeLabel} · 第 ${tw.week} 周 · 仅对已发生、尚未处理且确属常规的目标写入“正常出勤${defaultLabel ? `＋${defaultLabel}` : ""}”（${std.rev ? `${std.rev.name} 第 ${std.rev.n} 版` : "评价标准待核对"}${defaultLabel ? "" : "，未设常规默认等级，评价仍需逐一判断"}）；不联动作业、评语、亮点，也不发布。`
      }
      onClose={onClose}
      wide
      footer={
        result ? (
          <>
            {!result.op.undone && result.written > 0 ? (
              <Btn
                onClick={() => {
                  const u = mt.undoRoutine(result.op.id)
                  if ("error" in u) setUndoMsg(u.error)
                  else {
                    setUndoMsg(`已撤销 ${u.restored} 条；${u.kept} 条因随后已手改或新增来源而保留。`)
                    setResult({ ...result, op: { ...result.op, undone: true } })
                  }
                }}
              >
                撤销本次
              </Btn>
            ) : null}
            <Btn variant="primary" onClick={onClose}>
              完成
            </Btn>
          </>
        ) : (
          <>
            <Btn variant="ghost" onClick={onClose}>
              取消
            </Btn>
            <Btn variant="primary" disabled={!plan.items.length} onClick={confirm}>
              {stale ? "重新核对" : `确认写入 ${plan.items.length} 条学生—教学日`}
            </Btn>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            实际写入 <b className="font-mono">{result.written}</b> 条学生—教学日记录
            {result.op.skipped ? `，跳过 ${result.op.skipped} 条需人工核对的记录` : ""}。
          </p>
          <p className="text-xs text-muted-foreground">重复点击或重试使用同一操作号，不会重复确认。</p>
          {undoMsg ? <p className="text-xs text-[#256a49]">{undoMsg}</p> : null}
          {error ? <p className="text-xs text-[#9a2b22]">{error}</p> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          {error ? (
            <p role="alert" className="rounded-md bg-[#fbf1dd] px-3 py-2 text-xs text-[#8a5a12]">
              {error}
              <button type="button" className="ml-2 underline" onClick={() => setToken(`${token}R`)}>
                使用新的操作号
              </button>
            </p>
          ) : null}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact k="学生范围" v={`${sids.length} 人`} />
            <Fact k="将写入" v={`${people} 人 · ${plan.items.length} 日`} />
            {mode === "carry" ? (
              <Fact k="沿用到新课次" v={`${extend} 节次`} />
            ) : (
              <Fact k="出勤“正常”" v={`${attLessons} 节次`} />
            )}
            {mode === "attendance" ? (
              <Fact k="关联请假" v={`${leaveLessons} 节次`} />
            ) : mode === "carry" ? (
              <Fact k="评价等级" v="不变" />
            ) : (
              <Fact k={defaultLabel ? `课堂评价 ${defaultLabel}` : "课堂评价（需判断）"} v={`${gradeDays} 日${extend ? ` · 延伸 ${extend} 节` : ""}`} />
            )}
          </dl>
          <p className="text-xs text-muted-foreground">
            涉及日期：
            {dates.length ? dates.map((d) => `${WEEKDAY_CN[weekdayIdx(d)]} ${fmtMD(d)}`).join("、") : "无"}
            。受保护不写：已处理 {plan.alreadyDone} 日、未来 {plan.futureDays} 日、不适用 {plan.notApplicable} 日。
          </p>
          {!plan.items.length ? (
            <p className="rounded-md bg-muted px-3 py-2 text-xs">没有需要常规确认的目标；不会写入任何记录。</p>
          ) : null}
          {plan.skipped.length ? (
            <div>
              <p className="mb-1 text-xs font-medium">整日跳过、需要人工核对（{plan.skipped.length}）</p>
              <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border text-xs">
                {plan.skipped.map((s) => (
                  <li key={s.key} className="flex justify-between gap-3 px-3 py-1.5">
                    <span>
                      {nameOf(s.studentId)} · {fmtMD(s.date)}
                    </span>
                    <span className="text-muted-foreground">{s.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{k}</dt>
      <dd className="font-mono text-sm font-semibold">{v}</dd>
    </div>
  )
}
