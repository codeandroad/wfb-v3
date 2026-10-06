"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/kit"
import { type StaffProfile } from "@/lib/demo/staff"
import { checkPersonNo, nextPersonNo, personNoMonth, registerIssued, yyyymmOf } from "@/lib/school/person-no"
import { updateStaff, useStaffPermission } from "@/lib/school/staff-store"
import { backgroundError, cleanEducation, cleanWork, educationExperiencesOf } from "@/lib/school/staff-background"
import { StaffFormFields, initialStaffForm, type StaffFormState } from "./staff-form-fields"
import { useDemo } from "@/lib/demo/store"
import { PERSONAS } from "@/lib/demo/nav"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export type StaffAction = "edit" | "leave" | "return" | "resign"

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground/80">{hint}</span> : null}
    </label>
  )
}

const today = () => new Date().toISOString().slice(0, 10)

export function StaffActionPanel({
  staff,
  action,
  onDone,
  onCancel,
}: {
  staff: StaffProfile
  action: StaffAction
  onDone: (message: string) => void
  onCancel: () => void
}) {
  const canManage = useStaffPermission()
  if (!canManage || action === "resign" && staff.status === "left") return <div className="flex flex-col gap-3"><p role="alert">当前身份无权办理，或该人员已离职。</p><Button variant="outline" onClick={onCancel}>返回详情</Button></div>
  const title = { edit: "编辑资料", leave: "登记请假", return: "办理销假", resign: "办理离职" }[action]
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        返回详情
      </button>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {action === "edit" ? <EditForm staff={staff} onDone={onDone} onCancel={onCancel} /> : null}
      {action === "leave" ? <LeaveForm staff={staff} onDone={onDone} onCancel={onCancel} /> : null}
      {action === "return" ? <ReturnForm staff={staff} onDone={onDone} onCancel={onCancel} /> : null}
      {action === "resign" ? <ResignForm staff={staff} onDone={onDone} onCancel={onCancel} /> : null}
    </div>
  )
}

type FormProps = { staff: StaffProfile; onDone: (m: string) => void; onCancel: () => void }

function Actions({ onCancel, submitLabel, disabled, danger }: { onCancel: () => void; submitLabel: string; disabled?: boolean; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        取消
      </Button>
      <Button type="submit" size="sm" disabled={disabled} variant={danger ? "destructive" : "default"}>
        {submitLabel}
      </Button>
    </div>
  )
}

function EditForm({ staff, onDone, onCancel }: FormProps) {
  const initial: StaffFormState = { ...initialStaffForm(), name: staff.name, department: staff.department || null, jobTitle: staff.jobTitle || null, gender: staff.gender, joinedAt: staff.joinedAt ?? "", phone: staff.phone, email: staff.email, englishName: staff.englishName ?? "", birthplace: staff.birthplace ?? "", firstWorkAt: staff.firstWorkAt ?? "", educationExperiences: educationExperiencesOf(staff), workExperiences: staff.workExperiences ?? [], interests: staff.interests ?? [], wechat: staff.wechat ?? "" }
  const [state, setState] = useState(initial)
  const [editingNumber, setEditingNumber] = useState(false)
  const { push } = useToast()
  const set = <K extends keyof StaffFormState>(key: K, value: StaffFormState[K]) => setState((current) => ({ ...current, [key]: value }))
  const canManage = useStaffPermission()
  const numberMonth = personNoMonth(staff.employeeNo, "E")
  const monthMismatch = numberMonth && state.joinedAt && yyyymmOf(state.joinedAt) !== numberMonth
  const error = backgroundError(state.firstWorkAt, state.educationExperiences, state.workExperiences)
  const changed = JSON.stringify({ ...state, touched: false }) !== JSON.stringify(initial)
  const valid = !!state.name.trim() && (!state.email.trim() || /^\S+@\S+\.\S+$/.test(state.email.trim())) && (!state.joinedAt || !!yyyymmOf(state.joinedAt)) && !error
  if (editingNumber) return (
    <div className="flex flex-col gap-4">
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setEditingNumber(false)}>
        <ArrowLeft data-icon="inline-start" />
        返回资料编辑
      </Button>
      <h4 className="text-sm font-semibold">{staff.employeeNo ? "修改员工编号" : "设置员工编号"}</h4>
      <NumberForm
        staff={staff}
        onCancel={() => setEditingNumber(false)}
        onDone={(message, joinedAt) => {
          if (joinedAt) setState((current) => current.joinedAt === (staff.joinedAt ?? "") ? { ...current, joinedAt } : current)
          setEditingNumber(false)
          push(message)
        }}
      />
    </div>
  )
  return <form className="flex flex-col gap-4" onSubmit={(event) => {
    event.preventDefault()
    set("touched", true)
    if (!canManage || !valid || !changed) return
    updateStaff(staff.id, {
      name: state.name.trim(), department: state.department ?? "", jobTitle: state.jobTitle ?? "", gender: state.gender === "男" || state.gender === "女" ? state.gender : "未透露",
      joinedAt: state.joinedAt || undefined, email: state.email.trim(), phone: state.phone.trim(), englishName: state.englishName.trim() || undefined,
      birthplace: state.birthplace.trim() || undefined, educationLevel: undefined, firstWorkAt: state.firstWorkAt || undefined,
      educationExperiences: cleanEducation(state.educationExperiences), workExperiences: cleanWork(state.workExperiences), wechat: state.wechat.trim() || undefined,
      interests: [...new Set([...state.interests, ...state.interestExtra.split(/[,，]/).map((item) => item.trim()).filter(Boolean)])],
    }, "资料更新")
    onDone("资料已保存；工号与任职状态保持不变")
  }}>
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-muted-foreground">员工编号</span>
      <span className={cn("text-sm", staff.employeeNo && "font-mono")}>{staff.employeeNo || "待编号"}</span>
      <Button type="button" size="xs" variant="link" disabled={!canManage} onClick={() => setEditingNumber(true)}>
        {staff.employeeNo ? "修改" : "设置"}
      </Button>
    </div>
    {monthMismatch ? <p className="text-sm text-muted-foreground">工号年月与首次入职日期不一致；保存资料不会自动改号。</p> : null}
    <StaffFormFields state={state} set={set} hideNumber />
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <Actions onCancel={onCancel} submitLabel="保存修改" disabled={!canManage || !valid || !changed} />
  </form>
}

function NumberForm({ staff, onDone, onCancel }: Omit<FormProps, "onDone"> & { onDone: (message: string, joinedAt?: string) => void }) {
  const canManage = useStaffPermission()
  const demo = useDemo()
  const [mode, setMode] = useState<"manual" | "auto" | "clear">("manual")
  const [value, setValue] = useState("")
  const [joinedAt, setJoinedAt] = useState(staff.joinedAt ?? "")
  const [note, setNote] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [failure, setFailure] = useState("")
  let error = ""
  let next = mode === "clear" ? "" : value
  if (mode === "auto") {
    try { next = nextPersonNo("E", yyyymmOf(joinedAt) ?? "") } catch (cause) { error = cause instanceof Error ? cause.message : "无法生成工号。" }
  } else if (mode === "manual") {
    const check = checkPersonNo(value, "E", staff.joinedAt)
    error = value === staff.employeeNo ? "新旧工号相同，无需保存。" : check.status === "invalid" ? check.detail : check.status === "valid" && check.monthMismatch ? "工号年月与首次入职日期不一致，请修正工号或先编辑普通资料。" : check.status === "empty" ? "请填写新工号。" : ""
  }
  const valid = canManage && !error && (mode !== "clear" || !!staff.employeeNo)
  const change = () => { setConfirmed(false); setFailure("") }
  return <form className="flex flex-col gap-4" onSubmit={(event) => {
    event.preventDefault()
    if (!valid || !confirmed) return
    try {
      if (mode === "manual") { const check = checkPersonNo(value, "E", staff.joinedAt); if (check.status !== "valid" || check.monthMismatch) throw new Error("工号校验未通过，请重新检查。") }
      if (mode === "auto" && nextPersonNo("E", yyyymmOf(joinedAt)!) !== next) throw new Error("号段已变化，请重新确认新号。")
      if (next) registerIssued(next, "E", staff.id)
      updateStaff(staff.id, { employeeNo: next, ...(mode === "auto" && joinedAt !== staff.joinedAt ? { joinedAt } : {}) }, `${mode === "clear" ? "清空" : staff.employeeNo ? "修改" : "设置"}工号：${staff.employeeNo || "待编号"} → ${next || "待编号"}；操作者 ${PERSONAS[demo.persona].label}；${new Date().toISOString()}${note.trim() ? `；备注：${note.trim()}` : ""}`)
      onDone(mode === "clear" ? "工号已清空，历史号码仍保留" : "工号已保存，内部ID与业务关系不变", mode === "auto" ? joinedAt : undefined)
    } catch (cause) { setFailure(cause instanceof Error ? cause.message : "保存失败，请重试。"); setConfirmed(false) }
  }}>
    <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm">目标人员：<strong>{staff.name}</strong> · 当前工号 <span className="font-mono">{staff.employeeNo || "待编号"}</span></p>
    <div className="flex flex-wrap gap-2">{(["manual", "auto", ...(staff.employeeNo ? ["clear" as const] : [])] as const).map((item) => <Button key={item} type="button" size="sm" variant={mode === item ? "default" : "outline"} onClick={() => { setMode(item); change() }}>{item === "manual" ? "手工填写" : item === "auto" ? "自动生成" : "清空工号"}</Button>)}</div>
    {mode === "manual" ? <Field label="新工号"><input className={inputClass} value={value} onChange={(event) => { setValue(event.target.value); change() }} placeholder="如 TG2108E012" /></Field> : null}
    {mode === "auto" ? <Field label="首次入职日期" hint={joinedAt.length === 7 ? `原记录为 ${joinedAt}；不修改则保留原记录。` : undefined}><input type="date" className={inputClass} value={joinedAt.length === 10 ? joinedAt : ""} onChange={(event) => { setJoinedAt(event.target.value); change() }} /></Field> : null}
    {error || failure ? <p role="alert" className="text-sm text-destructive">{failure || error}</p> : <p className="text-sm">确认结果：<span className="font-mono">{staff.employeeNo || "待编号"} → {next || "待编号"}</span></p>}
    <p className="text-xs text-muted-foreground">历史号码继续保留，不删除人员、账号或业务关系；已下载文件不会自动更新。</p>
    <Field label="备注"><input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={!valid} onChange={(event) => setConfirmed(event.target.checked)} />确认对 {staff.name} {mode === "clear" ? "清空工号" : "保存上述工号"}</label>
    <Actions onCancel={onCancel} submitLabel={mode === "clear" ? "确认清空" : "确认保存"} disabled={!valid || !confirmed} danger={mode === "clear"} />
  </form>
}

function LeaveForm({ staff, onDone, onCancel }: FormProps) {
  const [start, setStart] = useState(today())
  const [end, setEnd] = useState("")
  const [reason, setReason] = useState("")
  const invalid = !!end && end < start
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (invalid) return
        const range = end ? `${start} 至 ${end}` : `${start} 起（未定返岗日）`
        updateStaff(
          staff.id,
          { status: "leave", statusNote: `请假 ${range}${reason ? `，${reason}` : ""}。职责保留；请假期间日常操作按只读处理。` },
          `请假开始 ${range}（职责保留）`,
        )
        onDone(`已登记 ${staff.name} 请假`)
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="开始日期">
          <input type="date" required className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="预计返岗">
          <input type="date" className={inputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <Field label="事由">
        <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：病假、产假、进修" />
      </Field>
      {invalid ? <p className="text-xs text-destructive">返岗日期不能早于开始日期。</p> : null}
      <ul className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <li>请假不是离职：现有 {staff.duties.filter((d) => d.status !== "ended").length} 项职责与任教全部保留。</li>
        <li>账号不会停用；请假期间教学内容编辑按只读处理。</li>
        <li>如需他人代课，请在课表中心安排代课，不在此处转移职责。</li>
      </ul>
      <Actions onCancel={onCancel} submitLabel="确认请假" disabled={invalid} />
    </form>
  )
}

function ReturnForm({ staff, onDone, onCancel }: FormProps) {
  const [date, setDate] = useState(today())
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        updateStaff(staff.id, { status: "active", statusNote: undefined }, `销假返岗 ${date}`)
        onDone(`${staff.name} 已销假返岗`)
      }}
    >
      <Field label="返岗日期">
        <input type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <p className="text-xs text-muted-foreground">返岗后恢复全部可读写操作，职责无需重新安排。</p>
      <Actions onCancel={onCancel} submitLabel="确认销假" />
    </form>
  )
}

function ResignForm({ staff, onDone, onCancel }: FormProps) {
  const [date, setDate] = useState(today())
  const [reason, setReason] = useState("")
  const [disableAccount, setDisableAccount] = useState(staff.accountStatus !== "none")
  const [confirmName, setConfirmName] = useState("")
  const active = staff.duties.filter((d) => d.status !== "ended")
  const canManage = useStaffPermission()
  const ok = canManage && staff.status !== "left" && !!date && confirmName.trim() === staff.name
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!ok) return
        updateStaff(
          staff.id,
          {
            status: "left",
            statusNote: `已于 ${date} 离职${reason ? `（${reason}）` : ""}。职责已随离职结束，历史记录保留。`,
            ...(disableAccount && staff.accountStatus !== "none" ? { accountStatus: "disabled" as const } : {}),
          },
          `办理离职 ${date}${disableAccount && staff.accountStatus !== "none" ? "，账号停用" : ""}`,
        )
        onDone(`已为 ${staff.name} 办理离职`)
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="离职生效日">
          <input type="date" required className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="原因">
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      <div className="rounded-lg border border-border p-3">
        <p className="text-[13px] font-medium">将随离职结束的职责 · {active.length}</p>
        {active.length ? (
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-muted-foreground">
            {active.map((d) => (
              <li key={d.id}>· {d.scopeLabel}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">无进行中的职责。</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          相关班级将显示“待指定”，请尽快在教学班或行政班中重新安排；历史授课记录保留，不做删除。
        </p>
      </div>
      {staff.accountStatus !== "none" ? (
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={disableAccount} onChange={(e) => setDisableAccount(e.target.checked)} />
          同时停用账号 <span className="font-mono text-xs text-muted-foreground">{staff.username}</span>
        </label>
      ) : null}
      <Field label={`输入姓名「${staff.name}」以确认`}>
        <input className={inputClass} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
      </Field>
      <Actions onCancel={onCancel} submitLabel="确认离职" disabled={!ok} danger />
    </form>
  )
}
