"use client"

import { Badge } from "@/components/kit"
import { AssignForm } from "@/components/mt/homework"
import { LessonDetail } from "@/components/mt/lesson-detail"
import { PhrasePicker, ReasonField } from "@/components/mt/phrase-picker"
import { PublishPanel } from "@/components/mt/publish-panel"
import { RoutineDialog } from "@/components/mt/routine-dialog"
import { DayQuickActions } from "@/components/mt/day-quick-actions"
import { AttSelect, GradeSelect, MtLoading, SaveState } from "@/components/mt/shared"
import { StudentDetailBody } from "@/components/mt/student-drawer"
import { Btn, Modal, useAutoText } from "@/components/mt/ui"
import { dayCardOf, type DayCard } from "@/lib/mt/daycards"
import { nameOf, taskWeek, useTeacherId, type TaskWeek } from "@/lib/mt/derive"
import { taskTitle } from "@/lib/mt/display"
import {
  fmtMD,
  homeroomName,
  planCarryForward,
  WEEKDAY_CN,
  weekdayIdx,
  weekOfDate,
  weekRangeLabel,
  type STask,
  type StudentDay,
} from "@/lib/mt/model"
import { entryKey as entryKeyOf, highlightStatus, scopeTask, useMt, useRecordWriters, useTextWriters } from "@/lib/mt/store"
import { ELIG_REASON } from "@/lib/mt/model"
import { useClassroomStandard } from "@/lib/mt/use-schemes"
import { cn } from "@/lib/utils"
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Eye, Search, X } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export type DayPane = { kind: "record" } | { kind: "student"; sid: string; from: "record" | "preview" } | { kind: "lesson"; id: string } | { kind: "preview" } | { kind: "assign" }

type DialogMode = "routine" | "attendance" | "carry" | null

export function paneToParam(p: DayPane): Record<string, string | null> {
  if (p.kind === "student") return { pane: p.from === "preview" ? "preview" : null, student: p.sid }
  if (p.kind === "preview") return { pane: "preview", student: null }
  return { pane: null, student: null }
}

/** 旧独立日记录深链接：解析为“我的教学 · 按日记录”背景视图 + 对应日记录弹窗 */
export function DayRecordPage({ id, date }: { id: string; date: string }) {
  const sp = useSearchParams()
  const router = useRouter()
  useEffect(() => {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(date)
    const q = new URLSearchParams({ view: "days" })
    if (ok) {
      q.set("week", String(weekOfDate(date)))
      q.set("day", `${id}|${date}`)
    } else {
      q.set("day", `${id}|invalid`)
    }
    const stu = sp.get("student")
    if (stu) q.set("student", stu)
    router.replace(`/teaching?${q.toString()}`)
  }, [id, date, sp, router])
  return <MtLoading />
}

/** 日卡原位“本日记录”：同一模态窗口内切换记录 / 学生详情 / 课次参考 / 布置作业 / 整周反馈准备，不叠加模态 */
export function DayRecordDialog({
  task,
  date,
  cards,
  initialPane,
  onPane,
  onNav,
  onClose,
}: {
  task: STask
  date: string
  cards: DayCard[]
  initialPane: DayPane
  onPane: (p: DayPane) => void
  onNav: (key: string) => void
  onClose: () => void
}) {
  const mt = useMt()
  const teacherId = useTeacherId() ?? ""
  const tx = useTextWriters()
  const [pane, setPaneState] = useState<DayPane>(initialPane)
  const [previewMounted, setPreviewMounted] = useState(initialPane.kind === "preview" || (initialPane.kind === "student" && initialPane.from === "preview"))
  const [assigned, setAssigned] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogMode>(null)
  const [q, setQ] = useState("")
  const [pendingSnap, setPendingSnap] = useState<string[] | null>(null)

  const week = weekOfDate(date)
  const tw = taskWeek(mt.biz, task, week)
  const nowTs = Date.parse(mt.biz.clock)
  const card = dayCardOf(tw, date, nowTs)
  const title = taskTitle(task, teacherId, mt.biz)
  const std = useClassroomStandard(task, week)

  const setPane = (p: DayPane) => {
    if (p.kind === "preview") setPreviewMounted(true)
    setPaneState(p)
    onPane(p)
  }

  const idx = cards.findIndex((c) => c.task.id === task.id && c.date === date)
  const prev = idx > 0 ? cards[idx - 1] : null
  const next = idx >= 0 && idx < cards.length - 1 ? cards[idx + 1] : null
  const isTodo = (c: DayCard) => ["TODO", "BACKFILL", "IN_PROGRESS"].includes(c.status.key)
  const nextTodo = [...cards.slice(idx + 1), ...cards.slice(0, Math.max(idx, 0))].find(isTodo) ?? null

  const dayLabel = `${fmtMD(date)}（${WEEKDAY_CN[weekdayIdx(date)]}）`
  const previewTitle = `第${week}周周反馈｜${title}｜${weekRangeLabel(week)}`
  const modalTitle = pane.kind === "preview" || (pane.kind === "student" && pane.from === "preview") ? previewTitle : `${title} · ${dayLabel}`

  if (!card) {
    return (
      <Modal title={`${title} · ${dayLabel}`} onClose={onClose}>
        <p className="text-sm text-muted-foreground">该日期没有本任务的已应用课次。</p>
      </Modal>
    )
  }

  const pendingNow = (d: StudentDay) => d.state === "PENDING"
  const searched = card.days.filter((d) => !q.trim() || (nameOf(d.studentId) ?? "").includes(q.trim()))
  const rows = pendingSnap ? searched.filter((d) => pendingSnap.includes(d.studentId) || pendingNow(d)) : searched
  const resolvedInView = pendingSnap ? rows.filter((d) => !pendingNow(d)).length : 0
  const carry = planCarryForward(card.days).items.length
  const allSids = card.days.map((d) => d.studentId)
  const future = card.elapsed.length === 0
  const hwHref = assigned ? `/teaching/task/${task.id}?week=${week}&tab=homework&hw=${encodeURIComponent(assigned)}` : null
  const daySummary = mt.biz.daySummaries[`${task.id}|${date}`]?.text ?? ""

  const backToRecord = (
    <button type="button" onClick={() => setPane({ kind: "record" })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3.5" aria-hidden />
      返回 {dayLabel} 本日记录
    </button>
  )

  return (
    <Modal wide title={modalTitle} onClose={onClose}>
      <div className="flex flex-col gap-4" data-testid="day-record-dialog" data-pane={pane.kind}>
        {/* 整周反馈准备：进入后保持挂载，处理学生问题再返回时保留本次准备的选择 */}
        {previewMounted ? (
          <div className={cn("flex flex-col gap-3", pane.kind !== "preview" && "hidden")} data-testid="week-preview">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
              <span>
                已从 {dayLabel} 本日记录切换为整周范围：本任务第 {week} 周全部课堂、适用学生与相关作业。来源日期只用于返回，不限制内容。
              </span>
              {backToRecord}
            </div>
            <PublishPanel tw={tw} teacherId={teacherId} onOpenStudent={(sid) => setPane({ kind: "student", sid, from: "preview" })} />
          </div>
        ) : null}

        {pane.kind === "student" ? (
          <div className="flex flex-col gap-3">
            {pane.from === "preview" ? (
              <button
                type="button"
                onClick={() => setPane({ kind: "preview" })}
                className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                返回第 {week} 周周反馈准备
              </button>
            ) : (
              <span className="self-start">{backToRecord}</span>
            )}
            {tw.students.includes(pane.sid) ? (
              <StudentDetailBody tw={tw} sid={pane.sid} />
            ) : (
              <p className="text-sm text-muted-foreground">该学生不在本任务本周期的适用名单中。</p>
            )}
          </div>
        ) : null}

        {pane.kind === "lesson" && card.lessons.some((l) => l.id === pane.id) ? (
          <LessonDetail lesson={card.lessons.find((l) => l.id === pane.id)!} task={task} teacherId={teacherId} back="" embedded onClose={() => setPane({ kind: "record" })} />
        ) : null}

        {pane.kind === "assign" ? (
          <div className="flex flex-col gap-3">
            <span className="self-start">{backToRecord}</span>
            <p className="text-xs text-muted-foreground">与作业页使用同一布置流程；来源 {dayLabel} 日卡。</p>
            <AssignForm
              task={task}
              sourceDate={date}
              onDone={(hid) => {
                if (hid) setAssigned(hid)
                setPane({ kind: "record" })
              }}
            />
          </div>
        ) : null}

        {pane.kind === "record" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={card.status.tone}>{card.status.label}</Badge>
              {card.attTodo > 0 ? <Badge tone="warning">考勤待核对 {card.attTodo}</Badge> : null}
              {card.lessons.length > 1 ? <Badge tone="info">合并 {card.lessons.length} 节</Badge> : null}
              <span className="text-xs text-muted-foreground">评价标准：{std.rev?.name ?? "未绑定"}</span>
              <span className="ml-auto flex items-center gap-1">
                <Btn size="sm" disabled={!prev} onClick={() => prev && onNav(prev.key)} aria-label="上一张日卡">
                  <ChevronLeft className="size-3.5" aria-hidden />
                  {prev ? `${fmtMD(prev.date)}` : "上一张"}
                </Btn>
                <Btn size="sm" disabled={!next} onClick={() => next && onNav(next.key)} aria-label="下一张日卡">
                  {next ? `${fmtMD(next.date)}` : "下一张"}
                  <ChevronRight className="size-3.5" aria-hidden />
                </Btn>
                {nextTodo ? (
                  <Btn size="sm" onClick={() => onNav(nextTodo.key)}>
                    下一张待处理（{fmtMD(nextTodo.date)} {taskTitle(nextTodo.task, teacherId, mt.biz)}）
                  </Btn>
                ) : null}
              </span>
            </div>

            <ol className="flex flex-wrap gap-2" aria-label="本日课次">
              {card.lessons.map((l) => {
                const done = card.elapsed.some((e) => e.id === l.id)
                const obsCount = Object.values(mt.biz.observations).filter((o) => o.lessonId === l.id).length
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setPane({ kind: "lesson", id: l.id })}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-left text-xs hover:border-primary/50",
                        done ? "border-border bg-card" : "border-dashed border-border text-muted-foreground",
                      )}
                    >
                      <span className="font-medium">第{l.period.number}节</span> {l.period.start}–{l.period.end}
                      {l.room ? ` · ${l.room}` : ""}
                      {done ? "" : " · 未发生"}
                      {obsCount ? <span className="ml-1">· 观察 {obsCount}</span> : null}
                    </button>
                  </li>
                )
              })}
            </ol>

            {assigned && hwHref ? (
              <p className="rounded-lg border border-[#cfe0d4] bg-[#eef5f0] px-3 py-2 text-xs">
                作业已布置并进入本任务作业管理。
                <Link href={hwHref} className="ml-1 font-medium text-primary hover:underline">
                  在作业管理中查看
                </Link>
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {!future ? (
                <>
                  <div className="basis-full">
                    <DayQuickActions tw={tw} sids={allSids} date={date} scopeLabel={`${title} · ${fmtMD(date)}`} />
                  </div>
                  {carry ? (
                    <Btn size="sm" variant="primary" onClick={() => setDialog("carry")}>
                      沿用本日评价到新课次（{carry} 人）
                    </Btn>
                  ) : null}
                </>
              ) : null}
              <Btn size="sm" onClick={() => setPane({ kind: "assign" })}>
                <ClipboardList className="size-3.5" aria-hidden />
                布置作业
              </Btn>
              <Btn size="sm" variant="primary" onClick={() => setPane({ kind: "preview" })} data-testid="preview-week">
                <Eye className="size-3.5" aria-hidden />
                预览第 {week} 周周反馈
              </Btn>
              <span className="ml-auto">
                <SaveState scope={scopeTask(task.id)} compact />
              </span>
            </div>

            {future ? (
              <p className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
                课堂尚未发生：可查看安排、提前布置作业；课堂发生后再记录出勤与评价。
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="relative">
                    <span className="sr-only">搜索学生</span>
                    <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="搜索学生"
                      className="h-8 w-44 rounded-lg border border-input bg-card pl-7 pr-2 text-sm"
                    />
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={!!pendingSnap}
                      onChange={(e) => setPendingSnap(e.target.checked ? card.days.filter(pendingNow).map((d) => d.studentId) : null)}
                    />
                    只看待处理
                  </label>
                  {pendingSnap && resolvedInView > 0 ? (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setPendingSnap(card.days.filter(pendingNow).map((d) => d.studentId))}
                    >
                      已处理 {resolvedInView} 人，刷新列表
                    </button>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    适用 {card.applicable} · 待处理 {card.pending}
                    {q || pendingSnap ? " · 筛选仅影响查看" : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">学生</th>
                        <th className="py-2 pr-3 font-medium">出勤</th>
                        <th className="py-2 pr-3 font-medium">本日评价</th>
                        <th className="py-2 font-medium">亮点 / 备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((d) => (
                        <DayRow key={d.studentId} d={d} tw={tw} date={date} onOpen={() => setPane({ kind: "student", sid: d.studentId, from: "record" })} />
                      ))}
                    </tbody>
                  </table>
                  {!rows.length ? <p className="py-6 text-center text-sm text-muted-foreground">没有符合条件的学生。</p> : null}
                </div>
                <DaySummary key={`${task.id}|${date}`} initial={daySummary} commit={(v) => tx.setDaySummary(task.id, date, v)} />
              </>
            )}
          </>
        ) : null}
      </div>

      {dialog ? (
        <RoutineDialog tw={tw} sids={allSids} date={date} mode={dialog} scopeLabel={`${title} · ${fmtMD(date)}`} onClose={() => setDialog(null)} />
      ) : null}
    </Modal>
  )
}

function DayRow({ d, tw, date, onOpen }: { d: StudentDay; tw: TaskWeek; date: string; onOpen: () => void }) {
  const mt = useMt()
  const rw = useRecordWriters()
  const std = useClassroomStandard(tw.task, tw.week)
  const elapsed = d.elapsed
  const values = elapsed.map((l) => d.rec.att[l.id]?.v ?? null)
  const first = values[0] ?? null
  const mixed = values.some((v) => v !== first)
  const exceptional = values.some((v) => v && v !== "NORMAL")
  const single = elapsed.length === 1
  const [open, setOpen] = useState(!single && (mixed || exceptional))
  const na = d.state === "NOT_APPLICABLE"
  const name = nameOf(d.studentId)
  const dayHls = (mt.biz.highlights[entryKeyOf(tw.task.id, tw.week, d.studentId)]?.items ?? []).filter((h) => h.date === date)
  const hls = dayHls.filter((h) => highlightStatus(h, d.elig) === "VALID")
  const voidHls = dayHls.filter((h) => highlightStatus(h, d.elig) !== "VALID")
  const canEval = d.elig.kind === "ELIGIBLE"
  const hasNote = !!d.rec.note
  return (
    <>
      <tr className={cn("border-b border-border align-top", na && "opacity-50")} data-sid={d.studentId}>
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
          ) : single ? (
            <div className="flex flex-col gap-1.5">
              <AttSelect label={`${name} 本日出勤`} value={first} onChange={(v) => rw.setAttendance(d, tw.week, [elapsed[0].id], v)} />
              {exceptional ? <ReasonField d={d} week={tw.week} lessonId={elapsed[0].id} compact /> : null}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <AttSelect
                label={`${name} 本日出勤（全部已发生课次）`}
                value={first}
                mixed={mixed}
                onChange={(v) => rw.setAttendance(d, tw.week, elapsed.map((l) => l.id), v)}
              />
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
              >
                {open ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
                逐节
              </button>
            </div>
          )}
        </td>
        <td className="py-2 pr-3">
          {na ? null : !canEval ? (
            <span className="text-xs text-muted-foreground" data-testid="eval-na">
              {d.elig.kind === "ABSENT" ? "未出席 · 无需评价" : ELIG_REASON[d.elig.kind]}
            </span>
          ) : (
            <div className="flex flex-col gap-1">
              <GradeSelect
                label={`${name} 本日评价`}
                value={d.gradeEff}
                handling={d.handlingEff}
                rev={std.rev}
                onChange={(v) => rw.setGrade(d, tw.week, v, std.revId)}
              />
              {d.coverageReview ? (
                <span className="flex items-center gap-1 text-xs text-warning-foreground" data-testid="coverage-review">
                  出勤已更正，评价覆盖待核对
                  <button type="button" className="underline hover:text-foreground" onClick={() => rw.confirmCoverage(d, tw.week)}>
                    确认保留
                  </button>
                </span>
              ) : null}
            </div>
          )}
        </td>
        <td className="py-2">
          {na ? null : (
            <Extras d={d} tw={tw} date={date} hls={hls} voidHls={voidHls} canAdd={canEval} hasNote={hasNote} />
          )}
        </td>
      </tr>
      {open && !single && elapsed.length && !na ? (
        <tr className="border-b border-border bg-muted/40">
          <td />
          <td colSpan={3} className="py-2">
            <div className="flex flex-col gap-1.5">
              {elapsed.map((l) => {
                const a = d.rec.att[l.id]
                return (
                  <div key={l.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="w-32 text-muted-foreground">
                      第{l.period.number}节 {l.period.start}
                      {l.room ? ` ${l.room}` : ""}
                    </span>
                    <AttSelect label={`${name} 第${l.period.number}节 出勤`} value={a?.v ?? null} onChange={(v) => rw.setAttendance(d, tw.week, [l.id], v)} />
                    {a && a.v !== "NORMAL" ? <ReasonField d={d} week={tw.week} lessonId={l.id} compact /> : null}
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

/** 亮点与内部备注：已有内容直接可见；空白时只显示添加入口，不常驻空输入框 */
function Extras({
  d,
  tw,
  date,
  hls,
  voidHls,
  canAdd,
  hasNote,
}: {
  d: StudentDay
  tw: TaskWeek
  date: string
  hls: { id: string; text: string }[]
  voidHls: { id: string; text: string }[]
  canAdd: boolean
  hasNote: boolean
}) {
  const tx = useTextWriters()
  const [draft, setDraft] = useState("")
  const [adding, setAdding] = useState(false)
  const [noteOpen, setNoteOpen] = useState(hasNote)
  const name = nameOf(d.studentId)
  const add = (text: string, phraseId?: string) => {
    if (!text.trim()) return
    tx.addHighlight(tw.task.id, tw.week, d.studentId, text.trim(), { date, phraseId })
    setDraft("")
  }
  return (
    <div className="flex min-w-56 flex-col gap-1.5">
      {hls.map((h) => (
        <HighlightItem key={h.id} text={h.text} label={`${name} 亮点`} onSave={(v) => tx.editHighlight(tw.task.id, tw.week, d.studentId, h.id, v || null)} onRemove={() => tx.editHighlight(tw.task.id, tw.week, d.studentId, h.id, null)} />
      ))}
      {voidHls.map((h) => (
        <span key={h.id} className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="void-highlight">
          <span className="line-through">{h.text}</span>
          <span>已失效（未出席，不计入、不发布）</span>
          <button
            type="button"
            className="underline hover:text-foreground"
            aria-label={`删除失效亮点 ${h.text}`}
            onClick={() => tx.editHighlight(tw.task.id, tw.week, d.studentId, h.id, null)}
          >
            删除
          </button>
        </span>
      ))}
      {canAdd ? (
      <div className="flex flex-wrap items-center gap-1.5">
        <PhrasePicker kind="HIGHLIGHT" label={`${name} 常用亮点`} triggerLabel="+ 常用亮点" saveText={draft} onPick={(t, pid) => add(t, pid)} />
        {adding ? (
          <span className="flex items-center gap-1">
            <input
              aria-label={`${name} 自由填写亮点`}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  add(draft)
                  setAdding(false)
                }
              }}
              placeholder="写一条亮点"
              className="h-7 w-36 rounded-md border border-input bg-card px-2 text-xs"
            />
            <Btn size="sm" onClick={() => (add(draft), setAdding(false))} disabled={!draft.trim()}>
              添加
            </Btn>
          </span>
        ) : (
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setAdding(true)}>
            自由填写
          </button>
        )}
      </div>
      ) : null}
      {!noteOpen ? (
        <button type="button" className="self-start text-xs text-muted-foreground hover:text-foreground" onClick={() => setNoteOpen(true)}>
          + 内部备注
        </button>
      ) : null}
      {noteOpen ? <NoteInput d={d} week={tw.week} /> : null}
    </div>
  )
}

export function HighlightItem({ text, label, onSave, onRemove }: { text: string; label: string; onSave: (v: string) => void; onRemove: () => void }) {
  const t = useAutoText(text, (v) => v.trim() && onSave(v.trim()))
  return (
    <span className="flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5">
      <input
        aria-label={label}
        value={t.value}
        onChange={(e) => t.onChange(e.target.value)}
        onBlur={t.flush}
        className="h-6 min-w-0 flex-1 bg-transparent text-xs text-accent-foreground outline-none"
      />
      <button type="button" aria-label="撤销这条亮点" onClick={onRemove} className="text-muted-foreground hover:text-foreground">
        <X className="size-3" aria-hidden />
      </button>
    </span>
  )
}

function NoteInput({ d, week }: { d: StudentDay; week: number }) {
  const rw = useRecordWriters()
  const t = useAutoText(d.rec.note, (v) => rw.setNote(d, week, v))
  return (
    <input
      aria-label={`${nameOf(d.studentId)} 内部备注`}
      placeholder="内部备注（不外发）"
      value={t.value}
      onChange={(e) => t.onChange(e.target.value)}
      onBlur={t.flush}
      className="h-7 w-full rounded-md border border-input bg-card px-2 text-xs"
    />
  )
}

function DaySummary({ initial, commit }: { initial: string; commit: (v: string) => void }) {
  const t = useAutoText(initial, commit)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="day-summary" className="text-sm font-medium">
        本日小结（选填）
      </label>
      <textarea
        id="day-summary"
        rows={2}
        value={t.value}
        onChange={(e) => t.onChange(e.target.value)}
        onBlur={t.flush}
        placeholder="本日课堂整体情况；仅供整理周总结参考，不自动并入。"
        className="rounded-lg border border-input bg-card p-2 text-sm leading-relaxed"
      />
    </div>
  )
}
