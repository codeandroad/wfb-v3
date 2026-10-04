'use client'

import { useState } from 'react'
import { useMt } from '@/lib/mt/store'
import { MODULES, SYSTEM_TEMPLATES, reporting, validTemplate, type ReportKind, type ReportTemplate, type FrozenReport, type ModuleKey } from '@/lib/mt/reports'
import { Btn, inputCls } from './ui'
import { ReportView } from './report-view'
import { ReportOptionsEditor } from './report-options-editor'

export function ReportTemplates({ teacherId, samples, buildSample }: { teacherId: string; samples: FrozenReport[]; buildSample: (t:ReportTemplate)=>FrozenReport|undefined }) {
  const mt = useMt()
  const [kind, setKind] = useState<ReportKind>('class')
  const [edit, setEdit] = useState<ReportTemplate | null>(null)
  const [view, setView] = useState<ReportTemplate | null>(null)
  const [msg, setMsg] = useState('')
  const state = reporting(mt.biz)
  const templates = [...SYSTEM_TEMPLATES, ...state.templates.filter(t => t.owner === teacherId)]
  const sample = view ? buildSample(view) : samples.find(r => r.kind === kind && r.audience === 'parent')
  const save = () => {
    if (!edit || edit.owner !== teacherId || !edit.name.trim() || !validTemplate(edit)) { setMsg('请检查名称、HEX颜色和合法模块。'); return }
    const r = mt.command('保存我的报告模板', b => ({ ...b, reporting: { ...reporting(b), templates: [...reporting(b).templates.filter(t => t.id !== edit.id), structuredClone(edit)] } }))
    setMsg(r.ok ? '模板已保存，可在其他班级和周次复用。' : r.error)
    if (r.ok) setEdit(null)
  }
  const copy = (t: ReportTemplate) => setEdit({ ...structuredClone(t), id: crypto.randomUUID(), owner: teacherId, name: `${t.name} · 我的副本` })
  const reorder = (index: number, step: number) => {
    if (!edit || index + step < 0 || index + step >= edit.modules.length) return
    const modules = [...edit.modules]; [modules[index], modules[index + step]] = [modules[index + step], modules[index]]; setEdit({ ...edit, modules })
  }
  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">报告模板</h2><div className="flex gap-2"><select aria-label="模板类型" className={inputCls} value={kind} onChange={e => setKind(e.target.value as ReportKind)}><option value="personal">个人反馈</option><option value="class">班级反馈</option></select><Btn onClick={() => setEdit({ ...structuredClone(SYSTEM_TEMPLATES.find(t => t.kind === kind)!), id: crypto.randomUUID(), owner: teacherId, name: '我的新模板' })}>创建模板</Btn></div></div>
    <p className="text-sm text-muted-foreground">系统模板只读。复制后可调整模块和呈现；不保存学生数据，历史报告始终使用发布时的模板。</p>
    <div className="grid gap-3 md:grid-cols-2">{templates.filter(t => t.kind === kind && !t.archived).map(t => <section key={t.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{t.name}</h3><span className="text-sm text-muted-foreground">{t.owner ? '我的模板' : '系统模板'}{state.defaults[teacherId]?.[kind] === t.id ? ' · 默认' : ''}</span></div>{buildSample(t) ? <ReportView report={buildSample(t)!} thumbnail /> : null}<p className="text-sm text-muted-foreground">{{ brief: '均衡摘要，事实与评语分组', letter: '观察与评语优先，宽松段落阅读', timeline: '教学日期优先，作业独立归列', table: '紧凑逐项表格，长记录分段' }[t.layout]}</p><div className="flex flex-wrap gap-2"><Btn size="sm" onClick={() => setView(t)}>实际预览</Btn><Btn size="sm" onClick={() => copy(t)}>复制</Btn><Btn size="sm" onClick={() => { const r = mt.command('设默认报告模板', b => ({ ...b, reporting: { ...reporting(b), defaults: { ...reporting(b).defaults, [teacherId]: { ...reporting(b).defaults[teacherId], [kind]: t.id } } } })); setMsg(r.ok ? '已设为后续新准备的默认模板。' : r.error) }}>设默认</Btn>{t.owner === teacherId ? <><Btn size="sm" onClick={() => setEdit(structuredClone(t))}>编辑</Btn><Btn size="sm" onClick={() => { const r = mt.command('归档我的模板', b => ({ ...b, reporting: { ...reporting(b), templates: reporting(b).templates.map(x => x.id === t.id ? {...x,archived:true} : x) } })); setMsg(r.ok ? '已归档，旧发布快照不变。' : r.error) }}>归档</Btn></> : null}</div></section>)}</div>
    {edit ? <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"><h3 className="font-semibold">编辑我的模板</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">名称<input aria-label="模板名称" className={inputCls} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></label><p className="text-sm text-muted-foreground">结构预设：{edit.preset ?? edit.id}。完整课堂／作业核心表始终保留，下方可调整组织与外观。</p><label className="text-sm">主题 HEX<input className={inputCls} value={edit.color} onChange={e => setEdit({ ...edit, color: e.target.value })} /></label><label className="text-sm">背景 HEX<input className={inputCls} value={edit.background} onChange={e => setEdit({ ...edit, background: e.target.value })} /></label><label className="text-sm">字体<select className={inputCls} value={edit.font} onChange={e => setEdit({ ...edit, font: e.target.value as 'sans' | 'serif' })}><option value="sans">无衬线</option><option value="serif">衬线</option></select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.bold} onChange={e => setEdit({ ...edit, bold: e.target.checked })} />栏目加粗</label></div>
      <ReportOptionsEditor value={edit} onChange={setEdit}/>
      <p className="text-sm text-muted-foreground">隐藏模块只影响呈现，不消除源记录待办。教学介绍与学情总结不可改为含混标题。</p>
      {([...edit.modules, ...(Object.keys(MODULES) as ModuleKey[]).filter(k => !edit.modules.includes(k))]).filter(k => edit.kind === 'personal' || k !== 'comment').map(key => { const i = edit.modules.indexOf(key); return <div key={key} className="flex flex-wrap items-center gap-2 text-sm"><label className="flex min-w-36 items-center gap-2"><input type="checkbox" checked={i >= 0} onChange={e => setEdit({ ...edit, modules: e.target.checked ? [...edit.modules, key] : edit.modules.filter(k => k !== key) })} />{MODULES[key]}</label>{i >= 0 ? <><Btn size="sm" disabled={i === 0} onClick={() => reorder(i, -1)}>上移</Btn><Btn size="sm" disabled={i === edit.modules.length - 1} onClick={() => reorder(i, 1)}>下移</Btn>{key !== 'teaching' && key !== 'learning' ? <input aria-label={`${MODULES[key]}标题`} className="rounded border border-input p-1" placeholder={MODULES[key]} value={edit.titles[key] ?? ''} onChange={e => setEdit({ ...edit, titles: { ...edit.titles, [key]: e.target.value } })} /> : null}</> : null}</div> })}
      <label className="text-sm">中性开场（不要写本周正文或学生信息）<textarea className={inputCls} value={edit.opening} onChange={e => setEdit({ ...edit, opening: e.target.value })} /></label><label className="text-sm">中性结尾<textarea className={inputCls} value={edit.closing} onChange={e => setEdit({ ...edit, closing: e.target.value })} /></label><div className="flex gap-2"><Btn onClick={() => validTemplate(edit) ? setView(edit) : setMsg('请先修正模板配置。')}>保存前预览</Btn><Btn variant="primary" onClick={save}>保存模板</Btn><Btn onClick={()=>copy(edit)}>另存为新模板</Btn><Btn onClick={() => setEdit(null)}>取消</Btn></div>
    </section> : null}
    {msg ? <p role="status" className="text-sm">{msg}</p> : null}
    {view ? <section className="flex flex-col gap-3"><div className="flex justify-between gap-2"><h3>模板实际效果 · {view.name}</h3><Btn onClick={() => setView(null)}>关闭预览</Btn></div>{sample ? <ReportView report={{ ...sample, template: view }} version="当前任务内容 · 模板预览，不发布" /> : <p>当前未准备该类型报告，请返回发布准备选择该报告类型。</p>}</section> : null}
  </div>
}
