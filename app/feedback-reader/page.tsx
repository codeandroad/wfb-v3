'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MtProvider, useMt } from '@/lib/mt/store'
import { STUDENTS } from '@/lib/mt/model'
import { guardians, readReport, reporting } from '@/lib/mt/reports'
import { ReportView } from '@/components/mt/report-view'
import { Btn } from '@/components/mt/ui'

function Reader() {
  const mt = useMt(), params = useSearchParams()
  const [identity, setIdentity] = useState('')
  const [opened, setOpened] = useState<{ pub: string; key: string } | null>(null)
  const [message, setMessage] = useState('')
  const accounts = guardians(STUDENTS)
  const rs = reporting(mt.biz)
  const token = params.get('token')
  const found = token ? Object.entries(rs.links).flatMap(([pub, links]) => links.filter(l => l.token === token).map(l => ({ pub, key: l.reportKey }))).at(0) : opened
  const result = found && identity ? readReport(mt.biz, identity, accounts, found.pub, found.key, token ?? undefined) : null
  useEffect(() => {
    const refresh = () => mt.retryLoad()
    window.addEventListener('storage', refresh)
    window.addEventListener('pageshow', refresh)
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('pageshow', refresh); window.removeEventListener('focus', refresh) }
  }, [mt.retryLoad])
  const inbox = Object.entries(rs.deliveries).flatMap(([pub, entries]) => entries.filter(d => d.guardian === identity && d.status === 'sent').map(d => ({ pub, key: d.reportKey })))
  const markRead = () => {
    if (!found || !result?.report) return
    const r = mt.command('合成身份实际阅读', b => {
      if (!readReport(b, identity, accounts, found.pub, found.key, token ?? undefined).report) return { error: '阅读资格已失效', kind: 'rejected' }
      const s = reporting(b), entries = s.deliveries[found.pub] ?? []
      return { ...b, reporting: { ...s, readEvents: { ...s.readEvents, [`${found.pub}|${found.key}|${identity}`]: b.clock }, deliveries: { ...s.deliveries, [found.pub]: entries.map(d => d.guardian === identity && d.reportKey === found.key ? { ...d, readAt: b.clock } : d) } } }
    })
    setMessage(r.ok ? '已记录此合成身份的阅读操作。' : r.error)
  }
  return <main className="min-h-svh bg-background px-4 py-6 text-foreground"><div className="mx-auto flex max-w-2xl flex-col gap-4"><header className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"><h1 className="text-xl font-semibold">周反馈 · 合成家长收件箱</h1><p className="text-sm text-muted-foreground">仅当前浏览器的合成身份与本地数据演示，不是真实登录、生产授权或跨设备分享服务。不会发送短信、邮件或微信。</p><label className="flex flex-col gap-1 text-sm">演示监护身份<select aria-label="合成监护身份" className="w-full rounded border border-input bg-card p-2" value={identity} onChange={e => { setIdentity(e.target.value); setOpened(null); setMessage('') }}><option value="">未登录</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label></header>
    {!mt.ready ? <p>正在读取本浏览器演示数据…</p> : !identity ? <p>请选择合成监护身份后核验，不凭链接直接显示正文。</p> : <>
      {!token ? <nav aria-label="合成账户收件列表" className="flex flex-col gap-2">{inbox.map(item => { const r = readReport(mt.biz, identity, accounts, item.pub, item.key); return r.report ? <button type="button" className="rounded-lg border border-border bg-card p-3 text-left" key={`${item.pub}|${item.key}`} onClick={() => { setOpened(item); setMessage('') }}>{r.report.name} · {r.report.period} · 已模拟送达</button> : null })}{!inbox.length ? <p>此账户尚无已模拟送达的报告。</p> : null}</nav> : null}
      {token && !found ? <p role="alert">链接不存在，或此浏览器没有对应演示数据。</p> : null}
      {result?.error ? <p role="alert">{result.error}</p> : result?.report ? <><ReportView report={result.report} version={`第 ${mt.biz.publications.find(p => p.id === found?.pub)?.revision} 版`} /><Btn onClick={markRead}>以此合成身份确认已阅读</Btn></> : null}
    </>}{message ? <p role="status">{message}</p> : null}</div></main>
}
export default function Page() { return <MtProvider><Suspense fallback={<p>正在加载阅读入口…</p>}><Reader /></Suspense></MtProvider> }
