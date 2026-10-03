"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { PERSONAS } from "@/lib/demo/nav"
import { useDemo } from "@/lib/demo/store"
import { STAFF, staffById, type StaffProfile } from "@/lib/demo/staff"

/* ============================================================
 * 教师主页 · 账号中心（原型：浏览器会话内状态，无真实后端，头像不会上传到服务器）
 * 所有写操作在执行时按“当前”状态重新校验权限，不依赖页面打开时的旧状态。
 * 作者、主页、通知一律以稳定的教职工 id 关联；显示名与头像只是展示层。
 * ========================================================== */

export type Visibility = "staff" | "self"

export interface HomepageSettings {
  intro: string
  visibility: Visibility
  commentsOpen: boolean
}

// 只保存用户明确设置过的字段；未设置的字段取默认值。
// 因此调整默认值不会覆盖已经明确关闭主页或留言的用户。
export type HomepagePrefs = Partial<HomepageSettings>

export const DEFAULT_SETTINGS: HomepageSettings = { intro: "", visibility: "staff", commentsOpen: true }

export type DisplayStyle = "formal" | "formal_en" | "en_title"
export interface Identity {
  avatar?: string // 原型：本地压缩后的图片数据，仅保存在当前浏览器会话
  displayStyle?: DisplayStyle
}

export interface HomepageComment {
  id: string
  ownerId: string
  authorId: string
  body: string
  createdAt: string
  parentId?: string // 有值即为引用回复（只允许引用主留言，一层）
  likes: string[] // 点赞的教职工 id，同一账号最多一次
}

export interface HomepageNotice {
  id: string
  recipientId: string
  kind: "comment" | "reply"
  ownerId: string
  commentId: string
  actorId: string
  createdAt: string
  read: boolean
}

export const INTRO_MAX = 300
export const COMMENT_MAX = 300
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"]

// 按用户看到的字符计数（一个 emoji 计 1），避免与底层编码长度不一致
export function textLength(s: string): number {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<unknown> } }).Segmenter
  if (Seg) {
    let n = 0
    for (const _ of new Seg("zh", { granularity: "grapheme" }).segment(s)) n++
    return n
  }
  return Array.from(s).length
}

export { STAFF_TEACHER_ID, staffIdForTeacher } from "@/lib/demo/staff"

export function isActiveStaff(s: StaffProfile): boolean {
  return s.status !== "left" && s.accountStatus === "enabled"
}
// 教师主页适用于具备任课或班主任角色、且账号可正常使用的教职工
export function hasTeacherHomepage(s: StaffProfile): boolean {
  const teachingRole = s.systemRoles.includes("SUBJECT_TEACHER") || s.systemRoles.includes("HOMEROOM_TEACHER")
  return teachingRole && isActiveStaff(s)
}
export function homepageEligible(staffId: string): boolean {
  const s = staffById(staffId)
  return !!s && hasTeacherHomepage(s)
}

/* ---------- 显示名：只能从档案已有姓名组合，不是自由昵称 ---------- */

export function displayOptions(s: StaffProfile): { style: DisplayStyle; label: string }[] {
  const out: { style: DisplayStyle; label: string }[] = [{ style: "formal", label: s.name }]
  if (s.englishName) {
    out.push({ style: "formal_en", label: `${s.name} ${s.englishName}` })
    out.push({ style: "en_title", label: `${s.englishName} 老师` })
  }
  return out
}
export function displayNameFor(s: StaffProfile, style?: DisplayStyle): string {
  return displayOptions(s).find((o) => o.style === style)?.label ?? s.name
}

/* ---------- 访问与互动规则 ---------- */

export type Viewer = { kind: "staff"; staffId: string } | { kind: "parent" } | { kind: "anon" }

export type DenyReason = "not_found" | "no_homepage" | "not_staff" | "invalid_staff" | "private"
export type Access = { ok: true; self: boolean } | { ok: false; reason: DenyReason }

export function homepageAccess(viewer: Viewer, ownerId: string, settings: HomepageSettings): Access {
  if (viewer.kind !== "staff") return { ok: false, reason: "not_staff" }
  const me = staffById(viewer.staffId)
  if (!me || !isActiveStaff(me)) return { ok: false, reason: "invalid_staff" }
  const owner = staffById(ownerId)
  if (!owner) return { ok: false, reason: "not_found" }
  if (!hasTeacherHomepage(owner)) return { ok: false, reason: "no_homepage" }
  if (me.id === owner.id) return { ok: true, self: true }
  if (settings.visibility !== "staff") return { ok: false, reason: "private" }
  return { ok: true, self: false }
}

// 主页仅自己可见时不产生任何新互动（含主人本人）；主人仍可删除与管理已有内容
const interactive = (access: Access, s: HomepageSettings) => access.ok && s.visibility === "staff"
export const canLike = (access: Access, s: HomepageSettings) => interactive(access, s)
export const canReply = (access: Access, s: HomepageSettings) => interactive(access, s) && s.commentsOpen
export const canPostComment = (access: Access, s: HomepageSettings) =>
  interactive(access, s) && s.commentsOpen && access.ok && !access.self

export type ActionResult =
  | { ok: true }
  | { ok: false; code: "network" | "denied" | "closed" | "invalid" | "gone"; message: string }

interface ProfileState {
  prefs: Record<string, HomepagePrefs>
  identities: Record<string, Identity>
  comments: HomepageComment[]
  notices: HomepageNotice[]
  failNext: boolean // 原型：让下一次提交模拟网络失败
  seq: number
}

function seed(): ProfileState {
  const C = (
    id: string,
    ownerId: string,
    authorId: string,
    createdAt: string,
    body: string,
    likes: string[] = [],
    parentId?: string,
  ): HomepageComment => ({ id, ownerId, authorId, createdAt, body, likes, parentId })
  const N = (id: string, recipientId: string, kind: HomepageNotice["kind"], ownerId: string, commentId: string, actorId: string, createdAt: string, read = false): HomepageNotice => ({
    id, recipientId, kind, ownerId, commentId, actorId, createdAt, read,
  })
  return {
    prefs: {
      "u-zhou": {
        intro:
          "负责高一物理。课堂上更看重实验探究：先让学生动手测，再一起把现象整理成模型。\n乐于交流：把演示实验改成分组探究的做法、物理作业的分层设计。",
        visibility: "self",
      },
      "u-wu": {
        intro: "教高一经济。常用本地商户与校园生活的真实案例导入概念，欢迎一起讨论跨学科的项目式作业。",
      },
      // 陈老师此前明确关闭过留言：默认值改为开启后，仍保持关闭
      "u-chen": { commentsOpen: false },
    },
    identities: {
      "u-lin": { displayStyle: "formal_en" },
      "u-wu": { avatar: "/demo/avatars/wu.png", displayStyle: "en_title" },
      "u-chen": { avatar: "/demo/avatars/chen.png" },
    },
    comments: [
      C("c-1", "u-lin", "u-wu", "2026-09-22T16:10:00", "分层作业的 A/B 卷思路很实用，经济课的案例题我也想按这个方式拆一拆 👍", ["u-chen", "u-lin"]),
      C("c-2", "u-lin", "u-lin", "2026-09-22T18:40:00", "欢迎一起试！下次教研我把模板带过去 😊", ["u-wu"], "c-1"),
      C("c-3", "u-lin", "u-chen", "2026-09-23T09:05:00", "化学计算题思路可以借鉴，算我一个。", [], "c-1"),
      C("c-4", "u-lin", "u-xu", "2026-09-24T11:30:00", "本周教研组会议改到周四第 8 节，地点不变，请大家留意。", ["u-lin"]),
      C("c-5", "u-lin", "u-chen", "2026-09-26T17:20:00", "🎉🎉", []),
      C("c-6", "u-wu", "u-chen", "2026-09-21T15:20:00", "上周教研会提到的“校园小超市定价”案例很有意思，化学课的成本核算单元也许能一起做。", ["u-wu", "u-lin"]),
      C("c-7", "u-wu", "u-wu", "2026-09-21T17:02:00", "好啊，下周教研时间我们约一下。", ["u-chen"], "c-6"),
      C("c-8", "u-wu", "u-lin", "2026-09-25T10:15:00", "项目式作业的评价量表可以分享一份吗？📊", []),
      C("c-9", "u-zhou", "u-lin", "2026-09-18T10:05:00", "分组实验记录表很好用，我想借到数学建模课上试试。", []),
      C("c-10", "u-chen", "u-wu", "2026-09-15T14:00:00", "竞赛班的周测题型整理得很清楚，谢谢分享！", ["u-lin"]),
      C("c-11", "u-chen", "u-chen", "2026-09-15T16:30:00", "不客气～ 🙂", [], "c-10"),
    ],
    notices: [
      N("n-1", "u-lin", "comment", "u-lin", "c-1", "u-wu", "2026-09-22T16:10:00", true),
      N("n-2", "u-wu", "reply", "u-lin", "c-2", "u-lin", "2026-09-22T18:40:00", true),
      N("n-3", "u-wu", "reply", "u-lin", "c-3", "u-chen", "2026-09-23T09:05:00"),
      N("n-4", "u-lin", "reply", "u-lin", "c-3", "u-chen", "2026-09-23T09:05:00"),
      N("n-5", "u-lin", "comment", "u-lin", "c-4", "u-xu", "2026-09-24T11:30:00"),
      N("n-6", "u-lin", "comment", "u-lin", "c-5", "u-chen", "2026-09-26T17:20:00"),
      N("n-7", "u-chen", "reply", "u-wu", "c-7", "u-wu", "2026-09-21T17:02:00", true),
      N("n-8", "u-wu", "comment", "u-wu", "c-8", "u-lin", "2026-09-25T10:15:00"),
      N("n-9", "u-zhou", "comment", "u-zhou", "c-9", "u-lin", "2026-09-18T10:05:00"),
      // 指向已被作者删除的留言：通知保留，但不再显示正文
      N("n-10", "u-lin", "comment", "u-wu", "c-0", "u-chen", "2026-09-19T08:40:00", true),
      N("n-11", "u-chen", "comment", "u-chen", "c-10", "u-wu", "2026-09-15T14:00:00", true),
    ],
    failNext: false,
    seq: 20,
  }
}

const STORAGE_KEY = "tgs-profile:v2"
const LEGACY_KEY = "tgs-profile:v1"

interface LegacyState {
  settings: Record<string, HomepageSettings>
  comments: { id: string; ownerId: string; authorId: string; body: string; createdAt: string; reply?: { body: string; createdAt: string } }[]
  seq: number
}

// v1 → v2：旧设置整体视为“明确设置”，保证已关闭的主页/留言不被新默认值重新开启
function migrate(v1: LegacyState): ProfileState {
  const base = seed()
  const comments: HomepageComment[] = []
  let seq = Math.max(v1.seq ?? 0, base.seq)
  for (const c of v1.comments ?? []) {
    comments.push({ id: c.id, ownerId: c.ownerId, authorId: c.authorId, body: c.body, createdAt: c.createdAt, likes: [] })
    if (c.reply) comments.push({ id: `c-${seq++}`, ownerId: c.ownerId, authorId: c.ownerId, body: c.reply.body, createdAt: c.reply.createdAt, parentId: c.id, likes: [] })
  }
  return { ...base, prefs: { ...v1.settings }, comments, notices: [], seq }
}

function load(): ProfileState | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as ProfileState
      if (p && typeof p.prefs === "object" && Array.isArray(p.comments) && Array.isArray(p.notices)) return p
    }
    const legacy = window.sessionStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const l = JSON.parse(legacy) as LegacyState
      if (l && typeof l.settings === "object" && Array.isArray(l.comments)) return migrate(l)
    }
  } catch {
    /* ignore */
  }
  return null
}

export interface ProfileContextValue {
  hydrated: boolean
  failNext: boolean
  setFailNext: (v: boolean) => void
  settingsOf: (ownerId: string) => HomepageSettings
  identityOf: (staffId: string) => Identity
  displayNameOf: (staffId: string) => string
  avatarOf: (staffId: string) => string | undefined
  topLevelOf: (ownerId: string) => HomepageComment[]
  repliesOf: (commentId: string) => HomepageComment[]
  commentById: (id: string) => HomepageComment | undefined
  countOf: (ownerId: string) => { comments: number; replies: number }
  noticesFor: (staffId: string) => HomepageNotice[]
  markNoticeRead: (staffId: string, noticeId: string) => void
  markAllRead: (staffId: string) => void
  saveIntro: (actorId: string, ownerId: string, intro: string) => ActionResult
  setVisibility: (actorId: string, ownerId: string, v: Visibility) => ActionResult
  setCommentsOpen: (actorId: string, ownerId: string, open: boolean) => ActionResult
  setAvatar: (actorId: string, targetId: string, avatar: string | null) => ActionResult
  setDisplayStyle: (actorId: string, targetId: string, style: DisplayStyle | null) => ActionResult
  postComment: (viewer: Viewer, ownerId: string, body: string) => ActionResult
  postReply: (viewer: Viewer, parentId: string, body: string) => ActionResult
  toggleLike: (viewer: Viewer, commentId: string) => ActionResult
  deleteComment: (viewer: Viewer, commentId: string) => ActionResult
  simulateOwnerChange: (ownerId: string, patch: Partial<HomepageSettings>) => void
  reset: () => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

const NETWORK_FAIL: ActionResult = { ok: false, code: "network", message: "网络异常，提交未完成。内容已保留，可直接重试。" }

const settingsIn = (s: ProfileState, id: string): HomepageSettings => ({ ...DEFAULT_SETTINGS, ...s.prefs[id] })

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProfileState>(seed)
  const [hydrated, setHydrated] = useState(false)
  const ref = useRef(state)

  useEffect(() => {
    const saved = load()
    if (saved) {
      ref.current = saved
      setState(saved)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* 会话存储已满等情况：状态仍保留在当前页面内存中 */
    }
  }, [hydrated, state])

  const commit = useCallback((next: ProfileState) => {
    ref.current = next
    setState(next)
  }, [])

  // 先消耗一次“模拟失败”，失败时不改变任何数据
  const consumeFailure = useCallback((): boolean => {
    if (!ref.current.failNext) return false
    commit({ ...ref.current, failNext: false })
    return true
  }, [commit])

  const updatePrefs = useCallback(
    (actorId: string, ownerId: string, patch: HomepagePrefs): ActionResult => {
      if (actorId !== ownerId) return { ok: false, code: "denied", message: "只能修改自己的教师主页。" }
      if (!homepageEligible(ownerId)) return { ok: false, code: "denied", message: "当前账号没有教师主页。" }
      if (consumeFailure()) return NETWORK_FAIL
      const s = ref.current
      commit({ ...s, prefs: { ...s.prefs, [ownerId]: { ...s.prefs[ownerId], ...patch } } })
      return { ok: true }
    },
    [commit, consumeFailure],
  )

  const updateIdentity = useCallback(
    (actorId: string, targetId: string, patch: Identity): ActionResult => {
      if (actorId !== targetId) return { ok: false, code: "denied", message: "只能修改自己的头像与显示名。" }
      const me = staffById(actorId)
      if (!me || !isActiveStaff(me)) return { ok: false, code: "denied", message: "当前账号不可用，无法修改。" }
      if (consumeFailure()) return NETWORK_FAIL
      const s = ref.current
      const next = { ...s.identities[targetId], ...patch }
      if (!next.avatar) delete next.avatar
      if (!next.displayStyle) delete next.displayStyle
      commit({ ...s, identities: { ...s.identities, [targetId]: next } })
      return { ok: true }
    },
    [commit, consumeFailure],
  )

  const validateBody = (body: string, label: string): ActionResult | null => {
    const text = body.trim()
    if (!text) return { ok: false, code: "invalid", message: `${label}内容不能为空。` }
    if (textLength(text) > COMMENT_MAX) return { ok: false, code: "invalid", message: `${label}最多 ${COMMENT_MAX} 字。` }
    return null
  }

  // 通知接收人：去重、排除操作者本人、仅限仍在职的教职工
  const makeNotices = (cur: ProfileState, recipients: string[], base: Omit<HomepageNotice, "id" | "recipientId" | "read">) => {
    const uniq = [...new Set(recipients)].filter((r) => r !== base.actorId && staffById(r) && isActiveStaff(staffById(r)!))
    let seq = cur.seq
    const list = uniq.map((recipientId) => ({ ...base, id: `n-${seq++}`, recipientId, read: false }))
    return { list, seq }
  }

  const value = useMemo<ProfileContextValue>(() => {
    const byId = (id: string) => state.comments.find((c) => c.id === id)
    return {
      hydrated,
      failNext: state.failNext,
      setFailNext: (failNext) => commit({ ...ref.current, failNext }),
      settingsOf: (id) => settingsIn(state, id),
      identityOf: (id) => state.identities[id] ?? {},
      displayNameOf: (id) => {
        const s = staffById(id)
        return s ? displayNameFor(s, state.identities[id]?.displayStyle) : "已不在本校的教职工"
      },
      avatarOf: (id) => state.identities[id]?.avatar,
      topLevelOf: (ownerId) =>
        state.comments.filter((c) => c.ownerId === ownerId && !c.parentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      repliesOf: (commentId) =>
        state.comments
          .filter((c) => c.parentId === commentId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
      commentById: byId,
      countOf: (ownerId) => {
        const top = state.comments.filter((c) => c.ownerId === ownerId && !c.parentId)
        const ids = new Set(top.map((c) => c.id))
        return { comments: top.length, replies: state.comments.filter((c) => c.parentId && ids.has(c.parentId)).length }
      },
      noticesFor: (id) =>
        state.notices.filter((n) => n.recipientId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      markNoticeRead: (id, noticeId) => {
        const s = ref.current
        commit({ ...s, notices: s.notices.map((n) => (n.id === noticeId && n.recipientId === id ? { ...n, read: true } : n)) })
      },
      markAllRead: (id) => {
        const s = ref.current
        commit({ ...s, notices: s.notices.map((n) => (n.recipientId === id ? { ...n, read: true } : n)) })
      },
      saveIntro: (actorId, ownerId, intro) => {
        const text = intro.trim()
        if (textLength(text) > INTRO_MAX) return { ok: false, code: "invalid", message: `教学介绍最多 ${INTRO_MAX} 字。` }
        return updatePrefs(actorId, ownerId, { intro: text })
      },
      setVisibility: (actorId, ownerId, visibility) => updatePrefs(actorId, ownerId, { visibility }),
      setCommentsOpen: (actorId, ownerId, commentsOpen) => updatePrefs(actorId, ownerId, { commentsOpen }),
      setAvatar: (actorId, targetId, avatar) => updateIdentity(actorId, targetId, { avatar: avatar ?? undefined }),
      setDisplayStyle: (actorId, targetId, style) =>
        updateIdentity(actorId, targetId, { displayStyle: style && style !== "formal" ? style : undefined }),

      postComment: (viewer, ownerId, body) => {
        const bad = validateBody(body, "留言")
        if (bad) return bad
        const settings = settingsIn(ref.current, ownerId)
        const access = homepageAccess(viewer, ownerId, settings)
        if (!access.ok) return { ok: false, code: "denied", message: "该主页当前不对你开放，留言未发表。你的内容仍保留在输入框中。" }
        if (!canPostComment(access, settings))
          return { ok: false, code: "closed", message: "主页主人已关闭留言，留言未发表。你的内容仍保留在输入框中。" }
        if (consumeFailure()) return NETWORK_FAIL
        const cur = ref.current
        const me = (viewer as { staffId: string }).staffId
        const now = new Date().toISOString()
        const id = `c-${cur.seq}`
        const n = makeNotices({ ...cur, seq: cur.seq + 1 }, [ownerId], { kind: "comment", ownerId, commentId: id, actorId: me, createdAt: now })
        commit({
          ...cur,
          seq: n.seq,
          comments: [...cur.comments, { id, ownerId, authorId: me, body: body.trim(), createdAt: now, likes: [] }],
          notices: [...cur.notices, ...n.list],
        })
        return { ok: true }
      },

      postReply: (viewer, parentId, body) => {
        const bad = validateBody(body, "回复")
        if (bad) return bad
        const s = ref.current
        const parent = s.comments.find((x) => x.id === parentId)
        if (!parent) return { ok: false, code: "gone", message: "被引用的留言已被删除，回复未发布。你的内容仍保留。" }
        if (parent.parentId) return { ok: false, code: "invalid", message: "只能引用主留言进行回复。" }
        const settings = settingsIn(s, parent.ownerId)
        const access = homepageAccess(viewer, parent.ownerId, settings)
        if (!access.ok) return { ok: false, code: "denied", message: "该主页当前不对你开放，回复未发布。你的内容仍保留。" }
        if (!canReply(access, settings))
          return { ok: false, code: "closed", message: "主页当前不接受新留言，回复未发布。你的内容仍保留。" }
        if (consumeFailure()) return NETWORK_FAIL
        const cur = ref.current
        const me = (viewer as { staffId: string }).staffId
        const now = new Date().toISOString()
        const id = `c-${cur.seq}`
        const n = makeNotices({ ...cur, seq: cur.seq + 1 }, [parent.authorId, parent.ownerId], {
          kind: "reply",
          ownerId: parent.ownerId,
          commentId: id,
          actorId: me,
          createdAt: now,
        })
        commit({
          ...cur,
          seq: n.seq,
          comments: [...cur.comments, { id, ownerId: parent.ownerId, authorId: me, body: body.trim(), createdAt: now, parentId, likes: [] }],
          notices: [...cur.notices, ...n.list],
        })
        return { ok: true }
      },

      toggleLike: (viewer, commentId) => {
        const s = ref.current
        const c = s.comments.find((x) => x.id === commentId)
        const parentGone = c?.parentId && !s.comments.some((x) => x.id === c.parentId)
        if (!c || parentGone) return { ok: false, code: "gone", message: "这条内容已被删除。" }
        const settings = settingsIn(s, c.ownerId)
        const access = homepageAccess(viewer, c.ownerId, settings)
        if (!access.ok) return { ok: false, code: "denied", message: "该主页当前不对你开放。" }
        if (!canLike(access, settings)) return { ok: false, code: "closed", message: "主页当前仅主人自己可见，暂不能点赞。" }
        if (consumeFailure()) return NETWORK_FAIL
        const me = (viewer as { staffId: string }).staffId
        const cur = ref.current
        commit({
          ...cur,
          comments: cur.comments.map((x) =>
            x.id !== commentId ? x : { ...x, likes: x.likes.includes(me) ? x.likes.filter((l) => l !== me) : [...x.likes, me] },
          ),
        })
        return { ok: true }
      },

      deleteComment: (viewer, commentId) => {
        const s = ref.current
        const c = s.comments.find((x) => x.id === commentId)
        if (!c) return { ok: false, code: "gone", message: "这条内容已不存在。" }
        const me = viewer.kind === "staff" ? viewer.staffId : null
        const meStaff = me ? staffById(me) : undefined
        if (!me || !meStaff || !isActiveStaff(meStaff) || (me !== c.authorId && me !== c.ownerId))
          return { ok: false, code: "denied", message: "只能删除自己发表的内容，或自己主页上的内容。" }
        if (consumeFailure()) return NETWORK_FAIL
        const cur = ref.current
        // 删除主留言时，其下的引用回复一并删除，不保留任何引用原文快照
        commit({ ...cur, comments: cur.comments.filter((x) => x.id !== commentId && x.parentId !== commentId) })
        return { ok: true }
      },

      simulateOwnerChange: (ownerId, patch) => {
        const s = ref.current
        commit({ ...s, prefs: { ...s.prefs, [ownerId]: { ...s.prefs[ownerId], ...patch } } })
      },
      reset: () => commit(seed()),
    }
  }, [hydrated, state, commit, updatePrefs, updateIdentity, consumeFailure])

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider")
  return ctx
}

// 当前访问者：家长外壳不属于教职工；否则取演示人物关联的教职工档案
export function useViewer(): Viewer {
  const demo = useDemo()
  if (demo.scenario === "parent") return { kind: "parent" }
  return { kind: "staff", staffId: PERSONAS[demo.persona].staffId }
}

export function staffName(id: string): string {
  return STAFF.find((s) => s.id === id)?.name ?? "已不在本校的教职工"
}

// 通知在打开时按当前状态重新判定，绝不使用发送时的正文快照
export type NoticeView =
  | { state: "ok"; body: string; commentsOpen: boolean }
  | { state: "gone" }
  | { state: "private" }
  | { state: "denied" }

export function resolveNotice(p: ProfileContextValue, viewer: Viewer, n: HomepageNotice): NoticeView {
  const c = p.commentById(n.commentId)
  if (!c || (c.parentId && !p.commentById(c.parentId))) return { state: "gone" }
  const settings = p.settingsOf(c.ownerId)
  const access = homepageAccess(viewer, c.ownerId, settings)
  if (!access.ok) return access.reason === "private" ? { state: "private" } : { state: "denied" }
  return { state: "ok", body: c.body, commentsOpen: settings.commentsOpen && settings.visibility === "staff" }
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
