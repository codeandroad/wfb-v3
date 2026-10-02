"use client"

import { Badge, Card, CardHeader, Input, LinkButton, Segmented, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { CURRENT_SCHOOL } from "@/lib/school/instance"
import { checkRows, commitRows, SAMPLE_FILE, sampleRows, type ImportResult, type ImportRow, type RowCheck } from "@/lib/school/person-import"
import { formatYyyymm, PERSON_DATE_LABEL, PERSON_TYPE_LABEL, type PersonType } from "@/lib/school/person-no"
import { AlertCircle, CheckCircle2, Eraser, FileSpreadsheet, Pencil, Sparkles, Upload } from "lucide-react"
import { useMemo, useState } from "react"
import { ImportStepper, type ImportStep } from "./import-stepper"

type Filter = "all" | "issue" | "ok"

const GROUP_LABEL: Record<PersonType, string> = { S: "行政班", E: "部门" }
const SCHOOL = CURRENT_SCHOOL.code

export function PersonImport({ type }: { type: PersonType }) {
  const { push } = useToast()
  const [step, setStep] = useState<ImportStep>("upload")
  const [rows, setRows] = useState<ImportRow[]>([])
  const [filter, setFilter] = useState<Filter>("all")
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null)
  const [results, setResults] = useState<ImportResult[]>([])

  const label = PERSON_TYPE_LABEL[type]
  const checks = useMemo(() => checkRows(rows, type), [rows, type])
  const counts = useMemo(() => {
    let provided = 0
    let auto = 0
    let issue = 0
    for (const r of rows) {
      const c = checks.get(r.id)
      if (c?.kind === "ok") provided++
      else if (c?.kind === "auto") auto++
      else issue++
    }
    return { provided, auto, issue }
  }, [rows, checks])

  const visible = rows.filter((r) => {
    const kind = checks.get(r.id)?.kind
    if (filter === "issue") return kind === "error"
    if (filter === "ok") return kind !== "error"
    return true
  })

  function load() {
    setRows(sampleRows(type))
    setFilter("all")
    setEditing(null)
    setStep("review")
  }

  function setNo(id: string, no: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, no } : r)))
  }

  function verifyDraft() {
    if (!editing) return
    const row = rows.find((r) => r.id === editing.id)
    setNo(editing.id, editing.draft)
    setEditing(null)
    const next = checkRows(
      rows.map((r) => (r.id === editing.id ? { ...r, no: editing.draft } : r)),
      type,
    ).get(editing.id)
    if (next?.kind === "error") push(`第 ${row?.line} 行仍未通过：${next.title}`, "danger")
    else push(`第 ${row?.line} 行编号已通过验证`, "success")
  }

  function clearAllIssues() {
    const ids = rows.filter((r) => checks.get(r.id)?.kind === "error").map((r) => r.id)
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, no: "" } : r)))
    setEditing(null)
    push(`已将 ${ids.length} 行问题编号清空，改为正式导入时自动生成`, "success")
  }

  function commit() {
    const res = commitRows(rows, type)
    setResults(res)
    setStep("done")
    push(`已导入 ${res.length} 名${label}，全部获得正式编号（演示）`, "success")
  }

  return (
    <div>
      <ImportStepper step={step} />

      {step === "upload" ? (
        <Card>
          <CardHeader title={`导入${label}`} desc="只用于建立新人员档案；不会更新或覆盖已有人员。支持 .xlsx / .csv，此原型使用内置示例文件。" />
          <div className="flex flex-col gap-5 p-5 lg:flex-row">
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-input bg-muted/30 px-6 py-12 text-center">
              <Upload className="mb-3 size-7 text-muted-foreground" />
              <p className="text-[14px] font-medium">拖拽文件到此处，或选择示例文件</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                示例：{SAMPLE_FILE[type].fileName}（{SAMPLE_FILE[type].rows.length} 行，含多种编号情况）
              </p>
              <Button className="mt-4" onClick={load}>
                <FileSpreadsheet className="size-4" />
                载入示例文件
              </Button>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-[13px] lg:w-80">
              <p className="font-medium">{label}编号列（可选）</p>
              <p className="font-mono text-[13px] tracking-wide text-primary">
                {SCHOOL}YYYYMMNNN{type}
              </p>
              <ul className="flex flex-col gap-1.5 leading-relaxed text-muted-foreground">
                <li>YYYYMM 为{PERSON_DATE_LABEL[type]}年月，NNN 为 001–999。</li>
                <li>留空：正式导入时由系统自动生成。</li>
                <li>填写：须为新格式、未被占用，且在文件内唯一。</li>
                <li>旧格式编号（如 TG202309G10018）不再接受。</li>
              </ul>
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                模板列：姓名 · {PERSON_DATE_LABEL[type]}日期 · {GROUP_LABEL[type]} · {label}编号
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {step === "review" ? (
        <Card>
          <CardHeader
            title="校验预览"
            desc={`${SAMPLE_FILE[type].fileName} · 共 ${rows.length} 行。预览中的自动编号只显示规则，正式导入时才分配流水号。`}
            action={
              counts.issue > 0 ? <Badge tone="danger">{counts.issue} 行待处理</Badge> : <Badge tone="success">全部通过</Badge>
            }
          />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-5 py-3 text-[13px]">
            <Summary tone="text-[#256a49]" value={counts.provided} label="使用文件中的编号" />
            <Summary tone="text-[#2a5b6e]" value={counts.auto} label="正式导入时自动生成" />
            <Summary tone="text-[#9a2b22]" value={counts.issue} label="编号有问题" />
            <div className="ml-auto flex items-center gap-2">
              {counts.issue > 0 ? (
                <Button size="sm" variant="outline" onClick={clearAllIssues}>
                  <Eraser className="size-3.5" />
                  问题编号全部改为自动
                </Button>
              ) : null}
              <Segmented<Filter>
                size="sm"
                ariaLabel="筛选行"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: `全部 ${rows.length}` },
                  { value: "issue", label: `待处理 ${counts.issue}` },
                  { value: "ok", label: `可导入 ${rows.length - counts.issue}` },
                ]}
              />
            </div>
          </div>

          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-[13px]">
              <thead className="bg-muted/70 text-xs text-muted-foreground">
                <tr>
                  <th className="w-12 px-4 py-2 font-medium">行</th>
                  <th className="px-3 py-2 font-medium">姓名</th>
                  <th className="px-3 py-2 font-medium">{PERSON_DATE_LABEL[type]}</th>
                  <th className="px-3 py-2 font-medium">{GROUP_LABEL[type]}</th>
                  <th className="w-[44%] px-3 py-2 font-medium">{label}编号与校验</th>
                  <th className="px-4 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <PreviewRow
                    key={r.id}
                    row={r}
                    type={type}
                    check={checks.get(r.id)!}
                    editing={editing?.id === r.id ? editing.draft : null}
                    onEdit={() => setEditing({ id: r.id, draft: r.no })}
                    onDraft={(draft) => setEditing({ id: r.id, draft })}
                    onVerify={verifyDraft}
                    onCancel={() => setEditing(null)}
                    onClear={() => {
                      setNo(r.id, "")
                      setEditing(null)
                    }}
                    onRestore={() => setNo(r.id, r.originalNo)}
                  />
                ))}
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      {filter === "issue" ? "没有待处理的行，可以正式导入。" : "没有符合条件的行。"}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            <p className="text-[13px] text-muted-foreground">
              {counts.issue > 0
                ? `还有 ${counts.issue} 行编号问题：请修改为合法且未占用的编号，或清空改为自动编号。`
                : `将新建 ${rows.length} 名${label}：${counts.provided} 人使用文件编号，${counts.auto} 人自动编号。`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
                返回
              </Button>
              <Button size="sm" disabled={counts.issue > 0 || editing !== null} onClick={commit}>
                正式导入 {rows.length} 人
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {step === "done" ? <DoneView type={type} results={results} onAgain={() => setStep("upload")} /> : null}
    </div>
  )
}

function Summary({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={`text-[15px] font-semibold tabular-nums ${tone}`}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}

function PreviewRow({
  row,
  type,
  check,
  editing,
  onEdit,
  onDraft,
  onVerify,
  onCancel,
  onClear,
  onRestore,
}: {
  row: ImportRow
  type: PersonType
  check: RowCheck
  editing: string | null
  onEdit: () => void
  onDraft: (v: string) => void
  onVerify: () => void
  onCancel: () => void
  onClear: () => void
  onRestore: () => void
}) {
  const isError = check.kind === "error"
  const changed = row.no !== row.originalNo
  const inputId = `import-no-${row.id}`

  return (
    <tr className={`border-t border-border align-top ${isError ? "bg-[#fbe6e4]/40" : ""}`}>
      <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.line}</td>
      <td className="px-3 py-3 font-medium">{row.name}</td>
      <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.date}</td>
      <td className="px-3 py-3 text-muted-foreground">{row.group}</td>
      <td className="px-3 py-3">
        {editing !== null ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="sr-only">
              第 {row.line} 行编号
            </label>
            <Input
              id={inputId}
              autoFocus
              value={editing}
              placeholder={`${SCHOOL}YYYYMMNNN${type}，留空则自动编号`}
              className="font-mono"
              onChange={(e) => onDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) onVerify()
                if (e.key === "Escape") onCancel()
              }}
            />
            <div className="flex items-center gap-2">
              <Button size="xs" onClick={onVerify}>
                验证
              </Button>
              <Button size="xs" variant="ghost" onClick={onCancel}>
                取消
              </Button>
            </div>
          </div>
        ) : (
          <CheckCell row={row} type={type} check={check} changed={changed} onRestore={onRestore} />
        )}
      </td>
      <td className="px-4 py-3">
        {editing === null ? (
          <div className="flex justify-end gap-1">
            <Button size="xs" variant={isError ? "outline" : "ghost"} onClick={onEdit}>
              <Pencil className="size-3" />
              修改
            </Button>
            {row.no !== "" ? (
              <Button size="xs" variant={isError ? "outline" : "ghost"} onClick={onClear}>
                <Eraser className="size-3" />
                改为自动
              </Button>
            ) : null}
          </div>
        ) : null}
      </td>
    </tr>
  )
}

function CheckCell({
  row,
  type,
  check,
  changed,
  onRestore,
}: {
  row: ImportRow
  type: PersonType
  check: RowCheck
  changed: boolean
  onRestore: () => void
}) {
  const fixedTag = changed ? (
    <span className="text-xs text-muted-foreground">
      已修正（原值 {row.originalNo ? <span className="font-mono">{row.originalNo}</span> : "空"}）
      <button className="ml-1.5 text-primary hover:underline" onClick={onRestore}>
        还原
      </button>
    </span>
  ) : null

  if (check.kind === "auto") {
    return (
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2">
          <Badge tone="info">
            <Sparkles className="size-3" />
            自动编号
          </Badge>
          <span className="font-mono text-muted-foreground">
            {SCHOOL}
            {check.yyyymm ?? "YYYYMM"}···{type}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          正式导入时按 {check.yyyymm ? formatYyyymm(check.yyyymm) : "—"} 流水号池分配，预览中不占用号码。
        </span>
        {fixedTag}
      </div>
    )
  }

  if (check.kind === "ok") {
    return (
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2">
          <CheckCircle2 className="size-3.5 text-[#2f7d5b]" aria-hidden />
          <span className="font-mono font-medium">{row.no}</span>
          <span className="sr-only">校验通过</span>
        </span>
        {check.warning ? <span className="text-xs text-[#8a5a12]">{check.warning}</span> : null}
        {fixedTag}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[#9a2b22] line-through decoration-[#9a2b22]/40">{row.no}</span>
      <span className="flex items-start gap-1.5 text-[#9a2b22]">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">{check.title}。</span>
          {check.detail}
        </span>
      </span>
      <span className="text-xs text-muted-foreground">修改为合法且未占用的编号，或清空改为自动编号。</span>
      {fixedTag}
    </div>
  )
}

function DoneView({ type, results, onAgain }: { type: PersonType; results: ImportResult[]; onAgain: () => void }) {
  const label = PERSON_TYPE_LABEL[type]
  const system = results.filter((r) => r.source === "system").length
  return (
    <Card>
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e6f2ea]">
          <CheckCircle2 className="size-5 text-[#2f7d5b]" />
        </div>
        <div className="flex-1">
          <p className="text-[15px] font-semibold">导入完成 · 已新建 {results.length} 名{label}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {results.length - system} 人使用文件中的编号，{system} 人由系统自动生成。以下为最终正式编号，已登记占用、不再回收。
          </p>
        </div>
      </div>
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <thead className="bg-muted/70 text-xs text-muted-foreground">
            <tr>
              <th className="w-12 px-4 py-2 font-medium">行</th>
              <th className="px-3 py-2 font-medium">姓名</th>
              <th className="px-3 py-2 font-medium">{GROUP_LABEL[type]}</th>
              <th className="px-3 py-2 font-medium">正式{label}编号</th>
              <th className="px-4 py-2 font-medium">编号来源</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.line} className="border-t border-border">
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.line}</td>
                <td className="px-3 py-2.5 font-medium">{r.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.group}</td>
                <td className="px-3 py-2.5 font-mono font-medium">{r.no}</td>
                <td className="px-4 py-2.5">
                  {r.source === "user" ? <Badge tone="neutral">用户提供</Badge> : <Badge tone="info">系统生成</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
        <Button size="sm" variant="ghost" onClick={onAgain}>
          再次导入
        </Button>
        <LinkButton href={`/school?tab=${type === "S" ? "students" : "staff"}`} variant="outline">
          前往{type === "S" ? "学生资料" : "教职工管理"}
        </LinkButton>
      </div>
    </Card>
  )
}
