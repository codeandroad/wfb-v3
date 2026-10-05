"use client"

import { EmptyState, PageHeader } from "@/components/kit"
import { HomeworkOverview, HomeworkAssignmentCard } from "@/components/mt/homework-dashboard"
import { AssignForm, HwReview, type AssignMode } from "@/components/mt/homework"
import { MtLoading } from "@/components/mt/shared"
import { Btn, Modal } from "@/components/mt/ui"
import { permittedTasks, useTeacherId } from "@/lib/mt/derive"
import { hasOpen, hwProgress, lifecycleOf } from "@/lib/mt/hw"
import { formalTaskName, taskById, type Assignment, type STask } from "@/lib/mt/model"
import { useMt } from "@/lib/mt/store"
import { ClipboardList, Plus, Search } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

type StatusFilter = "open" | "todo" | "all" | "closed" | "withdrawn"
const STATUS: { k: StatusFilter; label: string }[] = [
  { k: "open", label: "进行中" },
  { k: "todo", label: "需要处理" },
  { k: "closed", label: "已结束检查" },
  { k: "withdrawn", label: "已撤回" },
  { k: "all", label: "全部" },
]
const sel = "h-8 rounded-md border border-input bg-card px-2 text-sm"

export function HomeworkCenter() {
  const mt = useMt()
  const teacherId = useTeacherId()
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tasks = useMemo(() => permittedTasks(mt.biz, teacherId), [mt.biz, teacherId])
  const taskIds = new Set(tasks.map((t) => t.id))

  const taskParam = sp.get("task")
  const hwParam = sp.get("hw")
  const stuParam = sp.get("stu")
  const [status, setStatus] = useState<StatusFilter>("open")
  const [q, setQ] = useState("")
  const [assign, setAssign] = useState<{ mode: AssignMode; copyFrom?: Assignment } | null>(null)
  const [assignTask, setAssignTask] = useState<string>("")

  const setParams = (p: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(p)) {
      if (v) n.set(k, v)
      else n.delete(k)
    }
    router.replace(`${pathname}?${n.toString()}`, { scroll: false })
  }

  if (!mt.ready) return <MtLoading />

  const deniedTask = taskParam && !taskIds.has(taskParam)
  const scopeTasks = taskParam && !deniedTask ? tasks.filter((t) => t.id === taskParam) : tasks
  const nowTs = Date.parse(mt.biz.clock)
  const mine = mt.biz.assignments.filter((a) => scopeTasks.some((t) => t.id === a.taskId))
  const list = mine
    .filter((a) => {
      const life = lifecycleOf(a)
      if (q && !a.title.includes(q.trim())) return false
      if (status === "open") return life === "ACTIVE"
      if (status === "todo") return life === "ACTIVE" && hasOpen(a, nowTs) && hwProgress(a, nowTs).pending > 0
      if (status === "closed") return life === "CLOSED"
      if (status === "withdrawn") return life === "WITHDRAWN"
      return true
    })
    .sort((x, y) => (y.deadline ?? y.issuedAt).localeCompare(x.deadline ?? x.issuedAt))

  const target = hwParam ? mt.biz.assignments.find((a) => a.id === hwParam) : null
  const deniedHw = hwParam && (!target || !taskIds.has(target.taskId))
  const open = !deniedHw && !deniedTask ? (target ?? list[0] ?? null) : null
  const openTask = open ? taskById(open.taskId) : null

  const startAssign = (mode: AssignMode, copyFrom?: Assignment) => {
    setAssignTask(mode === "COPY" ? "" : (taskParam && !deniedTask ? taskParam : (tasks[0]?.id ?? "")))
    setAssign({ mode, copyFrom })
  }
  const formTask: STask | undefined = tasks.find((t) => t.id === assignTask)

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="作业管理"
        desc="本人有权的教学任务；跨周进行中的作业都在这里，不受反馈周筛选影响。"
        actions={
          <>
            <Btn onClick={() => startAssign("OFFLINE")} disabled={!tasks.length}>
              补录线下作业
            </Btn>
            <Btn variant="primary" onClick={() => startAssign("NEW")} disabled={!tasks.length}>
              <Plus className="size-4" aria-hidden />
              布置作业
            </Btn>
          </>
        }
      />

      {deniedTask || deniedHw ? (
        <p role="alert" className="mb-4 rounded-lg border border-[#eec4bf] bg-[#fbe6e4] px-3 py-2 text-sm text-[#9a2b22]">
          {deniedHw ? "该作业不存在或你无权查看。" : "你无权查看该教学任务。"}未切换到其他对象。
        </p>
      ) : null}

      <div className="mb-4"><HomeworkOverview assignments={mine} nowTs={nowTs} /></div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="教学任务"
          className={sel}
          value={taskParam && !deniedTask ? taskParam : ""}
          onChange={(e) => setParams({ task: e.target.value || null, hw: null, stu: null })}
        >
          <option value="">全部任务（{tasks.length}）</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {formalTaskName(t)}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1" role="group" aria-label="作业状态">
          {STATUS.map((s) => (
            <button
              key={s.k}
              type="button"
              aria-pressed={status === s.k}
              onClick={() => setStatus(s.k)}
              className={`h-8 rounded-full border px-3 text-xs ${status === s.k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="relative ml-auto">
          <span className="sr-only">搜索作业标题</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="作业标题" className="h-8 w-52 rounded-md border border-input bg-card pl-8 pr-2 text-sm" />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[19rem_1fr]">
        <section aria-label="作业列表" className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">
            {list.length} 份作业{status !== "all" ? `（共 ${mine.length} 份）` : ""}
          </p>
          {list.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">没有符合条件的作业</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {list.map((a) => {
                const t = taskById(a.taskId)
                return (
                  <li key={a.id}>
                    <HomeworkAssignmentCard a={a} active={a.id === open?.id} nowTs={nowTs} onClick={() => setParams({ hw: a.id, stu: null })} />
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        {open && openTask ? (
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xs text-muted-foreground">{formalTaskName(openTask)}</p>
            <HwReview cockpit key={open.id} a={open} initialStudent={stuParam} onCopy={(a) => startAssign("COPY", a)} />
          </div>
        ) : (
          <EmptyState icon={<ClipboardList className="size-7" />} title="选择一份作业开始评阅" desc="选择后即可登记提交、评价和批量处理。" />
        )}
      </div>

      {assign ? (
        <Modal
          wide
          title={assign.mode === "OFFLINE" ? "补录线下已布置作业" : assign.mode === "COPY" ? "复制为新作业" : "布置作业"}
          desc={assign.mode === "OFFLINE" ? "原布置日期与系统登记时间分开保存；不会向家长补发通知。" : undefined}
          onClose={() => setAssign(null)}
        >
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs">
              教学任务
              <select className={sel} value={assignTask} onChange={(e) => setAssignTask(e.target.value)}>
                <option value="">请选择</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {formalTaskName(t)}
                  </option>
                ))}
              </select>
            </label>
            {formTask ? (
              <AssignForm
                key={`${formTask.id}-${assign.mode}`}
                task={formTask}
                mode={assign.mode}
                copyFrom={assign.copyFrom ?? null}
                onDone={(id) => {
                  setAssign(null)
                  if (id) {
                    setStatus("open")
                    setParams({ task: formTask.id, hw: id, stu: null })
                  }
                }}
              />
            ) : (
              <p className="text-xs text-muted-foreground">先选择一个真实教学任务。</p>
            )}
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
