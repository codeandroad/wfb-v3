'use client'

import { useState } from 'react'
import { useMt } from '@/lib/mt/store'
import type { TaskWeek } from '@/lib/mt/derive'
import { permittedTasks } from '@/lib/mt/derive'
import { STUDENTS, type Publication } from '@/lib/mt/model'
import { canRead, guardians, reportFilename, reporting, type FrozenReport } from '@/lib/mt/reports'
import { downloadFile, exportReportZip, renderReportImages } from '@/lib/mt/report-export'
import { Btn } from './ui'
import { ReportView } from './report-view'
import { PubViewer } from './publish-panel'

export function ReportHistory({ tw, teacherId, onRevise }: { tw: TaskWeek; teacherId: string; onRevise: (pub: Publication) => void }) {
  const mt = useMt()
  const [selected, setSelected] = useState('')
  const [key, setKey] = useState('')
  const [imageResult, setImageResult] = useState<{ pub: string; key: string; urls: string[] } | null>(null)
  const setImages = (urls: string[]) => setImageResult({ pub: selected, key, urls })
  const images = imageResult?.pub === selected && imageResult.key === key ? imageResult.urls : []
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [failOne, setFailOne] = useState(false)
  const [legacy, setLegacy] = useState<Publication | null>(null)
  const permitted = permittedTasks(mt.biz, teacherId).map(t => t.id)
  const history = mt.biz.publications.filter(p => p.taskIds.includes(tw.task.id) && p.periodId === tw.periodId && p.taskIds.every(id => permitted.includes(id)) && (!p.authorId || p.authorId === teacherId)).slice().reverse()
  const pub = history.find(p => p.id === selected)
  const report = pub?.reports?.find(r => r.key === key)
  const rs = reporting(mt.biz)
  const accounts = guardians(STUDENTS)
  const deliver = () => {
    if (!pub || !report || report.audience !== 'parent' || pub.withdrawn) return
    const targets = accounts.filter(g => canRead(report, g))
    if (!targets.length) { setMsg('无有效核验监护账户。仍可导出图片，不自动创建账户。'); return }
    const result = mt.command('模拟补交付指定版本', b => {
      const s = reporting(b), previous = s.deliveries[pub.id] ?? []
      let failed = false
      const attempts = targets.filter(g => !previous.some(d => d.guardian === g.id && d.reportKey === report.key && d.status === 'sent')).map(g => {
        const failure = failOne && !failed; if (failure) failed = true
        return { guardian: g.id, reportKey: report.key, status: failure ? 'failed' as const : 'sent' as const }
      })
      return { ...b, reporting: { ...s, deliveries: { ...s.deliveries, [pub.id]: [...previous.filter(d => !attempts.some(a => a.guardian === d.guardian && a.reportKey === d.reportKey)), ...attempts] } } }
    })
    setMsg(result.ok ? '已按此版本处理；成功接收方不重复发送，失败项可单独重试。' : result.error)
  }
  const createLink = () => {
    if (!pub || !report || report.audience !== 'parent' || pub.withdrawn) return
    const result = mt.command('创建本浏览器演示阅读入口', b => { const s = reporting(b); return { ...b, reporting: { ...s, links: { ...s.links, [pub.id]: [...(s.links[pub.id] ?? []), { reportKey: report.key, token: crypto.randomUUID(), expires: new Date(Date.parse(b.clock) + 7 * 86400000).toISOString(), disabled: false }] } } } })
    setMsg(result.ok ? '演示链接已创建，仅当前浏览器存储可读，需合成监护身份核验。' : result.error)
  }
  const generate = async (r: FrozenReport) => {
    const artifactKey = `${pub!.id}|${r.key}`
    const mark = (status: 'generating' | 'ready' | 'failed', pages?: number, error?: string) => mt.command('记录报告图片状态', b => {
      const state = reporting(b), previous = state.artifacts?.[artifactKey]
      return { ...b, reporting: { ...state, artifacts: { ...state.artifacts, [artifactKey]: { status, attempts: (previous?.attempts ?? 0) + (status === 'generating' ? 1 : 0), pages, error } } } }
    })
    setBusy(true); setImages([])
    try {
      const started = mark('generating'); if (!started.ok) throw new Error(started.error)
      if (mt.faults.imageFail) throw new Error('图片生成失败（故障注入），可重试此报告。')
      const urls = await renderReportImages(r, `第 ${pub!.revision} 版 · ${pub!.publishedAt}`)
      setImages(urls)
      const saved = mark('ready', urls.length)
      setMsg(saved.ok ? `已生成 ${urls.length} 张真实PNG，可打开核对。` : `文件已生成，但状态保存失败：${saved.error}`)
    } catch (e) { const error = e instanceof Error ? e.message : '生成失败'; mark('failed', undefined, error); setMsg(error) } finally { setBusy(false) }
  }
  const zip = async () => {
    if (!pub) return
    setBusy(true)
    try { if (mt.faults.imageFail) throw new Error('导出失败（故障注入）'); const result = await exportReportZip(pub, pub.reports!.filter(r => r.kind === 'personal')); downloadFile(result.blob, `第${pub.week}周-个人反馈-V${pub.revision}.zip`); setMsg(`ZIP已生成，失败 ${result.failed} 份，详情见清单。下载不代表送达。`) } catch (e) { setMsg(e instanceof Error ? e.message : 'ZIP生成失败') } finally { setBusy(false) }
  }
  return <div className="flex flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">第 {tw.week} 周发布记录 · {history.length} 个版本</h2><a href="/feedback-reader" target="_blank" rel="noreferrer" className="text-sm text-primary underline">打开合成家长收件箱</a></div>
    {!history.length ? <p className="text-sm text-muted-foreground">本范围尚无发布记录。预览和保存准备不算发布。</p> : null}
    {history.slice((page - 1) * 10, page * 10).map(p => <section key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"><div><h3 className="font-semibold">第 {p.revision} 版{p.withdrawn ? ' · 已撤回线上访问' : ''}</h3><p className="text-sm text-muted-foreground">{p.publishedAt.replace('T', ' ').slice(0, 16)} · {p.students.length} 份个人报告{p.reports?.some(r => r.kind === 'class') ? ' · 1份班级报告' : ''}{!p.reports ? ' · 旧版快照' : ''}</p></div><div className="flex gap-2"><Btn onClick={() => { if (!p.reports) { setLegacy(p); return }; setSelected(p.id); setKey(p.reports[0]?.key ?? ''); setImages([]) }}>查看／导出／补发</Btn><Btn onClick={() => onRevise(p)}>基于此版本修订</Btn></div></section>)}
    {history.length > 10 ? <div className="flex items-center gap-3"><Btn disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</Btn><span>{page}/{Math.ceil(history.length / 10)}</span><Btn disabled={page * 10 >= history.length} onClick={() => setPage(page + 1)}>下一页</Btn></div> : null}
    {pub && report ? <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"><div className="flex flex-wrap items-center gap-2"><select aria-label="历史报告对象" className="max-w-full rounded border border-input p-2" value={key} onChange={e => { setKey(e.target.value); setImages([]) }}>{pub.reports!.map(r => <option key={r.key} value={r.key}>{r.name} · {r.kind === 'personal' ? '个人' : r.audience === 'internal' ? '校内核对' : '班级家长'}</option>)}</select><Btn disabled={busy} onClick={() => generate(report)}>生成／重试该份PNG</Btn>{pub.reports!.some(r => r.kind === 'personal') ? <Btn disabled={busy} onClick={zip}>导出本版全部个人ZIP（{pub.students.length}份）</Btn> : null}<Btn onClick={() => { const r = mt.command('撤回线上访问', b => ({ ...b, publications: b.publications.map(p => p.id === pub.id ? { ...p, withdrawn: true } : p) })); setMsg(r.ok ? '已撤回线上访问，无法收回已经下载的静态图片。' : r.error) }}>撤回线上访问</Btn></div>
      <p className="text-sm text-muted-foreground">本页始终读取第 {pub.revision} 版冻结内容及模板，补发不带入当前未发布修改。</p><ReportView report={report} version={`第 ${pub.revision} 版 · ${pub.publishedAt}`} />
      {images.map((u, i) => <div key={i} className="flex gap-3 text-sm"><a href={u} target="_blank" rel="noreferrer" className="text-primary underline">打开第 {i + 1} 张PNG</a><button type="button" className="text-primary underline" onClick={() => downloadFile(u, reportFilename(pub, report, i + 1))}>下载PNG</button></div>)}
      {report.audience === 'parent' ? <div className="flex flex-col gap-3 border-t border-border pt-4"><h3 className="font-semibold">此版本交付 · 合成演示</h3><div className="flex flex-wrap items-center gap-3"><Btn disabled={pub.withdrawn} onClick={deliver}>模拟补发／仅重试失败接收方</Btn><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={failOne} onChange={e => setFailOne(e.target.checked)} />注入一个接收方失败</label><Btn disabled={pub.withdrawn} onClick={createLink}>创建7天受限演示链接</Btn><Btn onClick={() => { const r = mt.command('记录人工发送', b => ({ ...b, publications: b.publications.map(p => p.id === pub.id ? { ...p, manualSent: { ...p.manualSent, [key]: b.clock } } : p) })); setMsg(r.ok ? '已记录人工操作，不代表系统送达或已读。' : r.error) }}>记录人工发送</Btn></div><ul className="flex flex-col gap-1 text-sm">{(rs.deliveries[pub.id] ?? []).filter(d => d.reportKey === key).map(d => <li key={d.guardian}>{accounts.find(a => a.id === d.guardian)?.name} · {d.status === 'sent' ? '已模拟送达' : '发送失败'} · {d.readAt ? '合成身份已读' : '未读'}</li>)}</ul>{(rs.links[pub.id] ?? []).filter(l => l.reportKey === key).map(l => <div key={l.token} className="flex flex-wrap items-center gap-2 text-sm"><span>{l.disabled ? '已停用' : Date.parse(l.expires) <= Date.parse(mt.biz.clock) ? '已过期' : '可用'} · 有效至 {l.expires.slice(0, 16)}</span><a href={`/feedback-reader?token=${encodeURIComponent(l.token)}`} target="_blank" rel="noreferrer" className="text-primary underline">打开受限阅读</a><Btn size="sm" onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}/feedback-reader?token=${encodeURIComponent(l.token)}`); setMsg('已复制当前浏览器演示链接，不计送达。') } catch { setMsg('无法访问剪贴板，请从“打开受限阅读”复制地址。') } }}>复制</Btn><Btn size="sm" onClick={() => { const r = mt.command('停用阅读链接', b => { const s = reporting(b); return { ...b, reporting: { ...s, links: { ...s.links, [pub.id]: (s.links[pub.id] ?? []).map(x => x.token === l.token ? { ...x, disabled: true } : x) } } } }); setMsg(r.ok ? '后续读取已停用，已下载图片不受影响。' : r.error) }}>停用</Btn></div>)}</div> : null}
    </section> : null}
    {msg ? <p role="status" className="text-sm">{msg}</p> : null}{legacy ? <PubViewer pub={legacy} onClose={() => setLegacy(null)} /> : null}
  </div>
}
