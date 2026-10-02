"use client"

import { useRef, useState } from "react"
import { Loader2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea, useToast } from "@/components/kit"
import { cn } from "@/lib/utils"
import { INTRO_MAX, textLength, useProfile, type ActionResult, type HomepageSettings } from "@/lib/profile/store"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 主页与留言设置：主页与账号中心共用同一组件、同一数据 */
export function HomepageSettingsPanel({ ownerId, settings }: { ownerId: string; settings: HomepageSettings }) {
  const profile = useProfile()
  const { push } = useToast()
  const [pending, setPending] = useState<"visibility" | "comments" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inflight = useRef(false)

  const run = async (kind: "visibility" | "comments", action: () => ActionResult, okText: string) => {
    if (inflight.current) return
    inflight.current = true
    setPending(kind)
    setError(null)
    await sleep(400)
    const r = action()
    inflight.current = false
    setPending(null)
    if (r.ok) push(okText)
    else setError(`${r.message} 设置未改变，可重试。`)
  }

  const open = settings.visibility === "staff"
  const commentsHint = !settings.commentsOpen
    ? "已有留言仍可阅读和点赞，不能发表新留言或回复。"
    : !open
      ? "当前主页仅自己可见，重新开放后留言即恢复。"
      : null

  return (
    <div className="flex flex-col gap-3">
      <SettingRow
        id="set-visibility"
        title="本校教职工可查看主页"
        state={open ? "已开放" : "仅自己可见"}
        hint={open ? null : "其他人看不到主页内容、任教摘要和留言；已有留言不会删除。"}
        checked={open}
        pending={pending === "visibility"}
        disabled={pending !== null}
        onToggle={() =>
          run(
            "visibility",
            () => profile.setVisibility(ownerId, ownerId, open ? "self" : "staff"),
            open
              ? "主页已设为仅自己可见"
              : `主页已对本校教职工开放 · 留言当前${settings.commentsOpen ? "开启" : "关闭"}`,
          )
        }
      />
      <SettingRow
        id="set-comments"
        title="接受新留言与回复"
        state={settings.commentsOpen ? "开启" : "关闭"}
        hint={commentsHint}
        checked={settings.commentsOpen}
        pending={pending === "comments"}
        disabled={pending !== null}
        onToggle={() =>
          run(
            "comments",
            () => profile.setCommentsOpen(ownerId, ownerId, !settings.commentsOpen),
            settings.commentsOpen ? "已关闭新留言" : "已开启留言",
          )
        }
      />
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function SettingRow({
  id,
  title,
  state,
  hint,
  checked,
  pending,
  disabled,
  onToggle,
}: {
  id: string
  title: string
  state: string
  hint: string | null
  checked: boolean
  pending: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p id={id} className="text-[13px] font-medium">
          {title}
          <span className={cn("ml-2 text-xs font-normal", checked ? "text-primary" : "text-muted-foreground")}>{state}</span>
        </p>
        {pending ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            正在保存…
          </p>
        ) : hint ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-card shadow-sm transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  )
}

/** 教学介绍：默认为阅读状态，本人点“编辑”后进入编辑 */
export function IntroEditor({ ownerId, saved }: { ownerId: string; saved: string }) {
  const profile = useProfile()
  const { push } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(saved)
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle")
  const [error, setError] = useState("")
  const inflight = useRef(false)

  const len = textLength(draft.trim())
  const over = len > INTRO_MAX
  const dirty = draft.trim() !== saved

  const save = async () => {
    if (inflight.current || over) return
    if (!dirty) return setEditing(false)
    inflight.current = true
    setStatus("saving")
    await sleep(500)
    const r = profile.saveIntro(ownerId, ownerId, draft)
    inflight.current = false
    if (r.ok) {
      setStatus("idle")
      setEditing(false)
      push("教学介绍已保存")
    } else {
      setStatus("error")
      setError(r.message)
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        {saved ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{saved}</p>
        ) : (
          <p className="text-[13px] text-muted-foreground">还没有教学介绍。可以写教学方向、擅长领域或愿意交流的话题（选填）。</p>
        )}
        <div>
          <Button variant="outline" size="sm" onClick={() => { setDraft(saved); setStatus("idle"); setEditing(true) }}>
            <Pencil className="size-3.5" aria-hidden />
            {saved ? "编辑介绍" : "添加介绍"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="intro" className="sr-only">
        教学介绍
      </label>
      <Textarea
        id="intro"
        rows={5}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        placeholder="选填。例如：任教方向、擅长的教学方式、愿意与同事交流的话题。"
        aria-describedby="intro-hint"
        className="leading-relaxed"
      />
      {status === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {error} 内容已保留。
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="intro-hint" className={cn("text-xs", over ? "text-destructive" : "text-muted-foreground")}>
          {len}/{INTRO_MAX}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={status === "saving"}>
            取消
          </Button>
          <Button size="sm" onClick={save} disabled={over || status === "saving"}>
            {status === "saving" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {status === "saving" ? "保存中" : status === "error" ? "重试保存" : "保存"}
          </Button>
        </div>
      </div>
    </div>
  )
}
