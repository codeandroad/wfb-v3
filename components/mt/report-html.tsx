'use client'
import type { CSSProperties, ReactNode } from 'react'
import type { FrozenReport, ReportTable } from '@/lib/mt/reports'
import { visibleBlocks } from '@/lib/mt/reports'
import { classicMetadata, classicNotes, cellTarget, tableHeaders } from '@/lib/mt/report-elements'
import { reportOptions } from '@/lib/mt/report-options'
import { resolveElement, resolveCellBackground, type ElementStyle, type CellFact } from '@/lib/mt/report-customization'
import { darken } from '@/lib/mt/report-canvas-shared'
import {
  computeStats, pct, dayGroups, isAGradeText, isEmptyCell,
  gradeDistribution, studentSummaries, parseHighlights,
  extractChapter, extractChips, followUps,
} from '@/lib/mt/report-stats'

/* ================= 主题 ================= */
type HtmlTheme = {
  primary: string; pageBg: string; headerBg: string; headerText: string
  border: string; stripe: string; bodySize: number; tableSize: number; compact: boolean
}
const themeOf = (r: FrozenReport): HtmlTheme => {
  const o = reportOptions(r.template)
  return {
    primary: r.template.color, pageBg: r.template.background,
    headerBg: o.headerBackground, headerText: o.headerText,
    border: o.borderColor, stripe: o.stripeColor,
    bodySize: o.bodySize, tableSize: o.tableSize, compact: o.density === 'compact',
  }
}
const INK = '#263a33', MUTED = '#5f7168', FAINT = '#8a9a94'

/* ============ 元素细调 + 条件格式：与 canvas 同一套解析 ============ */
const toCSS = (s: ElementStyle): CSSProperties => ({
  ...(s.color ? { color: s.color } : {}),
  ...(s.background ? { background: s.background } : {}),
  ...(s.size ? { fontSize: s.size } : {}),
  ...(s.weight ? { fontWeight: s.weight } : {}),
  ...(s.align ? { textAlign: s.align } : {}),
  ...(s.padding !== undefined ? { padding: s.padding } : {}),
  ...(s.lineHeight ? { lineHeight: s.lineHeight } : {}),
})
/** 解析模板元素样式（细调覆盖 + 条件格式规则），回退给定的基础值 */
const el = (r: FrozenReport, target: string, base: ElementStyle, fact?: CellFact): CSSProperties =>
  toCSS(resolveElement(r.template.customization, target, base, fact))

/* ================= 数据 helpers ================= */
const linesOf = (r: FrozenReport, ...keys: string[]) =>
  visibleBlocks(r).filter(b => keys.includes(b.key)).flatMap(b => b.lines).map(s => s.trim()).filter(Boolean)
const tablesOf = (r: FrozenReport, ...kinds: string[]) => (r.tables ?? []).filter(t => kinds.includes(t.kind))
const matrixOf = (r: FrozenReport) => (r.tables ?? []).find(t => t.kind === 'classroom' && t.facts?.length)

/* ================= 通用数据表（主题 + 元素细调 + 条件格式） ================= */
function DataTableHTML({ report, table, t, showTitle }: { report: FrozenReport; table: ReportTable; t: HtmlTheme; showTitle?: boolean }) {
  const cust = report.template.customization
  const pad = t.compact ? 4 : 8
  const titleStyle = el(report, `${table.kind}.title`, { size: t.bodySize, weight: 600, color: t.primary })
  return (
    <section>
      {showTitle !== false && table.title ? <h3 className="mb-1 font-semibold" style={titleStyle}>{table.title}</h3> : null}
      <div className="overflow-x-auto rounded border" style={{ borderColor: t.border }}>
        <table className="w-full border-collapse leading-relaxed">
          <thead>
            {table.headers.map((row, ri) => (
              <tr key={ri}>
                {tableHeaders(table).filter(h => h.row === ri).map(({ header: c, col, field, target }) => {
                  const s = el(report, target, { size: t.tableSize, weight: 600, color: t.headerText, background: t.headerBg, padding: pad })
                  const bg = resolveCellBackground(cust, target) ?? s.background
                  return (
                    <th key={col} colSpan={c.span} rowSpan={c.rowSpan} className="whitespace-pre-wrap border font-semibold"
                      style={{ ...s, background: bg, borderColor: t.border }}>{c.text}</th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => {
                  const fact = table.facts?.[i]?.[j]
                  const target = cellTarget(table, j, 'body')
                  const s = el(report, target, {
                    size: t.tableSize, weight: 400, color: INK, background: t.pageBg,
                    padding: pad, align: 'center', lineHeight: 1.4,
                  }, fact)
                  const bg = resolveCellBackground(cust, target, fact) ?? (i % 2 ? t.stripe : s.background)
                  return (
                    <td key={j} className="whitespace-pre-wrap border align-top"
                      style={{ ...s, background: bg, borderColor: t.border }}>{cell}</td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ================= 说明区（元素细调生效） ================= */
function NotesHTML({ report, t }: { report: FrozenReport; t: HtmlTheme }) {
  const notes = classicNotes(report)
  if (!notes.length) return null
  return (
    <div className="space-y-4">
      {notes.map((b, i) => {
        const titleStyle = el(report, `${b.key}.title`, { size: t.bodySize, weight: 600, color: t.primary, lineHeight: 1.5 })
        const bodyStyle = el(report, `${b.key}.body`, { size: t.bodySize, weight: 400, color: INK, lineHeight: 1.7 })
        return (
          <section key={i} style={titleStyle.background || bodyStyle.background ? { background: (bodyStyle.background ?? titleStyle.background) as string, borderRadius: 8, padding: 12 } : undefined}>
            <h3 className="font-semibold" style={{ ...titleStyle, background: undefined }}>{b.title}</h3>
            <div className="mt-1 space-y-1" style={{ ...bodyStyle, background: undefined }}>
              {b.lines.map((l, j) => <p key={j} className="whitespace-pre-wrap">{l.replace(/\*\*/g, '')}</p>)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/* ================= 经典模板：还原原始排布 ================= */
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
  const metaStyle = (id: string) => el(report, `metadata.${id}`, { size: 16, weight: 400, color: INK, lineHeight: 1.5 })
  return (
    <div className="w-full rounded-xl border p-5" style={{ background: t.pageBg, borderColor: t.border }}>
      <div className="space-y-1">
        {classicMetadata(report).map((text, i) => (
          <p key={i} className="whitespace-pre-wrap" style={metaStyle(['week', 'scope', 'teacher'][i] ?? 'custom')}>{text}</p>
        ))}
      </div>
      {notesFirst ? <div className="mt-4"><NotesHTML report={report} t={t} /></div> : null}
      {sidebar ? (
        <div className="mt-4 grid gap-6" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
          <div className="min-w-0 space-y-4">
            {main.map(tb => <DataTableHTML key={tb.title} report={report} table={tb} t={t} showTitle={main.length > 1} />)}
          </div>
          <div className="min-w-0"><NotesHTML report={report} t={t} /></div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {main.map(tb => <DataTableHTML key={tb.title} report={report} table={tb} t={t} showTitle={main.length > 1 || personal} />)}
          {!notesFirst ? <NotesHTML report={report} t={t} /> : null}
        </div>
      )}
      {appendices.length ? (
        <div className="mt-4 space-y-4">
          {appendices.map(tb => <DataTableHTML key={tb.title} report={report} table={tb} t={t} />)}
        </div>
      ) : null}
    </div>
  )
}

/* ================= 新样式通用件 ================= */
function Foot({ report }: { report: FrozenReport }) {
  return <p className="py-4 text-center text-[12px]" style={{ color: FAINT }}>{report.teacher} · {report.period}</p>
}

/* ================= C11 微信三卡片（对标 preview.html 样式二） ================= */
function CardsHTML({ report }: { report: FrozenReport }) {
  const t = themeOf(report)
  const teaching = linesOf(report, 'teaching')
  const highlights = parseHighlights(report)
  const next = linesOf(report, 'next')
  const chapter = extractChapter(report)
  const chips = extractChips(report)
  const summaries = studentSummaries(report)
  const fu = followUps(report)
  const cardTitle = (target: string, fallback: string) =>
    el(report, target, { size: 18, weight: 600, color: INK })
  const kickerStyle: CSSProperties = { fontSize: 12, letterSpacing: 2, color: '#b98a2f', fontWeight: 700, marginBottom: 8 }
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 430 }}>
      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: t.border }}>
        <div className="px-5 py-4 text-white" style={{ background: `linear-gradient(135deg,${t.primary},${darken(t.primary)})` }}>
          <h2 className="text-[17px] font-semibold">{report.name} · 班级周反馈</h2>
          <p className="mt-0.5 text-[11px]" style={{ color: '#dcebe4' }}>{classicMetadata(report).filter(Boolean).join(' · ')}</p>
        </div>
        <div className="space-y-3 p-4" style={{ background: '#f3f6f5' }}>
          {/* 卡1：学了什么 */}
          <section className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eee9db' }}>
            <div style={kickerStyle}>本周学了什么</div>
            <h3 style={cardTitle('brief.card.learn.title', '')}>{chapter ?? '本周教学内容'}</h3>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: '#4a463c' }}>{teaching[0] ?? '本周暂无教学记录'}</p>
            {chips.length >= 2 ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {chips.map((c, i) => (
                  <span key={i} className="rounded-full px-3 py-1 text-[13px]" style={{ background: '#eef4ec', color: t.primary }}>{c}</span>
                ))}
              </div>
            ) : null}
          </section>
          {/* 卡2：高光 */}
          <section className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eee9db' }}>
            <div style={kickerStyle}>本周高光</div>
            <h3 style={cardTitle('brief.card.stars.title', '')}>值得点赞的他们</h3>
            {highlights.length ? (
              <ul className="mt-2 space-y-3">
                {highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex size-9 flex-none items-center justify-center rounded-full text-[15px] font-bold text-white"
                      style={{ background: [t.primary, '#b98a2f', '#5a8a9a', '#8a5a9a'][i % 4] }}>{(h.name || '赞')[0]}</span>
                    <div><b className="text-[14px]" style={{ color: INK }}>{h.name || '同学'}</b>
                      <small className="block text-[13px]" style={{ color: FAINT }}>{h.reason}</small></div>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-[13px]" style={{ color: FAINT }}>本周暂无高光记录</p>}
          </section>
          {/* 卡3：配合 */}
          <section className="rounded-2xl p-5 shadow-sm" style={{ background: `linear-gradient(135deg,${t.primary},${darken(t.primary, 0.85)})` }}>
            <div style={{ ...kickerStyle, color: '#ffe9a8' }}>需要您配合</div>
            <p className="text-[14px] leading-relaxed" style={{ color: '#f2f7f1' }}>
              {next[0] ?? '暂无特别事项。'}{fu.homework.length ? `另有 ${fu.homework.length} 位同学作业未交，已单独提醒。` : ''}
            </p>
          </section>
          {/* 折叠汇总表 */}
          {summaries.length ? (
            <details className="rounded-2xl border bg-white p-4" style={{ borderColor: '#eee9db' }}>
              <summary className="cursor-pointer text-[14px] font-semibold" style={{ color: t.primary }}>查看详细出勤与成绩表</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead><tr style={{ background: t.headerBg }}>
                    {['姓名', '出勤', '课堂表现', '作业'].map(h => (
                      <th key={h} className="border-b px-2 py-1.5 text-left font-semibold" style={{ borderColor: '#f0ece1', color: FAINT }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {summaries.map(s => (
                      <tr key={s.name} className="border-b" style={{ borderColor: '#f0ece1' }}>
                        <td className="px-2 py-1.5" style={{ color: INK }}>{s.name}</td>
                        <td className="px-2 py-1.5" style={{ color: /正常/.test(s.attendance) && s.attendance === '正常' ? INK : '#b98a2f' }}>{s.attendance}</td>
                        <td className="px-2 py-1.5" style={{ color: INK }}>{s.classroom}</td>
                        <td className="px-2 py-1.5" style={{ color: /未交/.test(s.homework) ? '#c0392b' : INK }}>{s.homework}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </div>
        <Foot report={report} />
      </div>
    </div>
  )
}

/* ================= C12 班级仪表盘（对标 preview.html 样式三） ================= */
function DashboardHTML({ report }: { report: FrozenReport }) {
  const t = themeOf(report)
  const s = computeStats(report)
  const dist = gradeDistribution(report)
  const badges = parseHighlights(report)
  const fu = followUps(report)
  const next = linesOf(report, 'next')
  const maxCount = Math.max(1, ...dist.map(d => d.count))
  const tiles = [
    { num: pct(s.attNormal, s.attTotal) ?? '–', lbl: '本周出勤率', sub: s.attTotal ? `异常 ${s.attTotal - s.attNormal} 人次` : '' },
    { num: pct(s.hwDone, s.hwTotal) ?? '–', lbl: '作业提交率', sub: s.hwTotal ? `${s.hwTotal - s.hwDone} 人次待补交` : '' },
    { num: pct(s.clsA, s.clsTotal) ?? '–', lbl: '课堂 A 及以上', sub: s.clsTotal ? `${s.clsTotal} 人次` : '' },
  ]
  const panel: CSSProperties = { background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #eee9db' }
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 760 }}>
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: t.border }}>
        <div className="px-6 py-5 text-white" style={{ background: `linear-gradient(135deg,${t.primary},${darken(t.primary)})` }}>
          <h2 className="text-[19px] font-semibold">{report.name} · 班级仪表盘</h2>
          <p className="mt-1 text-[12px]" style={{ color: '#dcebe4' }}>{classicMetadata(report).filter(Boolean).join(' ｜ ')}</p>
        </div>
        <div className="space-y-3 p-4" style={{ background: '#f3f6f5' }}>
          <div className="grid grid-cols-3 gap-3">
            {tiles.map(x => (
              <div key={x.lbl} className="rounded-2xl border bg-white px-3 py-4 text-center shadow-sm" style={{ borderColor: '#eee9db' }}>
                <div className="text-[28px] font-extrabold" style={{ color: t.primary }}>{x.num}</div>
                <div className="mt-1 text-[12px] font-medium" style={{ color: INK }}>{x.lbl}</div>
                {x.sub ? <div className="text-[11px]" style={{ color: FAINT }}>{x.sub}</div> : null}
              </div>
            ))}
          </div>
          {dist.length ? (
            <section style={panel}>
              <h3 className="mb-3 text-[15px] font-semibold" style={{ color: INK }}>课堂表现等级分布（三天综合 · {s.clsTotal} 人次）</h3>
              {dist.map(d => (
                <div key={d.grade} className="mb-2 flex items-center gap-2.5 text-[13px]">
                  <span className="w-8 flex-none font-bold" style={{ color: MUTED }}>{d.grade}</span>
                  <div className="h-3.5 flex-1 overflow-hidden rounded-full" style={{ background: '#f2efe9' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.round((d.count / maxCount) * 100)}%`, background: `linear-gradient(90deg,${t.primary}99,${t.primary})` }} />
                  </div>
                  <span className="w-10 flex-none text-right" style={{ color: FAINT }}>{d.count}</span>
                </div>
              ))}
            </section>
          ) : null}
          {badges.length ? (
            <section style={panel}>
              <h3 className="mb-3 text-[15px] font-semibold" style={{ color: INK }}>本周徽章</h3>
              <div className="grid grid-cols-2 gap-3">
                {badges.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border p-3.5" style={{ borderColor: '#eee9db', background: '#faf8f2' }}>
                    <span className="flex size-11 flex-none items-center justify-center rounded-full text-[19px] font-extrabold text-white"
                      style={{ background: [t.primary, '#b98a2f', '#5a8a9a', '#8a5a9a'][i % 4] }}>{(b.name || '赞')[0]}</span>
                    <div><b className="block text-[14px]" style={{ color: INK }}>{b.name || '同学'}</b>
                      <small className="text-[12px]" style={{ color: FAINT }}>{b.reason}</small></div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <section style={panel}>
            <h3 className="mb-2 text-[15px] font-semibold" style={{ color: INK }}>待跟进</h3>
            <ul className="space-y-2 text-[13.5px]" style={{ color: '#4a463c' }}>
              <li>作业待补交：{fu.homework.length ? fu.homework.join('、') : '无'}</li>
              <li>出勤异常：{fu.leave.length ? fu.leave.join('、') : '无'}</li>
              <li>下周预告：{next[0] ?? '暂无'}</li>
            </ul>
          </section>
          {tablesOf(report, 'classroom', 'homework', 'lessons').map(tb => <DataTableHTML key={tb.title} report={report} table={tb} t={t} />)}
        </div>
        <Foot report={report} />
      </div>
    </div>
  )
}

/* ================= C13 / P11 时间轴 ================= */
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
          const att = row[g.columns[0]], clsCol = g.columns[1]
          if (att?.field === 'attendance' && att.status) {
            attTotal++
            if (att.status === 'NORMAL') normal++
            else abnormal.push(`${names[i]}${ATT_TXT[att.status] ?? ''}`)
          }
          if (row[clsCol]?.field === 'classroom') {
            const text = table.rows[i]?.[clsCol] ?? ''
            if (!isEmptyCell(text) && isAGradeText(text)) stars.push(names[i])
          }
        })
        const lines = [`出勤 ${normal}/${attTotal} 正常${abnormal.length ? `（${abnormal.join('、')}）` : ''}`]
        if (stars.length) lines.push(`课堂之星：${stars.join('、')}`)
        nodes.push({ label: g.label, lines })
      }
    }
  }
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 640 }}>
      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: t.border }}>
        <div className="px-5 py-4 text-white" style={{ background: `linear-gradient(135deg,${t.primary},${darken(t.primary)})` }}>
          <h2 className="text-[17px] font-semibold">{report.name} · 一周历程</h2>
          <p className="mt-0.5 text-[11px]" style={{ color: '#dcebe4' }}>{classicMetadata(report).filter(Boolean).join(' · ')}</p>
        </div>
        <div className="p-4" style={{ background: '#f3f6f5' }}>
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
          <div className="mt-3 space-y-3">
            {tablesOf(report, 'classroom', 'homework', 'lessons').map(tb => <DataTableHTML key={tb.title} report={report} table={tb} t={t} />)}
          </div>
        </div>
        <Foot report={report} />
      </div>
    </div>
  )
}

/* ================= C14 快问快答 ================= */
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
    <div className="mx-auto w-full" style={{ maxWidth: 640 }}>
      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: t.border }}>
        <div className="px-5 py-4 text-white" style={{ background: `linear-gradient(135deg,${t.primary},${darken(t.primary)})` }}>
          <h2 className="text-[17px] font-semibold">{report.name} · 快问快答</h2>
          <p className="mt-0.5 text-[11px]" style={{ color: '#dcebe4' }}>{classicMetadata(report).filter(Boolean).join(' · ')}</p>
        </div>
        <div className="space-y-3 p-4" style={{ background: '#f3f6f5' }}>
          {qas.length ? qas.map((qa, i) => (
            <div key={i} className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: '#e2eae6' }}>
              <h3 className="text-[14px] font-semibold" style={el(report, 'brief.qa.question', { color: t.primary })}>Q：{qa.q}</h3>
              <div className="mt-1.5 border-t pt-2 text-[13px] leading-[1.7]" style={{ borderColor: '#eef1f0', color: INK }}>
                {qa.lines.map((l, j) => <p key={j} className="whitespace-pre-wrap">A：{l}</p>)}
              </div>
            </div>
          )) : <p className="text-[13px]" style={{ color: FAINT }}>本周暂无问答内容</p>}
          {tablesOf(report, 'classroom', 'homework', 'lessons').map(tb => <DataTableHTML key={tb.title} report={report} table={tb} t={t} />)}
        </div>
        <Foot report={report} />
      </div>
    </div>
  )
}

/* ================= C15 一图流 ================= */
function LongHTML({ report }: { report: FrozenReport }) {
  const t = themeOf(report)
  const blocks = visibleBlocks(report)
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 640 }}>
      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: t.border }}>
        <div className="px-5 py-4 text-white" style={{ background: `linear-gradient(135deg,${t.primary},${darken(t.primary)})` }}>
          <h2 className="text-[17px] font-semibold">{report.name} · 一图流</h2>
          <p className="mt-0.5 text-[11px]" style={{ color: '#dcebe4' }}>{classicMetadata(report).filter(Boolean).join(' · ')}</p>
        </div>
        <div className="space-y-4 p-4" style={{ background: '#f3f6f5' }}>
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
          {tablesOf(report, 'classroom', 'homework', 'lessons', 'focus').map(tb => <DataTableHTML key={tb.title} report={report} table={tb} t={t} />)}
        </div>
        <Foot report={report} />
      </div>
    </div>
  )
}

/* ================= P12 每周一信 ================= */
function LetterHTML({ report }: { report: FrozenReport }) {
  const t = themeOf(report)
  const comment = linesOf(report, 'comment')
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 640 }}>
      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: t.border }}>
        <div className="px-5 py-4 text-white" style={{ background: `linear-gradient(135deg,${t.primary},${darken(t.primary)})` }}>
          <h2 className="text-[17px] font-semibold">致家长的一封信</h2>
          <p className="mt-0.5 text-[11px]" style={{ color: '#dcebe4' }}>{classicMetadata(report).filter(Boolean).join(' · ')}</p>
        </div>
        <div className="space-y-3 p-4" style={{ background: '#f3f6f5' }}>
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
                <div className="mt-1 text-[13px] leading-relaxed" style={{ color: INK }}>
                  {linesOf(report, 'classroom', 'homework', 'highlights').map((l, i) => <p key={i} className="whitespace-pre-wrap">• {l}</p>)}
                </div>
              </div>
              <div>
                <h4 className="text-[13px] font-semibold" style={{ color: t.primary }}>下周安排</h4>
                <div className="mt-1 text-[13px]" style={{ color: INK }}>
                  {linesOf(report, 'next').map((l, i) => <p key={i} className="whitespace-pre-wrap">• {l}</p>)}
                </div>
              </div>
            </div>
            <p className="mt-5 text-right text-[13px]" style={{ color: MUTED }}>{report.teacher} · {report.period}</p>
          </div>
          {tablesOf(report, 'classroom', 'homework', 'lessons').map(tb => <DataTableHTML key={tb.title} report={report} table={tb} t={t} />)}
        </div>
        <Foot report={report} />
      </div>
    </div>
  )
}

/* ================= 总分发 ================= */
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
