import { feedbackPeriodId, weekDates, membersInWeek, type Publication } from './model'
import { entryKey } from './store'
import type { MtBiz } from './store'

export function parsePublicationDeadline(value: string): string | null {
  const text = value.trim().replace(' ', 'T')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return null
  const date = new Date(`${text}:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,16) !== text) return null
  return `${text}:00+08:00`
}

export interface PublicationPolicy {
  taskId: string
  periodId: string
  deadline?: string | null
  requirements?: { classReport: boolean; allPersonal: boolean; summary: boolean; instruction: string } | null
  actor: string
  at: string
  reason: string
}
export function publicationPolicy(b: MtBiz, taskId: string, week: number) {
  const rows = (b.publicationPolicies ?? []).filter(p => p.taskId === taskId && p.periodId === feedbackPeriodId(week))
  return {
    deadline: rows.filter(p => p.deadline !== undefined).at(-1)?.deadline ?? `${weekDates(week)[6]}T23:59:59+08:00`,
    requirements: rows.filter(p => p.requirements !== undefined).at(-1)?.requirements ?? null,
  }
}
export function publicationPolicyErrors(b: MtBiz, taskIds: string[], week: number, reports: Publication['reports']) {
  const errors: string[] = []
  for (const id of taskIds) {
    const req = publicationPolicy(b, id, week).requirements
    if (!req) continue
    const parent = (reports ?? []).filter(r => r.audience === 'parent')
    if (req.classReport && !parent.some(r => r.kind === 'class')) errors.push('教务要求包含班级反馈报告。')
    if (req.allPersonal && membersInWeek(b.memberships[id] ?? [], week).some(student => !parent.some(r => r.kind === 'personal' && r.studentId === student))) errors.push('教务要求为本周全部适用学生生成个人报告。')
    const summary = b.summaries[entryKey(id, week)]
    if (req.summary && ![summary?.teaching, summary?.learning].some(s => s?.trim())) errors.push('教务要求填写本周公共总结。')
  }
  return [...new Set(errors)]
}
