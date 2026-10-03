'use client'

import { useState, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMt, scopeTask, entryKey } from '@/lib/mt/store'
import { permittedTasks, taskWeek, type TaskWeek } from '@/lib/mt/derive'
import { classOf, courseOf, studentById, uniq, STUDENTS } from '@/lib/mt/model'
import { prepareReports } from '@/lib/mt/report-build'
import { SYSTEM_TEMPLATES, reporting, sourceVersion, validTemplate, visibleBlocks, reportDiff, type Preparation, type FrozenReport, guardians, canRead } from '@/lib/mt/reports'
import { Btn, Modal } from './ui'
import { CommonSummary } from './common-summary'
import { ReportTemplates } from './report-templates'
import { ReportView } from './report-view'
import { ReportHistory } from './report-history'
import { SaveState } from './shared'
import { downloadFile, renderReportImages } from '@/lib/mt/report-export'
import { cn } from '@/lib/utils'

export function ReportWorkspace({ tw, teacherId, onOpenStudent }: { tw: TaskWeek; teacherId: string; onOpenStudent: (sid: string) => void }) {
  const mt = useMt(), router = useRouter(), path = usePathname(), params = useSearchParams()
  const view = params.get('publishing') ?? 'prepare'
  const key = `${teacherId}|${tw.task.id}|${tw.periodId}`
  const state = reporting(mt.biz)
  const defaults = state.defaults[teacherId]
  const [prep, setPrep] = useState<Preparation>(() => state.preparations[key] ?? { taskIds: [tw.task.id], personal: true, classReport: false, selected: [...tw.students], personalTemplate: defaults?.personal ?? SYSTEM_TEMPLATES[0].id, classTemplate: defaults?.class ?? SYSTEM_TEMPLATES[4].id, stage: false, omitUnverified: false, account: false, link: false })
  const [saveError, setSaveError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [preview, setPreview] = useState<{ reports: FrozenReport[]; source: string; config: string; at: string } | null>(null)
  const [reportIndex, setReportIndex] = useState(0)
  const [previewSearch, setPreviewSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const exportPreview = async () => {
    const r = preview?.reports[reportIndex]
    if (!r) return
    setExporting(true)
    try {
      if (mt.faults.imageFail) throw new Error('预览稿出图失败（故障注入），可重试')
      const urls = await renderReportImages(r, '未发布预览稿 · 不代表发布或送达')
      urls.forEach((u, i) => downloadFile(u, `预览稿-第${tw.week}周-${r.name}-${r.key}-${i + 1}.png`))
      setMsg('预览稿已导出，未创建正式版本或交付记录。')
    } catch (e) { setMsg(e instanceof Error ? e.message : '预览稿导出失败') } finally { setExporting(false) }
  }
  const [confirmed, setConfirmed] = useState(false)
  const [idem, setIdem] = useState(() => crypto.randomUUID())
  const locked = useRef(false)
  const siblings = permittedTasks(mt.biz, teacherId).filter(t => t.class_id === tw.task.class_id && t.course_id === tw.task.course_id && t.teacher_id === tw.task.teacher_id)
  const tws = prep.taskIds.map(id => siblings.find(t => t.id === id)).filter(t => !!t).map(t => t.id === tw.task.id ? tw : taskWeek(mt.biz, t, tw.week))
  const templates = [...SYSTEM_TEMPLATES, ...state.templates.filter(t => t.owner === teacherId)]
  const personal = templates.find(t => t.id === prep.personalTemplate && t.kind === 'personal') ?? SYSTEM_TEMPLATES[0]
  const classTemplate = templates.find(t => t.id === prep.classTemplate && t.kind === 'class') ?? SYSTEM_TEMPLATES[4]
  const data = prepareReports(mt.biz, tws.length ? tws : [tw], prep, personal, classTemplate)
  const currentVersion = sourceVersion(mt.biz)
  const config = JSON.stringify([prep, personal, classTemplate, data.students, data.reports.map(r => r.blocks)])
  const stale = !!preview && (preview.source !== currentVersion || preview.config !== config)
  const commitPrep = (next: Preparation) => {
    setPrep(next)
    const r = mt.command('自动保存发布准备', b => ({ ...b, reporting: { ...reporting(b), preparations: { ...reporting(b).preparations, [key]: next } } }))
    setSaveError(r.ok ? '' : r.error)
  }
  const navigate = (value: string) => { const q = new URLSearchParams(params.toString()); q.set('publishing', value); router.replace(`${path}?${q}`, { scroll: false }) }
  const related = mt.biz.publications.filter(p => p.periodId === tw.periodId && p.taskIds.slice().sort().join() === prep.taskIds.slice().sort().join())
  const previous = related.find(p => p.id === params.get('revise')) ?? related.at(-1)
  const differences = reportDiff(previous?.reports, data.reports)
  const errors: string[] = []
  if (related.at(-1)?.reports && !reportDiff(related.at(-1)?.reports, data.reports).length) errors.push('与上一版本内容和呈现一致。请到发布记录重导出或补发，不创建重复版本。')
  if (saveError) errors.push(saveError)
  if (!prep.personal && !prep.classReport) errors.push('至少选择一种报告类型。')
  if (prep.taskIds.some(id => !siblings.some(t => t.id === id) || mt.biz.revoked.includes(id))) errors.push('教学范围已变化，请重新选择有权任务。')
  if (prep.personal && !prep.selected.length) errors.push('请选择个人报告受众。')
  if (prep.selected.some(id => !data.roster.includes(id))) errors.push('个人范围包含已不适用的学生，请重新核对名单。')
  if (tws.some(t => mt.unsettled(scopeTask(t.task.id)).length)) errors.push('源记录尚未成功保存，请等待或重试保存。')
  if (!validTemplate(personal) || !validTemplate(classTemplate)) errors.push('模板配置非法。')
  const selectedDays = tws.flatMap(t => t.days.filter(d => prep.personal && prep.selected.includes(d.studentId) && d.elapsed.length))
  const invalidDays = selectedDays.filter(d => d.rec.conflict || d.coverageReview || (d.elig.kind === 'ABSENT' && !!d.gradeEff))
  if (invalidDays.length) errors.push('存在考勤或评价资格矛盾，需到源记录核对。')
  const pending = selectedDays.filter(d => d.state === 'PENDING')
  if (pending.length && !prep.stage) errors.push(`${uniq(pending.map(d => d.studentId)).length} 人存在未完成课堂记录。请处理，或明确选择本周阶段反馈。`)
  const unresolved = data.excluded.filter(x => prep.personal && prep.selected.includes(x.studentId))
  if (unresolved.length && !prep.omitUnverified) errors.push(`${unresolved.length} 项作业到期待核对，请处理或明确本次暂不纳入。`)
  if (data.reports.filter(r => r.audience === 'parent').some(r => !r.blocks.some(b => b.key !== 'legend' && b.lines.some(x => x.trim())) || !visibleBlocks(r).some(b => b.key !== 'legend'))) errors.push('有报告无有效可见内容，不能只发布标题或评价说明。')
  const common = tws.map(t => mt.biz.summaries[entryKey(t.task.id, tw.week)]).flatMap(s => [s?.teaching ?? '', s?.learning ?? '']).join('\n')
  const names = STUDENTS.filter(s => s.name.length > 1 && common.includes(s.name))
  const openPreview = () => { setPreview({ reports: structuredClone(data.reports), source: currentVersion, config, at: mt.biz.clock }); setConfirmed(false); setReportIndex(0) }
  const publish = () => {
    if (locked.current || errors.length || !preview || stale || !confirmed) return
    locked.current = true
    const r = mt.publish({ taskIds: prep.taskIds, periodId: tw.periodId, week: tw.week, idemKey: idem, classNameFormal: classOf(tw.task).name, courseName: courseOf(tw.task)?.name ?? '', ...data.draft, publicSummary: common, students: data.students, reports: preview.reports, sourceVersion: preview.source, authorId: teacherId, diffFromPrev: differences, image: { status: 'NONE', attempts: 0 }, downloads: {}, manualSent: {} })
    if (!r.ok) { setMsg(r.error); locked.current = false; return }
    if (prep.account || prep.link) {
      const g = guardians(STUDENTS)
      const delivery = mt.command('合成交付已发布版本', b => {
        const rs = reporting(b)
        const existing = rs.deliveries[r.pub.id] ?? []
        const links = rs.links[r.pub.id] ?? []
        const outgoing = r.pub.reports!.filter(x => x.audience === 'parent')
        const deliveries = prep.account ? outgoing.flatMap(report => g.filter(a => canRead(report, a)).map(a => ({ reportKey: report.key, guardian: a.id, status: 'sent' as const }))).filter(d => !existing.some(x => x.guardian === d.guardian && x.reportKey === d.reportKey)) : []
        const created = prep.link ? outgoing.filter(x => !links.some(l => l.reportKey === x.key)).map(report => ({ token: crypto.randomUUID(), reportKey: report.key, expires: new Date(Date.parse(b.clock) + 7 * 86400000).toISOString(), disabled: false })) : []
        return { ...b, reporting: { ...rs, deliveries: { ...rs.deliveries, [r.pub.id]: [...existing, ...deliveries] }, links: { ...rs.links, [r.pub.id]: [...links, ...created] } } }
      })
      if (!delivery.ok) setMsg(`快照已保存，但合成交付保存失败：${delivery.error}。到发布记录重试，不需重发版本。`)
      else setMsg(`第 ${r.pub.revision} 版已保存；所选渠道已完成合成演示。`)
    } else setMsg(`第 ${r.pub.revision} 版已保存，可在发布记录导出图片；未发送给任何家长。`)
    setIdem(crypto.randomUUID()); setPreview(null); locked.current = false; navigate('history')
  }
  const filtered = data.roster.filter(s => (studentById(s)?.name ?? '').includes(search))
  const maxPage = Math.max(1, Math.ceil(filtered.length / 27))
  const parentReports = data.reports.filter(r => r.audience === 'parent')
  return <div className="flex flex-col gap-4">
    <nav aria-label="发布工作区" className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><div className="flex gap-2">{[['prepare', '发布准备'], ['templates', '模板中心'], ['history', '发布记录']].map(([v, name]) => <Btn key={v} variant={view === v ? 'primary' : 'ghost'} onClick={() => navigate(v)}>{name}</Btn>)}</div><span className="text-sm text-muted-foreground">{saveError ? '保存失败，输入已保留' : '准备已保存'} · 第 {tw.week} 周整周范围</span></nav>
    {msg ? <p role="status" className="rounded-lg border border-border bg-card p-3 text-sm">{msg}</p> : null}
    {view === 'templates' ? <ReportTemplates teacherId={teacherId} samples={prepareReports(mt.biz, tws.length ? tws : [tw], { ...prep, personal: true, classReport: true, selected: data.roster.slice(0, 1) }, personal, classTemplate).reports} /> : view === 'history' ? <ReportHistory tw={tw} teacherId={teacherId} onRevise={p => { commitPrep({ ...prep, taskIds: p.taskIds, personal: !!p.students.length, classReport: !!p.reports?.some(r => r.kind === 'class'), selected: p.students.map(s => s.studentId) }); const q = new URLSearchParams(params.toString()); q.set('publishing', 'prepare'); q.set('revise', p.id); router.replace(`${path}?${q}`, { scroll: false }) }} /> : <>
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"><h2 className="text-base font-semibold">本周发布范围</h2><div className="flex flex-wrap gap-4">{siblings.map(t => <label className="flex items-center gap-2 text-sm" key={t.id}><input type="checkbox" checked={prep.taskIds.includes(t.id)} disabled={t.id === tw.task.id} onChange={e => { const ids = e.target.checked ? [...prep.taskIds, t.id] : prep.taskIds.filter(id => id !== t.id); const roster = uniq(ids.flatMap(id => taskWeek(mt.biz, siblings.find(t => t.id === id)!, tw.week).students)); commitPrep({ ...prep, taskIds: ids, selected: prep.selected.filter(id => roster.includes(id)) }) }} />{t.label}</label>)}</div><p className="text-sm text-muted-foreground">按真实教学班和本人分工组合，共 {data.roster.length} 人；不包含其他教师分工。日卡来源不缩小周范围。</p><div className="flex flex-wrap gap-5"><label className="flex items-center gap-2"><input type="checkbox" checked={prep.personal} onChange={e => commitPrep({ ...prep, personal: e.target.checked })} />个人反馈 · {prep.selected.length} 份</label><label className="flex items-center gap-2"><input type="checkbox" checked={prep.classReport} onChange={e => commitPrep({ ...prep, classReport: e.target.checked })} />班级反馈 · 1 份</label></div></section>
      {prep.personal ? <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"><div className="flex flex-wrap items-center gap-2"><h3 className="mr-auto font-semibold">个人受众 · 已选 {prep.selected.length}/{data.roster.length}</h3><Btn size="sm" onClick={() => commitPrep({ ...prep, selected: data.roster })}>选择全部适用学生</Btn><Btn size="sm" onClick={() => commitPrep({ ...prep, selected: [] })}>清空选择</Btn><input aria-label="搜索发布学生" placeholder="搜索不改变发送范围" className="rounded border border-input px-2 py-1 text-sm" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} /></div><div className="grid gap-2 sm:grid-cols-3">{filtered.slice((Math.min(page, maxPage) - 1) * 27, Math.min(page, maxPage) * 27).map(s => <label key={s} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prep.selected.includes(s)} onChange={e => commitPrep({ ...prep, selected: e.target.checked ? [...prep.selected, s] : prep.selected.filter(x => x !== s) })} />{studentById(s)?.name}</label>)}</div><div className="flex items-center gap-3 text-sm"><Btn size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Btn><span>第 {Math.min(page, maxPage)}/{maxPage} 页 · 每页27人</span><Btn size="sm" disabled={page >= maxPage} onClick={() => setPage(page + 1)}>下一页</Btn></div></section> : null}
      {tws.map(t => <CommonSummary key={t.task.id} taskId={t.task.id} week={tw.week} label={t.task.label} />)}
      {names.length ? <p role="alert" className="text-sm text-destructive">共同正文包含姓名，请核对是否应向共同受众公开。检测并不保证识别所有敏感内容。</p> : null}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"><h3 className="font-semibold">模板与交付</h3><div className="flex flex-wrap gap-4">{prep.personal ? <label className="flex flex-col gap-1 text-sm">个人模板<select value={personal.id} onChange={e => commitPrep({ ...prep, personalTemplate: e.target.value })} className="rounded border border-input p-2">{templates.filter(t => t.kind === 'personal').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label> : null}{prep.classReport ? <label className="flex flex-col gap-1 text-sm">班级模板<select value={classTemplate.id} onChange={e => commitPrep({ ...prep, classTemplate: e.target.value })} className="rounded border border-input p-2">{templates.filter(t => t.kind === 'class').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label> : null}</div><div className="flex flex-wrap gap-4"><span className="text-sm">发布后可导出PNG / ZIP</span><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prep.account} onChange={e => commitPrep({ ...prep, account: e.target.checked })} />模拟发送到家长账户</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prep.link} onChange={e => commitPrep({ ...prep, link: e.target.checked })} />创建本浏览器受限阅读链接</label></div><p className="text-sm text-muted-foreground">没有核验账户的学生不模拟投送，仍可导出个人图片。当前原型不跨设备共享，不会真实通知家长。</p></section>
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"><h3 className="font-semibold">核对与发布</h3>{previous ? <details><summary className="cursor-pointer text-sm">相对第 {previous.revision} 版的实际变化（{differences.length}）</summary><ul className="flex max-h-48 flex-col gap-1 overflow-auto py-2 text-sm">{differences.map((text, i) => <li key={i}>{text}</li>)}</ul></details> : null}<label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={prep.stage} onChange={e => commitPrep({ ...prep, stage: e.target.checked })} />明确发布本周阶段反馈，未完成课堂如实标注；未来课次不计已完成。</label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={prep.omitUnverified} onChange={e => commitPrep({ ...prep, omitUnverified: e.target.checked })} />本次暂不纳入到期待核对作业（{unresolved.length} 项），源待办仍保留。</label>{errors.map(e => <p key={e} role="alert" className="text-sm text-destructive">{e}</p>)}{(pending[0] || invalidDays[0] || unresolved[0]) ? <Btn size="sm" onClick={() => onOpenStudent(invalidDays[0]?.studentId ?? pending[0]?.studentId ?? unresolved[0].studentId)}>到源记录处理首项</Btn> : null}{saveError ? <Btn onClick={() => commitPrep(prep)}>重试保存准备</Btn> : null}<div className="flex flex-wrap items-center gap-3"><Btn variant="primary" onClick={openPreview} disabled={!parentReports.length}>核对实际报告预览</Btn>{tws.map(t => <SaveState key={t.task.id} scope={scopeTask(t.task.id)} compact />)}</div></section>
    </>}
    {preview ? <Modal wide title="发布前实际预览" desc="切换报告不改变受众。校内版不进入家长渠道。" onClose={() => setPreview(null)}><div className="flex flex-col gap-4"><div className="flex flex-wrap items-center gap-2"><Btn disabled={!reportIndex} onClick={() => setReportIndex(reportIndex - 1)}>上一份</Btn><input aria-label="搜索预览报告" placeholder="搜索预览对象，不改变受众" value={previewSearch} onChange={e => setPreviewSearch(e.target.value)} className="min-w-0 rounded border border-input p-2 text-sm" /><Btn disabled={exporting || stale} onClick={exportPreview}>{exporting ? '生成中…' : '导出未发布预览稿PNG'}</Btn><select aria-label="选择预览报告" className="min-w-0 rounded border border-input p-2" value={reportIndex} onChange={e => setReportIndex(Number(e.target.value))}>{preview.reports.map((r, i) => r.name.includes(previewSearch) ? <option value={i} key={r.key}>{r.name} · {r.kind === 'personal' ? '个人' : r.audience === 'internal' ? '校内核对' : '班级家长'}</option> : null)}</select><Btn disabled={reportIndex >= preview.reports.length - 1} onClick={() => setReportIndex(reportIndex + 1)}>下一份</Btn></div>{stale ? <p role="alert" className="text-destructive">内容、时点或模板已变化，请刷新预览后重新核对。<Btn onClick={openPreview}>刷新预览</Btn></p> : null}{preview.reports[reportIndex] ? <div className={cn('mx-auto w-full', preview.reports[reportIndex].template.layout !== 'table' && 'max-w-xl')}><ReportView report={preview.reports[reportIndex]} /></div> : null}<label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />已核对第 {tw.week} 周范围：个人 {prep.personal ? prep.selected.length : 0} 份、班级 {prep.classReport ? 1 : 0} 份；{prep.account ? '模拟账户发送，' : ''}{prep.link ? '本浏览器受限链接，' : ''}保存不可变版本后可导出。</label><Btn variant="primary" disabled={!!errors.length || stale || !confirmed} onClick={publish}>确认发布本次报告</Btn>{msg ? <p role="status">{msg}</p> : null}</div></Modal> : null}
  </div>
}
