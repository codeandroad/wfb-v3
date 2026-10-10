"use client"

import { Badge, Field, Input, Sheet } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { applyStaffDutyCommand, createResearchDuty, dutyDateValid, isResearchDuty, manageableResearchGroups } from "@/lib/school/duty-model"
import { useStaffDutyContext } from "@/lib/school/staff-store"
import { ResponsibilityDirectorySheet } from "./responsibility-directory-sheet"
import { cn } from "@/lib/utils"
import {
  DEMO_TODAY,
  DUTIES_BY_ROLE,
  DUTY_BY_KEY,
  SCOPE_CANDIDATES,
  researchScopeConfig,
  SYSTEM_ROLE_LABEL,
  type ScopeConfig,
  type DutyKey,
  type ScopeCandidate,
  type StaffProfile,
} from "@/lib/demo/staff"
import {
  DivisionForm,
  evaluateTarget,
  PICKER_UI_DEFAULT,
  TeachingScopePicker,
  useTeachPerm,
  type PickerUi,
} from "@/components/school/teaching-assign"
import {
  defaultTenureFrom,
  draftKey,
  teacherIdForStaff,
  teachingTargets,
  useTeaching,
  type DraftDivision,
} from "@/lib/teaching/store"
import { Ban, Check, CircleAlert, Info, Lock, Minus, Search, X } from "lucide-react"
import { useMemo, useState } from "react"

const isTeachDuty = (k: DutyKey) => k === "primary_teach" || k === "co_teach"

interface ArrangeProps {
  open: boolean
  onClose: () => void
  mode?: "arrange" | "adjust"
  staff?: StaffProfile | null
  lockStaff?: boolean
  presetClass?: { id: string; name: string }
  presetCourse?: { name: string }
  presetDuty?: DutyKey
  presetScope?: string
  presetPerson?: string // 新建员工后带入的人名（可能尚未在 STAFF 中）
  existingPrimaryHead?: string
}

export function DutyArrangeSheet(props: ArrangeProps) {
  const {
    open,
    onClose,
    mode = "arrange",
    staff,
    lockStaff,
    presetClass,
    presetCourse,
    presetDuty,
    presetScope,
    presetPerson,
    existingPrimaryHead,
  } = props

  const allowedKeys: DutyKey[] = presetClass
    ? ["head_primary", "head_assistant"]
    : presetCourse
      ? ["course_material", "course_structure"]
      : (Object.keys(DUTY_BY_KEY) as DutyKey[])

  const dutyContext = useStaffDutyContext()
  const initialDuty = presetDuty ?? (allowedKeys.includes("research_participate") ? "research_participate" : allowedKeys[0])
  const [staffId, setStaffId] = useState(staff?.id ?? dutyContext.people.find(person => person.name === presetPerson)?.id ?? "")
  const [directoryOpen, setDirectoryOpen] = useState(false)
  // 角色下的职责为多选：可同时勾选多项，每项各自维护负责范围
  const [dutyKeys, setDutyKeys] = useState<DutyKey[]>([initialDuty])
  const [scopeByDuty, setScopeByDuty] = useState<Record<string, ScopeCandidate[]>>(() => {
    if (!presetScope) return {}
    const cfg = isResearchDuty(initialDuty) ? researchScopeConfig(dutyContext.state.groups) : SCOPE_CANDIDATES[initialDuty]
    if (cfg.mode === "fixed") return {}
    const hit = cfg.items.find((c) => c.id === presetScope && !c.disabled)
    return hit ? { [initialDuty]: [hit] } : {}
  })
  const [queryByDuty, setQueryByDuty] = useState<Record<string, string>>({})
  const [guideOpen, setGuideOpen] = useState<Record<string, boolean>>({})
  const [start, setStart] = useState(() => isResearchDuty(initialDuty) ? dutyContext.actor.date : DEMO_TODAY > defaultTenureFrom() ? DEMO_TODAY : defaultTenureFrom())
  const [hasEnd, setHasEnd] = useState(false)
  const [end, setEnd] = useState("")
  const [done, setDone] = useState(false)

  // 任教类职责：与教学班侧共用目标模型与提交命令
  const teaching = useTeaching()
  const { canAppoint } = useTeachPerm()
  const [teachSel, setTeachSel] = useState<Record<string, string[]>>({})
  const [pickerUi, setPickerUi] = useState<Record<string, PickerUi>>({})
  const [drafts, setDrafts] = useState<DraftDivision[]>([])
  const [creating, setCreating] = useState<{ duty: DutyKey; classId: string } | null>(null)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [token] = useState(() => `tk-${Math.random().toString(36).slice(2)}`)

  const selectedStaff = useMemo(() => dutyContext.people.find(person => person.id === staffId) ?? null, [staffId, dutyContext.people])
  const personName = selectedStaff?.name ?? presetPerson ?? null
  const accountNotOpened = selectedStaff ? selectedStaff.accountStatus !== "enabled" : !!presetPerson
  const teacherId = selectedStaff ? teacherIdForStaff(selectedStaff.id) : null
  const period = { from: start, to: hasEnd ? end || null : null }
  const targetsByKey = useMemo(() => new Map(teachingTargets(teaching).map((t) => [t.key, t])), [teaching])

  function teachInvalid(k: DutyKey) {
    return (teachSel[k] ?? []).some((key) => {
      if (key.startsWith("D:")) return false
      const t = targetsByKey.get(key)
      return !t || evaluateTarget(teaching, t, teacherId, period).state === "self"
    })
  }

  function scopeConfig(k: DutyKey) {
    if (!isResearchDuty(k)) return SCOPE_CANDIDATES[k]
    const cfg = researchScopeConfig(dutyContext.state.groups)
    const allowed = manageableResearchGroups(dutyContext.state, dutyContext.people, dutyContext.actor, k)
    return { ...cfg, items: cfg.items.map(item => ({ ...item, disabled: item.disabled || !allowed.includes(item.id), disabledReason: item.disabledReason ?? (!allowed.includes(item.id) ? "不在当前身份的职责安排范围内" : undefined) })) }
  }
  function hasScopeFor(k: DutyKey) {
    if (isTeachDuty(k)) return !!teacherId && canAppoint && (teachSel[k]?.length ?? 0) > 0 && !teachInvalid(k)
    const cfg = scopeConfig(k)
    if (cfg.mode === "fixed") return true
    const selected = effectiveScope(k)
    if (isResearchDuty(k)) return dutyContext.ready && !dutyContext.error && !!selectedStaff && selectedStaff.status !== "left" && selectedStaff.systemRoles.includes(DUTY_BY_KEY[k].role) && selected.length > 0 && selected.every(item => !item.disabled)
    return selected.length > 0
  }
  function effectiveScope(k: DutyKey) {
    const cfg = scopeConfig(k)
    return cfg.mode === "fixed" ? cfg.items : (scopeByDuty[k] ?? []).map(item => cfg.items.find(candidate => candidate.id === item.id)).filter((item): item is ScopeCandidate => !!item)
  }

  const researchSelected = dutyKeys.some(isResearchDuty)
  const anyPrimaryConflict = dutyKeys.includes("head_primary") && !!existingPrimaryHead
  const allHaveScope = dutyKeys.length > 0 && dutyKeys.every(hasScopeFor)
  const datesValid = dutyDateValid(start) && (!hasEnd || dutyDateValid(end) && end >= start)
  const researchAssignments = dutyKeys.filter(isResearchDuty).flatMap(key => effectiveScope(key).map(scope => createResearchDuty(`${token}:${key}:${scope.id}`, staffId, key, scope.id, start, hasEnd ? end : undefined, dutyContext.state.groups)))
  let researchValidation = ""
  if (researchSelected && allHaveScope && datesValid) {
    try { applyStaffDutyCommand(dutyContext.state, dutyContext.actor, { type: "arrange", assignments: researchAssignments }, dutyContext.people) }
    catch (error) { researchValidation = error instanceof Error ? error.message : "请核对职责任期与负责对象。" }
  }
  const canConfirm = !!personName && allHaveScope && datesValid && !anyPrimaryConflict && !researchValidation

  function toggleDuty(k: DutyKey) {
    const removing = dutyKeys.includes(k)
    setDutyKeys(prev => removing ? prev.filter(key => key !== k) : [...prev.filter(key => isResearchDuty(key) === isResearchDuty(k)), k])
    if (removing) {
      setScopeByDuty((s) => {
        const n = { ...s }
        delete n[k]
        return n
      })
      setQueryByDuty((s) => {
        const n = { ...s }
        delete n[k]
        return n
      })
    }
  }

  function toggleScope(k: DutyKey, c: ScopeCandidate) {
    if (c.disabled && !(scopeByDuty[k] ?? []).some(item => item.id === c.id)) return
    const cfg = scopeConfig(k)
    setScopeByDuty((prev) => {
      const cur = prev[k] ?? []
      const exists = cur.some((x) => x.id === c.id)
      const next = exists ? cur.filter((x) => x.id !== c.id) : cfg.multi ? [...cur, c] : [c]
      return { ...prev, [k]: next }
    })
  }

  function teachLabel(key: string) {
    if (key.startsWith("D:")) {
      const d = drafts.find((x) => x.tempId === key.slice(2))
      const cls = teaching.classes.find((c) => c.id === d?.classId)
      return `${cls?.name ?? ""}｜${d?.sharedMark ?? "未命名分工"}（新建）`
    }
    const t = targetsByKey.get(key)
    return t ? `${t.className}｜${t.divisionLabel}` : key
  }

  function confirm() {
    setCommitError(null)
    if (!canConfirm) return
    if (researchSelected) {
      const result = dutyContext.command({ type: "arrange", assignments: researchAssignments })
      if (!result.ok) return setCommitError(result.error)
      setDone(true)
      return
    }
    const teachKeys = dutyKeys.filter(isTeachDuty)
    if (teachKeys.length && teacherId) {
      const assigns = teachKeys.flatMap((k) =>
        (teachSel[k] ?? []).map((targetKey) => ({
          targetKey,
          teacherId,
          from: period.from,
          to: period.to,
          role: (k === "primary_teach" ? "primary" : "co") as "primary" | "co",
        })),
      )
      const used = drafts.filter((d) => assigns.some((a) => a.targetKey === draftKey(d.tempId)))
      const res = teaching.commitTeaching(token, used, assigns)
      if (!res.ok) return setCommitError(res.reason)
    }
    setDone(true)
  }

  const results = dutyKeys.map((k) => {
    const def = DUTY_BY_KEY[k]
    return {
      key: k,
      dutyLabel: def.label,
      role: SYSTEM_ROLE_LABEL[def.role],
      scope: isTeachDuty(k)
        ? (teachSel[k] ?? []).map(teachLabel).join("、")
        : effectiveScope(k)
            .map((c) => c.label)
            .join("、"),
      needsQualification: selectedStaff ? !selectedStaff.systemRoles.includes(def.role) : false,
    }
  })

  const title = mode === "adjust" ? "调整职责" : "安排职责"

  const close = () => {
    setDone(false)
    onClose()
  }

  if (!open) return null
  if (directoryOpen) return <ResponsibilityDirectorySheet onClose={() => setDirectoryOpen(false)} />

  return (
    <Sheet
      open={open}
      onClose={close}
      title={done ? researchSelected ? "职责安排结果" : "安排结果（示例状态）" : title}
      desc={
        done
          ? researchSelected ? "已保存本机演示职责；教职工详情与我的教研使用同一份任期记录，尚未接入正式服务端。" : "以下为预设示例结果，未写入真实系统。"
          : "选择人员、职责模板、各自负责对象与生效时间。教研组是工作对象，不是人事二级部门。"
      }
      width="max-w-xl"
      footer={
        done ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={close}>
              完成
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={close}>
              取消
            </Button>
            <span className="flex items-center gap-3">
              {commitError ? (
                <span role="alert" className="text-xs text-destructive">
                  {commitError}
                </span>
              ) : null}
              <Button size="sm" disabled={!canConfirm || !!creating} onClick={confirm}>
                确认安排
              </Button>
            </span>
          </div>
        )
      }
    >
      {creating && teacherId ? (
        (() => {
          const cls = teaching.classes.find((c) => c.id === creating.classId)
          if (!cls) return null
          return (
            <div>
              <p className="mb-3 text-[13px] font-semibold">新建教学分工并安排</p>
              <DivisionForm
                cls={cls}
                mode="draft"
                lockedTeacherId={teacherId}
                lockedPeriod={period}
                onCancel={() => setCreating(null)}
                onDraft={(d) => {
                  setDrafts((ds) => [...ds, d])
                  setTeachSel((s) => ({ ...s, [creating.duty]: [...(s[creating.duty] ?? []), draftKey(d.tempId)] }))
                  setCreating(null)
                }}
              />
            </div>
          )
        })()
      ) : done ? (
        <ResultView
          staffName={personName ?? "（未选择）"}
          results={results}
          start={start}
          end={hasEnd ? end : undefined}
          accountNotOpened={accountNotOpened}
          persisted={researchSelected}
        />
      ) : (
        <div className="space-y-5">
          {/* A 人员 */}
          <Section step="人员">
            {lockStaff && selectedStaff ? (
              <PersonCard staff={selectedStaff} />
            ) : presetPerson && !selectedStaff ? (
              <PresetPersonCard name={presetPerson} />
            ) : (
              <>
                <select
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  aria-label="选择人员"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[14px] text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
                >
                  <option value="">选择人员…</option>
                  {dutyContext.people.filter(person => person.status !== "left").map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}（{s.employeeNo}）
                    </option>
                  ))}
                </select>
                {selectedStaff ? (
                  <div className="mt-2">
                    <PersonCard staff={selectedStaff} />
                  </div>
                ) : null}
              </>
            )}
          </Section>

          {/* B 角色（下辖职责可多选） */}
          <Section step="职责模板">
            <p className="mb-2 text-sm leading-relaxed text-muted-foreground">模板决定工作边界；负责对象决定在哪个教研组或具体范围内履职。教研职责可多选、可跨组，与任课等其他职责分次确认，避免跨业务部分保存。</p>
            <FieldGroup>
              {DUTIES_BY_ROLE.filter(group => group.duties.some(duty => allowedKeys.includes(duty.key))).map(group => {
                const keys = group.duties.filter(duty => allowedKeys.includes(duty.key)).map(duty => duty.key)
                const selected = dutyKeys.filter(key => keys.includes(key))
                return <FieldSet key={group.role}>
                  <FieldLegend variant="label">{SYSTEM_ROLE_LABEL[group.role]}资格对应的职责</FieldLegend>
                  <ToggleGroup multiple variant="outline" aria-label={`${SYSTEM_ROLE_LABEL[group.role]}职责模板`} value={selected} className="grid w-full gap-2 sm:grid-cols-2" onValueChange={values => {
                    const key = values.find(value => !selected.includes(value as DutyKey)) ?? selected.find(value => !values.includes(value))
                    if (key) toggleDuty(key as DutyKey)
                  }}>
                    {group.duties.filter(duty => allowedKeys.includes(duty.key)).map(duty => <ToggleGroupItem key={duty.key} value={duty.key} aria-label={duty.label} data-testid={`duty-template-${duty.key}`} className="h-auto min-w-0 items-start justify-start whitespace-normal">
                      <span className="flex min-w-0 flex-col gap-1 text-left"><span>{duty.label}</span><span className="text-sm leading-relaxed text-muted-foreground">{duty.blurb}</span></span>
                    </ToggleGroupItem>)}
                  </ToggleGroup>
                </FieldSet>
              })}
            </FieldGroup>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDirectoryOpen(true)}>查看／维护教研负责对象目录</Button>
            {dutyKeys.length === 0 ? (
              <p className="mt-2 text-xs text-[#a5561e]">请至少勾选一项职责。</p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground/70">已勾选 {dutyKeys.length} 项职责。</p>
            )}
          </Section>

          {/* C 生效时间（本次安排统一） */}
          <Section step="生效时间">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="开始日期">
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <div>
                <p className="mb-1.5 text-[13px] font-medium">结束时间</p>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="radio" checked={!hasEnd} onChange={() => setHasEnd(false)} className="accent-primary" />
                  未设结束日期
                </label>
                <label className="mt-1 flex items-center gap-2 text-[13px]">
                  <input type="radio" checked={hasEnd} onChange={() => setHasEnd(true)} className="accent-primary" />
                  指定结束日期
                </label>
                {hasEnd ? <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1.5" /> : null}
              </div>
            </div>
          </Section>

          {!datesValid && <Alert variant="destructive"><AlertTitle>生效时间无效</AlertTitle><AlertDescription>请填写真实开始日期；指定结束日期时必须填写，且不得早于开始日期。</AlertDescription></Alert>}
          {researchSelected && (dutyContext.error || researchValidation) && <Alert variant="destructive"><AlertTitle>职责暂不能安排</AlertTitle><AlertDescription>{dutyContext.error || researchValidation}</AlertDescription></Alert>}
          {researchSelected && selectedStaff && !dutyKeys.filter(isResearchDuty).every(key => selectedStaff.systemRoles.includes(DUTY_BY_KEY[key].role)) && <Alert><AlertTitle>所需任职资格尚未具备</AlertTitle><AlertDescription>请先由有权人员核验资格；本次不会自动补授系统角色或开通账号。</AlertDescription></Alert>}
          {/* D 每个已选职责：负责范围 + 预览 */}
          <Section step="职责明细">
            {dutyKeys.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-6 text-center text-[13px] text-muted-foreground">
                勾选上方职责后，这里按项显示各自的负责范围与结果预览。
              </div>
            ) : (
              <div className="space-y-3">
                {dutyKeys.map((k) =>
                  isTeachDuty(k) ? (
                    <div key={k} className="rounded-xl border border-border bg-card p-3.5">
                      <p className="text-[13px] font-semibold">{DUTY_BY_KEY[k].label}</p>
                      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
                        任教范围：教学班整科或具体教学分工。与教学班详情中的任教团队是同一份任教关系，任期即上方生效时间。
                      </p>
                      {!teacherId ? (
                        <p className="text-xs text-muted-foreground">请先选择人员。</p>
                      ) : !canAppoint ? (
                        <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                          当前操作者没有任命权，不能安排任教。
                        </p>
                      ) : (
                        <TeachingScopePicker
                          teacherId={teacherId}
                          period={period}
                          selected={teachSel[k] ?? []}
                          onChange={(keys) => setTeachSel((s) => ({ ...s, [k]: keys }))}
                          drafts={drafts}
                          onRemoveDraft={(id) => setDrafts((ds) => ds.filter((d) => d.tempId !== id))}
                          ui={pickerUi[k] ?? PICKER_UI_DEFAULT}
                          onUi={(ui) => setPickerUi((s) => ({ ...s, [k]: ui }))}
                          onCreateDivision={(classId) => setCreating({ duty: k, classId })}
                        />
                      )}
                    </div>
                  ) : (
                  <DutyDetailCard
                    key={k}
                    dutyKey={k}
                    scopeConfig={scopeConfig(k)}
                    selected={effectiveScope(k)}
                    query={queryByDuty[k] ?? ""}
                    onQuery={(v) => setQueryByDuty((s) => ({ ...s, [k]: v }))}
                    onToggleScope={(c) => toggleScope(k, c)}
                    guideOpen={!!guideOpen[k]}
                    onToggleGuide={() => setGuideOpen((s) => ({ ...s, [k]: !s[k] }))}
                    personName={personName}
                    accountNotOpened={accountNotOpened}
                    selectedStaff={selectedStaff}
                    existingPrimaryHead={existingPrimaryHead}
                    start={start}
                    end={hasEnd ? end : undefined}
                  />
                  ),
                )}
              </div>
            )}
          </Section>
        </div>
      )}
    </Sheet>
  )
}

function Section({ step, children }: { step: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 text-[13px] font-semibold text-foreground">{step}</p>
      {children}
    </section>
  )
}

function DutyDetailCard({
  dutyKey,
  scopeConfig,
  selected,
  query,
  onQuery,
  onToggleScope,
  guideOpen,
  onToggleGuide,
  personName,
  accountNotOpened,
  selectedStaff,
  existingPrimaryHead,
  start,
  end,
}: {
  dutyKey: DutyKey
  scopeConfig: ScopeConfig
  selected: ScopeCandidate[]
  query: string
  onQuery: (v: string) => void
  onToggleScope: (c: ScopeCandidate) => void
  guideOpen: boolean
  onToggleGuide: () => void
  personName?: string | null
  accountNotOpened: boolean
  selectedStaff: StaffProfile | null
  existingPrimaryHead?: string
  start: string
  end?: string
}) {
  const def = DUTY_BY_KEY[dutyKey]
  const scopeCfg = scopeConfig
  const isFixed = scopeCfg.mode === "fixed"
  const effectiveSelected = isFixed ? scopeCfg.items : selected
  const scopeText = effectiveSelected.map((c) => c.label).join("、")
  const hasScope = isFixed || selected.length > 0
  const needsQualification = selectedStaff ? !selectedStaff.systemRoles.includes(def.role) : false
  const primaryConflict = dutyKey === "head_primary" && !!existingPrimaryHead

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return scopeCfg.items
    return scopeCfg.items.filter((c) => c.label.includes(q) || c.parentPath.includes(q) || (c.meta ?? "").includes(q))
  }, [query, scopeCfg])

  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{def.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {SYSTEM_ROLE_LABEL[def.role]} · 对象类型：{scopeCfg.objectNoun}
          </p>
        </div>
        <button
          onClick={onToggleGuide}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Info className="size-3.5" />
          说明
        </button>
      </div>

      {guideOpen ? (
        <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p>{def.blurb}</p>
          <p className="mt-1.5">对象类型：{def.scopeKind}</p>
          <p className="mt-1.5">安排方式：{def.arrangeableBy}</p>
        </div>
      ) : null}

      {/* 负责范围 */}
      <div className="mt-3">
        <p className="mb-1.5 text-sm font-semibold text-foreground">{isResearchDuty(dutyKey) ? "负责对象" : "负责范围"}</p>
        {isFixed ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <Lock className="size-3.5 text-muted-foreground" />
              {scopeCfg.items[0].label}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{scopeCfg.fixedNote}</p>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              只能从既有结构中搜索选择，不能手动输入为授权范围。
            </p>

            {selected.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selected.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-accent/50 px-2 py-1 text-xs"
                  >
                    <span className="font-medium">{c.label}</span>
                    <span className="text-muted-foreground/70">· {c.parentPath}</span>
                    <button
                      onClick={() => onToggleScope(c)}
                      aria-label={`移除 ${c.label}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder={scopeCfg.searchPlaceholder}
                className="pl-9"
                aria-label="搜索负责对象"
              />
            </div>

            <div className="mt-2 max-h-60 overflow-auto rounded-lg border border-border">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">
                  暂无可选{scopeCfg.objectNoun}。可前往已有教学班管理示例查看，此处不新建班级 / 课程 / 学生。
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((c) => {
                    const picked = selected.some((x) => x.id === c.id)
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => onToggleScope(c)}
                          aria-pressed={picked}
                          aria-label={`${def.label} · ${c.label}`}
                          disabled={c.disabled}
                          className={cn(
                            "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors",
                            c.disabled ? "cursor-not-allowed opacity-70" : "hover:bg-muted/50",
                            picked ? "bg-accent/40" : "",
                          )}
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                              {c.label}
                              {c.disabled ? <Ban className="size-3 text-muted-foreground" /> : null}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{c.parentPath}</span>
                            {c.meta ? <span className="mt-0.5 block text-xs text-muted-foreground/70">{c.meta}</span> : null}
                            {c.disabled && c.disabledReason ? (
                              <span className="mt-0.5 block text-xs text-[#a5561e]">{c.disabledReason}</span>
                            ) : null}
                          </span>
                          {picked ? <Check className="mt-0.5 size-4 shrink-0 text-primary" /> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {!hasScope ? (
              <p className="mt-2 text-xs text-muted-foreground">{scopeCfg.emptyHint}，未选择前不显示授予成功。</p>
            ) : null}
            {scopeCfg.multi ? (
              <p className="mt-1.5 text-xs text-muted-foreground/70">
                多选仅包含当前选中的对象，不含将来新增单元；年级 / 部门不是授权范围。
              </p>
            ) : null}
          </>
        )}

        {primaryConflict ? (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] p-3 text-[12.5px] text-[#7a5514]">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <div>该班已有有效主班主任（{existingPrimaryHead}）。需先调整现有主班主任安排，此处不会静默覆盖。</div>
          </div>
        ) : null}
      </div>

      {/* 预览 */}
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-semibold text-foreground">结果预览</p>
        <PreviewBlock
          staffName={personName}
          dutyLabel={def.label}
          scope={scopeText}
          start={start}
          end={end}
          canDo={def.canDo}
          cannotDo={def.cannotDo}
          needsQualification={needsQualification}
          role={SYSTEM_ROLE_LABEL[def.role]}
          accountNotOpened={accountNotOpened}
          hasScope={hasScope}
          emptyHint={scopeCfg.emptyHint}
          strictQualification={isResearchDuty(dutyKey)}
        />
      </div>
    </div>
  )
}

function PersonCard({ staff }: { staff: StaffProfile }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
      <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
        {staff.name.slice(-2)}
      </span>
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="font-medium">
          {staff.name}
          <span className="ml-1.5 font-mono text-xs text-muted-foreground">{staff.employeeNo}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {staff.department}／{staff.jobTitle} · {staff.accountStatus === "none" ? "账号未开通" : staff.username}
        </p>
      </div>
    </div>
  )
}

function PresetPersonCard({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border bg-muted/40 p-3">
      <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
        {name.slice(-2)}
      </span>
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">新建档案（示例）· 账号未开通</p>
      </div>
    </div>
  )
}

function PreviewBlock({
  staffName,
  dutyLabel,
  scope,
  start,
  end,
  canDo,
  cannotDo,
  needsQualification,
  role,
  accountNotOpened,
  hasScope,
  emptyHint,
  strictQualification = false,
}: {
  staffName?: string | null
  dutyLabel: string
  scope: string
  start: string
  end?: string
  canDo: string[]
  cannotDo: string[]
  needsQualification: boolean
  role: string
  accountNotOpened: boolean
  hasScope: boolean
  emptyHint: string
  strictQualification?: boolean
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="text-[13px]">
        <p>
          为 <span className="font-semibold">{staffName ?? "（未选择人员）"}</span> 安排：
          <span className="font-semibold">{dutyLabel}</span>
        </p>
        <p className="mt-1 text-muted-foreground">负责范围：{scope || "（未选择对象）"}</p>
        <p className="mt-0.5 text-muted-foreground">
          时间：{start} 起 · {end ? end + " 止" : "未设结束日期"}
        </p>
      </div>

      {!hasScope ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-[12.5px] text-muted-foreground">
          {emptyHint}。未选择对象前不预览授予成功。
        </div>
      ) : (
        <>
          {/* 工作安排 */}
          <div className="rounded-lg border border-[#bcdcc8] bg-[#f3f9f5] p-3">
            <p className="text-[12.5px] font-semibold text-[#256a49]">工作安排</p>
            <p className="mt-1 text-[12.5px] text-foreground">
              登记本项职责；{needsQualification ? strictQualification ? `缺少 ${role}资格，不能提交；不会自动补授资格。` : `并补充 ${role}资格（仅本项所需，不授予其他角色或全校权限）。` : "所需资格已具备。"}
            </p>
          </div>

          {/* 系统访问 */}
          <div
            className={cn(
              "rounded-lg border p-3",
              accountNotOpened ? "border-[#e6d4a8] bg-[#fbf7ee]" : "border-border bg-card",
            )}
          >
            <p className={cn("text-[12.5px] font-semibold", accountNotOpened ? "text-[#7a5514]" : "text-foreground")}>系统访问</p>
            {accountNotOpened ? (
              <p className="mt-1 text-[12.5px] text-[#7a5514]">
                尚未开通账号。本次仅登记任命，不创建登录账号；后续开通时按仍有效的批准安排核验并办理必要访问授权，不自动继承、不扩大范围。
              </p>
            ) : (
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                按批准配置处理必要的访问来源；在资格、关联、任命、来源及期间等条件有效时可用。
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[12.5px] font-semibold text-[#256a49]">可以办理</p>
              <ul className="space-y-1">
                {canDo.map((t) => (
                  <li key={t} className="flex items-start gap-1.5 text-[12.5px]">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-[#2f7d5b]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[12.5px] font-semibold text-muted-foreground">不包含</p>
              <ul className="space-y-1">
                {cannotDo.slice(0, 3).map((t) => (
                  <li key={t} className="flex items-start gap-1.5 text-[12.5px] text-muted-foreground">
                    <Minus className="mt-0.5 size-3.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ResultView({
  staffName,
  results,
  start,
  end,
  accountNotOpened,
  persisted = false,
}: {
  staffName: string
  results: { key: string; dutyLabel: string; role: string; scope: string; needsQualification: boolean }[]
  start: string
  end?: string
  accountNotOpened: boolean
  persisted?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#bcdcc8] bg-[#f3f9f5] p-4">
        <Badge tone={accountNotOpened ? "warning" : "success"}>
          {persisted ? "职责已保存 · 按任期与账号状态核验访问" : accountNotOpened ? "任命已登记 · 访问待开通（示例）" : "任命已登记 · 访问可用（示例）"}
        </Badge>
        <p className="mt-2 text-[14px] font-semibold">{staffName}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          共安排 {results.length} 项职责 · 生效时间：{start} 起 · {end ? end + " 止" : "未设结束日期"}
        </p>
      </div>

      {results.map((r) => (
        <div key={r.key} className="rounded-lg border border-border bg-card p-3 text-[12.5px]">
          <p className="text-[13px] font-semibold text-foreground">{r.dutyLabel}</p>
          <p className="mt-0.5 text-muted-foreground">负责范围：{r.scope || "（未选择对象）"}</p>
          <p className="mt-1.5 font-semibold text-foreground">工作安排</p>
          <p className="mt-0.5 text-muted-foreground">
            已登记本项任命。{r.needsQualification ? `已同时补充 ${r.role}资格（仅本项所需）。` : "所需资格已具备。"}
          </p>
        </div>
      ))}

      <div
        className={cn(
          "rounded-lg border p-3 text-[12.5px]",
          accountNotOpened ? "border-[#e6d4a8] bg-[#fbf7ee] text-[#7a5514]" : "border-border bg-card text-muted-foreground",
        )}
      >
        <p className={cn("font-semibold", accountNotOpened ? "text-[#7a5514]" : "text-foreground")}>系统访问</p>
        {accountNotOpened ? (
          <p className="mt-1">
            账号未开通：本次不创建登录账号。开通并激活账号时，按仍有效的批准安排核验并办理必要访问授权，不自动恢复或扩大权限。
          </p>
        ) : (
          <p className="mt-1">按批准配置已处理必要访问来源；在各项条件有效时可用。</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {persisted ? "已保存到本机演示的统一职责记录，教职工职责与我的教研即时联动；每个负责对象单独保留任期。未生效、已结束或账号不可用时不会授予访问，尚未接入正式服务端。" : "这是预设示例结果，不建立真实系统访问来源。当前后端仍需完善。"}
      </p>
    </div>
  )
}
