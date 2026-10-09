"use client"

import { useId, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Input, Select } from "@/components/kit"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { StaffProfile } from "@/lib/demo/staff"
import { useResearchContext } from "@/lib/research/context"
import { appointmentDateValid, appointmentRoles, appointmentValidationError, groups, sameAppointment, schoolScopes, type Appointment } from "@/lib/research/model"
import { useStaffPermission } from "@/lib/school/staff-store"

export type AppointmentEditorState =
  | { mode: "new" }
  | { mode: "revise" | "end"; appointment: Appointment }

type Props = {
  staff: StaffProfile
  selection: AppointmentEditorState
  onCancel: () => void
  onDone: (message: string) => void
}

export function StaffAppointmentForm({ staff, selection, onCancel, onDone }: Props) {
  const { state, actor, ready, command } = useResearchContext()
  const canManageStaff = useStaffPermission()
  const formId = useId()
  const previous = selection.mode === "new" ? undefined : selection.appointment
  const scope = canManageStaff ? schoolScopes(state, actor, true) : []
  const [draft, setDraft] = useState<Appointment>(() => previous ? {
    ...previous,
    ...(selection.mode === "end" ? { end: actor.date } : {}),
  } : {
    id: crypto.randomUUID(), staff: staff.id, group: scope[0] ?? "", role: "成员", start: actor.date, end: null,
  })
  const [confirmed, setConfirmed] = useState(false)
  const [failure, setFailure] = useState("")
  const allowed = ready && scope.includes(draft.group) && (staff.status !== "left" || selection.mode === "end")
  const dateError = !appointmentDateValid(draft.start) || draft.end !== null && (!appointmentDateValid(draft.end) || draft.end < draft.start)
  const validation = appointmentValidationError(state, draft) || (selection.mode === "end" && previous?.end && draft.end && draft.end > previous.end ? "结束任命不能延长原任期；如需延长，请使用修订。" : "")
  const changed = !previous || !sameAppointment(previous, draft)
  const title = selection.mode === "new" ? "新增科组任命" : selection.mode === "revise" ? "修订科组任命" : "结束科组任命"
  const groupName = groups.find(group => group.id === draft.group)?.name ?? draft.group
  const current = previous && state.appointments.find(item => item.id === previous.id)
  const stale = previous && (!current || !sameAppointment(current, previous))

  function update(patch: Partial<Appointment>) {
    setDraft(value => ({ ...value, ...patch }))
    setConfirmed(false)
    setFailure("")
  }

  return (
    <form className="flex flex-col gap-5 text-sm leading-relaxed" aria-label={title} onSubmit={event => {
      event.preventDefault()
      if (!allowed || validation || stale || !changed || selection.mode === "end" && !confirmed) return
      const result = command({ type: "appointment", appointment: draft, ...(previous ? { expected: previous } : {}) })
      if (!result.ok) {
        setFailure(result.error)
        setConfirmed(false)
        return
      }
      onDone(selection.mode === "end" ? `已登记结束任命：${staff.name} · ${groupName} · 最后任职日 ${draft.end}` : `${selection.mode === "new" ? "已新增" : "已修订"}科组任命：${staff.name} · ${groupName} · ${draft.role}`)
    }}>
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onCancel}>
        <ArrowLeft data-icon="inline-start" />返回任命列表
      </Button>
      <header className="flex flex-col gap-2">
        <h3 className="text-balance font-semibold">{title}</h3>
        <p className="text-muted-foreground">任命人员：<strong className="text-foreground">{staff.name}</strong> · {staff.employeeNo || "待编号"}</p>
        {previous && <p className="text-muted-foreground">科组：{groupName} · 人员与科组不可通过修订更换。</p>}
      </header>

      {!allowed && <Alert><AlertTitle>当前不能办理此任命</AlertTitle><AlertDescription>需要有效账号、学校人员管理权限和该科组的有效统筹授权；离职人员仅可结束已有任命。</AlertDescription></Alert>}
      {stale && <Alert variant="destructive"><AlertTitle>任命记录已变化</AlertTitle><AlertDescription>请返回列表重新打开；当前填写内容不会覆盖最新任命。</AlertDescription></Alert>}

      <FieldGroup>
        {!previous && <Field data-disabled={!ready || !scope.length}>
          <FieldLabel htmlFor={`${formId}-group`}>科组</FieldLabel>
          <Select id={`${formId}-group`} value={draft.group} required disabled={!ready || !scope.length} onChange={event => update({ group: event.target.value })}>
            {!draft.group && <option value="">请选择科组</option>}
            {groups.filter(group => scope.includes(group.id)).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
          </Select>
          <FieldDescription>仅列出当前学校统筹授权覆盖的科组；部门文字或任课安排不会自动成为任命。</FieldDescription>
        </Field>}

        {selection.mode !== "end" ? <FieldSet disabled={!allowed}>
          <FieldLegend variant="label">任命角色</FieldLegend>
          <ToggleGroup aria-label="任命角色" variant="outline" value={[draft.role]} disabled={!allowed} onValueChange={values => {
            const role = values[0]
            if (appointmentRoles.includes(role as Appointment["role"])) update({ role: role as Appointment["role"] })
          }}>
            {appointmentRoles.map(role => <ToggleGroupItem key={role} value={role} type="button">{role}</ToggleGroupItem>)}
          </ToggleGroup>
          <FieldDescription>组长承接本组学校任务并维护教研安排；成员与维护者参与组内协作。任何科组角色都不自动授予人员任命权。</FieldDescription>
        </FieldSet> : <p>结束对象：{groupName} · {draft.role} · 开始日期 {draft.start}</p>}

        <FieldGroup className={selection.mode === "end" ? "" : "grid sm:grid-cols-2"}>
          {selection.mode !== "end" && <Field data-invalid={dateError} data-disabled={!allowed}>
            <FieldLabel htmlFor={`${formId}-start`}>开始日期</FieldLabel>
            <Input id={`${formId}-start`} type="date" value={draft.start} required disabled={!allowed} aria-invalid={dateError} aria-describedby={validation ? `${formId}-validation` : undefined} onChange={event => update({ start: event.target.value })} />
          </Field>}
          <Field data-invalid={dateError} data-disabled={!allowed}>
            <FieldLabel htmlFor={`${formId}-end`}>{selection.mode === "end" ? "最后任职日" : "结束日期（可不填）"}</FieldLabel>
            <Input id={`${formId}-end`} type="date" value={draft.end ?? ""} min={draft.start || undefined} max={selection.mode === "end" ? previous?.end ?? undefined : undefined} required={selection.mode === "end"} disabled={!allowed} aria-invalid={dateError} aria-describedby={`${formId}-end-hint${validation ? ` ${formId}-validation` : ""}`} onChange={event => update({ end: event.target.value || null })} />
            <FieldDescription id={`${formId}-end-hint`}>结束日期含当日，次日起不再凭此任命访问科组。{selection.mode !== "end" && "留空表示未设结束日期。"}</FieldDescription>
          </Field>
        </FieldGroup>
        {validation && <FieldError id={`${formId}-validation`}>{validation}</FieldError>}

        {selection.mode === "end" && <>
          <Alert role="note"><AlertTitle>结束任命，不删除资料</AlertTitle><AlertDescription>只结束此条科组任命，其他科组任命及独立学校授权不变。保留任命历史、已合法保存的个人资料和已有教学记录；不会删除人员或停用账号。</AlertDescription></Alert>
          <Field orientation="horizontal" data-disabled={!allowed || !!validation || !!stale}>
            <input id={`${formId}-confirm`} type="checkbox" required checked={confirmed} disabled={!allowed || !!validation || !!stale} onChange={event => setConfirmed(event.target.checked)} className="size-4 shrink-0 accent-primary" />
            <FieldLabel htmlFor={`${formId}-confirm`}>确认 {staff.name} 的{groupName} · {draft.role}任命于 {draft.end || "所选日期"} 最后一天有效</FieldLabel>
          </Field>
        </>}
      </FieldGroup>

      {failure && <Alert variant="destructive"><AlertTitle>任命未保存</AlertTitle><AlertDescription>{failure} 表单内容仍保留，可检查后重试。</AlertDescription></Alert>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
        <Button type="submit" variant={selection.mode === "end" ? "destructive" : "default"} disabled={!allowed || !!validation || !!stale || !changed || selection.mode === "end" && (!confirmed || !draft.end)}>
          {selection.mode === "end" ? "确认结束任命" : selection.mode === "new" ? "保存任命" : "保存修订"}
        </Button>
      </div>
    </form>
  )
}
