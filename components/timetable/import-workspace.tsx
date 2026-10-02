"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  ArrowRight,
  Info,
  Sparkles,
  Pencil,
  CircleSlash,
} from "lucide-react"
import { Card, Field, Select } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { useTimetable, type ImportDraftItem, type ImportDraftRange } from "@/lib/timetable/store"
import { decodeWorkbook, type DecodedWorkbook } from "@/lib/timetable/xlsx-read"
import {
  parseImport,
  detectSource,
  isGridSheet,
  IMPORT_CLASS_OPTIONS,
  classOptionById,
  type ImportResult,
  type ImportRecord,
} from "@/lib/timetable/grid-import"
import { serializeRecord, type GridView } from "@/lib/timetable/grid-slash"
import { WEEKS, WEEKDAYS, PERIODS, TEACHERS, TERM_END, addDays, fmtDate } from "@/lib/timetable/data"

const ISSUE_TEXT: Record<string, string> = {
  PERIOD_UNMAPPED: "该行缺少课节编号",
  PERIOD_UNMATCHED: "课节编号不在系统作息表内",
  PERIOD_AMBIGUOUS: "课节编号匹配到多个作息条目",
  PERIOD_COLUMN_REQUIRED: "未找到“节次/课节”列",
  DATE_COLUMNS_REQUIRED: "未找到可识别的星期列",
  FIELD_COUNT: "字段数超过该视角上限",
  EMPTY_MIDDLE_FIELD: "中间空字段必须写 -",
  ARRANGEMENT_REQUIRED: "安排名称不能为空",
  CELL_NOT_TEXT: "安排格必须是文本",
  NEWLINE_IN_QUOTED_FIELD: "引号内不能换行",
  UNCLOSED_QUOTE: "双引号未闭合",
  CHAR_AFTER_QUOTE: "结束引号后有多余字符",
  QUOTE_IN_UNQUOTED_FIELD: "未加引号的字段含引号",
}
const issueText = (c: string) => ISSUE_TEXT[c] ?? c

const TEMPLATES = [
  { href: "/timetable-templates/blank-templates.xlsx", label: "空白模板（教师+班级）" },
  { href: "/timetable-templates/teacher-example.xlsx", label: "教师视角示例" },
  { href: "/timetable-templates/class-example.xlsx", label: "班级视角示例" },
  { href: "/timetable-templates/teacher-example-no-time.xlsx", label: "教师视角·无时间列示例" },
]

type ClassFix = { kind: "map"; classId: string } | { kind: "activity" } | { kind: "adhoc" } | { kind: "skip" }
type TeacherFix = { kind: "teacher"; teacherId: string } | { kind: "skip" }

// 一条记录最终的写入决定
type Decision =
  | { state: "ready"; item: ImportDraftItem; note?: string }
  | { state: "needs"; groupKey: string }
  | { state: "skipped"; reason: string }

const weekdayLabel = (n: number) => WEEKDAYS.find((w) => w.n === n)?.label ?? `周${n}`
const teacherName = (id: string | null | undefined) => TEACHERS.find((t) => t.id === id)?.name ?? ""

export function ImportWorkspace({ mode }: { mode: "school" | "personal" }) {
  const tt = useTimetable()
  const me = tt.persona === "admin" ? tt.selectedTeacher : tt.persona
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [wb, setWb] = useState<DecodedWorkbook | null>(null)
  const [sheet, setSheet] = useState("")
  const [layoutOverride, setLayoutOverride] = useState<GridView | null>(null)
  const [schoolTeacher, setSchoolTeacher] = useState<string | null>(null)
  const [editSource, setEditSource] = useState(false)
  const defaultWeek = WEEKS.find((w) => w.start === tt.weekStart)?.start ?? WEEKS[0].start
  const [weekStart, setWeekStart] = useState(defaultWeek)
  const [rangeMode, setRangeMode] = useState<"fromWeek" | "onlyWeek">("fromWeek")
  const [classFixes, setClassFixes] = useState<Record<string, ClassFix>>({})
  const [teacherFixes, setTeacherFixes] = useState<Record<string, TeacherFix>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState<{ added: number; unchanged: number; conflicts: number } | null>(null)

  async function onFile(file: File) {
    setError(null)
    setApplied(null)
    setFileName(file.name)
    setBusy(true)
    setLayoutOverride(null)
    setSchoolTeacher(null)
    setClassFixes({})
    setTeacherFixes({})
    try {
      const decoded = await decodeWorkbook(await file.arrayBuffer())
      setWb(decoded)
      const grid = decoded.sheetNames.find((n) => decoded.sheets[n] && isGridSheet(decoded.sheets[n]))
      setSheet(grid ?? decoded.sheetNames[0] ?? "")
    } catch {
      setWb(null)
      setError("无法读取该文件，请确认是标准 .xlsx 工作簿（不执行公式、仅读取值）。")
    } finally {
      setBusy(false)
    }
  }

  const gridSheets = useMemo(() => (wb ? wb.sheetNames.filter((n) => wb.sheets[n] && isGridSheet(wb.sheets[n])) : []), [wb])

  const detection = useMemo(() => {
    if (!wb || !sheet || !wb.sheets[sheet]) return null
    const instructions = wb.sheetNames
      .filter((n) => !gridSheets.includes(n))
      .map((n) => Object.values(wb.sheets[n]?.cells ?? {}).join(" "))
      .join(" ")
    return detectSource(wb.sheets[sheet], instructions)
  }, [wb, sheet, gridSheets])

  const layout: GridView = layoutOverride ?? detection?.layout ?? "TEACHER"
  const targetTeacher = mode === "personal" ? me : schoolTeacher ?? detection?.teacherId ?? TEACHERS[0].id

  const range: ImportDraftRange =
    rangeMode === "fromWeek"
      ? { scope: "range", weekStart, effectiveDate: weekStart, effectiveTo: TERM_END }
      : { scope: "once", weekStart, effectiveDate: weekStart, effectiveTo: addDays(weekStart, 6) }

  const result: ImportResult | null = useMemo(() => {
    if (!wb || !sheet || !wb.sheets[sheet] || !detection) return null
    try {
      return parseImport(wb.sheets[sheet], layout, weekStart, { teacherId: layout === "TEACHER" ? targetTeacher : null, order: detection.order })
    } catch {
      return null
    }
  }, [wb, sheet, layout, weekStart, targetTeacher, detection])

  // 每条记录 → 写入决定（结合用户对待定项的处理）
  const decisions = useMemo(() => {
    const map = new Map<string, Decision>()
    if (!result) return map
    const subjectOf = (tid: string) => TEACHERS.find((t) => t.id === tid)?.subject ?? ""
    for (const r of result.records) {
      if (r.status === "error" || !r.periodId) {
        map.set(r.id, { state: "skipped", reason: r.timingError ? issueText(r.timingError) : "课节无法对应" })
        continue
      }
      // 教师
      let tid = r.teacherId
      if (r.teacherStatus !== "ok") {
        const key = `tch:${r.raw.teacherText ?? ""}`
        const fix = teacherFixes[key]
        if (!fix) {
          map.set(r.id, { state: "needs", groupKey: key })
          continue
        }
        if (fix.kind === "skip") {
          map.set(r.id, { state: "skipped", reason: "已选择跳过" })
          continue
        }
        tid = fix.teacherId
      }
      if (mode === "personal" && tid !== me) {
        map.set(r.id, { state: "skipped", reason: `${teacherName(tid) || "其他教师"}的课次，不属于你的课表` })
        continue
      }
      // 教学对象
      let className = r.className
      let subject = r.subject ?? subjectOf(tid ?? "")
      const needsClass = !r.isActivity && r.classStatus !== "ok"
      if (r.isActivity) subject = "活动"
      if (needsClass) {
        const key = `cls:${r.raw.name}`
        const fix = classFixes[key] ?? (r.activitySuggested ? ({ kind: "activity" } as ClassFix) : undefined)
        if (!fix) {
          map.set(r.id, { state: "needs", groupKey: key })
          continue
        }
        if (fix.kind === "skip") {
          map.set(r.id, { state: "skipped", reason: "已选择跳过" })
          continue
        }
        if (fix.kind === "map") {
          const opt = classOptionById(fix.classId)
          className = opt?.name ?? r.raw.name
          subject = opt?.subject || subject
        } else {
          className = r.raw.name
          subject = fix.kind === "activity" ? "活动" : subjectOf(tid ?? "")
        }
      }
      map.set(r.id, {
        state: "ready",
        item: {
          sourceId: r.id,
          weekday: r.weekday,
          periodId: r.periodId,
          date: r.date,
          data: { className: className ?? r.raw.name, subject, group: r.raw.unitGroupShortName ?? undefined, room: r.raw.locationText ?? null },
        },
      })
    }
    return map
  }, [result, classFixes, teacherFixes, mode, me])

  const readyItems = useMemo(
    () => [...decisions.values()].flatMap((d) => (d.state === "ready" ? [d.item] : [])),
    [decisions],
  )
  const needsCount = [...decisions.values()].filter((d) => d.state === "needs").length
  const skippedCount = [...decisions.values()].filter((d) => d.state === "skipped").length

  const plan = useMemo(
    () => (mode === "personal" && readyItems.length ? tt.planDraftImport(targetTeacher, readyItems, range) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, readyItems, targetTeacher, range.scope, range.weekStart, tt],
  )

  function apply() {
    if (!readyItems.length) return
    setError(null)
    if (mode === "school") {
      tt.discardSchoolDraft(targetTeacher)
      tt.beginSchoolDraft(targetTeacher, weekStart)
      let added = 0
      let conflicts = 0
      for (const it of readyItems) {
        const res = tt.schoolDraftAdd(targetTeacher, { date: it.date, weekday: it.weekday, periodId: it.periodId }, it.data)
        res.ok ? added++ : conflicts++
      }
      setApplied({ added, unchanged: 0, conflicts })
      return
    }
    const res = tt.draftImport(targetTeacher, readyItems, range)
    setApplied({ added: res.added.length, unchanged: res.unchanged.length, conflicts: res.conflicts.length })
  }

  const detectedTeacher = detection?.teacherId ?? null
  const teacherMismatch = mode === "personal" && detectedTeacher && detectedTeacher !== me

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-3xl flex-col gap-1">
            <h2 className="text-[15px] font-semibold text-foreground">导入 Excel 课表</h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              上传网格式 .xlsx（行=课节，列=星期）。安排格用半角 <code className="rounded bg-muted px-1">/</code> 分隔：
              教师视角 <code className="rounded bg-muted px-1">教学对象/地点/分工</code>，班级视角{" "}
              <code className="rounded bg-muted px-1">教学对象/教师/地点/分工</code>。源布局、教师与字段顺序会自动识别；时间以系统作息为准。
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <Button onClick={() => fileRef.current?.click()} className="gap-2" disabled={busy}>
            <Upload className="size-4" /> {fileName ? "重新选择" : "选择文件"}
          </Button>
        </div>

        {fileName ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px] text-foreground">
            <FileSpreadsheet className="size-4 text-primary" />
            <span className="font-medium">{fileName}</span>
            {wb ? (
              <span className="text-muted-foreground">
                · 课表工作表 {gridSheets.length} 个{wb.sheetNames.length > gridSheets.length ? `（已跳过说明页 ${wb.sheetNames.length - gridSheets.length} 个）` : ""}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          <span className="text-muted-foreground">下载：</span>
          {TEMPLATES.map((t) => (
            <a key={t.href} href={t.href} download className="inline-flex items-center gap-1 text-primary hover:underline">
              <Download className="size-3.5" /> {t.label}
            </a>
          ))}
        </div>

        {error ? (
          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-destructive">
            <XCircle className="size-4" /> {error}
          </p>
        ) : null}
      </Card>

      {wb && detection ? (
        <Card className="p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="text-[14px] font-semibold text-foreground">已从文件识别</h3>
                <button
                  type="button"
                  onClick={() => setEditSource((v) => !v)}
                  className="ml-1 inline-flex items-center gap-1 text-[12px] text-primary hover:underline"
                >
                  <Pencil className="size-3" /> {editSource ? "完成" : "识别有误？修改"}
                </button>
              </div>

              {editSource ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="工作表">
                    <Select value={sheet} onChange={(e) => setSheet(e.target.value)}>
                      {(gridSheets.length ? gridSheets : wb.sheetNames).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="源布局">
                    <Select value={layout} onChange={(e) => setLayoutOverride(e.target.value as GridView)}>
                      <option value="TEACHER">教师视角（一位教师的课表）</option>
                      <option value="CLASS">班级视角（一个班的课表）</option>
                    </Select>
                  </Field>
                  {mode === "school" && layout === "TEACHER" ? (
                    <Field label="课表所属教师">
                      <Select value={targetTeacher} onChange={(e) => setSchoolTeacher(e.target.value)}>
                        {TEACHERS.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}（{t.subject}）</option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}
                </div>
              ) : (
                <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
                  <SourceFact label="工作表" value={sheet} />
                  <SourceFact
                    label="源布局"
                    value={layout === "TEACHER" ? "教师视角" : "班级视角"}
                    hint={detection.layout || layoutOverride ? undefined : "未能识别，已默认教师视角"}
                  />
                  {layout === "TEACHER" ? (
                    <SourceFact
                      label="课表教师"
                      value={teacherName(targetTeacher)}
                      hint={mode === "personal" ? "导入到当前登录账户" : detectedTeacher ? undefined : "未识别，请确认"}
                    />
                  ) : null}
                  <SourceFact label="字段顺序" value={detection.order === "V1" ? "对象/地点/分工" : "旧版：对象/分工/地点"} />
                </dl>
              )}

              {teacherMismatch ? (
                <p className="flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-3.5" />
                  表头显示为「{teacherName(detectedTeacher)}」的课表，将导入到你（{teacherName(me)}）的课表，请确认文件无误。
                </p>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-2 lg:w-96">
              <span className="text-[13px] font-medium text-foreground">生效范围</span>
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-[13px]" role="radiogroup" aria-label="生效范围">
                {(
                  [
                    ["fromWeek", "从该周起每周"],
                    ["onlyWeek", "仅该周（临时调整）"],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={rangeMode === v}
                    onClick={() => setRangeMode(v)}
                    className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${rangeMode === v ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <Select value={weekStart} onChange={(e) => setWeekStart(e.target.value)} aria-label="起始周">
                {WEEKS.map((w) => (
                  <option key={w.start} value={w.start}>
                    第{w.no}周 · {fmtDate(w.start)}–{fmtDate(w.end)}
                    {w.start === tt.weekStart ? "（本周）" : ""}
                  </option>
                ))}
              </Select>
              <p className="text-[12px] text-muted-foreground">
                {rangeMode === "fromWeek"
                  ? `${fmtDate(weekStart)} 起至学期末（${fmtDate(TERM_END)}）每周按此课表执行`
                  : `只影响 ${fmtDate(weekStart)}–${fmtDate(addDays(weekStart, 6))} 这一周`}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {result ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SummaryBadge tone="ok" icon={<CheckCircle2 className="size-3.5" />} n={readyItems.length} label="可写入" />
            <SummaryBadge tone="pending" icon={<AlertTriangle className="size-3.5" />} n={needsCount} label="待你确认" />
            <SummaryBadge tone="muted" icon={<CircleSlash className="size-3.5" />} n={skippedCount} label="跳过" />
            <span className="text-[12px] text-muted-foreground">
              共 {result.counts.total} 条安排
              {result.mapping.ignoredReferenceColumns.length ? " · 源表“时间”列仅作参考，已按系统作息对齐" : ""}
            </span>
          </div>

          {result.issues.length ? (
            <Card className="border-destructive/40 bg-destructive/5 p-4">
              <p className="mb-2 text-[13px] font-medium text-destructive">以下单元格无法解析，需在源表修正后重新上传</p>
              <ul className="flex flex-col gap-1 text-[12px] text-destructive">
                {result.issues.slice(0, 12).map((i, idx) => (
                  <li key={idx}>
                    {i.cell}：{issueText(i.code)}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <ResolvePanel
            records={result.records}
            decisions={decisions}
            classFixes={classFixes}
            teacherFixes={teacherFixes}
            teacherId={targetTeacher}
            onClassFix={(k, f) => setClassFixes((s) => ({ ...s, [k]: f }))}
            onTeacherFix={(k, f) => setTeacherFixes((s) => ({ ...s, [k]: f }))}
          />

          <PreviewGrid result={result} decisions={decisions} />

          <Card className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 p-4 shadow-md">
            <div className="flex flex-col gap-0.5 text-[12px] text-muted-foreground">
              <p className="flex items-center gap-1.5 text-[13px] text-foreground">
                <Info className="size-4 text-muted-foreground" />
                将写入 <b className="tabular-nums">{plan ? plan.added.length : readyItems.length}</b> 条
                {plan && plan.unchanged.length ? <>，与现有课表相同 {plan.unchanged.length} 条（不重复写入）</> : null}
                {plan && plan.conflicts.length ? <>，与已有课次冲突 {plan.conflicts.length} 条（不覆盖）</> : null}
                {needsCount ? <>，还有 {needsCount} 条待确认</> : null}
              </p>
              <p>{mode === "school" ? "写入学校发布草稿，需在课程中心复核后发布。" : "写入个人草稿，可在“我的课表”复核后确认应用；未确认的待定项不会写入。"}</p>
            </div>
            <Button onClick={apply} disabled={busy || !readyItems.length || (plan !== null && plan.added.length === 0)} className="gap-2">
              {mode === "school" ? "写入学校草稿" : "写入个人草稿"} <ArrowRight className="size-4" />
            </Button>
          </Card>

          {applied ? (
            <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/40 bg-primary/5 p-4 text-[13px] text-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" />
                已写入{mode === "school" ? "学校" : "个人"}草稿：新增 {applied.added} 条
                {applied.unchanged ? `，已存在 ${applied.unchanged} 条` : ""}
                {applied.conflicts ? `，冲突跳过 ${applied.conflicts} 条` : ""}。
              </span>
              <Link href={mode === "school" ? "/timetable" : "/timetable/my"} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                {mode === "school" ? "去课程中心复核" : "去我的课表复核并应用"} <ArrowRight className="size-3.5" />
              </Link>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function SourceFact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value || "—"}</dd>
      {hint ? <dd className="text-[11px] text-amber-700 dark:text-amber-400">{hint}</dd> : null}
    </div>
  )
}

function SummaryBadge({ tone, icon, n, label }: { tone: "ok" | "pending" | "muted"; icon: React.ReactNode; n: number; label: string }) {
  const cls =
    tone === "ok"
      ? "border-primary/30 bg-primary/10 text-primary"
      : tone === "pending"
        ? "border-amber-500/30 bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
        : "border-border bg-muted text-muted-foreground"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium ${cls}`}>
      {icon} {n} {label}
    </span>
  )
}

/* ---------------- 待确认项：按“同名对象”合并，一次处理多条 ---------------- */

function ResolvePanel({
  records,
  decisions,
  classFixes,
  teacherFixes,
  teacherId,
  onClassFix,
  onTeacherFix,
}: {
  records: ImportRecord[]
  decisions: Map<string, Decision>
  classFixes: Record<string, ClassFix>
  teacherFixes: Record<string, TeacherFix>
  teacherId: string
  onClassFix: (key: string, fix: ClassFix) => void
  onTeacherFix: (key: string, fix: TeacherFix) => void
}) {
  // 分组：需要处理的 + 已处理过的（便于改主意）
  const groups = new Map<string, { key: string; kind: "cls" | "tch"; label: string; records: ImportRecord[]; suggested: boolean; ambiguous: boolean }>()
  for (const r of records) {
    if (r.status === "error") continue
    const keys: { key: string; kind: "cls" | "tch"; label: string }[] = []
    if (r.teacherStatus !== "ok") keys.push({ key: `tch:${r.raw.teacherText ?? ""}`, kind: "tch", label: r.raw.teacherText || "（未写教师）" })
    if (!r.isActivity && r.classStatus !== "ok") keys.push({ key: `cls:${r.raw.name}`, kind: "cls", label: r.raw.name })
    for (const k of keys) {
      const g = groups.get(k.key) ?? { ...k, records: [], suggested: r.activitySuggested, ambiguous: r.classStatus === "ambiguous" }
      g.records.push(r)
      groups.set(k.key, g)
    }
  }
  const notes = records.filter((r) => decisions.get(r.id)?.state === "ready" && r.notes.length)
  const skipped = records.filter((r) => decisions.get(r.id)?.state === "skipped")
  if (!groups.size && !notes.length && !skipped.length) return null

  const mine = IMPORT_CLASS_OPTIONS.filter((o) => o.teacherIds.includes(teacherId))
  const others = IMPORT_CLASS_OPTIONS.filter((o) => !o.teacherIds.includes(teacherId))
  const slotText = (r: ImportRecord) => `${weekdayLabel(r.weekday)}${r.periodLabel ?? ""}`

  return (
    <Card className="p-0">
      {groups.size ? (
        <div className="flex flex-col">
          <div className="flex flex-col gap-0.5 border-b border-border px-5 py-3">
            <h3 className="text-[14px] font-semibold text-foreground">需要你确认的对象（{groups.size}）</h3>
            <p className="text-[12px] text-muted-foreground">
              以下名称未在教学班登记中找到。同名安排合并处理，选择一次即可应用到全部课次；导入不会自动创建教学班或任教关系。
            </p>
          </div>
          <ul className="divide-y divide-border">
            {[...groups.values()].map((g) => {
              const cf = g.kind === "cls" ? classFixes[g.key] ?? (g.suggested ? ({ kind: "activity" } as ClassFix) : undefined) : undefined
              const tf = g.kind === "tch" ? teacherFixes[g.key] : undefined
              const resolved = g.kind === "cls" ? !!cf : !!tf
              const value =
                g.kind === "cls"
                  ? cf
                    ? cf.kind === "map"
                      ? `map:${cf.classId}`
                      : cf.kind
                    : ""
                  : tf
                    ? tf.kind === "teacher"
                      ? `t:${tf.teacherId}`
                      : "skip"
                    : ""
              return (
                <li key={g.key} className="flex flex-col gap-3 px-5 py-3 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`size-2 shrink-0 rounded-full ${resolved ? "bg-primary" : "bg-amber-500"}`} aria-hidden />
                      <span className="font-medium text-foreground">{g.label}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {g.kind === "tch" ? "教师未登记" : g.ambiguous ? "名称对应多个教学班" : g.suggested ? "疑似非课程活动" : "教学班未登记"}
                      </span>
                      <span className="text-[12px] text-muted-foreground">{g.records.length} 节</span>
                    </div>
                    <p className="truncate text-[12px] text-muted-foreground">{g.records.map(slotText).join("、")}</p>
                  </div>
                  <div className="w-full md:w-80">
                    {g.kind === "cls" ? (
                      <Select
                        aria-label={`处理 ${g.label}`}
                        value={value}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v.startsWith("map:")) onClassFix(g.key, { kind: "map", classId: v.slice(4) })
                          else if (v) onClassFix(g.key, { kind: v as "activity" | "adhoc" | "skip" })
                        }}
                        className={resolved ? "" : "border-amber-500/60"}
                      >
                        <option value="" disabled>选择处理方式…</option>
                        {mine.length ? (
                          <optgroup label="对应到我任教的教学班">
                            {mine.map((o) => (
                              <option key={o.id} value={`map:${o.id}`}>{o.name}</option>
                            ))}
                          </optgroup>
                        ) : null}
                        <optgroup label="对应到其他教学班">
                          {others.map((o) => (
                            <option key={o.id} value={`map:${o.id}`}>{o.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="其他处理">
                          <option value="activity">作为非课程活动导入（如教研、会议）</option>
                          <option value="adhoc">按原名导入，待教务登记教学班</option>
                          <option value="skip">跳过，不导入</option>
                        </optgroup>
                      </Select>
                    ) : (
                      <Select
                        aria-label={`处理教师 ${g.label}`}
                        value={value}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === "skip") onTeacherFix(g.key, { kind: "skip" })
                          else if (v.startsWith("t:")) onTeacherFix(g.key, { kind: "teacher", teacherId: v.slice(2) })
                        }}
                        className={resolved ? "" : "border-amber-500/60"}
                      >
                        <option value="" disabled>对应到哪位教师…</option>
                        {TEACHERS.map((t) => (
                          <option key={t.id} value={`t:${t.id}`}>{t.name}（{t.subject}）</option>
                        ))}
                        <option value="skip">跳过，不导入</option>
                      </Select>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {notes.length || skipped.length ? (
        <details className={`group px-5 py-3 ${groups.size ? "border-t border-border" : ""}`}>
          <summary className="cursor-pointer text-[13px] text-muted-foreground hover:text-foreground">
            其他提示：{notes.length ? `${notes.length} 条可写入但有提示` : ""}
            {notes.length && skipped.length ? "，" : ""}
            {skipped.length ? `${skipped.length} 条将跳过` : ""}
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5 text-[12px]">
            {notes.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                <span className="text-foreground">{slotText(r)} · {r.className ?? r.raw.name}</span>
                {r.notes.map((n) => (
                  <span key={n}>
                    {n === "ROOM_TEXT_ONLY" ? `地点「${r.raw.locationText}」不在场地库，按原文保留` : n === "TEACHER_NOT_ASSIGNED" ? "教学班登记中暂无你的任教关系" : n}
                  </span>
                ))}
              </li>
            ))}
            {skipped.map((r) => {
              const d = decisions.get(r.id)
              return (
                <li key={r.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                  <span className="text-foreground">{slotText(r) || r.provenance.cell} · {r.raw.name}</span>
                  <span>{d?.state === "skipped" ? d.reason : ""}</span>
                  <span className="font-mono text-[11px] text-muted-foreground/70">{serializeRecord(r.raw)}</span>
                </li>
              )
            })}
          </ul>
        </details>
      ) : null}
    </Card>
  )
}

/* ---------------- 预览网格 ---------------- */

function PreviewGrid({ result, decisions }: { result: ImportResult; decisions: Map<string, Decision> }) {
  const days = result.mapping.dayColumns
    .slice()
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => ({ ...d, label: weekdayLabel(d.weekday) }))
  const byCell = new Map<string, ImportRecord[]>()
  for (const r of result.records) {
    if (!r.periodId) continue
    const k = `${r.weekday}:${r.periodId}`
    byCell.set(k, [...(byCell.get(k) || []), r])
  }
  const usedPeriods = PERIODS.filter((p) => days.some((d) => byCell.has(`${d.weekday}:${p.id}`)))
  const lastUsed = usedPeriods.length ? PERIODS.indexOf(usedPeriods[usedPeriods.length - 1]) : -1
  const periods = PERIODS.slice(0, Math.max(lastUsed + 1, 1))

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="text-[14px] font-semibold text-foreground">导入预览</h3>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <Legend className="border-primary/40 bg-primary/5" label="可写入" />
          <Legend className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20" label="待确认" />
          <Legend className="border-dashed border-border bg-muted/40" label="跳过" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 w-24 border-b border-r border-border bg-muted/50 px-2 py-2 text-left font-medium text-muted-foreground">节次</th>
              {days.map((d) => (
                <th key={d.col} className="min-w-32 border-b border-border px-2 py-2 text-left font-medium text-foreground">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="sticky left-0 z-10 border-b border-r border-border bg-card px-2 py-2 text-muted-foreground">
                  <div className="font-medium text-foreground">{p.label}</div>
                  <div className="text-[11px] tabular-nums">{p.start}–{p.end}</div>
                </td>
                {days.map((d) => {
                  const recs = byCell.get(`${d.weekday}:${p.id}`) || []
                  return (
                    <td key={d.col} className="border-b border-border px-1.5 py-1.5">
                      <div className="flex flex-col gap-1">
                        {recs.map((r) => {
                          const dec = decisions.get(r.id)
                          const tone =
                            dec?.state === "ready"
                              ? "border-primary/40 bg-primary/5"
                              : dec?.state === "needs"
                                ? "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20"
                                : "border-dashed border-border bg-muted/40 opacity-60"
                          const name = dec?.state === "ready" ? dec.item.data.className : r.raw.name
                          return (
                            <div key={r.id} className={`rounded-md border px-2 py-1 ${tone}`}>
                              <div className="truncate font-medium text-foreground">{name}</div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                {[r.raw.unitGroupShortName, r.raw.teacherText, r.raw.locationText].filter(Boolean).join(" · ") || "\u00a0"}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`size-3 rounded-sm border ${className}`} aria-hidden /> {label}
    </span>
  )
}
