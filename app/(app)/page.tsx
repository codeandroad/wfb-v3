"use client"

import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader } from "@/components/kit"
import { MtDemoBar, MtLoadError, MtLoading } from "@/components/mt/shared"
import { moduleEnabled } from "@/lib/demo/nav"
import { useDemo } from "@/lib/demo/store"
import { currentWeek, filterStudents, permittedTasks, taskWeek, useTeacherId } from "@/lib/mt/derive"
import { taskTitle } from "@/lib/mt/display"
import { weekRangeLabel } from "@/lib/mt/model"
import { useMt } from "@/lib/mt/store"
import { ArrowRight, BookOpen, CalendarDays, PlugZap } from "lucide-react"
import Link from "next/link"

export default function WorkbenchPage() {
  const demo = useDemo()
  const mt = useMt()
  const teacherId = useTeacherId()

  if (!moduleEnabled("teaching", demo.config)) return <NotConnected />
  if (!mt.ready) return <MtLoading />
  if (mt.loadError) return <MtLoadError />

  const week = currentWeek(mt.biz)
  const tasks = permittedTasks(mt.biz, teacherId)
  const tws = tasks.map((t) => taskWeek(mt.biz, t, week))
  const sum = (f: (tw: (typeof tws)[number]) => number) => tws.reduce((n, tw) => n + f(tw), 0)
  const ws = (id: string, tab?: string) => `/teaching/task/${id}?week=${week}&from=workbench${tab ? `&tab=${tab}` : ""}`

  return (
    <div>
      <PageHeader
        title="工作台"
        desc={`第 ${week} 周 · ${weekRangeLabel(week)}`}
        actions={
          <>
            <LinkButton variant="outline" href="/teaching/schedule">
              <CalendarDays className="size-3.5" aria-hidden />
              本周教学安排
            </LinkButton>
            <LinkButton variant="outline" href="/teaching">
              <BookOpen className="size-3.5" aria-hidden />
              我的教学
            </LinkButton>
          </>
        }
      />
      <MtDemoBar />

      {!teacherId || tasks.length === 0 ? (
        <EmptyState icon={<BookOpen className="size-7" />} title="当前身份没有任教任务" desc="工作台只列出本人有效任教任务。" />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Stat label="待处理课堂记录" value={sum((tw) => tw.elapsedTotal - tw.processed)} hint="已发生、尚未处理的学生—教学日" />
            <Stat label="有课堂例外的学生" value={sum((tw) => filterStudents(mt.biz, tw, "exception", "").length)} hint="请假、迟到、在他班等（按任务计）" />
            <Stat label="作业待确认学生" value={sum((tw) => filterStudents(mt.biz, tw, "homework", "").length)} hint="有作业结果待确认的学生（按任务计）" />
          </div>

          <Card>
            <CardHeader title="本周教学任务" desc="与“我的教学”读取同一份记录；进入后为同一反馈工作区。" />
            <ul className="divide-y divide-border">
              {tws.map((tw) => {
                const t = tw.task
                const pct = tw.elapsedTotal ? Math.round((tw.processed / tw.elapsedTotal) * 100) : null
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="min-w-48 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/teaching/class/${encodeURIComponent(t.class_id)}?task=${t.id}&week=${week}&from=workbench`}
                          className="text-sm font-semibold underline-offset-4 hover:text-primary hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {taskTitle(t, teacherId, mt.biz, tasks)}
                        </Link>
                        <Badge tone={tw.status.tone}>{tw.status.label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {tw.rosterCount}人 · 本周 {tw.lessons.length} 个课次
                      </p>
                    </div>
                    <div className="w-40 text-xs text-muted-foreground">
                      <div className="mb-1 flex justify-between">
                        <span>课堂记录</span>
                        <span className="font-mono">
                          {tw.processed}/{tw.elapsedTotal}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct ?? 0}%` }} />
                      </div>
                      {pct === null ? <span className="mt-1 block">尚无已发生课次</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <LinkButton variant="outline" href={ws(t.id, "publish")}>
                        {tw.status.key === "published" ? "查看反馈" : "准备发布"}
                      </LinkButton>
                      <LinkButton href={ws(t.id)}>
                        {tw.processed ? "继续填写" : "开始填写"}
                        <ArrowRight className="size-3.5" aria-hidden />
                      </LinkButton>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card className="p-4">
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      <p className="mt-2 text-[26px] font-semibold leading-none">{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </Card>
  )
}

function NotConnected() {
  return (
    <div>
      <PageHeader title="工作台" desc="演示配置 B · 仅身份与权限模块" />
      <EmptyState
        tone="warning"
        icon={<PlugZap className="size-7" />}
        title="教学反馈模块未接入"
        desc="当前为演示配置 B：DATA 与教学反馈模块未接入，因此没有可操作的教学数据或业务入口。可在「原型演示控制」切换回配置 A 查看完整流程，或前往「学校管理」体验身份与权限模块。"
        action={
          <LinkButton variant="outline" href="/school">
            前往学校管理
          </LinkButton>
        }
      />
    </div>
  )
}
