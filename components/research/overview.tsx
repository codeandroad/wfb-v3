"use client"

import Link from "next/link"
import { useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { useResearchContext } from "@/lib/research/context"
import { useResearchForm } from "@/lib/research/use-form"
import { activeAt, canEditGroup, canLeadGroup, canReadActivity, ownTodos } from "@/lib/research/model"
import { Panel, RField, Choices, RichText } from "./primitives"

export function ResearchOverview({ group, navigate }: { group: string; navigate: (values: Record<string, string>) => void }) {
  const { state, actor, people, command } = useResearchContext()
  const form = useResearchForm(`overview:${group}`, { title: "", body: "", recipients: [] as string[], ack: false })
  const [error, setError] = useState("")
  const member = canEditGroup(state, actor, group)
  const todos = member ? ownTodos(state, actor, group) : []
  const notices = state.notices.filter(n => n.group === group && n.recipients.includes(actor.staff))
  const activities = state.activities.filter(a => a.group === group && canReadActivity(state, actor, a)).sort((a,b) => a.start.localeCompare(b.start))
  const memberIds = [...new Set(state.appointments.filter(a => a.group === group && activeAt(a.start, a.end, actor.date)).map(a => a.staff))]
  function run(action: Parameters<typeof command>[0]) { const result = command(action); setError(result.ok ? "" : result.error); return result.ok }
  return <div className="flex min-w-0 flex-col gap-5"><div className="grid gap-5 lg:grid-cols-2">
    <Panel title="本人需要处理的事项" description="同一学校任务及其分工按来源去重，不以事项量排名。">{todos.map(t => <Button key={t.id} variant="outline" onClick={() => navigate({ tab: "任务与协作" })}>{t.title} · {t.due || "截止未设"}</Button>)}{!todos.length && <p className="text-muted-foreground">{member ? "当前没有本人需执行的未完成事项；尚未承接的学校事项在任务页由有效组长承接。" : "学校查看者没有组内个人待办，不自动加入成员。"}</p>}<Button variant="outline" className="self-start" onClick={() => navigate({ tab: "任务与协作" })}>查看本组承接与协作</Button></Panel>
    <Panel title="近期活动与常用内容"><div className="flex flex-col gap-3">{activities.slice(0,3).map(a => <Button key={a.id} variant="outline" onClick={() => navigate({ tab: "活动" })}>{a.title} · {a.start.replace("T", " ")}</Button>)}{!activities.length && <p className="text-muted-foreground">暂无有权查看的活动安排。</p>}</div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate({ tab: "课程与内容" })}>阅读大纲与准备计划</Button><Link href="/teaching" className={buttonVariants({ variant: "outline" })}>原有日常教学</Link><Link href="/homework" className={buttonVariants({ variant: "outline" })}>原有作业流程</Link></div></Panel>
  </div>
  <Panel title="与本人相关的组内通知" description="普通通知不强制回执；本机模拟接收范围，不假报线上已送达或已读。">{notices.map(n => <article key={n.id} className="flex flex-col gap-2 rounded-lg border p-4"><h3 className="font-semibold">{n.title}</h3><RichText text={n.body} /><p className="text-muted-foreground">{n.at} · 接收范围 {n.recipients.map(id => people.find(p => p.id === id)?.name || id).join("、")}</p>{n.requiresAck && member && <Button variant="outline" className="self-start" disabled={n.acknowledged.includes(actor.staff)} onClick={() => run({ type: "ack-notice", id: n.id })}>{n.acknowledged.includes(actor.staff) ? "本人已确认安排" : "此安排明确要求确认"}</Button>}</article>)}{!notices.length && <p className="text-muted-foreground">当前没有向本人开放的通知。</p>}
    {canLeadGroup(state, actor, group) && <details><summary className="cursor-pointer text-primary">发布本组通知</summary><div className="flex flex-col gap-4 pt-4"><FieldGroup><RField label="通知名称" value={form.value.title} onChange={title => form.set({ title })} /><RField label="通知正文" type="textarea" value={form.value.body} onChange={body => form.set({ body })} /></FieldGroup><Choices label="明确接收人" options={memberIds.map(id => ({ value: id, label: `${people.find(p => p.id === id)?.name || id}${people.find(p => p.id === id)?.accountStatus !== "enabled" ? "（无可用账号，不发送）" : ""}` }))} value={form.value.recipients} onChange={recipients => form.set({ recipients })} /><label className="flex items-center gap-2"><input type="checkbox" checked={form.value.ack} onChange={e => form.set({ ack: e.target.checked })} />此安排明确需要成员确认</label><Button className="self-start" disabled={!form.value.title.trim() || !form.value.body.trim() || !form.value.recipients.length} onClick={() => { if (run({ type: "notice", notice: { id: crypto.randomUUID(), group, title: form.value.title, body: form.value.body, recipients: form.value.recipients, requiresAck: form.value.ack, acknowledged: [], author: actor.staff, at: actor.date } })) form.set({ title: "", body: "", recipients: [], ack: false }) }}>保存通知与接收范围</Button></div></details>}
  </Panel>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>
}
