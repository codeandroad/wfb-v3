import type { ReportTemplate } from './reports'

export type ReportOptions = {
  showHomeworkName: boolean; homeworkDateMode: 'check'|'deadline'|'both'; lessonTimes: boolean;
  classic: boolean; notesPosition: 'right' | 'bottom'; highlightPlacement: 'off' | 'merged' | 'separate'; homeworkAppendix: boolean; emptyValue: 'dash' | 'blank'; teachingTitle: string; learningTitle: string; borderWeight: 'thin' | 'strong';
  mode: 'A' | 'B'; density: 'comfortable' | 'compact'; orientation: 'portrait' | 'landscape'; output: 'pages' | 'long';
  title: string; school: string; signature: string; dateFormat: 'short' | 'full';
  titleSize: number; bodySize: number; tableSize: number; lineHeight: number; align: 'left' | 'center';
  headerBackground: string; headerText: string; borderColor: string; stripeColor: string; emphasis: string;
  padding: number; borders: boolean; striped: boolean; numbering: boolean; homeroom: boolean; studentCode: boolean;
  highlights: boolean; homework: 'inline' | 'separate'; lessons: boolean; location: boolean; feedback: boolean; scores: boolean;
  gradeText: boolean; normalShort: boolean; combinedHomework: boolean; rowsPerPage: number; groupsPerPage: number;
}
export const BASE_OPTIONS: ReportOptions = {
  showHomeworkName:false,homeworkDateMode:'both',lessonTimes:true,
  classic: false, notesPosition: 'bottom', highlightPlacement: 'merged', homeworkAppendix: false, emptyValue: 'dash', teachingTitle: '教学介绍', learningTitle: '学情介绍', borderWeight: 'thin',
  mode: 'A', density: 'comfortable', orientation: 'landscape', output: 'pages', title: '', school: '', signature: '', dateFormat: 'short',
  titleSize: 26, bodySize: 16, tableSize: 16, lineHeight: 1.5, align: 'left', headerBackground: '#edf2ef', headerText: '#245f50', borderColor: '#cbd5ce', stripeColor: '#edf2ef', emphasis: '#245f50',
  padding: 10, borders: true, striped: true, numbering: true, homeroom: false, studentCode: false, highlights: true, homework: 'separate', lessons: false, location: false, feedback: true, scores: true,
  gradeText: true, normalShort: false, combinedHomework: false, rowsPerPage: 24, groupsPerPage: 4,
}
export function reportOptions(t: ReportTemplate): ReportOptions {
  const preset = t.preset ?? t.id
  return { ...BASE_OPTIONS, showHomeworkName:t.kind==='personal', mode: preset === 'C02' ? 'B' : 'A', orientation: t.kind === 'personal' ? 'portrait' : 'landscape', homework: preset === 'C01' ? 'inline' : 'separate', density: preset === 'C03' ? 'compact' : 'comfortable', padding: preset === 'C03' ? 5 : 10, normalShort: preset === 'C03', lessons: preset === 'P02', ...t.options }
}
export function normalizeHex(value: string) { return /^#[0-9a-f]{3}$/i.test(value) ? '#' + value.slice(1).split('').map(x => x+x).join('') : value }
export function validOptions(value: Partial<ReportOptions> | undefined): boolean {
  if (!value) return true
  const enums: Record<string, readonly string[]> = { homeworkDateMode:['check','deadline','both'],notesPosition:['right','bottom'],highlightPlacement:['off','merged','separate'],emptyValue:['dash','blank'],borderWeight:['thin','strong'],mode:['A','B'], density:['comfortable','compact'], orientation:['portrait','landscape'], output:['pages','long'], dateFormat:['short','full'], align:['left','center'], homework:['inline','separate'] }
  const numbers: Record<string, [number,number]> = {titleSize:[20,40],bodySize:[14,24],tableSize:[14,24],lineHeight:[1.4,2],padding:[4,20],rowsPerPage:[1,60],groupsPerPage:[1,7]}
  return Object.entries(value).every(([key,v]) => {
    if (!(key in BASE_OPTIONS)) return false
    if (enums[key]) return enums[key].includes(String(v))
    if (numbers[key]) return typeof v === 'number' && Number.isFinite(v) && v >= numbers[key][0] && v <= numbers[key][1]
    if (['headerBackground','headerText','borderColor','stripeColor','emphasis'].includes(key)) return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)
    if (typeof BASE_OPTIONS[key as keyof ReportOptions] === 'boolean') return typeof v === 'boolean'
    return typeof v === 'string' && v.length <= 100
  })
}
