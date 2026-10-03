"use client"

import { useState } from "react"
import { normalizeHex } from "@/lib/mt/styles"

export function StyleColorInput({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const raw = draft ?? value
  const hex = normalizeHex(raw)
  return <fieldset className="flex flex-wrap items-center gap-2 text-sm">
    <legend>{label}</legend>
    <input aria-label={`${label}取色`} type="color" value={normalizeHex(value) ?? "#55606b"} onChange={e => { setDraft(null); onChange(e.target.value.toUpperCase()) }} />
    <input aria-label={`${label}HEX`} value={raw} onChange={e => setDraft(e.target.value)} aria-invalid={draft !== null && !hex} placeholder="#RRGGBB" className="h-9 w-32 rounded border border-input bg-card px-2 font-mono" />
    <button type="button" disabled={!hex} onClick={() => { if (hex) { onChange(hex); setDraft(null) } }} className="rounded border border-input px-3 py-1 disabled:opacity-50">保存{label}</button>
    <p className="w-full text-muted-foreground">{draft !== null && !hex ? "请输入 #RGB 或 #RRGGBB；尚未改变有效颜色。" : "支持三位或六位 HEX。自定义颜色可能接近状态色，请同时核对状态文字。"}</p>
  </fieldset>
}
