"use client"

import { Button } from "@/components/ui/button"
import { DEPARTMENTS, JOB_TITLES, type EducationExperience, type StaffProfile, type WorkExperience } from "@/lib/demo/staff"
import { checkPersonNo, nextPersonNo, registerIssued, yyyymmOf } from "@/lib/school/person-no"
import { updateStaff } from "@/lib/school/staff-store"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"

export type StaffAction = "edit" | "number" | "leave" | "return" | "resign"

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
  const title = { edit: "编辑资料", number: staff.employeeNo ? "修改或清空工号" : "设置工号", leave: "登记请假", return: "办理销假", resign: "办理离职" }[action]
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
      {action === "number" ? <NumberForm staff={staff} onDone={onDone} onCancel={onCancel} /> : null}
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
    educationLevel: staff.educationLevel ?? "未填写",
    firstWorkAt: staff.firstWorkAt ?? "",
    educationExperiences: staff.educationExperiences ?? [],
    workExperiences: staff.workExperiences ?? [],
    interests: staff.interests ?? [],
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
            educationLevel: f.educationLevel === "未填写" ? undefined : f.educationLevel,
            firstWorkAt: f.firstWorkAt || undefined,
            educationExperiences: f.educationExperiences.filter((item) => item.school?.trim() || item.major?.trim() || item.graduation?.trim()),
            workExperiences: f.workExperiences.filter((item) => item.organization?.trim() || item.role?.trim() || item.start?.trim() || item.end?.trim()),
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
        <Field label="学历（可选）">
          <select className={inputClass} value={f.educationLevel} onChange={(e) => set("educationLevel", e.target.value)}>
            {["未填写", "高中/中专及以下", "大专", "本科", "硕士研究生", "博士研究生", "其他"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="首次参加工作年月（可选）" hint="个人第一次参加工作，不用于本校工号。">
          <input type="month" className={inputClass} value={f.firstWorkAt} onChange={(e) => set("firstWorkAt", e.target.value)} />
        </Field>
      </div>

      <ExperienceEditor
        title="教育经历"
        items={f.educationExperiences}
        onChange={(items) => set("educationExperiences", items)}
        kind="education"
      />
      <ExperienceEditor
        title="过往工作经历"
        items={f.workExperiences}
        onChange={(items) => set("workExperiences", items)}
        kind="work"
      />
      {!emailOk ? <p className="text-xs text-destructive">邮箱格式不正确。</p> : null}
      <p className="text-xs text-muted-foreground">部门、职务变化不会重新编号，也不改变系统角色或已安排的职责。</p>
      <Actions onCancel={onCancel} submitLabel={changed.length ? `保存 ${changed.length} 项修改` : "无修改"} disabled={!emailOk || !changed.length} />
    </form>
  )
}

function NumberForm({ staff, onDone, onCancel }: FormProps) {
  const [mode, setMode] = useState<"manual" | "auto" | "clear">(staff.employeeNo ? "manual" : "auto")
  const [value, setValue] = useState("")
  const [joinedAt, setJoinedAt] = useState(staff.joinedAt?.slice(0, 7) ?? "")
  const [note, setNote] = useState("")
  const check = checkPersonNo(value, "E", joinedAt)
  const valid = mode === "clear" ? !!staff.employeeNo : mode === "auto" ? !!yyyymmOf(joinedAt) : check.status === "valid"
  return <form className="space-y-4" onSubmit={(event) => {
    event.preventDefault()
    if (!valid) return
    const next = mode === "clear" ? "" : mode === "auto" ? nextPersonNo("E", yyyymmOf(joinedAt)!) : value
    if (next && next === staff.employeeNo) return
    if (next) registerIssued(next, "E")
    updateStaff(staff.id, { employeeNo: next, joinedAt: joinedAt || staff.joinedAt }, `${mode === "clear" ? "清空" : staff.employeeNo ? "修改" : "设置"}工号：${staff.employeeNo || "待编号"} → ${next || "待编号"}${note.trim() ? `（${note.trim()}）` : ""}`)
    onDone(mode === "clear" ? "工号已清空，历史号码仍保留" : "工号已保存")
  }}>
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">目标人员：<strong className="text-foreground">{staff.name}</strong> · 当前工号 <span className="font-mono text-foreground">{staff.employeeNo || "待编号"}</span></div>
    <div className="flex flex-wrap gap-2">{(["manual", "auto", ...(staff.employeeNo ? ["clear" as const] : [])] as ("manual" | "auto" | "clear")[]).map((item) => <Button key={item} type="button" size="sm" variant={mode === item ? "default" : "outline"} onClick={() => setMode(item)}>{item === "manual" ? "手工填写" : item === "auto" ? "自动生成" : "清空工号"}</Button>)}</div>
    {mode === "manual" ? <Field label="新工号"><input className={inputClass} value={value} onChange={(event) => setValue(event.target.value)} placeholder="按当前学校预设填写" />{value && check.status === "invalid" ? <span className="text-xs text-destructive">{check.detail}</span> : null}</Field> : null}
    {mode === "auto" ? <Field label="首次入职年月"><input type="month" className={inputClass} value={joinedAt} onChange={(event) => setJoinedAt(event.target.value)} /></Field> : null}
    {mode === "clear" ? <p className="text-xs text-muted-foreground">确认后当前工号变为待编号。原号码继续保留占用，不删除人员、账号、职责或业务记录。</p> : null}
    <Field label="备注（可选）"><input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
    <Actions onCancel={onCancel} submitLabel={mode === "clear" ? "确认清空" : "确认保存"} disabled={!valid} danger={mode === "clear"} />
  </form>
}

function ExperienceEditor({ title, items, onChange, kind }: { title: string; items: EducationExperience[] | WorkExperience[]; onChange: (items: never[]) => void; kind: "education" | "work" }) {
  const add = () => onChange([...items, { id: crypto.randomUUID() }] as never[])
  const patch = (id: string, values: Record<string, string>) => onChange(items.map((item) => item.id === id ? { ...item, ...values } : item) as never[])
  const remove = (id: string) => onChange(items.filter((item) => item.id !== id) as never[])
  return (
    <section className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[13px] font-semibold">{title}</h4>
        <Button type="button" size="xs" variant="outline" onClick={add}>添加一条</Button>
      </div>
      {items.map((item) => {
        const education = item as EducationExperience
        const work = item as WorkExperience
        return <div key={item.id} className="grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-2">
          {kind === "education" ? <>
            <input className={inputClass} value={education.school ?? ""} onChange={(e) => patch(item.id, { school: e.target.value })} placeholder="学校 / 院校" />
            <input className={inputClass} value={education.major ?? ""} onChange={(e) => patch(item.id, { major: e.target.value })} placeholder="专业" />
            <input className={inputClass} value={education.graduation ?? ""} onChange={(e) => patch(item.id, { graduation: e.target.value })} placeholder="毕业时间，如 2014 或 2014-06" />
          </> : <>
            <input className={inputClass} value={work.organization ?? ""} onChange={(e) => patch(item.id, { organization: e.target.value })} placeholder="工作单位" />
            <input className={inputClass} value={work.role ?? ""} onChange={(e) => patch(item.id, { role: e.target.value })} placeholder="当时岗位" />
            <input className={inputClass} value={work.start ?? ""} onChange={(e) => patch(item.id, { start: e.target.value })} placeholder="开始，如 2018-09" />
            <input className={inputClass} value={work.end ?? ""} onChange={(e) => patch(item.id, { end: e.target.value })} placeholder="结束（可空）" />
          </>}
          <button type="button" onClick={() => remove(item.id)} className="w-fit text-xs text-muted-foreground hover:text-destructive">移除</button>
          {kind === "work" && work.start && work.end && work.end < work.start ? <p className="text-xs text-destructive">结束时间不能早于开始时间。</p> : null}
        </div>
      })}
      {!items.length ? <p className="text-xs text-muted-foreground">尚未填写；可留空。</p> : null}
    </section>
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
