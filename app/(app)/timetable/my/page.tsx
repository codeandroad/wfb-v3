"use client"

import { Badge, PageHeader, Segmented, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { CardDetail, ConfirmModal, DiffColumns, DiffList } from "@/components/timetable/detail"
import { findEffectiveLesson, LessonDetail } from "@/components/mt/lesson-detail"
import { taskById, weekOfDate } from "@/lib/mt/model"
import { useTeacherId } from "@/lib/mt/derive"
import { useMt } from "@/lib/mt/store"
import { periodById } from "@/lib/timetable/data"
import { LessonDialog } from "@/components/timetable/lesson-dialog"
import { TimetableDemoBar } from "@/components/timetable/demo-bar"
import { WeekGrid } from "@/components/timetable/week-grid"
import {
  changedRows,
  fmtClock,
  fmtDate,
  TEACHERS,
  WEEKS,
  weekOfStart,
  weekStartOf,
  type EditAction,
  type ProjectedEntry,
} from "@/lib/timetable/data"
import {
  contentSource,
  perLabel,
  diffFor,
  isPending,
  latestSeq,
  releaseBySeq,
  schLabel,
  schoolWeekEntries,
  teacherCurrent,
  teacherDraftWeekEntries,
  teacherWeekEntries,
  useTimetable,
  weekConflicts,
} from "@/lib/timetable/store"
import { AlertTriangle, Check, ChevronLeft, ChevronRight, GitCompare, PencilLine, RefreshCw, RotateCcw, Sparkles, Undo2, Upload, X } from "lucide-react"
import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { safeQuery } from "@/lib/mt/display"

/** Back action follows the real entry source; sidebar/direct entries get none. */
function myTimetableBack(from: string | null, back: string | null, canGovern: boolean) {
  if (from === "schedule") {
    const q = safeQuery(back, ["week", "class", "task", "view", "q", "status"])
    return { href: `/teaching${q ? `?${q}` : ""}`, label: "返回我的教学" }
  }
  if (from === "teaching") return { href: "/teaching", label: "返回我的教学" }
  if (from === "center" && canGovern) return { href: "/timetable", label: "返回课表中心" }
  return null
}
import { useDemo } from "@/lib/demo/store"
import { PERSONAS } from "@/lib/demo/nav"

export default function MyTimetablePage() {
  return (
    <Suspense fallback={null}>
      <MyTimetableContent />
    </Suspense>
  )
}

function MyTimetableContent() {
  const tt = useTimetable()
  const router = useRouter()
  const { push } = useToast()
  const { persona } = useDemo()
  const canGovern = PERSONAS[persona].admin
  const searchParams = useSearchParams()
  const backTarget = myTimetableBack(searchParams.get("from"), searchParams.get("back"), canGovern)

  const teacherId = tt.persona === "admin" ? tt.selectedTeacher : tt.persona
  const teacher = TEACHERS.find((t) => t.id === teacherId)!

  const weekParam = searchParams.get("week")
  const syncedWeekParam = useRef<string | null>(null)
  const setWeekStartRef = useRef(tt.setWeekStart)
  setWeekStartRef.current = tt.setWeekStart
  useEffect(() => {
    if (!tt.hydrated || !weekParam || syncedWeekParam.current === weekParam) return
    syncedWeekParam.current = weekParam
    if (WEEKS.some((w) => w.start === weekParam)) setWeekStartRef.current(weekParam)
  }, [weekParam, tt.hydrated])

  const [mode, setMode] = useState<"my" | "school" | "compare">("my")
  const [detail, setDetail] = useState<ProjectedEntry | null>(null)
  const detailOwn = !!detail && mode === "my" && detail.teacherId === teacherId && detail.kind !== "activity" && !!detail.taskId
  // 观察作者与日卡/周课表同源（MT 身份），避免同一老师在完整课表中被判为“他人记录”
  const mtTeacherId = useTeacherId()
  const detailTask = detailOwn ? taskById(detail!.taskId!) ?? null : null
  const detailPeriod = detailOwn ? periodById(detail!.periodId) : undefined
  const detailLesson = detailTask && detailPeriod ? findEffectiveLesson(detailTask.id, detail!.date, detailPeriod.no) : null
  const [editEntry, setEditEntry] = useState<ProjectedEntry | null>(null)
  const [dualColumn, setDualColumn] = useState(false)

  const week = weekOfStart(tt.weekStart) ?? WEEKS[1]
  const mt = useMt()
  const clockDate = mt.biz.clock.slice(0, 10)
  const pending = isPending(tt, teacherId)
  const adoption = tt.adoptions[teacherId]
  const editing = !!adoption?.draft?.active
  const savedIdle = !!adoption?.draft && !adoption.draft.active

  const cur = teacherCurrent(tt, teacherId, clockDate)
  const refCur = teacherCurrent(tt, teacherId, tt.weekStart)

  function gotoWeek(delta: number) {
    const idx = WEEKS.findIndex((w) => w.start === tt.weekStart)
    const next = WEEKS[Math.min(WEEKS.length - 1, Math.max(0, idx + delta))]
    tt.setWeekStart(next.start)
  }

  const thisWeek = weekOfStart(weekStartOf(clockDate)) ?? WEEKS.find((w) => clockDate >= w.start && clockDate <= w.end) ?? WEEKS[0]
  const isThisWeek = tt.weekStart === thisWeek.start
  function goThisWeek() {
    tt.setWeekStart(thisWeek.start)
  }

  function onUpdate() {
    const r = tt.oneClickUpdate(teacherId)
    push(r.ok ? `更新成功：${r.msg}` : r.msg)
  }

  const src = contentSource(tt, teacherId)
  const newRel = releaseBySeq(tt, src)

  // 差异确认只对当时的学校发布有效；出现更新的发布时，重新给出醒目提示
  const diffConfirmedForCurrent =
    !!adoption?.confirmedDiff && (adoption?.confirmedDiffSeq ?? -1) >= src

  return (
    <div>
      <PageHeader
        title="我的课表"
        desc={`${teacher.name} · ${teacher.subject} · 查看本人已应用课表、采用学校更新、拖拽记录个人调整`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/timetable/my/import")}>
              <Upload className="size-3.5" />导入 Excel
            </Button>
            {backTarget ? (
              <Button variant="outline" size="sm" onClick={() => router.push(backTarget.href)}>
                {backTarget.label}
              </Button>
            ) : null}
          </div>
        }
      />

      <TimetableDemoBar />

      {pending && refCur.kind === "ok" && !editing && !diffConfirmedForCurrent ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] px-4 py-3">
          <Sparkles className="size-4 text-[#7a5514]" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[#7a5514]">
              学校有新版 <span className="rounded bg-[#7a5514] px-1.5 py-0.5 text-[12px] font-semibold text-[#fbf7ee]">{newRel?.id}</span>（{newRel?.effectiveDate} 起生效），你当前使用 <span className="rounded bg-[#e8ddc2] px-1.5 py-0.5 text-[12px] font-semibold text-[#5b3f0e]">{perLabel(teacherId, refCur.rev.perSeq)}</span>
            </p>
            <p className="mt-0.5 text-[12px] text-[#7a5514]/80">
              未采用前，你的课表不会被暗中改动；更新只影响生效日之后，保留你的个人调整并需要你确认合法差异。
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setMode("compare")}><GitCompare className="size-3.5" />先对比</Button>
            <Button size="sm" onClick={onUpdate}><RefreshCw className="size-3.5" />一键更新</Button>
          </div>
        </div>
      ) : pending && refCur.kind === "ok" && !editing && diffConfirmedForCurrent ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-[12px] text-muted-foreground">
          <Check className="size-3.5 text-[#7a5514]" />
          <span>
            当前使用 <strong className="text-foreground">{perLabel(teacherId, refCur.rev.perSeq)}</strong>，与学校新版 <strong className="text-foreground">{newRel?.id}</strong> 存在合法差异（已确认保留，双方无改动）。
          </span>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="xs" onClick={() => setMode("compare")}><GitCompare className="size-3 mr-1" />重新对比</Button>
            <Button variant="outline" size="xs" onClick={onUpdate}><RefreshCw className="size-3 mr-1" />采用学校新版</Button>
          </div>
        </div>
      ) : null}

      {/* 工具栏 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => gotoWeek(-1)} aria-label="上一周"><ChevronLeft className="size-4" /></Button>
          <span className="min-w-[132px] text-center text-[13px] font-medium">第{week.no}周 · {fmtDate(week.start)}–{fmtDate(week.end)}</span>
          <Button variant="outline" size="icon" onClick={() => gotoWeek(1)} aria-label="下一周"><ChevronRight className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={goThisWeek} disabled={isThisWeek}>本周</Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {savedIdle && adoption?.draft ? (
            <div className="flex items-center gap-1 rounded-md border border-[#e6d4a8] bg-[#fbf7ee] px-2 py-1 text-[12px] text-[#7a5514]">
              <PencilLine className="size-3" />
              <span className="font-medium">有草稿：{adoption.draft.edits.length} 处</span>
              <Button variant="ghost" size="xs" className="text-[#7a5514] hover:bg-[#f2e6c9]" onClick={() => { tt.discardDraft(teacherId); push("已放弃本轮草稿") }}>放弃</Button>
              <Button variant="ghost" size="xs" className="text-[#7a5514] hover:bg-[#f2e6c9]" onClick={() => { tt.beginDraft(teacherId); push("已继续编辑草稿") }}>编辑</Button>
              <Button size="xs" onClick={() => { const r = tt.applyDraft(teacherId); push(r.msg) }}>发布</Button>
            </div>
          ) : null}
          {editing && ((adoption?.applyUndo?.length ?? 0) > 0 || (adoption?.applyRedo?.length ?? 0) > 0) ? (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="撤销采用"
                title="撤销应用"
                disabled={(adoption?.applyUndo?.length ?? 0) === 0}
                onClick={() => { const r = tt.undoApply(teacherId); push(r.msg) }}
              >
                <Undo2 className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="回退撤销"
                title="回退撤销"
                disabled={(adoption?.applyRedo?.length ?? 0) === 0}
                onClick={() => { const r = tt.redoApply(teacherId); push(r.msg) }}
              >
                <RotateCcw className="size-4" />
              </Button>
            </div>
          ) : null}
          <Segmented
            ariaLabel="视图"
            value={mode}
            onChange={(v) => setMode(v)}
            options={[
              { value: "my", label: "我的课表" },
              { value: "school", label: "学校课表" },
              { value: "compare", label: "差异对比" },
            ]}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={mode !== "my" || cur.kind !== "ok" || editing}
            onClick={() => { tt.beginDraft(teacherId); push("已进入手动调整：拖拽课卡到空闲格，或点击课卡改教室/删除") }}
          >
            <PencilLine className="size-3.5" />手动调整
          </Button>
        </div>
      </div>

      {mode === "my" ? (
        editing ? (
          <EditView teacherId={teacherId} weekStart={tt.weekStart} clockDate={clockDate} onCard={setEditEntry} />
        ) : (
          <MyView teacherId={teacherId} weekStart={tt.weekStart} clockDate={clockDate} onCard={setDetail} />
        )
      ) : mode === "school" ? (
        <SchoolPeekView teacherId={teacherId} weekStart={tt.weekStart} clockDate={clockDate} onCard={setDetail} />
      ) : (
        <CompareView teacherId={teacherId} weekStart={tt.weekStart} pending={pending} dualColumn={dualColumn} onToggleColumns={() => setDualColumn((v) => !v)} onUpdate={onUpdate} onKept={() => setMode("my")} />
      )}

      {detailLesson && detailTask ? (
        <LessonDetail
          lesson={detailLesson}
          task={detailTask}
          teacherId={mtTeacherId ?? teacherId}
          back={`week=${weekOfDate(detailLesson.actual_date)}`}
          onClose={() => setDetail(null)}
        />
      ) : (
        <CardDetail
          entry={detail}
          open={!!detail}
          onClose={() => setDetail(null)}
          recordClockDate={mode === "my" && detail?.teacherId === teacherId ? clockDate : undefined}
        />
      )}

      {editing && adoption?.draft ? (
        <LessonDialog
          teacherId={teacherId}
          mode="edit"
          entry={editEntry}
          cell={null}
          open={!!editEntry}
          onClose={() => setEditEntry(null)}
          scope={adoption.draft.scope}
          effectiveDate={adoption.draft.effectiveDate}
          effectiveTo={adoption.draft.effectiveTo}
          onScope={(s, from, to) => tt.setDraftScope(teacherId, s, from, to)}
          onEdit={(patch) => submitEdit(tt, teacherId, editEntry, patch, push)}
          onRemove={() => removeEdit(tt, teacherId, editEntry, push)}
        />
      ) : null}
    </div>
  )
}

function submitEdit(
  tt: ReturnType<typeof useTimetable>,
  teacherId: string,
  entry: ProjectedEntry | null,
  patch: {
    action: EditAction
    weekday: number
    periodId: string
    room: string | null
    className?: string
    subject?: string
    group?: string
    note?: string
    noteShow?: boolean
    displayMode?: import("@/lib/timetable/data").DisplayMode
    customLabel?: string
  },
  push: (m: string) => void,
) {
  if (!entry) return { ok: false, msg: "无课次" }
  const r = tt.draftEdit(teacherId, entry, patch)
  push(r.msg)
  return r
}

function removeEdit(tt: ReturnType<typeof useTimetable>, teacherId: string, entry: ProjectedEntry | null, push: (m: string) => void) {
  if (!entry) return { ok: false, msg: "无课次" }
  const r = tt.draftEdit(teacherId, entry, { action: "remove", weekday: entry.weekday, periodId: entry.periodId, room: entry.room ?? null })
  push(r.msg)
  return r
}

/* 编辑（草稿）视图：拖拽 + 点击弹窗编辑 */
function EditView({ teacherId, weekStart, clockDate, onCard }: { teacherId: string; weekStart: string; clockDate: string; onCard: (e: ProjectedEntry) => void }) {
  const tt = useTimetable()
  const { push } = useToast()
  const [addCell, setAddCell] = useState<{ weekday: number; periodId: string; date: string } | null>(null)
  const adoption = tt.adoptions[teacherId]
  const draft = adoption?.draft
  const { entries, draftKeys } = teacherDraftWeekEntries(tt, teacherId, weekStart)
  const conflicts = weekConflicts(entries)

  if (!draft) return null
  const dirty = draft.edits.length > 0

  return (
    <>
      <div className="mb-2 rounded-lg border border-primary/40 bg-accent/60 px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
          <Badge tone="primary">正在调整</Badge>
          <span className="text-muted-foreground">作用范围</span>
          <Segmented
            size="sm"
            ariaLabel="生效范围"
            value={draft.scope}
            onChange={(v) => tt.setDraftScope(teacherId, v as "once" | "range")}
            options={[
              { value: "once", label: "仅本次" },
              { value: "range", label: "固定区间" },
            ]}
          />
          {draft.scope === "range" ? (
            <input
              type="date"
              value={draft.effectiveDate}
              onChange={(e) => tt.setDraftScope(teacherId, "range", e.target.value)}
              className="rounded-md border border-input bg-card px-2 py-1 text-[12px]"
            />
          ) : null}
          <span className="text-muted-foreground">
            {dirty ? `本轮 ${draft.edits.length} 处改动` : "尚无改动"} · {draft.savedAt ? `草稿已保存 ${fmtClock(draft.savedAt)}（未应用）` : "草稿未保存"}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="ghost" size="xs" disabled={!dirty} onClick={() => { tt.undoDraft(teacherId); push("已撤销上一步") }}><Undo2 className="size-3 mr-1" />撤销</Button>
            <Button variant="ghost" size="xs" onClick={() => { tt.discardDraft(teacherId); push("已放弃本轮草稿") }}><X className="size-3 mr-1" />放弃</Button>
            <Button variant="outline" size="xs" disabled={!dirty} onClick={() => { tt.saveDraft(teacherId); push("草稿已保存，尚未应用；刷新后可恢复") }}>保存草稿</Button>
            <Button size="xs" disabled={!dirty} onClick={() => { const r = tt.applyDraft(teacherId); push(r.msg) }}><Check className="size-3 mr-1" />确认应用</Button>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          拖动课卡到空闲格移动；点击课卡可改教室或删除；点击空闲格的「+」可新增课次；草稿仅本人可见，教务看到的现用安排不变，直至你确认应用。所有课次均可本地编排，最终以确认应用为准。
        </p>
      </div>

      {conflicts.length ? <ConflictBar count={conflicts.length} /> : null}

      <WeekGrid
        weekStart={weekStart}
        entries={entries}
        clockDate={clockDate}
        editing
        draftKeys={draftKeys}
        makeupEdits={[...(adoption?.personalEdits ?? []), ...draft.edits]}
        onCardClick={onCard}
        onMove={(entry, weekday, periodId) => {
          const r = tt.draftEdit(teacherId, entry, { action: "move", weekday, periodId, room: entry.room ?? null })
          push(r.msg)
        }}
        onAddCell={(weekday, periodId, date) => setAddCell({ weekday, periodId, date })}
      />

      <LessonDialog
        teacherId={teacherId}
        mode="create"
        entry={null}
        cell={addCell}
        open={!!addCell}
        onClose={() => setAddCell(null)}
        scope={draft?.scope ?? "once"}
        effectiveDate={draft?.effectiveDate}
        effectiveTo={draft?.effectiveTo}
        onScope={(s, from, to) => tt.setDraftScope(teacherId, s, from, to)}
        defaultSubject={TEACHERS.find((t) => t.id === teacherId)?.subject ?? ""}
        onCreate={(data) => {
          if (!addCell) return { ok: false, msg: "无落点" }
          const r = tt.draftAdd(teacherId, addCell, data)
          push(r.msg)
          return r
        }}
      />
    </>
  )
}

function MyView({ teacherId, weekStart, clockDate, onCard }: { teacherId: string; weekStart: string; clockDate: string; onCard: (e: ProjectedEntry) => void }) {
  const tt = useTimetable()
  const { push } = useToast()
  const refCur = teacherCurrent(tt, teacherId, weekStart)
  const adoption = tt.adoptions[teacherId]
  const { entries, multiVersion } = teacherWeekEntries(tt, teacherId, weekStart)
  const conflicts = weekConflicts(entries).length

  if (refCur.kind === "no_account") return <StateBox title="无账号" desc="该演示教师无账号，无法查看个人课表。" />
  if (refCur.kind === "load_error") {
    return (
      <StateBox
        title="读取失败"
        desc="未能取得你的当前课表；系统不会用学校最新版冒充你的现用安排。请重试。"
        action={<Button variant="outline" size="sm" onClick={() => tt.refreshCache()}><RefreshCw className="size-3.5" />重试</Button>}
      />
    )
  }
  if (refCur.kind === "no_personal") return <StateBox title="尚无个人课表" desc="你还没有可用的采用来源。请在“对比学校版”中采用学校发布。" />

  const hasConfirmable = isPending(tt, teacherId) && !adoption?.confirmedDiff

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px]">
        <span className="font-medium text-foreground">个人使用版 {perLabel(teacherId, refCur.rev.perSeq)}</span>
        <span className="text-muted-foreground">来源 {schLabel(refCur.rev.sourceSch)}</span>
        <span className="text-muted-foreground">应用时间 {fmtClock(refCur.rev.appliedAt)}</span>
        {adoption && adoption.personalEdits.length ? (
          <Badge tone="warning">个人调整 {adoption.personalEdits.length} 处{adoption.confirmedDiff ? " · 已确认" : ""}</Badge>
        ) : null}
        {multiVersion ? <Badge tone="info">本周含 2 段版本</Badge> : null}
      </div>

      {hasConfirmable ? (
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] px-3 py-2 text-[12px]">
          <span className="text-[#7a5514]">存在学校新版与你现用的合法差异。你可以在不改变任一侧的前提下，单方确认“已知晓并保留”。</span>
          <Button variant="ghost" size="xs" className="ml-auto" onClick={() => { tt.confirmDiff(teacherId); push("已确认知晓合法差异，双方均无改动") }}><Check className="size-3 mr-1" />确认合法差异</Button>
        </div>
      ) : null}

      {conflicts ? <ConflictBar count={conflicts} /> : null}
      <WeekGrid weekStart={weekStart} entries={entries} clockDate={clockDate} onCardClick={onCard} recordable makeupEdits={adoption?.personalEdits ?? []} />
    </>
  )
}

function SchoolPeekView({ teacherId, weekStart, clockDate, onCard }: { teacherId: string; weekStart: string; clockDate: string; onCard: (e: ProjectedEntry) => void }) {
  const tt = useTimetable()
  const { push } = useToast()
  const seq = latestSeq(tt)
  const entries = schoolWeekEntries(tt, teacherId, weekStart, seq)
  const conflicts = weekConflicts(entries).length

  // 是否可“应用学校课表”：有个人调整，或学校已有更靠后的来源版可重挂
  const adoption = tt.adoptions[teacherId]
  const src = contentSource(tt, teacherId)
  const adoptedMax = (adoption?.revisions ?? []).reduce((m, r) => Math.max(m, r.sourceSch), 0)
  const canResetToSchool = (adoption?.personalEdits.length ?? 0) > 0 || src > adoptedMax

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px]">
        <span className="font-medium text-foreground">学校发布版 {schLabel(seq)}</span>
        <span className="text-muted-foreground">这是教务处发布的最新学校课表（只读），不含你的个人调整。</span>
        {canResetToSchool ? (
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={() => { const r = tt.resetToSchool(teacherId); push(r.msg) }}
            title="放弃全部个人调整，应用学校最新课表（可撤销）"
          >
            <RotateCcw className="size-3.5" />应用学校课表
          </Button>
        ) : null}
      </div>
      {conflicts ? <ConflictBar count={conflicts} /> : null}
      <WeekGrid weekStart={weekStart} entries={entries} clockDate={clockDate} onCardClick={onCard} />
      <p className="mt-2 text-[11px] text-muted-foreground">学校课表为只读视图。要把它变成你的现用安排，请到“差异对比”里选择“采用学校新版”。</p>
    </>
  )
}

function CompareView({ teacherId, weekStart, pending, dualColumn, onToggleColumns, onUpdate, onKept }: { teacherId: string; weekStart: string; pending: boolean; dualColumn: boolean; onToggleColumns: () => void; onUpdate: () => void; onKept: () => void }) {
  const tt = useTimetable()
  const { push } = useToast()
  const res = diffFor(tt, teacherId, weekStart)
  const cur = teacherCurrent(tt, teacherId, weekStart)

  if (!res || cur.kind !== "ok") return <StateBox title="无法对比" desc="你的当前课表不可用（尚无个人课表 / 读取失败）。" />
  const changed = changedRows(res.rows)

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px]">
        <span className="text-muted-foreground">学校发布版 <strong className="text-foreground">{schLabel(res.schSeq)}</strong></span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground">我的 <strong className="text-foreground">{perLabel(teacherId, cur.rev.perSeq)}</strong> · 来源 {schLabel(cur.rev.sourceSch)}</span>
        <Button variant="ghost" size="xs" className="ml-auto" onClick={onToggleColumns}>{dualColumn ? "变化清单" : "双栏课表"}</Button>
      </div>
      <div className="mb-2 text-[12px] text-muted-foreground">{changed.length ? `共 ${changed.length} 处差异` : "两侧一致，无差异"}</div>
      {dualColumn ? (
        <DiffColumns rows={res.rows} schoolTitle={`学校 ${schLabel(res.schSeq)}`} personalTitle={`我的 ${perLabel(teacherId, cur.rev.perSeq)}`} />
      ) : (
        <DiffList rows={res.rows} emptyText="两侧一致，无差异" />
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {pending ? <Button size="sm" onClick={onUpdate}><RefreshCw className="size-3.5" />采用学校新版</Button> : null}
        {changed.length ? (
          <Button variant="outline" size="sm" onClick={() => { tt.confirmDiff(teacherId); push("已确认知晓合法差异，已返回我的课表"); onKept() }}><Check className="size-3.5" />确认保留（单方，不改两侧）</Button>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">采用只影响生效日之后，且保留你的个人调整；确认保留不改变学校版也不改变你的现用安排。</p>
    </>
  )
}

function ConflictBar({ count }: { count: number }) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#eec4bf] bg-[#fbe6e4] px-3 py-1.5 text-[12px] text-[#9a2b22]">
      <AlertTriangle className="size-3.5" />
      检测到 {count} 项资源冲突（点击课卡查看详情）
    </div>
  )
}

function StateBox({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#e6d4a8] bg-[#fbf7ee] px-6 py-12 text-center">
      <p className="text-[14px] font-medium">{title}</p>
      <p className="mt-1 max-w-md text-[13px] text-muted-foreground">{desc}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
