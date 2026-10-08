"use client"

import { useState } from "react"
import Link from "next/link"
import { RegradeControl } from "@/components/mt/regrade-control"
import { Button, buttonVariants } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { permittedTasks, useTeacherId, nameOf } from "@/lib/mt/derive"
import { formalTaskName, weekOfDate, type STask } from "@/lib/mt/model"
import { setTaskOverride } from "@/lib/mt/scheme-ops"
import { useMt } from "@/lib/mt/store"
import { useClassroomStandard } from "@/lib/mt/use-schemes"
import { useResearchContext } from "@/lib/research/context"
import { useResearchForm } from "@/lib/research/use-form"
import { getResearch } from "@/lib/research/store"
import { canReadCriterion, courseTaskMap, coursesFor, type Criterion } from "@/lib/research/model"
import { bindQuestionScoringBasis, bindTestConversion, copyCriterionToScheme } from "@/lib/research/evaluation"
import { isTeachingActor } from "@/lib/research/teaching"
import { Choices, RSelect } from "./primitives"

export function CriterionAdoption({ criterion: c }: { criterion: Criterion }) {
  const mt = useMt()
  const teacher = useTeacherId()
  const { state, actor, catalog } = useResearchContext()
  const form = useResearchForm(`criterion-adopt:${c.id}:v${c.version}`, { taskId: "", assignmentId: "", questionId: "", participantIds: [] as string[], confirmed: false })
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const courses = coursesFor(catalog, c.group)
  const tasks = permittedTasks(mt.biz, teacher).filter(t => courses.some(course => courseTaskMap[course.code] === t.course_id))
  const task = tasks.find(t => t.id === form.value.taskId)
  const copied = Object.values(mt.biz.schemes.revs).find(r => r.researchBasis?.id === c.id && r.researchBasis.version === c.version)
  const dimensionScheme = c.kind === "课堂表现方案" || c.kind === "作业质量方案"
  const assignments = mt.biz.assignments.filter(a => tasks.some(t => t.id === a.taskId) && (a.status ?? "ACTIVE") === "ACTIVE" && (c.kind !== "题目评分依据" || a.questionSources?.some(q => [q.source, ...q.references].some(ref => ref.documentId === c.documentId && ref.itemId === c.itemId))))
  const assignment = assignments.find(a => a.id === form.value.assignmentId)
  const questions = assignment?.questionSources?.filter(q => [q.source, ...q.references].some(ref => ref.documentId === c.documentId && ref.itemId === c.itemId)) ?? []
  if (!isTeachingActor(actor, teacher) || !canReadCriterion(state, actor, c)) return null
  function copy() {
    const result = mt.command("本人明确保存科组评价依据", biz => {
      const copied = copyCriterionToScheme(biz, getResearch(), actor, teacher, c.id, c.version)
      return "error" in copied ? copied : copied.biz
    })
    setError(result.ok ? "" : result.error)
    setMessage(result.ok ? "已保存本人独立方案及完整依据；教师默认、当前课堂、既有作业和发布历史都未改变。" : "")
  }
  function bind() {
    if (!assignment || !form.value.confirmed) return
    if ((assignment.gradeConversion || questions.some(q => q.scoringBasis)) && !window.confirm("明确更换本次考核或所选单题的依据？已有分数、质量评价和发布历史保留，不自动重算。请随后人工核对。")) return
    const result = mt.command("明确绑定本次评分依据", biz => c.kind === "单次考核等级换算" ? bindTestConversion(biz, getResearch(), catalog, actor, teacher, { criterionId: c.id, version: c.version, assignmentId: assignment.id, participantIds: form.value.participantIds, confirmed: form.value.confirmed }) : bindQuestionScoringBasis(biz, getResearch(), actor, teacher, { criterionId: c.id, version: c.version, assignmentId: assignment.id, questionId: form.value.questionId, confirmed: form.value.confirmed }))
    setError(result.ok ? "" : result.error)
    setMessage(result.ok ? "已在原作业中保存明确依据及范围。原成绩、质量评价与已发布结果未被自动改写。" : "")
    if (result.ok) form.set({ confirmed: false })
  }
  return <details className="rounded-lg border p-4"><summary className="cursor-pointer text-primary">本人主动采用此依据（不自动影响现有记录）</summary><div className="flex flex-col gap-4 pt-4">
    {dimensionScheme ? <><p className="text-muted-foreground">先保存个人独立副本，再使用原有生效或重评控件。完整维度及含义保留；原方案名称长度规则仍适用。</p><Button className="self-start" disabled={!!copied} onClick={copy}>{copied ? `本人副本已保存：${copied.name}` : "复制到本人评价方案（不自动采用）"}</Button>{copied && <><FieldGroup><RSelect label="此评价依据的本人目标任务" value={form.value.taskId} options={tasks.map(t => ({ value: t.id, label: formalTaskName(t) }))} placeholder="仅列本组课程中的本人合法任教任务" onChange={taskId => form.set({ taskId })} /></FieldGroup>{task && (c.kind === "课堂表现方案" ? <ClassroomAdoption task={task} name={copied.name} /> : <><p className="text-muted-foreground">只用于本任务之后新布置的作业；现有每份作业的方案与结果不变。如需重评某份作业，请进入原作业更换方案流程。</p><Button className="self-start" onClick={() => { const result = mt.command("主动用于本任务新作业", biz => setTaskOverride(biz, teacher!, task.id, "HOMEWORK", copied.id)); setError(result.ok ? "" : result.error); setMessage(result.ok ? "已用于该任务后续新作业；既有作业与已发布历史不变。" : "") }}>明确用于该任务后续新作业</Button></>)}{task && <Link className={buttonVariants({ variant: "outline" })} href={`/teaching/task/${task.id}`}>打开原教学任务与评价流程</Link>}</>}</> : <><FieldGroup><RSelect label="评分依据绑定的具体作业／考核" value={form.value.assignmentId} options={assignments.map(a => ({ value: a.id, label: `${a.title} · ${formalTaskName(tasks.find(t => t.id === a.taskId)!)}` }))} placeholder="按保存对象绑定，不按考试名称猜测" onChange={assignmentId => form.set({ assignmentId, questionId: "", participantIds: [], confirmed: false })} /></FieldGroup>{assignment && (c.kind === "单次考核等级换算" ? <Choices label="本次换算适用的明确参与对象" value={form.value.participantIds} options={assignment.recipients.map(id => ({ value: id, label: nameOf(id) }))} onChange={participantIds => form.set({ participantIds, confirmed: false })} /> : <FieldGroup><RSelect label="本次评分的具体题目／小题" value={form.value.questionId} options={questions.map(q => ({ value: q.id, label: q.title }))} placeholder="仅列来源标识与本依据明确相同的题目" onChange={questionId => form.set({ questionId, confirmed: false })} /></FieldGroup>)}<label className="flex items-start gap-2"><input type="checkbox" checked={form.value.confirmed} onChange={e => form.set({ confirmed: e.target.checked })} />我已核对保存版本、具体考核／题目与适用对象；不自动重算原结果，不应用到整科或其他班级。</label><Button className="self-start" disabled={!assignment || !form.value.confirmed || (c.kind === "单次考核等级换算" ? !form.value.participantIds.length || !c.thresholds.length : !form.value.questionId)} onClick={bind}>明确保存本次评分依据与范围</Button>{c.kind === "单次考核等级换算" && !c.thresholds.length && <p className="text-muted-foreground">此依据尚未提供真实分数线，暂不能换算。不得用示例学校分数线或 GPA 补齐。</p>}{assignment && <Link className={buttonVariants({ variant: "outline" })} href={`/homework?hw=${encodeURIComponent(assignment.id)}`}>在原作业中核对依据与结果</Link>}</>}
    {!tasks.length && <p className="text-muted-foreground">当前没有本组课程中的本人合法任教任务，仍可参与共建；不会借科组读取权开放班级或学生资料。</p>}{error && <p role="alert" className="text-destructive">{error}</p>}{message && <p role="status">{message}</p>}
  </div></details>
}

function ClassroomAdoption({ task, name }: { task: STask; name: string }) {
  const { actor } = useResearchContext()
  const week = weekOfDate(actor.date)
  const standard = useClassroomStandard(task, week)
  return <section className="flex flex-col gap-3"><p>在下方原有控件中选择本人副本“{name}”。涉及已有课堂评价时，沿用原范围说明与一次明确重置确认；出勤、教学内容和发布历史不重算。</p><RegradeControl target={{ kind: "CLASSROOM", taskId: task.id, week }} currentRev={standard.revId} label={formalTaskName(task)} /></section>
}
