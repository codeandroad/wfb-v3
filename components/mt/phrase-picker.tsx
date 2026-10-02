"use client"

import { useTeacherId } from "@/lib/mt/derive"
import { ATT_LABEL, type Attendance, type StudentDay } from "@/lib/mt/model"
import { phraseOptions, reasonFitsState, type Phrase, type PhraseKind } from "@/lib/mt/phrases"
import { useMt, usePhraseWriters, useRecordWriters } from "@/lib/mt/store"
import { cn } from "@/lib/utils"
import { BookmarkPlus, ChevronDown, Star, X } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

/**
 * 常用内容选择：搜索、个人项优先、系统项其次；也可直接自由输入。
 * 选择只作为输入辅助；调用方决定写入哪个字段。
 */
export function PhrasePicker({
  kind,
  state,
  onPick,
  saveText,
  triggerLabel = "常用",
  label,
  disabled,
  align = "left",
}: {
  kind: PhraseKind
  state?: Attendance | null
  onPick: (text: string, phraseId?: string) => void
  /** 当前自由输入文字；非空时可“保存为我的常用” */
  saveText?: string
  triggerLabel?: string
  label: string
  disabled?: boolean
  align?: "left" | "right"
}) {
  const mt = useMt()
  const teacherId = useTeacherId()
  const pw = usePhraseWriters(teacherId)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [custom, setCustom] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  const lib = teacherId ? mt.biz.phrases[teacherId] : undefined
  const { mine, system } = phraseOptions(lib, kind, state)
  const match = (p: Phrase) => !q.trim() || p.text.includes(q.trim()) || (p.category ?? "").includes(q.trim())
  const favs = lib?.favs ?? []
  const toSave = (saveText ?? custom).trim()
  const alreadyMine = mine.some((p) => p.text === toSave)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const pick = (text: string, pid?: string) => {
    onPick(text, pid)
    setOpen(false)
    setQ("")
    setCustom("")
  }

  const row = (p: Phrase) => (
    <li key={p.id} className="flex items-center gap-1">
      <button
        type="button"
        role="option"
        aria-selected={false}
        onClick={() => pick(p.text, p.id)}
        className="flex-1 truncate rounded-md px-2 py-1 text-left text-xs hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
      >
        {p.text}
        {p.category ? <span className="ml-1.5 text-[10px] text-muted-foreground">{p.category}</span> : null}
      </button>
      <button
        type="button"
        aria-label={favs.includes(p.id) ? `取消收藏 ${p.text}` : `收藏 ${p.text}`}
        aria-pressed={favs.includes(p.id)}
        onClick={() => pw.toggleFav(p.id)}
        className="rounded p-1 text-muted-foreground hover:text-foreground"
      >
        <Star className={cn("size-3", favs.includes(p.id) && "fill-[#c9962b] text-[#c9962b]")} aria-hidden />
      </button>
    </li>
  )

  const mineShown = mine.filter(match)
  const sysShown = system.filter(match)

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}：选择常用内容`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 items-center gap-0.5 rounded-md border border-input bg-card px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        {triggerLabel}
        <ChevronDown className="size-3" aria-hidden />
      </button>
      {open ? (
        <div
          id={id}
          className={cn("absolute top-8 z-[70] w-64 rounded-lg border border-border bg-card p-2 shadow-lg", align === "right" ? "right-0" : "left-0")}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation()
              setOpen(false)
            }
          }}
        >
          <input
            autoFocus
            aria-label={`${label}：搜索常用内容`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={kind === "REASON" && state ? `搜索${ATT_LABEL[state]}常用原因` : "搜索常用内容"}
            className="mb-1.5 h-7 w-full rounded-md border border-input bg-card px-2 text-xs"
          />
          <div className="max-h-56 overflow-y-auto" role="listbox" aria-label={`${label}常用内容`}>
            {mineShown.length ? (
              <>
                <p className="px-2 pt-1 text-[10px] font-medium text-muted-foreground">我的常用</p>
                <ul>{mineShown.map(row)}</ul>
              </>
            ) : null}
            {sysShown.length ? (
              <>
                <p className="px-2 pt-1.5 text-[10px] font-medium text-muted-foreground">系统常用</p>
                <ul>{sysShown.map(row)}</ul>
              </>
            ) : null}
            {!mineShown.length && !sysShown.length ? <p className="px-2 py-2 text-xs text-muted-foreground">没有匹配项，可直接输入。</p> : null}
          </div>
          {saveText === undefined ? (
            <div className="mt-1.5 flex gap-1 border-t border-border pt-1.5">
              <input
                aria-label={`${label}：自由输入`}
                value={custom}
                maxLength={60}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229 && custom.trim()) pick(custom.trim())
                }}
                placeholder="或直接输入"
                className="h-7 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-xs"
              />
              <button type="button" disabled={!custom.trim()} onClick={() => pick(custom.trim())} className="h-7 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-50">
                添加
              </button>
            </div>
          ) : null}
          {toSave && !alreadyMine && teacherId ? (
            <button
              type="button"
              onClick={() => pw.add(kind, toSave, kind === "REASON" && state ? { states: [state] } : undefined)}
              className="mt-1.5 flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-[11px] text-primary hover:bg-muted"
            >
              <BookmarkPlus className="size-3" aria-hidden />
              {`保存“${toSave.slice(0, 16)}”为我的常用`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * 考勤原因：只在当前状态为非正常时可填；常用原因按状态过滤；
 * 状态切换后原原因不再冒充新状态原因，作为“原状态原因”保留可恢复。
 */
export function ReasonField({ d, week, lessonId, compact }: { d: StudentDay; week: number; lessonId: string; compact?: boolean }) {
  const mt = useMt()
  const teacherId = useTeacherId()
  const rw = useRecordWriters()
  const a = d.rec.att[lessonId]
  const enabled = !!a && a.v !== "NORMAL"
  const [value, setValue] = useState(a?.reason ?? "")
  const [focused, setFocused] = useState(false)
  const serverVal = a?.reason ?? ""
  // 非编辑中时跟随已保存值（如状态切换清空、从其他入口修改）
  useEffect(() => {
    if (!focused) setValue(serverVal)
  }, [serverVal, focused])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commit = (v: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (v !== serverVal) rw.setReason(d, week, lessonId, v)
  }
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  if (!a) return <span className="text-[11px] text-muted-foreground">{compact ? "" : "先选择出勤"}</span>
  if (!enabled) return compact ? null : <span className="text-[11px] text-muted-foreground">正常出勤无需原因</span>

  const lib = teacherId ? mt.biz.phrases[teacherId] : undefined
  const prev = a.prevReason
  const warnFit = value && !reasonFitsState(lib, value, a.v)

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <input
          aria-label={`${ATT_LABEL[a.v]}原因（选填）`}
          value={value}
          maxLength={200}
          placeholder={`${ATT_LABEL[a.v]}原因（选填）`}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            const v = e.target.value
            setValue(v)
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(() => commit(v), 700)
          }}
          onBlur={() => {
            setFocused(false)
            commit(value)
          }}
          className="h-7 min-w-24 flex-1 rounded-md border border-input bg-card px-2 text-xs"
        />
        <PhrasePicker
          kind="REASON"
          state={a.v}
          label={`${ATT_LABEL[a.v]}原因`}
          saveText={value}
          onPick={(t) => {
            setValue(t)
            commit(t)
          }}
        />
        {value ? (
          <button
            type="button"
            aria-label="清除原因"
            onClick={() => {
              setValue("")
              commit("")
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" aria-hidden />
          </button>
        ) : null}
      </div>
      {warnFit ? <p className="text-[10px] text-[#8a5a12]">该原因通常不用于“{ATT_LABEL[a.v]}”，请复核。</p> : null}
      {prev && !value ? (
        <p className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground" data-testid="prev-reason">
          原{ATT_LABEL[prev.v]}原因：{prev.text}
          <button type="button" className="text-primary underline" onClick={() => { setValue(prev.text); commit(prev.text) }}>
            作为本状态原因
          </button>
        </p>
      ) : null}
    </div>
  )
}
