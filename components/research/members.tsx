"use client"

import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DUTY_BY_KEY } from "@/lib/demo/staff"
import { useResearchContext } from "@/lib/research/context"
import { coursesFor, groupDuties } from "@/lib/research/model"
import { homepageEligible } from "@/lib/profile/store"
import { Panel } from "./primitives"

export function ResearchMembers({ group }: { group: string }) {
  const { state, actor, people, catalog } = useResearchContext()
  const duties = groupDuties(state, group, actor.date)
  const ids = [...new Set(duties.map(duty => duty.staffId))]
  return <Panel title="参与人员与教研职责" description="只读展示教职工管理的同一份职责记录；没有独立科组任命或自由维护成员名单。">
    {ids.map(id => {
      const person = people.find(item => item.id === id)
      const rows = duties.filter(duty => duty.staffId === id)
      const online = person?.accountStatus === "enabled" && person.status !== "left"
      return <article key={id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-2"><h3 className="font-semibold">{person?.name || id}</h3><div className="flex flex-wrap gap-2">{rows.map(duty => <Badge key={duty.id} variant="outline">{DUTY_BY_KEY[duty.type].label} · {duty.start}—{duty.end || "未设结束日期"}</Badge>)}</div><p className="text-muted-foreground">{person?.status === "left" ? "档案已离职，不产生当前教研访问；职责历史保留" : online ? "账号可用；教研职责不开放私人联系方式、个人课表或学生记录" : "暂无可用账号；职责可先登记，不显示线上送达、已读或提交"}</p><p className="text-muted-foreground">本组责任课程：{coursesFor(catalog, group).map(course => course.name).join("、") || "待维护"}；不从任课安排或部门文字自动归组。</p></div>
        {online && homepageEligible(id) ? <Link href={`/people/${id}`} className={buttonVariants({ variant: "outline" })}>统一教师工作主页</Link> : <span className="text-sm text-muted-foreground">工作主页未开放或不适用，仅显示必要身份</span>}
      </article>
    })}
    {!ids.length && <p className="text-muted-foreground">当前没有有效的组长或参与教师职责，请由学校有权人员安排。</p>}
    <p className="text-muted-foreground">组长维护本组公共资料与安排；参与教师使用获授权资料、维护自己的调整版并完成本人分工。</p>
    <Link href="/school?tab=staff" className="self-start text-primary underline">教职工管理 → 人员详情 → 职责／安排职责（按学校授权）</Link>
  </Panel>
}
