"use client"

import { normalizeHex } from "@/lib/mt/styles"

export function StyleColorInput({ label, value, onChange, draft, onDraftChange }: { label: string; value: string; onChange: (hex: string) => boolean; draft?: string; onDraftChange: (raw: string) => void }) {
  const raw = draft ?? value
  const hex = normalizeHex(raw)
  const change = (raw: string) => {
    // A three-digit HEX may still be the prefix of six digits. Keep it editable until blur.
    onDraftChange(raw)
    const next = normalizeHex(raw)
    if (next && raw.trim().replace(/^#/, "").length === 6) onChange(next)
  }
  return <fieldset className="flex flex-wrap items-center gap-2 text-sm">
    <legend>{label}</legend>
    <input aria-label={`${label}取色`} type="color" value={hex ?? normalizeHex(value) ?? "#55606b"} onChange={e => change(e.target.value.toUpperCase())} />
    <input aria-label={`${label}HEX`} value={raw} onChange={e => change(e.target.value)} onBlur={() => { if (hex && draft !== undefined) onChange(hex) }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (hex && draft !== undefined) onChange(hex) } }} aria-invalid={draft !== undefined && !hex} placeholder="#RRGGBB" className="h-9 w-32 rounded border border-input bg-card px-2 font-mono" />
    <button type="button" disabled={draft === undefined || !hex} onClick={() => { if (hex && draft !== undefined) onChange(hex) }} className="rounded border border-input px-3 py-1 disabled:opacity-50">{draft !== undefined && hex ? "重试保存" : "自动保存"}</button>
    <p className="w-full text-muted-foreground">{draft !== undefined && !hex ? "请输入 #RGB 或 #RRGGBB；已保存颜色保持不变。" : draft !== undefined ? "此颜色尚未保存；离开输入框时保存，也可重试。" : "取色与六位 HEX 自动保存；三位 HEX 在离开输入框时保存。"}</p>
  </fieldset>
}
