"use client"

import {
  Badge,
  Card,
  Dot,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Select,
  Sheet,
  Textarea,
  useToast,
} from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  HW_SCORES,
  WEEK_LABEL,
  WEEK_RANGE,
  TEACHER_CLASSES,
  classById,
  rosterOf,
  type ClassScope,
  type HomeworkScore,
} from "@/lib/demo/data"
import { moduleEnabled } from "@/lib/demo/nav"
import { assignmentProgress, useDemo, type Assignment } from "@/lib/demo/store"
import { BookOpen, CalendarClock, ClipboardList, PlugZap, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

// 布置范围候选：整门课程 + 各单元
function scopeOptionsFor(classId: string): ClassScope[] {
  const cls = classById(classId)
  const whole: ClassScope = { code: "ALL", label: "全部", title: "整门课程（跨全部单元）" }
  return [whole, ...(cls?.scopes ?? [])]
}

export default function HomeworkPage() {
  const demo = useDemo()
  const [classId, setClassId] = useState<string>(TEACHER_CLASSES[0].id)
  const [scopeFilter, setScopeFilter] = useState<string>("ALL")
  const [creating, setCreating] = useState(false)
  const [gradingId, setGradingId] = useState<string | null>(null)

  const cls = classById(classId)!

  const classAssignments = useMemo(
    () => demo.assignments.filter((a) => a.classId === classId),
    [demo.assignments, classId],
  )

  const visible = useMemo(
    () => (scopeFilter === "ALL" ? classAssignments : classAssignments.filter((a) => a.scope === scopeFilter)),
    [classAssignments, scopeFilter],
  )

  const grading = demo.assignments.find((a) => a.id === gradingId) ?? null

  if (!moduleEnabled("teaching", demo.config)) {
    return (
      <div>
        <PageHeader title="作业管理" desc="演示配置 B · 教学模块未接入" />
        <EmptyState
          tone="warning"
          icon={<PlugZap className="size-7" />}
          title="教学模块未接入"
          desc="请在原型演示控制切换回配置 A。"
        />
      </div>
    )
  }

  const totals = classAssignments.reduce(
    (acc, a) => {
      const p = assignmentProgress(a)
      acc.graded += p.graded
      acc.submitted += p.submitted
      acc.notSubmitted += p.notSubmitted
      return acc
    },
    { graded: 0, submitted: 0, notSubmitted: 0 },
  )

  return (
    <div>
      <PageHeader
        title="作业管理"
        desc={`${WEEK_LABEL} · ${WEEK_RANGE}`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            布置作业
          </Button>
        }
      />

      {/* 教学班切换：一位教师可能同时教不同年级、不同班级 */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground">我的教学班</p>
        <div className="flex flex-wrap gap-2">
          {TEACHER_CLASSES.map((c) => {
            const active = c.id === classId
            return (
              <button
                key={c.id}
                onClick={() => {
                  setClassId(c.id)
                  setScopeFilter("ALL")
                }}
                className={
                  active
                    ? "flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-3.5 py-2 text-left"
                    : "flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                }
              >
                <span
                  className={
                    active
                      ? "flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary"
                      : "flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground"
                  }
                >
                  <BookOpen className="size-4" />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold leading-tight">{c.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {c.grade} · {c.roster.length} 人
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="进行中作业" value={`${classAssignments.length}`} hint={`${cls.name} · ${cls.courseName}`} />
        <Stat label="待评分" value={`${totals.submitted}`} hint="已提交、等待教师评分" tone="warning" />
        <Stat label="未交" value={`${totals.notSubmitted}`} hint="需跟进或标记未交" tone="danger" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented<string>
          value={scopeFilter}
          onChange={setScopeFilter}
          options={[
            { value: "ALL", label: "全部" },
            ...cls.scopes.map((s) => ({ value: s.code, label: s.label })),
          ]}
          ariaLabel="按单元筛选"
        />
        <p className="text-xs text-muted-foreground">提交与评分由教师登记，学生无提交入口。</p>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-7" />}
          title="暂无作业"
          desc="点击右上角“布置作业”为该班级创建。"
        />
      ) : (
        <div className="grid gap-4">
          {visible.map((a) => (
            <AssignmentCard key={a.id} assignment={a} onGrade={() => setGradingId(a.id)} />
          ))}
        </div>
      )}

      <CreateAssignmentModal open={creating} onClose={() => setCreating(false)} defaultClassId={classId} />
      <GradingSheet assignment={grading} onClose={() => setGradingId(null)} />
    </div>
  )
}

function AssignmentCard({ assignment, onGrade }: { assignment: Assignment; onGrade: () => void }) {
  const demo = useDemo()
  const { push: toast } = useToast()
  const p = assignmentProgress(assignment)
  const cls = classById(assignment.classId)

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={assignment.scope === "ALL" ? "neutral" : "info"}>{assignment.scopeLabel}</Badge>
            <Badge tone={assignment.type === "required" ? "primary" : "neutral"}>
              {assignment.type === "required" ? "必做" : "选做"}
            </Badge>
            <h3 className="text-[15px] font-semibold">{assignment.title}</h3>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            布置 {fmt(assignment.assignedDate)} · 截止 {fmt(assignment.dueDate)} · {assignment.scopeTitle}
            {cls ? ` · ${cls.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onGrade}>
            记录评分
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              demo.deleteAssignment(assignment.id)
              toast("已删除作业")
            }}
            aria-label="删除作业"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {assignment.instructions ? (
        <p className="border-b border-border px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          {assignment.instructions}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <ProgressBar graded={p.graded} total={p.total} />
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <Dot tone="success" /> 已评分 {p.graded}
          </span>
          <span className="flex items-center gap-1.5">
            <Dot tone="warning" /> 待评分 {p.submitted}
          </span>
          <span className="flex items-center gap-1.5">
            <Dot tone="danger" /> 未交 {p.notSubmitted}
          </span>
        </div>
      </div>
    </Card>
  )
}

function ProgressBar({ graded, total }: { graded: number; total: number }) {
  const pct = total ? Math.round((graded / total) * 100) : 0
  return (
    <div className="flex min-w-[180px] flex-1 items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-[#256a49] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {graded}/{total} · {pct}%
      </span>
    </div>
  )
}

function GradingSheet({ assignment, onClose }: { assignment: Assignment | null; onClose: () => void }) {
  const demo = useDemo()
  const { push: toast } = useToast()
  const [batchScore, setBatchScore] = useState<HomeworkScore>("A")

  if (!assignment) return null
  const p = assignmentProgress(assignment)
  const roster = rosterOf(assignment.classId)
  const cls = classById(assignment.classId)

  return (
    <Sheet
      open={!!assignment}
      onClose={onClose}
      title={`记录评分 · ${assignment.title}`}
      desc={`${cls?.name ?? ""} · ${assignment.scopeLabel} · 已评分 ${p.graded}/${p.total}`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
        <span className="text-xs text-muted-foreground">批量给“待评分”登记：</span>
        <Select
          value={batchScore}
          onChange={(e) => setBatchScore(e.target.value as HomeworkScore)}
          className="w-24"
          aria-label="批量分数"
        >
          {HW_SCORES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          onClick={() => {
            const n = demo.batchGradeRemaining(assignment.id, batchScore)
            toast(n ? `已为 ${n} 名待评分学生登记 ${batchScore}` : "没有待评分的学生")
          }}
        >
          批量登记
        </Button>
      </div>

      <div className="grid gap-2">
        {roster.map((s) => {
          const rec = assignment.records[s.id] ?? { status: "submitted" as const }
          return (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{s.name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Segmented<"not_submitted" | "submitted" | "graded">
                  value={rec.status}
                  onChange={(v) => demo.setAssignmentStatus(assignment.id, s.id, v)}
                  options={[
                    { value: "not_submitted", label: "未交" },
                    { value: "submitted", label: "待评" },
                    { value: "graded", label: "已评" },
                  ]}
                  size="sm"
                  ariaLabel={`${s.name} 提交状态`}
                />
                <Select
                  value={rec.score ?? ""}
                  onChange={(e) => demo.setAssignmentScore(assignment.id, s.id, e.target.value as HomeworkScore)}
                  disabled={rec.status !== "graded"}
                  className="w-20"
                  aria-label={`${s.name} 分数`}
                >
                  <option value="" disabled>
                    分数
                  </option>
                  {HW_SCORES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

function CreateAssignmentModal({
  open,
  onClose,
  defaultClassId,
}: {
  open: boolean
  onClose: () => void
  defaultClassId: string
}) {
  const demo = useDemo()
  const { push: toast } = useToast()
  const [classId, setClassId] = useState(defaultClassId)
  const [scopeCode, setScopeCode] = useState("ALL")
  const [title, setTitle] = useState("")
  const [type, setType] = useState<"required" | "optional">("required")
  const [assignedDate, setAssignedDate] = useState("2026-09-15")
  const [dueDate, setDueDate] = useState("2026-09-19")
  const [instructions, setInstructions] = useState("")

  // 每次打开对话框时同步到当前选中的班级
  useEffect(() => {
    if (open) {
      setClassId(defaultClassId)
      setScopeCode("ALL")
    }
  }, [open, defaultClassId])

  const scopes = scopeOptionsFor(classId)

  function reset() {
    setScopeCode("ALL")
    setTitle("")
    setType("required")
    setAssignedDate("2026-09-15")
    setDueDate("2026-09-19")
    setInstructions("")
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="布置作业"
      desc="创建后默认所有学生为“已提交待评分”，可在“记录评分”中调整。"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (!title.trim()) {
                toast("请填写作业标题")
                return
              }
              const scope = scopes.find((s) => s.code === scopeCode) ?? scopes[0]
              demo.createAssignment({
                classId,
                scope: scope.code,
                scopeLabel: scope.label,
                scopeTitle: scope.title,
                title,
                type,
                assignedDate,
                dueDate,
                instructions,
              })
              toast("已布置作业")
              reset()
              onClose()
            }}
          >
            布置
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="教学班">
          <Select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value)
              setScopeCode("ALL")
            }}
          >
            {TEACHER_CLASSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.grade} · {c.courseName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="布置范围" hint="可布置到整门课程，或课程内某一单元">
          <div className="grid gap-2 sm:grid-cols-2">
            {scopes.map((s) => {
              const active = s.code === scopeCode
              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => setScopeCode(s.code)}
                  className={
                    active
                      ? "flex items-center gap-2.5 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-left"
                      : "flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40"
                  }
                >
                  <Badge tone={s.code === "ALL" ? "neutral" : "info"}>{s.label}</Badge>
                  <span className="min-w-0 text-[13px] leading-tight">
                    <span className="block truncate font-medium">{s.title}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="作业标题">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：Accuracy 与 Bounds 巩固练习" />
        </Field>
        <Field label="类型">
          <Segmented<"required" | "optional">
            value={type}
            onChange={setType}
            options={[
              { value: "required", label: "必做" },
              { value: "optional", label: "选做" },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="布置日期">
            <Input type="date" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} />
          </Field>
          <Field label="截止日期">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <Field label="作业说明">
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="题目范围、要求、附件说明等"
          />
        </Field>
      </div>
    </Modal>
  )
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string
  value: string
  hint: string
  tone?: "neutral" | "warning" | "danger"
}) {
  const c = tone === "warning" ? "text-[#8a5a12]" : tone === "danger" ? "text-[#a3341f]" : "text-foreground"
  return (
    <Card className="p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={`mt-1.5 text-[26px] font-semibold leading-none ${c}`}>{value}</p>
      <p className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</p>
    </Card>
  )
}

function fmt(iso: string) {
  const [, m, d] = iso.split("-")
  return `${Number(m)}月${Number(d)}日`
}
