"use client"

import { Badge, Card, CardHeader, Dot, EmptyState, PageHeader } from "@/components/kit"
import { ListToolbar, type FilterGroup, type FilterState } from "@/components/school/list-toolbar"
import { WEEK_LABEL, WEEK_RANGE } from "@/lib/demo/data"
import { moduleEnabled } from "@/lib/demo/nav"
import { unitProgress, unitStatus, useDemo } from "@/lib/demo/store"
import { Eye, PlugZap, Search } from "lucide-react"
import { useMemo, useState } from "react"

interface Row {
  className: string
  teacher: string
  unit: string
  status: { key: string; label: string }
  coverage: string
}

export default function ManagementPage() {
  const demo = useDemo()

  if (!moduleEnabled("teaching", demo.config)) {
    return (
      <div>
        <PageHeader title="教学管理" desc="演示配置 B · 教学模块未接入" />
        <EmptyState tone="warning" icon={<PlugZap className="size-7" />} title="教学模块未接入" desc="请在原型演示控制切换回配置 A。" />
      </div>
    )
  }

  // 本人任教班级的真实进度 + 其他班级的合成进度
  const p1 = demo.units.P1
  const s1 = demo.units.S1
  const allRows: Row[] = [
    {
      className: "高一数学A班",
      teacher: "示例林老师",
      unit: "P1",
      status: unitStatus(p1, !!demo.publication?.units.includes("P1")),
      coverage: `${unitProgress(p1).confirmed}/${unitProgress(p1).total}`,
    },
    {
      className: "高一数学A班",
      teacher: "示例林老师",
      unit: "S1",
      status: unitStatus(s1, !!demo.publication?.units.includes("S1")),
      coverage: `${unitProgress(s1).confirmed}/${unitProgress(s1).total}`,
    },
    { className: "高一数学B班", teacher: "示例王老师", unit: "P3", status: { key: "published", label: "已发布" }, coverage: "24/24" },
    { className: "高一物理A班", teacher: "示例赵老师", unit: "AS", status: { key: "pending", label: "待处理" }, coverage: "18/26" },
    { className: "高一物理A班", teacher: "示例陈主任", unit: "S1", status: { key: "not_started", label: "未开始" }, coverage: "0/26" },
  ]

  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})

  const filterGroups: FilterGroup[] = useMemo(() => {
    const uniq = (vals: string[]) => Array.from(new Set(vals))
    return [
      {
        key: "className",
        label: "班级",
        options: uniq(allRows.map((r) => r.className)).map((v) => ({ value: v, label: v })),
      },
      {
        key: "teacher",
        label: "任课教师",
        options: uniq(allRows.map((r) => r.teacher)).map((v) => ({ value: v, label: v })),
      },
      {
        key: "status",
        label: "状态",
        options: uniq(allRows.map((r) => r.status.key)).map((k) => ({
          value: k,
          label: allRows.find((r) => r.status.key === k)!.status.label,
        })),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.units, demo.publication])

  const rows = useMemo(() => {
    const fClass = filters.className ?? []
    const fTeacher = filters.teacher ?? []
    const fStatus = filters.status ?? []
    return allRows.filter((r) => {
      const matchQ = !q || r.className.includes(q) || r.teacher.includes(q) || r.unit.includes(q)
      const matchClass = !fClass.length || fClass.includes(r.className)
      const matchTeacher = !fTeacher.length || fTeacher.includes(r.teacher)
      const matchStatus = !fStatus.length || fStatus.includes(r.status.key)
      return matchQ && matchClass && matchTeacher && matchStatus
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filters, demo.units, demo.publication])

  const publishedCount = allRows.filter((r) => r.status.key === "published").length

  return (
    <div>
      <PageHeader
        title="教学管理"
        desc={`${WEEK_LABEL} · ${WEEK_RANGE} · 高一年级组`}
        actions={
          <Badge tone="info">
            <Eye className="size-3" />
            监督进度 · 不代改
          </Badge>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="本周单元数" value={`${rows.length}`} hint="高一年级组 · 各任课单元" />
        <Stat label="已发布" value={`${publishedCount}`} hint="教师已向家长发布" tone="success" />
        <Stat label="待处理 / 未开始" value={`${rows.length - publishedCount}`} hint="需提醒相关教师" tone="warning" />
      </div>

      <Card>
        <CardHeader title="各班反馈进度" desc="教学管理可查看进度并提醒，但不能替任课教师编辑或发布内容。" />
        <div className="px-5 pb-1 pt-4">
          <ListToolbar
            search={q}
            onSearch={setQ}
            searchPlaceholder="搜索班级、教师或单元"
            groups={filterGroups}
            value={filters}
            onChange={setFilters}
            resultCount={rows.length}
            totalCount={allRows.length}
          />
        </div>
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[13px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">班级</th>
                <th className="px-4 py-2.5 font-medium">任课教师</th>
                <th className="px-4 py-2.5 font-medium">单元</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 font-medium">已确认</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const tone =
                  r.status.key === "published"
                    ? "success"
                    : r.status.key === "pending"
                      ? "warning"
                      : r.status.key === "in_progress"
                        ? "info"
                        : "neutral"
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{r.className}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.teacher}</td>
                    <td className="px-4 py-2.5">{r.unit}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={tone as never}>
                        <Dot tone={tone as never} />
                        {r.status.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.coverage}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState icon={<Search className="size-6" />} title="没有符合条件的记录" desc="调整或清除筛选后重试。" />
          </div>
        ) : null}
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        权限说明：教学管理的“全校/年级范围”只适用于查看进度这一动作，不会扩大到编辑他人反馈或管理账号等其他动作。
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string
  value: string
  hint: string
  tone?: "neutral" | "success" | "warning"
}) {
  const c = tone === "success" ? "text-[#256a49]" : tone === "warning" ? "text-[#8a5a12]" : "text-foreground"
  return (
    <Card className="p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={`mt-1.5 text-[26px] font-semibold leading-none ${c}`}>{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </Card>
  )
}
