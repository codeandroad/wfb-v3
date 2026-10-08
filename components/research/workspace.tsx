"use client"

import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useDemo } from "@/lib/demo/store"
import { PERSONAS } from "@/lib/demo/nav"
import { useMt } from "@/lib/mt/store"
import { dateOfClock } from "@/lib/mt/model"
import { useStaffList } from "@/lib/school/staff-store"
import { CATALOG_COURSES } from "@/lib/demo/school"
import { appointments, groups, membership, schoolScopes, coursesFor, useResearch, saveResearch, type Document, type ResearchState, type Task } from "@/lib/research/store"
import { DocumentEditor } from "./document-editor"
import { HomeworkHandoff } from "./homework-handoff"
import { PlanHandoff } from "./plan-handoff"

const button = "inline-flex items-center justify-center rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground hover:bg-muted disabled:opacity-40"
const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm"
const tabs = ["当前工作", "课程与内容", "任务与协作", "成员"]
export function ResearchWorkspace() {
  const demo = useDemo()
  const staff = PERSONAS[demo.persona].staffId
  const people = useStaffList()
  const state = useResearch()
  const params = useSearchParams()
  const router = useRouter()
  const groupId = params.get("group") || ""
  const personal = params.get("space") === "personal"
  const tab = params.get("tab") || "当前工作"
  const mt = useMt()
  const now = dateOfClock(mt.biz.clock)
  const member = membership(staff, groupId, now)
  const group = groups.find(g => g.id === groupId)
  const scope = personal ? staff : groupId
  const viewer = schoolScopes(staff).includes(groupId)
  const accessible = demo.scenario !== "parent" && (personal || !!member || viewer)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [kind, setKind] = useState<Document['kind']>("计划")
  const [title, setTitle] = useState("")
  const [course, setCourse] = useState("")
  const [search, setSearch] = useState("")
  const docs = accessible ? state.documents.filter(d => d.owner === scope) : []
  const doc = docs.find(d => d.id === params.get("doc"))
  const courses = personal ? CATALOG_COURSES : coursesFor(groupId)
  const tasks = accessible && !personal ? state.tasks.filter(t => t.group === groupId) : []
  function commit(next: ResearchState) { try { saveResearch(next); setError(""); setMessage("已保存到本机演示存储"); return true } catch { setError("保存失败：浏览器存储不可用或空间不足。此次修改未写入，请重试。"); return false } }
  function navigate(values: Record<string, string>) { const next = new URLSearchParams(params); Object.entries(values).forEach(([k,v]) => v ? next.set(k,v) : next.delete(k)); router.push(`/research?${next}`) }
  function add(document: Document) { if (!accessible || (document.owner !== staff && !member)) return; if (!commit({ ...state, documents: [...state.documents, document] })) return; navigate({ space: document.owner === staff ? "personal" : "", group: document.owner === staff ? "" : groupId, doc: document.id, tab: "课程与内容" }) }
  function taskUpdate(task: Task) { if (!member) return; commit({ ...state, tasks: state.tasks.map(t => t.id === task.id ? task : t) }) }
  if (demo.scenario === "parent") return <section className="p-6"><h1>当前身份无教研访问权限</h1></section>
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-5 sm:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="flex flex-col gap-2"><p className="text-sm text-muted-foreground">课程共建 / 教学准备</p><h1 className="text-2xl font-semibold">{personal ? "我的教学资料" : group?.name || "我的教研"}</h1><p className="text-sm text-muted-foreground">{personal ? "个人内容独立保留，不随换班或退出科组删除。" : member ? `${member.role} · ${member.start} 至 ${member.end}` : "从正式科组进入，共同准备下一次教学。"}</p></div><div className="flex gap-2">{params.get('from') === 'catalog' && <Link className={button} href="/catalog">返回课程管理</Link>}<Link className={button} href="/research">我的科组</Link><Link className={button} href="/research?space=personal&tab=课程与内容">我的资料</Link></div></header>
    <aside className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">交互原型 · 本机持久化。现有人员模型尚无结构化科组任命，本工作区使用单独标明的演示任命，不按任课或部门文字推定权限。未连接正式任命接口与服务端授权。</aside>
    {error && <p role="alert" className="rounded-lg border p-3">{error}</p>}<p role="status" className="min-h-5 text-sm text-muted-foreground">{message}</p>
    {!groupId && !personal ? <><section className="grid gap-4 md:grid-cols-2">{groups.filter(g => membership(staff, g.id, now)).map(g => <Link className="flex flex-col gap-4 rounded-xl border bg-card p-6 text-card-foreground hover:border-primary" href={`/research?group=${g.id}`} key={g.id}><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{g.name}</h2><span className="text-sm text-primary">{membership(staff, g.id, now)?.role} →</span></div><p className="text-sm text-muted-foreground">{coursesFor(g.id).map(c => c.name).join("、")}</p><p className="text-sm">进入课程共建与协作</p></Link>)}</section>{!groups.some(g => membership(staff, g.id, now)) && <div className="rounded-xl border p-6">当前没有有效科组任命。你仍可使用个人教学资料；请通过学校现有任命流程完善资格。</div>}</> : !accessible ? <section className="rounded-xl border bg-card p-6"><h2 className="text-lg font-semibold">无法访问此科组</h2><p className="text-sm text-muted-foreground">没有当前有效的该组任命。直接链接与入口使用相同检查，页面来源不会授予编辑权。</p></section> : <>
      <nav aria-label="教研工作区" className="flex overflow-x-auto border-b">{(personal ? ["课程与内容"] : tabs).map(t => <button key={t} className={`shrink-0 border-b-2 px-5 py-3 text-sm ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => navigate({ tab: t, doc: "" })}>{t}</button>)}</nav>
      {doc ? <><button className={`${button} self-start`} onClick={() => navigate({ doc: "" })}>← 返回内容列表</button><DocumentEditor document={doc} editable={personal || !!member} update={updated => { if (updated.owner !== scope) return; commit({ ...state, documents: state.documents.map(d => d.id === updated.id ? updated : d) }) }} copy={() => add({ ...structuredClone(doc), id: crypto.randomUUID(), owner: staff, title: `${doc.title} · 个人版`, version: 1, source: `${doc.id}@${doc.version} / ${doc.source}` })} toPlan={items => add({ ...structuredClone(doc), id: crypto.randomUUID(), owner: staff, kind: "计划", title: `${doc.title} · 选用计划`, version: 1, source: `${doc.id}@${doc.version} / ${items.map(i => i.id).join(',')}`, items: structuredClone(items) })} />{doc.kind === '计划' && <PlanHandoff document={doc} />}{(doc.kind === '资源' || doc.kind === '练习组合') && <HomeworkHandoff document={doc} />}</> : <>
      {tab === "当前工作" && <section className="grid gap-5 md:grid-cols-3"><article className="flex flex-col gap-4 rounded-xl border bg-card p-5 md:col-span-2"><h2 className="text-lg font-semibold">近期协作事项</h2>{tasks.map(t => <button key={t.id} className="flex items-center justify-between border-b py-4 text-left" onClick={() => navigate({ tab: "任务与协作" })}><span>{t.title}<small className="block text-sm text-muted-foreground">学校任务 · 截止 {t.due}</small></span><span className="text-sm text-primary">{t.status} →</span></button>)}<p className="text-sm text-muted-foreground">不按上传量、活动数或评论数排名。任务只计算本组承接事项，不重复计算父任务。</p></article><article className="flex flex-col gap-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">备课从这里开始</h2><button className={button} onClick={() => navigate({ tab: "课程与内容" })}>阅读大纲与准备计划</button><Link className={button} href="/teaching">返回现有教学</Link><Link className={button} href="/homework">进入现有作业管理</Link><p className="text-sm text-muted-foreground">内容准备不是日常教学和作业的前置审批。</p></article></section>}
      {(tab === "课程与内容" || personal) && <section className="flex flex-col gap-5"><div className="rounded-xl border bg-card p-5"><h2 className="font-semibold">{personal ? "个人课程范围" : "本组课程目录"}</h2><p className="py-2 text-sm text-muted-foreground">读取现有学校目录。演示责任映射按科组绑定学科；开停状态及正式责任科组接口尚待接入，新建内容不会开设课程。</p><div className="flex flex-wrap gap-2">{courses.map(c => <span key={c.code} className="rounded-lg border px-3 py-2 text-sm">{c.name} · {c.officialCode}</span>)}</div></div><form className="flex flex-col gap-3 rounded-xl border bg-card p-5" onSubmit={e => { e.preventDefault(); const selected = course || courses[0]?.code; if (!title.trim() || !courses.some(c => c.code === selected)) return; add({ id: crypto.randomUUID(), title: title.trim(), kind, course: selected, owner: scope, version: 1, source: "", notes: "", budget: null, reserve: 0, period: null, items: [] }); setTitle('') }}><h2 className="font-semibold">建立一份内容</h2><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">类型<select className={input} value={kind} onChange={e => setKind(e.target.value as Document['kind'])}>{['大纲','计划','资源','练习组合'].map(k => <option key={k}>{k}</option>)}</select></label><label className="text-sm">课程<select className={input} value={course || courses[0]?.code} onChange={e => setCourse(e.target.value)}>{courses.map(c => <option value={c.code} key={c.code}>{c.name} · {c.code}</option>)}</select></label><label className="text-sm">名称<input required className={input} value={title} onChange={e => setTitle(e.target.value)} /></label></div><button className={`${button} self-start`} type="submit" disabled={!personal && !member}>创建并整理内容</button></form><input aria-label="查找资料" className={input} placeholder="按名称查找资料" value={search} onChange={e => setSearch(e.target.value)} /><div className="grid gap-3 md:grid-cols-2">{docs.filter(d => d.title.includes(search)).map(d => <button className="flex flex-col gap-2 rounded-xl border bg-card p-5 text-left hover:border-primary" onClick={() => navigate({ doc: d.id })} key={d.id}><span className="text-sm text-primary">{d.kind} · v{d.version}</span><h3 className="font-semibold">{d.title || "未命名"}</h3><p className="text-sm text-muted-foreground">{CATALOG_COURSES.find(c => c.code === d.course)?.name} · {d.items.length} 个内容项目</p><p className="text-sm text-muted-foreground">{d.kind === '资源' ? '引用资料；未提供全文或附件' : d.source || '尚未关联来源'}</p></button>)}</div>{!docs.length && <p className="p-6 text-center text-muted-foreground">尚无内容，可以独立建立，不需要班级或课表。</p>}</section>}
      {tab === "任务与协作" && <section className="flex flex-col gap-4">{tasks.map(t => <article key={t.id} className="flex flex-col gap-4 rounded-xl border bg-card p-5"><div className="flex justify-between gap-4"><h2 className="font-semibold">{t.title}</h2><span className="text-sm text-primary">{t.status}</span></div><p className="text-sm text-muted-foreground">来源学校任务 {t.parent} · 截止 {t.due} · {t.mode} · 不要求额外完成报告</p>{t.status === '待承接' && member?.role === '组长' && <button className={`${button} self-start`} onClick={() => taskUpdate({ ...t, owner: staff, status: '进行中' })}>承接并由我牵头</button>}{t.owner && <p className="text-sm">负责人：{people.find(p => p.id === t.owner)?.name || t.owner}</p>}{t.owner === staff && t.status === '进行中' && <label className="text-sm">引用本组已有成果并提交<select className={input} value="" onChange={e => { const result = docs.find(d => d.id === e.target.value); if (result && confirm(`提交“${result.title}”v${result.version} 快照？不要求其他成员重复填报。`)) taskUpdate({ ...t, result: structuredClone(result), status: '已提交' }) }}><option value="">请选择成果</option>{docs.map(d => <option key={d.id} value={d.id}>{d.title} · v{d.version}</option>)}</select></label>}{t.result && <details className="rounded-lg border p-3"><summary>提交成果：{t.result.title} · v{t.result.version}（当时快照）</summary>{t.result.items.map(i => <div key={i.id} className="whitespace-pre-wrap py-3 text-sm"><strong>{i.title}</strong><p>{i.body}</p><p>{i.source}</p></div>)}</details>}<div className="border-t pt-3"><h3 className="text-sm font-medium">事项讨论 · 仅本组可见</h3>{t.discussion.map((d,i) => <p className="py-2 text-sm" key={i}>{people.find(p => p.id === d.author)?.name || d.author}：{d.text}</p>)}<form className="flex gap-2" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const text = String(new FormData(form).get('comment') || '').trim(); if (text) { taskUpdate({ ...t, discussion: [...t.discussion, { author: staff, text }] }); form.reset() } }}><input className={input} name="comment" aria-label="讨论内容" required placeholder="围绕此事项讨论，不发送虚构已读通知" /><button className={button} disabled={!member}>发送</button></form></div></article>)}</section>}
      {tab === '成员' && <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">有效任命 · 演示名单</h2>{appointments.filter(a => a.group === groupId && membership(a.staff, groupId, now)).map(a => { const p = people.find(p => p.id === a.staff); return <div key={a.staff} className="flex justify-between border-b py-4"><span><Link className="text-primary underline" href={`/people/${a.staff}`}>{p?.name || a.staff}</Link><span className="block text-sm text-muted-foreground">{a.start} — {a.end}</span></span><span>{a.role} · {p?.accountStatus === 'enabled' ? '已有账号' : '账号不可用，不发送站内通知'}</span></div> })}<p className="pt-4 text-sm text-muted-foreground">任务分工不改变正式任命；不显示联系方式、学生名单、完整课表或私人草稿。</p></section>}
      </>}
    </>}
  </div>
}
