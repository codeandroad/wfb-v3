"use client"

import { Badge, Card, Tabs } from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  ACCOUNTS,
  ACCOUNT_STATUS_LABEL,
  ADMIN_TENURE_DEFAULT_NOTE,
  ADMIN_TENURE_SCENARIOS,
  DUTY_BY_KEY,
  DUTY_TYPES,
  DUTIES_BY_ROLE,
  STAFF,
  STANDARD_TM_CONFIG_LABEL,
  STANDARD_TM_CONFIG_VERSION,
  STANDARD_TM_GRANTED,
  STANDARD_TM_PLANNED,
  STANDARD_TM_STAFF_IDS,
  SUBSTITUTE_PREVIEW,
  SUBSTITUTE_UNQUALIFIED,
  SYSTEM_ROLES,
  SYSTEM_ROLE_DESC,
  SYSTEM_ROLE_LABEL,
  staffById,
  type AccessTone,
  type AccountRecord,
  type AdminTenureScenario,
  type DutyKey,
  type DutyRecord,
} from "@/lib/demo/staff"
import { CalendarClock, Check, KeyRound, ShieldCheck, UserCog, X } from "lucide-react"
import { useMemo, useState } from "react"
import { AccountDetailSheet } from "./account-detail-sheet"
import { AccountStatusBadge, CanCannotBlock, InfoNote, RoleBadge } from "./duty-bits"
import { DutyArrangeSheet } from "./duty-arrange-sheet"
import { DutyDetailSheet } from "./duty-detail-sheet"
import { InviteSheet } from "./invite-sheet"
import { InviteRecordsPanel } from "./invite-records-panel"
import { ListToolbar, type FilterGroup, type FilterState } from "./list-toolbar"
import { StaffDetailSheet } from "./staff-detail-sheet"
import { cn } from "@/lib/utils"

const ACCOUNT_FILTER_GROUPS: FilterGroup[] = [
  {
    key: "role",
    label: "系统角色",
    options: SYSTEM_ROLES.map((r) => ({ value: r, label: SYSTEM_ROLE_LABEL[r] })),
  },
  {
    key: "status",
    label: "账号状态",
    options: (["pending", "enabled", "disabled", "revoked"] as const).map((s) => ({
      value: s,
      label: ACCOUNT_STATUS_LABEL[s],
    })),
  },
  {
    key: "access",
    label: "访问状态",
    options: [
      { value: "success", label: "有有效访问" },
      { value: "info", label: "待生效 / 初始化" },
      { value: "warning", label: "访问受限 / 待激活" },
      { value: "neutral", label: "当前无有效访问" },
    ],
  },
]

type Drawer =
  | { kind: "account"; accountId: string }
  | { kind: "staff"; staffId: string }
  | { kind: "duty"; staffId: string; dutyId: string }
  | { kind: "arrange"; staffId?: string; mode: "arrange" | "adjust"; presetDuty?: DutyKey; presetScope?: string; presetPerson?: string }
  | { kind: "invite"; presetPerson?: string }

export function AccountsPanel() {
  const [tab, setTab] = useState("accounts")
  const [stack, setStack] = useState<Drawer[]>([])
  const [endedDutyIds, setEndedDutyIds] = useState<Set<string>>(new Set())
  const pushD = (d: Drawer) => setStack((s) => [...s, d])
  const pop = () => setStack((s) => s.slice(0, -1))
  const top = stack[stack.length - 1]

  return (
    <div>
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "accounts", label: "账号列表" },
            { value: "invites", label: "邀请记录" },
            { value: "guide", label: "职责说明" },
            { value: "teaching", label: "教务配置" },
            { value: "admin", label: "管理员有效期" },
          ]}
        />
      </div>

      {tab === "accounts" ? (
        <AccountsList
          onOpen={(id) => pushD({ kind: "account", accountId: id })}
          onOpenStaff={(id) => pushD({ kind: "staff", staffId: id })}
          onInvite={() => pushD({ kind: "invite" })}
        />
      ) : null}
      {tab === "invites" ? <InviteRecordsPanel /> : null}
      {tab === "guide" ? <DutyGuide /> : null}
      {tab === "teaching" ? (
        <StandardTeachingConfig onOpenStaff={(id) => pushD({ kind: "staff", staffId: id })} />
      ) : null}
      {tab === "admin" ? <AdminTenurePanel /> : null}

      {top?.kind === "account" ? (
        <AccountDetailSheet
          accountId={top.accountId}
          endedDutyIds={endedDutyIds}
          onClose={pop}
          onOpenDuty={(d, staffName) => {
            const staff = STAFF.find((s) => s.name === staffName)
            if (staff) pushD({ kind: "duty", staffId: staff.id, dutyId: d.id })
          }}
        />
      ) : null}

      {top?.kind === "staff" ? (
        <StaffDetailSheet
          staff={staffById(top.staffId)!}
          endedDutyIds={endedDutyIds}
          onClose={pop}
          onOpenDuty={(d) => pushD({ kind: "duty", staffId: top.staffId, dutyId: d.id })}
          onArrange={() => pushD({ kind: "arrange", staffId: top.staffId, mode: "arrange" })}
          onOpenAccount={(id) => pushD({ kind: "account", accountId: id })}
          onInvite={() => pushD({ kind: "invite", presetPerson: staffById(top.staffId)!.name })}
        />
      ) : null}

      {top?.kind === "arrange" ? (
        <DutyArrangeSheet
          open
          mode={top.mode}
          staff={top.staffId ? staffById(top.staffId) : null}
          lockStaff={!!top.staffId}
          presetDuty={top.presetDuty}
          presetScope={top.presetScope}
          presetPerson={top.presetPerson}
          onClose={pop}
        />
      ) : null}

      {top?.kind === "duty"
        ? (() => {
            const staff = staffById(top.staffId)
            const d = staff?.duties.find((x) => x.id === top.dutyId)
            if (!staff || !d) return null
            const duty: DutyRecord = endedDutyIds.has(d.id) ? { ...d, status: "ended" } : d
            return (
              <DutyDetailSheet
                open
                duty={duty}
                staffName={staff.name}
                currentUseLimit={staff.statusNote}
                onClose={pop}
                onEnded={(id) => {
                  setEndedDutyIds((set) => new Set(set).add(id))
                  pop()
                }}
              />
            )
          })()
        : null}

      {top?.kind === "invite" ? <InviteSheet open onClose={pop} /> : null}
    </div>
  )
}

/* ---------------- P05 账号列表 ---------------- */

const ACCESS_TONE_CLASS: Record<AccessTone, string> = {
  success: "bg-[#e7f4ea] text-[#1f7a3d]",
  info: "bg-[#e6eef9] text-[#1f4f8a]",
  warning: "bg-[#fbf1dc] text-[#8a5a12]",
  neutral: "bg-muted text-muted-foreground",
}

function AccountsList({
  onOpen,
  onOpenStaff,
  onInvite,
}: {
  onOpen: (id: string) => void
  onOpenStaff: (staffId: string) => void
  onInvite: () => void
}) {
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})

  const rows = useMemo(() => {
    const fRole = filters.role ?? []
    const fStatus = filters.status ?? []
    const fAccess = filters.access ?? []
    return ACCOUNTS.filter((a) => {
      const matchQ = !q || a.username.includes(q) || (a.staffName ?? "").includes(q)
      const matchRole = !fRole.length || a.systemRoles.some((r) => fRole.includes(r))
      const matchStatus = !fStatus.length || fStatus.includes(a.status)
      const matchAccess = !fAccess.length || fAccess.includes(a.accessTone)
      return matchQ && matchRole && matchStatus && matchAccess
    })
  }, [q, filters])

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        账号是独立于教职工档案的对象。账号状态表示能否登录；访问状态表示登录后当前实际拥有的有效访问，两者分开呈现。
      </p>

      <Card>
        <div className="px-5 py-4">
          <ListToolbar
            search={q}
            onSearch={setQ}
            searchPlaceholder="搜索姓名或账号"
            groups={ACCOUNT_FILTER_GROUPS}
            value={filters}
            onChange={setFilters}
            resultCount={rows.length}
            totalCount={ACCOUNTS.length}
            right={
              <Button onClick={onInvite}>
                <KeyRound className="size-3.5" />
                开通账号
              </Button>
            }
          />
        </div>

        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">登录账号</th>
                <th className="px-3 py-2.5 font-medium">关联人员</th>
                <th className="px-3 py-2.5 font-medium">账号状态</th>
                <th className="px-3 py-2.5 font-medium">访问状态</th>
                <th className="px-5 py-2.5 font-medium">最近登录</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const staff = a.staffName ? STAFF.find((s) => s.name === a.staffName) : undefined
                return (
                  <AccountRow
                    key={a.id}
                    acc={a}
                    onOpen={() => onOpen(a.id)}
                    onOpenStaff={staff ? () => onOpenStaff(staff.id) : undefined}
                  />
                )
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">没有符合条件的账号。</div>
        ) : (
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">共 {rows.length} 个账号</div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoNote>账号状态“启用”不代表有访问：登录名未设置、待激活或职责均已结束时，访问状态会显示为受限或无有效访问。</InfoNote>
        <InfoNote>基础治理账号可未关联教职工；不会因此自动创建员工，也不当作错误删除。</InfoNote>
      </div>
    </div>
  )
}

function AccountRow({
  acc,
  onOpen,
  onOpenStaff,
}: {
  acc: AccountRecord
  onOpen: () => void
  onOpenStaff?: () => void
}) {
  const loginPending = !acc.loginNameSet

  return (
    <tr className="border-t border-border align-top">
      <td className="px-5 py-3.5">
        <button onClick={onOpen} className="text-left">
          {loginPending ? (
            <span className="block font-medium text-muted-foreground italic hover:text-primary hover:underline">
              待设置登录名
            </span>
          ) : (
            <span className="block font-mono font-medium text-foreground hover:text-primary hover:underline">
              {acc.username}
            </span>
          )}
          <span className="block text-xs text-muted-foreground">
            {acc.systemRoles.length ? acc.systemRoles.map((r) => SYSTEM_ROLE_LABEL[r]).join(" · ") : "暂无业务角色"}
          </span>
        </button>
      </td>
      <td className="px-3 py-3.5">
        {onOpenStaff ? (
          <button onClick={onOpenStaff} className="text-left text-[13px] font-medium text-foreground hover:text-primary hover:underline">
            {acc.staffName}
          </button>
        ) : (
          <span className="text-[13px] text-muted-foreground">{acc.staffName ?? "未关联教职工"}</span>
        )}
      </td>
      <td className="px-3 py-3.5">
        <AccountStatusBadge status={acc.status} />
      </td>
      <td className="px-3 py-3.5">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ACCESS_TONE_CLASS[acc.accessTone]}`}>
          {acc.accessSummary}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <span className="text-[12.5px] text-muted-foreground">{acc.lastLogin ?? "未提供"}</span>
      </td>
    </tr>
  )
}

/* ---------------- P07 职责说明 ---------------- */

function DutyGuide() {
  const [sel, setSel] = useState(DUTY_TYPES[0].key)
  const def = DUTY_BY_KEY[sel]
  // 用于借用 CanCannotBlock：构造一个仅含 canDo/cannotDo 的占位职责
  const sample: DutyRecord = {
    id: "guide",
    type: sel,
    scopeLabel: def.scopeKind,
    status: "active",
    workMode: "rw",
    start: "",
    canDo: def.canDo,
    cannotDo: def.cannotDo,
    basis: [],
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card className="h-max p-2">
        {DUTIES_BY_ROLE.map((g) => (
          <div key={g.role} className="mb-2 last:mb-0">
            <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{SYSTEM_ROLE_LABEL[g.role]}</p>
            {g.duties.map((d) => {
              const active = d.key === sel
              return (
                <button
                  key={d.key}
                  onClick={() => setSel(d.key)}
                  className={
                    active
                      ? "block w-full rounded-lg bg-accent px-2.5 py-1.5 text-left text-[13px] font-medium text-primary"
                      : "block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] text-foreground hover:bg-muted"
                  }
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        ))}
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={def.role} />
            <h3 className="text-[15px] font-semibold">{def.label}</h3>
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">{def.blurb}</p>
          <div className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">允许的对象类型</p>
              <p className="mt-1">{def.scopeKind}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">谁能安排</p>
              <p className="mt-1">{def.arrangeableBy}</p>
            </div>
          </div>
          <div className="mt-3">
            <CanCannotBlock duty={sample} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge tone="success">有效</Badge>
            <Badge tone="info">未生效</Badge>
            <Badge tone="warning">暂停</Badge>
            <span>账号不可用时，职责保留但当前不可使用。</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            系统角色资格：{SYSTEM_ROLE_DESC[def.role]}
          </p>
        </Card>

        <Card className="p-5">
          <h3 className="text-[14px] font-semibold">三组对照</h3>
          <div className="mt-3 space-y-3">
            <Contrast
              title="主班主任 vs 辅助班主任"
              body="同一基础角色；本班日常学生管理同权。主岗用于主要责任，不逐次审批辅助班主任的操作。"
            />
            <Contrast
              title="任课 vs 课程资料维护"
              body="教 P1 不等于可以修改全校 CAIE 数学目录；两项职责需分别安排。"
            />
            <Contrast
              title="课程资料维护 vs 课程结构维护"
              body="校内说明 / 资源，不等于课程启停、官方身份、课程—单元结构或全校字典。"
            />
          </div>
          <InfoNote>
            <span className="mt-3 block">
              说明页描述“可能允许的边界”；具体某人是否允许，以其教职工详情中的实际职责与状态为准。
            </span>
          </InfoNote>
        </Card>
      </div>
    </div>
  )
}

function Contrast({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[13px] font-semibold">{title}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

/* ---------------- P07/P08 教务：标准教务配置 + 代课管理预览 ---------------- */

function StandardTeachingConfig({ onOpenStaff }: { onOpenStaff: (id: string) => void }) {
  const [open, setOpen] = useState(true)
  const people = STANDARD_TM_STAFF_IDS.map((id) => staffById(id)).filter(Boolean) as ReturnType<typeof staffById>[]

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        教务管理统一使用同一份获准配置，本期不按人员区分权限；这是相同配置而非共用账号，每人仍保留各自人员、账号、操作记录与任期。
      </p>

      {/* 配置头 */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <RoleBadge role="TEACHING_MANAGER" />
              <h3 className="text-[15px] font-semibold">{STANDARD_TM_CONFIG_LABEL}</h3>
            </div>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              本校统一配置；本期不按人员区分权限。版本 <span className="font-mono">{STANDARD_TM_CONFIG_VERSION}</span>。
            </p>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {open ? "收起职责范围" : "查看职责范围"}
          </button>
        </div>

        {/* 使用此配置的教务 */}
        <div className="mt-4 rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">使用此配置的教务人员（应看到相同权限说明）</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p!.id}
                onClick={() => onOpenStaff(p!.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary"
              >
                <UserCog className="size-3.5" />
                {p!.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground/70">
            某人的资格失效 / 离职 / 暂停单独判断，不会改写他人记录；“谁负责哪项日常工作”是分工说明，不是隐藏的另一份权限配置。
          </p>
        </div>

        {open ? (
          <div className="mt-4 space-y-3">
            {STANDARD_TM_GRANTED.map((c) => (
              <div key={c.key} className="rounded-lg border border-border p-3">
                <p className="text-[13px] font-semibold">{c.duty}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.scope}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <ul className="space-y-1">
                    {c.actions.map((a) => (
                      <li key={a} className="flex items-start gap-1.5 text-[12.5px] text-foreground">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-[#2f7d5b]" />
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-1">
                    {c.excludes.map((e) => (
                      <li key={e} className="flex items-start gap-1.5 text-[12.5px] text-muted-foreground">
                        <X className="mt-0.5 size-3.5 shrink-0 text-[#a23b32]" />
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {/* P08 代课管理预览 */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h3 className="text-[14px] font-semibold">代课管理：教务可直接办理（权限预览）</h3>
        </div>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          本轮新增授权方向：具备对应代课管理能力的教务人员可直接办理代课，学校管理员仍可按获准能力办理。以下为权限预览，非完整代课工作台。
        </p>

        <div className="mt-3 rounded-lg border border-border p-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{SUBSTITUTE_PREVIEW.operator}</span>
            <Badge tone="info">{SUBSTITUTE_PREVIEW.operatorRole}</Badge>
          </div>
          <ul className="mt-2 space-y-1">
            {SUBSTITUTE_PREVIEW.canDo.map((a) => (
              <li key={a} className="flex items-start gap-1.5 text-[12.5px] text-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-[#2f7d5b]" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1.5 border-t border-border pt-2.5 text-[12.5px]">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted-foreground/70">办理方式</dt>
              <dd className="text-foreground">{SUBSTITUTE_PREVIEW.method}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted-foreground/70">范围示例</dt>
              <dd className="text-muted-foreground">{SUBSTITUTE_PREVIEW.scopeExample}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted-foreground/70">接替示例</dt>
              <dd className="text-muted-foreground">{SUBSTITUTE_PREVIEW.replacementExample}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[#e2b6b0] bg-[#fbeeec] p-3">
            <p className="text-xs font-semibold text-[#8a3d34]">不随本次自动扩大</p>
            <ul className="mt-1.5 space-y-1">
              {SUBSTITUTE_PREVIEW.excludes.map((e) => (
                <li key={e} className="flex items-start gap-1.5 text-[12.5px] text-[#8a3d34]">
                  <X className="mt-0.5 size-3.5 shrink-0" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] p-3">
            <p className="text-xs font-semibold text-[#7a5514]">资格不满足时（示例拒绝）</p>
            <p className="mt-1.5 text-[12.5px] text-[#7a5514]">
              接替人选：{SUBSTITUTE_UNQUALIFIED.candidate}
            </p>
            <p className="mt-1 text-[12.5px] text-[#7a5514]">{SUBSTITUTE_UNQUALIFIED.reason}</p>
            <p className="mt-1 text-[12.5px] text-[#7a5514]/80">{SUBSTITUTE_UNQUALIFIED.note}</p>
          </div>
        </div>
      </Card>

      {/* 规划职责（只读） */}
      <Card className="p-5">
        <h3 className="text-[14px] font-semibold">规划职责（本轮不纳入统一配置）</h3>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          以下职责本轮仅保留边界说明，不擅自补入标准配置，也不作为可授予选项；敏感能力（听课反思全文、积分规则、账号授予等）不因统一配置放开。
        </p>
        <div className="mt-3 space-y-2">
          {STANDARD_TM_PLANNED.map((p) => (
            <div key={p.duty} className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5">
              <Badge tone="neutral">规划</Badge>
              <div>
                <p className="text-[13px] font-medium text-foreground">{p.duty}</p>
                <p className="text-xs text-muted-foreground">{p.note}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ---------------- P09 管理员有效期与最后管理员保护 ---------------- */

function AdminTenurePanel() {
  const [sel, setSel] = useState(ADMIN_TENURE_SCENARIOS[0].id)
  const sc = ADMIN_TENURE_SCENARIOS.find((s) => s.id === sel)!

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">{ADMIN_TENURE_DEFAULT_NOTE}</p>

      <div className="flex flex-wrap gap-1.5">
        {ADMIN_TENURE_SCENARIOS.map((s) => {
          const active = s.id === sel
          return (
            <button
              key={s.id}
              onClick={() => setSel(s.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              {s.title}
            </button>
          )
        })}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" />
          <h3 className="text-[15px] font-semibold">{sc.title}</h3>
        </div>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{sc.summary}</p>

        {/* 对象管理员 */}
        <div className="mt-4 rounded-lg bg-muted/40 p-3 text-[13px]">
          <p className="font-medium text-foreground">{sc.subject.name}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{sc.subject.account}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sc.subject.note}</p>
        </div>

        {/* 有效期显示 + 高级设置 */}
        <div className="mt-4 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">管理员有效期</p>
              <p className="mt-0.5 text-[14px] font-semibold text-foreground">
                {sc.allowSetEnd ? "长期有效（可显式设置结束日期）" : "长期有效"}
              </p>
            </div>
            <Badge tone={sc.outcomeTone}>{sc.allowSetEnd ? "允许设置期限" : "锁定长期"}</Badge>
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">高级：指定结束日期</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="date"
                disabled={!sc.allowSetEnd}
                defaultValue="2027-07-15"
                className={cn(
                  "rounded-md border px-3 py-1.5 text-[13px] outline-none",
                  sc.allowSetEnd
                    ? "border-input bg-card text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
                    : "cursor-not-allowed border-border bg-muted/60 text-muted-foreground",
                )}
              />
              <Button size="sm" variant="outline" disabled={!sc.allowSetEnd}>
                保存期限
              </Button>
            </div>
          </div>
        </div>

        {/* 结论 */}
        <div
          className={cn(
            "mt-4 rounded-lg border p-3 text-[13px]",
            sc.outcomeTone === "danger"
              ? "border-[#e2b6b0] bg-[#fbeeec] text-[#8a3d34]"
              : sc.outcomeTone === "warning"
                ? "border-[#e6d4a8] bg-[#fbf7ee] text-[#7a5514]"
                : "border-[#bcdcc6] bg-[#eef7f0] text-[#1f6b3d]",
          )}
        >
          {sc.outcome}
        </div>

        {/* 佐证：其他治理来源/管理员 */}
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">接替 / 依赖判断（示例）</p>
          <ul className="mt-2 space-y-1.5">
            {sc.others.map((o) => (
              <li key={o.name} className="flex items-start gap-1.5 text-[12.5px]">
                {o.ok ? (
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[#2f7d5b]" />
                ) : (
                  <X className="mt-0.5 size-3.5 shrink-0 text-[#a23b32]" />
                )}
                <span className={o.ok ? "text-foreground" : "text-muted-foreground"}>
                  <span className="font-medium">{o.name}</span> · {o.state}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoNote>
          保护针对正常业务与可预见的期限配置：不允许撤权、解绑、停用、注销等绕过同一保护。待激活管理员、未来任命、仅有管理员标签的受限账号不计入接替。
        </InfoNote>
        <InfoNote>
          v0 只呈现固定场景，不计算治理覆盖区间。真实实现须核对可用治理来源、membership、账号及适用资格 / 任命的期间，不只看角色名称或账号数量。
        </InfoNote>
      </div>
    </div>
  )
}
