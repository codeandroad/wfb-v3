"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useResearchContext } from "@/lib/research/context"
import { getResearch, retryResearchSave, useResearchStatus } from "@/lib/research/store"
import { canReadDocument, canViewGroup, coursesFor, groups, membership, schoolScopes } from "@/lib/research/model"
import { ActivityBoard } from "./activity-board"
import { CriterionBoard } from "./criterion-board"
import { DocumentEditor } from "./document-editor"
import { DocumentLibrary } from "./document-library"
import { HomeworkHandoff } from "./homework-handoff"
import { PlanHandoff } from "./plan-handoff"
import { ResearchOverview } from "./overview"
import { ResearchMembers } from "./members"
import { TaskBoard } from "./task-board"
import { Panel } from "./primitives"

const tabs = ["当前工作", "课程与内容", "任务与协作", "活动", "评价依据", "成员"]
export function ResearchWorkspace() {
  const { state, actor, ready, catalog } = useResearchContext()
  const status = useResearchStatus()
  const params = useSearchParams()
  const router = useRouter()
  const groupId = params.get("group") || ""
  const personal = params.get("space") === "personal"
  const shared = params.get("space") === "shared"
  const entry = !groupId && !personal && !shared
  const group = groups.find(g => g.id === groupId)
  const member = membership(state, actor.staff, groupId, actor.date)
  const viewer = schoolScopes(state, actor).includes(groupId)
  const accessible = actor.enabled && (personal || shared || entry || !!group && canViewGroup(state, actor, groupId))
  const tab = personal || shared ? "课程与内容" : tabs.includes(params.get("tab") || "") ? params.get("tab")! : "当前工作"
  const currentDoc = state.documents.find(d => d.id === params.get("doc"))
  const correctSpace = currentDoc && (personal ? currentDoc.owner === actor.staff : shared ? true : currentDoc.owner === groupId || currentDoc.share.audience !== "group")
  const allowedDoc = accessible && correctSpace && currentDoc && canReadDocument(state, actor, currentDoc) ? currentDoc : null
  const requestedVersion = params.get("version")
  const doc = allowedDoc && requestedVersion ? state.revisions[`${allowedDoc.id}@${Number(requestedVersion)}`] : allowedDoc
  const myGroups = groups.filter(g => membership(state, actor.staff, g.id, actor.date))
  function navigate(values: Record<string, string>) {
    const next = new URLSearchParams(params)
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    router.push(`/research?${next}`, { scroll: false })
  }
  function created(id: string) {
    const created = getResearch().documents.find(d => d.id === id)
    if (!created) return
    navigate({ space: created.owner === actor.staff ? "personal" : "", group: created.owner === actor.staff ? "" : created.owner, doc: id, tab: "课程与内容", version: "", item: "" })
  }
  return <div className="flex w-full min-w-0 flex-col gap-5 font-sans" data-testid="research-workspace" data-ready={ready}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1"><p className="text-sm text-muted-foreground">课程共建 · 教学准备</p><h1 className="text-balance text-2xl font-semibold">{personal ? "我的教学资料" : shared ? "校内共享资料" : group?.name || "我的教研"}</h1><p className="text-sm text-muted-foreground">{personal ? "个人内容独立保留，不随换班或科组任命结束而删除。" : shared ? "只开放有权使用的共享对象，不开放来源科组工作区。" : member ? `${member.role} · 有效任期 ${member.start} 至 ${member.end || "未设结束"}` : viewer ? "学校授权查看，不自动成为成员或获得编辑权。" : "从本人有效科组进入；个人教学资料也可独立使用。"}</p></div>
      <div className="flex flex-wrap gap-2">{params.get("from") === "catalog" && <Link className={buttonVariants({ variant: "outline" })} href="/catalog">返回课程管理</Link>}{!entry && <Link className={buttonVariants({ variant: "outline" })} href="/research">我的科组</Link>}{!personal && <Link className={buttonVariants({ variant: "outline" })} href="/research?space=personal">我的资料</Link>}{!shared && <Link className={buttonVariants({ variant: "outline" })} href="/research?space=shared">共享资料</Link>}</div>
    </header>
    <Alert role="note"><AlertTitle>可操作的本机演示原型</AlertTitle><AlertDescription>复用当前人员、课程、任教任务与教学流程；新增科组任命、责任映射和资料为明确标注的模拟数据。浏览器持久化，不代表正式学校授权；没有连接服务端教研、文件解析或消息服务。不会清空现有教学数据。</AlertDescription></Alert>
    {status.error && <Alert variant="destructive"><AlertTitle>本机保存需要处理</AlertTitle><AlertDescription>{status.error}<Button variant="outline" onClick={retryResearchSave}>重试写入已保留的草稿</Button></AlertDescription></Alert>}
    {!ready ? <Panel title="正在恢复工作区"><p>读取本人的有效任命与已保存内容…</p></Panel> : !accessible ? <Empty className="border"><EmptyHeader><EmptyTitle>当前身份无法访问此工作区</EmptyTitle><EmptyDescription>没有当前有效的科组任命或学校查看授权。未生效、已结束的任命不能通过直接链接继续访问；页面来源不授予权限。</EmptyDescription></EmptyHeader></Empty> : entry ? <>
      <div className="grid gap-4 md:grid-cols-2">{myGroups.map(g => <Panel key={g.id} title={g.name} description={`${membership(state, actor.staff, g.id, actor.date)?.role} · 正式有效任命（演示）`} action={<Badge variant="outline">本人科组</Badge>}><p>{coursesFor(catalog, g.id).map(c => `${c.name} · ${c.officialCode}`).join("、") || "尚未维护责任课程"}</p><Link className={buttonVariants({ variant: "outline" })} href={`/research?group=${g.id}`}>进入{g.name}工作区</Link></Panel>)}</div>
      {!myGroups.length && <Empty className="border"><EmptyHeader><EmptyTitle>当前没有有效科组任命</EmptyTitle><EmptyDescription>任课、教师资格或部门文字不会被推定为归组。个人资料仍可访问；任命请在现有学校管理的教职工页面维护。</EmptyDescription></EmptyHeader></Empty>}
      <Panel title="内容准备不依赖班级或课表"><p>可以先建立个人大纲、教学计划及多来源练习组合；确定具体任教任务后再采用。无需先完成教研任务，也可继续原日常填报。</p><div className="flex flex-wrap gap-2"><Link href="/research?space=personal" className={buttonVariants({ variant: "outline" })}>管理我的教学资料</Link><Link href="/teaching" className={buttonVariants({ variant: "outline" })}>原有日常教学</Link><Link href="/homework" className={buttonVariants({ variant: "outline" })}>原有作业管理</Link>{schoolScopes(state, actor).length > 0 && <Link href="/catalog" className={buttonVariants({ variant: "outline" })}>课程管理的授权科组概况</Link>}</div></Panel>
    </> : <>
      {!personal && !shared && <nav aria-label="教研工作区内容" className="overflow-x-auto"><ToggleGroup variant="outline" value={[tab]} onValueChange={value => value[0] && navigate({ tab: value[0], doc: "", version: "", item: "" })}>{tabs.map(t => <ToggleGroupItem key={t} value={t}>{t}</ToggleGroupItem>)}</ToggleGroup></nav>}
      {!personal && !shared && !member && <Alert role="note"><AlertTitle>仅管理查看</AlertTitle><AlertDescription>此来源只决定返回课程管理。内部编辑、承接、讨论及学生记录仍按各自真实授权检查。</AlertDescription></Alert>}
      {params.get("doc") ? <><Button variant="outline" className="self-start" onClick={() => navigate({ doc: "", version: "", item: "" })}>返回内容列表</Button>{!doc ? <Empty className="border"><EmptyHeader><EmptyTitle>此内容或依据版本不可访问</EmptyTitle><EmptyDescription>内容不在当前范围、授权已结束，或指定版本不存在。不会回退到新版本替代当时依据。</EmptyDescription></EmptyHeader></Empty> : <><DocumentEditor key={`${actor.staff}:${doc.id}:${requestedVersion || "current"}`} document={doc} readonly={!!requestedVersion} onCreated={created} />{!requestedVersion && !doc.archived && doc.kind === "计划" && <PlanHandoff document={doc} />}{!requestedVersion && !doc.archived && (doc.kind === "资源" || doc.kind === "练习组合") && <HomeworkHandoff document={doc} />}</>}</> : <>
        {tab === "当前工作" && <ResearchOverview group={groupId} navigate={navigate} />}
        {tab === "课程与内容" && <DocumentLibrary group={personal || shared ? undefined : groupId} personal={personal} shared={shared} onOpen={id => navigate({ doc: id, version: "", item: "" })} onCreated={created} />}
        {tab === "任务与协作" && <TaskBoard key={groupId} group={groupId} />}
        {tab === "活动" && <ActivityBoard key={groupId} group={groupId} />}
        {tab === "评价依据" && <CriterionBoard key={groupId} group={groupId} />}
        {tab === "成员" && <ResearchMembers group={groupId} />}
      </>}
    </>}
  </div>
}
