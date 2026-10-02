"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Settings2, UserPen } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge, Card, CardHeader, Modal } from "@/components/kit"
import { HomepageComments } from "@/components/profile/homepage-comments"
import { HomepageDenied } from "@/components/profile/homepage-denied"
import { HomepageSettingsPanel, IntroEditor } from "@/components/profile/homepage-settings"
import { StaffAvatar } from "@/components/profile/staff-avatar"
import { SCHOOL_NAME } from "@/lib/demo/data"
import { activeDuties, DUTY_BY_KEY, staffById } from "@/lib/demo/staff"
import { courseName, subjectName, tasksForTeacher, useTeaching } from "@/lib/teaching/store"
import {
  homepageAccess,
  STAFF_TEACHER_ID,
  useProfile,
  useViewer,
  type HomepageSettings,
} from "@/lib/profile/store"

export function TeacherHomepage({ ownerId }: { ownerId: string }) {
  const profile = useProfile()
  const viewer = useViewer()
  const router = useRouter()
  const [panel, setPanel] = useState<"settings" | null>(null)

  const live = profile.settingsOf(ownerId)
  const viewerKey = viewer.kind === "staff" ? viewer.staffId : viewer.kind
  const isSelfLive = viewer.kind === "staff" && viewer.staffId === ownerId

  // 访客看到的是“打开页面时”的主页状态；主人在别处改设置不会让访客页面自动变化，
  // 访客提交时按最新状态重新校验（与真实系统一致）。主人自己的页面始终显示最新状态。
  const snapKey = `${ownerId}|${viewerKey}|${profile.hydrated}`
  const [snap, setSnap] = useState<{ key: string; settings: HomepageSettings } | null>(null)
  if (!isSelfLive && snap?.key !== snapKey) setSnap({ key: snapKey, settings: live })
  const settings = isSelfLive || !snap || snap.key !== snapKey ? live : snap.settings
  const refresh = () => setSnap(null)

  // 从账号中心“编辑主页设置”进入时直接打开设置
  useEffect(() => {
    if (isSelfLive && window.location.hash === "#settings") setPanel("settings")
  }, [isSelfLive])

  if (!profile.hydrated) {
    return <div className="mx-auto h-64 max-w-5xl animate-pulse rounded-xl bg-muted/60" aria-busy="true" />
  }

  const access = homepageAccess(viewer, ownerId, settings)
  if (!access.ok) return <HomepageDenied reason={access.reason} isParent={viewer.kind === "parent"} />

  const owner = staffById(ownerId)!
  const isSelf = access.self
  const display = profile.displayNameOf(ownerId)
  const duties = activeDuties(owner)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          返回
        </Button>
      </div>

      <header className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center">
        <StaffAvatar staffId={ownerId} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h1 className="text-balance text-xl font-semibold">{display}</h1>
            {display !== owner.name ? <span className="text-xs text-muted-foreground">正式姓名 {owner.name}</span> : null}
            {isSelf ? <Badge tone="info">我的主页</Badge> : null}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {[owner.department, owner.jobTitle, SCHOOL_NAME].filter(Boolean).join(" · ")}
          </p>
          {duties.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {duties.map((d) => (
                <Badge key={d.id}>
                  {DUTY_BY_KEY[d.type]?.label ?? d.type}
                  {d.scopeLabel ? <span className="text-muted-foreground">· {d.scopeLabel}</span> : null}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        {isSelf ? (
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <Link href="/account" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <UserPen className="size-3.5" aria-hidden />
                在账号中心修改头像与显示名
              </Link>
              <Button variant="outline" size="sm" onClick={() => setPanel("settings")}>
                <Settings2 className="size-3.5" aria-hidden />
                主页设置
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {settings.visibility === "staff" ? "本校教职工可见" : "仅自己可见"} · 留言{settings.commentsOpen ? "开启" : "关闭"}
            </p>
          </div>
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader title="教学介绍" />
            <div className="px-5 py-4">
              {isSelf ? (
                <IntroEditor key={`${ownerId}-${settings.intro}`} ownerId={ownerId} saved={settings.intro} />
              ) : settings.intro ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{settings.intro}</p>
              ) : (
                <p className="text-[13px] text-muted-foreground">暂未填写教学介绍。</p>
              )}
            </div>
          </Card>

          <HomepageComments ownerId={ownerId} settings={settings} access={access} viewer={viewer} onStale={refresh} />
        </div>

        <aside className="flex flex-col gap-5">
          <TeachingSummary ownerId={ownerId} />
          <PrototypeControls ownerId={ownerId} isSelf={isSelf} />
        </aside>
      </div>

      {isSelf ? (
        <Modal
          open={panel === "settings"}
          onClose={() => setPanel(null)}
          title="主页设置"
          desc="与账号中心中的设置是同一份，修改后立即生效。"
        >
          <HomepageSettingsPanel ownerId={ownerId} settings={live} />
        </Modal>
      ) : null}
    </div>
  )
}

function TeachingSummary({ ownerId }: { ownerId: string }) {
  const teaching = useTeaching()
  const teacherId = STAFF_TEACHER_ID[ownerId]
  const tasks = teacherId ? tasksForTeacher(teaching, teacherId) : []

  // 同一教学班的多个分工合并为一行，只展示工作信息，不含学生名单
  const byClass = new Map<string, { name: string; subject: string; course: string | null }>()
  for (const t of tasks) {
    if (byClass.has(t.classId)) continue
    const cls = teaching.classes.find((c) => c.id === t.classId)
    byClass.set(t.classId, { name: t.className, subject: subjectName(t.subjectId), course: courseName(cls?.courseId ?? null) })
  }
  const rows = [...byClass.values()]
  const subjects = [...new Set(rows.map((r) => r.subject))]
  const courses = [...new Set(rows.map((r) => r.course).filter(Boolean))] as string[]

  return (
    <Card>
      <CardHeader title="教学概况" desc="当前学期教学安排，只读。" />
      <div className="flex flex-col gap-4 px-5 py-4 text-[13px]">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">本学期暂无任教安排。</p>
        ) : (
          <>
            <SummaryGroup label="任教学科" items={subjects} />
            {courses.length ? <SummaryGroup label="课程" items={courses} /> : null}
            <div>
              <p className="text-xs text-muted-foreground">主要任教班级</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {rows.slice(0, 6).map((r) => (
                  <li key={r.name} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{r.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.subject}</span>
                  </li>
                ))}
              </ul>
              {rows.length > 6 ? <p className="mt-1.5 text-xs text-muted-foreground">另有 {rows.length - 6} 个班级</p> : null}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

function SummaryGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((s) => (
          <Badge key={s}>{s}</Badge>
        ))}
      </div>
    </div>
  )
}

// 原型专用：模拟网络失败与“主页主人在另一处修改设置”，便于演示边界情况
function PrototypeControls({ ownerId, isSelf }: { ownerId: string; isSelf: boolean }) {
  const profile = useProfile()
  const s = profile.settingsOf(ownerId)
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">原型演示</p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="accent-primary"
          checked={profile.failNext}
          onChange={(e) => profile.setFailNext(e.target.checked)}
        />
        下一次提交模拟网络失败
      </label>
      {!isSelf ? (
        <>
          <p className="mt-1 leading-relaxed">模拟主页主人在别处修改设置（你的页面不会自动刷新，提交时会重新校验）：</p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => profile.simulateOwnerChange(ownerId, { commentsOpen: !s.commentsOpen })}
            >
              {s.commentsOpen ? "主人关闭留言" : "主人开启留言"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => profile.simulateOwnerChange(ownerId, { visibility: s.visibility === "staff" ? "self" : "staff" })}
            >
              {s.visibility === "staff" ? "主人设为仅自己可见" : "主人恢复教职工可见"}
            </Button>
          </div>
        </>
      ) : null}
      <button className="mt-1 self-start underline underline-offset-2 hover:text-foreground" onClick={profile.reset}>
        重置主页与留言示例数据
      </button>
    </div>
  )
}
