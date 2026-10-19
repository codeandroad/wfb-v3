"use client"
import Link from "next/link"
import { Button } from "./button"
import { useResearchContext } from "@/lib/research/context"
import { retryResearchSave,useResearchStatus } from "@/lib/research/store"
import { useWorkspaceNavigation } from "@/lib/research/navigation"
import { canReadActivity,canViewGroup,coursesFor,membership,ownTodos,schoolScopes } from "@/lib/research/model"
import { useStaffDutyStatus } from "@/lib/school/duty-store"
import { ActivityCard } from "./activity-board"
import { CriterionBoard } from "./criterion-board"
import { CourseWorkspace } from "./course-workspace"
import { SourcePersonal } from "./source-personal"
import { DocumentLibrary } from "./document-library"
import { CurrentWork } from "./current-work"
import { GroupSchedule } from "./group-schedule"
import { GroupChat } from "./group-chat"
import { WorkBoard } from "./work-board"
import { Panel } from "./primitives"
import styles from "./workspace.module.css"
const tabs = [["overview","当前工作"],["schedule","教研课表"],["courses","本组课程"],["work","任务与活动"],["resources","共享资料"],["chat","群组聊天"],["criteria","评价依据"]]
const legacy: Record<string,string> = { 当前工作: "overview",课程与内容: "courses",任务与协作: "work",活动: "work",成员: "chat",评价依据: "criteria" }
export function ResearchWorkspace() {
 const { state,actor,ready,catalog } = useResearchContext(),status = useResearchStatus(),duties = useStaffDutyStatus(),{ params,navigate } = useWorkspaceNavigation()
 const groupId = params.get("group") || "",personal = params.get("space") === "personal",shared = params.get("space") === "shared",group = state.groups.find(g => g.id === groupId)
 const tabParam = params.get("tab") || "overview",tab = tabs.some(([v]) => v === tabParam) ? tabParam : legacy[tabParam] || "overview"
 const invited = !groupId && !personal && !shared && params.get("activity") ? state.activities.find(a => a.id === params.get("activity") && canReadActivity(state,actor,a)) : null
 const entry = !groupId && !personal && !shared && !params.get("activity"),accessible = actor.enabled && (entry || personal || shared || !!invited || !!group && canViewGroup(state,actor,groupId))
 const myGroups = state.groups.filter(g => membership(state,actor.staff,g.id,actor.date)),myTasks = myGroups.flatMap(g => ownTodos(state,actor,g.id)),member = membership(state,actor.staff,groupId,actor.date)
 const courseDetail = !!params.get("doc") || (tab === "courses" || personal || shared) && (!!params.get("course") || !!params.get("view"))
 function go(values: Record<string,string>) { const mapped = legacy[values.tab] || values.tab; navigate({ ...values,...(mapped ? { tab: mapped } : {}),...(values.tab === "活动" ? { wk: "activities" } : {}) }) }
 function clearTab(v: string) { navigate({ tab: v,course: "",view: "",doc: "",version: "",item: "",task: "",activity: "",journal: "",edit: "",day: "",detail: "",log: "",sub: "",sv: "",parent: "" }) }
 return <div className={`${styles.scope} ${styles.workspace} ${courseDetail?styles.courseDetail:""} ry-workspace`} data-testid="research-workspace" data-ready={ready}>
 {!courseDetail && <header className={group && !personal && !shared ? "ry-group-heading" : "ry-home-heading"} data-testid="research-fixed-header"><div>{!entry && <div className="ry-return"><Link className="btn ghost" href={params.get("from") === "catalog" ? "/catalog?tab=groups" : "/research"}>{params.get("from") === "catalog" ? "返回科组概况" : "返回我的科组"}</Link></div>}<h1>{personal ? "我的教学资料" : shared ? "校内共享资料" : group?.name || (invited ? "受邀教研活动" : "我的教研")}{group && !personal && !shared && <span>{member?.type === "research_lead" ? "教研组长" : member ? "组内成员" : "管理查看 · 只读"}</span>}</h1>{!group && <p>{personal ? "个人保存的大纲、计划、资源与练习组合。" : shared ? "查看明确共享且当前有权使用的教学资料。" : "从有效科组进入课程共建与协作。"}</p>}</div><div className="ry-heading-actions">{!personal && <Link href="/research?space=personal" className="btn">我的教学资料</Link>}{entry && schoolScopes(state,actor).length > 0 && <Link href="/catalog" className="btn">学校课程管理</Link>}</div></header>}
 {group && !personal && !shared && !courseDetail && <nav className="ry-local-nav" aria-label="教研组页签" data-testid="research-group-tabs">{tabs.map(([v,label]) => <Button key={v} variant="ghost" aria-current={tab === v ? "page" : undefined} onClick={() => clearTab(v)}>{label}</Button>)}</nav>}
 {duties.error && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm">{duties.error}</p>}{status.error && <div role="alert" className="rounded-lg border border-destructive p-3 text-sm">{status.error}<Button variant="outline" onClick={retryResearchSave}>重试保存保留的草稿</Button></div>}
 {!ready ? <p className="ry-muted">正在恢复本机工作区…</p> : !accessible ? <p role="alert" className="ry-empty">当前身份无有效教研职责或此活动邀请已不可访问。可由学校在教职工管理中核对任命与有效期。</p> : invited ? <ActivityCard activity={invited} /> : entry ? <><div className="ry-home-layout"><section className="ry-subjects" aria-label="本人有效科组">{myGroups.map(g => <article key={g.id} className="ry-subject-row"><span className="ry-subject-mark">{g.name.slice(0,1)}</span><div><h2><Link href={`/research?group=${g.id}&tab=overview`} className="ry-title">{g.name.replace("教研组","")}</Link></h2><p>{g.name} <span className="ry-chip">{membership(state,actor.staff,g.id,actor.date)?.type === "research_lead" ? "教研组长" : "组内成员"}</span></p><div className="ry-course-names">{coursesFor(catalog,g.id).map(c => `${c.name} · ${c.officialCode}`).join("；") || "尚未登记有效课程"}</div></div><Link className="btn pri" href={`/research?group=${g.id}&tab=overview`} aria-label={`进入${g.name}`}>进入科组</Link></article>)}{!myGroups.length && <p className="ry-empty">当前没有有效科组任命。个人教学资料仍可独立保存和使用。</p>}</section><aside><Panel title="我需要处理" flush>{myTasks.length ? <div className="ry-agenda">{myTasks.map(t => <Link key={t.id} className="ry-agenda-row" href={`/research?group=${t.group}&tab=work&wk=tasks&task=${t.id}`}><b>{t.title}</b><span>{state.groups.find(g => g.id === t.group)?.name} · {t.due || "截止未设"}</span></Link>)}</div> : <p className="ry-empty">暂无分配给你的待处理教研任务。</p>}</Panel><p className="ry-note">每个科组的职责分别生效。个人资料不随换班或任命结束删除。</p><div className="ry-inline-actions"><Link href="/research?space=shared" className="btn ghost">校内共享资料</Link><Link href="/teaching" className="btn ghost">日常教学</Link><Link href="/homework" className="btn ghost">作业管理</Link></div></aside></div>{state.activities.filter(a => a.participants.includes(actor.staff) && canReadActivity(state,actor,a) && !myGroups.some(g => g.id === a.group)).map(a => <Link key={a.id} className="ry-agenda-row" href={`/research?activity=${a.id}`}>跨组受邀活动：{a.title} · {a.start.slice(0,10)}</Link>)}</> : (personal || shared) && !courseDetail ? personal?<SourcePersonal/>:<CourseWorkspace shared resourcesOnly/> : courseDetail || tab === "courses" || tab === "resources" ? <CourseWorkspace key={`${actor.staff}:${groupId}:${personal}:${shared}`} group={personal || shared ? undefined : groupId} personal={personal} shared={shared} resourcesOnly={tab === "resources" || shared && !params.get("view") && !params.get("doc")} /> : tab === "overview" ? <CurrentWork group={groupId} onNavigate={t => go({ tab: t })} /> : tab === "schedule" ? <GroupSchedule key={`${actor.staff}:${groupId}`} group={groupId} /> : tab === "work" ? <WorkBoard key={`${actor.staff}:${groupId}`} group={groupId} initialMode={tabParam === "活动" ? "activities" : undefined} /> : tab === "chat" ? <GroupChat key={`${actor.staff}:${groupId}`} group={groupId} /> : <CriterionBoard key={`${actor.staff}:${groupId}`} group={groupId} />}
 {!courseDetail&&<p className="ry-demo-note">教研关系与协作记录为本机持久化演示；已有大纲、计划、资源和教学记录继续使用原数据。</p>}
 </div>
}
