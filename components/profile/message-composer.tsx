"use client"

import { useRef, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/kit"
import { EmojiPicker } from "@/components/profile/emoji-picker"
import { cn } from "@/lib/utils"
import { COMMENT_MAX, textLength, type ActionResult } from "@/lib/profile/store"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 每个输入框各自持有草稿与光标位置，emoji 只会插入到当前这个输入框
export function MessageComposer({
  id,
  label,
  hideLabel,
  placeholder,
  submitLabel,
  pendingLabel,
  rows = 3,
  autoFocus,
  header,
  onSubmit,
  onCancel,
  onBlocked,
}: {
  id: string
  label: string
  hideLabel?: boolean
  placeholder: string
  submitLabel: string
  pendingLabel: string
  rows?: number
  autoFocus?: boolean
  header?: ReactNode
  onSubmit: (text: string) => ActionResult
  onCancel?: () => void
  onBlocked?: () => void // 提交时发现主页/留言状态已变化
}) {
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Extract<ActionResult, { ok: false }> | null>(null)
  const inflight = useRef(false)
  const area = useRef<HTMLTextAreaElement>(null)

  const len = textLength(draft.trim())
  const over = len > COMMENT_MAX
  const blocked = error && (error.code === "closed" || error.code === "denied" || error.code === "gone")

  const insert = (emoji: string) => {
    const el = area.current
    const start = el?.selectionStart ?? draft.length
    const end = el?.selectionEnd ?? draft.length
    const next = draft.slice(0, start) + emoji + draft.slice(end)
    setDraft(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
    })
  }

  const submit = async () => {
    if (inflight.current || len === 0 || over) return
    inflight.current = true
    setSubmitting(true)
    setError(null)
    await sleep(550)
    const r = onSubmit(draft)
    inflight.current = false
    setSubmitting(false)
    if (r.ok) setDraft("")
    else {
      setError(r)
      if (r.code === "closed" || r.code === "denied" || r.code === "gone") onBlocked?.()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {header}
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-[13px] font-medium"}>
        {label}
      </label>
      <Textarea
        ref={area}
        id={id}
        rows={rows}
        value={draft}
        autoFocus={autoFocus}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            e.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        aria-describedby={`${id}-hint`}
        className="bg-card leading-relaxed"
      />
      {error ? (
        <p role="alert" className="text-xs leading-relaxed text-destructive">
          {error.message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <EmojiPicker onPick={insert} disabled={submitting} />
        <p id={`${id}-hint`} className={cn("mr-auto text-xs", over ? "text-destructive" : "text-muted-foreground")}>
          {len}/{COMMENT_MAX} · 支持文字与 emoji
        </p>
        {onCancel ? (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
            {blocked ? "关闭" : "取消"}
          </Button>
        ) : null}
        {blocked ? null : (
          <Button size="sm" onClick={submit} disabled={submitting || len === 0 || over}>
            {submitting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {submitting ? pendingLabel : error?.code === "network" ? `重试${submitLabel}` : submitLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
