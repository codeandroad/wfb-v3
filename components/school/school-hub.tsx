"use client"

import { cn } from "@/lib/utils"
import { CURRENT_TERM_LABEL } from "@/lib/demo/school"
import {
  Building2,
  CalendarClock,
  GraduationCap,
  KeyRound,
  Layers,
  Library,
  UserRound,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { AccountsPanel } from "./accounts-panel"
import { AdminClassPanel } from "./admin-class-panel"
import { FoundationPanel } from "./foundation-panel"
import { StaffPanel } from "./staff-panel"
import { StudentsPanel } from "./students-panel"
import { TeachingClassPanel } from "./teaching-class-panel"
import { YearTermPanel } from "./year-term-panel"

type TabId =
  | "year"
  | "catalog"
  | "admin"
  | "teaching"
  | "staff"
  | "students"
  | "foundation"
  | "accounts"

interface TabDef {
  id: TabId
  label: string
  icon: ReactNode
}

const TABS: TabDef[] = [
  { id: "year", label: "学年与学期", icon: <CalendarClock className="size-4" /> },
  { id: "admin", label: "行政班", icon: <Building2 className="size-4" /> },
  { id: "teaching", label: "教学班", icon: <Layers className="size-4" /> },
  { id: "staff", label: "教职工管理", icon: <UserRound className="size-4" /> },
  { id: "students", label: "学生资料", icon: <GraduationCap className="size-4" /> },
  { id: "foundation", label: "基础资料", icon: <Library className="size-4" /> },
  { id: "accounts", label: "账号与权限", icon: <KeyRound className="size-4" /> },
]

export function SchoolHub({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<TabId>(() => TABS.find((t) => t.id === initialTab)?.id ?? "year")
  const activeLabel = TABS.find((t) => t.id === tab)?.label ?? "学校管理"

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">学校管理 · {CURRENT_TERM_LABEL}</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight text-foreground">{activeLabel}</h1>
        </div>
        <span
          className="mt-1 shrink-0 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11.5px] text-muted-foreground"
          title="本原型展示改进后的目标流程，不代表当前学校系统已全部实现。"
        >
          目标原型 · 示例数据
        </span>
      </div>

      <div className="thin-scroll -mx-1 mb-6 overflow-x-auto px-1">
        <div role="tablist" aria-label="学校管理分区" className="flex min-w-max gap-1 border-b border-border">
          {TABS.map((t) => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === "year" ? <YearTermPanel /> : null}
      {tab === "admin" ? <AdminClassPanel /> : null}
      {tab === "teaching" ? <TeachingClassPanel /> : null}
      {tab === "staff" ? <StaffPanel /> : null}
      {tab === "students" ? <StudentsPanel /> : null}
      {tab === "foundation" ? <FoundationPanel /> : null}
      {tab === "accounts" ? <AccountsPanel /> : null}
    </div>
  )
}
