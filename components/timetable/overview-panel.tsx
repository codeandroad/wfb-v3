"use client"

import { Badge, Input, Segmented, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { CardDetail, DiffColumns, DiffList } from "@/components/timetable/detail"
import { LessonDialog } from "@/components/timetable/lesson-dialog"
import { DraftTray } from "@/components/timetable/school-drafts"
import { TeacherLink } from "@/components/profile/teacher-link"
import { WeekGrid } from "@/components/timetable/week-grid"
import { cn } from "@/lib/utils"
import {
  ADMIN_CLASSES,
  changedRows,
  fmtClock,
  fmtDate,
  TEACHERS,
  TEACHING_CLASSES,
  teacherById,
  WEEKS,
  weekOfStart,
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
  schoolDraftWeekEntries,
  schoolWeekEntries,
  teacherCurrent,
  teacherWeekEntries,
  useTimetable,
  weekConflicts,
} from "@/lib/timetable/store"
import { AlertTriangle, Check, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, PencilLine, RefreshCw, Search, Send, Undo2, X } from "lucide-react"
import { useState } from "react"

type Mode = "school" | "teacher" | "diff"
type ObjKind = "teacher" | "class" | "admin"

interface ObjItem {
  id: string
  name: string
  sub: string
  teacherId: string
}

export function OverviewPanel() {
  const tt = useTimetable()
  const [mode, setMode] = useState<Mode>("school")
  const [objKind, setObjKind] = useState<ObjKind>("teacher")
  const [adminClassId, setAdminClassId] = useState<string>(ADMIN_CLASSES[0].id)
  const [barOpen, setBarOpen] = useState(true)
  const [q, setQ] = useState("")
  const [detail, setDetail] = useState<ProjectedEntry | null>(null)
  const [schoolEditEntry, setSchoolEditEntry] = useState<ProjectedEntry | null>(null)
  const [schoolAddCell, setSchoolAddCell] = useState<{ weekday: number; periodId: string; date: string } | null>(null)
  const [dualColumn, setDualColumn] = useState(false)

  const week = weekOfStart(tt.weekStart) ?? WEEKS[1]
  const clockDate = tt.clock.slice(0, 10)
  const teacherId = tt.selectedTeacher
  const teacher = TEACHERS.find((t) => t.id === teacherId)
  const schoolDraft = tt.schoolDrafts[teacherId] ?? null

  const filteredTeachers = TEACHERS.filter((t) => !q || t.name.includes(q) || t.subject.includes(q))
  const filteredClasses = TEACHING_CLASSES.filter((c) => !q || c.name.includes(q) || c.subject.includes(q))
  const filteredAdmin = ADMIN_CLASSES.filter((c) => !q || c.name.includes(q) || c.grade.includes(q))
  const adminClass = ADMIN_CLASSES.find((c) => c.id === adminClassId)
  const showAdmin = objKind === "admin" && !!adminClass

  const items: ObjItem[] =
    objKind === "teacher"
      ? filteredTeachers.map((t) => ({ id: t.id, name: t.name, sub: t.subject, teacherId: t.id }))
      : objKind === "class"
        ? filteredClasses.map((c) => ({ id: c.id, name: c.name, sub: c.subject, teacherId: c.teacherIds[0] }))
        : filteredAdmin.map((c) => ({ id: c.id, name: c.name, sub: `${c.grade} · ${c.memberTeacherIds.length} 位任课教师`, teacherId: c.memberTeacherIds[0] }))

  function gotoWeek(delta: number) {
    const idx = WEEKS.findIndex((w) => w.start === tt.weekStart)
    const next = WEEKS[Math.min(WEEKS.length - 1, Math.max(0, idx + delta))]
    tt.setWeekStart(next.start)
  }

  return (
    <div className="flex gap-4">
      {barOpen ? (
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
              <Segmented
                size="sm"
                ariaLabel="对象类型"
                value={objKind}
                onChange={(v) => setObjKind(v)}
                options={[
                  { value: "teacher", label: "教师" },
                  { value: "class", label: "教学班" },
                  { value: "admin", label: "行政班" },
                ]}
              />
            </div>
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="筛选对象" className="h-8 pl-8 text-[13px]" />
              </div>
            </div>
            <ul className="max-h-[560px] overflow-y-auto p-1.5">
              {items.map((o) => {
                const active = objKind === "admin" ? adminClassId === o.id : objKind === "teacher" ? teacherId === o.id : teacherId === o.teacherId
                const pending = objKind === "teacher" && isPending(tt, o.id)
                const noAccount = objKind === "teacher" && TEACHERS.find((t) => t.id === o.id)?.hasAccount === false
                const draft = objKind === "teacher" ? tt.schoolDrafts[o.id] : undefined
                return (
                  <li key={o.id}>
                    <button
                      aria-current={active ? "true" : undefined}
                      onClick={() => {
                        if (objKind === "admin") setAdminClassId(o.id)
                        else tt.setSelectedTeacher(o.teacherId)
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                        active ? "bg-accent text-foreground" : "hover:bg-muted/60",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{o.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{o.sub}</p>
                      </div>
                      {draft ? <Badge tone={draft.active !== false ? "primary" : "warning"}>{draft.active !== false ? "编辑中" : `草稿 ${draft.edits.length}`}</Badge> : null}
                      {pending ? <Badge tone="warning">待更新</Badge> : null}
                      {noAccount ? <Badge tone="neutral">无账号</Badge> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </aside>
      ) : null}

      <div className="min-w-0 flex-1">
        <DraftTray
          currentTeacherId={objKind === "teacher" && !showAdmin && mode === "school" ? teacherId : ""}
          onPickTeacher={(id) => { setObjKind("teacher"); setMode("school"); tt.setSelectedTeacher(id) }}
        />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setBarOpen((v) => !v)} className="hidden lg:inline-flex" aria-label={barOpen ? "收起对象栏" : "展开对象栏"}>
            {barOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => gotoWeek(-1)} aria-label="上一周"><ChevronLeft className="size-4" /></Button>
            <span className="min-w-[132px] text-center text-[13px] font-medium">第{week.no}周 · {fmtDate(week.start)}–{fmtDate(week.end)}</span>
            <Button variant="outline" size="icon" onClick={() => gotoWeek(1)} aria-label="下一周"><ChevronRight className="size-4" /></Button>
            <Button variant="ghost" size="xs" onClick={() => tt.advanceClockTo(clockDate)}>本周</Button>
          </div>
          <div className={cn("ml-auto", showAdmin && "hidden")}>
            <Segmented
              ariaLabel="视图"
              value={mode}
              onChange={(v) => setMode(v)}
              options={[
                { value: "school", label: "学校发布" },
                { value: "teacher", label: "教师当前" },
                { value: "diff", label: "差异对比" },
              ]}
            />
          </div>
        </div>

        {showAdmin ? (
          <AdminClassView adminClassId={adminClass.id} weekStart={tt.weekStart} clockDate={clockDate} onCard={setDetail} />
        ) : (
          <>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-[15px] font-semibold">
            <TeacherLink teacherId={teacherId} className="hover:text-primary hover:underline">
              {teacher?.name}
            </TeacherLink>
          </h3>
          <Badge tone="neutral">{teacher?.subject}</Badge>
          {mode !== "school" ? <Badge tone="info">教务只读</Badge> : null}
        </div>

        {mode === "school" ? (
          <SchoolView
            teacherId={teacherId}
            weekStart={tt.weekStart}
            clockDate={clockDate}
            onReadCard={setDetail}
            onEditCard={setSchoolEditEntry}
            onAddCell={(weekday, periodId, date) => setSchoolAddCell({ weekday, periodId, date })}
          />
        ) : null}
        {mode === "teacher" ? <TeacherCurrentView teacherId={teacherId} weekStart={tt.weekStart} clockDate={clockDate} onCard={setDetail} /> : null}
        {mode === "diff" ? <DiffView teacherId={teacherId} weekStart={tt.weekStart} dualColumn={dualColumn} onToggleColumns={() => setDualColumn((v) => !v)} /> : null}
          </>
        )}
      </div>

      <CardDetail entry={detail} open={!!detail} onClose={() => setDetail(null)} />

      {schoolDraft ? (
        <>
          <LessonDialog
            actor="admin"
            teacherId={teacherId}
            mode="edit"
            entry={schoolEditEntry}
            cell={null}
            open={!!schoolEditEntry}
            onClose={() => setSchoolEditEntry(null)}
            scope="range"
            scopeLocked
            effectiveDate={schoolDraft.effectiveDate}
            effectiveTo={schoolDraft.effectiveTo}
            onEdit={(patch) => schoolSubmit(tt, schoolEditEntry, patch)}
            onRemove={() => schoolRemove(tt, schoolEditEntry)}
          />
          <LessonDialog
            actor="admin"
            teacherId={teacherId}
            mode="create"
            entry={null}
            cell={schoolAddCell}
            open={!!schoolAddCell}
            onClose={() => setSchoolAddCell(null)}
            scope="range"
            scopeLocked
            effectiveDate={schoolDraft.effectiveDate}
            effectiveTo={schoolDraft.effectiveTo}
            defaultSubject={teacher?.subject ?? ""}
            onCreate={(data) => {
              if (!schoolAddCell) return { ok: false, msg: "无落点" }
              return tt.schoolDraftAdd(teacherId, schoolAddCell, data)
            }}
          />
        </>
      ) : null}
    </div>
  )
}

function schoolSubmit(
  tt: ReturnType<typeof useTimetable>,
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
) {
  if (!entry) return { ok: false, msg: "无课次" }
  return tt.schoolDraftEdit(tt.selectedTeacher, entry, patch)
}
function schoolRemove(tt: ReturnType<typeof useTimetable>, entry: ProjectedEntry | null) {
  if (!entry) return { ok: false, msg: "无课次" }
  return tt.schoolDraftEdit(tt.selectedTeacher, entry, { action: "remove", weekday: entry.weekday, periodId: entry.periodId, room: entry.room ?? null })
}

function AdminClassView({ adminClassId, weekStart, clockDate, onCard }: { adminClassId: string; weekStart: string; clockDate: string; onCard: (e: ProjectedEntry) => void }) {
  const tt = useTimetable()
  const ac = ADMIN_CLASSES.find((c) => c.id === adminClassId)
  if (!ac) return null
  const seq = latestSeq(tt)
  const entries = ac.memberTeacherIds.flatMap((tid) => schoolWeekEntries(tt, tid, weekStart, seq))
  const conflicts = weekConflicts(entries).length

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold">{ac.name}</h3>
        <Badge tone="neutral">{ac.grade}</Badge>
        <Badge tone="info">聚合只读</Badge>
      </div>
      <SourceBar tone={conflicts ? "warning" : "default"}>
        <span>
          任课教师：
          {ac.memberTeacherIds.map((tid, i) => (
            <span key={tid}>
              {i > 0 ? "、" : null}
              <TeacherLink teacherId={tid} className="hover:text-primary hover:underline">
                {teacherById(tid)?.name}
              </TeacherLink>
            </span>
          ))}
        </span>
        <span className="text-muted-foreground">本周 {entries.length} 节</span>
        {conflicts ? (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <AlertTriangle className="size-3.5" />学生时间冲突 {conflicts} 处
          </span>
        ) : null}
        <span className="ml-auto text-muted-foreground">由所含教学任务的学校发布版聚合；修改请切到对应教师或教学班。</span>
      </SourceBar>
      <WeekGrid weekStart={weekStart} entries={entries} clockDate={clockDate} onCardClick={onCard} />
    </>
  )
}

function SourceBar({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "warning" }) {
  return (
    <div className={cn("mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-[12px]", tone === "warning" ? "border-[#e6d4a8] bg-[#fbf7ee]" : "border-border bg-muted/40")}>
      {children}
    </div>
  )
}

function SchoolView({ teacherId, weekStart, clockDate, onReadCard, onEditCard, onAddCell }: { teacherId: string; weekStart: string; clockDate: string; onReadCard: (e: ProjectedEntry) => void; onEditCard: (e: ProjectedEntry) => void; onAddCell: (weekday: number, periodId: string, date: string) => void }) {
  const tt = useTimetable()
  const { push } = useToast()
  const seq = latestSeq(tt)
  const src = contentSource(tt, teacherId)
  const rel = releaseBySeq(tt, src)
  const baseRel = releaseBySeq(tt, seq)

  const ownDraft = tt.schoolDrafts[teacherId] ?? null
  // 编辑态：草稿激活中；完成后退出编辑，草稿保留在顶部托盘等待统一发布
  const editing = !!ownDraft && ownDraft.active !== false
  const savedIdle = !!ownDraft && ownDraft.active === false
  const editCount = ownDraft?.edits.length ?? 0

  const readOnlyEntries = schoolWeekEntries(tt, teacherId, weekStart, seq)
  // 已保存草稿也按草稿投影展示，便于核对待发布内容
  const draftProjection = ownDraft ? schoolDraftWeekEntries(tt, teacherId, weekStart, ownDraft.baseSeq) : null
  const entries = draftProjection ? draftProjection.entries : readOnlyEntries
  const conflicts = weekConflicts(entries)
  const dirty = editCount > 0

  return (
    <>
      {editing ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-primary/40 bg-accent/60 px-3 py-2 text-[12px]">
          <Badge tone="primary">编辑中</Badge>
          <span className="text-muted-foreground">基于 {schLabel(ownDraft!.baseSeq)} · {dirty ? `${editCount} 处改动` : "尚无��动"}</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button variant="ghost" size="xs" disabled={!dirty} onClick={() => { tt.undoSchoolDraft(teacherId); push("已撤销上一步") }}><Undo2 className="size-3 mr-1" />撤销</Button>
            <Button variant="ghost" size="xs" onClick={() => { tt.discardSchoolDraft(teacherId); push("已放弃该教师草稿") }}><X className="size-3 mr-1" />放弃</Button>
            <Button size="xs" onClick={() => { tt.saveSchoolDraft(teacherId); push(dirty ? "已加入待发布草稿" : "已退出编辑") }}><Check className="size-3 mr-1" />完成</Button>
          </div>
        </div>
      ) : savedIdle ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-[#e6d4a8] bg-[#fbf3e2] px-3 py-2 text-[12px] text-[#7a5514]">
          <Badge tone="warning">草稿 · 待发布</Badge>
          <span>基于 {schLabel(ownDraft!.baseSeq)} · {editCount} 处改动{ownDraft!.savedAt ? ` · ${fmtClock(ownDraft!.savedAt)}` : ""}</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button variant="ghost" size="xs" className="text-[#7a5514] hover:bg-[#f3e6c8] hover:text-[#7a5514]" onClick={() => { tt.discardSchoolDraft(teacherId); push("已放弃该教师草稿") }}><X className="size-3 mr-1" />放弃</Button>
            <Button variant="outline" size="xs" onClick={() => tt.beginSchoolDraft(teacherId, weekStart)}><PencilLine className="size-3 mr-1" />继续编辑</Button>
          </div>
        </div>
      ) : (
        <SourceBar>
          <span className="font-medium text-foreground">学校发布版 {schLabel(seq)}</span>
          <span className="text-muted-foreground">发布时间 {baseRel ? fmtClock(baseRel.publishedAt) : "—"}</span>
          <span className="text-muted-foreground">生效 {baseRel?.effectiveDate}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">该教师内容来源 {schLabel(src)}</span>
          {src !== seq ? <Badge tone="neutral">未随最新全校发布变化</Badge> : null}
          <Button variant="outline" size="xs" className="ml-auto" onClick={() => tt.beginSchoolDraft(teacherId, weekStart)}>
            <PencilLine className="size-3 mr-1" />调整课表
          </Button>
        </SourceBar>
      )}

      {conflicts.length ? <ConflictBar count={conflicts.length} /> : null}
      <WeekGrid
        key={`${teacherId}:${editing}`}
        weekStart={weekStart}
        entries={entries}
        clockDate={clockDate}
        editing={editing}
        draftKeys={draftProjection?.draftKeys}
        onCardClick={editing ? onEditCard : onReadCard}
        onMove={editing ? (entry, weekday, periodId) => {
          const r = tt.schoolDraftEdit(teacherId, entry, { action: "move", weekday, periodId, room: entry.room ?? null })
          push(r.msg)
        } : undefined}
        onCopyCell={editing ? (entry, cell) => {
          const r = tt.schoolDraftAdd(teacherId, cell, entry)
          push(r.msg)
          return r
        } : undefined}
        onAddCell={editing ? onAddCell : undefined}
      />
      {!editing ? <p className="mt-2 text-[11px] text-muted-foreground">{rel?.note}</p> : null}
    </>
  )
}

function TeacherCurrentView({ teacherId, weekStart, clockDate, onCard }: { teacherId: string; weekStart: string; clockDate: string; onCard: (e: ProjectedEntry) => void }) {
  const tt = useTimetable()
  const { entries, days, multiVersion } = teacherWeekEntries(tt, teacherId, weekStart)
  const conflicts = weekConflicts(entries)
  const refStatus = teacherCurrent(tt, teacherId, clockDate)
  const firstOk = days.find((d) => d.status.kind === "ok")
  const a = tt.adoptions[teacherId]

  if (refStatus.kind === "no_account") {
    return <StateBox tone="warning" title="该教师无账号" desc="有合法学校安排但无法完成教师端送达/采用，不能显示已读/已采用。请在学校发布模式查看其学校计划。" />
  }
  if (refStatus.kind === "load_error") {
    return (
      <StateBox
        tone="warning"
        title="教师当前读取失败"
        desc={tt.lastCacheAt ? `未取得最新状态；上次取数时间 ${tt.lastCacheAt}。不以学校版冒充教师当前。` : "未能取得教师当前使用课表，不能用学校版冒充。请重试。"}
        action={<Button variant="outline" size="sm" onClick={() => tt.refreshCache()}><RefreshCw className="size-3.5" />重试</Button>}
      />
    )
  }
  if (refStatus.kind === "no_personal") {
    return <StateBox tone="default" title="尚无可用个人课表" desc="该教师暂无学校采用来源，也无已应用个人安排。" />
  }

  const rev = firstOk && firstOk.status.kind === "ok" ? firstOk.status.rev : refStatus.rev
  const pending = isPending(tt, teacherId)

  return (
    <>
      <SourceBar tone={pending ? "warning" : "default"}>
        <span className="font-medium text-foreground">个人使用版 {perLabel(teacherId, rev.perSeq)}</span>
        <span className="text-muted-foreground">来源 {schLabel(rev.sourceSch)}</span>
        <span className="text-muted-foreground">应用时间 {fmtClock(rev.appliedAt)}</span>
        {a && a.personalEdits.length ? <Badge tone="warning">有个人调整 {a.personalEdits.length} 处{a.confirmedDiff ? " · 已确认" : ""}</Badge> : null}
        {multiVersion ? <Badge tone="info">本周含 2 段版本</Badge> : null}
        {pending ? <Badge tone="warning">有学校新版待采用（未暗中回退到学校版）</Badge> : null}
        <Button variant="ghost" size="xs" className="ml-auto" onClick={() => tt.refreshCache()}><RefreshCw className="size-3 mr-1" />刷新</Button>
      </SourceBar>
      {conflicts.length ? <ConflictBar count={conflicts.length} /> : null}
      <WeekGrid weekStart={weekStart} entries={entries} clockDate={clockDate} onCardClick={onCard} canonical />
      <p className="mt-2 text-[11px] text-muted-foreground">教务只读：读取教师已应用的排课字段投影，不含未应用草稿、私人备注或反馈内容；不代教师采用/确认。</p>
    </>
  )
}

function DiffView({ teacherId, weekStart, dualColumn, onToggleColumns }: { teacherId: string; weekStart: string; dualColumn: boolean; onToggleColumns: () => void }) {
  const tt = useTimetable()
  const res = diffFor(tt, teacherId, weekStart)
  const cur = teacherCurrent(tt, teacherId, weekStart)

  if (!res || cur.kind !== "ok") {
    return <StateBox tone="warning" title="无法计算差异" desc="教师当前使用课表不可用（无账号 / 尚无个人课表 / 读取失败），差异需两侧均可解析。" />
  }

  const changed = changedRows(res.rows)

  return (
    <>
      <SourceBar>
        <span className="text-muted-foreground">教务：学校发布版 <strong className="text-foreground">{schLabel(res.schSeq)}</strong></span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground">本人：个人使用版 <strong className="text-foreground">{perLabel(teacherId, cur.rev.perSeq)}</strong> · 来源 {schLabel(cur.rev.sourceSch)}</span>
        <Button variant="ghost" size="xs" className="ml-auto" onClick={onToggleColumns}>{dualColumn ? "切换为变化清单" : "查看双栏课表"}</Button>
      </SourceBar>
      <div className="mb-2 text-[12px] text-muted-foreground">
        {changed.length ? `所选范围共 ${changed.length} 处差异` : "所选范围无差异"}
      </div>
      {dualColumn ? (
        <DiffColumns rows={res.rows} schoolTitle={`学校 ${schLabel(res.schSeq)}`} personalTitle={`我的 ${perLabel(teacherId, cur.rev.perSeq)}`} />
      ) : (
        <DiffList rows={res.rows} />
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">差异来源：未采用新版 / 已应用个人调整 / 已确认保留 / 对应日期暂未生效 / 待核对来源变化。教务在此全为只读，不替教师采用或确认。</p>
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

function StateBox({ tone, title, desc, action }: { tone: "default" | "warning"; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center", tone === "warning" ? "border-[#e6d4a8] bg-[#fbf7ee]" : "border-border bg-muted/30")}>
      <p className="text-[14px] font-medium">{title}</p>
      <p className="mt-1 max-w-md text-[13px] text-muted-foreground">{desc}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
