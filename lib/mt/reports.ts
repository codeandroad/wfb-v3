import { normalizeHex, reportOptions, validOptions, type ReportOptions } from './report-options'
import { validCustomization, type ReportCustomization, type CellFact } from './report-customization'
import type { MtBiz } from './store'
import type { Publication } from './model'

export type ReportKind = 'personal' | 'class'
export type ModuleKey = 'teaching' | 'learning' | 'classroom' | 'homework' | 'highlights' | 'comment' | 'next' | 'legend'
export const MODULES: Record<ModuleKey, string> = { teaching: '教学介绍', learning: '学情介绍', classroom: '课堂记录', homework: '作业表现', highlights: '亮点／表扬', comment: '教师评语', next: '作业与后续安排', legend: '评价说明' }
export type ReportTemplate = { customization?: ReportCustomization; archived?: boolean; options?: Partial<ReportOptions>; preset?: string; id: string; owner: string | null; kind: ReportKind; name: string; layout: 'brief' | 'letter' | 'timeline' | 'table'; color: string; background: string; font: 'sans' | 'serif'; bold: boolean; modules: ModuleKey[]; titles: Partial<Record<ModuleKey, string>>; opening: string; closing: string }
const keys = Object.keys(MODULES) as ModuleKey[]
const CLASSIC_PRESETS: [string, ReportKind, string][] = [
  ['P01', 'personal', '个人·标准跟进单'], ['P02', 'personal', '个人·表格详报'], ['P03', 'personal', '个人·家长沟通版'],
  ['C01', 'class', '经典边栏型'], ['C02', 'class', '上下分区型'], ['C03', 'class', '紧凑纯矩阵型'],
]
// 自定义样式模板：layout 声明目标呈现布局（brief 卡片 / timeline 时间轴 / letter 信件）；
// 在新布局的 canvas 渲染器落地前，先以 classic 表格渲染占位，保证模板中心可选、可预览、可发布。
const STYLE_PRESETS: { id: string; kind: ReportKind; name: string; layout: ReportTemplate['layout']; modules: ModuleKey[] }[] = [
  { id: 'C11', kind: 'class', name: '三卡片速览', layout: 'brief', modules: ['teaching', 'classroom', 'homework', 'highlights', 'next'] },
  { id: 'C12', kind: 'class', name: '仪表盘', layout: 'brief', modules: ['learning', 'classroom', 'homework', 'highlights', 'next'] },
  { id: 'C13', kind: 'class', name: '时间轴周报', layout: 'timeline', modules: ['teaching', 'classroom', 'homework', 'highlights', 'next'] },
  { id: 'C14', kind: 'class', name: '快问快答', layout: 'brief', modules: ['teaching', 'learning', 'classroom', 'homework', 'next'] },
  { id: 'C15', kind: 'class', name: '一图流长图', layout: 'brief', modules: ['teaching', 'learning', 'classroom', 'homework', 'highlights', 'next'] },
  { id: 'C16', kind: 'class', name: '班级周报', layout: 'brief', modules: ['teaching', 'learning', 'classroom', 'homework', 'highlights', 'next'] },
  { id: 'P11', kind: 'personal', name: '个人·成长档案', layout: 'timeline', modules: ['classroom', 'homework', 'highlights', 'comment', 'next'] },
  { id: 'P12', kind: 'personal', name: '个人·每周一信', layout: 'letter', modules: ['comment', 'classroom', 'homework', 'highlights', 'next'] },
]
const classicOptions = (id: string) => ({ classic: true, mode: id === 'C03' ? 'A' : 'B', notesPosition: id === 'C01' ? 'right' : 'bottom', highlightPlacement: 'merged', homeworkAppendix: false, gradeText: false, numbering: false, highlights: false, lessons: id === 'P02', padding: id === 'C03' ? 4 : 7, bodySize: id === 'C03' ? 14 : 16, density: id === 'C03' ? 'compact' : 'comfortable', homework: 'inline', emptyValue: 'dash' }) as const
const styleOptions = { classic: true, mode: 'B', notesPosition: 'bottom', highlightPlacement: 'merged', homeworkAppendix: false, gradeText: false, numbering: false, highlights: false, lessons: false, padding: 7, bodySize: 16, density: 'comfortable', homework: 'inline', emptyValue: 'dash' } as const
const baseTemplate = (id: string, kind: ReportKind, name: string, layout: ReportTemplate['layout'], modules: ModuleKey[], options: Record<string, unknown>): ReportTemplate => ({ id, preset: id, options: options as ReportTemplate['options'], owner: null, kind, name, layout, color: '#245f50', background: '#ffffff', font: 'sans', bold: true, modules, titles: {}, opening: '', closing: '' })
export const SYSTEM_TEMPLATES: ReportTemplate[] = [
  ...CLASSIC_PRESETS.map(([id, kind, name]) => baseTemplate(id, kind, name, 'table', (id === 'P03' ? ['comment', 'homework', 'classroom', 'highlights', 'teaching', 'next', 'legend'] as ModuleKey[] : keys).filter(k => kind === 'personal' || k !== 'comment'), classicOptions(id) as unknown as Record<string, unknown>)),
  ...STYLE_PRESETS.map(s => baseTemplate(s.id, s.kind, s.name, s.layout, s.modules, styleOptions as unknown as Record<string, unknown>)),
]
export function classicTemplate(t: ReportTemplate): ReportTemplate {
  t = { ...t, name: t.name.replace(/^班级\s*[·•]\s*/, '') }
  if (t.options?.classic) return t
  const preset=SYSTEM_TEMPLATES.find(s=>s.id===t.preset)||SYSTEM_TEMPLATES.find(s=>s.kind===t.kind)!
  return {...t,preset:preset.id,options:{...preset.options,...t.options,classic:true}}
}
export type ReportBlock = { key: ModuleKey; title: string; lines: string[] }
export type ReportTable = { fields?: string[]; columnKinds?: ('classroom' | 'homework' | 'lessons' | 'focus')[]; facts?: (CellFact|undefined)[][]; title: string; kind?: 'classroom' | 'homework' | 'lessons' | 'focus'; identityColumns?: number; groupSize?: number; headers: { text: string; field?: string; assignmentName?: string; span?: number; rowSpan?: number }[][]; rows: string[][] }
export type FrozenReport = { tables?: ReportTable[]; stage?: boolean; key: string; kind: ReportKind; audience: 'parent' | 'internal'; studentId?: string; name: string; scope: string; period: string; teacher: string; cutoff: string; template: ReportTemplate; blocks: ReportBlock[]; eligibleStudents: string[] }
export type Preparation = { personalOverrides?: Record<string,ReportCustomization>; classicVersion?: number; homeworkDates?: Record<string,string>; personalStyle?: ReportTemplate; classStyle?: ReportTemplate; observations?: { key: string; text: string }[]; comments?: string[]; focus?: { studentId: string; taskId: string; source: string; suggestion: string }[]; taskIds: string[]; personal: boolean; classReport: boolean; selected: string[]; personalTemplate: string; classTemplate: string; stage: boolean; omitUnverified: boolean; account: boolean; link: boolean }
export type Delivery = { reportKey: string; guardian: string; status: 'sent' | 'failed'; readAt?: string }
export type ReportLink = { token: string; reportKey: string; expires: string; disabled: boolean }
export type ReportingState = { themes?: import('./report-themes').ReportTheme[]; readEvents?: Record<string, string>; artifacts?: Record<string, { status: 'generating' | 'ready' | 'failed'; attempts: number; pages?: number; error?: string }>; templates: ReportTemplate[]; defaults: Record<string, Partial<Record<ReportKind, string>>>; preparations: Record<string, Preparation>; deliveries: Record<string, Delivery[]>; links: Record<string, ReportLink[]> }
export const EMPTY_REPORTING: ReportingState = { templates: [], defaults: {}, preparations: {}, deliveries: {}, links: {} }
export function reporting(b: MtBiz): ReportingState { return b.reporting ?? EMPTY_REPORTING }
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0)
  const x = luminance(normalizeHex(a)), y = luminance(normalizeHex(b))
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}
export function templateContrastWarnings(t: ReportTemplate): string[] {
  if (!validTemplate(t)) return []
  const o = reportOptions(t)
  return [
    [o.headerBackground, o.headerText, 4.5, '表头文字与背景'],
    [o.stripeColor, '#263a33', 4.5, '隔行背景与正文'],
    [t.background, '#263a33', 4.5, '报告背景与正文'],
    [t.background, t.color, 3, '主色与报告背景'],
  ].flatMap(([background, text, minimum, label]) => contrast(String(background), String(text)) < Number(minimum) ? [String(label)] : [])
}
export function validTemplate(t: ReportTemplate): boolean {
  return validCustomization(t.customization) && validOptions(t.options) && Object.keys(t).every(k => ['customization', 'archived', 'options', 'preset', 'id', 'owner', 'kind', 'name', 'layout', 'color', 'background', 'font', 'bold', 'modules', 'titles', 'opening', 'closing'].includes(k)) && ['personal', 'class'].includes(t.kind) && ['brief', 'letter', 'timeline', 'table'].includes(t.layout) && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t.color) && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t.background) && ['sans', 'serif'].includes(t.font) && t.modules.every(k => keys.includes(k) && (t.kind === 'personal' || k !== 'comment')) && new Set(t.modules).size === t.modules.length && Object.keys(t.titles).every(k => keys.includes(k as ModuleKey) && k !== 'teaching' && k !== 'learning')
}
export function sourceVersion(b: MtBiz): string {
  const value = JSON.stringify([b.observations, b.records, b.assignments, b.summaries, b.comments, b.highlights, b.memberships, b.revoked, b.schemes])
  let a = 2166136261, c = 5381
  for (let i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i), 16777619); c = Math.imul(c, 33) ^ value.charCodeAt(i) }
  return `${value.length}:${a >>> 0}:${c >>> 0}`
}
export function visibleBlocks(r: FrozenReport): ReportBlock[] {
  return r.template.modules.flatMap(key => r.blocks.filter(b => b.key === key && b.lines.length).map(b => ({ ...b, title: key === 'teaching' || key === 'learning' ? MODULES[key] : r.template.titles[key]?.trim() || b.title })))
}
export type Guardian = { id: string; name: string; studentIds: string[]; verified: boolean; active: boolean }
// Explicit, synthetic relationships; names and contacts never infer guardianship.
export function guardians(students: { id: string; has_verified_guardian_contact: boolean }[]): Guardian[] {
  const eligible = students.filter(s => s.has_verified_guardian_contact)
  const out: Guardian[] = eligible.map(s => ({ id: `demo-guardian-${s.id}`, name: `合成监护账户 ${s.id}`, studentIds: [s.id], verified: true, active: true }))
  if (eligible.length > 1) out.push({ id: 'demo-two-children', name: '合成双孩家长', studentIds: eligible.slice(0, 2).map(s => s.id), verified: true, active: true })
  if (eligible.length) out.push({ id: 'demo-second-guardian', name: '合成第二监护人', studentIds: [eligible[0].id], verified: true, active: true }, { id: 'demo-expired', name: '合成失效监护人', studentIds: [eligible[0].id], verified: true, active: false })
  return out.concat({ id: 'demo-unrelated', name: '合成无关家长', studentIds: [], verified: true, active: true })
}
export function canRead(r: FrozenReport, g: Guardian | undefined): boolean {
  return !!g && g.active && g.verified && r.audience === 'parent' && g.studentIds.some(s => r.eligibleStudents.includes(s)) && (r.kind !== 'personal' || g.studentIds.includes(r.studentId ?? ''))
}
export function readReport(b: MtBiz, guardianId: string, accounts: Guardian[], pubId: string, key: string, token?: string): { report?: FrozenReport; error?: string } {
  const pub = b.publications.find(p => p.id === pubId)
  const r = pub?.reports?.find(r => r.key === key)
  if (!pub || pub.withdrawn || !r || !canRead(r, accounts.find(g => g.id === guardianId))) return { error: '未登录、无有效监护关系或报告不可用。' }
  if (token) {
    const link = reporting(b).links[pubId]?.find(l => l.token === token && l.reportKey === key)
    if (!link || link.disabled || Date.parse(link.expires) <= Date.parse(b.clock)) return { error: '阅读链接已停用或过期。' }
  } else if (!reporting(b).deliveries[pubId]?.some(d => d.guardian === guardianId && d.reportKey === key && d.status === 'sent')) return { error: '该账户尚未收到此报告。' }
  return { report: structuredClone(r) }
}
export function reportDiff(previous: FrozenReport[] | undefined, next: FrozenReport[]): string[] {
  if (!previous) return ['首次使用新版报告；旧版快照完整保留']
  const changes: string[] = []
  for (const r of next) {
    const old = previous.find(p => p.key === r.key)
    if (!old) { changes.push(`${r.name}：新增${r.audience === 'internal' ? '校内核对' : r.kind === 'personal' ? '个人' : '班级'}报告`); continue }
    if (JSON.stringify(old.tables) !== JSON.stringify(r.tables)) changes.push(`${r.name}：课堂或作业明细变化`)
    if (JSON.stringify(old.template) !== JSON.stringify(r.template)) changes.push(`${r.name}：模板呈现修订`)
    if (JSON.stringify(old.eligibleStudents) !== JSON.stringify(r.eligibleStudents) || old.scope !== r.scope || old.stage !== r.stage) changes.push(`${r.name}：范围与受众变化`)
    for (const k of keys) if (JSON.stringify(old.blocks.find(b => b.key === k)?.lines) !== JSON.stringify(r.blocks.find(b => b.key === k)?.lines)) changes.push(`${r.name}：${MODULES[k]}变化`)
  }
  for (const old of previous) if (!next.some(r => r.key === old.key)) changes.push(`${old.name}：本版不纳入${old.kind === 'personal' ? '个人' : '班级'}报告，旧版保留`)
  return changes
}
export function reportFilename(pub: Publication, r: FrozenReport, part: number): string {
  return `${r.kind === 'personal' ? '个人' : r.audience === 'internal' ? '校内核对' : '班级'}-第${pub.week}周-${r.name}-${r.key}-V${pub.revision}-${part}.png`.replace(/[\\/:*?"<>|]/g, '_')
}
