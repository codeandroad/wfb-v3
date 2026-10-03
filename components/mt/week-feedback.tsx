"use client"

import { Card, EmptyState } from "@/components/kit"
import { RoutineDialog } from "@/components/mt/routine-dialog"
import { AttSelect, FieldMark, GradeSelect, SaveState } from "@/components/mt/shared"
import { Btn } from "@/components/mt/ui"
import { FILTER_LABEL, filterStudents, nameOf, type FilterKey, type TaskWeek } from "@/lib/mt/derive"
import { ReasonInput } from "@/components/mt/student-drawer"
import { ATT_LABEL, ELIG_REASON, taskById } from "@/lib/mt/model"
import { gradeDisplay } from "@/lib/mt/schemes"
import { classroomStandard } from "@/lib/mt/use-schemes"
import {
  entryKeyOf,
  fmtMD,
  homeroomName,
  lessonTimeLabel,
  studentById,
  WEEKDAY_CN,
  weekdayIdx,
  type Attendance,
  type StudentDay,
} from "@/lib/mt/view"
import { scopeTask, useMt, useRecordWriters, useTeacherPrefs } from "@/lib/mt/store"
import { useTeacherId } from "@/lib/mt/derive"
import { Pager } from "@/components/mt/homework"
import { HighlightCell, HomeworkCell, StudentHwDialog } from "@/components/mt/week-columns"
import { pageOf } from "@/lib/mt/hw"
import { cn } from "@/lib/utils"
import { CheckCheck, Search, Users } from "lucide-react"
import { useEffect, useRef, useState } from "react"

export function WeekFeedback({
  tw,
  filter,
  q,
  setQuery,
  onOpen,
}: {
  tw: TaskWeek
  teacherId: string
  filter: FilterKey
  q: string
  setQuery: (patch: Record<string, string | null>) => void
  onOpen: (sid: string, seq: string[]) => void
}) {
  const mt = useMt()
  const [selected, setSelected] = useState<string[]>([])
  const [routine, setRoutine] = useState<null | { sids: string[]; label: string }>(null)
  const keys = Object.keys(FILTER_LABEL) as FilterKey[]
  const [hwSid, setHwSid] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const prefs = useTeacherPrefs(useTeacherId())
  const rows = filterStudents(mt.biz, tw, filter, q)
  const pg = pageOf(rows, page, prefs.pageSize)
  const dates = tw.teachingDates
  const filterKey = `${tw.task.id}|${tw.week}|${filter}|${q}`
  const [lastKey, setLastKey] = useState(filterKey)
  if (lastKey !== filterKey) {
    setLastKey(filterKey)
    setPage(1)
  }
  const scopeSids = selected.length ? selected : tw.students

  return (
    <div className="flex flex-col gap-4">

      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="学生集合" className="flex flex-wrap gap-1">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={filter === k}
              onClick={() => setQuery({ f: k === "all" ? null : k })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50",
              )}
            >
              {FILTER_LABEL[k]} <span className="font-mono">{filterStudents(mt.biz, tw, k, "").length}</span>
            </button>
          ))}
        </div>
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">在当前集合内搜索学生</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQuery({ sq: e.target.value })}
            placeholder="在当前集合内搜索姓名/学号"
            className="h-8 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-sm"
          />
        </label>
        <Btn variant="primary" disabled={!tw.students.length} onClick={() => setRoutine({ sids: scopeSids, label: selected.length ? `已选 ${selected.length} 人` : `全部 ${tw.students.length} 名有效学生` })}>
          <CheckCheck className="size-4" aria-hidden />
          批量确认常规情况
        </Btn>
      </div>
      <p className="-mt-2 text-[11px] text-muted-foreground">
        集合按学生去重，可重叠，不相加。批量范围：{selected.length ? `已勾选 ${selected.length} 人` : "本任务全部有效学生（不随筛选、搜索缩小）"}
        {selected.length ? (
          <button type="button" className="ml-2 text-primary underline" onClick={() => setSelected([])}>
            清除勾选
          </button>
        ) : null}
        <span className="ml-3">
          <SaveState scope={scopeTask(tw.task.id)} compact />
        </span>
      </p>

      {!tw.students.length ? (
        <EmptyState icon={<Users className="size-7" />} title="本周期没有有效学生" desc="名单由有权教务在“学校管理 · 教学班”维护。" />
      ) : !dates.length ? (
        <EmptyState icon={<Users className="size-7" />} title="本周没有课次" desc="仍可在“作业”“发布”中处理本任务的其他内容。" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Search className="size-7" />} title="当前集合内没有学生" desc="切换集合或清除搜索。" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="勾选本页学生"
                    checked={pg.items.every((s) => selected.includes(s))}
                    onChange={(e) => setSelected(e.target.checked ? [...new Set([...selected, ...pg.items])] : selected.filter((s) => !pg.items.includes(s)))}
                  />
                </th>
                <th className="sticky left-0 bg-muted/50 px-3 py-2 font-medium">学生</th>
                {dates.map((d) => (
                  <th key={d} className="px-3 py-2 font-medium">
                    {WEEKDAY_CN[weekdayIdx(d)]} <span className="font-mono">{fmtMD(d)}</span>
                    <span className="block text-[10px] font-normal">
                      {tw.lessons
                        .filter((l) => l.actual_date === d)
                        .map((l) => `第${l.period.number}节`)
                        .join(" · ")}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">亮点</th>
                <th className="px-3 py-2 font-medium">作业</th>
              </tr>
            </thead>
            <tbody>
              {pg.items.map((sid) => {
                const ds = tw.byStudent[sid] ?? []
                return (
                  <tr key={sid} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`勾选 ${nameOf(sid)}`}
                        checked={selected.includes(sid)}
                        onChange={(e) => setSelected(e.target.checked ? [...selected, sid] : selected.filter((s) => s !== sid))}
                      />
                    </td>
                    <td className="sticky left-0 bg-card px-3 py-2">
                      <button type="button" onClick={() => onOpen(sid, rows)} className="text-left font-medium text-primary hover:underline">
                        {nameOf(sid)}
                      </button>
                      <span className="block text-[11px] text-muted-foreground">{homeroomName(studentById(sid)?.homeroom_id ?? "")}</span>
                    </td>
                    {dates.map((d) => (
                      <td key={d} className="px-3 py-2 align-top">
                        <DayCell d={ds.find((x) => x.date === d)} week={tw.week} onOpenStudent={() => onOpen(sid, rows)} />
                      </td>
                    ))}
                    <td className="px-3 py-2 align-top">
                      <HighlightCell tw={tw} sid={sid} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <HomeworkCell tw={tw} sid={sid} onOpen={() => setHwSid(sid)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pager page={pg.page} pages={pg.pages} total={rows.length} size={prefs.pageSize} onPage={setPage} />
        </Card>
      )}

      {routine ? <RoutineDialog tw={tw} sids={routine.sids} scopeLabel={routine.label} onClose={() => setRoutine(null)} /> : null}
      {hwSid && tw.students.includes(hwSid) ? <StudentHwDialog tw={tw} sid={hwSid} onClose={() => setHwSid(null)} /> : null}
    </div>
  )
}

export function dayAtt(d: StudentDay): { value: Attendance | null; mixed: boolean; partial: boolean } {
  const vals = d.elapsed.map((l) => d.rec.att[l.id]?.v ?? null)
  const set = new Set(vals)
  const partial = vals.some((v) => v === null) && vals.some((v) => v !== null)
  if (set.size === 1) return { value: vals[0], mixed: false, partial: false }
  return { value: null, mixed: true, partial }
}

function DayCell({ d, week, onOpenStudent }: { d?: StudentDay; week: number; onOpenStudent: () => void }) {
  const mt = useMt()
  const rw = useRecordWriters()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!d) return <span className="text-xs text-muted-foreground">不在读</span>
  if (d.state === "NOT_APPLICABLE") return <span className="text-xs text-muted-foreground">不适用</span>
  if (!d.elapsed.length) return <span className="text-xs text-muted-foreground">尚未上课</span>

  const att = dayAtt(d)
  const std = classroomStandard(mt.biz, taskById(d.taskId)!, week)
  const pv = mt.pendingValue<string>(`rec:${d.rec.key}:grade`)
  const canEval = d.elig.kind === "ELIGIBLE"
  const gv = canEval && pv.has ? (pv.value === "EMPTY" ? null : (pv.value ?? null)) : d.gradeEff
  const gh = canEval && pv.has ? (pv.value === "EMPTY" ? "EXPLICIT_EMPTY" : "CONFIRMED") : d.handlingEff
  const attText = att.mixed ? "各节不同" : att.value ? ATT_LABEL[att.value] : "出勤待处理"
  const gradeText = !canEval
    ? d.elig.kind === "ABSENT"
      ? "无需评价"
      : ELIG_REASON[d.elig.kind]
    : gh === "EXPLICIT_EMPTY"
      ? "不评价"
      : gh === "CONFIRMED" && gv
        ? (gradeDisplay(std.revId, gv)?.text ?? gv)
        : "评价待处理"
  const attPending = !att.value && !att.mixed
  const gradePending = gradeText === "评价待处理"
  const name = nameOf(d.studentId)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`编辑 ${name} ${d.date} 的出勤与课堂评价：${attText}，${gradeText}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full min-w-24 flex-col items-start gap-0.5 rounded-md border px-2 py-1 text-left text-xs transition-colors hover:border-primary/60",
          d.state === "PENDING" ? "border-[#e6d4a8] bg-[#fbf1dd]/60" : "border-transparent",
          open && "border-primary",
        )}
      >
        <span className={cn(attPending ? "text-muted-foreground" : att.value && att.value !== "NORMAL" ? "font-medium text-[#8a5a12]" : "")}>{attText}</span>
        <span className={cn("flex items-center gap-1", gradePending ? "text-muted-foreground" : "font-medium")}>
          {gradeText}
          <FieldMark entry={pv} />
        </span>
        {att.partial ? <span className="text-[10px] text-[#8a5a12]">部分节次待处理</span> : null}
        {d.lessons.length > d.elapsed.length ? <span className="text-[10px] text-muted-foreground">另有 {d.lessons.length - d.elapsed.length} 节未上</span> : null}
        {d.rec.conflict ? <span className="text-[10px] text-[#9a2b22]">有待核对矛盾</span> : null}
      </button>

      {open ? (
        <div role="dialog" aria-label={`${name} ${fmtMD(d.date)} 课堂记录`} className="absolute left-0 top-full z-30 mt-1 flex w-72 flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="text-xs font-medium">
            {name} · {WEEKDAY_CN[weekdayIdx(d.date)]} {fmtMD(d.date)}
          </p>
          {d.elapsed.map((l) => {
            const a = d.rec.att[l.id]
            return (
              <div key={l.id} className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">{lessonTimeLabel(l)} 出勤</span>
                <div className="flex items-center gap-1.5">
                  <AttSelect label={`${name} ${lessonTimeLabel(l)} 出勤`} value={a?.v ?? null} onChange={(v) => rw.setAttendance(d, week, [l.id], v)} />
                  <ReasonInput d={d} week={week} lessonId={l.id} value={a?.reason ?? ""} enabled={!!a && a.v !== "NORMAL"} />
                </div>
              </div>
            )
          })}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">课堂评价（当日）</span>
            {canEval ? (
              <GradeSelect rev={std.rev} label={`${name} ${d.date} 课堂评价`} value={gv} handling={gh} onChange={(v) => rw.setGrade(d, week, v, std.revId)} />
            ) : (
              <span className="text-xs text-muted-foreground" data-testid="eval-na">
                {ELIG_REASON[d.elig.kind]}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <button type="button" onClick={() => (setOpen(false), onOpenStudent())} className="text-xs font-medium text-primary hover:underline">
              打开学生反馈
            </button>
            <Btn size="sm" onClick={() => setOpen(false)}>
              完成
            </Btn>
          </div>
        </div>
      ) : null}
    </div>
  )
}
