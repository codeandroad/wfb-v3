"use client"

import { useId, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Input } from "@/components/kit"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { DUTY_BY_KEY } from "@/lib/demo/staff"
import { dutyDateValid, manageableResearchGroups, sameStaffDuty, staffDutyConflicts, staffDutyValidationError, type StaffDutyAssignment } from "@/lib/school/duty-model"
import { researchGroupName } from "@/lib/school/responsibility-scopes"
import { useStaffDutyContext } from "@/lib/school/staff-store"

export function StaffDutyRevisionForm({ duty, mode, onCancel, onDone }: { duty: StaffDutyAssignment; mode: "revise" | "end"; onCancel: () => void; onDone: (message: string) => void }) {
  const { state, people, actor, ready, error, command } = useStaffDutyContext()
  const formId = useId()
  const [previous] = useState(() => structuredClone(duty))
  const [draft, setDraft] = useState(() => ({ ...duty, ...(mode === "end" ? { end: actor.date } : {}) }))
  const [confirmed, setConfirmed] = useState(false)
  const [failure, setFailure] = useState("")
  const person = people.find(item => item.id === duty.staffId)
  const groupName = researchGroupName(state.groups, duty.scopeRefs[0].id)
  const title = mode === "end" ? "结束职责" : "修订职责任期"
  const current = state.assignments.find(item => item.id === previous.id)
  const stale = !current || !sameStaffDuty(current, previous)
  const allowed = ready && !error && manageableResearchGroups(state, people, actor, duty.type, mode === "end").includes(duty.scopeRefs[0].id) && (person?.status !== "left" || mode === "end")
  const dateError = !dutyDateValid(draft.start) || draft.end !== undefined && (!dutyDateValid(draft.end) || draft.end < draft.start) || mode === "end" && !!previous.end && !!draft.end && draft.end > previous.end
  const validation = staffDutyValidationError(state, draft, previous, mode)
  const conflicts = mode === "end" ? staffDutyConflicts(state, draft) : []
  const changed = !sameStaffDuty(previous, draft)

  function update(patch: Partial<StaffDutyAssignment>) {
    setDraft(value => ({ ...value, ...patch }))
    setConfirmed(false)
    setFailure("")
  }

  return <form className="flex flex-col gap-5 font-sans text-sm leading-relaxed" aria-label={title} onSubmit={event => {
    event.preventDefault()
    if (!allowed || validation || stale || !changed || mode === "end" && (!confirmed || !draft.end)) return
    const result = command({ type: mode, assignment: draft, expected: previous })
    if (!result.ok) { setFailure(result.error); setConfirmed(false); return }
    onDone(mode === "end" ? `已登记结束职责：${person?.name} · ${groupName} · 最后有效日 ${draft.end}，次日起停止本项访问` : `已修订职责：${person?.name} · ${groupName} · 原任期留在历史中`)
  }}>
    <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onCancel}><ArrowLeft data-icon="inline-start" />返回职责详情</Button>
    <header className="flex flex-col gap-2"><h3 className="text-balance font-semibold">{title}</h3><p>{person?.name} · {DUTY_BY_KEY[duty.type].label} · {groupName}</p><p className="text-muted-foreground">沿用同一份人员职责记录；人员、职责模板与负责对象不可通过修订更换。</p></header>
    {(!allowed || error) && <Alert><AlertTitle>当前不能办理此职责变更</AlertTitle><AlertDescription>{error || "需要有效账号和该负责对象的职责安排权；组长不自动获得任命权，离职人员仅可结束已有职责。"}</AlertDescription></Alert>}
    {stale && <Alert variant="destructive"><AlertTitle>职责记录已变化</AlertTitle><AlertDescription>请返回详情重新打开；当前填写内容不会覆盖最新记录。</AlertDescription></Alert>}
    <FieldGroup>
      {mode !== "end" && <Field data-invalid={dateError} data-disabled={!allowed}><FieldLabel htmlFor={`${formId}-start`}>开始日期</FieldLabel><Input id={`${formId}-start`} type="date" value={draft.start} required disabled={!allowed} aria-invalid={dateError} onChange={event => update({ start: event.target.value })} /></Field>}
      <Field data-invalid={dateError} data-disabled={!allowed}>
        <FieldLabel htmlFor={`${formId}-end`}>{mode === "end" ? "最后有效日" : "结束日期（可不填）"}</FieldLabel>
        <Input id={`${formId}-end`} type="date" value={draft.end ?? ""} min={draft.start} max={mode === "end" ? previous.end : undefined} required={mode === "end"} disabled={!allowed} aria-invalid={dateError} aria-describedby={`${formId}-hint${validation ? ` ${formId}-validation` : ""}`} onChange={event => update({ end: event.target.value || undefined })} />
        <FieldDescription id={`${formId}-hint`}>结束日期含当日，次日起不再凭此职责访问该负责对象。{mode !== "end" && "留空表示未设结束日期。"}</FieldDescription>
      </Field>
      {validation && <FieldError id={`${formId}-validation`}>{validation}</FieldError>}
      {mode === "end" && <>
        {conflicts.length > 0 && <Alert role="note"><AlertTitle>存在重叠旧记录，可单独结束本项</AlertTitle><AlertDescription><p>重叠记录不会阻止缩短本项任期；不会一并结束其他记录，其他仍有效的明确授权继续保留。</p><ul className="flex list-inside list-disc flex-col gap-1">{conflicts.map(item => <li key={item.id}>{people.find(person => person.id === item.staffId)?.name || item.staffId} · {DUTY_BY_KEY[item.type].label} · {item.start} 至 {item.end || "未设结束日期"}</li>)}</ul></AlertDescription></Alert>}
        <Alert role="note"><AlertTitle>只结束本项职责，保留资料与历史</AlertTitle><AlertDescription>不删除人员、账号或教学记录，不影响该人员在其他教研组的职责。个人教学资料、已有成果及历史任期继续保留；结束本项不会替代其他仍有效的明确授权。</AlertDescription></Alert>
        <Field orientation="horizontal" data-disabled={!allowed || !!validation || stale}><input id={`${formId}-confirm`} type="checkbox" required checked={confirmed} disabled={!allowed || !!validation || stale} onChange={event => setConfirmed(event.target.checked)} className="size-4 shrink-0 accent-primary" /><FieldLabel htmlFor={`${formId}-confirm`}>确认本项职责于 {draft.end || "所选日期"} 最后一天有效</FieldLabel></Field>
      </>}
    </FieldGroup>
    {failure && <Alert variant="destructive"><AlertTitle>职责未保存</AlertTitle><AlertDescription>{failure} 填写内容仍保留，请检查后重试。</AlertDescription></Alert>}
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>取消</Button><Button type="submit" variant={mode === "end" ? "destructive" : "default"} disabled={!allowed || !!validation || stale || !changed || mode === "end" && (!confirmed || !draft.end)}>{mode === "end" ? "确认结束职责" : "保存修订"}</Button></div>
  </form>
}
