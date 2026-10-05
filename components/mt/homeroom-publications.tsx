'use client'

import { useState } from 'react'
import { Badge, Card, CardHeader, EmptyState } from '@/components/kit'
import { useMt } from '@/lib/mt/store'
import { MAX_WEEK, weekRangeLabel } from '@/lib/mt/model'
import { homeroomPublications, homeroomTasks, trackingWeek } from '@/lib/mt/publication-tracking'
import { PublicationReader } from './publication-reader'
import { Modal } from './ui'

export function HomeroomPublications({ room }: { room: string }) {
  const mt = useMt()
  const [selectedWeek, setWeek] = useState<number | null>(null)
  const [tab, setTab] = useState('tasks')
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState<string | null>(null)
  const week = selectedWeek ?? trackingWeek(mt.biz)
  const tasks = homeroomTasks(mt.biz, room, week).filter(r =>
    !r.requirement.waiver && (!r.requirement.known || r.requirement.required) &&
    `${r.teacher}${r.label}${r.course}`.includes(query)
  )
  const all = homeroomPublications(mt.biz, room)
  const reports = all.filter(p => (selectedWeek === null || p.week === week) && `${p.classNameFormal}${p.courseName}`.includes(query))
  const publication = all.find(p => p.id === opened)
  if (!mt.ready) return <p role="status">正在读取本班反馈记录…</p>
  if (mt.loadError) return <EmptyState title="反馈记录读取失败" desc="请重试加载模拟存储。" />
  return <Card>
    <CardHeader className="px-3 py-2" title={`${room} · 周反馈`} />
    <div className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2"><button className="text-sm text-primary underline" aria-pressed={tab==='tasks'} onClick={()=>setTab('tasks')}>每周任务（含待发布）</button><button className="text-sm text-primary underline" aria-pressed={tab==='reports'} onClick={()=>setTab('reports')}>已发布报告（{all.length}）</button><select aria-label="主班反馈周次" className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground" value={selectedWeek ?? ''} onChange={e=>setWeek(e.target.value ? Number(e.target.value) : null)}><option value="">{tab==='tasks' ? `当前第 ${trackingWeek(mt.biz)} 周` : '全部周次'}</option>{Array.from({length:MAX_WEEK},(_,i)=>i+1).map(w=><option key={w} value={w}>第 {w} 周 · {weekRangeLabel(w)}</option>)}</select><input aria-label="搜索主班反馈" className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground" placeholder="搜索教学班或学科" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      {tab==='tasks' ? <>
        <p className="text-sm text-muted-foreground">待发布 {tasks.filter(r=>['待发布','逾期待发布'].includes(r.status)).length} · 已发布 {tasks.filter(r=>r.publication).length}</p>
        {tasks.map(r=><article key={r.key} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2"><div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"><h3 className="text-sm font-semibold">{r.label} · {r.teacher}</h3>{!r.requirement.known && <details className="text-sm text-muted-foreground"><summary className="cursor-pointer">查看原因</summary><p>{r.requirement.reason}</p></details>}</div><div className="flex items-center gap-3"><Badge tone={r.publication?'success':'neutral'}>{r.status}</Badge>{r.publication ? <button className="text-sm text-primary underline" onClick={()=>setOpened(r.publication!.id)}>查看报告</button> : <span className="text-sm text-muted-foreground">{r.requirement.required ? '发布后可查看' : '无可查看报告'}</span>}</div></article>)}
        {!tasks.length && <p role="status" className="border-t border-border py-2 text-sm text-muted-foreground">{query ? '没有匹配的任务，可清除搜索。' : '本周暂无需跟进任务，已免除及自动免发任务不列出。'}</p>}
      </> : <>{reports.map(p=><article key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2"><div className="flex flex-col gap-1"><h3 className="text-sm font-semibold">{p.classNameFormal} · {p.courseName}</h3><p className="text-sm text-muted-foreground">第 {p.week} 周 · V{p.revision} · {new Date(p.publishedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</p></div><button className="text-sm text-primary underline" onClick={()=>setOpened(p.id)}>查看报告</button></article>)}{!reports.length && <p role="status" className="border-t border-border py-2 text-sm text-muted-foreground">暂无符合条件的报告，可切换全部周次或清除搜索。</p>}</>}
    </div>
    {publication && <Modal wide title="本班已发布反馈 · 只读" onClose={()=>setOpened(null)}><PublicationReader publication={publication} room={room}/></Modal>}
  </Card>
}
