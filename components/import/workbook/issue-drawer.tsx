"use client"

import { Badge, Input, Sheet } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { SHEET, sheetTitle, type SheetCode } from "@/lib/import/schema"
import { EXISTING_PREFIX, TARGET_SAMPLE } from "@/lib/import/target-sample"
import { displayValue, MATCH_FIELD, NEW_FIELD, type Fix, type Issue, type Plan, type RowResult, type SheetState } from "@/lib/import/validate"
import { useEffect, useMemo, useState } from "react"
import { LevelBadge, Notice, RowStatusBadge } from "./shared"

export interface DrawerActions {
  setValue: (rowKey: string, field: string, value: string | undefined) => void
  setSheetState: (code: SheetCode, state: SheetState) => void
  exclude: (rowKey: string, on: boolean) => void
}

const FIX_LABEL: Record<Fix, string> = {
  edit: "修正值",
  "auto-no": "设为自动编号",
  "match-existing": "匹配已有对象",
  "add-sheet": "补选所需表",
  "reference-sheet": "改为引用已有",
  "exclude-row": "明确排除本行",
  "confirm-new": "确认确为新身份",
}

export function IssueDrawer({ plan, rowKey, onClose, actions }: { plan: Plan; rowKey: string | null; onClose: () => void; actions: DrawerActions }) {
  const row = useMemo(() => (rowKey ? plan.sheets.flatMap((s) => s.rows).find((r) => r.key === rowKey) ?? null : null), [plan, rowKey])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [matching, setMatching] = useState<{ sheet: SheetCode; field: string | null } | null>(null)

  useEffect(() => {
    setDraft({})
    setMatching(null)
  }, [rowKey])

  if (!row) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  const def = SHEET[row.sheet]
  const dirty = Object.keys(draft).filter((k) => draft[k] !== row.values[k])

  const affected = affectedRelations(plan, row)

  const runFix = (issue: Issue, fix: Fix) => {
    if (fix === "edit") {
      document.getElementById(`fix-${row.key}-${issue.field ?? def.fields[0].key}`)?.focus()
    } else if (fix === "auto-no") {
      actions.setValue(row.key, "no", "")
    } else if (fix === "confirm-new") {
      actions.setValue(row.key, NEW_FIELD, "1")
      if (issue.field === "no") actions.setValue(row.key, "no", "")
    } else if (fix === "exclude-row") {
      actions.exclude(row.key, true)
    } else if (fix === "add-sheet" && issue.refSheet) {
      actions.setSheetState(issue.refSheet, "import")
    } else if (fix === "reference-sheet" && issue.refSheet) {
      actions.setSheetState(issue.refSheet, "reference")
    } else if (fix === "match-existing") {
      const isRowLevel = issue.field === "no" || issue.field === "name" || !issue.refSheet
      setMatching(isRowLevel ? { sheet: row.sheet, field: null } : { sheet: issue.refSheet!, field: issue.field ?? null })
    }
  }

  const candidates = matching ? TARGET_SAMPLE[matching.sheet] ?? [] : []

  return (
    <Sheet
      open
      onClose={onClose}
      width="max-w-xl"
      title={`${sheetTitle(row.sheet)} · 第 ${row.line} 行`}
      desc={
        <span className="flex flex-wrap items-center gap-2">
          <RowStatusBadge status={row.status} />
          <span>{row.action}</span>
        </span>
      }
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">修正只作用于本批预览，原文件不会被改写</span>
          <div className="flex gap-2">
            {row.status === "excluded" ? (
              <Button variant="outline" size="sm" onClick={() => actions.exclude(row.key, false)}>
                恢复本行
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={dirty.length === 0}
              onClick={() => {
                for (const k of dirty) actions.setValue(row.key, k, draft[k])
                setDraft({})
              }}
            >
              应用修正并重新校验{dirty.length ? `（${dirty.length}）` : ""}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <section aria-labelledby="issues-h" className="flex flex-col gap-2">
          <h3 id="issues-h" className="text-[13px] font-semibold">
            问题（{row.issues.length}）
          </h3>
          {row.issues.length === 0 ? (
            <Notice tone="success">本行文件内校验通过，没有待处理问题。</Notice>
          ) : (
            row.issues.map((i) => (
              <div key={i.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <LevelBadge level={i.level} />
                  <span className="text-[13px] font-medium">{i.title}</span>
                  {i.cell ? <span className="font-mono text-[11px] text-muted-foreground">{i.cell}</span> : null}
                  {i.fieldLabel ? <Badge>{i.fieldLabel}</Badge> : null}
                </div>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{i.detail}</p>
                {i.fixes.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {i.fixes.map((f) => (
                      <Button key={f} variant="outline" size="sm" className="h-7 text-xs" onClick={() => runFix(i, f)}>
                        {FIX_LABEL[f]}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </section>

        {matching ? (
          <section aria-labelledby="cand-h" className="flex flex-col gap-2">
            <h3 id="cand-h" className="flex items-center gap-2 text-[13px] font-semibold">
              {sheetTitle(matching.sheet)} 候选 <Badge tone="warning">对照示例数据</Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              候选来自对照示例，不是真实学校数据库。选择后本行保持“待核验”；不会按姓名、电话或邮箱自动合并。
            </p>
            {candidates.length === 0 ? (
              <Notice tone="neutral">对照示例中没有该类对象的候选。可修正值、补选所需表或排除本行。</Notice>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.id}
                  className="flex flex-col items-start gap-0.5 rounded-lg border border-border px-3 py-2 text-left hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => {
                    if (matching.field) actions.setValue(row.key, matching.field, `${EXISTING_PREFIX}${c.id}`)
                    else actions.setValue(row.key, MATCH_FIELD, c.id)
                    setMatching(null)
                  }}
                >
                  <span className="text-[13px] font-medium">{c.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.context}
                    {c.phone ? ` · 电话 ${c.phone}（已脱敏，仅供核对）` : ""}
                  </span>
                </button>
              ))
            )}
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setMatching(null)}>
              取消匹配
            </Button>
          </section>
        ) : null}

        <section aria-labelledby="fields-h" className="flex flex-col gap-2">
          <h3 id="fields-h" className="text-[13px] font-semibold">
            原字段与本批修正
          </h3>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">字段</th>
                  <th className="px-3 py-2 text-left font-medium">原文件</th>
                  <th className="px-3 py-2 text-left font-medium">本批值</th>
                </tr>
              </thead>
              <tbody>
                {def.fields.map((f) => {
                  const orig = row.original[f.key] ?? ""
                  const cur = draft[f.key] ?? row.values[f.key] ?? ""
                  const hasIssue = row.issues.some((i) => i.field === f.key && i.level === "block")
                  const isExisting = cur.startsWith(EXISTING_PREFIX)
                  return (
                    <tr key={f.key} className="border-t border-border align-top">
                      <td className="px-3 py-2">
                        <span className={hasIssue ? "font-medium text-[#9a2b22]" : ""}>
                          {f.label}
                          {f.required ? "*" : ""}
                        </span>
                        {f.ref ? <span className="block text-[11px] text-muted-foreground">引用 {sheetTitle(f.ref)}</span> : null}
                        <span className="block font-mono text-[11px] text-muted-foreground">{row.cols[f.key] ?? "（无此列）"}</span>
                      </td>
                      <td className="break-all px-3 py-2 font-mono text-xs text-muted-foreground">{orig || "—"}</td>
                      <td className="px-3 py-1.5">
                        {isExisting ? (
                          <div className="flex items-center gap-2">
                            <Badge tone="info">{displayValue(cur, f.ref)}</Badge>
                            <button className="text-xs text-primary hover:underline" onClick={() => actions.setValue(row.key, f.key, undefined)}>
                              撤销
                            </button>
                          </div>
                        ) : (
                          <Input
                            id={`fix-${row.key}-${f.key}`}
                            aria-label={`${f.label} 本批值`}
                            value={cur}
                            placeholder={f.kind === "personNo" ? "留空＝自动编号" : f.kind === "date" ? "YYYY-MM-DD" : ""}
                            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                            className="h-8 px-2 py-1 font-mono text-xs"
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {row.numberPreview ? (
            <p className="text-xs text-muted-foreground">
              预览编号 <span className="font-mono text-foreground">{row.numberPreview}</span>：只是本地预览，不占号；正式编号由后端分配。
            </p>
          ) : null}
          {row.values[MATCH_FIELD] ? (
            <div className="flex items-center gap-2 text-xs">
              <Badge tone="info">复用：{row.matched}</Badge>
              <button className="text-primary hover:underline" onClick={() => actions.setValue(row.key, MATCH_FIELD, undefined)}>
                取消复用
              </button>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="aff-h" className="flex flex-col gap-2">
          <h3 id="aff-h" className="text-[13px] font-semibold">
            将受影响的关系
          </h3>
          {affected.length === 0 ? (
            <p className="text-xs text-muted-foreground">本文件内没有其他行引用本行。</p>
          ) : (
            <ul className="flex flex-col gap-1 text-[13px]">
              {affected.map((a) => (
                <li key={a.sheet} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5">
                  <span>{sheetTitle(a.sheet)}</span>
                  <span className="text-muted-foreground">
                    第 {a.lines.slice(0, 6).join("、")}
                    {a.lines.length > 6 ? " 等" : ""} 行 · 共 {a.lines.length} 行
                  </span>
                </li>
              ))}
            </ul>
          )}
          {affected.length && row.status !== "excluded" ? (
            <p className="text-xs text-muted-foreground">排除本行后，上述行将提示“引用的行已被排除”，需一并处理。</p>
          ) : null}
        </section>
      </div>
    </Sheet>
  )
}

function affectedRelations(plan: Plan, row: RowResult) {
  const id = row.values.id
  if (!id) return []
  const out: { sheet: SheetCode; lines: number[] }[] = []
  for (const s of plan.sheets) {
    const fields = s.def.fields.filter((f) => f.ref === row.sheet)
    if (!fields.length) continue
    const lines = s.rows.filter((r) => fields.some((f) => r.values[f.key] === id)).map((r) => r.line)
    if (lines.length) out.push({ sheet: s.code, lines })
  }
  return out
}
