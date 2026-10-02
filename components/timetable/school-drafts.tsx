"use client"

import { Badge, Input, Modal, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { fmtClock, teacherById } from "@/lib/timetable/data"
import { latestSeq, schLabel, useTimetable, type SchoolDraft } from "@/lib/timetable/store"
import { Send } from "lucide-react"
import { useState } from "react"

export function useDraftSummary() {
  const tt = useTimetable()
  const drafts = Object.values(tt.schoolDrafts).sort((a, b) => (a.savedAt ?? "").localeCompare(b.savedAt ?? ""))
  const withEdits = drafts.filter((d) => d.edits.length > 0)
  const total = withEdits.reduce((n, d) => n + d.edits.length, 0)
  const lastSaved = drafts.map((d) => d.savedAt).filter(Boolean).sort().pop() ?? null
  return { drafts, withEdits, total, lastSaved }
}

const shortName = (id: string) => teacherById(id)?.name.replace("示例", "") ?? id

// 课程中心顶部的草稿托盘：汇总所有教师的未发布改动，统一发布
export function DraftTray({ currentTeacherId, onPickTeacher }: { currentTeacherId: string; onPickTeacher: (id: string) => void }) {
  const tt = useTimetable()
  const { push } = useToast()
  const { drafts, withEdits, total, lastSaved } = useDraftSummary()
  const [publishOpen, setPublishOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  if (!drafts.length) return null

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[#e6d4a8] bg-[#fbf3e2] px-3 py-2">
      <div className="flex items-center gap-2 text-[12px] text-[#7a5514]">
        <span className="size-1.5 rounded-full bg-[#c98a1e]" aria-hidden="true" />
        <span className="font-medium">待发布草稿</span>
        <span>
          {withEdits.length} 位教师 · {total} 处改动{lastSaved ? ` · ${fmtClock(lastSaved)}` : ""}
        </span>
      </div>

      <ul className="flex flex-wrap items-center gap-1.5" aria-label="草稿教师">
        {drafts.map((d) => (
          <li key={d.teacherId}>
            <DraftChip draft={d} current={d.teacherId === currentTeacherId} onClick={() => onPickTeacher(d.teacherId)} />
          </li>
        ))}
      </ul>

      <div className="ml-auto flex items-center gap-1.5">
        {confirmDiscard ? (
          <>
            <span className="text-[12px] text-[#7a5514]">放弃全部草稿？</span>
            <Button variant="ghost" size="xs" onClick={() => setConfirmDiscard(false)}>取消</Button>
            <Button
              variant="ghost"
              size="xs"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => { tt.discardAllSchoolDrafts(); setConfirmDiscard(false); push("已放弃全部草稿") }}
            >
              确认放弃
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="xs" className="text-[#7a5514] hover:bg-[#f3e6c8] hover:text-[#7a5514]" onClick={() => setConfirmDiscard(true)}>
            全部放弃
          </Button>
        )}
        <Button size="xs" disabled={!total} onClick={() => setPublishOpen(true)}>
          <Send className="mr-1 size-3" />统一发布
        </Button>
      </div>

      <PublishDraftsModal open={publishOpen} onClose={() => setPublishOpen(false)} />
    </div>
  )
}

function DraftChip({ draft, current, onClick }: { draft: SchoolDraft; current: boolean; onClick: () => void }) {
  const editing = draft.active !== false
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "true" : undefined}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[12px] transition-colors",
        current ? "border-[#c98a1e] bg-card text-foreground" : "border-[#e6d4a8] bg-[#fdf8ec] text-[#7a5514] hover:bg-card",
      )}
    >
      {editing ? <span className="size-1.5 rounded-full bg-primary" aria-label="编辑中" /> : null}
      <span>{shortName(draft.teacherId)}</span>
      <span className="tabular-nums text-[#a07a3a]">{draft.edits.length}</span>
    </button>
  )
}

export function PublishDraftsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tt = useTimetable()
  const { push } = useToast()
  const { withEdits, total } = useDraftSummary()
  const [note, setNote] = useState("")
  const nextId = schLabel(latestSeq(tt) + 1)
  const editingCount = withEdits.filter((d) => d.active !== false).length

  function publish() {
    const r = tt.publishSchoolDrafts(note.trim() || undefined)
    push(r.msg)
    if (r.ok) {
      setNote("")
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="统一发布"
      desc={`生成 ${nextId} · ${withEdits.length} 位教师 · ${total} 处改动`}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" disabled={!total} onClick={publish}><Send className="mr-1 size-3.5" />确认发布</Button>
        </>
      }
    >
      <ul className="divide-y divide-border rounded-lg border border-border">
        {withEdits.map((d) => {
          const t = teacherById(d.teacherId)
          return (
            <li key={d.teacherId} className="flex items-center gap-2 px-3 py-2 text-[13px]">
              <span className="font-medium">{t?.name}</span>
              <span className="text-muted-foreground">{t?.subject}</span>
              {d.active !== false ? <Badge tone="primary">编辑中</Badge> : null}
              {t && !t.hasAccount ? <Badge tone="neutral">无账号</Badge> : null}
              <span className="ml-auto tabular-nums text-muted-foreground">{d.edits.length} 处</span>
            </li>
          )
        })}
      </ul>
      {editingCount ? <p className="mt-2 text-[12px] text-muted-foreground">{editingCount} 位教师仍在编辑中，当前改动一并发布。</p> : null}
      <label className="mt-3 block">
        <span className="sr-only">发布说明</span>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="发布说明（可选）" className="h-8 text-[13px]" />
      </label>
    </Modal>
  )
}
