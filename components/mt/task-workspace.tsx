"use client"

import { Badge, Card, EmptyState } from "@/components/kit"
import { HomeworkPanel } from "@/components/mt/homework"
import { PlanPanel } from "@/components/mt/plan-panel"
import { PublishPanel } from "@/components/mt/publish-panel"
import { MtDemoBar, MtLoadError, MtLoading, SaveState } from "@/components/mt/shared"
import { StudentDrawer } from "@/components/mt/student-drawer"
import { Btn, Modal } from "@/components/mt/ui"
import { WeekFeedback } from "@/components/mt/week-feedback"
import { WeekPicker } from "@/components/mt/week-picker"
import { currentWeek, filterStudents, FILTER_LABEL, permittedTasks, taskWeek, useTeacherId, type FilterKey } from "@/lib/mt/derive"
import { parseFrom, taskTitle } from "@/lib/mt/display"
import { MAX_WEEK, taskById, weekRangeLabel } from "@/lib/mt/model"
import { scopeTask, useMt } from "@/lib/mt/store"
import { useClassroomStandard } from "@/lib/mt/use-schemes"
import { ViewModal } from "@/components/mt/scheme-settings"
import type { STask } from "@/lib/mt/model"
import { cn } from "@/lib/utils"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

const TABS = [
  { k: "feedback", label: "整周反馈" },
  { k: "homework", label: "作业评价" },
  { k: "publish", label: "发布与历史" },
  { k: "plan", label: "教学计划" },
] as const
type TabKey = (typeof TABS)[number]["k"]

const BACK_KEYS = ["week", "q", "status", "class", "task", "focus"]
function safeBack(raw: string | null): string {
  const p = new URLSearchParams(raw ?? "")
  const o = new URLSearchParams()
  for (const k of BACK_KEYS) {
    const v = p.get(k)
    if (v) o.set(k, v)
  }
  return o.toString()
}

function useLeaveGuard(taskId: string) {
  const mt = useMt()
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const list = mt.unsettled(scopeTask(taskId))
  const failed = list.filter((e) => e.status !== "saving").length
  useEffect(() => {
    if (!pending) return
    if (list.length === 0) {
      router.push(pending, { scroll: false })
      setPending(null)
    }
  }, [pending, list.length, router])
  useEffect(() => {
    if (!list.length) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [list.length])
  return {
    go: (href: string) => (list.length ? setPending(href) : router.push(href, { scroll: false })),
    blocked: !!pending && failed > 0,
    waiting: !!pending && failed === 0,
    failed,
    cancel: () => setPending(null),
    retry: () => mt.retryScope(scopeTask(taskId)),
    discard: () => {
      mt.discardScope(scopeTask(taskId))
    },
  }
}

export function TaskWorkspacePage({ id }: { id: string }) {
  const mt = useMt()
  const teacherId = useTeacherId()
  const sp = useSearchParams()
  const guard = useLeaveGuard(id)
  const [seq, setSeq] = useState<string[] | null>(null)

  if (!mt.ready) return <MtLoading />
  if (mt.loadError) return <MtLoadError />

  const from = parseFrom(sp.get("from"))
  const back = safeBack(sp.get("back"))
  const lesson = sp.get("lesson")
  const backHref =
    from === "schedule"
      ? `/teaching?${back}${lesson ? `${back ? "&" : ""}focus=${encodeURIComponent(lesson)}` : ""}`
      : from === "workbench"
        ? "/"
        : `/teaching${back ? `?${back}` : ""}`
  const backLabel = from === "workbench" ? "返回工作台" : "返回我的教学"

  const task = taskById(id)
  const permitted = task && teacherId ? permittedTasks(mt.biz, teacherId).some((t) => t.id === id) : false
  const wRaw = sp.get("week")
  const week = wRaw === null ? currentWeek(mt.biz) : Number(wRaw)
  const weekOk = Number.isInteger(week) && week >= 1 && week <= MAX_WEEK

  if (!task || !teacherId || !permitted || !weekOk) {
    const reason = !task
      ? "任务不存在或已失效。"
      : !teacherId
        ? "当前身份没有任教任务。"
        : mt.biz.revoked.includes(id)
          ? "已失去该任务的任教权限，不能继续查看或编辑。"
          : !permitted
            ? "无权访问此任务。"
            : `周次“${wRaw}”无效（有效范围 1–${MAX_WEEK}）。`
    return (
      <div>
        <MtDemoBar />
        <EmptyState
          icon={<ShieldAlert className="size-7" />}
          title="无法打开该任务"
          desc={reason}
          action={
            <Btn onClick={() => guard.go(backHref)}>
              <ArrowLeft className="size-3.5" aria-hidden />
              {backLabel}
            </Btn>
          }
        />
      </div>
    )
  }

  const tw = taskWeek(mt.biz, task, week)
  const tab: TabKey = (TABS.find((t) => t.k === sp.get("tab"))?.k ?? "feedback") as TabKey
  const filter = (Object.keys(FILTER_LABEL).includes(sp.get("f") ?? "") ? sp.get("f") : "all") as FilterKey
  const q = sp.get("sq") ?? ""
  const studentParam = sp.get("student")
  const siblings = permittedTasks(mt.biz, teacherId)

  const href = (patch: Record<string, string | null>, path = `/teaching/task/${id}`) => {
    const p = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) if (!v) p.delete(k)
    else p.set(k, v)
    return `${path}?${p.toString()}`
  }
  const router = { replace: (patch: Record<string, string | null>) => window.history.replaceState(null, "", href(patch)) }
  const drawerSeq = seq ?? filterStudents(mt.biz, tw, filter, q)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Btn variant="ghost" size="sm" onClick={() => guard.go(backHref)}>
          <ArrowLeft className="size-3.5" aria-hidden />
          {backLabel}
        </Btn>
        <span className="ml-auto">
          <SaveState scope={scopeTask(id)} />
        </span>
      </div>
      <MtDemoBar />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-balance text-xl font-semibold">{taskTitle(task, teacherId, mt.biz, siblings)}</h1>
            <span className="text-sm text-muted-foreground" title={`名单以 ${tw.rosterBaseDate} 为基准`}>
              {tw.rosterCount}人
            </span>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge tone={tw.status.tone}>{tw.status.label}</Badge>
            <div className="flex flex-wrap items-center gap-2">
              <StandardLink task={task} week={week} />
              <WeekPicker week={week} current={currentWeek(mt.biz)} onChange={(w) => guard.go(href({ week: String(w), student: null }))} />
              {siblings.length > 1 ? (
                <select
                  aria-label="切换任务"
                  value={id}
                  onChange={(e) => guard.go(href({ student: null, f: null, sq: null }, `/teaching/task/${e.target.value}`))}
                  className="h-9 max-w-56 rounded-lg border border-input bg-card px-2 text-sm"
                >
                  {siblings.map((t) => (
                    <option key={t.id} value={t.id}>
                      {taskTitle(t, teacherId, mt.biz, siblings)}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <nav role="tablist" aria-label="任务工作区" className="mb-4 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.k}
            type="button"
            role="tab"
            aria-selected={tab === t.k}
            onClick={() => guard.go(href({ tab: t.k === "feedback" ? null : t.k }))}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.k === "homework" && tw.hwPending ? <span className="ml-1 text-xs text-[#8a5a12]">{tw.hwPending} 项���果待确认</span> : null}
            {t.k === "publish" && tw.unpublishedChanges ? <span className="ml-1 text-xs text-[#8a5a12]">有未发布修改</span> : null}
          </button>
        ))}
      </nav>

      {tab === "feedback" ? (
        <WeekFeedback
          tw={tw}
          teacherId={teacherId}
          filter={filter}
          q={q}
          setQuery={(patch) => router.replace(patch)}
          onOpen={(sid, s) => {
            setSeq(s)
            router.replace({ student: sid })
          }}
        />
      ) : tab === "homework" ? (
        <HomeworkPanel key={`${id}-${week}`} tw={tw} focusId={sp.get("hw")} />
      ) : tab === "publish" ? (
        <PublishPanel
          key={`${id}-${week}`}
          tw={tw}
          teacherId={teacherId}
          onOpenStudent={(sid) => {
            setSeq(tw.students)
            router.replace({ student: sid })
          }}
        />
      ) : (
        <PlanPanel key={id} task={task} />
      )}

      {studentParam ? (
        <StudentDrawer
          tw={tw}
          sid={studentParam}
          seq={drawerSeq.includes(studentParam) ? drawerSeq : [studentParam, ...drawerSeq]}
          onNav={(sid) => router.replace({ student: sid })}
          onClose={() => {
            setSeq(null)
            router.replace({ student: null })
          }}
        />
      ) : null}

      {guard.blocked ? (
        <Modal
          title="有修改未保存"
          desc={`${guard.failed} 项修改保存失败。离开后这些输入不会保存。`}
          onClose={guard.cancel}
          footer={
            <>
              <Btn variant="ghost" onClick={guard.cancel}>
                继续编辑
              </Btn>
              <Btn onClick={guard.discard}>放弃并离开</Btn>
              <Btn variant="primary" onClick={guard.retry}>
                重试保存并离开
              </Btn>
            </>
          }
        >
          <SaveState scope={scopeTask(id)} />
        </Modal>
      ) : null}
      {guard.waiting ? (
        <p role="status" className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-3 py-2 text-xs text-background">
          正在保存，完成后自动离开…
        </p>
      ) : null}
    </div>
  )
}

function StandardLink({ task, week }: { task: Pick<STask, "id" | "teacher_id">; week: number }) {
  const std = useClassroomStandard(task, week)
  const [open, setOpen] = useState(false)
  if (!std.rev) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={std.bound ? "本周反馈已固定此标准" : "本周尚未固定，当前按你的课堂默认标准"}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {"课堂标准："}
        <span className="text-foreground">{std.rev.name}</span>
        {std.bound ? null : <span className="ml-1 text-xs">{"（默认）"}</span>}
        <span className="ml-2 text-primary">查看本标准</span>
      </button>
      {open ? <ViewModal rev={std.rev} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
