"use client"

import { useEffect, useState } from 'react'
import { colorValue } from '@/lib/mt/report-customization'
import { inputCls } from './ui'

export function ColorInput({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  const invalid = !!draft && !colorValue(draft)
  return <label className="flex min-w-0 flex-col gap-1 text-sm">
    {label}
    <span className="flex min-w-0 items-center gap-2">
      <input className="h-8 w-8 shrink-0 cursor-pointer rounded border border-input bg-card" aria-label={`${label}取色`} type="color" value={colorValue(value ?? '') ?? '#263a33'} onChange={e => { setDraft(e.target.value); onChange(e.target.value) }} />
      <input className={`${inputCls} min-w-0 flex-1 font-mono`} aria-label={`${label} HEX或RGB`} aria-invalid={invalid} placeholder="继承" value={draft} maxLength={40} onChange={e => { setDraft(e.target.value); if (!e.target.value) onChange(undefined); else { const c = colorValue(e.target.value); if (c) onChange(c) } }} />
    </span>
    {invalid ? <span role="alert" className="text-destructive">请输入 HEX 或 RGB，保留最后有效值</span> : null}
  </label>
}

export function NumericInput({ label, value, min, max, step, onChange }: { label: string; value?: number; min: number; max: number; step: number; onChange: (n: number | undefined) => void }) {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value))
  useEffect(() => setDraft(value === undefined ? '' : String(value)), [value])
  const invalid = draft !== '' && (!Number.isFinite(Number(draft)) || Number(draft) < min || Number(draft) > max)
  return <label className="flex min-w-0 flex-col gap-1 text-sm">
    {label}
    <input aria-label={`元素${label}`} aria-invalid={invalid} className={inputCls} type="number" min={min} max={max} step={step} value={draft} placeholder="继承" onChange={e => { const text = e.target.value; setDraft(text); const n = Number(text); if (text === '') onChange(undefined); else if (Number.isFinite(n) && n >= min && n <= max) onChange(n) }} />
    {invalid ? <span role="alert" className="text-destructive">请输入 {min}–{max}，保留有效值</span> : null}
  </label>
}
