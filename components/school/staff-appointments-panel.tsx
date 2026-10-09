"use client"

import { useState } from "react"
import { CalendarOff, Pencil, Plus } from "lucide-react"
import { useToast } from "@/components/kit"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import type { StaffProfile } from "@/lib/demo/staff"
import { useResearchContext } from "@/lib/research/context"
import { activeAt, groups, schoolScopes, type Appointment } from "@/lib/research/model"
import { useStaffPermission } from "@/lib/school/staff-store"
import { StaffAppointmentForm, type AppointmentEditorState } from "./staff-appointment-form"

const sections = ["有效任命", "待生效任命", "已结束任命"] as const

function sectionOf(appointment: Appointment, date: string): (typeof sections)[number] {
  if (appointment.start > date) return "待生效任命"
  return activeAt(appointment.start, appointment.end, date) ? "有效任命" : "已结束任命"
}

export function StaffAppointmentsPanel({ staff }: { staff: StaffProfile }) {
  const { state, actor, ready } = useResearchContext()
  const canManageStaff = useStaffPermission()
  const { push } = useToast()
  const [selection, setSelection] = useState<AppointmentEditorState | null>(null)
  const scope = canManageStaff ? schoolScopes(state, actor, true) : []
  const appointments = state.appointments.filter(appointment => appointment.staff === staff.id).sort((a, b) => b.start.localeCompare(a.start) || a.group.localeCompare(b.group))

  return (
    <section className="flex flex-col gap-5 font-sans text-sm leading-relaxed" aria-label={`${staff.name}的科组任命`} data-testid="staff-appointments" data-ready={ready}>
      {!ready ? <p role="status">正在恢复科组任命与学校授权…</p> : selection ? (
        <StaffAppointmentForm
          key={`${actor.staff}:${staff.id}:${selection.mode}:${selection.mode === "new" ? "new" : selection.appointment.id}`}
          staff={staff}
          selection={selection}
          onCancel={() => setSelection(null)}
          onDone={message => { setSelection(null); push(message) }}
        />
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <h3 className="text-balance font-semibold">科组任命</h3>
              <p className="text-muted-foreground">维护正式归组、角色与任期；与人事部门、任职资格及任课职责相互独立。</p>
            </div>
            <Button type="button" size="sm" disabled={!scope.length || staff.status === "left"} onClick={() => setSelection({ mode: "new" })}>
              <Plus data-icon="inline-start" />新增科组任命
            </Button>
          </header>

          <Alert role="note"><AlertTitle>与“我的教研”共用任命记录</AlertTitle><AlertDescription>按演示业务日期 {actor.date} 判断任期；未生效、已结束的任命不授予科组访问。沿用现有本机演示保存，不代表正式学校服务端授权。</AlertDescription></Alert>
          {!scope.length && <p className="text-muted-foreground">当前身份仅可查看任命记录，没有可用的科组统筹任命权限。人员管理资格、组长身份或学校查看授权不会自动获得任命权。</p>}
          {staff.status === "left" && <p className="text-muted-foreground">该人员已离职，不能新增或改任；已有有效任命可由有权人员登记结束。</p>}
          {staff.status !== "left" && staff.accountStatus !== "enabled" && <Alert role="note"><AlertTitle>可先登记，账号访问另行核验</AlertTitle><AlertDescription>该人员当前没有可用账号。任命可以先登记，但不会自动开通、启用账号或产生在线教研访问。</AlertDescription></Alert>}

          {!appointments.length && <Empty className="border"><EmptyHeader><EmptyTitle>尚无科组任命</EmptyTitle><EmptyDescription>不会从部门或任课安排自动推定归组；有权人员可在此新增任命。</EmptyDescription></EmptyHeader></Empty>}
          {sections.map(section => {
            const rows = appointments.filter(appointment => sectionOf(appointment, actor.date) === section)
            if (!rows.length) return null
            return <section key={section} className="flex flex-col gap-3" aria-label={section}>
              <h4 className="font-semibold">{section}</h4>
              {rows.map(appointment => {
                const groupName = groups.find(group => group.id === appointment.group)?.name ?? appointment.group
                const manageable = scope.includes(appointment.group)
                const endingToday = section === "有效任命" && appointment.end === actor.date
                return <article key={appointment.id} className="flex flex-col gap-3 rounded-lg border border-border p-4" data-appointment-id={appointment.id} aria-label={`${groupName} · ${appointment.role} · ${appointment.start}`}>
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <h5 className="font-semibold">{groupName} · {appointment.role}</h5>
                    <Badge variant={section === "有效任命" ? "default" : "outline"}>{endingToday ? "今日结束" : section === "有效任命" ? "有效" : section === "待生效任命" ? "未生效" : "已结束"}</Badge>
                  </header>
                  <p className="text-muted-foreground">任期：<time dateTime={appointment.start}>{appointment.start}</time> 至 {appointment.end ? <time dateTime={appointment.end}>{appointment.end}</time> : "未设结束日期"}（结束日期含当日）</p>
                  {manageable && <div className="flex flex-wrap gap-2">
                    {staff.status !== "left" && <Button type="button" variant="outline" size="sm" aria-label={`修订${groupName}的${appointment.role}任命`} onClick={() => setSelection({ mode: "revise", appointment: { ...appointment } })}>
                      <Pencil data-icon="inline-start" />修订
                    </Button>}
                    {section === "有效任命" && !endingToday && <Button type="button" variant="outline" size="sm" aria-label={`结束${groupName}的${appointment.role}任命`} onClick={() => setSelection({ mode: "end", appointment: { ...appointment } })}>
                      <CalendarOff data-icon="inline-start" />结束任命
                    </Button>}
                  </div>}
                </article>
              })}
            </section>
          })}
          <p className="text-muted-foreground">任期结束后仍保留此记录，不删除个人资料、已有教学记录，也不影响其他科组任命。</p>
        </>
      )}
    </section>
  )
}
