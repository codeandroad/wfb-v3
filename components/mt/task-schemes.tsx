"use client"

import { ViewModal } from "@/components/mt/scheme-settings"
import { Btn, Modal } from "@/components/mt/ui"
import { curWeekOf, mySchemes, setTaskOverride, taskClassroomUsed } from "@/lib/mt/scheme-ops"
import {
  SYSTEM_SCHEMES,
  homeworkRevForTask,
  latestRev,
  overrideKey,
  revById,
  taskClassroomOverrideAt,
  type Purpose,
  type SchemeRev,
} from "@/lib/mt/schemes"
import type { STask } from "@/lib/mt/model"
import { useMt } from "@/lib/mt/store"
import { useClassroomStandard } from "@/lib/mt/use-schemes"
import { useState } from "react"
import { RegradeControl } from "./regrade-control"

/** 当前任务的双用途方案入口：课堂实际方案 + 新作业默认；可仅对本任务快捷采用 */
export function TaskSchemes({ task, week }: { task: Pick<STask, "id" | "teacher_id" | "label">; week: number }) {
  const mt = useMt()
  const std = useClassroomStandard(task, week)
  const [open, setOpen] = useState(false)
  const hw = homeworkRevForTask(mt.biz.schemes, task.id, task.teacher_id, mt.biz.clock)
  const hwRev = revById(hw.revId)
  if (!std.rev) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-8 flex-wrap items-center justify-start gap-x-2 gap-y-1 rounded-lg border border-input bg-card px-2 py-1 text-left text-sm hover:bg-muted"
      >
        <span className="text-muted-foreground">{"课堂评价："}</span>
        <span className="font-medium text-foreground">{std.rev.name}</span>
        <span aria-hidden className="h-4 w-px bg-border" />
        <span className="text-muted-foreground">{"新作业默认："}</span>
        <span className="font-medium text-foreground">{hwRev?.name ?? "未设置"}</span>
        <span className="ml-1 text-primary">方案</span>
      </button>
      {open ? <TaskSchemesModal task={task} week={week} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function legalRevs(biz: ReturnType<typeof useMt>["biz"], teacherId: string): SchemeRev[] {
  const out: SchemeRev[] = []
  for (const s of [...SYSTEM_SCHEMES, ...mySchemes(biz.schemes, teacherId).filter((x) => !x.archived)]) {
    const r = s.owner === "SYSTEM" ? revById(s.revIds.at(-1) ?? "") : latestRev(biz.schemes, s.id)
    if (r) out.push(r)
  }
  return out
}

function TaskSchemesModal({ task, week, onClose }: { task: Pick<STask, "id" | "teacher_id" | "label">; week: number; onClose: () => void }) {
  const mt = useMt()
  const biz = mt.biz
  const std = useClassroomStandard(task, week)
  const revs = legalRevs(biz, task.teacher_id)
  const hw = homeworkRevForTask(biz.schemes, task.id, task.teacher_id, biz.clock)
  const hasHwOverride = (biz.schemes.taskOverrides?.[overrideKey(task.id, "HOMEWORK")] ?? []).length > 0 && hw.source === "TASK"

  const [hwPick, setHwPick] = useState(hw.revId)
  const [view, setView] = useState<SchemeRev | null>(null)
  const [msg, setMsg] = useState<{ p: Purpose; text: string; error?: boolean } | null>(null)

  const apply = (p: Purpose, revId: string | null) => {
    const r = mt.command(p === "CLASSROOM" ? "本任务课堂方案" : "本任务新作业方案", (b) => setTaskOverride(b, task.teacher_id, task.id, p, revId))
    if (!r.ok) return setMsg({ p, text: r.error, error: true })
    const name = revId ? revById(revId)?.name : "教师默认"
    setMsg({ p, text: `本任务之后新布置的作业用「${name}」；已布置作业保持原方案。` })
  }

  return (
    <Modal title="本任务评价方案" desc={`仅作用于「${task.label}」，不改你的其他任务和教师默认。`} onClose={onClose} footer={<Btn onClick={onClose}>关闭</Btn>}>
      <div className="flex flex-col gap-5">
        <section aria-labelledby="ts-cls" className="flex flex-col gap-2">
          <h3 id="ts-cls" className="text-sm font-semibold">课堂评价</h3>
          <RegradeControl key={`${task.id}:${week}`} target={{ kind: "CLASSROOM", taskId: task.id, week }} currentRev={std.revId} label={task.label} />
          <button type="button" className="self-start text-sm text-primary" onClick={() => std.rev && setView(std.rev)}>查看当前方案释义</button>
        </section>

        <section aria-labelledby="ts-hw" className="flex flex-col gap-2 border-t border-border pt-4">
          <h3 id="ts-hw" className="text-sm font-semibold">作业质量</h3>
          <p className="text-sm">
            {"新作业默认："}
            <b>{revById(hw.revId)?.name}</b>
            <span className="ml-1 text-muted-foreground">{hw.source === "TASK" ? "（本任务覆盖）" : "（教师作业默认）"}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="ts-hw-pick">选择新作业方案</label>
            <select id="ts-hw-pick" value={hwPick} onChange={(e) => setHwPick(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-2 text-sm">
              {revs.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <Btn variant="primary" disabled={hwPick === hw.revId} onClick={() => apply("HOMEWORK", hwPick)}>用于本任务后续新作业</Btn>
            {hasHwOverride ? <Btn onClick={() => apply("HOMEWORK", null)}>恢复教师默认</Btn> : null}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">已布置作业（含未批改）保持各自首次布置时的方案，在作业评价中按每份作业显示。</p>
          {msg?.p === "HOMEWORK" ? <p role={msg.error ? "alert" : "status"} className={msg.error ? "text-sm text-destructive" : "text-sm text-primary"}>{msg.text}</p> : null}
        </section>
      </div>
      {view ? <ViewModal rev={view} onClose={() => setView(null)} /> : null}
    </Modal>
  )
}
