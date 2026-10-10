"use client"

import { useId, useState } from "react"
import { Pencil, Plus } from "lucide-react"
import { Input, Select, Sheet, useToast } from "@/components/kit"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { useCatalog } from "@/lib/school/catalog-store"
import { canMaintainResearchGroups } from "@/lib/school/duty-model"
import type { ResearchGroup } from "@/lib/school/responsibility-scopes"
import { useStaffDutyContext } from "@/lib/school/staff-store"

export function ResponsibilityDirectorySheet({ onClose }: { onClose: () => void }) {
  const { state, people, actor, ready, error, command } = useStaffDutyContext()
  const catalog = useCatalog()
  const { push } = useToast()
  const formId = useId()
  const [editor, setEditor] = useState<{ draft: ResearchGroup; expected?: ResearchGroup } | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [failure, setFailure] = useState("")
  const canManage = ready && !error && canMaintainResearchGroups(state, people, actor)
  const disabling = !!editor?.expected?.active && !editor.draft.active

  function edit(group?: ResearchGroup) {
    setEditor({ draft: group ? { ...group } : { id: `rg-${crypto.randomUUID()}`, name: "", kind: "research_group", department: "教学部", subject: "", active: true }, ...(group ? { expected: { ...group } } : {}) })
    setConfirmed(false)
    setFailure("")
  }

  return <Sheet open onClose={onClose} title="教研负责对象目录" desc="教研组是可选择的工作对象，不是人事二级部门，也不是另一套人员任命。" width="max-w-xl">
    <div className="flex flex-col gap-5 font-sans text-sm leading-relaxed" data-testid="responsibility-directory" data-ready={ready}>
      <Alert role="note"><AlertTitle>一级部门与教研负责对象分开维护</AlertTitle><AlertDescription>一级部门沿用校长室、办公室、教学部、教务部、学生部和后勤部。教研组归口教学部，但不建立部门树、不自动加入教师；新增、重命名或停用对象不授予人员职责。</AlertDescription></Alert>
      {error && <Alert variant="destructive"><AlertTitle>负责对象目录无法保存</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {editor ? <form className="flex flex-col gap-4" aria-label="维护教研负责对象" onSubmit={event => {
        event.preventDefault()
        if (!canManage || disabling && !confirmed) return
        const result = command({ type: "save-group", group: editor.draft, expected: editor.expected })
        if (!result.ok) return setFailure(result.error)
        setEditor(null)
        push("已保存负责对象；已有职责继续使用同一对象编号，不从目录操作推定新权限。")
      }}>
        <h3 className="text-balance font-semibold">{editor.expected ? "修订负责对象" : "新增教研负责对象"}</h3>
        <FieldGroup>
          <Field data-disabled={!canManage}><FieldLabel htmlFor={`${formId}-name`}>教研组名称</FieldLabel><Input id={`${formId}-name`} value={editor.draft.name} required maxLength={40} disabled={!canManage} onChange={event => setEditor({ ...editor, draft: { ...editor.draft, name: event.target.value } })} /><FieldDescription>名称可修订，编号保持不变；职责引用对象编号，而非部门文字。</FieldDescription></Field>
          <Field data-disabled={!canManage}><FieldLabel htmlFor={`${formId}-subject`}>学科关联（可暂不关联）</FieldLabel><Select id={`${formId}-subject`} value={editor.draft.subject} disabled={!canManage} onChange={event => setEditor({ ...editor, draft: { ...editor.draft, subject: event.target.value } })}><option value="">暂不关联</option>{catalog.subjects.map(subject => <option key={subject.code} value={subject.code}>{subject.name}</option>)}</Select><FieldDescription>责任课程仍在原课程目录中明确设置，不因同名学科自动取得课程权限。</FieldDescription></Field>
          <Field orientation="horizontal" data-disabled={!canManage}><input id={`${formId}-active`} type="checkbox" checked={editor.draft.active} disabled={!canManage} className="size-4 shrink-0 accent-primary" onChange={event => { setEditor({ ...editor, draft: { ...editor.draft, active: event.target.checked } }); setConfirmed(false) }} /><FieldLabel htmlFor={`${formId}-active`}>启用为可选择的负责对象</FieldLabel></Field>
          {disabling && <><Alert role="note"><AlertTitle>停用不删除历史</AlertTitle><AlertDescription>停用后不再提供新的职责选择，也不再凭该对象进入组内工作区。既有职责、任期、资料和任务保留，可经核验后恢复启用。</AlertDescription></Alert><Field orientation="horizontal"><input id={`${formId}-confirm`} type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required className="size-4 shrink-0 accent-primary" /><FieldLabel htmlFor={`${formId}-confirm`}>确认停用此负责对象并保留已有记录</FieldLabel></Field></>}
        </FieldGroup>
        {failure && <Alert variant="destructive"><AlertTitle>目录未保存</AlertTitle><AlertDescription>{failure}</AlertDescription></Alert>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditor(null)}>返回目录</Button><Button type="submit" disabled={!canManage || !editor.draft.name.trim() || disabling && !confirmed}>保存对象</Button></div>
      </form> : <>
        <header className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">现有教研组</h3><Button type="button" size="sm" disabled={!canManage} onClick={() => edit()}><Plus data-icon="inline-start" />新增负责对象</Button></header>
        {!canManage && <p className="text-muted-foreground">当前仅可查看目录；教研组长或参与教师不自动拥有目录维护权。</p>}
        <ul className="flex flex-col gap-3">{state.groups.map(group => <li key={group.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"><div className="flex min-w-0 flex-col gap-2"><h4 className="font-semibold">{group.name}</h4><p className="text-muted-foreground">归口 {group.department} · 教研负责对象 · {catalog.subjects.find(subject => subject.code === group.subject)?.name || "学科暂未关联"}</p><Badge variant={group.active ? "secondary" : "outline"}>{group.active ? "可选择" : "已停用 · 历史保留"}</Badge></div>{canManage && <Button type="button" variant="outline" size="sm" aria-label={`修订${group.name}负责对象`} onClick={() => edit(group)}><Pencil data-icon="inline-start" />修订对象</Button>}</li>)}</ul>
      </>}
      <p className="text-muted-foreground">人员安排只从“教职工 → 安排职责”办理。选择职责模板、已有教研组与生效时间；同一人员可以负责多个组。</p>
    </div>
  </Sheet>
}
