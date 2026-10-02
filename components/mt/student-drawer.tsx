"use client"

import { Badge } from "@/components/kit"
import { HwResultControls } from "@/components/mt/homework"
import { PhrasePicker, ReasonField } from "@/components/mt/phrase-picker"
import { RoutineDialog } from "@/components/mt/routine-dialog"
import { AttSelect, GradeSelect, SaveState } from "@/components/mt/shared"
import { Btn, Drawer, inputCls, Section, useAutoText } from "@/components/mt/ui"
import { nameOf, type TaskWeek } from "@/lib/mt/derive"
import {
  ATT_LABEL,
  entryKeyOf,
  fmtMD,
  homeroomName,
  hwStatus,
  leaveCoversLesson,
  lessonTimeLabel,
  studentById,
  taskById,
  WEEKDAY_CN,
  weekdayIdx,
  type StudentDay,
} from "@/lib/mt/view"
import { levelText } from "@/lib/mt/schemes"
import { classroomStandard } from "@/lib/mt/use-schemes"
import { obsKey, scopeStudent, useMt, useRecordWriters, useTextWriters } from "@/lib/mt/store"
import { CheckCheck, ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

export function StudentDrawer({
  tw,
  sid,
  seq,
  onNav,
  onClose,
}: {
  tw: TaskWeek
  sid: string
  seq: string[]
  onNav: (sid: string) => void
  onClose: () => void
}) {
  const st = studentById(sid)
  const idx = seq.indexOf(sid)
  const allowed = tw.students.includes(sid)
  const sp = useSearchParams()
  const retQ = new URLSearchParams(sp.toString())
  retQ.set("week", String(tw.week))
  retQ.set("student", sid)
  const profileHref = `/teaching/student/${sid}?ret=${encodeURIComponent(`/teaching/task/${tw.task.id}?${retQ.toString()}`)}`
  return (
    <Drawer
      label={`${nameOf(sid)} 学生详情`}
      onClose={onClose}
      header={
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">第 {tw.week} 周</p>
            <h2 className="text-lg font-semibold">
              {st?.name ?? "未知学生"}
              <span className="ml-2 text-xs font-normal text-muted-foreground">{homeroomName(st?.homeroom_id ?? "")}</span>
            </h2>
            <div className="flex items-center gap-3">
              <SaveState scope={scopeStudent(tw.task.id, tw.week, sid)} />
              {allowed ? (
                <Link href={profileHref} className="text-xs font-medium text-primary hover:underline">
                  查看学生资料
                </Link>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Btn size="sm" variant="ghost" disabled={idx <= 0} onClick={() => onNav(seq[idx - 1])} aria-label="上一位">
              <ChevronLeft className="size-3.5" aria-hidden />
              上一位
            </Btn>
            <span className="font-mono text-xs text-muted-foreground">
              {idx + 1}/{seq.length}
            </span>
            <Btn size="sm" variant="ghost" disabled={idx < 0 || idx >= seq.length - 1} onClick={() => onNav(seq[idx + 1])} aria-label="下一位">
              下一位
              <ChevronRight className="size-3.5" aria-hidden />
            </Btn>
            <button type="button" onClick={onClose} aria-label="关闭" className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      }
    >
      {allowed ? (
        <DrawerBody key={sid} tw={tw} sid={sid} />
      ) : (
        <p className="text-sm text-[#9a2b22]">该学生不在本任务本周期的有效范围内，无法查看。</p>
      )}
    </Drawer>
  )
}

export function StudentDetailBody({ tw, sid }: { tw: TaskWeek; sid: string }) {
  return <DrawerBody tw={tw} sid={sid} />
}

function DrawerBody({ tw, sid }: { tw: TaskWeek; sid: string }) {
  const mt = useMt()
  const tx = useTextWriters()
  const [routine, setRoutine] = useState(false)
  const days = tw.byStudent[sid] ?? []
  const hws = tw.assignments.filter((a) => a.recipients.includes(sid))
  const k = entryKeyOf(tw.task.id, tw.week, sid)
  const highlights = mt.biz.highlights[k]?.items ?? []
  const comment = useAutoText(mt.biz.comments[k]?.text ?? "", (v) => tx.setComment(tw.task.id, tw.week, sid, v))
  const nowTs = Date.parse(mt.biz.clock)
  const std = classroomStandard(mt.biz, tw.task, tw.week)

  const graded = days.filter((d) => d.rec.gradeHandling === "CONFIRMED" && d.rec.grade)
  const gradeCount = (std.rev?.levels ?? []).map((l) => ({ g: { v: l.id, label: levelText(l) }, n: graded.filter((d) => d.rec.grade === l.id).length })).filter((x) => x.n)
  const suggestion = [
    graded.length ? `本周记录课堂 ${graded.length} 次，课堂评价：${gradeCount.map((x) => `${x.g.label}×${x.n}`).join("、")}。` : "",
    highlights.length ? `亮点：${highlights.map((h) => h.text).join("；")}。` : "",
  ]
    .filter(Boolean)
    .join("")

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
        <p className="text-xs text-muted-foreground">正常编辑即自动保存。“确认该生常规情况”只处理该生本周已发生、尚未处理的常规目标。</p>
        <Btn size="sm" variant="primary" onClick={() => setRoutine(true)}>
          <CheckCheck className="size-3.5" aria-hidden />
          确认该生常规情况
        </Btn>
      </div>

      <Section title="课堂记录">
        {days.length ? (
          <ul className="flex flex-col gap-3">
            {days.map((d) => (
              <DayBlock key={d.rec.key} d={d} week={tw.week} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">本周该生没有适用课次。</p>
        )}
      </Section>

      <Section title={`作业（${hws.length}）`}>
        {hws.length ? (
          <ul className="flex flex-col gap-2">
            {hws.map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="mb-1.5 text-sm font-medium">
                  {a.title}
                </p>
                <HwResultControls a={a} sid={sid} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">本周期没有该生的作业。</p>
        )}
      </Section>

      <Section title="亮点">
        <Highlights tw={tw} sid={sid} />
      </Section>

      <Section title="个体评语（可留空）">
        <textarea
          aria-label="个体评语"
          rows={3}
          className={inputCls}
          value={comment.value}
          onChange={(e) => comment.onChange(e.target.value)}
          onBlur={comment.flush}
          placeholder="简短即可；可不填写。"
        />
        <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs">
          <p className="font-medium">依据（已保存的本任务事实）</p>
          <ul className="mt-1 list-disc pl-4 text-muted-foreground">
            <li>已处理课堂日 {days.filter((d) => d.state === "PROCESSED").length} / 已发生 {days.filter((d) => d.state !== "FUTURE" && d.state !== "NOT_APPLICABLE").length}</li>
            <li>
              作业：
              {hws.length ? hws.map((a) => `${a.title}（${hwStatus(a, sid, nowTs).label}）`).join("；") : "无"}
            </li>
            <li>亮点 {highlights.length} 条</li>
          </ul>
          {suggestion ? (
            <div className="mt-2 flex items-start justify-between gap-2">
              <p>
                <Badge tone="neutral">原型模板模拟</Badge> {suggestion}
              </p>
              <Btn size="sm" onClick={() => comment.set(suggestion)}>
                采用建议
              </Btn>
            </div>
          ) : null}
        </div>
      </Section>

      {routine ? <RoutineDialog tw={tw} sids={[sid]} scopeLabel={`该��� ${nameOf(sid)}`} onClose={() => setRoutine(false)} /> : null}
    </div>
  )
}

function DayBlock({ d, week }: { d: StudentDay; week: number }) {
  const mt = useMt()
  const rw = useRecordWriters()
  const std = classroomStandard(mt.biz, taskById(d.taskId)!, week)
  const note = useAutoText(d.rec.note, (v) => rw.setNote(d, week, v))
  const stateLabel: Record<string, string> = { PROCESSED: "已确认", PENDING: "待处理", FUTURE: "未开始", NOT_APPLICABLE: "不适用" }
  return (
    <li className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium">
          {WEEKDAY_CN[weekdayIdx(d.date)]} {fmtMD(d.date)}
        </span>
        <Badge tone={d.state === "PROCESSED" ? "success" : d.state === "PENDING" ? "warning" : "neutral"}>{stateLabel[d.state]}</Badge>
      </div>
      <div className="flex flex-col gap-2 px-3 py-2">
        {d.lessons.map((l) => {
          const elapsed = d.elapsed.some((e) => e.id === l.id)
          const a = d.rec.att[l.id]
          return (
            <div key={l.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-40 font-mono text-muted-foreground">{lessonTimeLabel(l)}</span>
              {elapsed ? (
                <>
                  <AttSelect label={`${lessonTimeLabel(l)} 出勤`} value={a?.v ?? null} onChange={(v) => rw.setAttendance(d, week, [l.id], v)} />
                  <ReasonField d={d} week={week} lessonId={l.id} compact />
                  {a?.origin === "APPROVED_LEAVE" ? <Badge tone="info">来自请假来源</Badge> : null}
                </>
              ) : (
                <span className="text-muted-foreground">未发生，不能确认出勤</span>
              )}
              <LessonObsRef lessonId={l.id} sid={d.studentId} />
            </div>
          )
        })}
        {d.leaves.map((lv) => {
          const covered = d.elapsed.filter((l) => leaveCoversLesson(lv, l)).map((l) => l.id)
          return (
            <div key={lv.id} className="flex flex-wrap items-center gap-2 rounded-md bg-[#eef3f8] px-2 py-1.5 text-xs">
              <span>
                班主任请假：{lv.kind}
                {lv.period_ids?.length ? `（部分时段 ${lv.period_ids.length} 节）` : "（全天）"}
                {lv.internal_reason ? ` · 内部原因：${lv.internal_reason}` : ""}
              </span>
              {covered.length ? (
                <Btn size="sm" onClick={() => rw.applyLeave(d, week, lv.id, covered)}>
                  按请假来源填写 {covered.length} 节
                </Btn>
              ) : (
                <span className="text-muted-foreground">不覆盖已发生课次</span>
              )}
            </div>
          )
        })}
        {d.rec.conflict ? <p className="text-xs text-[#9a2b22]">记录与请假来源存在矛盾，请核对各节出勤。</p> : null}
        {d.elapsed.length ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="w-40 text-muted-foreground">课堂评价（本日）</span>
            <GradeSelect rev={std.rev} label={`${d.date} 课堂评价`} value={d.rec.grade} handling={d.rec.gradeHandling} onChange={(v) => rw.setGrade(d, week, v, std.revId)} />
            {d.rec.gradeHandling === "CONFIRMED" && d.rec.gradeCovered.length < d.elapsed.length ? (
              <span className="text-[#8a5a12]">评价只覆盖先前已发生的课次</span>
            ) : null}
          </div>
        ) : null}
        <label className="text-xs">
          <span className="text-muted-foreground">内部课堂备注（不进入家长结果）</span>
          <input className={`${inputCls} mt-1`} value={note.value} onChange={(e) => note.onChange(e.target.value)} onBlur={note.flush} />
        </label>
        {Object.values(d.rec.att).some((x) => x.v !== "NORMAL") ? (
          <p className="text-[11px] text-muted-foreground">
            {Object.entries(d.rec.att)
              .filter(([, x]) => x.v !== "NORMAL")
              .map(([, x]) => ATT_LABEL[x.v])
              .join("、")}
          </p>
        ) : null}
      </div>
    </li>
  )
}

function LessonObsRef({ lessonId, sid }: { lessonId: string; sid: string }) {
  const mt = useMt()
  const cls = mt.biz.observations[obsKey(lessonId, null)]
  const stu = mt.biz.observations[obsKey(lessonId, sid)]
  if (!cls && !stu) return null
  return (
    <div className="flex w-full flex-col gap-0.5 rounded-md bg-muted px-2 py-1.5 text-[11px] leading-relaxed" data-testid="obs-ref">
      <span className="font-medium text-muted-foreground">课次观察（参考，不计入评价）</span>
      {stu ? <span>本人：{stu.text}</span> : null}
      {cls ? <span className="text-muted-foreground">本课：{cls.text}</span> : null}
    </div>
  )
}

/** 与日卡、课次详情同一原因组件（常用原因按状态过滤，状态切换保留原原因可恢复） */
export function ReasonInput({ d, week, lessonId }: { d: StudentDay; week: number; lessonId: string; value?: string; enabled?: boolean }) {
  return <ReasonField d={d} week={week} lessonId={lessonId} />
}

function Highlights({ tw, sid }: { tw: TaskWeek; sid: string }) {
  const mt = useMt()
  const tx = useTextWriters()
  const [draft, setDraft] = useState("")
  const items = mt.biz.highlights[entryKeyOf(tw.task.id, tw.week, sid)]?.items ?? []
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((h) => (
        <div key={h.id} className="flex items-center gap-2">
          <span className="w-12 shrink-0 font-mono text-[11px] text-muted-foreground">{h.date ? fmtMD(h.date) : "本周"}</span>
          <div className="min-w-0 flex-1">
            <HighlightRow text={h.text} onSave={(v) => tx.editHighlight(tw.task.id, tw.week, sid, h.id, v)} />
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <PhrasePicker kind="HIGHLIGHT" label="亮点" saveText={draft} onPick={(t, pid) => tx.addHighlight(tw.task.id, tw.week, sid, t, pid ? { phraseId: pid } : undefined)} />
        <input
          aria-label="新增亮点"
          className={inputCls}
          value={draft}
          placeholder="新增一条亮点"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229 && draft.trim()) {
              tx.addHighlight(tw.task.id, tw.week, sid, draft.trim())
              setDraft("")
            }
          }}
        />
        <Btn
          size="sm"
          disabled={!draft.trim()}
          onClick={() => {
            tx.addHighlight(tw.task.id, tw.week, sid, draft.trim())
            setDraft("")
          }}
        >
          <Plus className="size-3" aria-hidden />
          添加
        </Btn>
      </div>
    </div>
  )
}

function HighlightRow({ text, onSave }: { text: string; onSave: (v: string | null) => void }) {
  const t = useAutoText(text, (v) => v.trim() && onSave(v.trim()))
  return (
    <div className="flex gap-2">
      <input aria-label="亮点" className={inputCls} value={t.value} onChange={(e) => t.onChange(e.target.value)} onBlur={t.flush} />
      <Btn size="sm" variant="ghost" aria-label="删除亮点" onClick={() => onSave(null)}>
        <Trash2 className="size-3.5" aria-hidden />
      </Btn>
    </div>
  )
}
