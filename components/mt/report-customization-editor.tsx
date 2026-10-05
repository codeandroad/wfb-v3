"use client"

import { useState } from 'react'
import { DEFAULT_METADATA, type ElementStyle, type MetadataRow } from '@/lib/mt/report-customization'
import { cellTarget, reportElementTargets } from '@/lib/mt/report-elements'
import type { ReportTemplate, FrozenReport } from '@/lib/mt/reports'
import { Btn, inputCls } from './ui'
import { ColorInput, NumericInput } from './report-style-controls'
import { ReportFormatRulesEditor } from './report-format-rules-editor'

export function ReportCustomizationEditor({ value, onChange, currentReport }: { currentReport?: FrozenReport; value: ReportTemplate; onChange: (t: ReportTemplate) => void }) {
  const c = value.customization ?? {}, [selectedTarget, setTarget] = useState('metadata')
  const [widthScope, setWidthScope] = useState<'table' | 'field'>('table')
  const targets = reportElementTargets(currentReport && { ...currentReport, template: value })
  const target = targets.some(([key]) => key === selectedTarget) ? selectedTarget : targets[0]?.[0] ?? ''
  const style = c.elements?.[target] ?? {}
  const update = (patch: Partial<ElementStyle>) => {
    const next = Object.fromEntries(Object.entries({ ...style, ...patch }).filter(([, v]) => v !== undefined))
    onChange({ ...value, customization: { ...c, elements: { ...c.elements, [target]: next } } })
  }
  const storedRows = c.metadata ?? DEFAULT_METADATA
  const metadata = [
    ...DEFAULT_METADATA.map(row => storedRows.find(r => r.source === row.source) ?? { ...row, visible: false }),
    ...storedRows.filter(row => row.source === 'custom'),
  ]
  const setMetadata = (rows: MetadataRow[]) => onChange({ ...value, customization: { ...c, metadata: rows } })
  const patchMetadata = (id: string, patch: Partial<MetadataRow>) => setMetadata(metadata.map(row => row.id === id ? { ...row, ...patch } : row))
  const isTableText = /^(classroom|homework|lessons|focus)\..+\.(header|body)$/.test(target)
  const isColumn = currentReport?.tables?.some(table => table.fields?.some((_, col) => cellTarget(table, col, 'body') === target)) ?? false
  const isInline = isTableText && target.endsWith('.body') && !isColumn
  const groups = [...new Set(targets.map(([key]) => key.split('.')[0]))]
  const groupNames: Record<string, string> = { metadata: '元信息', classroom: '课堂表', homework: '作业栏', lessons: '课次明细', focus: '关注与建议', teaching: '教学介绍', learning: '学情介绍', highlights: '亮点', comment: '个人评语', next: '后续说明' }
  return <div className="flex min-w-0 flex-col gap-3">
    <details>
      <summary className="cursor-pointer font-semibold">元信息内容</summary>
      <div className="flex flex-col gap-3 py-3">
        <p className="text-sm leading-relaxed text-muted-foreground">勾选要显示的行；取消勾选不会删除内容或样式。系统字段自动读取当前报告。</p>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">元信息显示设置</legend>
          {metadata.map(row => <div key={row.id} className="flex flex-col gap-2 rounded-md border border-border p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={`显示${row.label}`} checked={row.visible !== false} onChange={e => patchMetadata(row.id, { visible: e.target.checked })} />{row.label || '自定义行'}</label>
              <span className="text-sm text-muted-foreground">{row.visible === false ? '已隐藏 · 内容保留' : row.source === 'custom' ? '自定义内容' : '系统字段 · 自动读取'}</span>
            </div>
            {row.source === 'custom' ? <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <label className="flex min-w-0 flex-col gap-1 text-sm">标签<input aria-label="自定义元信息标签" className={inputCls} value={row.label} maxLength={100} onChange={e => patchMetadata(row.id, { label: e.target.value })} /></label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">内容<input aria-label="自定义元信息内容" className={inputCls} value={row.text ?? ''} maxLength={500} placeholder="例如教师联系电话" onChange={e => patchMetadata(row.id, { text: e.target.value })} /></label>
            </div> : null}
          </div>)}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" disabled={metadata.length >= 23} onClick={() => setMetadata([...metadata, { id: crypto.randomUUID(), source: 'custom', label: '联系电话', text: '', visible: true }])}>添加自定义行</Btn>
          <Btn size="sm" onClick={() => setMetadata(metadata.map(row => row.source === 'custom' ? row : { ...row, visible: true }))}>显示系统三行</Btn>
        </div>
      </div>
    </details>
    <details>
      <summary className="cursor-pointer font-semibold">元素细调</summary>
      <div className="flex flex-col gap-3 py-3">
        <label className="flex flex-col gap-1 text-sm">编辑元素
          <select aria-label="报告样式元素" className={inputCls} value={target} disabled={!targets.length} onChange={e => setTarget(e.target.value)}>
            {!targets.length ? <option value="">等待报告预览</option> : groups.map(group => <optgroup key={group} label={groupNames[group] ?? group}>{targets.filter(([key]) => key.split('.')[0] === group).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</optgroup>)}
          </select>
        </label>
        <p className="text-sm leading-relaxed text-muted-foreground">仅列出当前报告中显示的元素。隐藏字段的已保存样式会保留，重新显示时继续生效。</p>
        {target ? <>
          <div className="grid gap-3 sm:grid-cols-2" key={`${value.id}:${target}`}>
            <ColorInput label="文字颜色" value={style.color} onChange={color => update({ color })} />
            <ColorInput label={isTableText ? '文字背景颜色' : '背景颜色'} value={style.background} onChange={background => update({ background })} />
            {isTableText ? <ColorInput label="单元格背景颜色" value={style.cellBackground} onChange={cellBackground => update({ cellBackground })} /> : null}
            <NumericInput label="字号" min={10} max={36} step={1} value={style.size} onChange={size => update({ size })} />
            {!isInline ? <NumericInput label="内边距" min={0} max={24} step={1} value={style.padding} onChange={padding => update({ padding })} /> : null}
            <NumericInput label="行高" min={1} max={2} step={0.1} value={style.lineHeight} onChange={lineHeight => update({ lineHeight })} />
            {isColumn ? <><label className="flex flex-col gap-1 text-sm">列宽调整范围<select aria-label="列宽调整范围" className={inputCls} value={widthScope} onChange={e => setWidthScope(e.target.value as 'table' | 'field')}><option value="table">整表同比例</option><option value="field">仅当前字段</option></select></label>{widthScope === 'table' ? <NumericInput label="整表列宽比例（%，默认 100）" min={10} max={2000} step={1} value={c.tableScale === undefined ? undefined : Math.round(c.tableScale * 100)} onChange={percent => onChange({ ...value, customization: { ...c, tableScale: percent === undefined ? undefined : percent / 100 } })} /> : <NumericInput label="当前字段列宽权重（设计像素）" min={30} max={600} step={1} value={style.width} onChange={width => update({ width })} />}<NumericInput label="最小行高" min={0} max={240} step={1} value={style.minHeight} onChange={minHeight => update({ minHeight })} /></> : null}
            <label className="flex flex-col gap-1 text-sm">字重<select className={inputCls} value={style.weight ?? ''} onChange={e => update({ weight: e.target.value ? Number(e.target.value) : undefined })}><option value="">继承</option><option value="400">常规</option><option value="600">半粗</option><option value="700">加粗</option></select></label>
            {!isInline ? <label className="flex flex-col gap-1 text-sm">对齐<select className={inputCls} value={style.align ?? ''} onChange={e => update({ align: (e.target.value as ElementStyle['align']) || undefined })}><option value="">继承</option><option value="left">左</option><option value="center">中</option><option value="right">右</option></select></label> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {isColumn ? <Btn size="sm" disabled={c.tableScale === undefined} onClick={() => onChange({ ...value, customization: { ...c, tableScale: undefined } })}>恢复整表列宽</Btn> : null}
            <Btn size="sm" onClick={() => { const elements = { ...c.elements }; delete elements[target]; onChange({ ...value, customization: { ...c, elements } }) }}>恢复此元素</Btn>
            <Btn size="sm" disabled={!style.cellBackground} onClick={() => { const elements = { ...c.elements }; for (const [key] of targets.filter(([key]) => key.endsWith('.header'))) elements[key] = { ...elements[key], cellBackground: style.cellBackground }; onChange({ ...value, customization: { ...c, elements } }) }}>统一全部表头背景</Btn>
          </div>
          {isColumn ? <p className="text-sm leading-relaxed text-muted-foreground">整表比例 200 表示所有列同时加宽为两倍；仅当前字段的权重只调整该字段各列。自动列宽按实际字号测量；手动收窄后仍可换行。适配预览会缩放整张图片，原始比例可核对真实宽度；图片总宽上限 3200 像素。</p> : null}
          <p className="text-sm leading-relaxed text-muted-foreground">空值表示继承。条件格式覆盖同属性时，以列表中靠后的规则为准。</p>
        </> : null}
      </div>
    </details>
    <details>
      <summary className="cursor-pointer font-semibold">条件格式{c.rules?.length ? ` · ${c.rules.length} 条` : ''}</summary>
      <ReportFormatRulesEditor currentReport={currentReport} rules={c.rules ?? []} onChange={rules => onChange({ ...value, customization: { ...c, rules } })} />
    </details>
  </div>
}
