'use client'
import type { ReportTemplate } from '@/lib/mt/reports'
import { applyTheme, themeOf } from '@/lib/mt/report-themes'
import { normalizeHex } from '@/lib/mt/report-options'
import { inputCls } from './ui'
export function ReportThemeEditor({value,onChange}:{value:ReportTemplate;onChange:(t:ReportTemplate)=>void}) {
  const theme=themeOf(value)
  const fields=[['color','主色'],['background','报告背景'],['headerBackground','表头背景'],['headerText','表头文字'],['borderColor','边框颜色'],['stripeColor','隔行背景']] as const
  return <fieldset className="flex flex-col gap-3"><legend className="mb-2 font-semibold">主题配色</legend><div className="grid gap-3 sm:grid-cols-2">{fields.map(([key,label])=><label key={key} className="flex flex-col gap-1 text-sm">{label}<span className="flex items-center gap-2"><input aria-label={`${label}颜色盘`} type="color" className="h-9 w-12 shrink-0 cursor-pointer rounded border border-input" value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(theme[key])?normalizeHex(theme[key]):'#ffffff'} onChange={e=>onChange(applyTheme(value,{...theme,[key]:e.target.value}))}/><input aria-label={`${label}HEX`} className={inputCls} value={theme[key]} onChange={e=>onChange(applyTheme(value,{...theme,[key]:e.target.value}))}/></span></label>)}</div></fieldset>
}
