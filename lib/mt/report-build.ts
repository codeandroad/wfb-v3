import { reportTables } from './report-tables'
import { reportOptions } from './report-options'
import { buildLegends, buildStudents, type Draft } from './publish'
import { type MtBiz, entryKey } from './store'
import type { TaskWeek } from './derive'
import { classOf, formalTaskName, studentById, uniq, weekDates, requirementOf, teacherName, SUBMISSION_LABEL, assignmentWeek, scheduleReadOfWeek } from './model'
import { hwStatus, hwBucket } from './hw'
import { levelOf, parentText, revById } from './schemes'
import { MODULES, type ModuleKey, type FrozenReport, type Preparation, type ReportTemplate } from './reports'

export function prepareReports(b: MtBiz, tws: TaskWeek[], p: Preparation, personal: ReportTemplate, classTemplate: ReportTemplate) {
  const now = Date.parse(b.clock)
  const roster = uniq(tws.flatMap(t => t.students))
  const assignments = [...new Map(tws.flatMap(t => [...t.assignments, ...b.assignments.filter(a => a.taskId === t.task.id && hwBucket(a, t.week, now) === 'LATER' && Date.parse(a.issuedAt) <= now)]).map(a => [a.id, a])).values()]
  const excluded = assignments.flatMap(a => a.recipients.filter(s => hwStatus(a, s, now).s === 'SUSPECTED_MISSING').map(studentId => ({ assignmentId: a.id, studentId })))
  const coverage = Object.fromEntries(tws.map(t => [t.task.id, uniq(t.days.filter(d => d.elapsed.length).map(d => d.date))]))
  const draft: Draft = { publicSummary: '', coverage, assignmentIds: assignments.map(a => a.id), excludedHomework: p.omitUnverified ? excluded : [] }
  const oldStudents = buildStudents(b, tws, draft, null)
  const students = roster.map(sid => oldStudents.find(s => s.studentId === sid) ?? { studentId: sid, name: studentById(sid)?.name ?? sid, homeroomId: studentById(sid)?.homeroom_id ?? '', hasContact: studentById(sid)?.has_verified_guardian_contact ?? false, days: [], homework: [], highlights: [], comment: tws.map(t => b.comments[entryKey(t.task.id, t.week, sid)]?.text ?? '').filter(Boolean).join('\n') })
  const common = (key: 'teaching' | 'learning') => tws.flatMap(t => {
    const value = b.summaries[entryKey(t.task.id, t.week)]?.[key]?.trim()
    return value ? [`${tws.length > 1 ? `${t.task.label}：` : ''}${value}`] : []
  })
  const legends = buildLegends(b, tws, draft).map(l => `${l.scope} · ${l.purpose === 'CLASSROOM' ? '课堂' : '作业'} · ${l.name}：${l.levels.map(x => `${x.code} ${x.label} ${x.guide}`).join('；')}`)
  const blocks = (data: Partial<Record<ModuleKey, string[]>>) => (Object.keys(data) as ModuleKey[]).filter(k => data[k]?.length).map(k => ({ key: k, title: MODULES[k], lines: data[k]! }))
  const scope = tws.map(t => formalTaskName(t.task)).join(' + ')
  const dates = weekDates(tws[0].week)
  const base = { stage: p.stage, scope, period: `第 ${tws[0].week} 周 · ${dates[0]}—${dates[6]}`, teacher: tws[0].task.teacher_id === 'TEACHER_BIG_DEMO' ? '示例林老师（大班演示）' : teacherName(tws[0].task.teacher_id), cutoff: b.clock }
  const result: FrozenReport[] = []
  for (const s of students.filter(s => p.personal && p.selected.includes(s.studentId))) {
    const homework: string[] = [], next: string[] = []
    for (const a of assignments.filter(a => a.recipients.includes(s.studentId))) {
      if (p.omitUnverified && excluded.some(x => x.assignmentId === a.id && x.studentId === s.studentId)) continue
      const r = a.results[s.studentId]
      const deadline = r?.extDeadline ?? a.deadline
      const state = hwStatus(a, s.studentId, now)
      if (assignmentWeek(a) > tws[0].week || (deadline && Date.parse(deadline) > now && !r?.submission)) {
        next.push(`${a.title} · ${requirementOf(a, s.studentId) === 'EXEMPT' ? '免做' : requirementOf(a, s.studentId) === 'OPTIONAL' ? '选做' : '必做'} · ${r?.extDeadline ? '批准延期至' : '截止'} ${deadline}${a.instructions ? `\n${a.instructions}` : ''}`)
        continue
      }
      const rev = revById(a.schemeRevId)
      const level = r?.quality && rev ? levelOf(rev, r.quality) : null
      const active = requirementOf(a, s.studentId) !== 'EXEMPT' && r?.participating !== false
      homework.push(`${a.title}：${state.s === 'GRADED' && r?.submission ? SUBMISSION_LABEL[r.submission] : state.label}${active && rev && level ? ` · 质量 ${parentText(rev, level)}` : ''}${active && r?.score != null ? ` · 分数 ${r.score}` : ''}${r?.note ? `\n${r.note}` : ''}${r?.extDeadline ? ` · 批准延期至 ${r.extDeadline}` : ''}`)
    }
    result.push({ ...base, key: `personal-${s.studentId}`, kind: 'personal', audience: 'parent', studentId: s.studentId, name: s.name, eligibleStudents: [s.studentId], template: structuredClone(personal), blocks: blocks({ teaching: common('teaching'), classroom: s.days.map(d => `${d.date} · ${d.status === 'RECORDED' ? `评价 ${d.grade}` : d.status === 'UNRECORDED' ? '未记录' : d.status === 'NOT_APPLICABLE' ? '不适用' : '明确不评价'}\n${d.attendance.map(a => `${a.lesson} ${a.v}`).join('；')}`), homework, next, comment: s.comment.trim() ? [s.comment] : [], highlights: s.highlights, legend: legends }) })
  }
  if (p.classReport) {
    const classReport: FrozenReport = { ...base, key: 'class-parent', kind: 'class', audience: 'parent', name: classOf(tws[0].task).name, eligibleStudents: roster, template: structuredClone(classTemplate), blocks: blocks({ teaching: common('teaching'), learning: common('learning'), classroom: tws.flatMap(t => uniq(t.days.filter(d => d.elapsed.length).map(d => d.date)).map(date => `${date} · ${t.task.label} · 已发生教学日（不表示全班出席）`)), next: assignments.filter(a => a.deadline && Date.parse(a.deadline) > now && roster.every(s => !a.recipients.includes(s) || requirementOf(a, s) === a.defaultRequirement)).map(a => `${a.title} · ${a.defaultRequirement === 'OPTIONAL' ? '选做' : '必做'} · 截止 ${a.deadline}${a.instructions ? `\n${a.instructions}` : ''}`) }) }
    result.push(classReport)
    result.push({ ...classReport, key: 'class-internal', audience: 'internal', eligibleStudents: [], blocks: [...classReport.blocks, ...blocks({ homework: students.map(s => `${s.name}\n${s.days.map(d => `${d.date} ${d.grade ?? ({ UNRECORDED: '未记录', NOT_APPLICABLE: '不适用', EXPLICIT_EMPTY: '明确不评价', RECORDED: '已记录' }[d.status])} ${d.attendance.map(a => `${a.lesson} ${a.v}`).join('；')}`).join('\n')}\n${s.homework.map(h => `${h.title} ${h.status}`).join('\n')}`) })] })
  }
  for (const report of result) {
    report.template = {...report.template,options:reportOptions(report.template)}
    const schedule = scheduleReadOfWeek(tws[0].week)
    if (schedule.status === 'ok' && schedule.exclusions?.length) report.blocks.push({key:'next',title:'校历安排',lines:schedule.exclusions.map(x=>`${x.date}：${x.reason}，不计缺勤或课堂评价。`)})
    report.tables = reportTables(b, tws, report.studentId, report.template, draft.excludedHomework, p)
    report.blocks = report.blocks.filter(block => !['classroom', 'homework'].includes(block.key) && (block.key !== 'comment' || (report.studentId && p.comments?.includes(report.studentId))))
    if (report.studentId && !reportOptions(report.template).lessons) {
      const lines=(p.observations??[]).flatMap(choice=>{const source=b.observations[choice.key];if(!source||!choice.text.trim())return [];const tw=tws.find(t=>t.task.id===source.taskId&&t.task.teacher_id===source.authorId);const day=tw?.byStudent[report.studentId!]?.find(d=>d.date===source.date&&d.lessons.some(l=>l.id===source.lessonId));return day&&day.state!=='NOT_APPLICABLE'&&day.elig.kind!=='ABSENT'&&(source.studentId===null||source.studentId===report.studentId)?[`${source.date} 第${source.periodNo}节：${choice.text.trim()}`]:[]})
      if(lines.length)report.blocks.push({key:'comment',title:'选入观察',lines})
    }
    if (report.kind === 'class') report.blocks.push({key:'legend',title:'评价说明',lines:legends})
    if (report.template.options?.normalShort || report.template.preset === 'C03') report.blocks.push({key:'legend',title:'出勤简写',lines:['√：已确认正常出勤；无需评价：当日全部适用课次已确认未出席。']})
  }
  result.sort((a,b) => Number(a.kind === 'personal') - Number(b.kind === 'personal') || Number(a.audience === 'internal') - Number(b.audience === 'internal'))
  return { reports: result, students: students.filter(s => p.personal && p.selected.includes(s.studentId)), roster, draft, excluded, legends }
}
