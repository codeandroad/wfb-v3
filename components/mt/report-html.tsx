'use client'
import type { FrozenReport, ReportTable } from '@/lib/mt/reports'
import { visibleBlocks } from '@/lib/mt/reports'
import { classicMetadata, classicNotes } from '@/lib/mt/report-classic-export'
import { reportOptions } from '@/lib/mt/report-options'
import { computeStats, pct, dayGroups } from '@/lib/mt/report-stats'
import { darken } from '@/lib/mt/report-canvas-shared'

/* ================= 主题：全部取自模板（含 applyTheme 写入的颜色） ================= */
type HtmlTheme = {
  primary: string; pageBg: string; headerBg: string; headerText: string
  border: string; stripe: string; bodySize: number; tableSize: number; compact: boolean
}
const themeOf = (r: FrozenReport): HtmlTheme => {
  const o = reportOptions(r.template)
  return {
    primary: r.template.color,
    pageBg: r.template.background,
    headerBg: o.headerBackground,
    headerText: o.headerText,
    border: o.borderColor,
    stripe: o.stripeColor,
    bodySize: o.bodySize,
    tableSize: o.tableSize,
    compact: o.density === 'compact',
  }
}

const INK = '#263a33', MUTED = '#5f7168', FAINT = '#8a9a94'

/* ================= 数据 helpers ================= */
const linesOf = (r: FrozenReport, ...keys: string[]) =>
  visibleBlocks(r).filter(b => keys.includes(b.key)).flatMap(b => b.lines).map(s => s.trim()).filter(Boolean)
const tablesOf = (r: FrozenReport, ...kinds: string[]) => (r.tables ?? []).filter(t => kinds.includes(t.kind))
const matrixOf = (r: FrozenReport) => (r.tables ?? []).find(t => t.kind === 'classroom' && t.facts?.length)

/* ================= 通用数据表（主题色表头 / 边框 / 隔行） ================= */
function DataTableHTML({ table, t, title }: { table: ReportTable; t: HtmlTheme; title?: boolean }) {
  const pad = t.compact ? 4 : 8
  return (
    <section>
      {title !== false && table.title ? (
        <h3 className="mb-1 font-semibold" style={{ color: t.primary, fontSize: t.bodySize }}>{table.title}</h3>
      ) : null}
      <div className="overflow-x-auto rounded border" style={{ borderColor: t.border }}>
        <table className="w-full border-collapse leading-relaxed" style={{ fontSize: t.tableSize }}>
          <thead>
            {table.headers.map((row, ri) => (
              <tr key={ri} style={{ background: t.headerBg }}>
                {row.map((c, ci) => (
                  <th key={ci} colSpan={c.span} rowSpan={c.rowSpan} className="whitespace-pre-wrap border font-semibold"
                    style={{ borderColor: t.border, color: t.headerText, padding: pad }}>{c.text}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} style={i % 2 ? { background: t.stripe } : { background: t.pageBg }}>
                {row.map((cell, j) => (
                  <td key={j} className="whitespace-pre-wrap border align-top"
                    style={{ borderColor: t.border, color: INK, padding: pad }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ================= 经典模板：还原原始排布 =================
   - 顶部为纯文字元信息（classicMetadata），无横幅
   - C01 边栏型：表左（2fr）+ 说明右（1fr）；C02 上下型：表上 + 说明下；C03 紧凑：同上但更密
   - 个人 P03：说明在前、表在后 */
function NotesHTML({ report, t }: { report: FrozenReport; t: HtmlTheme }) {
  const notes = classicNotes(report)
  if (!notes.length) return null
  return (
    <div className="space-y-4">
      {notes.map((b, i) => (
        <section key={i}>
          <h3 className="font-semibold" style={{ color: t.primary, fontSize: t.bodySize }}>{b.title}</h3>
          <div className="mt-1 space-y-1 leading-relaxed" style={{ color: INK, fontSize: t.bodySize }}>
            {b.lines.map((l, j) => <p key={j} className="whitespace-pre-wrap">{l.replace(/\*\*/g, '')}</p>)}
          </div>
        </section>
      ))}
    </div>
  )
}

function ClassicHTML({ report }: { report: FrozenReport }) {
  const t = themeOf(report)
  const o = reportOptions(report.template)
  const personal = report.kind === 'personal'
  const preset = report.template.preset ?? report.template.id
  const tables = report.tables ?? []
  const main = personal ? tables : tables.filter(tb => tb.kind === 'classroom')
  const appendices = personal ? [] : tables.filter(tb => tb.kind !== 'classroom')
  const notes = classicNotes(report)
  const sidebar = !personal && o.notesPosition === 'right' && notes.length > 0
  const notesFirst = personal && preset === 'P03' && notes.length > 0
  return (
    <div className="w-full rounded-xl border p-5" style={{ background: t.pageBg, borderColor: t.border }}>
      <div className="space-y-1">
        {classicMetadata(report).map((text, i) => (
          <p key={i} className="whitespace-pre-wrap" style={{ color: INK, fontSize: 16 }}>{text}</p>
        ))}
      </div>
      {notesFirst ? <div className="mt-4"><NotesHTML report={report} t={t} /></div> : null}
      {sidebar ? (
        <div className="mt-4 grid gap-6" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
          <div className="min-w-0 space-y-4">
            {main.map(tb => <DataTableHTML key={tb.title} table={tb} t={t} title={main.length > 1} />)}
          </div>
          <div className="min-w-0"><NotesHTML report={report} t={t} /></div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {main.map(tb => <DataTableHTML key={tb.title} table={tb} t={t} title={main.length > 1 || personal} />)}
          {!notesFirst ? <NotesHTML report={report} t={t} /> : null}
        </div>
      )}
      {appendices.length ? (
        <div className="mt-4 space-y-4">
          {appendices.map(tb => <DataTableHTML key={tb.title} table={tb} t={t} />)}
        </div>
      ) : null}
    </div>
  )
}

/* ================= 新样式：主题色头图 ================= */
function Head({ report, t }: { report: FrozenReport; t: HtmlTheme }) {
  const meta = classicMetadata(report).filter(Boolean).join(' · ')
  return (
    <div className="px-5 py-5 text-white" style={{ background: `linear-gradient(135deg,${t.primary},${darken(t.primary)})`, borderRadius: '12px 12px 0 0' }}>
      <h2 className="text-[20px] font-semibold leading-snug">{report.name} · {report.kind === 'personal' ? '个人' : '班级'}周反馈</h2>
      <p className="mt-1 text-[12px]" style={{ color: '#dcebe4' }}>{meta}</p>
    </div>
  )
}

function Foot({ report }: { report: FrozenReport }) {
  return <p className="py-4 text-center text-[12px]" style={{ color: FAINT }}>{report.teacher} · {report.period}</p>
}

function Card({ title, accent, t, children }: { title: string; accent: string; t: HtmlTheme; children: React.ReactNode }) {
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
        <li key={i} className="flex gap-1.5"><span style={{ color: '#b5791f' }}>•</span><span className="whitespace-pre-wrap">{l}</span></li>
      ))}
    </ul>
  )
}

function Shell({ report, t, children, wide }: { report: FrozenReport; t: HtmlTheme; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'w-full' : 'mx-auto w-full max-w-2xl'}>
      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: t.border }}>
        <Head report={report} t={t} />
        <div className="space-y-3 p-4" style={{ background: '#f3f6f5' }}>{children}</div>
        <Foot report={report} />
      </div>
    </div>
  )
}

/* ---------------- C11 三卡片 ---------------- */
function CardsHTML({ report }: { report: FrozenReport }) {
  const t = themeOf(report)
  const personal = report.kind === 'personal'
  const cards = personal
    ? [
        { title: '个人点评', accent: t.primary, lines: linesOf(report, 'comment'), hint: '本周暂无个人点评' },
        { title: '课堂与作业', accent: '#b5791f', lines: linesOf(report, 'classroom', 'homework'), hint: '本周暂无记录' },
        { title: '下周安排', accent: '#2f7d5b', lines: linesOf(report, 'next', 'highlights'), hint: '暂无' },
      ]
    : [
        { title: '本周总评', accent: t.primary, lines: linesOf(report, 'teaching', 'learning'), hint: '本周暂无总评' },
        { title: '数据一览', accent: '#b5791f', lines: linesOf(report, 'classroom', 'homework', 'highlights'), hint: '本周暂无记录' },
        { title: '下周预告', accent: '#2f7d5b', lines: linesOf(report, 'next'), hint: '暂无' },
      ]
  return (
    <Shell report={report} t={t}>
      {cards.map(c => <Card key={c.title} title={c.title} accent={c.accent} t={t}><Bullets lines={c.lines} emptyHint={c.hint} /></Card>)}
      {tablesOf(report, 'classroom', 'homework', 'lessons').map(tb => <DataTableHTML key={tb.title} table={tb} t={t} />)}
    </Shell>
  )
}

/* ---------------- C12 仪表盘 ---------------- */
function DashboardHTML({ report }: { report: FrozenReport }) {
  const t = themeOf(report)
  const s = computeStats(report)
  const stats = [
    { label: '出勤正常率', value: pct(s.attNormal, s.attTotal), sub: s.attTotal ? `${s.attNormal}/${s.attTotal}人次` : undefined, accent: t.primary },
    { label: '课堂优秀率', value: pct(s.clsA, s.clsTotal), sub: s.clsTotal ? `${s.clsA}/${s.clsTotal}人次获A` : undefined, accent: '#b5791f' },
    { label: '作业提交率', value: pct(s.hwDone, s.hwTotal), sub: s.hwTotal ? `${s.hwDone}/${s.hwTotal}份` : undefined, accent: '#2f7d5b' },
    { label: '表扬', value: s.highlights ? `${s.highlights}` : null, sub: s.highlights ? '条亮点记录' : undefined, accent: '#7a5c9e' },
  ]
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
    <Shell report={report} t={t} wide>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(st => (
          <div key={st.label} className="rounded-xl border bg-white p-3 text-center shadow-sm" style={{ borderColor: '#e2eae6' }}>
            <div className="text-[24px] font-bold" style={{ color: st.accent }}>{st.value ?? '–'}</div>
            <div className="mt-0.5 text-[12px]" style={{ color: MUTED }}>{st.label}</div>
            {st.sub ? <div className="text-[11px]" style={{ color: FAINT }}>{st.sub}</div> : null}
          </div>
        ))}
      </div>
      <Card title="本周总评" accent={t.primary} t={t}><Bullets lines={linesOf(report, 'teaching', 'learning')} emptyHint="本周暂无总评" /></Card>
      {watch.length ? (
        <Card title="本周关注" accent="#b4342a" t={t}><p className="text-[13px]" style={{ color: INK }}>{watch.join('、')}<span style={{ color: MUTED }}> — 出勤异常或作业未交，请关注</span></p></Card>
      ) : null}
      {tablesOf(report, 'classroom', 'homework', 'lessons').map(tb => <DataTableHTML key={tb.title} table={tb} t={t} />)}
    </Shell>
  )
}

/* ---------------- C13 / P11 时间轴 ---------------- */
const ATT_TXT: Record<string, string> = { NORMAL: '正常', LEAVE: '请假', LATE: '迟到', EARLY_LEAVE: '早退', ABSENT: '缺勤', ELSEWHERE: '在他班' }
function TimelineHTML({ report }: { report: FrozenReport }) {
  const t = themeOf(report)
  const personal = report.kind === 'personal'
  const nodes: { label: string; sub?: string; lines: string[] }[] = []
  if (personal) {
    for (const tb of tablesOf(report, 'classroom')) {
      tb.rows.forEach(row => nodes.push({ label: row[0] || '', lines: [`出勤：${row[1] || '–'}`, `课堂：${row[2] || '–'}`] }))
    }
    for (const tb of tablesOf(report, 'homework')) {
      tb.rows.forEach(row => nodes.push({ label: row[1] || row[0] || '', sub: '作业', lines: [row.slice(2).filter(Boolean).join(' · ') || '–'] }))
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
            else abnormal.push(`${names[i]}${ATT_TXT[att.status] ?? ''}`)
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
    <Shell report={report} t={t}>
      <div className="relative space-y-3">
        <div className="absolute bottom-2 left-[7px] top-2 w-0.5" style={{ background: t.border }} aria-hidden="true" />
        {nodes.length ? nodes.map((n, i) => (
          <div key={i} className="relative pl-6">
            <span className="absolute left-0 top-1.5 size-4 rounded-full border-2 bg-white" style={{ borderColor: t.primary }} />
            <div className="rounded-xl border bg-white p-3.5 shadow-sm" style={{ borderColor: '#e2eae6' }}>
              <div className="flex items-baseline gap-2">
                <h4 className="text-[14px] font-semibold" style={{ color: t.primary }}>{n.label}</h4>
                {n.sub ? <span className="text-[11px]" style={{ color: FAINT }}>{n.sub}</span> : null}
              </div>
              <div className="mt-1 space-y-0.5 text-[13px] leading-relaxed" style={{ color: INK }}>
                {n.lines.map((l, j) => <p key={j} className="whitespace-pre-wrap">{l}</p>)}
              </div>
            </div>
          </div>
        )) : <p className="pl-6 text-[13px]" style={{ color: FAINT }}>本周暂无时间轴记录</p>}
      </div>
      {tablesOf(report, 'classroom', 'homework', 'lessons').map(tb => <DataTableHTML key={tb.title} table={tb} t={t} />)}
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
  const t = themeOf(report)
  const blocks = visibleBlocks(report)
  const qas = QA_MAP.flatMap(([key, q]) => {
    const lines = blocks.filter(b => b.key === key).flatMap(b => b.lines).map(s => s.trim()).filter(Boolean)
    return lines.length ? [{ q, lines }] : []
  })
  return (
    <Shell report={report} t={t}>
      {qas.length ? qas.map((qa, i) => (
        <div key={i} className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: '#e2eae6' }}>
          <h3 className="text-[14px] font-semibold" style={{ color: t.primary }}>Q：{qa.q}</h3>
          <div className="mt-1.5 border-t pt-2 text-[13px] leading-[1.7]" style={{ borderColor: '#eef1f0', color: INK }}>
            {qa.lines.map((l, j) => <p key={j} className="whitespace-pre-wrap">A：{l}</p>)}
          </div>
        </div>
      )) : <p className="text-[13px]" style={{ color: FAINT }}>本周暂无问答内容</p>}
      {tablesOf(report, 'classroom', 'homework', 'lessons').map(tb => <DataTableHTML key={tb.title} table={tb} t={t} />)}
    </Shell>
  )
}

/* ---------------- C15 一图流 ---------------- */
function LongHTML({ report }: { report: FrozenReport }) {
  const t = themeOf(report)
  const blocks = visibleBlocks(report)
  return (
    <Shell report={report} t={t}>
      {blocks.map((b, i) => (
        <section key={i}>
          <h3 className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: t.primary }}>
            <span className="inline-block h-4 w-1 rounded" style={{ background: t.primary }} />{b.title}
          </h3>
          <div className="mt-1 space-y-1 text-[13px] leading-[1.7]" style={{ color: INK }}>
            {b.lines.map((l, j) => <p key={j} className="whitespace-pre-wrap">{l}</p>)}
          </div>
        </section>
      ))}
      {tablesOf(report, 'classroom', 'homework', 'lessons', 'focus').map(tb => <DataTableHTML key={tb.title} table={tb} t={t} />)}
    </Shell>
  )
}

/* ---------------- P12 每周一信 ---------------- */
function LetterHTML({ report }: { report: FrozenReport }) {
  const t = themeOf(report)
  const comment = linesOf(report, 'comment')
  return (
    <Shell report={report} t={t}>
      <div className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: '#e2eae6' }}>
        <p className="text-[14px] font-medium" style={{ color: INK }}>{report.name}同学家长，您好！</p>
        <div className="mt-3 space-y-2.5 text-[13px] leading-[1.9]" style={{ color: INK }}>
          {comment.length
            ? comment.map((l, i) => <p key={i} className="whitespace-pre-wrap" style={{ textIndent: '2em' }}>{l}</p>)
            : <p style={{ color: FAINT }}>本周暂无评语。</p>}
        </div>
        <div className="mt-4 space-y-3 border-t pt-3" style={{ borderColor: '#eef1f0' }}>
          <div>
            <h4 className="text-[13px] font-semibold" style={{ color: t.primary }}>本周课堂与作业</h4>
            <div className="mt-1"><Bullets lines={linesOf(report, 'classroom', 'homework', 'highlights')} emptyHint="本周暂无记录" /></div>
          </div>
          <div>
            <h4 className="text-[13px] font-semibold" style={{ color: t.primary }}>下周安排</h4>
            <div className="mt-1"><Bullets lines={linesOf(report, 'next')} emptyHint="暂无" /></div>
          </div>
        </div>
        <p className="mt-5 text-right text-[13px]" style={{ color: MUTED }}>{report.teacher} · {report.period}</p>
      </div>
      {tablesOf(report, 'classroom', 'homework', 'lessons').map(tb => <DataTableHTML key={tb.title} table={tb} t={t} />)}
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
  return <ClassicHTML report={report} />
}
