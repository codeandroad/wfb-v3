'use client'
import type { FrozenReport, ReportTable } from '@/lib/mt/reports'
import { visibleBlocks } from '@/lib/mt/reports'
import { classicMetadata } from '@/lib/mt/report-elements'
import { ATT_LABEL } from '@/lib/mt/model'
import { computeStats, pct, dayGroups } from '@/lib/mt/report-stats'

const INK = '#263a33', MUTED = '#5f7168', FAINT = '#8a9a94', PRIMARY = '#245f50', AMBER = '#b5791f', SUCCESS = '#2f7d5b'

/* ---------------- 数据 helpers ---------------- */
const linesOf = (r: FrozenReport, ...keys: string[]) =>
  visibleBlocks(r).filter(b => keys.includes(b.key)).flatMap(b => b.lines).map(s => s.trim()).filter(Boolean)
const tablesOf = (r: FrozenReport, ...kinds: string[]) => (r.tables ?? []).filter(t => kinds.includes(t.kind))
const matrixOf = (r: FrozenReport) => (r.tables ?? []).find(t => t.kind === 'classroom' && t.facts?.length)
const titleOf = (r: FrozenReport) => `${r.name} · ${r.kind === 'personal' ? '个人' : '班级'}周反馈`

/* ---------------- 通用件 ---------------- */
function Head({ report }: { report: FrozenReport }) {
  const meta = classicMetadata(report).filter(Boolean).join(' · ')
  return (
    <div className="px-5 py-5 text-white" style={{ background: 'linear-gradient(135deg,#245f50,#1b4a3e)', borderRadius: '12px 12px 0 0' }}>
      <h2 className="text-[20px] font-semibold leading-snug">{titleOf(report)}</h2>
      <p className="mt-1 text-[12px]" style={{ color: '#dcebe4' }}>{meta}</p>
    </div>
  )
}

function Foot({ report }: { report: FrozenReport }) {
  return <p className="py-4 text-center text-[12px]" style={{ color: FAINT }}>{report.teacher} · {report.period}</p>
}

function Card({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-l-4 bg-white p-4 shadow-sm" style={{ borderColor: '#e2eae6', borderLeftColor: accent }}>
      <h3 className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: INK }}>
        <span className="inline-block size-2 rounded-full" style={{ background: accent }} />{title}
      </h3>
      <div className="mt-2 text-[13px] leading-[1.7]" style={{ color: INK }}>{children}</div>
    </section>
  )
}

function Bullets({ lines, emptyHint = '暂无' }: { lines: string[]; emptyHint?: string }) {
  if (!lines.length) return <p className="text-[13px]" style={{ color: FAINT }}>{emptyHint}</p>
  return (
    <ul className="space-y-1">
      {lines.map((l, i) => (
        <li key={i} className="flex gap-1.5"><span style={{ color: AMBER }}>•</span><span className="whitespace-pre-wrap">{l}</span></li>
      ))}
    </ul>
  )
}

function MatrixTableHTML({ table }: { table: ReportTable }) {
  return (
    <section className="mt-4">
      <h3 className="text-[14px] font-semibold" style={{ color: PRIMARY }}>{table.title}</h3>
      <div className="mt-2 overflow-x-auto rounded-lg border" style={{ borderColor: '#dbe3df' }}>
        <table className="w-full border-collapse text-[12px] leading-relaxed">
          <thead>
            {table.headers.map((row, ri) => (
              <tr key={ri} style={{ background: '#edf2ef' }}>
                {row.map((c, ci) => (
                  <th key={ci} colSpan={c.span} rowSpan={c.rowSpan} className="whitespace-pre-wrap border px-2 py-1.5 text-left font-semibold" style={{ borderColor: '#dbe3df', color: PRIMARY }}>{c.text}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} style={i % 2 ? { background: '#f6f8f7' } : undefined}>
                {row.map((cell, j) => (
                  <td key={j} className="whitespace-pre-wrap border px-2 py-1.5 align-top" style={{ borderColor: '#dbe3df', color: INK }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Shell({ report, children, wide }: { report: FrozenReport; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'w-full' : 'mx-auto w-full max-w-2xl'}>
      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: '#dbe3df' }}>
        <Head report={report} />
        <div className="space-y-3 p-4" style={{ background: '#f3f6f5' }}>{children}</div>
        <Foot report={report} />
      </div>
    </div>
  )
}

/* ---------------- C11 三卡片 ---------------- */
function CardsHTML({ report }: { report: FrozenReport }) {
  const personal = report.kind === 'personal'
  const cards = personal
    ? [
        { title: '个人点评', accent: PRIMARY, lines: linesOf(report, 'comment'), hint: '本周暂无个人点评' },
        { title: '课堂与作业', accent: AMBER, lines: linesOf(report, 'classroom', 'homework'), hint: '本周暂无记录' },
        { title: '下周安排', accent: SUCCESS, lines: linesOf(report, 'next', 'highlights'), hint: '暂无' },
      ]
    : [
        { title: '本周总评', accent: PRIMARY, lines: linesOf(report, 'teaching', 'learning'), hint: '本周暂无总评' },
        { title: '数据一览', accent: AMBER, lines: linesOf(report, 'classroom', 'homework', 'highlights'), hint: '本周暂无记录' },
        { title: '下周预告', accent: SUCCESS, lines: linesOf(report, 'next'), hint: '暂无' },
      ]
  return (
    <Shell report={report}>
      {cards.map(c => <Card key={c.title} title={c.title} accent={c.accent}><Bullets lines={c.lines} emptyHint={c.hint} /></Card>)}
      {tablesOf(report, 'classroom', 'homework', 'lessons').map(t => <MatrixTableHTML key={t.title} table={t} />)}
    </Shell>
  )
}

/* ---------------- C12 仪表盘 ---------------- */
function DashboardHTML({ report }: { report: FrozenReport }) {
  const s = computeStats(report)
  const stats = [
    { label: '出勤正常率', value: pct(s.attNormal, s.attTotal), sub: s.attTotal ? `${s.attNormal}/${s.attTotal}人次` : undefined, accent: PRIMARY },
    { label: '课堂优秀率', value: pct(s.clsA, s.clsTotal), sub: s.clsTotal ? `${s.clsA}/${s.clsTotal}人次获A` : undefined, accent: AMBER },
    { label: '作业提交率', value: pct(s.hwDone, s.hwTotal), sub: s.hwTotal ? `${s.hwDone}/${s.hwTotal}份` : undefined, accent: SUCCESS },
    { label: '表扬', value: s.highlights ? `${s.highlights}` : null, sub: s.highlights ? '条亮点记录' : undefined, accent: '#7a5c9e' },
  ]
  // 本周关注：出勤异常 / 确认未交名单（取自真实 facts）
  const table = matrixOf(report)
  const watch: string[] = []
  if (table?.facts) {
    const names = table.rows.map(r => r[0])
    table.facts.forEach((row, i) => {
      const bad = row.some(f => f && ((f.field === 'attendance' && f.status && f.status !== 'NORMAL') || (f.field === 'submission' && f.status === 'MISSING_CONFIRMED')))
      if (bad && names[i] && !watch.includes(names[i])) watch.push(names[i])
    })
  }
  return (
    <Shell report={report} wide>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(st => (
          <div key={st.label} className="rounded-xl border bg-white p-3 text-center shadow-sm" style={{ borderColor: '#e2eae6' }}>
            <div className="text-[24px] font-bold" style={{ color: st.accent }}>{st.value ?? '–'}</div>
            <div className="mt-0.5 text-[12px]" style={{ color: MUTED }}>{st.label}</div>
            {st.sub ? <div className="text-[11px]" style={{ color: FAINT }}>{st.sub}</div> : null}
          </div>
        ))}
      </div>
      <Card title="本周总评" accent={PRIMARY}><Bullets lines={linesOf(report, 'teaching', 'learning')} emptyHint="本周暂无总评" /></Card>
      {watch.length ? (
        <Card title="本周关注" accent="#b4342a"><p className="text-[13px]" style={{ color: INK }}>{watch.join('、')}<span style={{ color: MUTED }}> — 出勤异常或作业未交，请关注</span></p></Card>
      ) : null}
      {tablesOf(report, 'classroom', 'homework', 'lessons').map(t => <MatrixTableHTML key={t.title} table={t} />)}
    </Shell>
  )
}

/* ---------------- C13 / P11 时间轴 ---------------- */
function TimelineHTML({ report }: { report: FrozenReport }) {
  const personal = report.kind === 'personal'
  const nodes: { label: string; sub?: string; lines: string[] }[] = []
  if (personal) {
    for (const t of tablesOf(report, 'classroom')) {
      t.rows.forEach(row => {
        const [date, att, cls] = row
        const lines = [`出勤：${att || '–'}`, `课堂：${cls || '–'}`]
        nodes.push({ label: date || '', lines })
      })
    }
    for (const t of tablesOf(report, 'homework')) {
      t.rows.forEach(row => nodes.push({ label: row[1] || row[0] || '', sub: '作业', lines: [row.slice(2).filter(Boolean).join(' · ') || '–'] }))
    }
  } else {
    const table = matrixOf(report)
    if (table?.facts) {
      const names = table.rows.map(r => r[0])
      for (const g of dayGroups(table)) {
        if (g.kind === 'homework') {
          let done = 0, total = 0
          table.facts.forEach(row => {
            const f = row[g.columns[0]]
            if (f && (f.field === 'quality' || f.field === 'submission')) { total++; if (f.field === 'quality') done++ }
          })
          nodes.push({ label: g.label, sub: '作业', lines: [`共 ${total} 人 · 已交 ${done} 人`] })
          continue
        }
        const abnormal: string[] = [], stars: string[] = []
        let normal = 0, attTotal = 0
        table.facts.forEach((row, i) => {
          const att = row[g.columns[0]], cls = row[g.columns[1]]
          if (att?.field === 'attendance' && att.status) {
            attTotal++
            if (att.status === 'NORMAL') normal++
            else abnormal.push(`${names[i]}${ATT_LABEL[att.status as keyof typeof ATT_LABEL] ?? ''}`)
          }
          if (cls?.field === 'classroom' && cls.grade && String(cls.grade).replace('*', '').startsWith('A')) stars.push(names[i])
        })
        const lines = [`出勤 ${normal}/${attTotal} 正常${abnormal.length ? `（${abnormal.join('、')}）` : ''}`]
        if (stars.length) lines.push(`课堂之星：${stars.join('、')}`)
        nodes.push({ label: g.label, lines })
      }
    }
  }
  return (
    <Shell report={report}>
      <div className="relative space-y-3">
        <div className="absolute bottom-2 left-[7px] top-2 w-0.5" style={{ background: '#dbe3df' }} aria-hidden="true" />
        {nodes.length ? nodes.map((n, i) => (
          <div key={i} className="relative pl-6">
            <span className="absolute left-0 top-1.5 size-4 rounded-full border-2 bg-white" style={{ borderColor: PRIMARY }} />
            <div className="rounded-xl border bg-white p-3.5 shadow-sm" style={{ borderColor: '#e2eae6' }}>
              <div className="flex items-baseline gap-2">
                <h4 className="text-[14px] font-semibold" style={{ color: PRIMARY }}>{n.label}</h4>
                {n.sub ? <span className="text-[11px]" style={{ color: FAINT }}>{n.sub}</span> : null}
              </div>
              <div className="mt-1 space-y-0.5 text-[13px] leading-relaxed" style={{ color: INK }}>
                {n.lines.map((l, j) => <p key={j} className="whitespace-pre-wrap">{l}</p>)}
              </div>
            </div>
          </div>
        )) : <p className="pl-6 text-[13px]" style={{ color: FAINT }}>本周暂无时间轴记录</p>}
      </div>
      {tablesOf(report, 'classroom', 'homework', 'lessons').map(t => <MatrixTableHTML key={t.title} table={t} />)}
    </Shell>
  )
}

/* ---------------- C14 快问快答 ---------------- */
const QA_MAP: [string, string][] = [
  ['teaching', '本周学了什么？'],
  ['learning', '孩子们学得怎么样？'],
  ['classroom', '课堂表现如何？'],
  ['homework', '作业完成得怎么样？'],
  ['highlights', '哪些同学值得表扬？'],
  ['next', '下周有什么安排？'],
  ['comment', '老师还想说？'],
]
function QAHTML({ report }: { report: FrozenReport }) {
  const blocks = visibleBlocks(report)
  const qas = QA_MAP.flatMap(([key, q]) => {
    const lines = blocks.filter(b => b.key === key).flatMap(b => b.lines).map(s => s.trim()).filter(Boolean)
    return lines.length ? [{ q, lines }] : []
  })
  return (
    <Shell report={report}>
      {qas.length ? qas.map((qa, i) => (
        <div key={i} className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: '#e2eae6' }}>
          <h3 className="text-[14px] font-semibold" style={{ color: PRIMARY }}>Q：{qa.q}</h3>
          <div className="mt-1.5 border-t pt-2 text-[13px] leading-[1.7]" style={{ borderColor: '#eef1f0', color: INK }}>
            {qa.lines.map((l, j) => <p key={j} className="whitespace-pre-wrap">A：{l}</p>)}
          </div>
        </div>
      )) : <p className="text-[13px]" style={{ color: FAINT }}>本周暂无问答内容</p>}
      {tablesOf(report, 'classroom', 'homework', 'lessons').map(t => <MatrixTableHTML key={t.title} table={t} />)}
    </Shell>
  )
}

/* ---------------- C15 一图流 ---------------- */
function LongHTML({ report }: { report: FrozenReport }) {
  const blocks = visibleBlocks(report)
  return (
    <Shell report={report}>
      {blocks.map((b, i) => (
        <section key={i}>
          <h3 className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: PRIMARY }}>
            <span className="inline-block h-4 w-1 rounded" style={{ background: PRIMARY }} />{b.title}
          </h3>
          <div className="mt-1 space-y-1 text-[13px] leading-[1.7]" style={{ color: INK }}>
            {b.lines.map((l, j) => <p key={j} className="whitespace-pre-wrap">{l}</p>)}
          </div>
        </section>
      ))}
      {tablesOf(report, 'classroom', 'homework', 'lessons', 'focus').map(t => <MatrixTableHTML key={t.title} table={t} />)}
    </Shell>
  )
}

/* ---------------- P12 每周一信 ---------------- */
function LetterHTML({ report }: { report: FrozenReport }) {
  const comment = linesOf(report, 'comment')
  return (
    <Shell report={report}>
      <div className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: '#e2eae6' }}>
        <p className="text-[14px] font-medium" style={{ color: INK }}>{report.name}同学家长，您好！</p>
        <div className="mt-3 space-y-2.5 text-[13px] leading-[1.9]" style={{ color: INK }}>
          {comment.length
            ? comment.map((l, i) => <p key={i} className="whitespace-pre-wrap" style={{ textIndent: '2em' }}>{l}</p>)
            : <p style={{ color: FAINT }}>本周暂无评语。</p>}
        </div>
        <div className="mt-4 space-y-3 border-t pt-3" style={{ borderColor: '#eef1f0' }}>
          <div>
            <h4 className="text-[13px] font-semibold" style={{ color: PRIMARY }}>本周课堂与作业</h4>
            <div className="mt-1"><Bullets lines={linesOf(report, 'classroom', 'homework', 'highlights')} emptyHint="本周暂无记录" /></div>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold" style={{ color: PRIMARY }}>下周安排</h4>
            <div className="mt-1"><Bullets lines={linesOf(report, 'next')} emptyHint="暂无" /></div>
          </div>
        </div>
        <p className="mt-5 text-right text-[13px]" style={{ color: MUTED }}>{report.teacher} · {report.period}</p>
      </div>
      {tablesOf(report, 'classroom', 'homework', 'lessons').map(t => <MatrixTableHTML key={t.title} table={t} />)}
    </Shell>
  )
}

/* ---------------- 经典表格 ---------------- */
function TableHTML({ report }: { report: FrozenReport }) {
  const blocks = visibleBlocks(report)
  return (
    <Shell report={report} wide>
      {blocks.map((b, i) => (
        <section key={i} className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: '#e2eae6' }}>
          <h3 className="text-[14px] font-semibold" style={{ color: PRIMARY }}>{b.title}</h3>
          <div className="mt-1.5 space-y-1 text-[13px] leading-[1.7]" style={{ color: INK }}>
            {b.lines.map((l, j) => <p key={j} className="whitespace-pre-wrap">{l}</p>)}
          </div>
        </section>
      ))}
      {(report.tables ?? []).map(t => <MatrixTableHTML key={t.title} table={t} />)}
    </Shell>
  )
}

/* ---------------- 总分发 ---------------- */
export function ReportHTML({ report }: { report: FrozenReport }) {
  const preset = report.template.preset ?? report.template.id
  const layout = report.template.layout
  if (layout === 'timeline') return <TimelineHTML report={report} />
  if (layout === 'letter') return <LetterHTML report={report} />
  if (layout === 'brief') {
    if (preset === 'C12') return <DashboardHTML report={report} />
    if (preset === 'C14') return <QAHTML report={report} />
    if (preset === 'C15') return <LongHTML report={report} />
    return <CardsHTML report={report} />
  }
  return <TableHTML report={report} />
}
