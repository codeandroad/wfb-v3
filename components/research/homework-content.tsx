"use client"

import { useState } from "react"
import Link from "next/link"
import { permittedTasks, useTeacherId, nameOf } from "@/lib/mt/derive"
import { isSubmitted, writeBlock } from "@/lib/mt/hw"
import type { Assignment } from "@/lib/mt/model"
import { useHomeworkWriters, useMt } from "@/lib/mt/store"
import { useResearchContext } from "@/lib/research/context"
import { preparedQuestionReadable } from "@/lib/research/homework"
import { isTeachingActor } from "@/lib/research/teaching"
import { testConversionReference } from "@/lib/research/evaluation"
import { canReadDocument, canViewGroup, itemReadable, itemText, type PreparedQuestion } from "@/lib/research/model"
import { RichText, SourceLinks, documentHref, control } from "./primitives"

export function HomeworkQuestionPreview({ questions }: { questions: PreparedQuestion[] }) {
  return <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">所选题目与教师评分资料 · {questions.length} 题</summary><div className="flex min-w-0 flex-col gap-4 pt-3">{questions.map(question => <QuestionRead key={question.id} question={question} />)}</div></details>
}

export function QuestionRead({ question }: { question: PreparedQuestion }) {
  const { state, actor } = useResearchContext()
  if (!preparedQuestionReadable(state, actor, question)) return <p className="text-sm text-muted-foreground">题目来源受独立授权限制，当前不开放正文或评分资料。原作业记录和已发布历史没有被删除。</p>
  const answerDocument = question.answer ? state.documents.find(d => d.id === question.answer!.documentId) : null
  const answer = answerDocument?.items.find(i => i.id === question.answer?.itemId)
  const answerAllowed = !!answerDocument && !!answer && canReadDocument(state, actor, answerDocument) && itemReadable(state, actor, answer, answerDocument.owner)
  const maxScore = question.scoringBasis ? question.scoringBasis.maxScore : question.maxScore
  return <article className="flex min-w-0 flex-col gap-3 text-sm"><h4 className="text-pretty font-semibold">{question.title}</h4>{question.stem && <RichText text={`共同题干：${question.stem}`} />}<RichText text={question.text} /><p className="text-muted-foreground">印刷页 {question.printedPage || "未提供"} · 文件页 {question.filePage || "未提供"} · 题 {question.question || "未提供"}{question.subquestion} · 满分 {maxScore === null ? "未提供" : `${maxScore} 分`}</p><RichText text={question.scoringBasis?.scoring ?? question.scoring || "未提供评分说明，不推定得分点。"} />{question.scoringBasis && <p className="text-muted-foreground">本人明确采用单题依据：{question.scoringBasis.title} v{question.scoringBasis.version} · {question.scoringBasis.source}</p>}{question.notes && <details><summary className="cursor-pointer text-primary">教师 Notes（不自动带入学生作业要求）</summary><RichText text={question.notes} /></details>}<SourceLinks owner={actor.staff} references={[question.source, ...question.references]} />{question.answer && (answerAllowed ? <details><summary className="cursor-pointer text-primary">查看本人有权读取的答案／评分资料</summary><RichText text={itemText(answer!)} /><Link className="text-primary underline" href={documentHref(answerDocument!, actor.staff, canViewGroup(state, actor, answerDocument!.owner))}>打开答案原资料</Link></details> : <p className="text-muted-foreground">答案使用独立授权，当前不提供正文、附件或可绕过授权的链接。</p>)}</article>
}

export function HomeworkSourceDetails({ assignment }: { assignment: Assignment }) {
  const mt = useMt()
  const teacher = useTeacherId()
  const { actor } = useResearchContext()
  if (!isTeachingActor(actor, teacher) || !permittedTasks(mt.biz, teacher).some(t => t.id === assignment.taskId)) return null
  if (!assignment.questionSources?.length && !assignment.gradeConversion) return null
  return <section className="flex flex-col gap-3" aria-label="作业来源与单次依据">{assignment.questionSources?.length ? <HomeworkQuestionPreview questions={assignment.questionSources} /> : null}{assignment.gradeConversion && <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-semibold">单次考核换算依据 · {assignment.gradeConversion.title} v{assignment.gradeConversion.version}</summary><div className="flex flex-col gap-2 pt-3"><p>明确考核：{assignment.gradeConversion.testName} · 仅绑定本作业 {assignment.id}</p><p>适用对象：{assignment.gradeConversion.participantIds.map(nameOf).join("、")}</p><p>来源：{assignment.gradeConversion.source}</p>{[...assignment.gradeConversion.thresholds].sort((a, b) => b.minimum - a.minimum).map(t => <p key={t.code}>最低 {t.minimum} 分 → {t.code} · {assignment.gradeConversion?.levels?.find(l => l.code === t.code)?.label || "等级含义未保存"}</p>)}<p className="text-muted-foreground">这里只提供已保存依据的换算参考，不改写整体作业质量评价、分数或已发布结果，不是 GPA。</p></div></details>}</section>
}

export function HomeworkQuestionScores({ assignment, studentId }: { assignment: Assignment; studentId: string }) {
  const mt = useMt()
  const teacher = useTeacherId()
  const { state, actor } = useResearchContext()
  if (!isTeachingActor(actor, teacher) || !permittedTasks(mt.biz, teacher).some(t => t.id === assignment.taskId) || !assignment.questionSources?.length) return null
  const result = assignment.results[studentId]
  const graded = Object.values(result?.questionScores ?? {}).filter(score => score !== null).length
  const blocked = !!writeBlock(assignment, studentId, Date.parse(mt.biz.clock)) || !isSubmitted(result?.submission) || (assignment.requirementOverrides[studentId] ?? assignment.defaultRequirement) === "EXEMPT" || result?.participating === false || !!result?.review
  return <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer text-primary">可选逐题评分 · 已评 {graded}/{assignment.questionSources.length}（不强制）</summary><div className="flex flex-col gap-4 pt-3"><p className="text-muted-foreground">整体质量评价继续使用原方案，不自动累计总分或填等级。留空为未评，明确填写 0 才是零分；沿用原名单、提交、豁免、未参与和录入锁定守卫。</p>{assignment.questionSources.map(question => {
    const readable = preparedQuestionReadable(state, actor, question)
    return <section className="flex flex-col gap-3" key={question.id}><QuestionRead question={question} />{readable && <QuestionScoreInput key={`${question.id}:${question.scoringBasis?.version || 0}`} assignment={assignment} question={question} studentId={studentId} disabled={blocked} />}</section>
  })}</div></details>
}

function QuestionScoreInput({ assignment, question, studentId, disabled }: { assignment: Assignment; question: PreparedQuestion; studentId: string; disabled: boolean }) {
  const writers = useHomeworkWriters()
  const saved = assignment.results[studentId]?.questionScores?.[question.id] ?? null
  const [raw, setRaw] = useState(saved === null ? "" : String(saved))
  const [error, setError] = useState("")
  const maxScore = question.scoringBasis ? question.scoringBasis.maxScore : question.maxScore
  const label = `${nameOf(studentId)} ${question.title} 得分（可选）`
  return <div className="flex flex-col gap-2"><label className="flex flex-wrap items-center gap-2 text-sm">{label}<input className={`${control} max-w-32`} aria-label={label} aria-invalid={!!error} type="number" min={0} max={maxScore ?? undefined} step="any" disabled={disabled} value={raw} onChange={e => { setRaw(e.target.value); setError("") }} onBlur={e => {
    const value = raw.trim() === "" ? null : Number(raw)
    if (e.currentTarget.validity.badInput || value !== null && (!Number.isFinite(value) || value < 0 || maxScore !== null && value > maxScore)) { setError("请填有效范围内的分数；未评留空，零分明确填 0。"); return }
    if (value !== saved) writers.setQuestionScore(assignment, studentId, question.id, value)
  }} /><span className="text-muted-foreground">{saved === null ? "未评" : `已保存 ${saved} 分`}</span></label>{saved !== null && maxScore !== null && saved > maxScore && <p role="alert" className="text-destructive">原分数高于当前明确采用的满分，保留原值供人工核对，没有自动重算。</p>}{error && <p role="alert" className="text-destructive">{error}</p>}</div>
}

export function TestGradeReference({ assignment, studentId }: { assignment: Assignment; studentId: string }) {
  const reference = testConversionReference(assignment, studentId)
  return reference ? <p className="text-sm text-muted-foreground">本次考核换算参考：{reference.text} · 保存依据 v{reference.version}（不等于作业质量评价，不自动写入或发布）</p> : null
}
