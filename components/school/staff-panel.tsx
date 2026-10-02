"use client"

import { Badge, Card, EmptyState, LinkButton, Segmented, useToast } from "@/components/kit"
import Link from "next/link"
import { homepageEligible } from "@/lib/profile/store"
import { Button } from "@/components/ui/button"
import {
  ACCOUNT_STATUS_LABEL,
  DUTY_FILTERS,
  STAFF_STATUS_LABEL,
  STAFF_STATUS_TONE,
  SYSTEM_ROLE_LABEL,
  SYSTEM_ROLES,
  accountByStaffId,
  type DutyKey,
  type DutyRecord,
  type StaffProfile,
} from "@/lib/demo/staff"
import { KeyRound, Search, Upload, UserPlus, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { AccountDetailSheet } from "./account-detail-sheet"
import { DutyArrangeSheet } from "./duty-arrange-sheet"
import { DutyDetailSheet } from "./duty-detail-sheet"
import { DutyLine } from "./duty-bits"
import { InviteSheet } from "./invite-sheet"
import { ListToolbar, type FilterGroup, type FilterState } from "./list-toolbar"
import { StaffCreateModal } from "./staff-create-modal"
import { StaffDetailSheet } from "./staff-detail-sheet"
import { useStaffList } from "@/lib/school/staff-store"

const STAFF_DEPTS = ["数学组", "物理组", "英语组", "教务处", "行政部"]
const STAFF_TITLES = ["教师", "教务主任", "行政助理"]

const STAFF_FILTER_GROUPS: FilterGroup[] = [
  {
    key: "status",
    label: "任职状态",
    options: [
      { value: "active", label: "在职" },
      { value: "leave", label: "请假" },
      { value: "left", label: "离职" },
    ],
  },
  {
    key: "duty",
    label: "具体职责",
    options: DUTY_FILTERS.filter((d) => d.value !== "all").map((d) => ({ value: d.value, label: d.label })),
  },
  { key: "dept", label: "部门", options: STAFF_DEPTS.map((v) => ({ value: v, label: v })) },
  { key: "jobTitle", label: "职务", options: STAFF_TITLES.map((v) => ({ value: v, label: v })) },
  {
    key: "acct",
    label: "账号开通",
    options: [
      { value: "opened", label: "已开通" },
      { value: "none", label: "未开通" },
    ],
  },
  {
    key: "role",
    label: "系统角色",
    options: SYSTEM_ROLES.map((r) => ({ value: r, label: SYSTEM_ROLE_LABEL[r] })),
  },
]

type Drawer =
  | { kind: "staff"; staffId: string }
  | { kind: "duty"; staffId: string; dutyId: string }
  | { kind: "account"; accountId: string; fromStaffId?: string }
  | { kind: "arrange"; staffId?: string; mode: "arrange" | "adjust"; presetDuty?: DutyKey; presetScope?: string; presetPerson?: string }
  | { kind: "invite"; presetPerson?: string }

type ListState = "data" | "empty" | "restricted"

export function StaffPanel() {
  const { push } = useToast()
  const staffList = useStaffList()
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})
  const [listState, setListState] = useState<ListState>("data")
  const [createOpen, setCreateOpen] = useState(false)

  const [stack, setStack] = useState<Drawer[]>([])
  const [endedDutyIds, setEndedDutyIds] = useState<Set<string>>(new Set())
  const push2 = (d: Drawer) => setStack((s) => [...s, d])
  const pop = () => setStack((s) => s.slice(0, -1))
  const top = stack[stack.length - 1]

  const total = listState === "data" ? staffList.length : 0

  const rows = useMemo(() => {
    if (listState !== "data") return []
    const fStatus = filters.status ?? []
    const fDuty = filters.duty ?? []
    const fDept = filters.dept ?? []
    const fTitle = filters.jobTitle ?? []
    const fAcct = filters.acct ?? []
    const fRole = filters.role ?? []
    return staffList.filter((s) => {
      const matchQ = !q || s.name.includes(q) || s.employeeNo.includes(q) || (s.username ?? "").includes(q)
      const matchStatus = !fStatus.length || fStatus.includes(s.status)
      const matchDuty = !fDuty.length || s.duties.some((d) => fDuty.includes(d.type) && d.status !== "ended")
      const matchDept = !fDept.length || fDept.includes(s.department)
      const matchTitle = !fTitle.length || fTitle.includes(s.jobTitle)
      const matchAcct =
        !fAcct.length || fAcct.includes(s.accountStatus === "none" ? "none" : "opened")
      const matchRole = !fRole.length || s.systemRoles.some((r) => fRole.includes(r))
      return matchQ && matchStatus && matchDuty && matchDept && matchTitle && matchAcct && matchRole
    })
  }, [q, filters, listState, staffList])

  const dutyOf = (staffId: string, dutyId: string): DutyRecord | undefined => {
    const d = staffList.find((s) => s.id === staffId)?.duties.find((x) => x.id === dutyId)
    if (!d) return undefined
    return endedDutyIds.has(d.id) ? { ...d, status: "ended" } : d
  }

  return (
    <div className="space-y-4">
      {/* 页头一句话 */}
      <p className="text-[13px] text-muted-foreground">查看教职工及其工作安排。</p>

      <Card>
        {/* 工具栏：搜索 + 多维度筛选，主操作在右 */}
        <div className="px-5 py-4">
          <ListToolbar
            search={q}
            onSearch={setQ}
            searchPlaceholder="搜索姓名、工号或账号"
            groups={STAFF_FILTER_GROUPS}
            value={filters}
            onChange={setFilters}
            resultCount={listState === "data" ? rows.length : undefined}
            totalCount={listState === "data" ? total : undefined}
            right={
              <div className="flex items-center gap-2">
                <LinkButton href="/import?type=staff" variant="outline" size="default">
                  <Upload className="size-3.5" />
                  批量导入
                </LinkButton>
                <Button onClick={() => setCreateOpen(true)}>
                  <UserPlus className="size-3.5" />
                  新增教职工
                </Button>
              </div>
            }
          />
          <p className="mt-2 text-xs text-muted-foreground/70">
            部门／职务为人事字段，与四个系统角色、具体职责相互独立。
          </p>
        </div>

        {/* 列表 */}
        {listState === "data" && rows.length > 0 ? (
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 font-medium">人员</th>
                  <th className="px-3 py-2.5 font-medium">部门／职务</th>
                  <th className="px-3 py-2.5 font-medium">职责与范围</th>
                  <th className="px-3 py-2.5 font-medium">任职状态</th>
                  <th className="px-5 py-2.5 font-medium">账号</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <StaffRow
                    key={s.id}
                    staff={s}
                    endedDutyIds={endedDutyIds}
                    onOpen={() => push2({ kind: "staff", staffId: s.id })}
                    onOpenAccount={(id) => push2({ kind: "account", accountId: id, fromStaffId: s.id })}
                    onInvite={() => push2({ kind: "invite", presetPerson: s.name })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* 空态：三种独立示例 */}
        {listState === "empty" ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={<Users className="size-6" />}
              title="尚未添加教职工"
              desc="新增教职工，或从数据导入批量建立档案。"
              action={
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <UserPlus className="size-3.5" />
                    新增教职工
                  </Button>
                  <Link href="/import?type=staff" className="text-[13px] font-medium text-primary hover:underline">
                    前往数据导入
                  </Link>
                </div>
              }
            />
          </div>
        ) : null}

        {listState === "restricted" ? (
          <div className="px-5 py-8">
            <EmptyState
              tone="warning"
              icon={<KeyRound className="size-6" />}
              title="无法加载教职工列表"
              desc="示例：数据加载失败或当前账号无权查看。这不是“0 人”，请稍后重试或联系管理员。"
            />
          </div>
        ) : null}

        {listState === "data" && rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={<Search className="size-6" />}
              title="没有符合条件的教职工"
              desc="调整或清除筛选后重试。"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setQ("")
                    setFilters({})
                  }}
                >
                  清除筛选
                </Button>
              }
            />
          </div>
        ) : null}

        {/* 单一总数 */}
        {listState === "data" && rows.length > 0 ? (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>共 {rows.length} 名教职工</span>
            <span>示例分页 · 第 1 / 1 页</span>
          </div>
        ) : null}
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
        <span>原型列表状态：</span>
        <Segmented
          size="sm"
          ariaLabel="切换预设列表状态"
          value={listState}
          onChange={setListState}
          options={[
            { value: "data", label: "有数据" },
            { value: "empty", label: "空库" },
            { value: "restricted", label: "受限/失败" },
          ]}
        />
      </div>

      {/* 抽屉栈：仅渲染顶层 */}
      {top?.kind === "staff" ? (
          <StaffDetailSheet
            staff={staffList.find((s) => s.id === top.staffId)!}
            endedDutyIds={endedDutyIds}
            onClose={pop}
            onOpenDuty={(d) => push2({ kind: "duty", staffId: top.staffId, dutyId: d.id })}
            onArrange={() => push2({ kind: "arrange", staffId: top.staffId, mode: "arrange" })}
            onOpenAccount={(id) => push2({ kind: "account", accountId: id, fromStaffId: top.staffId })}
            onInvite={() => push2({ kind: "invite", presetPerson: staffList.find((s) => s.id === top.staffId)!.name })}
          />
      ) : null}

      {top?.kind === "duty"
        ? (() => {
            const d = dutyOf(top.staffId, top.dutyId)
            const staff = staffList.find((s) => s.id === top.staffId)!
            if (!d) return null
            const others = staff.duties
              .filter((x) => x.id !== d.id && x.status !== "ended" && !endedDutyIds.has(x.id))
              .map((x) => `${x.scopeLabel}`)
            return (
              <DutyDetailSheet
                open
                duty={d}
                staffName={staff.name}
                currentUseLimit={staff.statusNote}
                otherScopesRetained={others}
                onClose={pop}
                onAdjust={() => push2({ kind: "arrange", staffId: top.staffId, mode: "adjust", presetDuty: d.type, presetScope: d.scopeLabel })}
                onEnded={(id) => {
                  setEndedDutyIds((set) => new Set(set).add(id))
                  pop()
                }}
              />
            )
          })()
        : null}

      {top?.kind === "account" ? (
        <AccountDetailSheet
          accountId={top.accountId}
          endedDutyIds={endedDutyIds}
          onClose={pop}
          onOpenDuty={(d, staffName) => {
            const staff = staffList.find((s) => s.name === staffName)
            if (staff) push2({ kind: "duty", staffId: staff.id, dutyId: d.id })
          }}
        />
      ) : null}

      {top?.kind === "arrange" ? (
        <DutyArrangeSheet
          open
          mode={top.mode}
          staff={top.staffId ? staffList.find((s) => s.id === top.staffId) : null}
          lockStaff={!!top.staffId}
          presetDuty={top.presetDuty}
          presetScope={top.presetScope}
          presetPerson={top.presetPerson}
          onClose={pop}
        />
      ) : null}

      {top?.kind === "invite" ? <InviteSheet open onClose={pop} presetPerson={top.presetPerson} /> : null}

      <StaffCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onArrange={(name) => push2({ kind: "arrange", mode: "arrange", presetPerson: name })}
        onInvite={(name) => push2({ kind: "invite", presetPerson: name })}
      />
    </div>
  )
}

function StaffRow({
  staff,
  endedDutyIds,
  onOpen,
  onOpenAccount,
  onInvite,
}: {
  staff: StaffProfile
  endedDutyIds: Set<string>
  onOpen: () => void
  onOpenAccount: (accountId: string) => void
  onInvite: () => void
}) {
  const active = staff.duties.filter((d) => d.status !== "ended" && !endedDutyIds.has(d.id))
  const shown = active.slice(0, 3)
  const extra = active.length - shown.length
  const acc = accountByStaffId(staff.id)

  return (
    <tr className="border-t border-border align-top">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
            {staff.name.slice(-2)}
          </span>
          <div>
            <button onClick={onOpen} className="font-medium text-foreground hover:text-primary hover:underline">
              {staff.name}
              {staff.isCurrent ? <Badge tone="neutral" className="ml-1.5">本人</Badge> : null}
            </button>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{staff.employeeNo}</span>
              {homepageEligible(staff.id) ? (
                <Link href={`/people/${staff.id}`} className="text-primary hover:underline">
                  主页
                </Link>
              ) : null}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3.5">
        {staff.department || staff.jobTitle ? (
          <div className="leading-tight">
            <p className="text-[13px] text-foreground">{staff.department || "—"}</p>
            <p className="text-xs text-muted-foreground">{staff.jobTitle || "—"}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3.5">
        {active.length ? (
          <div className="space-y-1.5">
            {shown.map((d) => (
              <DutyLine key={d.id} duty={d} />
            ))}
            {extra > 0 ? (
              <button onClick={onOpen} className="text-xs font-medium text-primary hover:underline">
                另 {extra} 项…
              </button>
            ) : null}
          </div>
        ) : (
          <div className="text-[13px] text-muted-foreground">
            暂未安排职责
            {staff.systemRoles.length ? (
              <span className="mt-0.5 block text-xs text-muted-foreground/70">
                已有{staff.systemRoles.map((r) => SYSTEM_ROLE_LABEL[r]).join("、")}资格
              </span>
            ) : null}
          </div>
        )}
      </td>
      <td className="px-3 py-3.5">
        <Badge tone={STAFF_STATUS_TONE[staff.status]}>{STAFF_STATUS_LABEL[staff.status]}</Badge>
      </td>
      <td className="px-5 py-3.5">
        {staff.accountStatus === "none" ? (
          <button
            onClick={onInvite}
            className="text-xs font-medium text-primary hover:underline"
          >
            未开通 · 开通账号
          </button>
        ) : (
          <button
            onClick={() => acc && onOpenAccount(acc.id)}
            className="text-left text-xs hover:underline"
          >
            <span className="block font-mono text-muted-foreground">{staff.username}</span>
            <span className="text-muted-foreground/80">{ACCOUNT_STATUS_LABEL[staff.accountStatus]}</span>
          </button>
        )}
      </td>
    </tr>
  )
}
