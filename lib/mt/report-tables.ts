import type { MtBiz } from './store'
import type { TaskWeek } from './derive'
import { ATT_LABEL, feedbackPeriodId, lessonTimeLabel, studentById, type StudentDay } from './model'
import { classroomRevFor, revById, levelOf, parentText } from './schemes'
import { hwStatus } from './hw'
import { validHighlights } from './publish'
import type { ReportTable } from './reports'

const dateText = (date: string) => `${['周日','周一','周二','周三','周四','周五','周六'][new Date(date + 'T12:00:00+08:00').getUTCDay()]} ${Number(date.slice(5,7))}/${Number(date.slice(8))}`
export function reportTables(b: MtBiz, tws: TaskWeek[], sid: string | undefined, templateId: string, excluded: { assignmentId: string; studentId: string }[] = []): ReportTable[] {
  const tables: ReportTable[] = []
  const now = Date.parse(b.clock)
  const header = (texts: string[]) => texts.map(text => ({ text }))
  for (const tw of tws) {
    const ids = sid ? tw.students.filter(id => id === sid) : tw.students
    const dates = [...new Set(tw.days.map(d => d.date))].sort()
    const rev = revById(classroomRevFor(b.schemes, tw.task.id, tw.task.teacher_id, feedbackPeriodId(tw.week), tw.week).revId)
    const attendance = (d: StudentDay | undefined) => !d || d.state === 'NOT_APPLICABLE' ? '不适用' : d.lessons.map(l => `${lessonTimeLabel(l)}：${l.startTs > now ? '未发生' : l.endTs > now ? '进行中' : d.rec.att[l.id] ? ATT_LABEL[d.rec.att[l.id].v] : '待核对'}`).join('\n')
    const grade = (d: StudentDay | undefined) => {
      if (!d || d.state === 'NOT_APPLICABLE') return '不适用'
      if (d.elig.kind === 'ABSENT') return '无需评价'
      if (!d.elapsed.length) return '未发生'
      if (d.handlingEff === 'EXPLICIT_EMPTY') return '明确不评价'
      const level = d.gradeEff && d.elig.kind === 'ELIGIBLE' && d.handlingEff === 'CONFIRMED' ? levelOf(rev, d.gradeEff) : null
      return level && rev ? parentText(rev, level) : '未记录'
    }
    if (sid) {
      tables.push({ title: `${tw.task.label} · 本周课堂记录`, headers: [header(['日期','涉及课次','出勤','本日课堂表现'])], rows: dates.map(date => { const d = tw.byStudent[sid]?.find(d => d.date === date); return [dateText(date), d?.lessons.map(lessonTimeLabel).join('\n') || '不适用', attendance(d), grade(d)] }) })
      if (templateId === 'P02') tables.push({ title: `${tw.task.label} · 课次明细`, headers: [header(['日期','课次与时间','出勤'])], rows: (tw.byStudent[sid] ?? []).flatMap(d => d.lessons.map(l => [dateText(d.date), lessonTimeLabel(l), d.state === 'NOT_APPLICABLE' ? '不适用' : l.startTs > now ? '未发生' : l.endTs > now ? '进行中' : d.rec.att[l.id] ? ATT_LABEL[d.rec.att[l.id].v] : '待核对'])) })
    } else {
      const split = templateId === 'C02'
      tables.push({ title: `${tw.task.label} · 课堂矩阵`, headers: split ? [[{text:'序号'}, {text:'姓名'}, ...dates.map(date => ({text:dateText(date),span:2})), {text:'亮点'}], header(['','',...dates.flatMap(() => ['出勤','课堂表现']),''])] : [header(['序号','姓名',...dates.map(dateText),'亮点'])], rows: ids.map((id,i) => [String(i+1), studentById(id)?.name ?? '未知姓名', ...dates.flatMap(date => { const d=tw.byStudent[id]?.find(d=>d.date===date); return split ? [attendance(d),grade(d)] : [`出勤：${attendance(d)}\n课堂：${grade(d)}`] }), validHighlights(b,tw,id).map(h=>h.text).join('\n')]) })
    }
    const assignments = tw.assignments
    tables.push({ title: `${tw.task.label} · 作业明细`, headers: [header([...(sid ? [] : ['姓名']), '作业','有效截止','提交情况','质量评价','已有分数','教师反馈'])], rows: ids.flatMap(id => assignments.filter(a=>a.recipients.includes(id) && !excluded.some(x=>x.assignmentId===a.id && x.studentId===id)).map(a=> {
      const r=a.results[id], status=hwStatus(a,id,now), scheme=revById(a.schemeRevId)
      const submitted=!!r?.submission && r.submission!=='MISSING' && !['EXEMPT','NOT_PARTICIPATING','NOT_APPLICABLE'].includes(status.s)
      const level=submitted && r.quality ? levelOf(scheme,r.quality) : null
      return [...(sid ? [] : [studentById(id)?.name ?? '未知姓名']),a.title,r?.extDeadline ?? a.deadline ?? '未设置',status.label,level && scheme ? parentText(scheme,level) : submitted ? r.noGrade ? '明确不评价' : '待评价' : '不适用',submitted && r.score != null ? String(r.score) : '无分数记录',r?.note ?? '']
    })) })
  }
  return tables
}
