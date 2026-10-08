"use client"

import Link from "next/link"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { useResearchContext } from "@/lib/research/context"
import { useResearchForm } from "@/lib/research/use-form"
import { activeAt, canReadDocument, coursesFor, groups, schoolScopes, type SchoolTask, type Task } from "@/lib/research/model"
import { Choices, DocumentRead, Panel, RField, RichText, documentHref } from "./primitives"

export function SchoolResearchPanel() {
  const { state, actor, people, catalog } = useResearchContext()
  const scope = [...new Set(schoolScopes(state, actor))]
  const manageScope = schoolScopes(state, actor, true)
  if (!scope.length) return null
  const appointments = state.appointments.filter(a => scope.includes(a.group) && activeAt(a.start, a.end, actor.date))
  const distinctPeople = new Set(appointments.map(a => a.staff))
  const shared = state.documents.filter(d => !d.archived && d.share.audience === "school" && canReadDocument(state, actor, d))

  return <section className="flex min-w-0 flex-col gap-5 py-6" aria-label="学校教研统筹">
    <Panel title="科组共建与学校任务" description="继续使用原课程目录；仅查看明确授权的科组、正式提交成果及明确共享内容。">
      <p>授权范围内有效成员去重 {distinctPeople.size} 人。跨组任命在各组分别显示，不按资料、评论或活动数量排名。</p>
      <p className="text-muted-foreground">下列任命和统筹范围为本机演示配置，不代表正式学校授权。进入同一工作区不自动获得成员身份、资料编辑权或学生记录权限。</p>
    </Panel>
    <div className="grid gap-4 md:grid-cols-2">
      {groups.filter(g => scope.includes(g.id)).map(g => {
        const members = appointments.filter(a => a.group === g.id)
        const leaders = members.filter(a => a.role === "组长")
        const courses = coursesFor(catalog, g.id)
        return <Panel key={g.id} title={g.name} description={catalog.subjects.find(s => s.code === g.subject)?.name || "学科关联待完善"} action={<Badge variant="outline">{manageScope.includes(g.id) ? "授权统筹" : "授权查看"}</Badge>}>
          <p>有效负责人：{leaders.map(a => people.find(p => p.id === a.staff)?.name || a.staff).join("、") || "尚无有效组长任命"}</p>
          <p>正式成员：{[...new Set(members.map(a => a.staff))].map(id => { const person = people.find(p => p.id === id); return `${person?.name || id}${person?.accountStatus !== "enabled" ? "（无可用账号）" : ""}` }).join("、") || "尚无有效成员任命"}</p>
          <p>有效责任课程：{courses.map(c => `${c.name} · ${c.board} ${c.officialCode}`).join("、") || "尚未维护有效责任课程"}</p>
          {(!leaders.length || !members.length) && <p className="text-muted-foreground">任命待完善：请使用原学校管理的教职工任命流程，不从任课或资格文字推定归组。</p>}
          <div className="flex flex-wrap gap-2"><Link className={buttonVariants({ variant: "outline" })} href={`/research?group=${g.id}&from=catalog`}>查看{g.name}工作区</Link><Link className={buttonVariants({ variant: "outline" })} href="/school?tab=staff">学校人员任命</Link></div>
        </Panel>
      })}
    </div>
    {manageScope.length > 0 && <SchoolTaskForm scope={manageScope} />}
    <Panel title="学校任务 · 各组承接与提交" description="来源关系共用：学校事项 → 各组承接 → 必要分工。学校不要求教师另交个人报告。">
      {state.schoolTasks.filter(t => t.groups.some(g => scope.includes(g))).map(t => <SchoolTaskProgress key={t.id} task={t} scope={scope} manageScope={manageScope} />)}
      {!state.schoolTasks.some(t => t.groups.some(g => scope.includes(g))) && <p className="text-muted-foreground">尚无授权范围内的学校任务，不显示虚构的完成率。</p>}
    </Panel>
    <Panel title="正式提交成果与校内共享资料" description="个人草稿和未共享资料不进入此列表；提交时内容快照与来源当前版本分别显示。">
      {shared.map(d => <Link key={d.id} className="self-start text-primary underline underline-offset-4" href={documentHref(d, actor.staff, scope.includes(d.owner))}>{d.kind} · {d.title} v{d.version} · 明确校内共享</Link>)}
      {!shared.length && <p className="text-muted-foreground">尚无可读取的校内共享资料。正式提交的成果见相应学校任务。</p>}
    </Panel>
    <Panel title="需要学校支持的问题" description="只汇总组内明确提交的协调问题，不汇总私人草稿、学生明细或未发布评价。">
      {state.issues.filter(i => scope.includes(i.group)).map(i => <SupportResponse key={i.id} id={i.id} canManage={manageScope.includes(i.group)} />)}
      {!state.issues.some(i => scope.includes(i.group)) && <p className="text-muted-foreground">尚无明确提交的协调问题。</p>}
    </Panel>
  </section>
}

function SchoolTaskForm({ scope }: { scope: string[] }) {
  const { actor, command } = useResearchContext()
  const form = useResearchForm("school-task-create", { title: "", groups: [] as string[], due: "", requirements: "", acceptance: false })
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  function submit() {
    const f = form.value
    const id = crypto.randomUUID()
    const selected = [...new Set(f.groups)]
    const task: SchoolTask = { id, title: f.title.trim(), groups: selected, due: f.due, requirements: f.requirements, acceptance: f.acceptance, createdBy: actor.staff, createdAt: actor.date }
    const groupTasks: Task[] = selected.map(group => ({ id: crypto.randomUUID(), title: task.title, group, parent: null, schoolTaskId: id, course: "", owner: "", collaborators: [], submitters: [], due: task.due, mode: "牵头提交", requirements: task.requirements, acceptance: task.acceptance, status: "待承接", outcomes: [], acceptedNote: "" }))
    const result = command({ type: "school-task", task, groupTasks })
    if (!result.ok) { setError(result.error); setMessage(""); return }
    form.reset(); setError(""); setMessage("已向所选科组分别下发；各组在同一事项上承接并引用已有成果。")
  }
  return <Panel title="下发一项学校教研任务" description="截止日期与交付说明可以留空，默认不验收；不会要求额外工时、百分比或完成报告。">
    <FieldGroup className="grid sm:grid-cols-2"><RField label="学校任务名称" value={form.value.title} onChange={title => form.set({ title })} /><RField label="学校任务截止日期（可选）" type="date" value={form.value.due} onChange={due => form.set({ due })} /><RField label="学校任务交付要求（可选）" type="textarea" value={form.value.requirements} onChange={requirements => form.set({ requirements })} /></FieldGroup>
    <Choices label="下发到获授权统筹的科组" options={groups.filter(g => scope.includes(g.id)).map(g => ({ value: g.id, label: g.name }))} value={form.value.groups} onChange={groups => form.set({ groups })} />
    <label className="flex items-center gap-2"><input type="checkbox" checked={form.value.acceptance} onChange={e => form.set({ acceptance: e.target.checked })} />本任务明确要求学校验收（默认不需要）</label>
    <Button className="self-start" disabled={!form.value.title.trim() || !form.value.groups.length} onClick={submit}>向所选科组下发</Button>
    {error && <p role="alert" className="text-destructive">{error}</p>}{message && <p role="status">{message}</p>}
  </Panel>
}

function SchoolTaskProgress({ task, scope, manageScope }: { task: SchoolTask; scope: string[]; manageScope: string[] }) {
  const { state, people, command } = useResearchContext()
  const [error, setError] = useState("")
  return <article className="flex flex-col gap-4 rounded-lg border p-4">
    <header className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-pretty font-semibold">{task.title}</h3><Badge variant="outline">{task.acceptance ? "明确需验收" : "无需额外审批"}</Badge></header>
    <p>来源标识：{task.id} · {task.due ? `截止 ${task.due}` : "未设截止"}</p>{task.requirements && <RichText text={task.requirements} />}
    {task.groups.filter(g => scope.includes(g)).map(group => {
      const root = state.tasks.find(t => t.schoolTaskId === task.id && t.group === group && !t.parent)
      const divisions = state.tasks.filter(t => t.schoolTaskId === task.id && t.group === group && t.parent)
      return <section className="flex flex-col gap-3 rounded-lg bg-muted p-4 text-foreground" key={group}>
        <h4 className="font-semibold">{groups.find(g => g.id === group)?.name} · {root?.status || "尚未建立承接事项"}</h4>
        <p>负责人：{people.find(p => p.id === root?.owner)?.name || "待本组承接确定"} · 必要分工 {divisions.length} 项（不要求所有分工完成才允许提交）</p>
        {divisions.map(d => <p key={d.id}>{d.title} · {people.find(p => p.id === d.owner)?.name || "负责人待确定"} · {d.status}</p>)}
        {(root?.outcomes ?? []).map(outcome => <details key={outcome.id}>
          <summary className="cursor-pointer text-primary">打开已提交成果：{outcome.title} v{outcome.version} · {people.find(p => p.id === outcome.submittedBy)?.name || outcome.submittedBy}</summary>
          <div className="flex flex-col gap-3 pt-4">{outcome.document ? <DocumentRead document={outcome.document} submittedSnapshot /> : <RichText text={`${outcome.activity?.type || "活动"}：${outcome.activity?.title || outcome.title}\n${outcome.activity?.start || ""}—${outcome.activity?.end || ""}\n研讨结论：${outcome.activity?.conclusion || "尚未整理"}`} />}<p className="text-muted-foreground">此处为提交时快照，不改写来源内容，也不开放来源个人资料或学生记录。</p></div>
        </details>)}
        {!root?.outcomes.length && <p className="text-muted-foreground">尚无正式提交成果，不把组内草稿当作已提交。</p>}
        {root?.status === "待验收" && manageScope.includes(group) && <Button className="self-start" onClick={() => { const result = command({ type: "review-task", id: root.id, note: "学校授权统筹人员明确验收本组成果" }); setError(result.ok ? "" : result.error) }}>验收{groups.find(g => g.id === group)?.name}本次提交</Button>}
        {root?.acceptedNote && <p>{root.acceptedNote}</p>}
        <Link className="self-start text-primary underline" href={`/research?group=${group}&tab=${encodeURIComponent("任务与协作")}&from=catalog`}>查看本组承接与分工</Link>
      </section>
    })}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </article>
}

function SupportResponse({ id, canManage }: { id: string; canManage: boolean }) {
  const { state, command } = useResearchContext()
  const issue = state.issues.find(i => i.id === id)!
  const form = useResearchForm(`school-support:${id}`, { response: issue.response })
  const [error, setError] = useState("")
  return <article className="flex flex-col gap-3 rounded-lg border p-4"><h3 className="font-semibold">{groups.find(g => g.id === issue.group)?.name} · {issue.title} · {issue.status}</h3><RichText text={issue.body} />{issue.response && <RichText text={`学校回复：${issue.response}`} />}{canManage && <><FieldGroup><RField label="学校协调回复" type="textarea" value={form.value.response} onChange={response => form.set({ response })} /></FieldGroup><Button variant="outline" className="self-start" disabled={!form.value.response.trim()} onClick={() => { const result = command({ type: "respond-support", id, response: form.value.response }); setError(result.ok ? "" : result.error) }}>保存明确协调回复</Button></>}{error && <p role="alert" className="text-destructive">{error}</p>}</article>
}
