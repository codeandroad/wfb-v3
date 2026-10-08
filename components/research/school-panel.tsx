"use client"
import Link from "next/link"
import { useState } from "react"
import { useDemo } from "@/lib/demo/store"
import { PERSONAS } from "@/lib/demo/nav"
import { groups, useResearch, saveResearch, schoolScopes, type Task } from "@/lib/research/store"
export function SchoolResearchPanel() {
  const demo = useDemo()
  const state = useResearch()
  const scope = demo.scenario === 'parent' ? [] : schoolScopes(PERSONAS[demo.persona].staffId)
  const [error,setError] = useState('')
  if (!scope.length) return null
  const tasks = state.tasks.filter(t => scope.includes(t.group))
  return <section className="my-6 flex flex-col gap-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">科组共建与学校任务</h2><p className="text-sm text-muted-foreground">演示管理查看范围；进入同一工作区仅供阅读，不自动成为科组成员。仅汇总正式提交的成果，不显示私人资料。</p><div className="flex flex-wrap gap-2">{groups.filter(g => scope.includes(g.id)).map(g => <Link className="rounded-lg border px-3 py-2 text-sm" key={g.id} href={`/research?group=${g.id}&from=catalog`}>查看{g.name} →</Link>)}</div><form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); const form=e.currentTarget; const data=new FormData(form); const title=String(data.get('title')||'').trim(); const selected=data.getAll('group').map(String).filter(g=>scope.includes(g)); if(!title||!selected.length) return setError('请输入名称并选择至少一个科组'); const parent=crypto.randomUUID(); const created: Task[]=selected.map(group=>({id:crypto.randomUUID(),parent,group,title,owner:'',due:String(data.get('due')||''),mode:'牵头提交',status:'待承接',discussion:[]})); try{saveResearch({...state,tasks:[...state.tasks,...created]});setError('');form.reset()}catch{setError('本机保存失败，任务未下发')}}}><input name="title" aria-label="学校任务名称" placeholder="学校教研任务名称" required className="rounded-lg border bg-background px-3 py-2 text-sm"/><input type="date" aria-label="截止日期" name="due" required className="rounded-lg border bg-background px-3 py-2 text-sm"/>{groups.filter(g=>scope.includes(g.id)).map(g=><label className="flex items-center gap-2 text-sm" key={g.id}><input type="checkbox" name="group" value={g.id}/>{g.name}</label>)}<button className="rounded-lg border px-3 py-2 text-sm">向所选科组下发</button></form>{error&&<p role="alert">{error}</p>}<div className="flex flex-col gap-3">{tasks.map(t=><article className="rounded-lg border p-3 text-sm" key={t.id}><div className="flex justify-between"><h3>{t.title} · {groups.find(g=>g.id===t.group)?.name}</h3><span>{t.status}</span></div>{t.result&&<details><summary>正式成果：{t.result.title} v{t.result.version}</summary>{t.result.items.map(i=><p key={i.id} className="whitespace-pre-wrap py-3">{i.title}{'\n'}{i.body}{'\n'}{i.source}</p>)}</details>}</article>)}</div></section>
}
