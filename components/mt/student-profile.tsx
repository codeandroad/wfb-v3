"use client"

import { Badge, Card, CardHeader, EmptyState, LinkButton } from "@/components/kit"
import { MtDemoBar, MtLoadError, MtLoading } from "@/components/mt/shared"
import { currentWeek, permittedTasks, taskWeek, useTeacherId } from "@/lib/mt/derive"
import { homeroomHeads, taskTitle } from "@/lib/mt/display"
import { homeroomName, studentById } from "@/lib/mt/model"
import { useMt } from "@/lib/mt/store"
import { useAdminClasses } from "@/lib/school/admin-class-store"
import { ArrowLeft, ArrowRight, ShieldAlert, UserRound } from "lucide-react"
import { useSearchParams } from "next/navigation"

/** Only in-app workspace / class-detail paths are accepted as return targets. */
export function safeReturn(raw: string | null): { href: string; label: string } | null {
  if (!raw || raw.includes("//") || raw.includes("\\")) return null
  if (/^\/teaching\/task\/[\w-]+(\?[\w=&%.-]*)?$/.test(raw)) return { href: raw, label: "返回学生反馈" }
  if (/^\/teaching\/class\/[\w%-]+(\?[\w=&%.-]*)?$/.test(raw)) return { href: raw, label: "返回班级详情" }
  return null
}

export function StudentProfilePage({ sid }: { sid: string }) {
  const mt = useMt()
  const teacherId = useTeacherId()
  const sp = useSearchParams()
  const adminClasses = useAdminClasses()

  if (!mt.ready) return <MtLoading />
  if (mt.loadError) return <MtLoadError />

  const ret = safeReturn(sp.get("ret"))
  const back = ret ? (
    <LinkButton variant="ghost" href={ret.href}>
      <ArrowLeft className="size-3.5" aria-hidden />
      {ret.label}
    </LinkButton>
  ) : null

  const st = studentById(sid)
  const week = currentWeek(mt.biz)
  const tasks = permittedTasks(mt.biz, teacherId)
  const mine = tasks.filter((t) => t.student_ids.includes(sid))
  const thisWeek = mine.filter((t) => taskWeek(mt.biz, t, week).students.includes(sid))

  if (!st || !teacherId || mine.length === 0) {
    return (
      <div>
        <div className="mb-3">{back}</div>
        <MtDemoBar />
        <EmptyState
          icon={<ShieldAlert className="size-7" />}
          title="无法查看该学生资料"
          desc={!st ? "学生不存在或已失效。" : "该学生不在你任教的任何教学班中，无权查看其资料。"}
        />
      </div>
    )
  }

  const date = mt.biz.clock.slice(0, 10)
  const heads = homeroomHeads(st.homeroom_id, adminClasses, date)
  const retParam = `&ret=${encodeURIComponent(`/teaching/student/${sid}${sp.get("ret") && ret ? `?ret=${encodeURIComponent(ret.href)}` : ""}`)}`

  return (
    <div>
      <div className="mb-3">{back}</div>
      <MtDemoBar />

      <header className="mb-5 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-primary" aria-hidden>
          <UserRound className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">{st.name}</h1>
          <p className="text-sm text-muted-foreground">行政班 {homeroomName(st.homeroom_id)}</p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="基本资料" />
          <dl className="grid grid-cols-[7rem_1fr] gap-y-2.5 px-5 pb-5 text-sm">
            <dt className="text-muted-foreground">行政班</dt>
            <dd>{homeroomName(st.homeroom_id)}</dd>
            <dt className="text-muted-foreground">在班期间</dt>
            <dd>
              {st.membership_from} 至 {st.membership_until || "今"}
            </dd>
            <dt className="text-muted-foreground">家长联系方式</dt>
            <dd>{st.has_verified_guardian_contact ? <Badge tone="success">已核验</Badge> : <Badge tone="warning">未核验</Badge>}</dd>
          </dl>
        </Card>

        <Card>
          <CardHeader title="班主任" desc="以该生实际行政班的当前任命为准" />
          <div className="px-5 pb-5 text-sm">
            {heads === null ? (
              <p className="text-muted-foreground">暂时无法读取行政班资料。</p>
            ) : heads.length === 0 ? (
              <p className="text-muted-foreground">该行政班当前未设置班主任。</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {heads.map((h) => (
                  <li key={`${h.staffId}-${h.role}`} className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{h.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{h.role}</span>
                    </span>
                    <LinkButton variant="ghost" href={`/people/${h.staffId}`}>
                      查看教师资料
                    </LinkButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="我任教的课程" desc={`第 ${week} 周 · 可直接填写本期反馈`} />
          <ul className="divide-y divide-border">
            {mine.map((t) => {
              const active = thisWeek.includes(t)
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span className="text-sm font-medium">{taskTitle(t, teacherId, mt.biz, tasks)}</span>
                  {active ? (
                    <LinkButton href={`/teaching/task/${t.id}?week=${week}&student=${sid}&from=student${retParam}`}>
                      填写本期反馈
                      <ArrowRight className="size-3.5" aria-hidden />
                    </LinkButton>
                  ) : (
                    <span className="text-xs text-muted-foreground">本周不在有效名单内</span>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </div>
  )
}
