"use client"

import { HighlightItem } from "@/components/mt/day-record"
import { HwResultControls } from "@/components/mt/homework"
import { PhrasePicker } from "@/components/mt/phrase-picker"
import { SaveState } from "@/components/mt/shared"
import { Btn, Modal } from "@/components/mt/ui"
import { nameOf, type TaskWeek } from "@/lib/mt/derive"
import { effDeadline, hwState, isChecked, STATE_LABEL, type HwState } from "@/lib/mt/hw"
import { fmtMD, type Assignment } from "@/lib/mt/model"
import { validHighlights } from "@/lib/mt/publish"
import { scopeTask, useMt, useTextWriters } from "@/lib/mt/store"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useState } from "react"

/** 学生在本周实际出席、可写课堂亮点的日期。亮点必须绑定其中一个日期，不以“本周”绕过未出席限制。 */
function highlightDates(tw: TaskWeek, sid: string) {
  return (tw.byStudent[sid] ?? []).filter((d) => d.elapsed.length && d.elig.kind === "ELIGIBLE").map((d) => d.date)
}

export function HighlightCell({ tw, sid }: { tw: TaskWeek; sid: string }) {
  const mt = useMt()
  const tx = useTextWriters()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const items = validHighlights(mt.biz, tw, sid)
  const dates = highlightDates(tw, sid)
  const [date, setDate] = useState<string>("")
  const target = dates.includes(date) ? date : (dates[dates.length - 1] ?? "")
  const name = nameOf(sid)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest("[data-phrase-popover]")) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const add = (text: string, phraseId?: string) => {
    const t = text.trim()
    if (!t || !target) return
    tx.addHighlight(tw.task.id, tw.week, sid, t, { date: target, ...(phraseId ? { phraseId } : {}) })
    setDraft("")
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${name} 亮点${items.length ? ` ${items.length} 条` : "，添加"}`}
        title={items.map((h) => h.text).join("\n") || undefined}
        className={cn(
          "flex max-w-40 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs",
          items.length ? "bg-accent text-accent-foreground hover:bg-accent/80" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {items.length ? (
          <>
            <span className="truncate">{items[0].text}</span>
            {items.length > 1 ? <span className="shrink-0 font-mono">+{items.length - 1}</span> : null}
          </>
        ) : (
          "+ 亮点"
        )}
      </button>
      {open ? (
        <div role="dialog" aria-label={`${name} 本周亮点`} className="absolute right-0 top-full z-30 mt-1 flex w-80 flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="text-xs font-medium">{name} · 本周亮点</p>
          {items.length ? (
            <div className="flex flex-col gap-1">
              {items.map((h) => (
                <div key={h.id} className="flex flex-col gap-0.5">
                  {h.date ? <span className="text-[10px] text-muted-foreground">{fmtMD(h.date)}</span> : null}
                  <HighlightItem
                    text={h.text}
                    label={`${name} 亮点`}
                    onSave={(v) => tx.editHighlight(tw.task.id, tw.week, sid, h.id, v || null)}
                    onRemove={() => tx.editHighlight(tw.task.id, tw.week, sid, h.id, null)}
                  />
                </div>
              ))}
            </div>
          ) : null}
          {dates.length ? (
            <div className="flex flex-col gap-1.5 border-t border-border pt-2">
              {dates.length > 1 ? (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  记在
                  <select value={target} onChange={(e) => setDate(e.target.value)} className="h-7 rounded-md border border-input bg-card px-1.5 text-xs text-foreground">
                    {dates.map((d) => (
                      <option key={d} value={d}>
                        {fmtMD(d)}
                      </option>
                    ))}
                  </select>
                  的课堂
                </label>
              ) : (
                <span className="text-xs text-muted-foreground">记在 {fmtMD(target)} 的课堂</span>
              )}
              <div className="flex items-center gap-1.5">
                <input
                  aria-label={`${name} 自由填写亮点`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) add(draft)
                  }}
                  placeholder="写一条亮点"
                  className="h-7 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-xs"
                />
                <Btn size="sm" disabled={!draft.trim()} onClick={() => add(draft)}>
                  添加
                </Btn>
              </div>
              <PhrasePicker kind="HIGHLIGHT" label={`${name} 常用亮点`} triggerLabel="+ 常用亮点" saveText={draft} onPick={(t, pid) => add(t, pid)} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">本周没有该生实际出席的课堂，不能新增课堂亮点。</p>
          )}
          <div className="flex items-center justify-between">
            <SaveState scope={scopeTask(tw.task.id)} compact />
            <Btn size="sm" onClick={() => setOpen(false)}>
              完成
            </Btn>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function studentAssignments(tw: TaskWeek, sid: string) {
  return tw.assignments.filter((a) => a.recipients.includes(sid))
}

function summarize(list: Assignment[], sid: string, nowTs: number) {
  const states = list.map((a) => hwState(a, sid, nowTs))
  const count = (pred: (s: HwState) => boolean) => states.filter(pred).length
  return {
    ungraded: count((s) => s === "UNGRADED"),
    due: count((s) => s === "DUE_UNRECORDED" || s === "SUSPECTED_MISSING" || s === "REVIEW"),
    checked: count((s) => isChecked(s) && s !== "MISSING"),
    missing: count((s) => s === "MISSING"),
  }
}

export function HomeworkCell({ tw, sid, onOpen }: { tw: TaskWeek; sid: string; onOpen: () => void }) {
  const mt = useMt()
  const list = studentAssignments(tw, sid)
  if (!list.length) return <span className="text-xs text-muted-foreground">本期无作业</span>
  const s = summarize(list, sid, Date.parse(mt.biz.clock))
  const parts = [
    s.ungraded ? { t: `待评价 ${s.ungraded}`, c: "border border-warning/50 bg-warning/10 text-foreground" } : null,
    s.due ? { t: `待核对 ${s.due}`, c: "border border-warning/50 bg-warning/10 text-foreground" } : null,
    s.missing ? { t: `未交 ${s.missing}`, c: "text-destructive bg-destructive/10" } : null,
    s.checked ? { t: `已核对 ${s.checked}`, c: "text-muted-foreground bg-muted" } : null,
  ].filter(Boolean) as { t: string; c: string }[]
  const pending = s.ungraded + s.due
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${nameOf(sid)} 作业 ${list.length} 份，${pending ? "评改" : "查看"}`}
      className="flex flex-wrap items-center gap-1 rounded-md px-1 py-0.5 text-left text-[11px] hover:bg-muted"
    >
      {parts.length ? parts.map((p) => <span key={p.t} className={cn("rounded px-1.5 py-0.5 font-medium", p.c)}>{p.t}</span>) : <span className="text-muted-foreground">未到截止 {list.length}</span>}
      <span className="font-medium text-primary">{pending ? "评改" : "查看"}</span>
    </button>
  )
}

/** 当前学生 + 当前任务 + 当前周期作业的评改。只编辑这名学生的结果，不触及全班。 */
export function StudentHwDialog({ tw, sid, onClose }: { tw: TaskWeek; sid: string; onClose: () => void }) {
  const mt = useMt()
  const list = studentAssignments(tw, sid)
  const nowTs = Date.parse(mt.biz.clock)
  return (
    <Modal title={`${nameOf(sid)} · 作业评改`} desc={`${tw.task.label} · 第 ${tw.week} 周 · 修改自动保存`} onClose={onClose} wide footer={<Btn onClick={onClose}>完成</Btn>}>
      {list.length ? (
        <ul className="flex flex-col divide-y divide-border">
          {list.map((a) => {
            const st = hwState(a, sid, nowTs)
            const dl = effDeadline(a, sid)
            return (
              <li key={a.id} className="flex flex-col gap-2 py-3 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-pretty">{a.title}</p>
                  <span className="text-xs text-muted-foreground">
                    {dl ? `截止 ${fmtMD(dl.slice(0, 10))} ${dl.slice(11, 16)}` : "不设截止"} · {STATE_LABEL[st]}
                  </span>
                </div>
                <HwResultControls a={a} sid={sid} />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">本周期该生没有相关作业。</p>
      )}
      <div className="mt-2">
        <SaveState scope={scopeTask(tw.task.id)} compact />
      </div>
    </Modal>
  )
}
