"use client"

import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useResearchContext } from "@/lib/research/context"
import { activeAt, coursesFor } from "@/lib/research/model"
import { homepageEligible } from "@/lib/profile/store"
import { Panel } from "./primitives"

export function ResearchMembers({ group }: { group: string }) {
  const { state, actor, people, catalog } = useResearchContext()
  const appointments = state.appointments.filter(a => a.group === group && activeAt(a.start, a.end, actor.date))
  const ids = [...new Set(appointments.map(a => a.staff))]
  return <Panel title="正式成员与组内职责" description="同一人员档案，账号与成员身份分开。任务协作和跨组听课不改变正式任命。">
    {ids.map(id => { const person = people.find(p => p.id === id); const rows = appointments.filter(a => a.staff === id); const online = person?.accountStatus === "enabled" && person.status !== "left"; return <article key={id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"><div className="flex flex-col gap-2"><h3 className="font-semibold">{person?.name || id}</h3><div className="flex flex-wrap gap-2">{rows.map(a => <Badge key={a.id} variant="outline">{a.role} · {a.start}—{a.end || "未设结束"}</Badge>)}</div><p className="text-muted-foreground">{person?.status === "left" ? "档案已离职，任命待学校核对" : online ? "可用账号；不公开私人联系方式、课表或学生记录" : "无可用账号；可列入正式成员，不显示线上送达、已读或提交"}</p><p className="text-muted-foreground">本组责任课程：{coursesFor(catalog, group).map(c => c.name).join("、") || "待维护"}；具体任课不作归组依据。</p></div>{online && homepageEligible(id) ? <Link href={`/people/${id}`} className={buttonVariants({ variant: "outline" })}>统一教师工作主页</Link> : <span className="text-sm text-muted-foreground">工作主页未开放或不适用，仅显示必要身份</span>}</article> })}
    {!ids.length && <p className="text-muted-foreground">没有当前有效成员任命，请在原学校管理中维护。</p>}
    <Link href="/school?tab=staff" className="self-start text-primary underline">学校教职工及正式任命流程（按学校授权）</Link>
  </Panel>
}
