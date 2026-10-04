import type { MtBiz } from './store'
import type { Publication } from './model'

export type ReportKind = 'personal' | 'class'
export type ModuleKey = 'teaching' | 'learning' | 'classroom' | 'homework' | 'highlights' | 'comment' | 'next' | 'legend'
export const MODULES: Record<ModuleKey, string> = { teaching: '教学介绍', learning: '学情总结', classroom: '课堂记录', homework: '作业表现', highlights: '亮点／表扬', comment: '教师评语', next: '作业与后续安排', legend: '评价说明' }
export type ReportTemplate = { preset?: string; id: string; owner: string | null; kind: ReportKind; name: string; layout: 'brief' | 'letter' | 'timeline' | 'table'; color: string; background: string; font: 'sans' | 'serif'; bold: boolean; modules: ModuleKey[]; titles: Partial<Record<ModuleKey, string>>; opening: string; closing: string }
const keys = Object.keys(MODULES) as ModuleKey[]
export const SYSTEM_TEMPLATES: ReportTemplate[] = [
  ['P01', 'personal', '个人·周学习记录'], ['P02', 'personal', '个人·课堂与作业详报'], ['P03', 'personal', '个人·学习跟进报告'],
  ['C01', 'class', '班级·标准矩阵'], ['C02', 'class', '班级·清晰分列'], ['C03', 'class', '班级·紧凑对照'], ['C04', 'class', '班级·教学周报'],
].map(([id, kind, name]) => ({ id, preset: id, owner: null, kind: kind as ReportKind, name, layout: 'table', color: '#245f50', background: '#ffffff', font: 'sans', bold: true, modules: keys.filter(k => kind === 'personal' || k !== 'comment'), titles: {}, opening: '', closing: '' }))
export type ReportBlock = { key: ModuleKey; title: string; lines: string[] }
export type ReportTable = { title: string; headers: { text: string; span?: number }[][]; rows: string[][] }
export type FrozenReport = { tables?: ReportTable[]; stage?: boolean; key: string; kind: ReportKind; audience: 'parent' | 'internal'; studentId?: string; name: string; scope: string; period: string; teacher: string; cutoff: string; template: ReportTemplate; blocks: ReportBlock[]; eligibleStudents: string[] }
export type Preparation = { taskIds: string[]; personal: boolean; classReport: boolean; selected: string[]; personalTemplate: string; classTemplate: string; stage: boolean; omitUnverified: boolean; account: boolean; link: boolean }
export type Delivery = { reportKey: string; guardian: string; status: 'sent' | 'failed'; readAt?: string }
export type ReportLink = { token: string; reportKey: string; expires: string; disabled: boolean }
export type ReportingState = { readEvents?: Record<string, string>; artifacts?: Record<string, { status: 'generating' | 'ready' | 'failed'; attempts: number; pages?: number; error?: string }>; templates: ReportTemplate[]; defaults: Record<string, Partial<Record<ReportKind, string>>>; preparations: Record<string, Preparation>; deliveries: Record<string, Delivery[]>; links: Record<string, ReportLink[]> }
export const EMPTY_REPORTING: ReportingState = { templates: [], defaults: {}, preparations: {}, deliveries: {}, links: {} }
export function reporting(b: MtBiz): ReportingState { return b.reporting ?? EMPTY_REPORTING }
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0)
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05)
}
export function validTemplate(t: ReportTemplate): boolean {
  return Object.keys(t).every(k => ['preset', 'id', 'owner', 'kind', 'name', 'layout', 'color', 'background', 'font', 'bold', 'modules', 'titles', 'opening', 'closing'].includes(k)) && contrast(t.background, '#263a33') >= 4.5 && contrast(t.background, t.color) >= 3 && ['personal', 'class'].includes(t.kind) && ['brief', 'letter', 'timeline', 'table'].includes(t.layout) && /^#[0-9a-f]{6}$/i.test(t.color) && /^#[0-9a-f]{6}$/i.test(t.background) && ['sans', 'serif'].includes(t.font) && t.modules.every(k => keys.includes(k) && (t.kind === 'personal' || k !== 'comment')) && new Set(t.modules).size === t.modules.length && Object.keys(t.titles).every(k => keys.includes(k as ModuleKey) && k !== 'teaching' && k !== 'learning')
}
export function sourceVersion(b: MtBiz): string {
  const value = JSON.stringify([b.records, b.assignments, b.summaries, b.comments, b.highlights, b.memberships, b.revoked, b.schemes])
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
