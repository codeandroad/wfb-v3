"use client"

import { Badge, Card, EmptyState } from "@/components/kit"
import { SaveState } from "@/components/mt/shared"
import { Btn, inputCls } from "@/components/mt/ui"
import { nameOf, type TaskWeek } from "@/lib/mt/derive"
import {
  addDaysIso,
  assignmentWeek,
  clockLabel,
  dateOfClock,
  homeroomName,
  hwStatus,
  membersOn,
  requirementOf,
  studentById,
  SUBMISSION_LABEL,
  type Assignment,
  type STask,
  type Requirement,
  type Submission,
} from "@/lib/mt/model"
import { homeworkDefaultNow, levelText, ownerKey, revById } from "@/lib/mt/schemes"
import { scopeTask, useHomeworkWriters, useMt } from "@/lib/mt/store"
import { ClipboardList, Plus } from "lucide-react"
import { useState } from "react"

const sel = "h-7 rounded-md border border-input bg-card px-1.5 text-xs"

export function HwResultControls({ a, sid }: { a: Assignment; sid: string }) {
  const hwRev = revById(a.schemeRevId)
  const mt = useMt()
  const w = useHomeworkWriters()
  const req = requirementOf(a, sid)
  const r = a.results[sid]
  const st = hwStatus(a, sid, Date.parse(mt.biz.clock))
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select aria-label="要求" className={sel} value={req} onChange={(e) => w.setRequirement(a, sid, e.target.value as Requirement)}>
        <option value="REQUIRED">必做</option>
        <option value="OPTIONAL">选做</option>
        <option value="EXEMPT">确认免做</option>
      </select>
      {req === "OPTIONAL" ? (
        <select
          aria-label="参与"
          className={sel}
          value={r?.participating === undefined ? "" : r.participating ? "Y" : "N"}
          onChange={(e) => e.target.value && w.setResult(a, sid, { participating: e.target.value === "Y" }, "选做参与")}
        >
          <option value="">参与未登记</option>
          <option value="Y">参与</option>
          <option value="N">未参与</option>
        </select>
      ) : null}
      {req !== "EXEMPT" && !(req === "OPTIONAL" && r?.participating === false) ? (
        <>
          <select
            aria-label="提交"
            className={sel}
            value={r?.submission ?? ""}
            onChange={(e) =>
              e.target.value &&
              w.setResult(a, sid, { submission: e.target.value as Submission, submissionConfirmed: false }, "提交情况")
            }
          >
            <option value="">提交未登记</option>
            {(Object.keys(SUBMISSION_LABEL) as Submission[]).map((k) => (
              <option key={k} value={k}>
                {SUBMISSION_LABEL[k]}
              </option>
            ))}
          </select>
          {r?.submission === "MISSING" && !r.submissionConfirmed ? (
            <Btn size="sm" onClick={() => w.setResult(a, sid, { submissionConfirmed: true }, "核实未交")}>
              核实为未交
            </Btn>
          ) : null}
          {r?.submission && r.submission !== "MISSING" ? (
            <>
              <select
                aria-label="质量"
                className={sel}
                value={r.quality ?? ""}
                onChange={(e) => w.setResult(a, sid, { quality: e.target.value || null }, "作业质量")}
              >
                <option value="">质量待评</option>
                {r.quality && !hwRev?.levels.some((l) => l.id === r.quality) ? (
                  <option value={r.quality} disabled>
                    {r.quality}（标准待核对）
                  </option>
                ) : null}
                {(hwRev?.levels ?? []).map((l) => (
                  <option key={l.id} value={l.id} title={l.guide || undefined}>
                    {levelText(l)}
                  </option>
                ))}
              </select>
              <input
                aria-label="分数（可选）"
                type="number"
                min={0}
                placeholder="分数"
                defaultValue={r.score ?? ""}
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value)
                  if (v !== r.score) w.setResult(a, sid, { score: v }, "作业分数")
                }}
                className="h-7 w-16 rounded-md border border-input bg-card px-1.5 text-xs"
              />
            </>
          ) : null}
        </>
      ) : null}
      <Badge tone={st.pending ? "warning" : st.s === "GRADED" ? "success" : "neutral"}>{st.label}</Badge>
    </div>
  )
}

export function HomeworkPanel({ tw, focusId }: { tw: TaskWeek; focusId?: string | null }) {
  const mt = useMt()
  const [showAll, setShowAll] = useState(false)
  const [openId, setOpenId] = useState<string | null>(focusId ?? tw.assignments[0]?.id ?? null)
  const [creating, setCreating] = useState(false)
  const [onlyPending, setOnlyPending] = useState(false)
  const all = mt.biz.assignments.filter((a) => a.taskId === tw.task.id)
  const list = showAll ? all : tw.assignments
  const nowTs = Date.parse(mt.biz.clock)
  const open = all.find((a) => a.id === openId) ?? null

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            查看本任务全部作业（{all.length}）
          </label>
          <Btn size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-3" aria-hidden />
            布置
          </Btn>
        </div>
        {creating ? <CreateHw tw={tw} onDone={(id) => (setCreating(false), id && setOpenId(id))} /> : null}
        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            本周期没有作业。{all.length ? "勾选“查看本任务全部作业”可找到跨期未结项。" : ""}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {list.map((a) => {
              const pending = a.recipients.filter((s) => hwStatus(a, s, nowTs).pending).length
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(a.id)}
                    aria-current={a.id === openId}
                    className={`w-full rounded-lg border px-3 py-2 text-left ${a.id === openId ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/50"}`}
                  >
                    <span className="block text-sm font-medium">{a.title}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      第 {assignmentWeek(a)} 周归期 · 截止 {a.deadline ? clockLabel(a.deadline) : "无"}
                    </span>
                    <span className="mt-0.5 block text-[11px]">
                      {a.recipients.length} 人{pending ? <span className="text-[#8a5a12]"> · 待确认 {pending}</span> : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          归期为原型回退口径：有截止按截止日期所在周，无截止按布置日期所在周；不代表已修改产品政策。
        </p>
      </div>

      {open ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h3 className="font-semibold">{open.title}</h3>
              <p className="text-xs text-muted-foreground">
                ID {open.id} · 布置于 {clockLabel(open.issuedAt)} · 默认{open.defaultRequirement === "REQUIRED" ? "必做" : "选做"} · 适用名单固定于布置时（{open.recipients.length} 人）
              </p>
              {open.instructions ? <p className="mt-1 text-xs">{open.instructions}</p> : null}
            </div>
            <DeadlineEditor a={open} />
          </div>
          <div className="flex items-center justify-between px-4 py-2 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
              仅看待确认
            </label>
            <SaveState scope={`hw:${open.id}`} compact />
          </div>
          <ul className="divide-y divide-border">
            {open.recipients
              .filter((s) => !onlyPending || hwStatus(open, s, nowTs).pending)
              .map((sid) => (
                <li key={sid} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <span className="text-sm">
                    {nameOf(sid)}
                    <span className="ml-1.5 text-[11px] text-muted-foreground">{homeroomName(studentById(sid)?.homeroom_id ?? "")}</span>
                  </span>
                  <HwResultControls a={open} sid={sid} />
                </li>
              ))}
          </ul>
        </Card>
      ) : (
        <EmptyState icon={<ClipboardList className="size-7" />} title="选择或布置一项作业" desc="作业按真实任务保存，与课堂日期记录分开。" />
      )}
    </div>
  )
}

function DeadlineEditor({ a }: { a: Assignment }) {
  const w = useHomeworkWriters()
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <label className="flex items-center gap-1.5">
        截止
        <input
          type="datetime-local"
          value={a.deadline ? a.deadline.slice(0, 16) : ""}
          onChange={(e) => e.target.value && w.setDeadline(a, `${e.target.value}:00+08:00`)}
          className="h-7 rounded-md border border-input bg-card px-1.5"
        />
      </label>
      {a.deadline ? (
        <Btn size="sm" variant="ghost" onClick={() => w.setDeadline(a, null)}>
          清空截止
        </Btn>
      ) : null}
    </div>
  )
}

function CreateHw({ tw, onDone }: { tw: TaskWeek; onDone: (id: string | null) => void }) {
  return <AssignForm task={tw.task} onDone={onDone} />
}

/**
 * 统一布置流程：作业页“布置”与日卡“布置作业”共用同一表单、同一命令、同一 assignments 集合。
 * sourceDate 只记录来源；归期与截止仍按布置/截止规则。createToken 防止重试重复创建。
 */
export function AssignForm({
  task,
  sourceDate,
  onDone,
}: {
  task: Pick<STask, "id" | "teacher_id">
  sourceDate?: string | null
  onDone: (id: string | null) => void
}) {
  const mt = useMt()
  const [token] = useState(() => `AS_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`)
  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [req, setReq] = useState<"REQUIRED" | "OPTIONAL">("REQUIRED")
  const [dl, setDl] = useState<"DEFAULT" | "NONE" | "CUSTOM">("DEFAULT")
  const [custom, setCustom] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = () => {
    if (busy) return
    if (!title.trim()) return setErr("请输入作业标题")
    if (dl === "CUSTOM" && !custom) return setErr("请选择截止时间")
    setBusy(true)
    let newId: string | null = null
    const r = mt.command("布置作业", (s) => {
      const existing = s.assignments.find((x) => x.createToken === token)
      if (existing) {
        newId = existing.id
        return s
      }
      const recipients = membersOn(s.memberships[task.id] ?? [], dateOfClock(s.clock))
      if (!recipients.length) return { error: "布置时点没有有效学生" }
      newId = `HW_${task.id}_${s.seq + 1}`
      const a: Assignment = {
        id: newId,
        taskId: task.id,
        createToken: token,
        sourceDate: sourceDate ?? null,
        title: title.trim(),
        instructions: instructions.trim(),
        issuedAt: s.clock,
        deadline: dl === "NONE" ? null : dl === "CUSTOM" ? `${custom}:00+08:00` : addDaysIso(s.clock, 3),
        recipients,
        defaultRequirement: req,
        requirementOverrides: {},
        results: {},
        revision: 1,
        stamp: s.stamp + 1,
        // 首次成功布置时固定作业质量标准，后续改默认不影响本作业
        schemeRevId: homeworkDefaultNow(s.schemes, ownerKey(task.teacher_id), s.clock),
      }
      return { ...s, seq: s.seq + 1, assignments: [...s.assignments, a] }
    })
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    onDone(newId)
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <input className={inputCls} placeholder="作业标题" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="作业标题" />
      <textarea
        className={inputCls}
        rows={2}
        placeholder="说明（可选）"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        aria-label="作业说明"
      />
      <div className="flex flex-wrap gap-2 text-xs">
        <select aria-label="默认要求" className={sel} value={req} onChange={(e) => setReq(e.target.value as "REQUIRED")}>
          <option value="REQUIRED">必做</option>
          <option value="OPTIONAL">选做</option>
        </select>
        <select aria-label="截止" className={sel} value={dl} onChange={(e) => setDl(e.target.value as "DEFAULT")}>
          <option value="DEFAULT">截止：布置后 3 天</option>
          <option value="CUSTOM">自定义截止</option>
          <option value="NONE">无截止</option>
        </select>
        {dl === "CUSTOM" ? (
          <input type="datetime-local" className={sel} value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="截止时间" />
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">
        布置时间记为演示系统时间；适用名单为布置时点有效学生。创建不会自动登记已交、已评或 A。
      </p>
      {err ? (
        <p role="alert" className="text-xs text-[#9a2b22]">
          {err}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Btn size="sm" variant="ghost" onClick={() => onDone(null)}>
          取消
        </Btn>
        <Btn size="sm" variant="primary" onClick={submit} disabled={busy}>
          布置
        </Btn>
      </div>
      <SaveState scope={scopeTask(task.id)} compact />
    </div>
  )
}
