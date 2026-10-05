"use client"

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMt } from '@/lib/mt/store'
import { ATT_LABEL, SUBMISSION_LABEL } from '@/lib/mt/model'
import { SYSTEM_REVS, type SchemeRev } from '@/lib/mt/schemes'
import { FIELDS, INITIAL_RULES, ruleMatches, type CellFact, type FormatRule } from '@/lib/mt/report-customization'
import type { FrozenReport } from '@/lib/mt/reports'
import { Btn, inputCls } from './ui'
import { ColorInput, NumericInput } from './report-style-controls'

const statusesFor = (field: string): Record<string, string> => field === 'attendance' ? ATT_LABEL : { ...SUBMISSION_LABEL, MISSING_CONFIRMED: '确认未交' }
const rated = (field: string) => field === 'classroom' || field === 'quality'
function conditionSummary(rule: FormatRule, revisions: SchemeRev[]) {
  const revision = revisions.find(r => r.id === rule.revision)
  const values = rated(rule.field) ? (rule.grades ?? []).map(id => revision?.levels.find(level => level.id === id)?.code ?? id) : (rule.statuses ?? []).map(status => statusesFor(rule.field)[status] ?? status)
  const submission = (rule.submissionStatuses ?? []).map(status => SUBMISSION_LABEL[status as keyof typeof SUBMISSION_LABEL] ?? status)
  return [values.length ? values.join(' / ') : '未设条件', submission.length ? `且 ${submission.join(' / ')}` : '', rated(rule.field) ? revision?.name ?? '方案已不在当前报告' : ''].filter(Boolean).join(' · ')
}
function Conditions({ label, options, selected, onChange }: { label: string; options: [string, string][]; selected: string[]; onChange: (values: string[]) => void }) {
  return <fieldset className="flex flex-wrap gap-2">
    <legend className="pb-1 text-sm font-medium">{label}</legend>
    {options.map(([key, text]) => <label key={key} className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm', selected.includes(key) ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card text-card-foreground')}><input type="checkbox" checked={selected.includes(key)} onChange={e => onChange(e.target.checked ? [...selected, key] : selected.filter(value => value !== key))} />{text}</label>)}
  </fieldset>
}

export function ReportFormatRulesEditor({ rules, onChange, currentReport }: { rules: FormatRule[]; onChange: (rules: FormatRule[]) => void; currentReport?: FrozenReport }) {
  const mt = useMt()
  const [activeId, setActiveId] = useState<string | null>(null), [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [selected, setSelected] = useState<string[]>([]), [newField, setNewField] = useState('attendance'), [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)
  const cells = useMemo(() => (currentReport?.tables ?? []).flatMap(table => (table.facts ?? []).flat()).filter((fact): fact is CellFact => !!fact), [currentReport?.tables])
  const facts = useMemo(() => cells.flatMap(fact => [fact, ...(fact.related ?? []), ...(fact.parts ?? []).flatMap(part => part.fact ? [part.fact, ...(part.fact.related ?? [])] : [])]), [cells])
  const revisions = useMemo(() => [...SYSTEM_REVS, ...Object.values(mt.biz.schemes.revs)].filter((revision, index, all) => all.findIndex(r => r.id === revision.id) === index), [mt.biz.schemes.revs])
  const activeRevisions = (field: string) => revisions.filter(revision => facts.some(fact => fact.field === field && fact.revision === revision.id))
  const availableFields = ['attendance', 'classroom', 'submission', 'quality'].filter(field => facts.some(fact => fact.field === field) && (!rated(field) || activeRevisions(field).length))
  const fieldToAdd = availableFields.includes(newField) ? newField : availableFields[0]
  const summaries = useMemo(() => new Map(rules.map(rule => [rule.id, conditionSummary(rule, revisions)])), [rules, revisions])
  const filtered = rules.filter(rule => (filter === 'all' || (filter === 'enabled' ? rule.enabled : !rule.enabled)) && `${rule.name} ${FIELDS[rule.field as keyof typeof FIELDS]} ${summaries.get(rule.id)}`.toLowerCase().includes(query.toLowerCase().trim()))
  const current = rules.find(rule => rule.id === activeId), index = current ? rules.indexOf(current) : -1
  const selectedIds = selected.filter(id => rules.some(rule => rule.id === id))
  const patch = (p: Partial<FormatRule>) => { if (current) onChange(rules.map(rule => rule.id === current.id ? { ...rule, ...p } : rule)) }
  const move = (delta: number) => { const next = [...rules]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; onChange(next) }
  const add = () => {
    if (!fieldToAdd) return
    const revision = rated(fieldToAdd) ? activeRevisions(fieldToAdd)[0] : undefined
    const rule: FormatRule = { id: crypto.randomUUID(), name: `${FIELDS[fieldToAdd as keyof typeof FIELDS]}规则`, field: fieldToAdd, revision: revision?.id, enabled: true, style: {} }
    onChange([...rules, rule]); setActiveId(rule.id); setQuery(''); setFilter('all')
  }
  const matchingCells = current ? cells.filter(fact => [fact, ...(fact.related ?? []), ...(fact.parts ?? []).flatMap(part => part.fact ? [part.fact] : [])].some(fact => ruleMatches({ ...current, enabled: true }, fact))).length : 0
  const noCondition = current && !(current.statuses?.length || current.grades?.length || current.submissionStatuses?.length || current.minimum !== undefined || current.maximum !== undefined)
  return <div className="flex min-w-0 flex-col gap-3 py-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">{rules.length} 条规则 · {rules.filter(rule => rule.enabled).length} 条启用</p>
      <Btn size="sm" disabled={INITIAL_RULES.every(initial => rules.some(rule => rule.id === initial.id))} onClick={() => { const added = INITIAL_RULES.filter(initial => !rules.some(rule => rule.id === initial.id)).map(rule => structuredClone(rule)); onChange([...rules, ...added]); if (added[0]) setActiveId(added[0].id); setQuery(''); setFilter('all') }}>加入常用提示</Btn>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <input aria-label="搜索条件规则" className={`${inputCls} min-w-0 flex-1`} placeholder="搜索名称、条件或方案" value={query} onChange={e => setQuery(e.target.value)} />
      <select aria-label="规则状态筛选" className={cn(inputCls, 'w-auto max-w-full shrink-0')} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部状态</option><option value="enabled">仅启用</option><option value="disabled">仅停用</option></select>
    </div>
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-2 py-2 text-sm text-muted-foreground">
        <label className="flex items-center gap-2"><input type="checkbox" aria-label="选择筛选后的全部规则" checked={!!filtered.length && filtered.every(rule => selectedIds.includes(rule.id))} onChange={e => setSelected(e.target.checked ? [...new Set([...selectedIds, ...filtered.map(rule => rule.id)])] : selectedIds.filter(id => !filtered.some(rule => rule.id === id)))} />规则列表 · {filtered.length} 条</label>
        <span>越靠后优先 · 右侧勾选启用</span>
      </div>
      <ul aria-label="条件规则列表" className="max-h-64 overflow-y-auto overscroll-contain">
        {filtered.map(rule => <li key={rule.id} className="flex items-center gap-2 border-b border-border px-2 last:border-0">
          <input type="checkbox" aria-label={`选择规则 ${rule.name}`} checked={selectedIds.includes(rule.id)} onChange={e => setSelected(e.target.checked ? [...selectedIds, rule.id] : selectedIds.filter(id => id !== rule.id))} />
          <button type="button" aria-label={`编辑规则 ${rule.name}`} title={`${rule.name} · ${summaries.get(rule.id)}`} aria-pressed={activeId === rule.id} onClick={() => setActiveId(rule.id)} className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-primary', activeId === rule.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted')}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="truncate text-sm font-medium">{rule.name || '未命名规则'}</span><span className="truncate text-sm text-muted-foreground">{FIELDS[rule.field as keyof typeof FIELDS]} · {summaries.get(rule.id)}</span></span>
            <span className="flex shrink-0 items-center gap-1" aria-label="规则配色">{[rule.style.color, rule.style.background, rule.style.cellBackground].map((color, i) => color ? <span key={i} title={['文字', '文字背景', '单元格背景'][i]} className="size-3 rounded-sm border border-border" style={{ backgroundColor: color }} /> : null)}</span>
          </button>
          <input type="checkbox" aria-label={`启用规则 ${rule.name}`} title="启用规则" checked={rule.enabled} onChange={e => onChange(rules.map(r => r.id === rule.id ? { ...r, enabled: e.target.checked } : r))} />
        </li>)}
        {!filtered.length ? <li className="p-4 text-sm text-muted-foreground">{rules.length ? '没有符合筛选的规则。' : '尚无条件规则。添加规则后，点击列表中的名称编辑。'}</li> : null}
      </ul>
    </div>
    {selectedIds.length ? <div className="flex flex-wrap items-center gap-2 text-sm"><span>已选 {selectedIds.length} 条</span><Btn size="sm" onClick={() => onChange(rules.map(rule => selectedIds.includes(rule.id) ? { ...rule, enabled: true } : rule))}>批量启用</Btn><Btn size="sm" onClick={() => onChange(rules.map(rule => selectedIds.includes(rule.id) ? { ...rule, enabled: false } : rule))}>批量停用</Btn><Btn size="sm" onClick={() => setConfirmDelete(selectedIds)}>删除所选</Btn><Btn size="sm" variant="ghost" onClick={() => setSelected([])}>取消选择</Btn></div> : null}
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="新增规则类型" className={`${inputCls} min-w-0 flex-1`} value={fieldToAdd ?? ''} disabled={!availableFields.length} onChange={e => setNewField(e.target.value)}>{!availableFields.length ? <option value="">当前报告暂无可用评价字段</option> : availableFields.map(field => <option key={field} value={field}>{FIELDS[field as keyof typeof FIELDS]}</option>)}</select>
      <Btn size="sm" disabled={!fieldToAdd} onClick={add}><Plus className="size-4" aria-hidden />添加规则</Btn>
    </div>
    {confirmDelete ? <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted p-2 text-sm text-foreground"><span>删除 {confirmDelete.length} 条规则？</span><Btn size="sm" onClick={() => { onChange(rules.filter(rule => !confirmDelete.includes(rule.id))); if (activeId && confirmDelete.includes(activeId)) setActiveId(null); setSelected(selectedIds.filter(id => !confirmDelete.includes(id))); setConfirmDelete(null) }}>确认删除</Btn><Btn size="sm" onClick={() => setConfirmDelete(null)}>取消</Btn></div> : null}
    {current ? <section aria-label="选中规则编辑" className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-3 text-card-foreground" key={current.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">编辑规则 · 优先级 {index + 1}/{rules.length}</h4>
        <div className="flex items-center gap-1">
          <Btn size="sm" variant="ghost" aria-label="降低规则优先级" title="向前移 · 降低优先级" disabled={index <= 0} onClick={() => move(-1)}><ArrowUp className="size-4" aria-hidden /></Btn>
          <Btn size="sm" variant="ghost" aria-label="提高规则优先级" title="向后移 · 提高优先级" disabled={index === rules.length - 1} onClick={() => move(1)}><ArrowDown className="size-4" aria-hidden /></Btn>
          <Btn size="sm" variant="ghost" aria-label="复制规则" title="复制规则" onClick={() => { const copy = { ...structuredClone(current), id: crypto.randomUUID(), name: `${current.name} · 副本` }; onChange([...rules.slice(0, index + 1), copy, ...rules.slice(index + 1)]); setActiveId(copy.id) }}><Copy className="size-4" aria-hidden /></Btn>
          <Btn size="sm" variant="ghost" aria-label="删除当前规则" title="删除当前规则" onClick={() => setConfirmDelete([current.id])}><Trash2 className="size-4" aria-hidden /></Btn>
          <Btn size="sm" variant="ghost" onClick={() => setActiveId(null)}>收起</Btn>
        </div>
      </div>
      <div className="flex items-center gap-2"><input aria-label="规则名称" className={`${inputCls} min-w-0 flex-1`} value={current.name} maxLength={100} onChange={e => patch({ name: e.target.value })} /><label className="flex shrink-0 items-center gap-1 text-sm"><input type="checkbox" checked={current.enabled} onChange={e => patch({ enabled: e.target.checked })} />启用</label></div>
      {rated(current.field) ? <>
        <label className="flex flex-col gap-1 text-sm">当前报告评价方案<select aria-label="条件规则评价方案" className={inputCls} value={current.revision ?? ''} onChange={e => patch({ revision: e.target.value, grades: [] })}>{!activeRevisions(current.field).some(revision => revision.id === current.revision) ? <option value={current.revision ?? ''}>原方案不在当前报告，请重新选择</option> : null}{activeRevisions(current.field).map(revision => <option key={revision.id} value={revision.id}>{revision.name}</option>)}</select></label>
        <Conditions label="命中等级（可多选）" options={activeRevisions(current.field).find(revision => revision.id === current.revision)?.levels.map(level => [level.id, `${level.code} ${level.label}`]) ?? []} selected={current.grades ?? []} onChange={grades => patch({ grades })} />
      </> : <Conditions label="命中状态（可多选）" options={Object.entries(statusesFor(current.field)).filter(([key]) => key !== 'MISSING')} selected={current.statuses ?? []} onChange={statuses => patch({ statuses })} />}
      {current.field === 'quality' ? <Conditions label="且提交情况为（不选表示不限）" options={(['ON_TIME', 'LATE', 'SUBMITTED'] as const).map(status => [status, SUBMISSION_LABEL[status]])} selected={current.submissionStatuses ?? []} onChange={submissionStatuses => patch({ submissionStatuses })} /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <ColorInput label="命中文字" value={current.style.color} onChange={color => patch({ style: { ...current.style, color } })} />
        <ColorInput label="命中文字背景" value={current.style.background} onChange={background => patch({ style: { ...current.style, background } })} />
        <ColorInput label="命中单元格背景" value={current.style.cellBackground} onChange={cellBackground => patch({ style: { ...current.style, cellBackground } })} />
        <NumericInput label="命中字号" min={10} max={36} step={1} value={current.style.size} onChange={size => patch({ style: { ...current.style, size } })} />
        <label className="flex flex-col gap-1 text-sm">命中字重<select className={inputCls} value={current.style.weight ?? ''} onChange={e => patch({ style: { ...current.style, weight: e.target.value ? Number(e.target.value) : undefined } })}><option value="">继承</option><option value="400">常规</option><option value="600">半粗</option><option value="700">加粗</option></select></label>
      </div>
      <p role="status" className="text-sm leading-relaxed text-muted-foreground">{noCondition ? '请选择命中条件；未设条件的规则不会生效。' : `当前报告匹配 ${matchingCells} 个单元格${current.enabled ? '' : ' · 规则已停用'}。`}{rated(current.field) ? ' 仅作用于所选方案修订。' : ''}</p>
    </section> : null}
  </div>
}
