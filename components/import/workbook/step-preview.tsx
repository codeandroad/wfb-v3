"use client"

import { Badge, Card, Segmented } from "@/components/kit"
import { Button } from "@/components/ui/button"
import type { ParsedFile } from "@/lib/import/parse"
import { SHEET, sheetTitle, type SheetCode } from "@/lib/import/schema"
import { displayValue, type Plan, type RowResult } from "@/lib/import/validate"
import { buildCorrectedCopy, buildReportBytes, downloadBytes } from "@/lib/import/workbook-out"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { LevelBadge, Notice, RowStatusBadge, Stat } from "./shared"

type Filter = "all" | "todo" | "ok" | "notice"

export function StepPreview({
  file, plan, activeSheet, setActiveSheet, openRow, setValue, onBack, onNext,
}: {
  file: ParsedFile
  plan: Plan
  activeSheet: SheetCode | null
  setActiveSheet: (c: SheetCode) => void
  openRow: (k: string) => void
  setValue: (rowKey: string, field: string, v: string | undefined) => void
  onBack: () => void
  onNext: () => void
}) {
  const [filter, setFilter] = useState<Filter>("all")
  const sheets = plan.sheets.filter((s) => s.state === "import")
  const current = sheets.find((s) => s.code === activeSheet) ?? sheets[0]
  const t = plan.totals
  const stamp = file.fileName.replace(/\.(xlsx|csv)$/i, "")

  if (!current) {
    return (
      <Card className="p-5">
        <Notice tone="warning">当前没有选择导入的工作表。</Notice>
        <Button variant="outline" className="mt-3" onClick={onBack}>
          返回内容选择
        </Button>
      </Card>
    )
  }

  const rows = current.rows.filter((r) => {
    if (filter === "todo") return r.status === "block"
    if (filter === "ok") return r.status !== "block" && r.status !== "excluded"
    if (filter === "notice") return r.status === "warn" || r.status === "pending"
    return true
  })

  const autoable = current.rows.filter((r) => r.status !== "excluded" && r.issues.some((i) => i.field === "no" && i.fixes.includes("auto-no")))
  const cols = keyColumns(current.code)

  return (
    <div className="flex flex-col gap-4">
      {file.source === "sample" ? <Notice tone="warning">当前为示例文件「{file.fileName}」，以下数值全部来自该示例的解析结果。</Notice> : null}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="拟新增对象" value={t.newObjects} hint="人员、班级、部门等" />
        <Stat label="拟新增关系" value={t.newRelations} hint="名单、任命、家长关系等" />
        <Stat label="复用 / 引用已有" value={t.reuse + t.externalRefs} tone="info" hint={`复用 ${t.reuse} 行 · 外部引用 ${t.externalRefs} 个`} />
        <Stat label="阻断" value={t.block} tone={t.block ? "danger" : "success"} hint="须处理后才能确认" />
        <Stat label="待后端核验" value={t.pending} tone="info" hint="文件内无法判断" />
        <Stat label="提醒" value={t.warn} tone={t.warn ? "warning" : undefined} hint={`已排除 ${t.excluded} 行`} />
      </div>

      {plan.fileIssues.map((i) => (
        <Notice key={i.id} tone="warning" title={i.title}>
          {i.detail}
        </Notice>
      ))}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <nav aria-label="工作表" className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          {sheets.map((s) => {
            const err = s.rows.reduce((n, r) => n + r.issues.filter((i) => i.level === "block").length, 0) + s.sheetIssues.filter((i) => i.level === "block").length
            return (
              <button
                key={s.code}
                onClick={() => setActiveSheet(s.code)}
                className={cn(
                  "flex items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                  s.code === current.code ? "bg-accent font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span>{sheetTitle(s.code)}</span>
                {err ? <Badge tone="danger">{err}</Badge> : <span className="text-xs tabular-nums">{s.rows.length}</span>}
              </button>
            )
          })}
        </nav>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div>
              <h2 className="text-[15px] font-semibold">{sheetTitle(current.code)}</h2>
              <p className="text-xs text-muted-foreground">
                文件表名「{current.parsed.rawName}」· 表头第 {current.parsed.headerLine} 行 · {current.rows.length} 行
              </p>
            </div>
            <Segmented<Filter>
              size="sm"
              ariaLabel="筛选"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: `全部 ${current.rows.length}` },
                { value: "todo", label: `待处理 ${current.counts.block}` },
                { value: "ok", label: `可处理 ${current.counts.ok + current.counts.pending + current.counts.warn}` },
                { value: "notice", label: `提醒 ${current.counts.warn + current.counts.pending}` },
              ]}
            />
          </div>

          <div className="flex flex-col gap-3 p-5">
            {current.sheetIssues.map((i) => (
              <Notice key={i.id} tone={i.level === "block" ? "danger" : "warning"} title={i.title}>
                {i.detail}
              </Notice>
            ))}
            {autoable.length ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-[13px]">
                <span>
                  {autoable.length} 行编号格式/年月有误，可批量改为自动编号（只修编号，不处理其他错误，不适用于已占用或本文件重复的编号）。
                </span>
                <Button size="sm" variant="outline" onClick={() => autoable.forEach((r) => setValue(r.key, "no", ""))}>
                  将这 {autoable.length} 行设为自动编号
                </Button>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">源行</th>
                    <th className="px-3 py-2 text-left font-medium">导入标识 / 名称</th>
                    <th className="px-3 py-2 text-left font-medium">关键引用</th>
                    <th className="px-3 py-2 text-left font-medium">拟操作</th>
                    <th className="px-3 py-2 text-left font-medium">状态</th>
                    <th className="px-3 py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                        当前筛选下没有行。
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => <PreviewRow key={r.key} row={r} cols={cols} onOpen={() => openRow(r.key)} />)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBack}>
            返回内容选择
          </Button>
          <Button variant="outline" onClick={() => downloadBytes(buildCorrectedCopy(file, plan), `${stamp}_修正副本.xlsx`)}>
            下载修正副本
          </Button>
          <Button variant="outline" onClick={() => downloadBytes(buildReportBytes(file, plan), `${stamp}_校验报告.xlsx`)}>
            下载校验报告
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {t.block ? <span className="text-[13px] text-[#9a2b22]">还有 {t.block} 个阻断</span> : <span className="text-[13px] text-[#256a49]">文件内校验通过</span>}
          <Button onClick={onNext}>下一步：确认导入</Button>
        </div>
      </div>
    </div>
  )
}

function keyColumns(code: SheetCode) {
  return SHEET[code].fields.filter((f) => f.kind === "ref").slice(0, 3)
}

function PreviewRow({ row, cols, onOpen }: { row: RowResult; cols: ReturnType<typeof keyColumns>; onOpen: () => void }) {
  const top = row.issues.find((i) => i.level === "block") ?? row.issues.find((i) => i.level === "warn") ?? row.issues.find((i) => i.level === "pending")
  return (
    <tr id={`row-${row.key}`} className={cn("border-t border-border align-top", row.status === "excluded" && "opacity-60", row.status === "block" && "bg-[#fbeeec]/50")}>
      <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">{row.line}</td>
      <td className="px-3 py-2.5">
        <span className="font-mono text-xs">{row.values.id ?? "—"}</span>
        {row.values.name ? <span className="block">{row.values.name}</span> : null}
        {row.edited.length ? <Badge tone="primary" className="mt-1">已修正 {row.edited.filter((e) => !e.startsWith("@")).length || ""}</Badge> : null}
      </td>
      <td className="px-3 py-2.5 text-xs">
        {cols.length === 0 ? <span className="text-muted-foreground">—</span> : null}
        {cols.map((c) =>
          row.values[c.key] ? (
            <span key={c.key} className="block">
              <span className="text-muted-foreground">{c.label.replace("引用", "")}：</span>
              <span className="font-mono">{displayValue(row.values[c.key], c.ref)}</span>
            </span>
          ) : null,
        )}
      </td>
      <td className="px-3 py-2.5 text-xs">{row.action}</td>
      <td className="px-3 py-2.5">
        <div className="flex flex-col items-start gap-1">
          <RowStatusBadge status={row.status} />
          {top ? (
            <span className="flex items-center gap-1 text-xs">
              <LevelBadge level={top.level} />
              <span>
                {top.fieldLabel ? `${top.fieldLabel}：` : ""}
                {top.title}
              </span>
            </span>
          ) : null}
          {row.issues.length > 1 ? <span className="text-[11px] text-muted-foreground">共 {row.issues.length} 项</span> : null}
        </div>
      </td>
      <td className="px-3 py-2.5 text-right">
        <Button size="sm" variant={row.status === "block" ? "default" : "outline"} className="h-7 text-xs" onClick={onOpen}>
          {row.status === "block" ? "处理" : "查看"}
        </Button>
      </td>
    </tr>
  )
}
