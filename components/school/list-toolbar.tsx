"use client"

import { Input } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { Check, Search, SlidersHorizontal, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

export interface FilterOption {
  value: string
  label: string
}

export interface FilterGroup {
  key: string
  label: string
  options: FilterOption[]
}

export type FilterState = Record<string, string[]>

export function activeFilterCount(state: FilterState) {
  return Object.values(state).reduce((n, v) => n + v.length, 0)
}

/**
 * 通用列表工具栏：搜索 + 多维度筛选器。
 * 筛选器以下拉面板承载多组多选项，选中项在下方以可移除的标签展示，
 * 适配班级/学生数量较多、列表很长的场景。
 */
export function ListToolbar({
  search,
  onSearch,
  searchPlaceholder = "搜索",
  groups,
  value,
  onChange,
  right,
  resultCount,
  totalCount,
}: {
  search: string
  onSearch: (v: string) => void
  searchPlaceholder?: string
  groups: FilterGroup[]
  value: FilterState
  onChange: (next: FilterState) => void
  right?: React.ReactNode
  resultCount?: number
  totalCount?: number
}) {
  const [open, setOpen] = useState(false)
  const popRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const count = activeFilterCount(value)
  const labelOf = useMemo(() => {
    const m: Record<string, Record<string, string>> = {}
    for (const g of groups) {
      m[g.key] = {}
      for (const o of g.options) m[g.key][o.value] = o.label
    }
    return m
  }, [groups])

  function toggle(groupKey: string, optValue: string) {
    const cur = value[groupKey] ?? []
    const next = cur.includes(optValue) ? cur.filter((v) => v !== optValue) : [...cur, optValue]
    onChange({ ...value, [groupKey]: next })
  }

  function clearAll() {
    onChange({})
  }

  const activeChips = groups.flatMap((g) =>
    (value[g.key] ?? []).map((v) => ({ groupKey: g.key, groupLabel: g.label, value: v, label: labelOf[g.key]?.[v] ?? v })),
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div ref={popRef} className="relative">
          <Button variant={count ? "default" : "outline"} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <SlidersHorizontal className="size-3.5" />
            筛选
            {count ? (
              <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary-foreground/20 text-[11px] font-semibold">
                {count}
              </span>
            ) : null}
          </Button>

          {open ? (
            <div className="absolute right-0 z-50 mt-2 w-[300px] rounded-xl border border-border bg-card p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold">按维度筛选</p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  onClick={clearAll}
                  disabled={!count}
                >
                  清除全部
                </button>
              </div>
              <div className="thin-scroll max-h-[360px] space-y-3.5 overflow-y-auto pr-0.5">
                {groups.map((g) => (
                  <div key={g.key}>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{g.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.options.map((o) => {
                        const on = (value[g.key] ?? []).includes(o.value)
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => toggle(g.key, o.value)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12.5px] transition-colors ${
                              on
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card text-muted-foreground hover:border-input hover:text-foreground"
                            }`}
                          >
                            {on ? <Check className="size-3" /> : null}
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {right}
      </div>

      {(activeChips.length || resultCount !== undefined) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {resultCount !== undefined ? (
            <span className="text-xs text-muted-foreground">
              共 {resultCount}
              {totalCount !== undefined ? ` / ${totalCount}` : ""} 条
            </span>
          ) : null}
          {activeChips.map((c) => (
            <span
              key={`${c.groupKey}-${c.value}`}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-primary"
            >
              <span className="text-primary/60">{c.groupLabel}:</span>
              {c.label}
              <button
                type="button"
                onClick={() => toggle(c.groupKey, c.value)}
                className="ml-0.5 rounded transition-colors hover:text-primary/70"
                aria-label={`移除筛选 ${c.label}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {activeChips.length ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              清除
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
