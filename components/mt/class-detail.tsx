"use client"

import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/kit"
import { MtLoadError, MtLoading, SaveState } from "@/components/mt/shared"
import { WeekPicker } from "@/components/mt/week-picker"
import { currentWeek, permittedTasks, taskWeek, useTeacherId, type TaskWeek } from "@/lib/mt/derive"
import {
  CLASSES,
  courseOf,
  fmtMD,
  formalTaskName,
  homeroomName,
  MAX_WEEK,
  normativeLabel,
  personalDisplay,
  prefKey,
  studentById,
  TASKS,
  uniq,
  WEEKDAY_CN,
  weekdayIdx,
} from "@/lib/mt/model"
import { scopeTask, useDisplayWriters, useMt } from "@/lib/mt/store"
import { ArrowLeft, ArrowRight, Lock, Search } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

export function ClassDetailPage({ classId }: { classId: string }) {
  const mt = useMt()
  const teacherId = useTeacherId()
  const sp = useSearchParams()
  const router = useRouter()

  if (!mt.ready) return <MtLoading />
  if (mt.loadError) return <MtLoadError />

  const cls = CLASSES.find((c) => c.id === classId)
  const back = sp.get("back")
  const fromWorkbench = sp.get("from") === "workbench"
  const backHref = fromWorkbench ? "/" : `/teaching${back ? `?${back}` : ""}`
  const backLink = (
    <LinkButton href={backHref} variant="outline">
      <ArrowLeft className="size-3.5" aria-hidden />
      {fromWorkbench ? "返回工作台" : "返回我的教学"}
    </LinkButton>
  )

  if (!cls) {
    return (
      <div>
        <PageHeader title="教学班不存在" actions={backLink} />
        <EmptyState icon={<Lock className="size-7" />} title="未找到该教学班" desc="链接可能已失效。" />
      </div>
    )
  }

  const mine = permittedTasks(mt.biz, teacherId).filter((t) => t.class_id === classId)
  const requested = sp.get("task")
  const task = requested ? mine.find((t) => t.id === requested) : mine[0]

  if (!teacherId || !task) {
    return (
      <div>
        <PageHeader title={cls.name} actions={backLink} />
        <EmptyState
          icon={<Lock className="size-7" />}
          title="无权查看该教学任务"
          desc={
            requested
              ? "链接指定的任务不属于当前教师，未自动改为其他分工。"
              : "当前教师在该教学班没有任教任务。"
          }
        />
      </div>
    )
  }

  const cw = currentWeek(mt.biz)
  const wq = Number(sp.get("week"))
  const week = wq >= 1 && wq <= MAX_WEEK ? wq : cw
  const tw = taskWeek(mt.biz, task, week)
  const setParam = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) if (v === null) p.delete(k)
    else p.set(k, v)
    router.replace(`/teaching/class/${classId}?${p.toString()}`, { scroll: false })
  }

  const allClassTasks = TASKS.filter((t) => t.class_id === classId)
  const classTotal = uniq(allClassTasks.flatMap((t) => taskWeek(mt.biz, t, week).students)).length
  const d = personalDisplay(task, teacherId, mt.biz.taskPrefs, mt.biz.lessonOverrides)
  const course = courseOf(task)
  const backQ = back ? `&back=${encodeURIComponent(back)}` : ""
  const ws = (tab?: string) => `/teaching/task/${task.id}?week=${week}&from=list${backQ}${tab ? `&tab=${tab}` : ""}`

  return (
    <div>
      <PageHeader title={cls.name} desc={formalTaskName(task)} actions={backLink} />

      {mine.length > 1 ? (
        <div role="tablist" aria-label="我在本班的教学任务" className="mb-4 flex flex-wrap gap-1 border-b border-border">
          {mine.map((t) => {
            const on = t.id === task.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setParam({ task: t.id })}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  on ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {normativeLabel(t) ?? "整科"}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <div className="px-5 py-4">
              <h2 className="text-sm font-semibold">基本信息</h2>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Info k="教学班" v={cls.name} />
                <Info k="学科" v={cls.subject} />
                <Info k="关联课程" v={course?.name ?? "未关联"} />
                <Info k="当前分工" v={normativeLabel(task) ?? "整科教学（无分工）"} />
                <Info k="排课归属行政班" v={homeroomName(cls.scheduling_homeroom_id)} />
                <Info k="本任务人数" v={`${tw.rosterCount}人`} />
                <Info k="全班人数" v={`${classTotal}人`} hint="各任务名单并集" />
              </dl>
            </div>
          </Card>

          <Roster tw={tw} week={week} ws={ws} />

          <Card>
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">本任务课次</h2>
                <WeekPicker week={week} current={cw} onChange={(w) => setParam({ week: String(w) })} />
              </div>
              {tw.lessons.length ? (
                <ul className="mt-3 divide-y divide-border text-sm">
                  {tw.lessons.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <span className="w-24 font-medium">
                        {fmtMD(l.actual_date)} {WEEKDAY_CN[weekdayIdx(l.actual_date)]}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        第{l.period.number}节 · {l.period.start}–{l.period.end}
                      </span>
                      {l.room ? <span className="text-xs text-muted-foreground">{l.room}</span> : null}
                      {l.makeupFrom ? <Badge tone="warning">调休补课</Badge> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">所选周没有本任务课次。</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton href={ws()}>
                  整周反馈
                  <ArrowRight className="size-3.5" aria-hidden />
                </LinkButton>
                <LinkButton href={ws("plan")} variant="outline">
                  教学计划
                </LinkButton>
                <LinkButton href={ws("homework")} variant="outline">
                  作业
                </LinkButton>
                <LinkButton href={ws("publish")} variant="outline">
                  发布与历史
                </LinkButton>
                <LinkButton href={`/teaching/schedule?week=${week}&class=${classId}`} variant="outline">
                  本周教学安排
                </LinkButton>
              </div>
            </div>
          </Card>
        </div>

        <DisplaySettings key={`${teacherId}|${task.id}`} taskId={task.id} teacherId={teacherId} preview={d} placeholder={normativeLabel(task) ? "如：纯数1" : "如：程序设计"} />
      </div>
    </div>
  )
}

function Info({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{k}</dt>
      <dd>
        {v}
        {hint ? <span className="ml-1.5 text-xs text-muted-foreground">{hint}</span> : null}
      </dd>
    </div>
  )
}

function Roster({ tw, week, ws }: { tw: TaskWeek; week: number; ws: (tab?: string) => string }) {
  const [q, setQ] = useState("")
  const students = tw.students.map((id) => studentById(id)).filter((s): s is NonNullable<typeof s> => !!s)
  const bySource = new Map<string, number>()
  for (const s of students) bySource.set(s.homeroom_id, (bySource.get(s.homeroom_id) ?? 0) + 1)
  const shown = q ? students.filter((s) => s.name.includes(q)) : students

  return (
    <Card>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            成员名单 <span className="font-normal text-muted-foreground">{students.length}人</span>
          </h2>
          <label className="relative w-56">
            <span className="sr-only">搜索学生</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索学生"
              className="h-8 w-full rounded-md border border-input bg-card pl-8 pr-2 text-sm"
            />
          </label>
        </div>
        <p className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>学生来源行政班：</span>
          {[...bySource.entries()].map(([hr, n]) => (
            <span key={hr} className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              {homeroomName(hr)} {n}人
            </span>
          ))}
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
          {shown.map((s) => (
            <li key={s.id}>
              <Link
                href={`/teaching/student/${s.id}?ret=${encodeURIComponent(`/teaching/class/${encodeURIComponent(tw.task.class_id)}?week=${tw.week}`)}`}
                className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span>{s.name}</span>
                <span className="text-xs text-muted-foreground">{homeroomName(s.homeroom_id)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {shown.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">没有匹配的学生。</p> : null}
        <p className="mt-2 text-[11px] text-muted-foreground">第 {week} 周在读名单；点击学生打开该生本周详情。</p>
      </div>
    </Card>
  )
}

function DisplaySettings({
  taskId,
  teacherId,
  preview,
  placeholder,
}: {
  taskId: string
  teacherId: string
  preview: ReturnType<typeof personalDisplay>
  placeholder: string
}) {
  const mt = useMt()
  const w = useDisplayWriters()
  const cur = mt.biz.taskPrefs[prefKey(teacherId, taskId)] ?? { enabled: false, text: "" }
  const [enabled, setEnabled] = useState(cur.enabled)
  const [text, setText] = useState(cur.text)
  const [err, setErr] = useState("")
  const dirty = enabled !== cur.enabled || text !== cur.text

  const save = () => {
    if (enabled && !text.trim()) {
      setErr("开启时请填写自定义分工")
      return
    }
    w.setTaskPref(teacherId, taskId, { ...cur, enabled, text })
  }

  return (
    <Card className="h-fit">
      <div className="flex flex-col gap-4 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">我的显示设置</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            仅本人可见，作用于我的教学、本周教学安排和我的课表。不改变正式分工、名单和家长侧内容。
          </p>
        </div>

        <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span className="text-xs text-muted-foreground">预览 </span>
          <span className="font-medium">{preview.className}</span>
          {preview.division ? <span> · {preview.division}</span> : null}
          {preview.course ? <span className="text-muted-foreground"> · {preview.course}</span> : null}
        </div>

        <label className="flex items-center justify-between gap-3 text-sm">
          显示课程名称
          <input
            type="checkbox"
            role="switch"
            checked={!!cur.showCourse}
            onChange={(e) => w.setTaskPref(teacherId, taskId, { ...cur, showCourse: e.target.checked })}
            className="size-4 accent-primary"
          />
        </label>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            显示自定义分工
            <input
              type="checkbox"
              role="switch"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked)
                setErr("")
              }}
              className="size-4 accent-primary"
            />
          </label>
          <input
            disabled={!enabled}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setErr("")
            }}
            placeholder={placeholder}
            aria-label="自定义分工"
            aria-invalid={!!err}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-sm disabled:opacity-50"
          />
          {err ? (
            <p className="text-xs text-[#9a2b22]" role="alert">
              {err}
            </p>
          ) : null}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            任务默认：未单独设置的课次继承；已在课表中单独设置的课次保留自己的设置。关闭后保留文字，显示教务分工。
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!dirty}
              onClick={save}
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40"
            >
              保存
            </button>
            <SaveState scope={scopeTask(taskId)} compact />
          </div>
        </div>
      </div>
    </Card>
  )
}
