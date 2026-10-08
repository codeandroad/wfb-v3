"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CriterionEditor } from "./criterion-editor"
import { CriterionAdoption } from "./criterion-adoption"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { useResearchContext } from "@/lib/research/context"
import { canEditGroup, canReadCriterion, canReadDocument, canViewGroup, itemReadable, type Criterion } from "@/lib/research/model"
import { documentHref, Panel, RichText } from "./primitives"

export function CriterionBoard({ group }: { group: string }) {
  const { state, actor } = useResearchContext()
  const [editing, setEditing] = useState<string | null>(null)
  const editable = canEditGroup(state, actor, group)
  const criteria = canViewGroup(state, actor, group)
    ? state.criteria.filter(criterion => criterion.group === group)
    : []

  return (
    <section className="flex min-w-0 flex-col gap-5" aria-label="评价依据">
      <Alert role="note">
        <AlertTitle>共建依据不等于已经采用</AlertTitle>
        <AlertDescription>
          课堂表现、作业质量、题目评分和单次考核换算分别保留。A 沿用既有“优秀”语义，不是 GPA；组内推荐不会自动改写教师已记录的评价或成绩。
        </AlertDescription>
      </Alert>
      {editable && !editing && <Button className="self-start" onClick={() => setEditing("new")}>共建新的评价依据</Button>}
      {editable && editing && <CriterionEditor key={editing} group={group} criterion={criteria.find(c => c.id === editing)} onClose={() => setEditing(null)} />}
      {criteria.map(criterion => <CriterionDetails key={criterion.id} criterion={criterion} onEdit={editable && canReadCriterion(state, actor, criterion) ? () => setEditing(criterion.id) : undefined} />)}
      {!criteria.length && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>暂无可查看的评价依据</EmptyTitle>
            <EmptyDescription>仅显示当前有权访问的科组依据，不会用默认分数线补齐缺失内容。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  )
}

function CriterionDetails({ criterion, onEdit }: { criterion: Criterion; onEdit?: () => void }) {
  const { state, actor } = useResearchContext()
  const document = state.documents.find(doc => doc.id === criterion.documentId)
  const item = document?.items.find(entry => entry.id === criterion.itemId)
  const sourceReadable = !criterion.documentId || !!document && canReadDocument(state, actor, document)
    && (!criterion.itemId || !!item && itemReadable(state, actor, item, document.owner))
  const dimensionScheme = criterion.kind === "课堂表现方案" || criterion.kind === "作业质量方案"

  return (
    <Panel
      title={criterion.title}
      description={`${criterion.kind} · 保存版本 v${criterion.version}`}
      action={<Badge variant={criterion.recommended ? "secondary" : "outline"}>{criterion.recommended ? "组内推荐" : "未推荐"}</Badge>}
    >
      {!sourceReadable ? (
        <p className="text-muted-foreground">评分来源受独立授权限制。科组查看权限不授予来源正文、答案或评分资料的读取权。</p>
      ) : (
        <>
          <RichText text={`来源：${criterion.source || "未提供，不视为官方规则"}`} />
          {criterion.notes && <RichText text={criterion.notes} />}
          {dimensionScheme && (
            <section className="flex flex-col gap-3" aria-label="评价维度">
              <h3 className="font-semibold">评价维度与含义</h3>
              {criterion.dimensions.map(dimension => (
                <div key={dimension.id} className="flex flex-col gap-1">
                  <h4 className="font-medium">{dimension.name}</h4>
                  <RichText text={dimension.meaning || "尚未整理说明"} />
                </div>
              ))}
              {!criterion.dimensions.length && <p className="text-muted-foreground">尚未整理评价维度。</p>}
            </section>
          )}
          {criterion.kind !== "题目评分依据" && (
            <section className="flex flex-col gap-3" aria-label="等级字典">
              <h3 className="font-semibold">等级含义与判断说明</h3>
              {criterion.levels.map(level => (
                <div key={level.id} className="flex flex-col gap-1">
                  <h4 className="font-medium">{level.code} · {level.label}</h4>
                  <RichText text={level.guide || "尚未整理判断说明"} />
                </div>
              ))}
              {!criterion.levels.length && <p className="text-muted-foreground">尚未关联等级字典。</p>}
            </section>
          )}
          {criterion.kind === "题目评分依据" && (
            <section className="flex flex-col gap-3" aria-label="题目评分说明">
              <h3 className="font-semibold">关联题目与评分说明</h3>
              {document ? (
                <Link className="self-start text-primary underline underline-offset-4" href={documentHref(document, actor.staff, canViewGroup(state, actor, document.owner), undefined, criterion.itemId || undefined)}>
                  {document.title}{item ? ` · ${item.title}` : ""}
                </Link>
              ) : <p className="text-muted-foreground">尚未关联来源题目。</p>}
              <p>满分：{criterion.maxScore === null ? "未提供" : `${criterion.maxScore} 分`}</p>
              <RichText text={criterion.scoring || "尚未整理得分点，不自动推定评分规则。"} />
            </section>
          )}
          {onEdit && <Button variant="outline" className="self-start" onClick={onEdit}>修订此依据（不更改已采用版本）</Button>}
          <CriterionAdoption criterion={criterion} />
          {criterion.kind === "单次考核等级换算" && (
            <section className="flex flex-col gap-3" aria-label="单次考核换算范围">
              <h3 className="font-semibold">单次考核与分数线</h3>
              <p>考核名称：{criterion.testName || "尚未指定"}</p>
              {[...criterion.thresholds].sort((a, b) => b.minimum - a.minimum).map((threshold, index) => (
                <p key={`${threshold.code}:${index}`}>最低 {threshold.minimum} 分：{threshold.code} · {criterion.levels.find(level => level.code === threshold.code)?.label || "等级未关联"}</p>
              ))}
              {!criterion.thresholds.length && <p className="text-muted-foreground">未提供分数线，暂不换算。</p>}
              <p className="text-muted-foreground">使用时须明确绑定具体考核及参与名单，不能作为整科永久规则。</p>
            </section>
          )}
        </>
      )}
    </Panel>
  )
}
