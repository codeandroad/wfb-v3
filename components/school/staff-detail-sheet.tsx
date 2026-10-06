"use client"

import { Badge, LinkButton, Sheet, Tabs, useToast } from "@/components/kit"
import { homepageEligible } from "@/lib/profile/store"
import { Button } from "@/components/ui/button"
import {
  DUTY_BY_KEY,
  STAFF_STATUS_LABEL,
  STAFF_STATUS_TONE,
  type DutyRecord,
  type StaffProfile,
} from "@/lib/demo/staff"
import { AccountStatusBadge, DutyLine, InfoNote, RoleBadge, periodText } from "./duty-bits"
import {
  CalendarCheck,
  CalendarOff,
  House,
  KeyRound,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Plus,
  SlidersHorizontal,
  UserCog,
} from "lucide-react"
import { StaffActionPanel, type StaffAction } from "./staff-actions"
import { useState } from "react"
import { FormalNoBadge } from "./person-no-field"
import { useStaffPermission } from "@/lib/school/staff-store"
import { personNoMonth, yyyymmOf } from "@/lib/school/person-no"

interface Props {
  staff: StaffProfile
  endedDutyIds: Set<string>
  onClose: () => void
  onOpenDuty: (duty: DutyRecord) => void
  onArrange: () => void
  onOpenAccount: (accountId: string) => void
  onInvite?: () => void
  onOpenSettings?: () => void
}

export function StaffDetailSheet({ staff, endedDutyIds, onClose, onOpenDuty, onArrange, onOpenAccount, onInvite, onOpenSettings }: Props) {
  const { push } = useToast()
  const [tab, setTab] = useState("profile")
  const [action, setAction] = useState<StaffAction | null>(null)
  const canManage = useStaffPermission()
  const numberMonth = personNoMonth(staff.employeeNo, "E")
  const monthMismatch = numberMonth && staff.joinedAt && yyyymmOf(staff.joinedAt) !== numberMonth

  const duties = staff.duties.map((d) =>
    endedDutyIds.has(d.id) || staff.status === "left" ? { ...d, status: "ended" as const } : d,
  )
  const currentDuties = duties.filter((d) => d.status !== "ended")
  const endedDuties = duties.filter((d) => d.status === "ended")

  return (
    <Sheet
      open
      onClose={onClose}
      title={staff.name}
      desc={`${staff.employeeNo || "待编号"} · ${[staff.department, staff.jobTitle].filter(Boolean).join("／") || "未填写部门 / 职务"}`}
      width="max-w-xl"
      footer={
        action ? undefined : (
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" disabled={!canManage} onClick={() => canManage && setAction("edit")}>
              <Pencil className="size-3.5" />
              编辑资料
            </Button>
            {staff.status === "active" ? (
              <Button variant="ghost" size="sm" onClick={() => setAction("leave")}>
                <CalendarOff className="size-3.5" />
                请假
              </Button>
            ) : null}
            {staff.status === "leave" ? (
              <Button variant="ghost" size="sm" onClick={() => setAction("return")}>
                <CalendarCheck className="size-3.5" />
                销假
              </Button>
            ) : null}
            {homepageEligible(staff.id) ? (
              <LinkButton href={`/people/${staff.id}`} variant="ghost" size="sm">
                <House className="size-3.5" />
                教师主页
              </LinkButton>
            ) : null}
            {onOpenSettings ? (
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                <SlidersHorizontal className="size-3.5" />
                显示设置
              </Button>
            ) : null}
          </div>
          {staff.status !== "left" ? (
            <Button size="sm" onClick={onArrange}>
              <Plus className="size-3.5" />
              安排职责
            </Button>
          ) : null}
        </div>
        )
      }
    >
      {action ? (
        <StaffActionPanel
          staff={staff}
          action={action}
          onCancel={() => setAction(null)}
          onDone={(m) => {
            setAction(null)
            push(m)
          }}
        />
      ) : (
      <>
      {/* 头部摘要 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={STAFF_STATUS_TONE[staff.status]}>{STAFF_STATUS_LABEL[staff.status]}</Badge>
        {staff.accountStatus === "none" ? (
          <button
            onClick={onInvite}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <KeyRound className="size-3" />
            账号未开通 · 开通账号
          </button>
        ) : (
          <button
            onClick={() => onOpenAccount(`acc-${staff.id.replace("u-", "")}`)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <span className="font-mono text-muted-foreground">{staff.username}</span>
            <AccountStatusBadge status={staff.accountStatus} />
            查看账号
          </button>
        )}
      </div>

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "profile", label: "资料" },
            { value: "duties", label: `职责 · ${currentDuties.length}` },
            { value: "history", label: "任职历史" },
          ]}
        />
      </div>

      {tab === "profile" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="col-span-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">员工编号</span>
              <span className="font-mono text-[13px] font-semibold tracking-wide">{staff.employeeNo || "待编号"}</span>
              {staff.employeeNo ? <FormalNoBadge /> : null}
              <Button type="button" size="xs" variant="outline" className="ml-auto" disabled={!canManage} onClick={() => canManage && setAction("number")}>
                {staff.employeeNo ? "修改 / 清空" : "设置工号"}
              </Button>
              <span className="basis-full text-xs text-muted-foreground/70">
                普通资料编辑不会改号；授权人员可通过明确的设置、修改或清空操作维护，历史号码不回收。
              </span>
            </div>
            <Meta label="部门" value={staff.department || "未填写"} muted={!staff.department} />
            <Meta label="职务" value={staff.jobTitle || "未填写"} muted={!staff.jobTitle} />
            <Meta label="英文名／常用名" value={staff.englishName || "未填写"} muted={!staff.englishName} />
            <Meta label="首次入职年月" value={staff.joinedAt?.slice(0, 7) ?? "未填写"} muted={!staff.joinedAt} />
            <Meta label="性别" value={staff.gender} />
            {canManage ? <Meta label="学历" value={staff.educationLevel || "未填写"} muted={!staff.educationLevel} /> : null}
            <Meta label="在职状态" value={STAFF_STATUS_LABEL[staff.status]} />
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-semibold">联系方式</p>
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Mail className="size-4" />
              {staff.email}
              <span className="text-xs text-muted-foreground/60">（邮箱）</span>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Phone className="size-4" />
              {staff.phone}
            </div>
          </div>

          {monthMismatch ? <p className="text-xs text-muted-foreground">工号年月与首次入职年月不一致；资料已保留，工号不会自动变化。</p> : null}
          {canManage ? <MoreInfo staff={staff} /> : null}

          <div>
            <p className="mb-2 text-[13px] font-semibold">任职资格</p>
            {staff.systemRoles.length ? (
              <div className="flex flex-wrap gap-1.5">
                {staff.systemRoles.map((r) => (
                  <RoleBadge key={r} role={r} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">当前无任职资格。</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              人事侧的合法资格，是安排职责的前提；本身不等于已有实际负责对象，也不等于账号已开通。
            </p>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold">
              关联账号角色<span className="ml-1 text-xs font-normal text-muted-foreground">（只读摘要）</span>
            </p>
            {staff.accountStatus === "none" ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-[12.5px] text-muted-foreground">
                账号未开通，暂无关联账号角色。人事资格不会自动成为已生效的账号角色；需通过开通账号并授权后才产生。
              </p>
            ) : staff.systemRoles.length ? (
              <div className="flex flex-wrap gap-1.5">
                {staff.systemRoles.map((r) => (
                  <RoleBadge key={r} role={r} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">该账号未授予系统角色（仅账号自服务）。</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              角色授予是明确的关联账号授权流程，不随人事资料保存变化。
            </p>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold">关联账号</p>
            {staff.accountStatus === "none" ? (
              <div className="space-y-2">
                <InfoNote>
                  该人员账号未开通：职责 / 任命可先登记为目标，但在开通并激活账号前不能登录使用，也不产生任何有效访问。
                </InfoNote>
                <div className="rounded-lg border border-dashed border-border p-3 text-[13px]">
                  <p className="font-medium text-foreground">示例：无账号也可先安排目标</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    可先为其登记“辅助班主任 · 高一2班”等任命；开通账号时按仍有效的批准安排核验并办理必要访问授权，不自动扩大范围。
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="xs" variant="outline" onClick={onArrange}>
                      先安排职责（目标）
                    </Button>
                    {onInvite ? (
                      <Button size="xs" onClick={onInvite}>
                        开通账号
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-[13px]">
                <UserCog className="size-4 text-muted-foreground" />
                <span className="font-mono">{staff.username}</span>
                <AccountStatusBadge status={staff.accountStatus} />
                <button
                  onClick={() => onOpenAccount(`acc-${staff.id.replace("u-", "")}`)}
                  className="ml-auto text-xs font-medium text-primary hover:underline"
                >
                  查看账号详情
                </button>
              </div>
            )}
          </div>

          {staff.statusNote ? <InfoNote tone="warning">{staff.statusNote}</InfoNote> : null}
        </div>
      ) : null}

      {tab === "duties" ? (
        <div className="space-y-3">
          {staff.qualificationNote ? <InfoNote>{staff.qualificationNote}</InfoNote> : null}

          {currentDuties.length ? (
            currentDuties.map((d) => <DutyCard key={d.id} duty={d} onOpen={() => onOpenDuty(d)} />)
          ) : (
            <p className="text-[13px] text-muted-foreground">当前无进行中的职责。</p>
          )}

          {endedDuties.length ? (
            <div className="pt-2">
              <p className="mb-2 text-xs font-medium text-muted-foreground">已结束</p>
              {endedDuties.map((d) => (
                <DutyCard key={d.id} duty={d} onOpen={() => onOpenDuty(d)} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="space-y-2.5">
          {staff.history.map((h, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[13px]">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span className="font-mono text-xs text-muted-foreground">{h.date}</span>
              <span>{h.text}</span>
            </div>
          ))}
          <InfoNote>请假不是离职，停用账号不是结束岗位，返聘不表示旧职责自动恢复。</InfoNote>
          {staff.status !== "left" ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div><p className="text-[13px] font-medium">任职管理</p><p className="text-xs text-muted-foreground">低频人事操作；进入入口不会直接办理离职。</p></div>
              <Button variant="outline" size="sm" disabled={!canManage} onClick={() => canManage && staff.status !== "left" && setAction("resign")}>
                <LogOut className="size-3.5" />办理离职
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      </>
      )}
    </Sheet>
  )
}

function DutyCard({ duty, onOpen }: { duty: DutyRecord; onOpen: () => void }) {
  const def = DUTY_BY_KEY[duty.type]
  return (
    <div className="rounded-xl border border-border p-3.5">
      <DutyLine duty={duty} />
      <p className="mt-1.5 text-[12.5px] text-muted-foreground">{def.blurb}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{periodText(duty)}</span>
        <Button size="xs" variant="outline" onClick={onOpen}>
          查看详情
        </Button>
      </div>
    </div>
  )
}

function Meta({ label, value, mono, muted }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          mono
            ? "mt-0.5 font-mono text-[12.5px]"
            : muted
              ? "mt-0.5 text-[13px] text-muted-foreground"
              : "mt-0.5 text-[13px]"
        }
      >
        {value}
      </p>
    </div>
  )
}

function MoreInfo({ staff }: { staff: StaffProfile }) {
  const rows: { label: string; value: string }[] = []
  if (staff.firstWorkAt) rows.push({ label: "首次参加工作年月", value: staff.firstWorkAt })
  if (staff.wechat) rows.push({ label: "微信号", value: staff.wechat })
  if (staff.interests?.length) rows.push({ label: "兴趣爱好", value: staff.interests.join("、") })
  const hasBackground = !!staff.educationExperiences?.length || !!staff.workExperiences?.length
  if (!rows.length && !hasBackground) return null
  return (
    <div className="space-y-3">
      <p className="text-[13px] font-semibold">更多资料</p>
      {rows.length ? <div className="grid grid-cols-2 gap-3 text-[13px]">{rows.map((row) => <Meta key={row.label} label={row.label} value={row.value} />)}</div> : null}
      {staff.educationExperiences?.length ? <div><p className="text-xs font-medium text-muted-foreground">教育经历</p><div className="mt-1 space-y-1">{staff.educationExperiences.map((item) => <p key={item.id} className="text-[13px]">{[item.school, item.major, item.graduation].filter(Boolean).join(" · ")}</p>)}</div></div> : null}
      {staff.workExperiences?.length ? <div><p className="text-xs font-medium text-muted-foreground">过往工作经历</p><div className="mt-1 space-y-1">{staff.workExperiences.map((item) => <p key={item.id} className="text-[13px]">{[item.organization, item.role, [item.start, item.end].filter(Boolean).join("—")].filter(Boolean).join(" · ")}</p>)}</div></div> : null}
      <p className="text-xs text-muted-foreground">背景资料按人员资料权限读取，默认不进入教师主页、普通名单或身份名片。</p>
    </div>
  )
}
