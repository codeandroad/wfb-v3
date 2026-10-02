"use client"

import { Badge, Card, CardHeader, Select } from "@/components/kit"
import { Button } from "@/components/ui/button"
import type { ParsedFile } from "@/lib/import/parse"
import { dependsOn, GROUPS, SHEET, sheetTitle, type GroupId, type SheetCode } from "@/lib/import/schema"
import { dependencyImpact, type Plan, type SheetState } from "@/lib/import/validate"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Notice } from "./shared"

const STATE_LABEL: Record<SheetState, string> = { import: "本批导入", reference: "改为引用已有", skip: "不导入" }

export function StepContent({
  file, plan, sheetState, setSheetState, onBack, onNext,
}: {
  file: ParsedFile
  plan: Plan
  sheetState: Partial<Record<SheetCode, SheetState>>
  setSheetState: (c: SheetCode, s: SheetState) => void
  onBack: () => void
  onNext: () => void
}) {
  const [group, setGroup] = useState<GroupId | "all">("all")
  const present = plan.sheets
  const groups = GROUPS.filter((g) => g.id !== "meta" && present.some((s) => s.def.group === g.id))
  const shown = present.filter((s) => group === "all" || s.def.group === group)

  const impacts = present
    .filter((s) => (sheetState[s.code] ?? "skip") !== "import" && !s.parsed.empty)
    .map((s) => ({ code: s.code, state: sheetState[s.code] ?? "skip", impact: dependencyImpact(plan, s.code).filter((i) => sheetState[i.sheet] === "import") }))
    .filter((x) => x.impact.length)

  const tc = present.find((s) => s.code === "19")
  const courseEmpty = tc?.rows.filter((r) => !r.values.course).length ?? 0
  const courseMissing = tc?.rows.filter((r) => r.issues.some((i) => i.field === "course" && i.level === "block")).length ?? 0

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <nav aria-label="数据分组" className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
        {[{ id: "all" as const, label: "全部工作表" }, ...groups].map((g) => {
          const n = g.id === "all" ? present.length : present.filter((s) => s.def.group === g.id).length
          return (
            <button
              key={g.id}
              onClick={() => setGroup(g.id)}
              className={cn(
                "flex items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                group === g.id ? "bg-accent font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {g.label}
              <span className="tabular-nums text-xs">{n}</span>
            </button>
          )
        })}
      </nav>

      <Card>
        <CardHeader title="内容选择与依赖" desc={`来自「${file.fileName}」。本文件内的引用实际检查；目标学校已有对象保持待核验。`} />
        <div className="flex flex-col gap-4 p-5">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">工作表</th>
                  <th className="px-3 py-2 text-left font-medium">记录数</th>
                  <th className="px-3 py-2 text-left font-medium">处理方式</th>
                  <th className="px-3 py-2 text-left font-medium">依赖</th>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const st = sheetState[s.code] ?? "skip"
                  const deps = dependsOn(s.code)
                  return (
                    <tr key={s.code} className="border-t border-border align-top">
                      <td className="px-3 py-2.5">
                        <span className="font-medium">{sheetTitle(s.code)}</span>
                        <span className="block text-xs text-muted-foreground">{SHEET[s.code].guard}</span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{s.parsed.rows.length}</td>
                      <td className="px-3 py-2.5">
                        <Select
                          aria-label={`${sheetTitle(s.code)} 处理方式`}
                          value={st}
                          disabled={s.parsed.empty}
                          onChange={(e) => setSheetState(s.code, e.target.value as SheetState)}
                          className="h-8 w-36 py-1 text-[13px]"
                        >
                          {(["import", "reference", "skip"] as SheetState[]).map((v) => (
                            <option key={v} value={v}>
                              {STATE_LABEL[v]}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {deps.length === 0 ? <span className="text-xs text-muted-foreground">无</span> : null}
                          {deps.map((d) => {
                            const ds = plan.sheets.find((x) => x.code === d)
                            const dst = ds ? sheetState[d] ?? "skip" : "absent"
                            const label = dst === "import" ? "本批" : dst === "reference" ? "引用已有" : dst === "skip" ? "已取消" : "引用已有（待匹配）"
                            const tone = dst === "import" ? "success" : dst === "skip" ? "danger" : "info"
                            return (
                              <Badge key={d} tone={tone}>
                                {SHEET[d].name} · {label}
                              </Badge>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {st !== "import" ? (
                          <span className="text-muted-foreground">{STATE_LABEL[st]}</span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {s.counts.block ? <Badge tone="danger">阻断 {s.counts.block}</Badge> : null}
                            {s.counts.pending ? <Badge tone="info">待核验 {s.counts.pending}</Badge> : null}
                            {s.counts.warn ? <Badge tone="warning">提醒 {s.counts.warn}</Badge> : null}
                            {s.counts.ok ? <Badge tone="success">可处理 {s.counts.ok}</Badge> : null}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {impacts.map((x) => (
            <Notice key={x.code} tone={x.state === "skip" ? "danger" : "info"} title={`${sheetTitle(x.code)} ${STATE_LABEL[x.state]}：影响 ${x.impact.map((i) => `${SHEET[i.sheet].name} ${i.rows} 行`).join("、")}`}>
              {x.state === "skip" ? "这些行引用了本表导入标识，将变为阻断。可补选本表、改为引用已有，或在预览中排除相关行；变更后需重新预览。" : "这些引用将改为匹配目标学校已有对象，保持待核验。"}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setSheetState(x.code, "import")}>
                  补选所需表
                </Button>
                {x.state === "skip" ? (
                  <Button size="sm" variant="outline" onClick={() => setSheetState(x.code, "reference")}>
                    改为引用已有
                  </Button>
                ) : null}
              </div>
            </Notice>
          ))}

          {tc && courseEmpty ? (
            <Notice tone="success">19_教学班 中 {courseEmpty} 个教学班课程为空：学科与登记名已填，课程可空，仍合法。</Notice>
          ) : null}
          {courseMissing ? <Notice tone="danger">{courseMissing} 个教学班已填课程但引用不存在：需补入课程或明确选择已有课程，不会自动置空。</Notice> : null}

          <p className="text-xs text-muted-foreground">
            默认新增或明确引用已有；文件中缺少的行不表示删除，也不会更新已有人员。
          </p>
          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack}>
              返回文件
            </Button>
            <Button onClick={onNext} disabled={!present.some((s) => sheetState[s.code] === "import")}>
              生成校验预览
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
