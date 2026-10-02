"use client"

import { Badge } from "@/components/kit"
import { cn } from "@/lib/utils"
import {
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_TONE,
  DUTY_BY_KEY,
  DUTY_STATUS_LABEL,
  DUTY_STATUS_TONE,
  SYSTEM_ROLE_LABEL,
  WORK_MODE_LABEL,
  dutyCanDo,
  dutyCannotDo,
  type AccountStatus,
  type DutyRecord,
  type SystemRoleCode,
} from "@/lib/demo/staff"
import { Check, ChevronRight, Minus } from "lucide-react"
import { useState, type ReactNode } from "react"

export const ROLE_TONE: Record<SystemRoleCode, "warning" | "primary" | "info" | "success"> = {
  SCHOOL_ADMIN: "warning",
  SUBJECT_TEACHER: "primary",
  HOMEROOM_TEACHER: "info",
  TEACHING_MANAGER: "success",
}

export function RoleBadge({ role }: { role: SystemRoleCode }) {
  return <Badge tone={ROLE_TONE[role]}>{SYSTEM_ROLE_LABEL[role]}</Badge>
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return <Badge tone={ACCOUNT_STATUS_TONE[status]}>{ACCOUNT_STATUS_LABEL[status]}</Badge>
}

export function DutyStatusBadge({ duty }: { duty: DutyRecord }) {
  return <Badge tone={DUTY_STATUS_TONE[duty.status]}>{DUTY_STATUS_LABEL[duty.status]}</Badge>
}

export function periodText(d: DutyRecord): string {
  return `${d.start} 起 · ${d.end ? d.end + " 止" : "未设结束日期"}`
}

// 一行职责：职责标签紧邻其负责范围，附状态与工作模式标注
export function DutyLine({ duty, showStatus = true }: { duty: DutyRecord; showStatus?: boolean }) {
  const def = DUTY_BY_KEY[duty.type]
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
      <Badge tone="neutral" className="font-medium">
        {def.label}
      </Badge>
      <span className="text-foreground">{duty.scopeLabel}</span>
      {duty.scopeSub ? <span className="text-muted-foreground">· {duty.scopeSub}</span> : null}
      {duty.workMode !== "rw" ? (
        <span className="text-xs text-muted-foreground">（{WORK_MODE_LABEL[duty.workMode]}）</span>
      ) : null}
      {showStatus && duty.status !== "active" ? <DutyStatusBadge duty={duty} /> : null}
    </div>
  )
}

// 可以办理 / 不包含 对照
export function CanCannotBlock({ duty }: { duty: DutyRecord }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-[#bcdcc8] bg-[#f3f9f5] p-3">
        <p className="mb-1.5 text-[12.5px] font-semibold text-[#256a49]">可以办理</p>
        <ul className="space-y-1">
          {dutyCanDo(duty).map((t) => (
            <li key={t} className="flex items-start gap-1.5 text-[12.5px] text-foreground">
              <Check className="mt-0.5 size-3.5 shrink-0 text-[#2f7d5b]" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="mb-1.5 text-[12.5px] font-semibold text-muted-foreground">不包含</p>
        <ul className="space-y-1">
          {dutyCannotDo(duty).map((t) => (
            <li key={t} className="flex items-start gap-1.5 text-[12.5px] text-muted-foreground">
              <Minus className="mt-0.5 size-3.5 shrink-0" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// 高级依据（默认折叠）：同一职责的多条技术来源在此列出，不在主界面重复渲染
export function AdvancedBasis({ duty }: { duty: DutyRecord }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        查看权限依据 / 高级信息
      </button>
      {open ? (
        <div className="border-t border-border px-3 py-2.5">
          <p className="mb-2 text-xs text-muted-foreground">
            以下为支撑本项职责的底层角色资格、配置版本与技术来源；同一职责的多条来源在此合并，不在主界面重复成多张卡片。
          </p>
          <div className="space-y-1.5">
            {duty.basis.map((b, i) => (
              <div key={i} className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
                <span className="font-medium text-foreground">{SYSTEM_ROLE_LABEL[b.role]}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {b.config} · {b.source} · {b.assignment}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function InfoNote({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: "neutral" | "warning"
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-[12.5px] leading-relaxed",
        tone === "warning" ? "border-[#e6d4a8] bg-[#fbf7ee] text-[#7a5514]" : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div>{children}</div>
    </div>
  )
}
