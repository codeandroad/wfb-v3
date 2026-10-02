"use client"

import { Badge, Sheet, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export type DisplayScope = "staff" | "student"

export interface DisplayFieldRow {
  key: string
  label: string
  group: string
  /** 详情中显示 */
  detail: boolean
  /** 列表中显示 */
  list: boolean
  /** 详情为必显，不可关闭 */
  detailLocked?: boolean
  /** 列表为必显，不可关闭 */
  listLocked?: boolean
  /** 该字段仅可在详情显示，不能加入列表 */
  detailOnly?: boolean
  /** 无读取权：不返回真实值，禁用勾选 */
  noAccess?: boolean
  /** 简短原因（禁用/仅详情时展示） */
  reason?: string
  sensitive?: boolean
}

/**
 * “我的显示设置”——只调整当前操作者在本校的列表/详情显示，不改变他人权限。
 * 复选表不重复放实际字段值；仅表达“详情中显示 / 列表中显示”两个开关。
 */
export function DisplaySettingsSheet({
  scope,
  rows,
  onSave,
  onResetDefault,
  onClose,
}: {
  scope: DisplayScope
  rows: DisplayFieldRow[]
  onSave: (next: DisplayFieldRow[]) => void
  onResetDefault: () => void
  onClose: () => void
}) {
  const { push } = useToast()
  const [draft, setDraft] = useState<DisplayFieldRow[]>(() => rows.map((r) => ({ ...r })))

  const kind = scope === "staff" ? "教职工" : "学生"

  function toggle(key: string, col: "detail" | "list", on: boolean) {
    setDraft((d) => d.map((r) => (r.key === key ? { ...r, [col]: on } : r)))
  }

  const groups = Array.from(new Set(draft.map((r) => r.group)))

  return (
    <Sheet
      open
      onClose={onClose}
      title="我的显示设置"
      desc={`仅调整你在本校的${kind}列表和详情显示，不改变其他人的权限。`}
      width="max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onResetDefault()
              push("已恢复默认显示设置（演示）")
              onClose()
            }}
          >
            恢复默认
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onSave(draft)
                push("已保存显示设置（演示）", "success")
                onClose()
              }}
            >
              保存显示设置
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-muted/50 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
          实际显示 = 有权读取 ∩ 当前页面允许展示 ∩ 本人显示选择。勾选只影响你自己的布局，不授予字段访问权限，也不改变导出或他人视图。
        </p>

        {groups.map((g) => (
          <div key={g} className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              {g}
            </div>
            <table className="w-full text-left text-[13px]">
              <thead className="bg-muted/20 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">字段</th>
                  <th className="w-24 px-3 py-2 text-center font-medium">详情中显示</th>
                  <th className="w-24 px-3 py-2 text-center font-medium">列表中显示</th>
                </tr>
              </thead>
              <tbody>
                {draft
                  .filter((r) => r.group === g)
                  .map((r) => (
                    <tr key={r.key} className="border-t border-border">
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {r.label}
                          {r.sensitive ? <Badge tone="warning">敏感</Badge> : null}
                          {r.detailOnly ? <Badge tone="neutral">仅详情</Badge> : null}
                          {r.noAccess ? <Badge tone="neutral">无读取权</Badge> : null}
                        </span>
                        {r.reason ? <p className="mt-0.5 text-xs text-muted-foreground/70">{r.reason}</p> : null}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {r.noAccess ? (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        ) : r.detailLocked ? (
                          <span className="text-xs text-muted-foreground/60">必显</span>
                        ) : (
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={r.detail}
                            onChange={(e) => toggle(r.key, "detail", e.target.checked)}
                            aria-label={`详情显示 ${r.label}`}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {r.detailOnly || r.noAccess ? (
                          <span className="text-xs text-muted-foreground/50">不可</span>
                        ) : r.listLocked ? (
                          <span className="text-xs text-muted-foreground/60">必显</span>
                        ) : (
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={r.list}
                            onChange={(e) => toggle(r.key, "list", e.target.checked)}
                            aria-label={`列表显示 ${r.label}`}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
