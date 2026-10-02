"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { StaffAvatar } from "@/components/profile/staff-avatar"
import { cn } from "@/lib/utils"
import { formatTime, resolveNotice, useProfile, useViewer, type HomepageNotice } from "@/lib/profile/store"

// 主页留言通知：打开时按当前权限与内容状态重新判定，不显示发送时的正文快照
export function NoticeBell() {
  const profile = useProfile()
  const viewer = useViewer()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (viewer.kind !== "staff" || !profile.hydrated) return null
  const me = viewer.staffId
  const list = profile.noticesFor(me)
  const unread = list.filter((n) => !n.read).length

  const openNotice = (n: HomepageNotice, reachable: boolean) => {
    profile.markNoticeRead(me, n.id)
    if (!reachable) return
    setOpen(false)
    router.push(`/people/${n.ownerId}#comment-${n.commentId}`)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? `通知，${unread} 条未读` : "通知"}
        className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Bell className="size-4" aria-hidden />
        {unread ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="通知"
          className="absolute right-0 top-full z-40 mt-1.5 w-80 rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <p className="text-[13px] font-semibold">主页留言通知</p>
            {unread ? (
              <button onClick={() => profile.markAllRead(me)} className="text-xs text-primary hover:underline">
                全部标为已读
              </button>
            ) : null}
          </div>
          {list.length === 0 ? (
            <p className="px-3.5 py-8 text-center text-[13px] text-muted-foreground">暂无通知</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {list.map((n) => {
                const v = resolveNotice(profile, viewer, n)
                const actor = profile.displayNameOf(n.actorId)
                const where = n.ownerId === me ? "你的主页" : `${profile.displayNameOf(n.ownerId)}的主页`
                const action = n.kind === "reply" ? `在${where}回复了` : `在${where}留言`
                const tail =
                  v.state === "ok"
                    ? v.body
                    : v.state === "gone"
                      ? "该内容已删除"
                      : v.state === "private"
                        ? "该主页当前仅主人自己可见"
                        : "你当前无权查看该内容"
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openNotice(n, v.state === "ok")}
                      className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <StaffAvatar staffId={n.actorId} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-snug">
                          <span className="font-medium">{actor}</span> {action}
                          {n.kind === "reply" && n.ownerId !== me ? "（引用了你的留言）" : ""}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block truncate text-xs",
                            v.state === "ok" ? "text-foreground/80" : "italic text-muted-foreground",
                          )}
                        >
                          {tail}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {formatTime(n.createdAt)}
                          {v.state === "ok" && !v.commentsOpen ? " · 留言已关闭" : ""}
                        </span>
                      </span>
                      {!n.read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="未读" /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
