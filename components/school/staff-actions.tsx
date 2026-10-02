"use client"

import { Button } from "@/components/ui/button"
import { DEPARTMENTS, JOB_TITLES, type StaffProfile } from "@/lib/demo/staff"
import { updateStaff } from "@/lib/school/staff-store"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"

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
  const [f, setF] = useState({
    department: staff.department,
    jobTitle: staff.jobTitle,
    gender: staff.gender,
    joinedAt: staff.joinedAt ?? "",
    phone: staff.phone,
    email: staff.email,
    englishName: staff.englishName ?? "",
    wechat: staff.wechat ?? "",
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const emailOk = /^\S+@\S+\.\S+$/.test(f.email.trim())
  const changed = (Object.keys(f) as (keyof typeof f)[]).filter(
    (k) => (f[k] || "") !== ((staff[k as keyof StaffProfile] as string | undefined) ?? ""),
  )

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!emailOk || !changed.length) return
        updateStaff(
          staff.id,
          {
            ...f,
            joinedAt: f.joinedAt || undefined,
            englishName: f.englishName.trim() || undefined,
            wechat: f.wechat.trim() || undefined,
            phone: f.phone.trim(),
            email: f.email.trim(),
          },
          `资料更新（${changed.length} 项）`,
        )
        onDone("资料已保存")
      }}
    >
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        姓名 <strong className="text-foreground">{staff.name}</strong> · 员工编号{" "}
        <span className="font-mono text-foreground">{staff.employeeNo}</span>（稳定正式编号，不可在此修改）
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="部门">
          <select className={inputClass} value={f.department} onChange={(e) => set("department", e.target.value)}>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="职务">
          <select className={inputClass} value={f.jobTitle} onChange={(e) => set("jobTitle", e.target.value)}>
            {JOB_TITLES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="性别">
          <select
            className={inputClass}
            value={f.gender}
            onChange={(e) => set("gender", e.target.value as StaffProfile["gender"])}
          >
            <option>男</option>
            <option>女</option>
            <option>未透露</option>
          </select>
        </Field>
        <Field label="首次正式入职">
          <input type="date" className={inputClass} value={f.joinedAt} onChange={(e) => set("joinedAt", e.target.value)} />
        </Field>
        <Field label="手机">
          <input className={inputClass} value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="邮箱">
          <input
            type="email"
            className={inputClass}
            value={f.email}
            aria-invalid={!emailOk}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="英文名／常用名（可选）">
          <input className={inputClass} value={f.englishName} onChange={(e) => set("englishName", e.target.value)} />
        </Field>
        <Field label="微信号（可选）">
          <input className={inputClass} value={f.wechat} onChange={(e) => set("wechat", e.target.value)} />
        </Field>
      </div>
      {!emailOk ? <p className="text-xs text-destructive">邮箱格式不正确。</p> : null}
      <p className="text-xs text-muted-foreground">部门、职务变化不会重新编号，也不改变系统角色或已安排的职责。</p>
      <Actions onCancel={onCancel} submitLabel={changed.length ? `保存 ${changed.length} 项修改` : "无修改"} disabled={!emailOk || !changed.length} />
    </form>
  )
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
        <Field label="预计返岗（可选）">
          <input type="date" className={inputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <Field label="事由（可选）">
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
  const ok = confirmName.trim() === staff.name
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
        <Field label="原因（可选）">
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
