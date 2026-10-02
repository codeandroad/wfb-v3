"use client"

// 教学班侧与教职工侧共用的任教办理组件：同一目标模型、同一任期字段、同一提交命令。
import { Badge, Input } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PERSONAS } from "@/lib/demo/nav"
import { useDemo } from "@/lib/demo/store"
import { CATALOG_UNITS } from "@/lib/demo/school"
import { STAFF } from "@/lib/demo/staff"
import {
  classRoster,
  courseName,
  defaultTenureFrom,
  draftKey,
  responsibilitiesOf,
  responsibilityRoster,
  rosterComposition,
  SEMESTER,
  searchTargets,
  studentById,
  SUBJECTS,
  TEACHER_ACCESS_LABEL,
  TEACHERS,
  teacherAccess,
  teacherIdForStaff,
  teacherName,
  teachingTargets,
  teamDuring,
  teamOf,
  tenureLabel,
  tenureState,
  useTeaching,
  type DraftDivision,
  type RosterMode,
  type TeachTarget,
  type TeachingClass,
} from "@/lib/teaching/store"
import { Check, Plus, Search, X } from "lucide-react"
import { useId, useMemo, useState } from "react"

export const selectClass =
  "w-full cursor-pointer rounded-lg border border-input bg-card px-3 py-2 pr-8 text-[14px] text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"

export interface Period {
  from: string
  to: string | null
}

/* ---------------- 权限 ---------------- */

export function useTeachPerm() {
  const teaching = useTeaching()
  const demo = useDemo()
  const admin = PERSONAS[demo.persona].admin
  return {
    canConfigure: admin,
    canAppoint: admin && teaching.demoPerm === "full",
    perm: teaching.demoPerm,
    setPerm: teaching.setDemoPerm,
  }
}

export function PermDemoSwitch() {
  const { perm, setPerm } = useTeachPerm()
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      演示权限
      <select
        className="cursor-pointer rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground"
        value={perm}
        onChange={(e) => setPerm(e.target.value as "full" | "configOnly")}
      >
        <option value="full">分工配置 + 任命</option>
        <option value="configOnly">仅分工配置</option>
      </select>
    </label>
  )
}

/* ---------------- 任期 ---------------- */

export function TenureFields({
  value,
  onChange,
  label = "任期",
}: {
  value: Period
  onChange: (p: Period) => void
  label?: string
}) {
  const id = useId()
  const open = value.to === null
  return (
    <fieldset className="flex flex-wrap items-end gap-3">
      <legend className="sr-only">{label}</legend>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground" htmlFor={`${id}-from`}>
        开始日期
        <Input
          id={`${id}-from`}
          type="date"
          className="h-8 w-40 py-1 text-[13px]"
          min={SEMESTER.start}
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground" htmlFor={`${id}-to`}>
        结束日期（不含当日）
        <Input
          id={`${id}-to`}
          type="date"
          className="h-8 w-40 py-1 text-[13px] disabled:opacity-50"
          disabled={open}
          value={value.to ?? ""}
          onChange={(e) => onChange({ ...value, to: e.target.value || "" })}
        />
      </label>
      <label className="flex h-8 items-center gap-1.5 text-xs text-foreground">
        <input
          type="checkbox"
          className="size-3.5 accent-[var(--primary)]"
          checked={open}
          onChange={(e) => onChange({ ...value, to: e.target.checked ? null : SEMESTER.endExclusive })}
        />
        未设结束日期
      </label>
    </fieldset>
  )
}

/* ---------------- 人员搜索（按姓名 / 工号；无账号人员同样可选） ---------------- */

interface Person {
  teacherId: string
  name: string
  no: string
  dept: string
}

export const PEOPLE: Person[] = (() => {
  const out: Person[] = STAFF.filter((s) => s.status !== "left").map((s) => ({
    teacherId: teacherIdForStaff(s.id),
    name: s.name,
    no: s.employeeNo ?? "—",
    dept: s.department ?? "",
  }))
  for (const t of TEACHERS) {
    if (!out.some((p) => p.teacherId === t.id)) out.push({ teacherId: t.id, name: t.name, no: "—", dept: "" })
  }
  return out
})()

export function PersonSearch({ excluded, onPick }: { excluded: string[]; onPick: (teacherId: string) => void }) {
  const [q, setQ] = useState("")
  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return PEOPLE.filter((p) => !excluded.includes(p.teacherId)).filter(
      (p) => !k || p.name.toLowerCase().includes(k) || p.no.toLowerCase().includes(k),
    )
  }, [q, excluded])
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-3.5 text-muted-foreground" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索姓名或工号"
          aria-label="搜索教师姓名或工号"
          className="h-9 flex-1 bg-transparent text-[13px] outline-none"
        />
      </div>
      <ul className="thin-scroll max-h-44 overflow-y-auto py-1">
        {list.length === 0 ? (
          <li className="px-3 py-3 text-xs text-muted-foreground">没有匹配的教职工</li>
        ) : (
          list.map((p) => {
            const access = teacherAccess(p.teacherId)
            return (
              <li key={p.teacherId}>
                <button
                  type="button"
                  onClick={() => onPick(p.teacherId)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                >
                  <span>
                    {p.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.no}
                      {p.dept ? ` · ${p.dept}` : ""}
                    </span>
                  </span>
                  <span className={cn("text-xs", access === "open" ? "text-muted-foreground" : "text-warning")}>
                    {TEACHER_ACCESS_LABEL[access]}
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

export interface PendingMember {
  teacherId: string
  period: Period
}

// 已选成员 + 各自任期（每位教师独立）
export function PendingMembers({
  members,
  onChange,
}: {
  members: PendingMember[]
  onChange: (m: PendingMember[]) => void
}) {
  if (!members.length) return null
  return (
    <ul className="flex flex-col gap-2">
      {members.map((m) => {
        const access = teacherAccess(m.teacherId)
        return (
          <li key={m.teacherId} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium">
                {teacherName(m.teacherId)}
                {access !== "open" ? (
                  <span className="ml-2 text-xs font-normal text-warning">{TEACHER_ACCESS_LABEL[access]}：任教关系有效，访问开通后可用</span>
                ) : null}
              </span>
              <button
                type="button"
                aria-label={`移除 ${teacherName(m.teacherId)}`}
                onClick={() => onChange(members.filter((x) => x.teacherId !== m.teacherId))}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <TenureFields
              value={m.period}
              onChange={(p) => onChange(members.map((x) => (x.teacherId === m.teacherId ? { ...x, period: p } : x)))}
            />
          </li>
        )
      })}
    </ul>
  )
}

/* ---------------- 课程内容（可选，目录真实单元） ---------------- */

// 本期课程 → 课程目录课程：只映射目录中确有对应的课程
const COURSE_TO_CATALOG: Record<string, string> = { "C-MATH": "C101", "C-PHYS": "C201", "C-CS": "C501" }

export function contentOptions(courseId: string | null) {
  const code = courseId ? COURSE_TO_CATALOG[courseId] : undefined
  return code ? CATALOG_UNITS.filter((u) => u.courseCode === code) : []
}

/* ---------------- 分工表单（两端共用） ---------------- */

export function DivisionForm({
  cls,
  mode,
  lockedTeacherId,
  lockedPeriod,
  onSubmitted,
  onDraft,
  onCancel,
}: {
  cls: TeachingClass
  mode: "direct" | "draft"
  lockedTeacherId?: string
  lockedPeriod?: Period
  onSubmitted?: (message: string) => void
  onDraft?: (d: DraftDivision) => void
  onCancel: () => void
}) {
  const teaching = useTeaching()
  const { canAppoint } = useTeachPerm()
  const [token] = useState(() => `tk-${Math.random().toString(36).slice(2)}`)
  const [mark, setMark] = useState("")
  const [intent, setIntent] = useState<"assign" | "none">(mode === "draft" || canAppoint ? "assign" : "none")
  const [members, setMembers] = useState<PendingMember[]>([])
  const [rosterMode, setRosterMode] = useState<RosterMode>("INHERIT")
  const [subset, setSubset] = useState<string[]>([])
  const [contentId, setContentId] = useState("")
  const [showContent, setShowContent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const roster = classRoster(cls)
  const composition = rosterComposition(roster)
  const siblings = responsibilitiesOf(teaching, cls.id).filter((r) => r.rosterMode === "EXPLICIT_SUBSET")
  const contents = contentOptions(cls.courseId)
  const effectiveIntent = canAppoint ? intent : "none"

  function draft(): DraftDivision {
    return {
      tempId: `new-${Math.random().toString(36).slice(2, 8)}`,
      classId: cls.id,
      sharedMark: mark.trim() || null,
      rosterMode,
      studentIds: rosterMode === "EXPLICIT_SUBSET" ? subset : [],
      optionalCatalogContentId: contentId || null,
    }
  }

  function submit() {
    setError(null)
    if (mode === "draft") {
      if (rosterMode === "EXPLICIT_SUBSET" && !subset.length) return setError("明确子集至少选择 1 名学生")
      onDraft?.(draft())
      return
    }
    if (effectiveIntent === "assign" && !members.length) return setError("请选择任课教师，或改为“暂不安排教师”")
    setBusy(true)
    const d = draft()
    const assigns =
      effectiveIntent === "assign"
        ? members.map((m) => ({ targetKey: draftKey(d.tempId), teacherId: m.teacherId, from: m.period.from, to: m.period.to, role: "primary" as const }))
        : []
    const res = teaching.commitTeaching(token, [d], assigns)
    setBusy(false)
    if (!res.ok) return setError(res.reason)
    const who = assigns.map((a) => teacherName(a.teacherId)).join("、")
    onSubmitted?.(
      assigns.length
        ? `已创建分工 ${mark.trim() || "（未命名）"}，并安排 ${who} 任教${res.notOpened.length ? `；${res.notOpened.join("、")} 访问未开通，任教关系已生效` : ""}`
        : `已创建分工 ${mark.trim() || "（未命名）"}，暂未安排教师`,
    )
  }

  const primaryLabel =
    mode === "draft"
      ? `加入待办理：新建分工并安排给${teacherName(lockedTeacherId ?? "")}`
      : effectiveIntent === "assign"
        ? "创建分工并安排任教"
        : "创建分工"

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-[13px]">
        <p className="font-medium">{cls.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {SEMESTER.id === "2026T1" ? "2026–2027 上学期" : SEMESTER.id} · {courseName(cls.courseId) ?? "本期课程未设置"} · 本班有效学生 {roster.length} 人
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">分工名称（可选）</span>
        <Input value={mark} onChange={(e) => setMark(e.target.value)} placeholder="如：P1、S1、A组" />
        <span className="text-xs text-muted-foreground">
          可识别的显示文字，不是身份。留空时列表显示为“未命名分工 #序号”并附业务编号，稍后可补充。
        </span>
      </label>

      <div>
        <p className="mb-1.5 text-[13px] font-medium">任课教师</p>
        {mode === "draft" ? (
          <div className="rounded-lg border border-border px-3 py-2.5 text-[13px]">
            {teacherName(lockedTeacherId ?? "")}
            <span className="ml-2 text-xs text-muted-foreground">任期 {lockedPeriod ? tenureLabel(lockedPeriod) : ""}（沿用主表单）</span>
          </div>
        ) : !canAppoint ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
            当前操作者仅有分工配置权，没有任命权：可以创建分工，任教需由具备任命权的人安排。
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div role="radiogroup" aria-label="是否安排任课教师" className="flex gap-1.5">
              {(
                [
                  ["assign", "安排任课教师"],
                  ["none", "暂不安排教师"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={intent === v}
                  onClick={() => setIntent(v)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs transition-colors",
                    intent === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            {intent === "assign" ? (
              <>
                <PendingMembers members={members} onChange={setMembers} />
                <PersonSearch
                  excluded={members.map((m) => m.teacherId)}
                  onPick={(teacherId) =>
                    setMembers((ms) => [...ms, { teacherId, period: { from: defaultTenureFrom(), to: null } }])
                  }
                />
                <p className="text-xs text-muted-foreground">
                  可选多位教师组成团队，每人任期独立。开始日期默认取当前业务日期与学期开始的较晚者，不按正在查看的周推断。
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">分工将以“尚未安排教师”的状态创建，之后可在任教团队中安排。</p>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-medium">学生范围</p>
        <div className="flex gap-1.5">
          {(
            [
              ["INHERIT", `继承本班有效名单（${roster.length} 人）`],
              ["EXPLICIT_SUBSET", "明确子集"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={rosterMode === v}
              onClick={() => setRosterMode(v)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                rosterMode === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        {rosterMode === "EXPLICIT_SUBSET" && roster.length ? (
          <div className="mt-2 flex flex-col gap-1.5 rounded-lg bg-muted/40 p-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">按行政班选：</span>
              {composition.map((c) => {
                const ids = roster.filter((id) => studentById(id)?.homeroomId === c.homeroomId)
                const all = ids.every((id) => subset.includes(id))
                return (
                  <button
                    key={c.homeroomId}
                    type="button"
                    aria-pressed={all}
                    onClick={() =>
                      setSubset((s) => (all ? s.filter((x) => !ids.includes(x)) : Array.from(new Set([...s, ...ids]))))
                    }
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-xs",
                      all ? "border-primary bg-primary/10 text-primary" : "border-border bg-background",
                    )}
                  >
                    {c.name} · {c.count}
                  </button>
                )
              })}
            </div>
            {siblings.length ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">沿用已有分工：</span>
                {siblings.map((r, i) => {
                  const ids = responsibilityRoster(teaching, r)
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSubset(ids)}
                      className="rounded-md border border-border bg-background px-2 py-0.5 text-xs hover:border-primary/40"
                    >
                      {r.sharedMark ?? `未命名分工 #${i + 1}`} · {ids.length}
                    </button>
                  )
                })}
              </div>
            ) : null}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                已选 {subset.length} / {roster.length} 人
              </span>
              {subset.length ? (
                <button type="button" onClick={() => setSubset([])} className="hover:text-foreground">
                  清空
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {rosterMode === "EXPLICIT_SUBSET" ? (
          <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-border p-2">
            {roster.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">本班暂无有效学生，请先在“学生名单”添加。</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {roster.map((id) => {
                  const on = subset.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSubset((s) => (on ? s.filter((x) => x !== id) : [...s, id]))}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-2 py-1 text-left text-xs",
                        on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                      )}
                    >
                      <span>{studentById(id)?.name ?? id}</span>
                      {on ? <Check className="size-3 text-primary" /> : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-border">
        <button
          type="button"
          aria-expanded={showContent}
          onClick={() => setShowContent((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px]"
        >
          <span>
            关联课程内容（可选）
            <span className="ml-2 text-xs text-muted-foreground">{contentId ? "已关联" : "不关联"}</span>
          </span>
          <span className="text-xs text-muted-foreground">{showContent ? "收起" : "展开"}</span>
        </button>
        {showContent ? (
          <div className="border-t border-border px-3 py-3">
            {contents.length ? (
              <select className={cn(selectClass, "h-9 py-1.5")} value={contentId} onChange={(e) => setContentId(e.target.value)}>
                <option value="">不关联</option>
                {contents.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.short} · {u.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-muted-foreground">
                {cls.courseId ? "本期课程在课程目录中暂无可关联的内容。" : "本期课程未设置，暂不可关联。"}不影响创建分工与安排任教。
              </p>
            )}
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {mode === "draft" ? "返回" : "取消"}
        </Button>
        <Button size="sm" onClick={submit} disabled={busy}>
          {primaryLabel}
        </Button>
      </div>
    </div>
  )
}

/* ---------------- 任教团队（现有目标：增加 / 调整 / 结束） ---------------- */

export function TeamManager({ targetKey, emptyText = "尚未安排教师" }: { targetKey: string; emptyText?: string }) {
  const teaching = useTeaching()
  const { canAppoint } = useTeachPerm()
  const team = teamOf(teaching, targetKey)
  const [adding, setAdding] = useState<PendingMember[] | null>(null)
  const [editing, setEditing] = useState<{ teacherId: string; index: number; period: Period; mode: "adjust" | "end" } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(() => `tk-${Math.random().toString(36).slice(2)}`)

  function submitAdd() {
    if (!adding?.length) return setError("请选择教师")
    const res = teaching.commitTeaching(
      token,
      [],
      adding.map((m) => ({ targetKey, teacherId: m.teacherId, from: m.period.from, to: m.period.to, role: "co" })),
    )
    if (!res.ok) return setError(res.reason)
    setAdding(null)
    setError(null)
    setToken(`tk-${Math.random().toString(36).slice(2)}`)
  }
  function submitEdit() {
    if (!editing) return
    const err =
      editing.mode === "end"
        ? teaching.endTenure(targetKey, editing.teacherId, editing.period.to ?? "")
        : teaching.adjustTenure(targetKey, editing.teacherId, editing.index, editing.period)
    if (err) return setError(err)
    setEditing(null)
    setError(null)
  }

  return (
    <div className="flex flex-col gap-2">
      {team.length === 0 ? <p className="text-[13px] text-muted-foreground">{emptyText}</p> : null}
      {team.map((m) =>
        m.tenures.map((t, i) => {
          const st = tenureState(t)
          const isEditing = editing?.teacherId === m.teacherId && editing.index === i
          return (
            <div key={`${m.teacherId}-${i}`} className="rounded-lg border border-border px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-medium">{teacherName(m.teacherId)}</span>
                  <Badge tone={st === "current" ? "success" : st === "future" ? "primary" : "neutral"}>
                    {st === "current" ? "当前任期" : st === "future" ? "未来任期" : "已结束"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{tenureLabel(t)}</span>
                  {teacherAccess(m.teacherId) !== "open" ? (
                    <span className="text-xs text-warning">{TEACHER_ACCESS_LABEL[teacherAccess(m.teacherId)]}</span>
                  ) : null}
                </span>
                {canAppoint && st !== "ended" && !isEditing ? (
                  <span className="flex gap-1">
                    <Button size="xs" variant="ghost" onClick={() => setEditing({ teacherId: m.teacherId, index: i, period: t, mode: "adjust" })}>
                      调整任期
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setEditing({ teacherId: m.teacherId, index: i, period: { from: t.from, to: defaultTenureFrom() }, mode: "end" })}
                    >
                      结束任教
                    </Button>
                  </span>
                ) : null}
              </div>
              {isEditing && editing ? (
                <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
                  {editing.mode === "adjust" ? (
                    <TenureFields value={editing.period} onChange={(p) => setEditing({ ...editing, period: p })} />
                  ) : (
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      结束日期（不含当日；早于或等于开始日期视为撤销未生效的任期）
                      <Input
                        type="date"
                        className="h-8 w-40 py-1 text-[13px]"
                        value={editing.period.to ?? ""}
                        onChange={(e) => setEditing({ ...editing, period: { ...editing.period, to: e.target.value } })}
                      />
                    </label>
                  )}
                  <div className="flex gap-1.5">
                    <Button size="xs" onClick={submitEdit}>
                      {editing.mode === "end" ? "确认结束" : "保存任期"}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setEditing(null)}>
                      取消
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )
        }),
      )}
      {adding ? (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-accent/30 p-3">
          <p className="text-xs text-muted-foreground">增加的教师作为团队成员加入，不替换现有教师。</p>
          <PendingMembers members={adding} onChange={setAdding} />
          <PersonSearch
            excluded={[...adding.map((a) => a.teacherId)]}
            onPick={(teacherId) => setAdding((a) => [...(a ?? []), { teacherId, period: { from: defaultTenureFrom(), to: null } }])}
          />
          <div className="flex gap-1.5">
            <Button size="xs" onClick={submitAdd}>
              安排任教
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setAdding(null)}>
              取消
            </Button>
          </div>
        </div>
      ) : canAppoint ? (
        <div>
          <Button size="xs" variant="outline" onClick={() => setAdding([])}>
            <Plus className="size-3.5" />
            增加教师
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">当前操作者没有任命权，任教团队只读。</p>
      )}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/* ---------------- 教职工侧：任教范围选择 ---------------- */

export interface PickerUi {
  query: string
  classId: string
  subjectId: string
  limit: number
}
export const PICKER_UI_DEFAULT: PickerUi = { query: "", classId: "", subjectId: "", limit: 12 }

export type TargetEval =
  | { state: "self"; reason: string }
  | { state: "others"; names: string[] }
  | { state: "none" }

export function evaluateTarget(
  s: ReturnType<typeof useTeaching>,
  t: TeachTarget,
  teacherId: string | null,
  period: Period,
): TargetEval {
  const during = teamDuring(s, t.key, period)
  const self = teacherId ? during.find((m) => m.teacherId === teacherId) : undefined
  if (self) {
    const hit = self.tenures[0]
    return { state: "self", reason: `所选任期内已任教（${tenureLabel(hit)}），如需延长或调整请在教学班任教团队中调整任期` }
  }
  const others = during.filter((m) => m.teacherId !== teacherId)
  return others.length ? { state: "others", names: others.map((m) => teacherName(m.teacherId)) } : { state: "none" }
}

export function TeachingScopePicker({
  teacherId,
  period,
  selected,
  onChange,
  drafts,
  onRemoveDraft,
  ui,
  onUi,
  onCreateDivision,
}: {
  teacherId: string | null
  period: Period
  selected: string[]
  onChange: (keys: string[]) => void
  drafts: DraftDivision[]
  onRemoveDraft: (tempId: string) => void
  ui: PickerUi
  onUi: (ui: PickerUi) => void
  onCreateDivision: (classId: string) => void
}) {
  const teaching = useTeaching()
  const { canConfigure, canAppoint } = useTeachPerm()
  const all = useMemo(() => teachingTargets(teaching), [teaching])
  const matched = useMemo(() => searchTargets(all, ui), [all, ui])
  const shown = matched.slice(0, ui.limit)
  const outOfSemester = period.from < SEMESTER.start || (period.to ?? SEMESTER.endExclusive) > SEMESTER.endExclusive

  const byKey = new Map(all.map((t) => [t.key, t]))
  const toggle = (key: string) => onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          学期
          <select className={cn(selectClass, "h-8 py-1 text-[13px]")} value={SEMESTER.id} disabled>
            <option value={SEMESTER.id}>2026–2027 上学期</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          教学班
          <select
            className={cn(selectClass, "h-8 py-1 text-[13px]")}
            value={ui.classId}
            onChange={(e) => onUi({ ...ui, classId: e.target.value, limit: PICKER_UI_DEFAULT.limit })}
          >
            <option value="">全部教学班</option>
            {teaching.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          学科
          <select
            className={cn(selectClass, "h-8 py-1 text-[13px]")}
            value={ui.subjectId}
            onChange={(e) => onUi({ ...ui, subjectId: e.target.value, limit: PICKER_UI_DEFAULT.limit })}
          >
            <option value="">全部学科</option>
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          搜索
          <Input
            className="h-8 py-1 text-[13px]"
            value={ui.query}
            onChange={(e) => onUi({ ...ui, query: e.target.value, limit: PICKER_UI_DEFAULT.limit })}
            placeholder="教学班 / 简称 / 分工 / 课程 / 编号"
          />
        </label>
      </div>

      {outOfSemester ? (
        <p role="status" className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          所选任期超出本学期（{SEMESTER.start} 至 {SEMESTER.endExclusive} 前），请调整任期后再选择任教范围。
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border">
        {matched.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
            {all.length === 0 ? "本学期尚无教学班。请先在“学校管理 · 教学班”创建。" : "没有符合筛选条件的教学班或分工，请调整搜索或筛选。"}
          </p>
        ) : (
          <ul className="thin-scroll max-h-80 overflow-y-auto">
            {shown.map((t, i) => {
              const newGroup = i === 0 || shown[i - 1].classId !== t.classId
              const ev = evaluateTarget(teaching, t, teacherId, period)
              const on = selected.includes(t.key)
              const blocked = ev.state === "self" || outOfSemester
              return (
                <li key={t.key}>
                  {newGroup ? (
                    <div className="flex items-baseline justify-between gap-2 border-t border-border bg-muted/50 px-3 py-1.5 first:border-t-0">
                      <span className="text-[13px] font-semibold">
                        {t.className}
                        {t.classShortName ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">简称 {t.classShortName}</span> : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {courseName(t.courseId) ?? "本期课程未设置"} · 编号 {t.classId}
                      </span>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-disabled={blocked && !on}
                    onClick={() => (blocked && !on ? undefined : toggle(t.key))}
                    className={cn(
                      "flex w-full items-start gap-3 border-t border-border px-3 py-2.5 text-left",
                      blocked && !on ? "cursor-not-allowed opacity-60" : "hover:bg-muted/50",
                      on && "bg-accent/40",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {on ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">
                        {t.divisionLabel}
                        {t.kind === "RESP" ? <span className="ml-2 text-xs font-normal text-muted-foreground">编号 {t.code}</span> : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t.rosterCount} 人{t.rosterMode === "EXPLICIT_SUBSET" ? "（子集）" : ""} ·{" "}
                        {ev.state === "self"
                          ? ev.reason
                          : ev.state === "others"
                            ? `所选任期内：${ev.names.join("、")} 任教；确认后作为共同成员加入，不替换原教师`
                            : "所选任期内：尚未安排教师"}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {matched.length > shown.length ? (
          <button
            type="button"
            onClick={() => onUi({ ...ui, limit: ui.limit + PICKER_UI_DEFAULT.limit })}
            className="w-full border-t border-border py-2 text-xs text-primary hover:bg-muted/50"
          >
            加载更多（还有 {matched.length - shown.length} 项）
          </button>
        ) : null}
      </div>

      {ui.classId && canConfigure && canAppoint ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2">
          <span className="text-xs text-muted-foreground">没有合适的分工？可在此教学班下新建，并直接安排给当前教师。</span>
          <Button size="xs" variant="outline" onClick={() => onCreateDivision(ui.classId)}>
            <Plus className="size-3.5" />
            新建教学分工并安排
          </Button>
        </div>
      ) : ui.classId && !canAppoint ? (
        <p className="text-xs text-muted-foreground">当前操作者没有任命权，不能在此新建分工并安排任教。</p>
      ) : (
        <p className="text-xs text-muted-foreground">先按“教学班”筛选到具体班级，可在其下新建教学分工。不在此新建教学班、课程或学生。</p>
      )}

      <SelectedSummary
        selected={selected}
        byKey={byKey}
        drafts={drafts}
        teacherId={teacherId}
        period={period}
        onRemove={(k) => {
          if (k.startsWith("D:")) onRemoveDraft(k.slice(2))
          onChange(selected.filter((x) => x !== k))
        }}
      />
    </div>
  )
}

function SelectedSummary({
  selected,
  byKey,
  drafts,
  teacherId,
  period,
  onRemove,
}: {
  selected: string[]
  byKey: Map<string, TeachTarget>
  drafts: DraftDivision[]
  teacherId: string | null
  period: Period
  onRemove: (key: string) => void
}) {
  const teaching = useTeaching()
  if (!selected.length) return <p className="text-xs text-muted-foreground">尚未选择任教范围。</p>
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">已选 {selected.length} 项（跨搜索保留）</p>
      <ul className="flex flex-col gap-1.5">
        {selected.map((k) => {
          let label = k
          let note: string | null = null
          let invalid: string | null = null
          if (k.startsWith("D:")) {
            const d = drafts.find((x) => x.tempId === k.slice(2))
            const cls = teaching.classes.find((c) => c.id === d?.classId)
            label = `${cls?.name ?? ""}｜${d?.sharedMark ?? "未命名分工"}`
            note = "待创建：确认后与任教一并提交"
          } else {
            const t = byKey.get(k)
            if (!t) invalid = "目标已失效，请移除"
            else {
              label = `${t.className}｜${t.divisionLabel}`
              const ev = evaluateTarget(teaching, t, teacherId, period)
              if (ev.state === "self") invalid = ev.reason
              else if (ev.state === "others") note = `与 ${ev.names.join("、")} 共同任教`
            }
          }
          return (
            <li
              key={k}
              className={cn(
                "flex items-start justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[13px]",
                invalid ? "border-destructive/40 bg-destructive/5" : "border-border",
              )}
            >
              <span className="min-w-0">
                <span className="block">{label}</span>
                {invalid ? (
                  <span className="block text-xs text-destructive">任期变更后不可用：{invalid}</span>
                ) : note ? (
                  <span className="block text-xs text-muted-foreground">{note}</span>
                ) : null}
              </span>
              <button
                type="button"
                aria-label={`移除 ${label}`}
                onClick={() => onRemove(k)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
