"use client"

import { cn } from "@/lib/utils"
import { Check, ChevronDown, Plus, Search } from "lucide-react"
import { useMemo, useRef, useState } from "react"

export interface SearchOption {
  value: string
  label: string
  sub?: string // 次要说明（如教室位置）
  inactive?: boolean // 停用条目：不作为新记录普通候选
}

/**
 * P02 可搜索下拉 + 就地新增。
 * - 输入文本首先是搜索，不是已选定对象。
 * - 有维护权（canCreate）时，无精确匹配可“新增并选用”，需显式确认。
 * - 无维护权时不保存自由文字，仅提示可暂不填写或联系有权维护人员。
 * - 停用条目默认不作为新候选；已选中的原值（含停用）仍显示。
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "搜索或选择",
  canCreate = false,
  onCreate,
  allowEmpty = true,
  emptyHint,
  invalid,
  id,
}: {
  value: string | null
  onChange: (value: string | null) => void
  options: SearchOption[]
  placeholder?: string
  canCreate?: boolean
  onCreate?: (name: string) => string // 返回新条目的 value
  allowEmpty?: boolean
  emptyHint?: string
  invalid?: boolean
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value) ?? (value ? { value, label: value } : null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options.filter((o) => {
      if (o.inactive && o.value !== value) return false // 停用不作为新候选
      if (!q) return true
      return o.label.toLowerCase().includes(q) || (o.sub ?? "").toLowerCase().includes(q)
    })
  }, [options, query, value])

  const exactMatch = options.some((o) => o.label.trim().toLowerCase() === query.trim().toLowerCase())
  const showCreate = canCreate && !!onCreate && query.trim().length > 0 && !exactMatch

  function selectValue(v: string | null) {
    onChange(v)
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={rootRef} className="relative">
      {/* 已选摘要 / 触发器 */}
      {selected && !open ? (
        <button
          type="button"
          id={id}
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2 text-left text-[14px] shadow-sm transition-colors",
            invalid ? "border-destructive" : "border-input hover:border-ring",
          )}
        >
          <span className="min-w-0 truncate">
            <span className="text-foreground">{selected.label}</span>
            {selected.sub ? <span className="ml-1.5 text-xs text-muted-foreground">{selected.sub}</span> : null}
            {selected.inactive ? <span className="ml-1.5 text-xs text-[#8a5a12]">（已停用）</span> : null}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <div
          className={cn(
            "rounded-lg border bg-card shadow-sm",
            invalid ? "border-destructive" : "border-input",
          )}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id={id}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="w-full rounded-lg bg-transparent py-2 pl-9 pr-3 text-[14px] outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          {open ? (
            <div className="thin-scroll max-h-56 overflow-y-auto border-t border-border p-1">
              {allowEmpty ? (
                <button
                  type="button"
                  onClick={() => selectValue(null)}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-muted"
                >
                  不填写
                  {value === null ? <Check className="size-3.5 text-primary" /> : null}
                </button>
              ) : null}
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => selectValue(o.value)}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left hover:bg-muted"
                >
                  <span className="min-w-0 truncate text-[13px]">
                    <span className="text-foreground">{o.label}</span>
                    {o.sub ? <span className="ml-1.5 text-xs text-muted-foreground">{o.sub}</span> : null}
                  </span>
                  {value === o.value ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                </button>
              ))}

              {filtered.length === 0 && !showCreate ? (
                <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">
                  {emptyHint ?? "未找到匹配项。"}
                </p>
              ) : null}

              {showCreate ? (
                <button
                  type="button"
                  onClick={() => {
                    const v = onCreate!(query.trim())
                    selectValue(v)
                  }}
                  className="mt-1 flex w-full items-center gap-1.5 rounded-md border-t border-border px-2.5 py-2 text-left text-[13px] font-medium text-primary hover:bg-accent/50"
                >
                  <Plus className="size-3.5" />
                  新增“{query.trim()}”并选用
                </button>
              ) : null}

              {!canCreate && query.trim().length > 0 && !exactMatch ? (
                <p className="border-t border-border px-2.5 py-2 text-xs text-muted-foreground">
                  未找到该选项，可暂不填写或联系有权维护人员新增。
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
