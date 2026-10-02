import type { TaskWeek } from "@/lib/mt/derive"
import {
  ATT_LABEL,
  fmtMD,
  formalTaskName,
  feedbackPeriodId,
  hwStatus,
  lessonTimeLabel,
  studentById,
  uniq,
  WEEKDAY_CN,
  weekdayIdx,
  type Publication,
  type SnapDay,
  type SnapLegend,
  type SnapStudent,
  type StudentDay,
} from "@/lib/mt/model"
import { classroomRevFor, levelOf, parentText, revById } from "@/lib/mt/schemes"
import { entryKey, type MtBiz } from "@/lib/mt/store"

export interface Draft {
  publicSummary: string
  coverage: Record<string, string[]>
  assignmentIds: string[]
  excludedHomework: { assignmentId: string; studentId: string }[]
}

/** 家长可见等级文字：按所属修订的家长显示方式冻结 */
function parentGrade(revId: string, v: string | null): string | null {
  if (!v) return null
  const rev = revById(revId)
  const l = levelOf(rev, v)
  return rev && l ? parentText(rev, l) : v
}

function snapDay(d: StudentDay, prefix: string, revId: string): SnapDay {
  const status: SnapDay["status"] =
    d.state === "NOT_APPLICABLE"
      ? "NOT_APPLICABLE"
      : d.state === "PROCESSED"
        ? d.rec.gradeHandling === "EXPLICIT_EMPTY"
          ? "EXPLICIT_EMPTY"
          : "RECORDED"
        : "UNRECORDED"
  return {
    date: d.date,
    lessons: d.elapsed.map((l) => `${prefix}${lessonTimeLabel(l)}`),
    attendance: d.elapsed
      .filter((l) => d.rec.att[l.id])
      .map((l) => {
        const a = d.rec.att[l.id]
        const leave = a.origin === "APPROVED_LEAVE" ? d.leaves.find((x) => x.id === d.rec.leaveSourceId) : undefined
        return { lesson: `${prefix}第${l.period.number}节`, v: ATT_LABEL[a.v], outboundReason: leave?.outbound_reason ?? null }
      }),
    grade: d.rec.gradeHandling === "CONFIRMED" ? parentGrade(revId, d.rec.grade) : null,
    gradeRef: d.rec.gradeHandling === "CONFIRMED" && d.rec.grade ? { revId, levelId: d.rec.grade } : undefined,
    status,
  }
}

/** 由已保存事实生成不可变快照；内部原因、内部备注、他生信息不进入。 */
export function buildStudents(biz: MtBiz, tws: TaskWeek[], draft: Draft, base: Publication | null): SnapStudent[] {
  const nowTs = Date.parse(biz.clock)
  const multi = tws.length > 1
  const inScope = (tw: TaskWeek, sid: string) =>
    (tw.byStudent[sid] ?? []).some((d) => draft.coverage[tw.task.id]?.includes(d.date)) ||
    tw.assignments.some((a) => draft.assignmentIds.includes(a.id) && a.recipients.includes(sid))
  const sids = uniq(tws.flatMap((tw) => tw.students.filter((sid) => inScope(tw, sid))))
  return sids.map((sid) => {
    const st = studentById(sid)!
    const days: SnapDay[] = []
    for (const tw of tws) {
      const prefix = multi ? `${tw.task.label} ` : ""
      const revId = classroomRevFor(biz.schemes, tw.task.id, tw.task.teacher_id, feedbackPeriodId(tw.week), tw.week).revId
      for (const d of tw.byStudent[sid] ?? []) if (draft.coverage[tw.task.id]?.includes(d.date) && d.elapsed.length) days.push(snapDay(d, prefix, revId))
    }
    days.sort((a, b) => a.date.localeCompare(b.date))
    const homework = tws
      .flatMap((tw) => tw.assignments)
      .filter(
        (a) =>
          draft.assignmentIds.includes(a.id) &&
          a.recipients.includes(sid) &&
          !draft.excludedHomework.some((x) => x.assignmentId === a.id && x.studentId === sid),
      )
      .map((a) => {
        const q = a.results[sid]?.quality ?? null
        const qt = q && a.schemeRevId ? parentGrade(a.schemeRevId, q) : null
        const base = hwStatus(a, sid, nowTs).label
        return { assignmentId: a.id, title: a.title, status: qt ? `${base} · 质量 ${qt}` : base }
      })
    return {
      studentId: sid,
      name: st.name,
      homeroomId: st.homeroom_id,
      hasContact: base?.students.find((s) => s.studentId === sid)?.hasContact ?? st.has_verified_guardian_contact,
      days,
      homework,
      highlights: tws.flatMap((tw) => biz.highlights[entryKey(tw.task.id, tw.week, sid)]?.items.map((h) => h.text) ?? []),
      comment: tws
        .map((tw) => biz.comments[entryKey(tw.task.id, tw.week, sid)]?.text.trim() ?? "")
        .filter(Boolean)
        .join("\n"),
    }
  })
}

/** 发布时冻结本次快照涉及的标准图例，多任务、课堂与作业各自保留 */
export function buildLegends(biz: MtBiz, tws: TaskWeek[], draft: Draft): SnapLegend[] {
  const out: SnapLegend[] = []
  const push = (revId: string | null | undefined, purpose: SnapLegend["purpose"], scope: string) => {
    const rev = revById(revId)
    if (!rev || out.some((x) => x.revId === rev.id && x.purpose === purpose && x.scope === scope)) return
    out.push({ revId: rev.id, purpose, scope, name: rev.name, parentMode: rev.parentMode, levels: rev.levels.map((l) => ({ code: l.code, label: l.label, guide: l.guide })) })
  }
  for (const tw of tws) {
    if (draft.coverage[tw.task.id]?.length) push(classroomRevFor(biz.schemes, tw.task.id, tw.task.teacher_id, feedbackPeriodId(tw.week), tw.week).revId, "CLASSROOM", tw.task.label)
    for (const a of tw.assignments) if (draft.assignmentIds.includes(a.id)) push(a.schemeRevId, "HOMEWORK", tw.task.label)
  }
  return out
}

export function diffSnap(prev: Publication | null, summary: string, students: SnapStudent[]): string[] {
  if (!prev) return ["首次发布"]
  const out: string[] = []
  if (prev.publicSummary.trim() !== summary.trim()) out.push("公共总结已修改")
  for (const s of students) {
    const p = prev.students.find((x) => x.studentId === s.studentId)
    if (!p) {
      out.push(`${s.name}：本版新增纳入`)
      continue
    }
    for (const date of uniq(s.days.map((d) => d.date))) {
      const a = JSON.stringify(s.days.filter((d) => d.date === date))
      const b = p.days.filter((d) => d.date === date)
      if (!b.length) out.push(`${s.name} ${fmtMD(date)}：新增课堂日期`)
      else if (a !== JSON.stringify(b)) out.push(`${s.name} ${fmtMD(date)}：课堂记录更正`)
    }
    if (JSON.stringify(s.homework) !== JSON.stringify(p.homework)) out.push(`${s.name}：作业情况变化`)
    if (s.comment.trim() !== p.comment.trim()) out.push(`${s.name}：个体评语变化`)
    if (JSON.stringify(s.highlights) !== JSON.stringify(p.highlights)) out.push(`${s.name}：亮点变化`)
  }
  for (const p of prev.students) if (!students.some((s) => s.studentId === p.studentId)) out.push(`${p.name}：本版不再纳入`)
  return out
}

export function coverageNames(pub: Pick<Publication, "coverage" | "taskIds">): string {
  const dates = uniq(Object.values(pub.coverage).flat()).sort()
  return dates.length ? dates.map((d) => `${WEEKDAY_CN[weekdayIdx(d)]} ${fmtMD(d)}`).join("、") : "无课堂日期"
}

export function pubTitle(tws: TaskWeek[]) {
  return tws.map((tw) => formalTaskName(tw.task)).join(" + ")
}

/* ---------------- 图片生成（浏览器 Canvas，逐生，超长分页） ---------------- */

const W = 750
const PAGE_H = 1600
const PAD = 40

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = []
  for (const para of text.split("\n")) {
    let cur = ""
    for (const ch of para) {
      if (ctx.measureText(cur + ch).width > max) {
        lines.push(cur)
        cur = ch
      } else cur += ch
    }
    lines.push(cur)
  }
  return lines
}

export async function renderStudentImages(pub: Publication, s: SnapStudent): Promise<string[]> {
  type Row = { text: string; size: number; bold?: boolean; color?: string; gap?: number }
  const rows: Row[] = [
    { text: `${pub.classNameFormal} · ${pub.courseName}`, size: 30, bold: true },
    { text: `第 ${pub.week} 周教学反馈 · 第 ${pub.revision} 版`, size: 20, color: "#5c6b63", gap: 20 },
    { text: `学生：${s.name}`, size: 24, bold: true, gap: 14 },
  ]
  if (pub.publicSummary.trim()) rows.push({ text: "本周学习", size: 22, bold: true }, { text: pub.publicSummary, size: 20, gap: 14 })
  rows.push({ text: "课堂情况", size: 22, bold: true })
  if (!s.days.length) rows.push({ text: "本版不含课堂日期", size: 20, color: "#5c6b63" })
  for (const d of s.days) {
    const att = d.attendance.map((a) => `${a.lesson}${a.v}${a.outboundReason ? `（${a.outboundReason}）` : ""}`).join("，")
    const st = d.status === "UNRECORDED" ? "未记录" : d.status === "EXPLICIT_EMPTY" ? "不评价" : d.status === "NOT_APPLICABLE" ? "不适用" : `评价 ${d.grade ?? "—"}`
    rows.push({ text: `${WEEKDAY_CN[weekdayIdx(d.date)]} ${fmtMD(d.date)}  ${st}${att ? ` · ${att}` : ""}`, size: 19 })
  }
  rows[rows.length - 1].gap = 14
  if (s.homework.length) {
    rows.push({ text: "作业", size: 22, bold: true })
    for (const h of s.homework) rows.push({ text: `${h.title}：${h.status}`, size: 19 })
    rows[rows.length - 1].gap = 14
  }
  if (s.highlights.length) rows.push({ text: "亮点", size: 22, bold: true }, { text: s.highlights.join("；"), size: 19, gap: 14 })
  if (s.comment.trim()) rows.push({ text: "老师评语", size: 22, bold: true }, { text: s.comment, size: 19, gap: 14 })

  const measure = document.createElement("canvas").getContext("2d")!
  const laid: { text: string; size: number; bold?: boolean; color?: string; y: number }[] = []
  let y = PAD
  for (const r of rows) {
    measure.font = `${r.bold ? "600 " : ""}${r.size}px sans-serif`
    for (const line of wrap(measure, r.text, W - PAD * 2)) {
      laid.push({ ...r, text: line, y })
      y += Math.round(r.size * 1.55)
    }
    y += r.gap ?? 4
  }
  const pages = Math.max(1, Math.ceil((y + PAD) / PAGE_H))
  const urls: string[] = []
  for (let p = 0; p < pages; p++) {
    const c = document.createElement("canvas")
    const top = p * PAGE_H
    const h = Math.min(PAGE_H, y + PAD - top)
    c.width = W
    c.height = h + 40
    const ctx = c.getContext("2d")!
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, c.width, c.height)
    for (const l of laid) {
      if (l.y < top || l.y >= top + PAGE_H) continue
      ctx.font = `${l.bold ? "600 " : ""}${l.size}px sans-serif`
      ctx.fillStyle = l.color ?? "#1d2a24"
      ctx.textBaseline = "top"
      ctx.fillText(l.text, PAD, l.y - top)
    }
    ctx.font = "14px sans-serif"
    ctx.fillStyle = "#8a948f"
    ctx.fillText(`${pub.id} · ${p + 1}/${pages} · 原型演示输出`, PAD, h + 12)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"))
    if (!blob) throw new Error("图片编码失败")
    urls.push(URL.createObjectURL(blob))
  }
  return urls
}
