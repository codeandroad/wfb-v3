"use client"

import { Badge, Modal, Sheet, Tabs, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  ACCESS_ORIGIN_LABEL,
  STAFF_STATUS_LABEL,
  accountById,
  activeDuties,
  staffById,
  type AccessExplain,
  type DutyRecord,
} from "@/lib/demo/staff"
import { AccountStatusBadge, DutyLine, InfoNote, RoleBadge, periodText } from "./duty-bits"
import { Check, ChevronRight, Monitor, ShieldAlert, X } from "lucide-react"
import { useState } from "react"

interface Props {
  accountId: string
  endedDutyIds: Set<string>
  onClose: () => void
  onOpenDuty?: (duty: DutyRecord, staffName: string) => void
}

export function AccountDetailSheet({ accountId, endedDutyIds, onClose, onOpenDuty }: Props) {
  const { push } = useToast()
  const [tab, setTab] = useState("duties")
  const [rolesOpen, setRolesOpen] = useState(false)
  const [confirm, setConfirm] = useState<null | "disable" | "revoke" | "logout">(null)

  const acc = accountById(accountId)
  if (!acc) return null
  const staff = acc.staffId ? staffById(acc.staffId) : undefined
  const duties = staff ? activeDuties(staff).filter((d) => !endedDutyIds.has(d.id)) : []

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={acc.username}
        desc={acc.staffName ? `关联人员：${acc.staffName}` : "未关联教职工"}
        width="max-w-lg"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <AccountStatusBadge status={acc.status} />
          <Badge tone={acc.accessTone}>访问：{acc.accessSummary}</Badge>
          {staff ? <Badge tone="neutral">人员：{STAFF_STATUS_LABEL[staff.status]}</Badge> : null}
          <span className="text-xs text-muted-foreground">最近登录 {acc.lastLogin ?? "未提供"}</span>
        </div>

        <div className="mb-4 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          本校访问来源：<span className="font-medium text-foreground">{ACCESS_ORIGIN_LABEL[acc.origin]}</span>
          {" · "}账号状态决定能否登录，访问状态决定登录后当前实际可做什么，二者独立。
        </div>

        {acc.note ? <div className="mb-4"><InfoNote>{acc.note}</InfoNote></div> : null}

        <div className="mb-4">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "duties", label: "职责" },
              { value: "access", label: "访问说明" },
              { value: "security", label: "安全" },
              { value: "history", label: "历史" },
            ]}
          />
        </div>

        {tab === "duties" ? (
          <div className="space-y-4">
            <p className="text-[12.5px] text-muted-foreground">按业务职责汇总，不按技术来源重复账号。</p>
            {staff ? (
              duties.length ? (
                duties.map((d) => (
                  <div key={d.id} className="rounded-xl border border-border p-3.5">
                    <DutyLine duty={d} />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{periodText(d)}</span>
                      <Button size="xs" variant="outline" onClick={() => onOpenDuty?.(d, staff.name)}>
                        查看详情
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <InfoNote>关联人员当前无进行中的职责；如有资格未任教，请在教职工列表查看。</InfoNote>
              )
            ) : (
              <InfoNote>该账号未关联教职工档案，没有依赖员工职责的任命；其访问以“{ACCESS_ORIGIN_LABEL[acc.origin]}”为准，见“访问说明”。</InfoNote>
            )}

            <div className="rounded-lg border border-border">
              <button
                onClick={() => setRolesOpen((o) => !o)}
                aria-expanded={rolesOpen}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className={rolesOpen ? "size-3.5 rotate-90 transition-transform" : "size-3.5 transition-transform"} />
                系统角色 / 配置（高级信息）
              </button>
              {rolesOpen ? (
                <div className="border-t border-border px-3 py-2.5">
                  {acc.systemRoles.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {acc.systemRoles.map((r) => (
                        <RoleBadge key={r} role={r} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">当前无系统角色资格（历史保留）。</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    系统角色是账号的底层资格；缺少某项时此处显示缺什么，不提供一键全量补权。
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "access" ? (
          <div className="space-y-4">
            <p className="text-[12.5px] text-muted-foreground">
              访问由多项条件同时成立决定：员工资格、业务任命、账号关联、本校访问来源、账号状态。任一不成立即不可执行，此处显示缺哪一项。
            </p>
            {acc.accessExplains?.length ? (
              acc.accessExplains.map((ex) => <AccessExplainCard key={ex.action} ex={ex} />)
            ) : (
              <InfoNote>
                {acc.note ?? "该账号暂无具体访问示例。访问状态：" + acc.accessSummary + "。"}
              </InfoNote>
            )}
          </div>
        ) : null}

        {tab === "security" ? (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[13px] font-semibold">登录设备</p>
              {acc.sessions.length ? (
                <div className="space-y-2">
                  {acc.sessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                      <Monitor className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1 text-[12.5px]">
                        <p className="font-medium">
                          {s.device}
                          {s.current ? <Badge tone="success" className="ml-1.5">当前设备</Badge> : null}
                        </p>
                        <p className="text-muted-foreground">
                          {s.location} · {s.lastActive}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">当前无活动登录设备。</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-[13px] font-semibold">账号安全操作</p>
              <p className="mb-2.5 text-xs text-muted-foreground">
                各操作相互独立，点击后进入确认；账号安全与结束职责刻意分离。
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setConfirm("logout")}>
                  退出全部设备
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirm("disable")}>
                  {acc.status === "disabled" ? "恢复账号" : "停用账号"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm("revoke")}>
                  注销账号
                </Button>
              </div>
            </div>

            <InfoNote tone="warning" icon={<ShieldAlert className="size-4" />}>
              停用账号不是结束岗位；注销账号会保留员工与历史记录。此处不索取真实密码，也不改动真实会话。
            </InfoNote>
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="space-y-2.5">
            {acc.history.map((h, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[13px]">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span className="font-mono text-xs text-muted-foreground">{h.date}</span>
                <span>{h.text}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Sheet>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm === "logout"
            ? "退出该账号全部设备？"
            : confirm === "disable"
              ? acc.status === "disabled"
                ? "恢复该账号？"
                : "停用该账号？"
              : "注销该账号？"
        }
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
              取消
            </Button>
            <Button
              variant={confirm === "revoke" ? "destructive" : "default"}
              size="sm"
              onClick={() => {
                push("已执行该账号安全操作（示例，未改动真实系统）")
                setConfirm(null)
              }}
            >
              确认
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted-foreground">
          {confirm === "revoke"
            ? "注销后保留员工档案与历史记录；账号将标记为已注销。此为账号安全操作，不结束其业务职责。"
            : confirm === "disable"
              ? "停用 / 恢复仅影响登录使用，不改变已登记的职责与任命。"
              : "退出全部设备将使该账号现有会话失效，需重新登录。"}
        </p>
      </Modal>
    </>
  )
}

function AccessExplainCard({ ex }: { ex: AccessExplain }) {
  return (
    <div className="rounded-xl border border-border p-3.5">
      <p className="text-[13px] font-medium text-foreground">{ex.action}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">范围：{ex.scope}</p>
      <div className="mt-3 space-y-1.5">
        {ex.conditions.map((c) => (
          <div key={c.label} className="flex items-start gap-2 text-[12.5px]">
            <span
              className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full ${
                c.ok ? "bg-[#e7f4ea] text-[#1f7a3d]" : "bg-[#fbe4e4] text-[#a13333]"
              }`}
              aria-hidden="true"
            >
              {c.ok ? <Check className="size-3" /> : <X className="size-3" />}
            </span>
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{c.label}：</span>
              {c.value}
            </span>
          </div>
        ))}
      </div>
      <div
        className={`mt-3 rounded-lg px-3 py-2 text-[12.5px] font-medium ${
          ex.conclusionOk ? "bg-[#e7f4ea] text-[#1f7a3d]" : "bg-[#fbe4e4] text-[#a13333]"
        }`}
      >
        {ex.conclusion}
      </div>
    </div>
  )
}
