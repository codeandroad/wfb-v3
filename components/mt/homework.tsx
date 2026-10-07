"use client"

import { Badge, Card, EmptyState } from "@/components/kit"
import { HomeworkMetrics, HomeworkStatistics } from "@/components/mt/homework-dashboard"
import { SaveState } from "@/components/mt/shared"
import { Btn, Modal, inputCls } from "@/components/mt/ui"
import {
  BATCH_LABEL,
  BUCKET_LABEL,
  deadlineInDays,
  defaultDeadline,
  HW_DAYS_MAX,
  parseDays,
  effDeadline,
  hwBucket,
  hwProgress,
  hwState,
  isSubmitted,
  lifecycleOf,
  pageOf,
  PAGE_SIZES,
  planBatch,
  STATE_LABEL,
  writeBlock,
  type BatchKind,
  type BatchOpts,
  type HwBucket,
  type HwState,
  type PageSize,
} from "@/lib/mt/hw"
import { nameOf, useTeacherId, type TaskWeek } from "@/lib/mt/derive"
import {
  addDays,
  clockLabel,
  dateOfClock,
  formalTaskName,
  taskById,
  fmtMD,
  homeroomName,
  membersOn,
  requirementOf,
  studentById,
  type Assignment,
  type Requirement,
  type STask,
} from "@/lib/mt/model"
import { homeworkDefaultNow, homeworkRevForTask, levelText, ownerKey, revById } from "@/lib/mt/schemes"
import { scopeTask, useHomeworkWriters, useMt, usePrefWriters, useTeacherPrefs, type HwDraft } from "@/lib/mt/store"
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardList, ExternalLink, Search, Undo2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useRef, useState } from "react"

const sel = "h-7 rounded-md border border-input bg-card px-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
const TZ = "+08:00"
const toLocalInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 16) : "")
const fromLocalInput = (v: string) => `${v}:00${TZ}`

export const LIFECYCLE_LABEL = { ACTIVE: "进行中", CLOSED: "已结束检查", WITHDRAWN: "已撤回" } as const

function stateTone(s: HwState): "neutral" | "primary" | "success" | "warning" | "info" {
  if (s === "GRADED" || s === "NO_GRADE") return "success"
  if (s === "UNGRADED" || s === "DUE_UNRECORDED" || s === "SUSPECTED_MISSING" || s === "REVIEW") return "warning"
  if (s === "MISSING") return "info"
  return "neutral"
}

function deadlineText(iso: string | null) {
  return iso ? clockLabel(iso) : "无截止"
}

/* ============================================================
 * 单条结果：侧栏、周反馈、学生抽屉共用同一控件与写入命令
 * ========================================================== */

export function HwResultControls({ a, sid, showName, cockpit = false }: { a: Assignment; sid: string; showName?: boolean; cockpit?: boolean }) {
  const mt = useMt()
  const w = useHomeworkWriters()
  const [more, setMore] = useState(false)
  const nowTs = Date.parse(mt.biz.clock)
  const rev = revById(a.schemeRevId ?? null)
  const r = a.results[sid]
  const req = requirementOf(a, sid)
  const st = hwState(a, sid, nowTs)
  const block = writeBlock(a, sid, nowTs)
  const submitted = isSubmitted(r?.submission)
  const inactive = st === "EXEMPT" || st === "OPTIONAL_OUT"
  const ext = r?.extDeadline ?? null

  const subValue = !r?.submission ? "" : r.submission === "MISSING" ? (r.submissionConfirmed ? "MISSING" : "SUSPECT") : r.submission
  const qValue = r?.noGrade ? "__NO__" : (r?.quality ?? "")

  return (
    <div className="hw-result-controls flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {showName ? <span className="mr-1 min-w-24 text-sm font-medium">{nameOf(sid)}</span> : null}
        {inactive ? (
          <span className="text-xs text-muted-foreground">{STATE_LABEL[st]}{r?.reason ? ` · ${r.reason}` : ""}</span>
        ) : (
          <>
            {req === "OPTIONAL" && r?.participating === undefined && !submitted ? (
              <select
                aria-label={`${nameOf(sid)} 选做参与`}
                className={sel}
                disabled={!!block}
                value=""
                onChange={(e) => e.target.value && w.setResult(a, sid, { participating: e.target.value === "Y" }, "选做参与")}
              >
                <option value="">选做 · 参与未定</option>
                <option value="Y">参与</option>
                <option value="N">本次未参与</option>
              </select>
            ) : null}
            <select
              aria-label={`${nameOf(sid)} 提交情况`}
              className={`${sel} ${cockpit ? r?.submission === 'MISSING' ? 'hw-missing' : r?.submission === 'LATE' ? 'hw-late' : submitted ? 'hw-submitted' : '' : ''}`}
              disabled={!!block}
              value={subValue}
              onChange={(e) => {
                const v = e.target.value
                if (v === "SUSPECT") return
                if (v === "") w.setResult(a, sid, { submission: null, submissionConfirmed: false }, "提交情况")
                else if (v === "MISSING") {
                  w.setResult(a, sid, { submission: "MISSING", submissionConfirmed: true }, "登记未交")
                  setMore(true)
                }
                else w.setResult(a, sid, { submission: v as "ON_TIME", submissionConfirmed: false }, "提交情况")
              }}
            >
              <option value="">提交未登记</option>
              <option value="ON_TIME">按时提交</option>
              <option value="LATE">迟交</option>
              <option value="SUBMITTED">已提交（时效未定）</option>
              <option value="MISSING">未交</option>
              {subValue === "SUSPECT" ? (
                <option value="SUSPECT" disabled>
                  疑似未交（待核实）
                </option>
              ) : null}
            </select>
            <select
              aria-label={`${nameOf(sid)} 作业评价`}
              className={`${sel} ${cockpit && r?.quality ? 'hw-submitted' : ''}`}
              disabled={!!block || !submitted || !rev}
              title={!submitted ? "登记提交后才能评价" : !rev ? "评价标准待核对" : undefined}
              value={qValue}
              onChange={(e) => {
                const v = e.target.value
                if (v === "__NO__") w.setResult(a, sid, { noGrade: true, quality: null }, "明确不评价")
                else w.setResult(a, sid, { quality: v || null, noGrade: false }, "作业评价")
              }}
            >
              <option value="">{submitted ? "待评价" : "—"}</option>
              {(rev?.levels ?? []).map((l) => (
                <option key={l.id} value={l.id} disabled={r?.submission==='LATE'&&l.id===rev?.levels[0]?.id} title={r?.submission==='LATE'&&l.id===rev?.levels[0]?.id?'迟交作业不可评最高等级':l.guide || undefined}>
                  {levelText(l)}
                </option>
              ))}
              <option value="__NO__">明确不评价</option>
            </select>
            {r?.submission==='LATE'?<span className="text-xs text-muted-foreground">迟交不可评最高等级{r.quality===rev?.levels[0]?.id?'；原最高等级需重新评价':''}</span>:null}
            {a.scoreEnabled ? (
              <input
                key={`${sid}-${r?.score ?? "e"}-${r?.rev?.score ?? 0}`}
                aria-label={`${nameOf(sid)} 分数（可选）`}
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="分数"
                disabled={!!block || !submitted}
                defaultValue={r?.score ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim() === "" ? null : Number(e.target.value)
                  if (v !== (r?.score ?? null) && (v === null || Number.isFinite(v))) w.setResult(a, sid, { score: v }, "作业分数")
                }}
                className="h-7 w-16 rounded-md border border-input bg-card px-1.5 text-xs disabled:opacity-50"
              />
            ) : null}
          </>
        )}
        <Badge tone={stateTone(st)}>{STATE_LABEL[st]}</Badge>
        {ext ? <span className="text-[11px] text-muted-foreground">个别延期至 {clockLabel(ext)}</span> : null}
        {r?.reason || r?.note || r?.memo || r?.history?.length ? <span className="size-1.5 rounded-full bg-primary" aria-label="有说明或历史" /> : null}
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className="inline-flex items-center gap-0.5 rounded px-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {more ? <ChevronDown className="size-3" aria-hidden /> : <ChevronRight className="size-3" aria-hidden />}
          例外与说明
        </button>
      </div>
      {block ? <p className="text-[11px] text-[#8a5a12]">{block}</p> : null}
      {more ? <ResultMore a={a} sid={sid} req={req} disabled={!!block} /> : null}
    </div>
  )
}

function ResultMore({ a, sid, req, disabled }: { a: Assignment; sid: string; req: Requirement; disabled: boolean }) {
  const w = useHomeworkWriters()
  const r = a.results[sid]
  const [reason, setReason] = useState(r?.reason ?? "")
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          本次要求
          <select
            className={sel}
            disabled={disabled}
            value={req}
            onChange={(e) => w.setRequirement(a, sid, e.target.value as Requirement, reason || undefined)}
          >
            <option value="REQUIRED">必做</option>
            <option value="OPTIONAL">选做</option>
            <option value="EXEMPT">确认免做</option>
          </select>
        </label>
        {req === "OPTIONAL" ? (
          <label className="flex items-center gap-1">
            参与
            <select
              className={sel}
              disabled={disabled}
              value={r?.participating === undefined ? "" : r.participating ? "Y" : "N"}
              onChange={(e) => e.target.value && w.setResult(a, sid, { participating: e.target.value === "Y" }, "选做参与")}
            >
              <option value="">未定</option>
              <option value="Y">参与</option>
              <option value="N">本次未参与</option>
            </select>
          </label>
        ) : null}
        <label className="flex items-center gap-1">
          {r?.submission === "MISSING" ? "未交原因（可选，仅内部可见）" : "原因（内部）"}
          <input
            aria-label={`${nameOf(sid)} ${r?.submission === "MISSING" ? "未交原因" : "原因"}`}
            disabled={disabled}
            className="h-7 w-36 rounded-md border border-input bg-card px-1.5"
            value={reason}
            placeholder={r?.submission === "MISSING" ? "如：作业丢失、忘带" : "如：病假、比赛"}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => reason !== (r?.reason ?? "") && w.setResult(a, sid, { reason }, "原因")}
          />
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={!!r?.review}
            disabled={disabled}
            onChange={(e) => w.setResult(a, sid, { review: e.target.checked }, "参与安排核对")}
          />
          参与安排待核对
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          个别延期
          <input
            type="datetime-local"
            className={sel}
            value={toLocalInput(r?.extDeadline)}
            onChange={(e) => e.target.value && w.setResult(a, sid, { extDeadline: fromLocalInput(e.target.value) }, "个别延期")}
          />
        </label>
        {r?.extDeadline ? (
          <Btn size="sm" variant="ghost" onClick={() => w.setResult(a, sid, { extDeadline: null }, "取消个别延期")}>
            取消延期
          </Btn>
        ) : null}
        <span className="text-[11px] text-muted-foreground">只影响该生，不改全班截止。</span>
      </div>
      <TextField label="结果说明（家长可见）" value={r?.note ?? ""} onCommit={(v) => w.setResult(a, sid, { note: v }, "结果说明")} />
      <TextField label="内部备注" value={r?.memo ?? ""} onCommit={(v) => w.setResult(a, sid, { memo: v }, "内部备注")} />
      {r?.history?.length ? (
        <div>
          <p className="font-medium">已退出有效状态的旧结果</p>
          <ul className="mt-0.5 text-[11px] text-muted-foreground">
            {r.history.map((h, i) => (
              <li key={i}>
                {clockLabel(h.at)} · {h.what}（原：{h.from}）
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function TextField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value)
  return (
    <label className="flex flex-col gap-0.5">
      {label}
      <input
        className="h-7 rounded-md border border-input bg-card px-1.5"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onCommit(v)}
      />
    </label>
  )
}

/* ============================================================
 * 一份作业的统一评阅：筛选 + 搜索 + 三种批量 + 安全撤销
 * ========================================================== */

type ResultFilter = "all" | "ungraded" | "due" | "missing" | "exception" | "done"
const FILTERS: { k: ResultFilter; label: string; match: (s: HwState) => boolean }[] = [
  { k: "all", label: "全部", match: () => true },
  { k: "ungraded", label: "待评价", match: (s) => s === "UNGRADED" },
  { k: "due", label: "到期待核对", match: (s) => s === "DUE_UNRECORDED" || s === "SUSPECTED_MISSING" },
  { k: "missing", label: "未交", match: (s) => s === "MISSING" },
  { k: "exception", label: "安排例外", match: (s) => s === "REVIEW" || s === "EXEMPT" || s === "OPTIONAL_OUT" },
  { k: "done", label: "已评价", match: (s) => s === "GRADED" || s === "NO_GRADE" },
]

export function HwProgressLine({ a }: { a: Assignment }) {
  const mt = useMt()
  const p = hwProgress(a, Date.parse(mt.biz.clock))
  return (
    <span className="text-xs text-muted-foreground">
      {p.E === 0 ? (
        "无需核对"
      ) : (
        <>
          核对 <b className="text-foreground">{p.checked}/{p.E}</b>
        </>
      )}
      {p.graded + p.noGrade ? ` · 已评价 ${p.graded + p.noGrade}` : ""}
      {p.ungraded ? ` · 待评价 ${p.ungraded}` : ""}
      {p.missing ? ` · 未交 ${p.missing}` : ""}
      {p.dueUnrecorded + p.suspected ? ` · 到期待核对 ${p.dueUnrecorded + p.suspected}` : ""}
      {p.notDue ? ` · 未到截止 ${p.notDue}` : ""}
      {p.review ? ` · 安排待核对 ${p.review}` : ""}
      {p.exempt ? ` · 免做 ${p.exempt}` : ""}
      {p.optionalOut ? ` · 选做未参与 ${p.optionalOut}` : ""}
    </span>
  )
}

/** 学生列表分页：每页数量来自教师个人设置，可在列表内临时切换并保存 */
export function Pager({
  page,
  pages,
  total,
  size,
  onPage,
  label = "学生",
}: {
  page: number
  pages: number
  total: number
  size: number
  onPage: (p: number) => void
  label?: string
}) {
  const teacherId = useTeacherId()
  const pw = usePrefWriters(teacherId)
  if (pages <= 1 && total <= PAGE_SIZES[0]) return null
  const from = (page - 1) * size + 1
  const to = Math.min(total, page * size)
  return (
    <nav aria-label={`${label}分页`} className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
      <span>
        第 {from}–{to} 项，共 {total} {label === "学生" ? "人" : "项"}
      </span>
      <span className="flex items-center gap-1.5">
        <label className="flex items-center gap-1">
          每页
          <select className={sel} value={size} onChange={(e) => (pw.setPageSize(Number(e.target.value)), onPage(1))}>
            {[...new Set([...PAGE_SIZES, size])].sort((a, b) => a - b).map((n) => (
              <option key={n} value={n}>
                {PAGE_SIZES.includes(n as (typeof PAGE_SIZES)[number]) ? n : `${n}（自定义）`}
              </option>
            ))}
          </select>
        </label>
        <Btn size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="上一页">
          <ChevronLeft className="size-3.5" aria-hidden />
        </Btn>
        <span aria-live="polite" className="tabular-nums text-foreground">
          {page} / {pages}
        </span>
        <Btn size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="下一页">
          <ChevronRight className="size-3.5" aria-hidden />
        </Btn>
      </span>
    </nav>
  )
}

const SUB_LABEL = { ON_TIME: "按时提交", LATE: "迟交", SUBMITTED: "已提交（时效未定）" } as const
type SubOpt = keyof typeof SUB_LABEL

interface BatchMsg {
  text: string
  reasons: [string, number][]
}


export function HwReview({
  a,
  manageHref,
  onCopy,
  initialStudent,
  cockpit = false,
}: {
  cockpit?: boolean
  a: Assignment
  manageHref?: string
  onCopy?: (a: Assignment) => void
  initialStudent?: string | null
}) {
  const mt = useMt()
  const teacherId = useTeacherId()
  const prefs = useTeacherPrefs(teacherId)
  const pw = usePrefWriters(teacherId)
  const [filter, setFilter] = useState<ResultFilter>("all")
  const [q, setQ] = useState(initialStudent ? (nameOf(initialStudent) ?? "") : "")
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [manage, setManage] = useState(false)
  const [view, setView] = useState<"roster" | "stats" | "info">("roster")
  const [msg, setMsg] = useState<BatchMsg | null>(null)
  const [showWhy, setShowWhy] = useState(false)
  const busy = useRef(false)
  const sticky = useRef<Set<string>>(new Set())
  const nowTs = Date.parse(mt.biz.clock)
  const life = lifecycleOf(a)
  const rev = revById(a.schemeRevId ?? null)
  const w = useHomeworkWriters()

  // 批量候选：页面级参数，按“教师 + 作业 + 采用的标准版本”记忆；切换作业或标准不串用
  const candKey = `${a.id}|${rev?.id ?? "none"}`
  const cand = teacherId ? mt.biz.batchCands?.[`${teacherId}|${candKey}`] : undefined
  const subOpt: SubOpt = cand?.submission ?? "SUBMITTED"
  const level = cand?.level && rev?.levels.some((l) => l.id === cand.level) ? cand.level : (rev?.defaultLevelId ?? "")
  const lvl = rev?.levels.find((l) => l.id === level) ?? null
  const setCand = (patch: Partial<{ submission: SubOpt; level: string }>) => {
    pw.setBatchCand(candKey, { submission: subOpt, level: level || undefined, ...patch })
    setMsg(null)
  }

  const visible = a.recipients.filter((sid) => {
    const st = hwState(a, sid, nowTs)
    const f = FILTERS.find((x) => x.k === filter)!
    const nm = nameOf(sid) ?? ""
    const hitQ = !q.trim() || nm.includes(q.trim()) || sid.includes(q.trim())
    if (!hitQ) return false
    if (f.match(st)) {
      sticky.current.add(sid)
      return true
    }
    // 刚处理完的学生不立即从筛选结果中消失
    return sticky.current.has(sid)
  })
  const pg = pageOf(visible, page, prefs.pageSize)
  const counts = useMemo(() => {
    const c: Record<ResultFilter, number> = { all: 0, ungraded: 0, due: 0, missing: 0, exception: 0, done: 0 }
    for (const sid of a.recipients) {
      const st = hwState(a, sid, nowTs)
      for (const f of FILTERS) if (f.match(st)) c[f.k]++
    }
    return c
  }, [a, nowTs])
  const lastBatch = (a.batches ?? []).find((b) => !b.undone) ?? null

  const subset = picked.size ? a.recipients.filter((sid) => picked.has(sid)) : null
  const visibleSet = new Set(visible)
  const pickedHidden = subset ? subset.filter((sid) => !visibleSet.has(sid)).length : 0
  const plans = {
    SUBMIT: planBatch(a, "SUBMIT", { submission: subOpt }, subset, nowTs),
    GRADE: lvl ? planBatch(a, "GRADE", { level }, subset, nowTs) : null,
    ROUTINE: lvl ? planBatch(a, "ROUTINE", { level }, subset, nowTs) : null,
  }

  const changeFilter = (k: ResultFilter) => {
    sticky.current = new Set()
    setFilter(k)
    setPage(1)
  }

  const run = (kind: BatchKind) => {
    if (busy.current) return
    const plan = plans[kind]
    if (!plan || !plan.writes.length) return
    busy.current = true
    const opts: BatchOpts = kind === "SUBMIT" ? { submission: subOpt } : { level }
    const token = `HBT_${a.id}_${kind}_${Date.now().toString(36)}`
    const r = w.runBatch(
      token,
      a.id,
      kind,
      opts,
      subset,
      plan.writes.map((x) => x.sid),
    )
    queueMicrotask(() => (busy.current = false))
    if (!r.ok) return setMsg({ text: r.error, reasons: [] })
    const reasons = new Map<string, number>()
    for (const s of r.batch.skipped) reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1)
    const n = new Set(r.batch.entries.map((e) => e.sid)).size
    const what = kind === "SUBMIT" ? SUB_LABEL[subOpt] : kind === "GRADE" ? `评价为 ${levelText(lvl!)}` : `按时提交 · ${levelText(lvl!)}`
    setShowWhy(false)
    setMsg({
      text: `已为 ${n} 人登记“${what}”${r.batch.skipped.length ? `；保留 ${r.batch.skipped.length} 人原有结果或不符合条件` : ""}${r.reused ? "（重复点击，未再次写入）" : ""}`,
      reasons: [...reasons],
    })
  }

  const pageIds = pg.items
  const allPageOn = pageIds.length > 0 && pageIds.every((sid) => picked.has(sid))
  const togglePage = () => {
    const n = new Set(picked)
    for (const sid of pageIds) {
      if (allPageOn) n.delete(sid)
      else n.add(sid)
    }
    setPicked(n)
  }
  const disabledWhy = !rev ? "这份作业的评价标准待核对，只能登记提交" : !lvl ? "请先选择等级" : ""

  return (
    <Card className="hw-review overflow-hidden rounded-xl">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {cockpit && <p className="text-sm text-muted-foreground">{taskById(a.taskId) ? formalTaskName(taskById(a.taskId)!) : '教学任务'} · {a.category ?? '未分类'}</p>}
            <h3 className="text-pretty text-sm font-semibold">{a.title}</h3>
            <p className="text-xs text-muted-foreground">
              默认{a.defaultRequirement === "REQUIRED" ? "必做" : "选做"} · 截止 {deadlineText(a.deadline)}
              {a.offline ? ` · 线下补录（原布置 ${fmtMD(dateOfClock(a.issuedAt))}）` : ` · 布置于 ${clockLabel(a.issuedAt)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {life !== "ACTIVE" ? <Badge tone="neutral">{LIFECYCLE_LABEL[life]}</Badge> : null}
            {manageHref ? (
              <Link href={manageHref} className="inline-flex h-7 items-center gap-1 rounded-lg border border-input bg-card px-2.5 text-xs hover:bg-muted">
                管理这份作业
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            ) : (
              <Btn size="sm" onClick={() => setManage((v) => !v)} aria-expanded={manage}>
                管理这份作业
              </Btn>
            )}
          </div>
        </div>
        {!cockpit && <HwProgressLine a={a} />}
        {a.instructions ? <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-pretty text-sm leading-relaxed">{a.instructions}</p> : null}
        {cockpit && <HomeworkMetrics a={a} nowTs={nowTs} />}
      </div>
      {cockpit && manage && !manageHref && <ManagePanel editor a={a} onCopy={onCopy} onCancel={()=>setManage(false)} />}
      {cockpit && <div className="flex gap-1 border-b border-border px-4" role="group" aria-label="作业详情视图">{([{key:"roster",label:"批改名单"},{key:"stats",label:"数据统计"},{key:"info",label:"作业设置"}] as const).map(t => <button key={t.key} type="button" aria-pressed={view === t.key} onClick={() => setView(t.key)} className={`border-b-2 px-3 py-2 text-sm ${view === t.key ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground"}`}>{t.label}</button>)}</div>}
      {!cockpit && manage && !manageHref ? <ManagePanel a={a} onCopy={onCopy} /> : null}
      {cockpit && view === "info" && <ManagePanel a={a} onCopy={onCopy} />}
      {cockpit && view === "stats" && <HomeworkStatistics a={a} nowTs={nowTs} />}
      <div className="hw-roster" hidden={cockpit && view !== "roster"}>
      {life === "WITHDRAWN" ? (
        <p className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">作业已撤回：结果保留可查，不能再登记或批量处理。</p>
      ) : (
        <section aria-label="批量处理" className="flex flex-col gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <label className="flex items-center gap-1.5">
              <span className="text-muted-foreground">提交时效</span>
              <select className={sel} value={subOpt} onChange={(e) => setCand({ submission: e.target.value as SubOpt })}>
                <option value="SUBMITTED">已提交（时效未定）</option>
                <option value="ON_TIME">按时提交</option>
                <option value="LATE">迟交</option>
              </select>
            </label>
            {rev ? (
              <label className="flex items-center gap-1.5">
                <span className="text-muted-foreground">批量等级</span>
                <select className={sel} value={level} onChange={(e) => setCand({ level: e.target.value })}>
                  <option value="">请选择</option>
                  {rev.levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {levelText(l)}
                      {l.id === rev.defaultLevelId ? "（标准常规）" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="text-[#8a5a12]">评价标准待核对，只能登记提交</span>
            )}
            <Btn size="sm" variant="primary" disabled={!plans.ROUTINE?.writes.length} title={disabledWhy || (subset ? `作用于已勾选 ${subset.length} 人` : "作用于全部符合条件的学生，不受搜索、筛选和分页影响；只补齐未登记部分，保留已有结果。点击后可撤销。")} onClick={() => run("ROUTINE")}>
              快速登记{lvl ? `：按时提交 · ${levelText(lvl)}` : ""} · {plans.ROUTINE?.writes.length ?? 0} 人
            </Btn>
            {disabledWhy && rev ? <span className="text-xs text-muted-foreground">{disabledWhy}</span> : null}
          </div>
          {msg ? (
            <div role="status" className="flex flex-col gap-1 rounded-md bg-card px-2.5 py-1.5 text-xs">
              <span className="flex flex-wrap items-center gap-2">
                {msg.text}
                {msg.reasons.length ? (
                  <button type="button" className="text-primary underline-offset-2 hover:underline" aria-expanded={showWhy} onClick={() => setShowWhy((v) => !v)}>
                    {showWhy ? "收起原因" : "查看原因"}
                  </button>
                ) : null}
              </span>
              {showWhy ? (
                <ul className="flex flex-wrap gap-1.5 text-muted-foreground">
                  {msg.reasons.map(([k, n]) => (
                    <li key={k} className="rounded bg-muted px-1.5 py-0.5">
                      {k} {n}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {lastBatch ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                最近一次：{lastBatch.label} · 写入 {new Set(lastBatch.entries.map((e) => e.sid)).size} 人 · {clockLabel(lastBatch.at)}
              </span>
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => {
                  const r = w.undoBatch(a.id, lastBatch.id)
                  setMsg({ text: r.ok ? `已撤销 ${r.restored} 项；${r.kept} 项因之后已被修改而保留` : r.error, reasons: [] })
                }}
              >
                <Undo2 className="size-3" aria-hidden />
                安全撤销
              </Btn>
            </div>
          ) : null}
          <SaveState scope={`hw:${a.id}`} compact />
        </section>
      )}

      <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2" role="group" aria-label="结果筛选">
        {FILTERS.map((f) => (
          <button
            key={f.k}
            type="button"
            aria-pressed={filter === f.k}
            onClick={() => changeFilter(f.k)}
            className={`h-7 rounded-full border px-2.5 text-xs ${filter === f.k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}
          >
            {f.label} {counts[f.k]}
          </button>
        ))}
        <label className="relative ml-auto">
          <span className="sr-only">搜索学生</span>
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => (setQ(e.target.value), setPage(1))}
            placeholder="姓名或学号"
            className="h-7 w-40 rounded-md border border-input bg-card pl-7 pr-2 text-xs"
          />
        </label>
      </div>

      {life !== "WITHDRAWN" && visible.length ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-1.5 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={allPageOn} onChange={togglePage} />
            本页全选
          </label>
          <Btn size="sm" variant="ghost" onClick={() => setPicked(new Set([...picked, ...visible]))}>
            选中当前结果全部 {visible.length} 人
          </Btn>
          {picked.size ? (
            <>
              <span className="text-muted-foreground">
                已选 {picked.size} 人{pickedHidden ? `���${pickedHidden} 人不在当前结果中）` : ""}
              </span>
              <Btn size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
                清空选择
              </Btn>
            </>
          ) : null}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">{a.recipients.length ? "没有符合筛选的学生" : "这份作业没有适用学生"}</p>
      ) : (
        <ul className="divide-y divide-border">
          {pg.items.map((sid) => (
            <li key={sid} className="flex items-start gap-2.5 px-4 py-2">
              {life !== "WITHDRAWN" ? (
                <input
                  type="checkbox"
                  className="mt-1.5"
                  aria-label={`勾选 ${nameOf(sid)}`}
                  checked={picked.has(sid)}
                  onChange={(e) => {
                    const n = new Set(picked)
                    if (e.target.checked) n.add(sid)
                    else n.delete(sid)
                    setPicked(n)
                  }}
                />
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-3">
                <span className="flex w-36 shrink-0 items-center gap-2 text-sm">
                  <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{nameOf(sid)?.slice(0,1)}</span>
                  <span>{nameOf(sid)}<span className="block text-sm text-muted-foreground">{homeroomName(studentById(sid)?.homeroom_id ?? "")}</span></span>
                </span>
                <HwResultControls a={a} sid={sid} cockpit />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pager page={pg.page} pages={pg.pages} total={visible.length} size={prefs.pageSize} onPage={setPage} />
      </div>
    </Card>
  )
}

function ManagePanel({ a, onCopy, editor = false, onCancel }: { a: Assignment; onCopy?: (a: Assignment) => void; editor?: boolean; onCancel?: () => void }) {
  const mt = useMt()
  const w = useHomeworkWriters()
  const [msg, setMsg] = useState("")
  const [dl, setDl] = useState(toLocalInput(a.deadline))
  const [title, setTitle] = useState(a.title)
  const [instructions, setInstructions] = useState(a.instructions)
  const [category, setCategory] = useState<NonNullable<Assignment['category']>>(a.category ?? '课后作业')
  const [addSel, setAddSel] = useState<Set<string>>(new Set())
  const [addDl, setAddDl] = useState("")
  const life = lifecycleOf(a)
  const nowTs = Date.parse(mt.biz.clock)
  const p = hwProgress(a, nowTs)
  const candidates = membersOn(mt.biz.memberships[a.taskId] ?? [], dateOfClock(mt.biz.clock)).filter((s) => !a.recipients.includes(s))
  const pastDue = a.deadline ? Date.parse(a.deadline) < nowTs : false
  const say = (r: { ok: boolean; error?: string }, ok: string) => setMsg(r.ok ? ok : (r as { error: string }).error)

  return (
    <div className={editor ? "hw-manage flex flex-col gap-3 text-sm" : "flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3 text-xs"}>
      {editor && <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); w.updateDetails(a, {title, instructions, category, deadline: dl ? fromLocalInput(dl) : null}) }}>
        <h4 className="font-semibold">管理这份作业</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-muted-foreground">作业标题<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} disabled={life==='WITHDRAWN'} /></label>
          <label className="flex flex-col gap-1 text-muted-foreground">截止时间<input type="datetime-local" value={dl} onChange={e=>setDl(e.target.value)} disabled={life==='WITHDRAWN'} /></label>
          <label className="flex flex-col gap-1 text-muted-foreground">作业类型<select value={category} onChange={e=>setCategory(e.target.value as NonNullable<Assignment['category']>)} disabled={life==='WITHDRAWN'}>{(['课后作业','课堂练习','模考','论文'] as const).map(v=><option key={v}>{v}</option>)}</select></label>
        </div>
        <label className="flex flex-col gap-1 text-muted-foreground">作业说明<textarea rows={2} maxLength={5000} value={instructions} onChange={e=>setInstructions(e.target.value)} disabled={life==='WITHDRAWN'} /></label>
        <div className="flex flex-wrap items-center gap-2"><button type="submit" disabled={life==='WITHDRAWN'} className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-50">保存修改</button><Btn size="sm" onClick={onCancel}>取消</Btn><Btn size="sm" variant="danger" disabled={life==='WITHDRAWN'} onClick={()=>{if(confirm('撤回这份作业？已有结果保留，但不能再登记。')) say(w.setLifecycle(a,'WITHDRAWN','撤回作业'),'已撤回')}}>撤回作业</Btn><SaveState scope={`hw:${a.id}`} compact /></div>
      </form>}
      <details open={!editor}><summary className={editor ? 'cursor-pointer text-muted-foreground' : 'hidden'}>更多设置与操作记录</summary>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          全班截止
          <input type="datetime-local" className={sel} value={dl} disabled={life === "WITHDRAWN"} onChange={(e) => setDl(e.target.value)} />
        </label>
        <Btn size="sm" disabled={life === "WITHDRAWN" || dl === toLocalInput(a.deadline) || !dl} onClick={() => w.setDeadline(a, fromLocalInput(dl))}>
          保存截止
        </Btn>
        {a.deadline ? (
          <Btn size="sm" variant="ghost" disabled={life === "WITHDRAWN"} onClick={() => (w.setDeadline(a, null), setDl(""))}>
            改为无截止
          </Btn>
        ) : null}
        <label className="ml-auto flex items-center gap-1.5">
          <input type="checkbox" checked={!!a.scoreEnabled} onChange={(e) => w.setScoreEnabled(a, e.target.checked)} />
          启用可选数字分数
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        修改截止不会重算已登记的按时／迟交；录入锁定为有效截止后 3 天，无截止不锁定。评价标准：{revById(a.schemeRevId ?? null)?.name ?? "待核对"}（布置时固定）。
      </p>

      {life === "ACTIVE" && candidates.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="font-medium">追加适用学生（当前在读、未在本作业中）</p>
          <div className="flex flex-wrap gap-2">
            {candidates.map((sid) => (
              <label key={sid} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={addSel.has(sid)}
                  onChange={(e) => {
                    const n = new Set(addSel)
                    if (e.target.checked) n.add(sid)
                    else n.delete(sid)
                    setAddSel(n)
                  }}
                />
                {nameOf(sid)}
              </label>
            ))}
          </div>
          {addSel.size ? (
            <div className="flex flex-wrap items-center gap-2">
              {pastDue ? (
                <label className="flex items-center gap-1">
                  全班截止已过，新学生的个别截止
                  <input type="datetime-local" className={sel} value={addDl} onChange={(e) => setAddDl(e.target.value)} />
                </label>
              ) : null}
              <Btn
                size="sm"
                disabled={pastDue && !addDl}
                onClick={() => {
                  say(w.addRecipients(a, [...addSel], addDl ? fromLocalInput(addDl) : null), `已追加 ${addSel.size} 人`)
                  setAddSel(new Set())
                }}
              >
                追加 {addSel.size} 人
              </Btn>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {life === "ACTIVE" ? (
          <Btn
            size="sm"
            onClick={() => {
              const open = p.ungraded + p.dueUnrecorded + p.suspected + p.review + p.notDue
              if (open && !confirm(`仍有 ${open} 项未结（待评价、未登记或安排待核对）。结束检查不等于核对完成，这些项会保持原状。继续？`)) return
              say(w.setLifecycle(a, "CLOSED", "结束检查"), "已结束检查；未交保持不变")
            }}
          >
            结束检查
          </Btn>
        ) : null}
        {life === "CLOSED" ? (
          <Btn size="sm" onClick={() => say(w.setLifecycle(a, "ACTIVE", "恢复处理（补交）"), "已恢复处理，可在原作业中登记补交")}>
            恢复处理（补交）
          </Btn>
        ) : null}
        {onCopy && life !== "WITHDRAWN" ? (
          <Btn size="sm" onClick={() => onCopy(a)}>
            复制到另一任务
          </Btn>
        ) : onCopy ? (
          <Btn size="sm" onClick={() => onCopy(a)}>
            复制为新作业
          </Btn>
        ) : null}
        {life !== "WITHDRAWN" ? (
          <Btn
            size="sm"
            variant="danger"
            onClick={() => {
              if (!confirm("撤回误布置的作业？已有结果与发布引用会保留，但不能再登记。")) return
              say(w.setLifecycle(a, "WITHDRAWN", "撤回作业"), "已撤回")
            }}
          >
            撤回误布置
          </Btn>
        ) : null}
        {msg ? <span role="status">{msg}</span> : null}
      </div>
      {a.log?.length ? (
        <details>
          <summary className="cursor-pointer text-muted-foreground">变更记录（{a.log.length}）</summary>
          <ul className="mt-1 text-[11px] text-muted-foreground">
            {[...a.log].reverse().map((l, i) => (
              <li key={i}>
                {clockLabel(l.at)} · {l.what}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      </details>
    </div>
  )
}

/* ============================================================
 * 周反馈“作业评价”：本期应完成 / 后续安排 / 往期未结
 * ========================================================== */

export function HomeworkPanel({ tw, focusId }: { tw: TaskWeek; focusId?: string | null }) {
  const mt = useMt()
  const nowTs = Date.parse(mt.biz.clock)
  const groups = useMemo(() => {
    const g: Record<HwBucket, Assignment[]> = { THIS: [], LATER: [], PAST_OPEN: [] }
    for (const a of mt.biz.assignments) {
      if (a.taskId !== tw.task.id) continue
      const b = hwBucket(a, tw.week, nowTs)
      if (b) g[b].push(a)
    }
    return g
  }, [mt.biz.assignments, tw.task.id, tw.week, nowTs])
  const flat = [...groups.THIS, ...groups.PAST_OPEN, ...groups.LATER]
  const [openId, setOpenId] = useState<string | null>(focusId && flat.some((a) => a.id === focusId) ? focusId : (flat[0]?.id ?? null))
  const open = mt.biz.assignments.find((a) => a.id === openId) ?? null
  const manageBase = `/homework?task=${encodeURIComponent(tw.task.id)}`

  if (!flat.length)
    return (
      <EmptyState
        icon={<ClipboardList className="size-7" />}
        title="本期没有需要评价的作业"
        desc="本���应完成、往期未结与后续安排都为空。可在日卡或作业管理中布置。"
        action={
          <Link href={manageBase} className="text-sm text-primary underline-offset-2 hover:underline">
            前往作业管理
          </Link>
        }
      />
    )

  return (
    <div className="homework-cockpit grid items-start gap-4 font-sans lg:grid-cols-[17rem_minmax(0,1fr)]">
      <nav aria-label="作业" className="flex flex-col gap-3">
        {(["THIS", "PAST_OPEN", "LATER"] as HwBucket[]).map((b) =>
          groups[b].length ? (
            <div key={b} className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {BUCKET_LABEL[b]} {groups[b].length}
              </p>
              <ul className="flex flex-col gap-1.5">
                {groups[b].map((a) => (
                  <li key={a.id}>
                    <HwListItem a={a} active={a.id === openId} onClick={() => setOpenId(a.id)} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          归期按有效截止所在周；无截止按布置日期所在周。处理往期作业不会自动加入本周发布。
        </p>
        <Link href={manageBase} className="text-xs text-primary underline-offset-2 hover:underline">
          在作业管理中布置或查看全部
        </Link>
      </nav>
      {open ? <HwReview key={open.id} a={open} manageHref={`${manageBase}&hw=${encodeURIComponent(open.id)}`} /> : null}
    </div>
  )
}

export function HwListItem({ a, active, onClick, sub }: { a: Assignment; active: boolean; onClick: () => void; sub?: string }) {
  const mt = useMt()
  const p = hwProgress(a, Date.parse(mt.biz.clock))
  const life = lifecycleOf(a)
  const due = p.dueUnrecorded + p.suspected
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      className={`w-full rounded-xl border bg-card px-3 py-2 text-left text-card-foreground ${active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
    >
      <span className="line-clamp-2 block text-sm font-medium">{a.title}</span>
      {sub ? <span className="block truncate text-[11px] text-muted-foreground">{sub}</span> : null}
      <span className="block text-[11px] text-muted-foreground">
        截止 {deadlineText(a.deadline)}
        {life !== "ACTIVE" ? ` · ${LIFECYCLE_LABEL[life]}` : ""}
      </span>
      <span className="mt-1 flex flex-wrap gap-1 text-[11px]">
        <span className="text-muted-foreground">{p.E ? `核对 ${p.checked}/${p.E}` : "无需核对"}</span>
        {p.ungraded ? <span className="hw-amber rounded px-1">待评价 {p.ungraded}</span> : null}
        {due ? <span className="hw-amber rounded px-1">到期待核对 {due}</span> : null}
        {p.review ? <span className="rounded bg-muted px-1">安排待核对 {p.review}</span> : null}
      </span>
    </button>
  )
}

/* ============================================================
 * 统一布置：新布置 / 复制 / 线下补录（侧栏、日卡共用）
 * ========================================================== */

export type AssignMode = "NEW" | "OFFLINE" | "COPY"

export function AssignForm({
  task,
  sourceDate,
  mode = "NEW",
  copyFrom,
  onDone,
}: {
  task: Pick<STask, "id" | "teacher_id">
  sourceDate?: string | null
  mode?: AssignMode
  copyFrom?: Assignment | null
  onDone: (id: string | null) => void
}) {
  const mt = useMt()
  const w = useHomeworkWriters()
  const teacherId = useTeacherId() ?? task.teacher_id
  const draftKey = `${teacherId}|${task.id}|${mode}${copyFrom ? `|${copyFrom.id}` : ""}`
  const draft = mode === "COPY" ? undefined : mt.biz.hwDrafts?.[draftKey]
  const today = dateOfClock(mt.biz.clock)

  const [token] = useState(() => `AS_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`)
  const [title, setTitle] = useState(draft?.title ?? copyFrom?.title ?? "")
  const [instructions, setInstructions] = useState(draft?.instructions ?? copyFrom?.instructions ?? "")
  const [req, setReq] = useState<"REQUIRED" | "OPTIONAL">(draft?.requirement ?? copyFrom?.defaultRequirement ?? "REQUIRED")
  // DEFAULT = 实际布置成功时的学校自然日 + N 天结束；NONE = 明确无截止；其它为手填
  const prefs = useTeacherPrefs(teacherId)
  const pw = usePrefWriters(teacherId)
  const draftDays = /^DAYS:(\d+)$/.exec(draft?.deadline ?? "")
  const [dl, setDl] = useState<string>(draftDays ? "DEFAULT" : (draft?.deadline ?? (mode === "OFFLINE" ? "NONE" : "DEFAULT")))
  const [daysRaw, setDaysRaw] = useState<string>(draftDays ? draftDays[1] : String(prefs.hwDays))
  const days = parseDays(daysRaw)
  const [origDate, setOrigDate] = useState(draft?.originalDate ?? "")
  const [useCurrentScheme, setUseCurrentScheme] = useState(true)
  const rosterDate = mode === "OFFLINE" && origDate ? origDate : today
  const roster = membersOn(mt.biz.memberships[task.id] ?? [], rosterDate)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const dirty = useRef(false)

  const persistDraft = () => {
    if (!dirty.current || mode === "COPY") return
    const d: HwDraft = { teacherId, taskId: task.id, mode, title, instructions, requirement: req, deadline: dl === "DEFAULT" ? `DAYS:${daysRaw}` : dl, originalDate: origDate, sourceDate: sourceDate ?? null }
    w.saveDraft(draftKey, d)
  }
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    dirty.current = true
    set(v)
  }

  const recipients = roster.filter((s) => !excluded.has(s))
  const previewDeadline =
    dl === "DEFAULT" ? (days === null ? null : deadlineInDays(mt.biz.clock, days)) : dl === "NONE" ? null : fromLocalInput(dl)
  const pastDeadline = mode !== "OFFLINE" && previewDeadline && Date.parse(previewDeadline) < Date.parse(mt.biz.clock)

  const submit = () => {
    if (busy) return
    if (!title.trim()) return setErr("请输入作业标题")
    if (mode === "OFFLINE" && !origDate) return setErr("请填写原布置日期")
    if (mode === "OFFLINE" && origDate > today) return setErr("原布置日期不能晚于今天")
    if (!recipients.length) return setErr("请至少保留一名适用学生")
    if (dl === "DEFAULT" && days === null) return setErr(`截止天数请输入 0–${HW_DAYS_MAX} 的整数`)
    if (pastDeadline) return setErr("截止早于现在。已经线下布置的旧作业请使用“补录线下作业”")
    setBusy(true)
    let newId: string | null = null
    const r = mt.command(mode === "OFFLINE" ? "补录线下作业" : "布置作业", (s) => {
      const existing = s.assignments.find((x) => x.createToken === token)
      if (existing) {
        newId = existing.id
        return s
      }
      const valid = new Set(membersOn(s.memberships[task.id] ?? [], mode === "OFFLINE" ? origDate : dateOfClock(s.clock)))
      const finalList = recipients.filter((x) => valid.has(x))
      if (finalList.length !== recipients.length) return { error: "名单在确认前发生变化，请重新核对适用学生" }
      newId = `HW_${task.id}_${s.seq + 1}`
      // 以实际写入时刻的学校自然日计算，表单停留跨日也不会用旧日期
      const deadline = dl === "NONE" ? null : dl === "DEFAULT" ? deadlineInDays(s.clock, days ?? 0) : fromLocalInput(dl)
      const a: Assignment = {
        id: newId,
        taskId: task.id,
        createToken: token,
        sourceDate: sourceDate ?? null,
        title: title.trim(),
        instructions: instructions.trim(),
        issuedAt: mode === "OFFLINE" ? `${origDate}T00:00:00${TZ}` : s.clock,
        deadline,
        recipients: finalList,
        defaultRequirement: req,
        requirementOverrides: {},
        results: {},
        revision: 1,
        stamp: s.stamp + 1,
        status: "ACTIVE",
        scoreEnabled: copyFrom?.scoreEnabled ?? false,
        copiedFrom: copyFrom?.id ?? null,
        ...(mode === "OFFLINE" ? { offline: { registeredAt: s.clock } } : {}),
        // 首次布置绑定当时有效的作业默认方案；补录无依据时留空为“标准待核对”
        schemeRevId: mode === "OFFLINE" && !useCurrentScheme ? null : homeworkRevForTask(s.schemes, task.id, task.teacher_id, s.clock).revId,
        log: [{ at: s.clock, what: mode === "OFFLINE" ? `线下补录（原布置 ${origDate}）` : copyFrom ? `复制自「${copyFrom.title}」` : "布置" }],
      }
      const drafts = { ...(s.hwDrafts ?? {}) }
      delete drafts[draftKey]
      return { ...s, seq: s.seq + 1, assignments: [...s.assignments, a], hwDrafts: drafts }
    })
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    onDone(newId)
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3" onBlur={persistDraft}>
      {draft?.savedAt ? (
        <div className="flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5 text-xs">
          <span>已恢复 {clockLabel(draft.savedAt)} 的未布置草稿</span>
          <Btn
            size="sm"
            variant="ghost"
            onClick={() => {
              w.saveDraft(draftKey, null)
              dirty.current = false
              onDone(null)
            }}
          >
            删除草稿
          </Btn>
        </div>
      ) : null}
      {copyFrom ? <p className="text-xs text-muted-foreground">复制题目内容自「{copyFrom.title}」；不复制提交、成绩、免做、延期或结束状态。</p> : null}
      <input className={inputCls} placeholder="作业��题" value={title} onChange={(e) => edit(setTitle)(e.target.value)} aria-label="作业��题" />
      <textarea
        className={inputCls}
        rows={3}
        placeholder="作业要求／内容"
        value={instructions}
        onChange={(e) => edit(setInstructions)(e.target.value)}
        aria-label="作业要求"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select aria-label="默认要求" className={sel} value={req} onChange={(e) => edit(setReq)(e.target.value as "REQUIRED")}>
          <option value="REQUIRED">必做</option>
          <option value="OPTIONAL">选做</option>
        </select>
        {mode === "OFFLINE" ? (
          <label className="flex items-center gap-1">
            原布置日期
            <input type="date" className={sel} max={today} value={origDate} onChange={(e) => edit(setOrigDate)(e.target.value)} />
          </label>
        ) : null}
        <select
          aria-label="截止"
          className={sel}
          value={dl === "DEFAULT" || dl === "NONE" ? dl : "CUSTOM"}
          onChange={(e) => edit(setDl)(e.target.value === "CUSTOM" ? toLocalInput(previewDeadline ?? defaultDeadline(mt.biz.clock)) : e.target.value)}
        >
          {mode !== "OFFLINE" ? <option value="DEFAULT">截止：N 天后结束</option> : null}
          <option value="CUSTOM">{mode === "OFFLINE" ? "原截止时间" : "指定截止"}</option>
          <option value="NONE">{mode === "OFFLINE" ? "原截止未知／无截止" : "不设截止"}</option>
        </select>
        {dl === "DEFAULT" && mode !== "OFFLINE" ? (
          <span className="flex flex-wrap items-center gap-1.5 text-xs">
            <input
              type="text"
              inputMode="numeric"
              aria-label="截止天数"
              aria-invalid={days === null}
              className={`${sel} w-14 text-center ${days === null ? "border-destructive" : ""}`}
              value={daysRaw}
              onChange={(e) => edit(setDaysRaw)(e.target.value)}
            />
            <span>天后</span>
            <span className="text-muted-foreground">
              {days === null ? `请输入 0–${HW_DAYS_MAX} 的整数` : `${days === 0 ? "今天" : fmtMD(addDays(today, days))} 23:59 截止`}
            </span>
            {days !== null && days !== prefs.hwDays ? (
              <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => pw.setHwDays(days)}>
                设为我的默认
              </button>
            ) : null}
          </span>
        ) : null}
        {dl !== "DEFAULT" && dl !== "NONE" ? (
          <input type="datetime-local" className={sel} value={dl} onChange={(e) => edit(setDl)(e.target.value)} aria-label="截止时间" />
        ) : null}
        <span className="text-muted-foreground">{previewDeadline ? `将于 ${clockLabel(previewDeadline)} 截止` : "无截止，不会自动逾期或锁定"}</span>
      </div>
      {mode === "OFFLINE" ? (
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={useCurrentScheme} onChange={(e) => setUseCurrentScheme(e.target.checked)} />
          原作业按当前作业默认标准评价（不勾选则标记为“标准待核对”，仍可登记提交）
        </label>
      ) : null}
      <details className="text-xs" open={excluded.size > 0}>
        <summary className="cursor-pointer">
          适用学生 {recipients.length}/{roster.length}
          <span className="text-muted-foreground">（{mode === "OFFLINE" && origDate ? `${fmtMD(origDate)} 在读名单` : "当前在读名单"}，非当天到场名单）</span>
        </summary>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {roster.map((sid) => (
            <label key={sid} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={!excluded.has(sid)}
                onChange={(e) => {
                  const n = new Set(excluded)
                  if (e.target.checked) n.delete(sid)
                  else n.add(sid)
                  setExcluded(n)
                }}
              />
              {nameOf(sid)}
            </label>
          ))}
        </div>
      </details>
      {err ? (
        <p role="alert" className="text-xs text-[#9a2b22]">
          {err}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <SaveState scope={scopeTask(task.id)} compact />
        <Btn size="sm" variant="ghost" onClick={() => (persistDraft(), onDone(null))}>
          取消
        </Btn>
        <Btn size="sm" variant="primary" onClick={submit} disabled={busy}>
          {mode === "OFFLINE" ? "补录" : "布置作业"}
        </Btn>
      </div>
    </div>
  )
}

export { effDeadline }
