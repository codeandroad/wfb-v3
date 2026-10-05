"use client"

import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/kit"
import { MtDemoBar, MtLoadError, MtLoading, SaveState } from "@/components/mt/shared"
import { WeekPicker } from "@/components/mt/week-picker"
import { currentWeek, permittedTasks, taskWeek, useTeacherId, type TaskWeek } from "@/lib/mt/derive"
import {
  classOf,
  courseOf,
  formalTaskName,
  MAX_WEEK,
  personalDisplay,
  resolveLabel,
  scheduleReadOfWeek,
  uniq,
  WEEKDAY_CN,
  weekdayIdx,
} from "@/lib/mt/model"
import { useMt } from "@/lib/mt/store"
import { resolveStyle, tagStyle, titleClass } from "@/lib/mt/styles"
import { cn } from "@/lib/utils"
import { ArrowRight, CalendarDays, Search, Settings2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

type StatusFilter = "all" | "todo" | "ready" | "published" | "exempt"

export function TaskListPage() {
  const mt = useMt()
  const teacherId = useTeacherId()
  const sp = useSearchParams()
  const router = useRouter()

  if (!mt.ready) return <MtLoading />
  if (mt.loadError) return <MtLoadError />

  const cw = currentWeek(mt.biz)
  const wq = Number(sp.get("week"))
  const week = wq >= 1 && wq <= MAX_WEEK ? wq : cw
  const q = sp.get("q") ?? ""
  const st = (sp.get("status") as StatusFilter) || "all"

  const setParam = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) if (v === null || v === "") p.delete(k)
    else p.set(k, v)
    router.replace(`/teaching?${p.toString()}`, { scroll: false })
  }

  const header = null

  if (!teacherId) {
    return (
      <div>
        {header}
        
        <EmptyState
          icon={<CalendarDays className="size-7" />}
          title="当前身份没有任教任务"
          desc="教务/管理身份本身不等于任课教师。可在右上角原型演示控制切换为“示例林老师”（场景 Lynn 老师）或“示例周老师”（场景同事）。"
        />
      </div>
    )
  }

  const tasks = permittedTasks(mt.biz, teacherId)
  const scheduleRead = scheduleReadOfWeek(week)
  const tws = tasks.map((t) => taskWeek(mt.biz, t, week))
  const shown = tws.filter((tw) => {
    const text = `${formalTaskName(tw.task)} ${classOf(tw.task).name} ${courseOf(tw.task)?.name ?? ""} ${
      resolveLabel(tw.task, teacherId, mt.biz.taskPrefs, mt.biz.lessonOverrides).text ?? ""
    }`
    if (sp.get("class") && tw.task.class_id !== sp.get("class")) return false
    if (q && !text.includes(q)) return false
    if (st === "todo") return ["start", "progress"].includes(tw.status.key)
    if (st === "ready") return ["ready", "changed"].includes(tw.status.key)
    if (st === 'exempt') return ['holiday', 'waived'].includes(tw.status.key)
    if (st === "published") return tw.status.key === "published"
    return true
  })

  const uniqueStudents = uniq(tws.flatMap((tw) => tw.students)).length
  const totalLessons = tws.reduce((n, tw) => n + tw.lessons.length, 0)
  const processed = tws.reduce((n, tw) => n + tw.processed, 0)
  const elapsed = tws.reduce((n, tw) => n + tw.elapsedTotal, 0)

  return (
    <div>
      {header}
      {scheduleRead.status === 'ok' && scheduleRead.fullHoliday && <section role="status" className="mb-5 rounded-lg border border-primary bg-muted p-5 text-foreground"><h2 className="text-lg font-semibold">本周为完整假期，无需发布反馈</h2><p className="mt-2 text-sm">系统已依据校历自动免除本周发布任务，不计待发布或逾期，无需教务审批。作业记录与历史反馈保留。</p></section>}

      <div className="mb-4 flex flex-wrap items-center gap-3">

        <label className="relative min-w-52 flex-1">
          <span className="sr-only">搜索教学任务</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setParam({ q: e.target.value })}
            placeholder="搜索班级、课程或自定义分工"
            className="h-9 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-sm"
          />
        </label>
        <div role="radiogroup" aria-label="状态筛选" className="flex rounded-lg border border-input bg-card p-0.5 text-xs">
          {(
            [
              ["all", "全部"],
              ["todo", "待填写"],
              ["ready", "待发布"],
              ["published", "已发布"],
              ["exempt", "假期 / 已免除"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={st === k}
              onClick={() => setParam({ status: k === "all" ? null : k })}
              className={`rounded-md px-3 py-1.5 font-medium ${st === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {tasks.length} 个任务 · {uniqueStudents} 名去重学生 · 原始课次 {scheduleRead.status === "ok" ? totalLessons : "—"} · 已处理记录 {scheduleRead.status === "ok" ? `${processed}/${elapsed}` : "—"}
      </p>
      {scheduleRead.status !== "ok" ? (
        <p role="alert" className="mb-4 rounded-lg border border-[#e0c48a] bg-[#fbf3e2] px-3 py-2 text-sm text-[#7a4f0e]">
          {scheduleRead.message}。课次数与记录暂不统计（不是 0）。
        </p>
      ) : null}

      {shown.length === 0 ? (
        <EmptyState
          icon={<Search className="size-7" />}
          title={tasks.length ? "没有符合筛选条件的任务" : "本学期暂无任教任务"}
          desc={tasks.length ? "调整搜索或状态筛选后再试。" : "可在“学校管理 · 教学班”中安排。"}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {shown.map((tw) => (
              <TaskRow key={tw.task.id} tw={tw} teacherId={teacherId} q={q} st={st} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function TaskRow({ tw, teacherId, q, st }: { tw: TaskWeek; teacherId: string; q: string; st: string }) {
  const mt = useMt()
  const d = personalDisplay(tw.task, teacherId, mt.biz.taskPrefs, mt.biz.lessonOverrides)
  const ps = resolveStyle(mt.biz, teacherId, tw.task)
  const back = new URLSearchParams({ week: String(tw.week), ...(q ? { q } : {}), ...(st !== "all" ? { status: st } : {}) })
  const backQ = encodeURIComponent(back.toString())
  const href = `/teaching/task/${tw.task.id}?week=${tw.week}&from=list&back=${backQ}`
  const detailHref = `/teaching/class/${tw.task.class_id}?task=${tw.task.id}&week=${tw.week}&back=${backQ}`
  const hwHref = `/teaching/task/${tw.task.id}?week=${tw.week}&from=list&back=${backQ}&tab=homework`
  const pct = tw.elapsedTotal ? Math.round((tw.processed / tw.elapsedTotal) * 100) : null

  return (
    <li className="flex flex-col gap-2 px-4 py-2 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={detailHref}
            className={cn(
              "rounded font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              !ps.hex && "hover:text-primary",
              titleClass(ps),
            )}
            style={ps.hex ? { color: ps.hex } : undefined}
          >
            {d.className}
          </Link>
          {d.division ? (
            ps.tagHex ? (
              <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={tagStyle(ps)}>{d.division}</span>
            ) : (
              <Badge tone="info">{d.division}</Badge>
            )
          ) : null}
          {d.course ? <span className="text-sm text-muted-foreground">{d.course}</span> : null}
          <span className="text-sm text-muted-foreground">{tw.rosterCount}人</span>
        </div>
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {tw.lessons.length
              ? tw.lessons.map((l) => `${WEEKDAY_CN[weekdayIdx(l.actual_date)]}第${l.period.number}节`).join("、")
              : "本周无课"}
          </span>
          {tw.hwPending ? (
            <Link href={hwHref} className="text-[#8a5a12] underline-offset-2 hover:underline">
              作业待确认 {tw.hwPending}
            </Link>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        {tw.elapsedTotal > 0 && <div className="w-32">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">课堂记录</span>
            <span className="font-mono tabular-nums">
              {tw.processed}/{tw.elapsedTotal}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            {pct !== null ? <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /> : null}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{pct === null ? "尚无已发生课次" : `已处理 ${pct}%`}</p>
        </div>}
        <Badge tone={tw.status.tone}>{tw.status.label}</Badge>
        <LinkButton href={href}>
          {tw.status.action}
          <ArrowRight className="size-3.5" aria-hidden />
        </LinkButton>
      </div>
    </li>
  )
}
