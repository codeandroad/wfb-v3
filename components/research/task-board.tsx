"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { useResearchContext } from "@/lib/research/context"
import { useResearchForm } from "@/lib/research/use-form"
import { activeAt, canEditGroup, canLeadGroup, canReadActivity, canReadDocument, canRetainItem, coursesFor, itemReadable, type Task, type Outcome } from "@/lib/research/model"
import { Choices, DiscussionThread, DocumentRead, Panel, RField, RSelect, RichText } from "./primitives"

export function TaskBoard({ group }: { group: string }) {
  const { state,actor,catalog,command,people } = useResearchContext()
  const editable = canEditGroup(state,actor,group)
  const [error,setError] = useState("")
  const form = useResearchForm(`task-create:${group}`,{ title: "",owner: actor.staff,collaborators: [] as string[],submitters: [] as string[],mode: "牵头提交" as Task["mode"],course: "",due: "",requirements: "",acceptance: false,parent: "" })
  const tasks = state.tasks.filter(t => t.group === group)
  const members = [...new Set(state.appointments.filter(a => a.group === group && activeAt(a.start,a.end,actor.date)).map(a => a.staff))].map(id => ({ value: id,label: `${people.find(p => p.id === id)?.name || id}${people.find(p => p.id === id)?.accountStatus !== "enabled" ? "（账号不可用，不虚构线上提交）" : ""}` }))
  function create() {
    const f = form.value
    const parent = tasks.find(t => t.id === f.parent)
    const task: Task = { id: crypto.randomUUID(),title: f.title.trim(),group,parent: parent?.id || null,schoolTaskId: parent?.schoolTaskId ?? null,course: f.course,owner: f.owner,collaborators: f.collaborators,submitters: f.mode === "成员各自提交" ? f.submitters : [],due: f.due,mode: f.mode,requirements: f.requirements,acceptance: f.acceptance,status: "进行中",outcomes: [],acceptedNote: "" }
    const result = command({ type: "save-task",task })
    if (!result.ok) setError(result.error); else { form.reset(); setError("") }
  }
  return <div className="flex flex-col gap-5">
    {editable && <Panel title="建立组内事项或明确分工" description="轻量任务只要求名称与负责关系；不要求工时、完成百分比或完成报告。"><FieldGroup className="grid sm:grid-cols-2"><RField label="组内任务名称" value={form.value.title} onChange={title => form.set({ title })} /><RSelect label="牵头负责人" value={form.value.owner} options={members} onChange={owner => form.set({ owner })} placeholder="明确负责人" /><RSelect label="相关课程（可选）" value={form.value.course} options={coursesFor(catalog,group).map(c => ({ value: c.code,label: c.name }))} onChange={course => form.set({ course })} placeholder="不限具体课程" /><RField label="截止日期（可选）" type="date" value={form.value.due} onChange={due => form.set({ due })} /><RSelect label="提交方式" value={form.value.mode} options={["牵头提交","成员各自提交"].map(value => ({ value,label: value }))} onChange={mode => form.set({ mode: mode as Task["mode"] })} /><RSelect label="上级承接事项（可选）" value={form.value.parent} options={tasks.filter(t => !t.parent && t.status !== "待承接").map(t => ({ value: t.id,label: `${t.title}${t.schoolTaskId ? " · 学校任务承接" : ""}` }))} onChange={parent => form.set({ parent })} placeholder="独立组内事项" /><RField label="交付要求（可空）" type="textarea" value={form.value.requirements} onChange={requirements => form.set({ requirements })} /></FieldGroup><Choices label="协作人（不自动变成提交人）" options={members.filter(m => m.value !== form.value.owner)} value={form.value.collaborators} onChange={collaborators => form.set({ collaborators })} />{form.value.mode === "成员各自提交" && <Choices label="明确需要各自提交的成员" options={members} value={form.value.submitters} onChange={submitters => form.set({ submitters })} />}<label className="flex items-center gap-2"><input type="checkbox" checked={form.value.acceptance} onChange={e => form.set({ acceptance: e.target.checked })} />此事项明确需要验收（默认不需要）</label><Button className="self-start" onClick={create} disabled={!form.value.title.trim()}>创建事项／分工</Button>{error && <p role="alert" className="text-destructive">{error}</p>}</Panel>}
    {!tasks.length && <Panel title="暂无任务"><p>可以先建设课程内容；没有已完成教研任务不会阻止日常教学。</p></Panel>}
    {tasks.map(t => <TaskCard key={t.id} task={t} members={members} onCreateDivision={() => form.set({ parent: t.id,title: `${t.title} · `,course: t.course })} />)}
  </div>
}
function TaskCard({ task: t,members,onCreateDivision }: { task: Task; members: { value: string; label: string }[]; onCreateDivision: () => void }) {
  const { state,actor,people,command } = useResearchContext()
  const member = canEditGroup(state,actor,t.group)
  const lead = canLeadGroup(state,actor,t.group)
  const [error,setError] = useState("")
  const form = useResearchForm(`task-assignment:${t.id}`,{ owner: t.owner || actor.staff,collaborators: t.collaborators,submitters: t.submitters,mode: t.mode,due: t.due,requirements: t.requirements })
  const resultForm = useResearchForm(`task-result:${t.id}`,{ selected: "" })
  const docs = state.documents.filter(d => !d.archived && (d.owner === t.group || d.owner === actor.staff || d.share.audience === "school") && !d.restricted && d.copyPolicy === "retain" && canReadDocument(state,actor,d) && d.items.every(i => canRetainItem(state,actor,i,d.owner)))
  const activities = state.activities.filter(a => a.group === t.group && canReadActivity(state,actor,a))
  const canSubmit = member && t.status === "进行中" && (t.mode === "牵头提交" ? t.owner === actor.staff : t.submitters.includes(actor.staff))
  const name = (id: string) => people.find(p => p.id === id)?.name || "尚未指定"
  function change() {
    const f = form.value
    const result = t.status === "待承接" ? command({ type: "accept-task",id: t.id,owner: f.owner,collaborators: f.collaborators,submitters: f.submitters,mode: f.mode }) : command({ type: "save-task",task: { ...t,...f } })
    setError(result.ok ? "" : result.error)
  }
  return <Panel title={t.title} description={`${t.status} · ${t.schoolTaskId ? `学校任务 ${t.schoolTaskId} → 本组承接` : t.parent ? "关联上级事项的分工" : "组内事项"} · ${t.due ? `截止 ${t.due}` : "未设截止"}`} action={<span className="text-sm text-muted-foreground">{t.mode}</span>}>
    <p>负责人：{name(t.owner)} · 协作人：{t.collaborators.map(name).join("、") || "未设"}{t.mode === "成员各自提交" ? ` · 独立提交人：${t.submitters.map(name).join("、") || "未设"}` : " · 由牵头人提交，协作人不重复填报"}</p>{t.requirements && <RichText text={`交付要求：${t.requirements}`} />}{t.parent && <p className="text-muted-foreground">来源分工：{state.tasks.find(p => p.id === t.parent)?.title}；不以所有分工完成作为牵头提交的统一前置门槛。</p>}
    {(t.status === "待承接" ? lead : member && (lead || t.owner === actor.staff)) && <details open={t.status === "待承接"}><summary className="cursor-pointer text-primary">{t.status === "待承接" ? "确定本组承接与必要分工" : "调整负责人及必要分工"}</summary><div className="flex flex-col gap-4 pt-4"><FieldGroup className="grid sm:grid-cols-2"><RSelect label="本组负责人" value={form.value.owner} options={members} placeholder="选择有效成员" onChange={owner => form.set({ owner })} /><RSelect label="本事项提交方式" value={form.value.mode} options={["牵头提交","成员各自提交"].map(value => ({ value,label: value }))} onChange={mode => form.set({ mode: mode as Task["mode"] })} /></FieldGroup><Choices label="本事项协作人" options={members.filter(m => m.value !== form.value.owner)} value={form.value.collaborators} onChange={collaborators => form.set({ collaborators })} />{form.value.mode === "成员各自提交" && <Choices label="本事项独立提交人" options={members} value={form.value.submitters} onChange={submitters => form.set({ submitters })} />}<Button className="self-start" onClick={change}>{t.status === "待承接" ? "承接并保存分工" : "保存本事项分工"}</Button></div></details>}
    {member && t.status !== "待承接" && (lead || t.owner === actor.staff) && !t.parent && <Button variant="outline" className="self-start" onClick={onCreateDivision}>为此事项建立明确分工</Button>}
    {canSubmit && <div className="flex flex-col gap-3"><RSelect label="直接引用已有成果" value={resultForm.value.selected} onChange={selected => resultForm.set({ selected })} placeholder="选择保存版本，不要求再次上传" options={[...docs.map(d => ({ value: `document:${d.id}`,label: `${d.kind} · ${d.title} v${d.version}` })),...activities.map(a => ({ value: `activity:${a.id}`,label: `活动 · ${a.title} v${a.version}` }))]} /><Button className="self-start" disabled={!resultForm.value.selected} onClick={() => { const [kind,id] = resultForm.value.selected.split(":"); const entity = kind === "document" ? docs.find(d => d.id === id) : activities.find(a => a.id === id); if (!entity || !confirm(`提交“${entity.title}”v${entity.version} 的当时内容？${t.acceptance ? "本任务明确需要验收。" : "无额外审批。"}不会要求所有协作人重复提交。`)) return; const result = command({ type: "submit-task",id: t.id,outcome: { id: crypto.randomUUID(),kind: kind as Outcome["kind"],entityId: id,version: entity.version,title: entity.title,submittedBy: actor.staff,submittedAt: actor.date } }); setError(result.ok ? "" : result.error) }}>引用成果并提交{t.schoolTaskId ? "到学校" : "此事项"}</Button>{!t.schoolTaskId && !t.requirements.trim() && t.mode === "牵头提交" && <Button variant="outline" className="self-start" onClick={() => { const result = command({ type: "complete-task",id: t.id }); setError(result.ok ? "" : result.error) }}>无需交付资料，直接标记完成</Button>}</div>}
    {t.outcomes.map(o => <details key={o.id} className="rounded-lg border p-4"><summary className="cursor-pointer font-semibold">已提交：{o.title} v{o.version} · {name(o.submittedBy)} · {o.submittedAt}</summary><div className="pt-4">{o.document ? <DocumentRead document={o.document} submittedSnapshot /> : <RichText text={`${o.activity?.title}\n${o.activity?.start}—${o.activity?.end}\n研讨结论：${o.activity?.conclusion || "尚未整理"}`} />}</div></details>)}
    {t.mode === "成员各自提交" && <p className="text-muted-foreground">尚未提交：{t.submitters.filter(id => !t.outcomes.some(o => o.submittedBy === id)).map(id => `${name(id)}${people.find(p => p.id === id)?.accountStatus !== "enabled" ? "（没有可用账号，不显示线上收到／提交）" : ""}`).join("、") || "指定成员已提交"}</p>}
    {t.status === "待验收" && !t.schoolTaskId && lead && <Button className="self-start" onClick={() => { const result = command({ type: "review-task",id: t.id,note: "有效组长明确验收" }); setError(result.ok ? "" : result.error) }}>确认验收此事项</Button>}{t.acceptedNote && <p>{t.acceptedNote}</p>}{error && <p role="alert" className="text-destructive">{error}</p>}{member && <DiscussionThread target={`task:${t.id}`} />}
  </Panel>
}
