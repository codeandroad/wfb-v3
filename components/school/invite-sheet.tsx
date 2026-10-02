"use client"

import { Badge, Field, Input, Select, Sheet } from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  ACCOUNT_STATUS_LABEL,
  DUTIES_BY_ROLE,
  EMAIL_STATUS_LABEL,
  EMAIL_STATUS_TONE,
  INVITE_DEMO_CODE,
  INVITE_DEMO_EXPIRES,
  INVITE_DEMO_LINK,
  INVITE_DEMO_NO,
  INVITE_VALID_DAYS,
  STAFF,
  STAFF_STATUS_LABEL,
  SYSTEM_ROLES,
  SYSTEM_ROLE_DESC,
  SYSTEM_ROLE_LABEL,
  accountByStaffId,
  staffById,
  type DutyKey,
  type EmailDeliveryStatus,
  type StaffProfile,
  type SystemRoleCode,
} from "@/lib/demo/staff"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  Mail,
  Search,
  ShieldAlert,
  Ticket,
  UserPlus,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { AccountStatusBadge, InfoNote, RoleBadge } from "./duty-bits"
import { StaffFormFields, useStaffForm } from "./staff-form-fields"

type View = "form" | "addStaff" | "preview" | "result" | "accept" | "duplicate"

// 某人是否已有待接受邀请（示例：王老师 ↔ INV-DEMO-01）
function pendingInviteFor(name: string): string | null {
  return name.includes("王老师") ? INVITE_DEMO_NO : null
}

export function InviteSheet({
  open,
  onClose,
  presetPerson,
  operatorCanGrantAdmin: operatorCanGrantAdminProp = true,
}: {
  open: boolean
  onClose: () => void
  presetPerson?: string
  operatorCanGrantAdmin?: boolean
}) {
  const [view, setView] = useState<View>("form")

  // 受邀人员
  const presetStaff = presetPerson ? STAFF.find((s) => s.name === presetPerson) : undefined
  const [personName, setPersonName] = useState<string>(presetPerson ?? "")
  const [personStaffId, setPersonStaffId] = useState<string | undefined>(presetStaff?.id)
  const [query, setQuery] = useState("")

  // 系统角色（可多选，无默认）与零角色例外
  const [roles, setRoles] = useState<SystemRoleCode[]>([])
  const [zeroRole, setZeroRole] = useState(false)
  const [showZero, setShowZero] = useState(false)

  // 业务职责（可选补充）
  const [showDuties, setShowDuties] = useState(false)
  const [duties, setDuties] = useState<DutyKey[]>([])

  // 交付
  const [sendEmail, setSendEmail] = useState(false)
  const [emailTo, setEmailTo] = useState(presetStaff?.email ?? "")
  const [emailUnconfigured, setEmailUnconfigured] = useState(false)

  // 演示：操作者是否具备“授予学校管理员”的权限
  const [operatorCanGrantAdmin, setOperatorCanGrantAdmin] = useState(operatorCanGrantAdminProp)
  // 演示：操作者是否具备“新增教职工”的权限
  const [operatorCanCreateStaff, setOperatorCanCreateStaff] = useState(true)

  const staffForm = useStaffForm()

  const matchedStaff: StaffProfile | undefined = personStaffId ? staffById(personStaffId) : undefined
  const matchedAccount = matchedStaff ? accountByStaffId(matchedStaff.id) : undefined
  const accountEnabled = matchedAccount?.status === "enabled"
  const existingPending = personName ? pendingInviteFor(personName) : null

  const adminBlocked = roles.includes("SCHOOL_ADMIN") && !operatorCanGrantAdmin

  const effectiveZero = zeroRole && roles.length === 0
  const rolesChosen = effectiveZero || roles.length > 0
  const canGenerate = !!personName && rolesChosen && !adminBlocked && !accountEnabled && !existingPending

  function toggleRole(r: SystemRoleCode) {
    setZeroRole(false)
    const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]
    setRoles(next)
    // 移除属于已取消角色的职责
    const allowedDutyKeys = new Set(
      DUTIES_BY_ROLE.filter((g) => next.includes(g.role)).flatMap((g) => g.duties.map((d) => d.key)),
    )
    setDuties((prev) => prev.filter((d) => allowedDutyKeys.has(d)))
  }

  function resetAll() {
    setView("form")
    setPersonName(presetPerson ?? "")
    setPersonStaffId(presetStaff?.id)
    setQuery("")
    setRoles([])
    setZeroRole(false)
    setShowZero(false)
    setShowDuties(false)
    setDuties([])
    setSendEmail(false)
    setEmailTo(presetStaff?.email ?? "")
    setEmailUnconfigured(false)
    setOperatorCanGrantAdmin(operatorCanGrantAdminProp)
  }

  function close() {
    resetAll()
    onClose()
  }

  const workPlan = useMemo(() => {
    if (effectiveZero) return "仅账号自服务（未分配系统角色）"
    const roleText = roles.map((r) => SYSTEM_ROLE_LABEL[r]).join("、")
    const dutyText = duties.length ? `；职责：${duties.map((d) => DUTY_LABEL(d)).join("、")}` : "；暂不安排具体职责"
    return `${roleText}${dutyText}`
  }, [effectiveZero, roles, duties])

  const emailStatus: EmailDeliveryStatus = !sendEmail
    ? "none"
    : emailUnconfigured
      ? "unconfigured"
      : "sent"

  // 供 result / preview 使用的邀请概要
  const draft = {
    no: INVITE_DEMO_NO,
    person: personName || "（未选人员）",
    personSub: matchedStaff
      ? `${matchedStaff.employeeNo} · ${matchedStaff.department}／${matchedStaff.jobTitle}`
      : "待关联教职工（新邀请）",
    roles,
    zeroRole: effectiveZero,
    workPlan,
    expires: INVITE_DEMO_EXPIRES,
    code: INVITE_DEMO_CODE,
    link: INVITE_DEMO_LINK,
    accountMode: accountEnabled ? "reuse" : "new",
    emailStatus,
    emailTo: sendEmail ? emailTo || "（未填写收件邮箱）" : undefined,
  }

  /* ---------- addStaff 子视图 ---------- */
  if (view === "addStaff") {
    return (
      <Sheet
        open={open}
        onClose={close}
        width="max-w-2xl"
        title="新增教职工（邀请流程内）"
        desc="与教职工页“新增教职工”使用同一张表单；创建后自动回到邀请，受邀人员已选中。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setView("form")}>
              <ArrowLeft className="size-3.5" />
              返回邀请
            </Button>
            <Button
              onClick={() => {
                staffForm.set("touched", true)
                if (!staffForm.nameValid || !staffForm.noValid) return
                staffForm.issueNo()
                setPersonName(staffForm.displayName)
                setPersonStaffId(undefined)
                setEmailTo(staffForm.state.email)
                setView("form")
              }}
            >
              创建并选为受邀人员
            </Button>
          </>
        }
      >
        <StaffFormFields state={staffForm.state} set={staffForm.set} />
      </Sheet>
    )
  }

  /* ---------- 接受入口 P08 ---------- */
  if (view === "accept") {
    return (
      <Sheet
        open={open}
        onClose={close}
        width="max-w-lg"
        title="接受邀请（示例入口）"
        desc="链接与邀请码指向同一份邀请，接受后其余入口不可再开户。"
        footer={
          <Button variant="ghost" onClick={() => setView("result")}>
            <ArrowLeft className="size-3.5" />
            返回结果
          </Button>
        }
      >
        <AcceptFlow person={draft.person} workPlan={draft.workPlan} />
      </Sheet>
    )
  }

  /* ---------- 重复 / 已开通 P11 ---------- */
  if (view === "duplicate") {
    return (
      <Sheet
        open={open}
        onClose={close}
        width="max-w-lg"
        title={accountEnabled ? "该人员账号已开通" : "已存在有效邀请"}
        desc="不重复开户：同一人员不会因再次邀请而产生第二个账号。"
        footer={
          <Button variant="ghost" onClick={() => setView("form")}>
            <ArrowLeft className="size-3.5" />
            返回
          </Button>
        }
      >
        {accountEnabled ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] p-3 text-[13px] text-[#7a5514]">
              {personName} 已有启用账号
              <span className="ml-1 font-mono">{matchedAccount?.username}</span>
              ；不能再为其创建账号。如需调整访问，请在该账号或其教职工职责中处理。
            </div>
            <InfoNote>再次邀请只会指向既有账号，不会创建重复登录名，也不改变既有职责与治理任期。</InfoNote>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
              <p className="text-foreground">
                {personName} 已有一份待接受邀请
                <span className="ml-1 font-mono text-primary">{existingPending}</span>。
              </p>
              <p className="mt-1 text-muted-foreground">
                同一份邀请可继续重发链接 / 邮件或重置凭证，不应新开第二份并行邀请。
              </p>
            </div>
            <Button
              onClick={() => {
                setView("result")
              }}
            >
              查看现有邀请
            </Button>
            <InfoNote>重发不改变编号 {existingPending}；重置凭证会使旧链接 / 旧码失效并升级版本。</InfoNote>
          </div>
        )}
      </Sheet>
    )
  }

  /* ---------- 结果 P07 ---------- */
  if (view === "result") {
    return (
      <Sheet
        open={open}
        onClose={close}
        width="max-w-xl"
        title="邀请已生成（示例）"
        desc="一份邀请，三种交付方式使用同一编号；未创建真实账号或发送真实邮件。"
        footer={<Button onClick={close}>完成</Button>}
      >
        <ResultView draft={draft} onAccept={() => setView("accept")} />
      </Sheet>
    )
  }

  /* ---------- 预览 ---------- */
  if (view === "preview") {
    return (
      <Sheet
        open={open}
        onClose={close}
        width="max-w-xl"
        title="确认邀请方案"
        desc="确认无误后生成邀请；无审批环节，由有权者直接办理。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setView("form")}>
              <ArrowLeft className="size-3.5" />
              返回修改
            </Button>
            <Button onClick={() => setView("result")}>
              {sendEmail ? "生成邀请并发送邮件" : "确认并生成邀请"}
            </Button>
          </>
        }
      >
        <PreviewView draft={draft} sendEmail={sendEmail} />
      </Sheet>
    )
  }

  /* ---------- 主表单 ---------- */
  const filteredStaff = STAFF.filter(
    (s) => !query || s.name.includes(query) || s.department.includes(query) || s.employeeNo.includes(query),
  )

  return (
    <Sheet
      open={open}
      onClose={close}
      width="max-w-2xl"
      title="开通账号 / 发出邀请"
      desc="先选受邀人员，再拟定系统角色与交付方式。无审批：由有权者直接办理。"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            取消
          </Button>
          <Button disabled={!canGenerate} onClick={() => setView("preview")}>
            下一步：预览
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* 演示：操作者权限开关 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--primary)]"
              checked={!operatorCanGrantAdmin}
              onChange={(e) => setOperatorCanGrantAdmin(!e.target.checked)}
            />
            演示：无学校管理员授予权
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--primary)]"
              checked={!operatorCanCreateStaff}
              onChange={(e) => setOperatorCanCreateStaff(!e.target.checked)}
            />
            演示：无新增教职工权限
          </label>
        </div>

        {/* 1. 受邀人员 */}
        <section>
          <div className="mb-2.5">
            <h4 className="text-[14px] font-semibold text-foreground">受邀人员</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              从现有教职工中选择，或
              {operatorCanCreateStaff ? (
                <button
                  type="button"
                  onClick={() => setView("addStaff")}
                  className="mx-1 rounded font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  新增教职工
                </button>
              ) : (
                <span className="mx-1 font-medium text-muted-foreground/70">新增教职工（无权限）</span>
              )}
              后继续。
            </p>
          </div>
          {personName ? (
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-accent/40 px-3 py-2.5">
              <div className="text-[13px]">
                <span className="font-medium text-foreground">{personName}</span>
                <span className="ml-2 text-xs text-muted-foreground">{draft.personSub}</span>
              </div>
              <button
                onClick={() => {
                  setPersonName("")
                  setPersonStaffId(undefined)
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                重新选择
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索姓名 / 部门 / 工号"
                  className="pl-9"
                />
              </div>
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto thin-scroll rounded-lg border border-border p-1">
                {filteredStaff.map((s) => {
                  const acc = accountByStaffId(s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setPersonName(s.name)
                        setPersonStaffId(s.id)
                        setEmailTo(s.email)
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left hover:bg-muted"
                    >
                      <span className="text-[13px]">
                        <span className="font-medium text-foreground">{s.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {s.department}／{s.jobTitle} · {STAFF_STATUS_LABEL[s.status]}
                        </span>
                      </span>
                      <span className="text-xs">
                        {acc ? (
                          <AccountStatusBadge status={acc.status} />
                        ) : (
                          <Badge tone="neutral">{ACCOUNT_STATUS_LABEL.none}</Badge>
                        )}
                      </span>
                    </button>
                  )
                })}
                {filteredStaff.length === 0 ? (
                  <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">
                    没有匹配的人员，可使用上方“新增教职工”。
                  </p>
                ) : null}
              </div>
            </>
          )}

          {/* 账号 / 邀请存在性提示（P11） */}
          {personName && accountEnabled ? (
            <div className="mt-2 flex items-center justify-between rounded-md border border-[#e6d4a8] bg-[#fbf7ee] px-3 py-2 text-xs text-[#7a5514]">
              该人员账号已开通（{matchedAccount?.username}），不重复开户。
              <button className="font-medium underline" onClick={() => setView("duplicate")}>
                说明
              </button>
            </div>
          ) : personName && existingPending ? (
            <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              已存在待接受邀请 <span className="font-mono text-primary">{existingPending}</span>，不应重复新建。
              <button className="font-medium text-primary underline" onClick={() => setView("duplicate")}>
                查看现有邀请
              </button>
            </div>
          ) : null}
        </section>

        {/* 2. 系统角色 */}
        <section>
          <SectionTitle title="拟开通系统角色（可多选）" hint="按需勾选一个或多个角色；如仅需账号自助，可使用下方“不分配系统角色”。" />
          <div className="grid gap-2 sm:grid-cols-2">
            {SYSTEM_ROLES.map((r) => {
              const active = roles.includes(r)
              const isAdmin = r === "SCHOOL_ADMIN"
              const blocked = isAdmin && !operatorCanGrantAdmin
              return (
                <button
                  key={r}
                  disabled={blocked}
                  onClick={() => toggleRole(r)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    blocked
                      ? "cursor-not-allowed border-dashed border-border bg-muted/40 opacity-70"
                      : active
                        ? "border-primary bg-accent/50"
                        : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <RoleBadge role={r} />
                    {active ? <Check className="size-4 text-primary" /> : null}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{SYSTEM_ROLE_DESC[r]}</p>
                  {blocked ? (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#9a2b22]">
                      <ShieldAlert className="size-3.5" />
                      无权授予此角色
                    </p>
                  ) : null}
                </button>
              )
            })}
          </div>

          {adminBlocked ? (
            <div className="mt-2 rounded-md border border-[#eec4bf] bg-[#fbe6e4] px-3 py-2 text-xs text-[#9a2b22]">
              当前操作者无“授予学校管理员”的权限：不能继续。此处直接拒绝，不进入任何审批流程；如需授予，请由具备该授予权的管理员办理。
            </div>
          ) : null}

          {/* 零角色例外（次要、折叠） */}
          <div className="mt-2">
            <button
              onClick={() => setShowZero((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showZero ? "收起" : "特殊情况：不分配系统角色（仅账号自服务）"}
            </button>
            {showZero ? (
              <label className="mt-1.5 flex items-start gap-2 rounded-md border border-dashed border-border p-2.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 accent-[var(--primary)]"
                  checked={zeroRole}
                  disabled={roles.length > 0}
                  onChange={(e) => {
                    setZeroRole(e.target.checked)
                    if (e.target.checked) setRoles([])
                  }}
                />
                <span>
                  零角色例外：账号可登录并自助管理自身信息，但没有任何业务能力（不任课、不带班、不治理、不教务）。选择任一系统角色即自动取消本项。
                </span>
              </label>
            ) : null}
          </div>
        </section>

        {/* 3. 业务职责（可选补充） */}
        {roles.length > 0 && !effectiveZero ? (
          <section>
            <SectionTitle
              title="同时安排职责（可选）"
              hint="开通账号不等于安排职责；此处仅登记职责类型，具体负责范围仍在职责安排中细化。"
            />
            {!showDuties ? (
              <button
                onClick={() => setShowDuties(true)}
                className="rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
              >
                展开可选职责
              </button>
            ) : (
              <div className="space-y-3">
                {DUTIES_BY_ROLE.filter((g) => roles.includes(g.role)).map((g) => (
                  <div key={g.role} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <RoleBadge role={g.role} />
                      <span className="text-xs text-muted-foreground">可安排的职责类型</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.duties.map((d) => {
                        const active = duties.includes(d.key)
                        return (
                          <button
                            key={d.key}
                            onClick={() =>
                              setDuties((prev) =>
                                prev.includes(d.key) ? prev.filter((x) => x !== d.key) : [...prev, d.key],
                              )
                            }
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:border-primary/40",
                            )}
                          >
                            {d.label}
                          </button>
                        )
                      })}
                    </div>
                    {g.role === "TEACHING_MANAGER" ? (
                      <p className="mt-2 text-xs text-muted-foreground/70">
                        教务管理统一使用“标准教务配置”；此处登记后仍以该配置的获准范围为准。
                      </p>
                    ) : null}
                  </div>
                ))}
                <InfoNote>选择职责只是登记类型；负责的具体对象（班级 / 单元 / 课程）在“职责安排”里逐项确定。</InfoNote>
              </div>
            )}
          </section>
        ) : null}

        {/* 4. 交付方式 */}
        <section>
          <SectionTitle title="交付方式" hint="默认生成邀请链接与邀请码，由你转交；可选同时发送邀请邮件。" />
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <span className="mt-0.5 flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Link2 className="size-4" />
              </span>
              <div className="text-[13px]">
                <p className="font-medium text-foreground">生成邀请链接 + 邀请码（默认）</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  同一份邀请的两种入口，生成后可复制转交；均指向同一编号，不重复开户。
                </p>
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-border p-3">
              <input
                type="checkbox"
                className="mt-1 size-3.5 accent-[var(--primary)]"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              <div className="flex-1 text-[13px]">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <Mail className="size-3.5" />
                  同时发送邀请邮件（可选）
                </p>
                {sendEmail ? (
                  <div className="mt-2 space-y-2">
                    <Field label="收件邮箱">
                      <Input
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        placeholder="如 name@demo.school"
                        type="email"
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--primary)]"
                        checked={emailUnconfigured}
                        onChange={(e) => setEmailUnconfigured(e.target.checked)}
                      />
                      演示：模拟“邮件服务未配置”
                    </label>
                    {emailUnconfigured ? (
                      <p className="rounded-md border border-[#e6d4a8] bg-[#fbf7ee] px-2.5 py-1.5 text-xs text-[#7a5514]">
                        邮件服务未配置：邮件不会发出，但链接与邀请码仍然有效，可手动转交。
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/70">
                        邮件发送成功只表示送达，不代表对方已接受；是否接受以邀请状态为准。
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </label>
          </div>
        </section>

        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground/70">
          邀请有效期为 {INVITE_VALID_DAYS} 天，仅影响“能否接受”；不据此推导职责期限或管理员任期。
        </p>
      </div>
    </Sheet>
  )
}

/* ---------------- 小组件 ---------------- */

function DUTY_LABEL(key: DutyKey): string {
  const found = DUTIES_BY_ROLE.flatMap((g) => g.duties).find((d) => d.key === key)
  return found?.label ?? key
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-2.5">
      <h4 className="text-[14px] font-semibold text-foreground">{title}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function CopyRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    try {
      navigator.clipboard?.writeText(value)
    } catch {
      /* 演示环境忽略 */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-muted/60 px-2.5 py-1.5 font-mono text-[13px] text-foreground">
          {value}
        </code>
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "已复制" : "复制"}
        </Button>
      </div>
    </div>
  )
}

type Draft = {
  no: string
  person: string
  personSub: string
  roles: SystemRoleCode[]
  zeroRole: boolean
  workPlan: string
  expires: string
  code: string
  link: string
  accountMode: string
  emailStatus: EmailDeliveryStatus
  emailTo?: string
}

function PlanSummary({ draft }: { draft: Draft }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{draft.person}</span>
        <span className="text-xs text-muted-foreground">{draft.personSub}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {draft.zeroRole ? (
          <Badge tone="neutral">仅账号自服务</Badge>
        ) : (
          draft.roles.map((r) => <RoleBadge key={r} role={r} />)
        )}
      </div>
      <dl className="mt-2.5 space-y-1 border-t border-border pt-2 text-xs">
        <Row k="工作安排" v={draft.workPlan} />
        <Row k="账号处理" v={draft.accountMode === "reuse" ? "复用既有账号，不新建" : "新建账号（接受后由本人设登录名 / 密码）"} />
        <Row k="有效截止" v={`${draft.expires}（仅影响接受）`} />
      </dl>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-muted-foreground/70">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  )
}

function PreviewView({ draft, sendEmail }: { draft: Draft; sendEmail: boolean }) {
  return (
    <div className="space-y-3">
      <PlanSummary draft={draft} />
      <div className="rounded-lg border border-border p-3 text-[13px]">
        <p className="text-xs font-medium text-muted-foreground">交付方式</p>
        <ul className="mt-1.5 space-y-1 text-[13px] text-foreground">
          <li className="flex items-center gap-1.5">
            <Link2 className="size-3.5 text-primary" /> 生成邀请链接
          </li>
          <li className="flex items-center gap-1.5">
            <Ticket className="size-3.5 text-primary" /> 生成邀请码
          </li>
          <li className="flex items-center gap-1.5">
            <Mail className={cn("size-3.5", sendEmail ? "text-primary" : "text-muted-foreground/50")} />
            {sendEmail ? `发送邀请邮件至 ${draft.emailTo}` : "不发送邮件（仅手动转交）"}
          </li>
        </ul>
      </div>
      <InfoNote>无审批：确认后立即生成，可随时在“邀请记录”中重发、重置凭证或撤销。</InfoNote>
    </div>
  )
}

function ResultView({ draft, onAccept }: { draft: Draft; onAccept: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-[#bcdcc8] bg-[#e6f2ea] p-4">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#256a49]" />
        <div className="text-[13px]">
          <p className="font-medium text-[#1f5a3d]">
            ��请编号 <span className="font-mono">{draft.no}</span> 已生成
          </p>
          <p className="mt-0.5 text-[#256a49]/80">编号为稳定标识，可用于对账与查找；它不是邀请码，不能用于登录或授权。</p>
        </div>
      </div>

      <PlanSummary draft={draft} />

      <div className="space-y-2">
        <CopyRow label="邀请链接" value={draft.link} icon={<Link2 className="size-3.5" />} />
        <CopyRow label="邀请码" value={draft.code} icon={<Ticket className="size-3.5" />} />
      </div>

      {/* 邮件送达（单列，与接受状态分开） */}
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Mail className="size-3.5" />
            邮件送达
          </p>
          <Badge tone={EMAIL_STATUS_TONE[draft.emailStatus]}>{EMAIL_STATUS_LABEL[draft.emailStatus]}</Badge>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {draft.emailStatus === "none"
            ? "未通过邮件发送；请复制链接或邀请码手动转交。"
            : draft.emailStatus === "unconfigured"
              ? "邮件服务未配置，邮件未发出；链接与邀请码仍然有效。"
              : `已向 ${draft.emailTo} 发送邀请邮件（示例）。送达不等于已接受。`}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-3">
        <p className="text-[13px] text-muted-foreground">查看受邀人如何接受（链接 / 邀请码指向同一邀请）</p>
        <Button size="sm" variant="outline" onClick={onAccept}>
          查看接受入口
        </Button>
      </div>
    </div>
  )
}

/* ---------------- P08 接受流程 ---------------- */

function AcceptFlow({ person, workPlan }: { person: string; workPlan: string }) {
  const [tab, setTab] = useState<"link" | "code">("link")
  const [code, setCode] = useState("")
  const [verified, setVerified] = useState(false)
  const [login, setLogin] = useState("")
  const [pw, setPw] = useState("")
  const [pw2, setPw2] = useState("")
  const [done, setDone] = useState(false)

  const codeOk = code.trim().toUpperCase() === INVITE_DEMO_CODE
  const linkPrelocated = tab === "link"
  const reachedForm = linkPrelocated || (tab === "code" && verified)
  const canActivate = reachedForm && login.trim() && pw.length >= 6 && pw === pw2

  if (done) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-[#bcdcc8] bg-[#e6f2ea] p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#256a49]" />
          <div className="text-[13px]">
            <p className="font-medium text-[#1f5a3d]">已接受并激活账号（示例）</p>
            <p className="mt-0.5 text-[#256a49]/80">
              登录名 <span className="font-mono">{login || "（本人设定）"}</span> · 邀请 {INVITE_DEMO_NO} 状态转为“已接受”。
            </p>
          </div>
        </div>
        <InfoNote>其余入口（链接 / 邀请码 / 邮件）此后只显示既有结果，不再新建账号。</InfoNote>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        <TabBtn active={tab === "link"} onClick={() => setTab("link")} icon={<Link2 className="size-3.5" />}>
          链接入口
        </TabBtn>
        <TabBtn active={tab === "code"} onClick={() => setTab("code")} icon={<Ticket className="size-3.5" />}>
          邀请码入口
        </TabBtn>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-[13px]">
        <p className="text-foreground">
          受邀人：<span className="font-medium">{person}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">拟开通：{workPlan}</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          编号 <span className="font-mono">{INVITE_DEMO_NO}</span> · 链接与邀请码指向同一份邀请。
        </p>
      </div>

      {tab === "link" ? (
        <p className="rounded-md bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
          通过链接进入已自动定位到该邀请，无需再输入邀请码。
        </p>
      ) : (
        <div className="space-y-2">
          <Field label="输入邀请码">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={INVITE_DEMO_CODE}
              className="font-mono"
            />
          </Field>
          {code && !codeOk ? (
            <p className="text-xs text-[#9a2b22]">邀请码不正确，请核对后重试（示例有效码：{INVITE_DEMO_CODE}）。</p>
          ) : null}
          {!verified ? (
            <Button size="sm" disabled={!codeOk} onClick={() => setVerified(true)}>
              校验邀请码
            </Button>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-[#256a49]">
              <Check className="size-3.5" /> 已定位到邀请 {INVITE_DEMO_NO}
            </p>
          )}
        </div>
      )}

      {reachedForm ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">设置登录信息（由受邀人本人设定）</p>
          <Field label="登录名">
            <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="如 wang.example" className="font-mono" />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="密码（至少 6 位）">
              <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••" />
            </Field>
            <Field label="确认密码" error={pw2 && pw !== pw2 ? "两次输入不一致" : undefined}>
              <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••" />
            </Field>
          </div>
          <Button disabled={!canActivate} onClick={() => setDone(true)}>
            接受邀请并激活账号
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40",
      )}
    >
      {icon}
      {children}
    </button>
  )
}
