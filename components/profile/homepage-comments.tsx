"use client"

import { useRef, useState } from "react"
import { Heart, Loader2, Lock, MessageSquareOff, Quote, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, Modal, useToast } from "@/components/kit"
import { MessageComposer } from "@/components/profile/message-composer"
import { StaffAvatar } from "@/components/profile/staff-avatar"
import { TeacherLink } from "@/components/profile/teacher-link"
import { cn } from "@/lib/utils"
import { staffById } from "@/lib/demo/staff"
import {
  canLike,
  canPostComment,
  canReply,
  formatTime,
  useProfile,
  type Access,
  type HomepageComment,
  type HomepageSettings,
  type Viewer,
} from "@/lib/profile/store"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Ctx {
  ownerId: string
  viewer: Viewer
  meId: string | null
  likeOk: boolean
  replyOk: boolean
  onStale: () => void
}

export function HomepageComments({
  ownerId,
  settings,
  access,
  viewer,
  onStale,
}: {
  ownerId: string
  settings: HomepageSettings
  access: Access
  viewer: Viewer
  onStale: () => void
}) {
  const profile = useProfile()
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const top = profile.topLevelOf(ownerId)
  const count = profile.countOf(ownerId)
  const isSelf = access.ok && access.self
  const ctx: Ctx = {
    ownerId,
    viewer,
    meId: viewer.kind === "staff" ? viewer.staffId : null,
    likeOk: canLike(access, settings),
    replyOk: canReply(access, settings),
    onStale,
  }

  let status: { icon: typeof Lock; text: string } | null = null
  if (settings.visibility !== "staff")
    status = { icon: Lock, text: "主页当前仅你自己可见：已有留言保留，你可以阅读和删除，但暂不产生新的留言、回复或点赞。" }
  else if (!settings.commentsOpen)
    status = {
      icon: MessageSquareOff,
      text: isSelf ? "你已关闭新留言：已有留言仍可阅读和点赞。" : "主页主人已关闭新留言，已有留言仍可阅读和点赞。",
    }

  return (
    <Card id="comments">
      <CardHeader
        title="留言"
        desc={count.comments ? `${count.comments} 条留言 · ${count.replies} 条回复` : "仅本校教职工可见，按时间由新到旧。"}
      />
      <div className="flex flex-col gap-4 px-5 py-4">
        {status ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
            <status.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {status.text}
          </p>
        ) : null}

        {canPostComment(access, settings) ? (
          <MessageComposer
            id="new-comment"
            label="写留言"
            hideLabel
            placeholder="给这位同事留言，例如教学交流或感谢。仅本校教职工可见。"
            submitLabel="发表留言"
            pendingLabel="发表中"
            onSubmit={(t) => profile.postComment(viewer, ownerId, t)}
            onBlocked={onStale}
          />
        ) : isSelf && ctx.replyOk ? (
          <p className="text-xs text-muted-foreground">你可以在同事的留言下点“引用回复”进行回复。</p>
        ) : null}

        {top.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">还没有留言。</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {top.map((c) => (
              <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                <CommentItem c={c} ctx={ctx} onReply={() => setReplyTo(replyTo === c.id ? null : c.id)} replying={replyTo === c.id} />
                <Replies parent={c} ctx={ctx} />
                {replyTo === c.id && ctx.replyOk ? (
                  <div className="mt-3 ml-11 rounded-lg border border-border bg-muted/40 p-3">
                    <MessageComposer
                      id={`reply-${c.id}`}
                      label={`引用回复 ${profile.displayNameOf(c.authorId)}`}
                      placeholder="写下你的回复…"
                      submitLabel="发布回复"
                      pendingLabel="发布中"
                      rows={2}
                      autoFocus
                      header={<QuoteLine parent={c} />}
                      onSubmit={(t) => {
                        const r = profile.postReply(viewer, c.id, t)
                        if (r.ok) setReplyTo(null)
                        return r
                      }}
                      onCancel={() => setReplyTo(null)}
                      onBlocked={onStale}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function Replies({ parent, ctx }: { parent: HomepageComment; ctx: Ctx }) {
  const profile = useProfile()
  const replies = profile.repliesOf(parent.id)
  if (!replies.length) return null
  return (
    <ul className="mt-3 ml-11 flex flex-col gap-3 border-l-2 border-border pl-4">
      {replies.map((r) => (
        <li key={r.id}>
          <CommentItem c={r} ctx={ctx} parent={parent} compact />
        </li>
      ))}
    </ul>
  )
}

function QuoteLine({ parent }: { parent: HomepageComment }) {
  const profile = useProfile()
  return (
    <p className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
      <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">
        引用 {profile.displayNameOf(parent.authorId)}：{parent.body}
      </span>
    </p>
  )
}

function CommentItem({
  c,
  ctx,
  parent,
  compact,
  onReply,
  replying,
}: {
  c: HomepageComment
  ctx: Ctx
  parent?: HomepageComment
  compact?: boolean
  onReply?: () => void
  replying?: boolean
}) {
  const profile = useProfile()
  const { push } = useToast()
  const [liking, setLiking] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const inflight = useRef(false)
  const author = staffById(c.authorId)
  const liked = ctx.meId ? c.likes.includes(ctx.meId) : false
  const canDelete = ctx.meId === c.authorId || ctx.meId === c.ownerId
  const replyCount = parent ? 0 : profile.repliesOf(c.id).length

  const like = async () => {
    if (inflight.current) return
    inflight.current = true
    setLiking(true)
    setError("")
    await sleep(300)
    const r = profile.toggleLike(ctx.viewer, c.id)
    inflight.current = false
    setLiking(false)
    if (!r.ok) {
      setError(r.message)
      if (r.code !== "network") ctx.onStale()
    }
  }

  const remove = async () => {
    setDeleting(true)
    await sleep(450)
    const r = profile.deleteComment(ctx.viewer, c.id)
    setDeleting(false)
    if (r.ok) {
      setConfirm(false)
      push(parent ? "回复已删除" : "留言已删除")
    } else setError(r.message)
  }

  return (
    <article id={`comment-${c.id}`} className="flex scroll-mt-24 gap-3 rounded-lg target:bg-accent/60 target:ring-2 target:ring-primary/30">
      <StaffAvatar staffId={c.authorId} size={compact ? "xs" : "sm"} className={compact ? "mt-0.5" : undefined} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
          <TeacherLink staffId={c.authorId} />
          {author?.department ? <span className="text-xs text-muted-foreground">{author.department}</span> : null}
          {c.authorId === c.ownerId ? <span className="text-xs text-primary">主页主人</span> : null}
          <time dateTime={c.createdAt} className="text-xs text-muted-foreground">
            {formatTime(c.createdAt)}
          </time>
        </p>
        {parent ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            回复 {profile.displayNameOf(parent.authorId)}
          </p>
        ) : null}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{c.body}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={like}
            disabled={!ctx.likeOk || liking}
            aria-pressed={liked}
            aria-label={`${liked ? "取消点赞" : "点赞"}，当前 ${c.likes.length} 个赞`}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default",
              liked ? "text-primary" : "text-muted-foreground",
              ctx.likeOk && "hover:bg-muted",
            )}
          >
            {liking ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Heart className={cn("size-3.5", liked && "fill-current")} aria-hidden />}
            {c.likes.length > 0 ? c.likes.length : ctx.likeOk ? "赞" : "0"}
          </button>
          {!parent && ctx.replyOk && onReply ? (
            <button
              type="button"
              onClick={onReply}
              aria-expanded={replying}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Quote className="size-3.5" aria-hidden />
              引用回复
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Trash2 className="size-3.5" aria-hidden />
              删除
            </button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <Modal
        open={confirm}
        onClose={() => !deleting && setConfirm(false)}
        title={parent ? "删除这条回复？" : "删除这条留言？"}
        desc={
          replyCount
            ? `其下 ${replyCount} 条引用回复会一并删除，且不再显示被引用的原文。删除后无法恢复。`
            : "删除后无法恢复。"
        }
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={deleting}>
              取消
            </Button>
            <Button variant="destructive" size="sm" onClick={remove} disabled={deleting}>
              {deleting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              {deleting ? "删除中" : "删除"}
            </Button>
          </>
        }
      >
        <p className="line-clamp-3 rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground">{c.body}</p>
      </Modal>
    </article>
  )
}
