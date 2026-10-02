"use client"

import { Badge, Card, CardHeader, Select } from "@/components/kit"
import { Button } from "@/components/ui/button"
import type { LogRecord } from "@/lib/import/log-store"
import type { ParseFailure, ParsedFile } from "@/lib/import/parse"
import { SAMPLES } from "@/lib/import/samples"
import { SHEET, sheetTitle, type SheetCode } from "@/lib/import/schema"
import { FileSpreadsheet, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { Notice } from "./shared"

const FAILURE_TITLE: Record<ParseFailure["kind"], string> = {
  format: "未支持的文件格式",
  size: "文件过大",
  protected: "文件受保护",
  corrupt: "文件无法解析",
  empty: "文件为空",
}

export function StepFile({
  file, failure, loading, hint, focus, completed, onPick, onSample, onClear, onNext, onOpenLog,
}: {
  file: ParsedFile | null
  failure: { name: string; kind: ParseFailure["kind"]; message: string } | null
  loading: string | null
  hint?: string
  focus?: SheetCode[]
  completed?: LogRecord
  onPick: (f: File) => void
  onSample: (id: string) => void
  onClear: () => void
  onNext: () => void
  onOpenLog: (id: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [sample, setSample] = useState(SAMPLES[0].id)

  const picker = (
    <input
      ref={input}
      type="file"
      accept=".xlsx,.csv"
      className="sr-only"
      aria-label="选择 XLSX 或 CSV 文件"
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) onPick(f)
        e.target.value = ""
      }}
    />
  )

  if (!file) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="选择文件" desc="实际读取所选 .xlsx（可含多个工作表）或单表 .csv；不执行宏、公式或外部链接。" />
          <div className="flex flex-col gap-3 p-5">
            {hint ? <Notice tone="info">{hint}</Notice> : null}
            {focus ? (
              <Notice tone="neutral">
                按类型导入：本次只默认处理 {focus.map(sheetTitle).join("、")}；文件中其他表会识别并列出，默认不导入。
              </Notice>
            ) : null}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                const f = e.dataTransfer.files?.[0]
                if (f) onPick(f)
              }}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${drag ? "border-primary bg-accent/40" : "border-border bg-muted/30"}`}
            >
              <Upload className="size-7 text-muted-foreground" aria-hidden />
              <p className="text-[14px] font-medium">{loading ? `正在读取「${loading}」…` : "拖放文件到这里，或"}</p>
              {picker}
              <Button disabled={!!loading} onClick={() => input.current?.click()}>
                选择本地文件
              </Button>
              <p className="text-xs text-muted-foreground">支持 .xlsx / .csv · 上限 5 MB · 解析只在本机浏览器内进行</p>
            </div>
            {failure ? (
              <Notice tone="danger" title={`${FAILURE_TITLE[failure.kind]}：${failure.name}`}>
                {failure.message} 没有改用示例，也没有导入任何内容。
                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
                    重新选择文件
                  </Button>
                </div>
              </Notice>
            ) : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="载入示例" desc="独立入口：合成数据，按真实 XLSX 生成后走同一解析" />
          <div className="flex flex-col gap-3 p-5">
            <Select aria-label="选择示例" value={sample} onChange={(e) => setSample(e.target.value)}>
              {SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">{SAMPLES.find((s) => s.id === sample)?.desc}</p>
            <Button variant="outline" disabled={!!loading} onClick={() => onSample(sample)}>
              载入示例
            </Button>
            <p className="text-xs text-muted-foreground">示例不替代你选择的文件；预览中会标注“示例”来源。</p>
          </div>
        </Card>
      </div>
    )
  }

  const recognized = file.sheets.filter((s) => s.code)
  const unknown = file.sheets.filter((s) => !s.code && !s.empty)
  const empty = file.sheets.filter((s) => s.empty && s.code && SHEET[s.code].role !== "meta" && SHEET[s.code].role !== "instruction")
  const blank = file.sheets.filter((s) => !s.code && s.empty)
  const unsupported = file.versionStatus === "unsupported"

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet className="size-4 text-primary" aria-hidden />
            {file.fileName}
            {file.source === "sample" ? <Badge tone="warning">示例文件</Badge> : <Badge tone="success">已读取本地文件</Badge>}
          </span>
        }
        desc={`文件已解析 · ${file.parsedAt} · 内容指纹 ${file.fingerprint}`}
        action={
          <div className="flex gap-2">
            {picker}
            <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
              更换文件
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear}>
              清除
            </Button>
          </div>
        }
      />
      <div className="flex flex-col gap-4 p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] md:grid-cols-3 lg:grid-cols-6">
          {[
            ["文件类型", file.fileType === "xlsx" ? "XLSX 工作簿" : "CSV 单表"],
            ["大小", `${(file.size / 1024).toFixed(1)} KB`],
            ["模板版本", file.version ?? "未声明"],
            ["来源学校", file.sourceSchool ?? "未声明"],
            ["来源期间", file.sourcePeriod ?? "未声明"],
            ["源快照时点", file.snapshotStatus === "ok" ? file.snapshotAt! : file.snapshotStatus === "invalid" ? `格式无法识别：${file.snapshotAt}` : "未声明"],
            ["识别工作表", `${recognized.length} / ${file.sheets.length}`],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        {unsupported ? (
          <Notice tone="danger" title={`未支持的模板版本：${file.version}`}>
            当前原型只支持 WFB-IMPORT-PROTO-1.1。字段含义可能已变化，不按猜测读取。请下载当前模板重新整理后选择文件。
          </Notice>
        ) : file.versionStatus === "missing" ? (
          <Notice tone="warning">文件未声明模板版本（缺少 00_使用说明），将按表名和中文列名识别。</Notice>
        ) : null}

        {completed ? (
          <Notice tone="warning" title={`发现已完成批次：${completed.id}`}>
            该文件内容指纹与此前「{completed.title}」批次一致（{completed.endedAt}，{completed.example ? "示例记录" : "本会话记录"}）。继续预览只会复用与核验差异，不会再新增。
            <button className="ml-2 text-primary hover:underline" onClick={() => onOpenLog(completed.id)}>
              查看该批记录
            </button>
          </Notice>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">文件中的表名</th>
                <th className="px-3 py-2 text-left font-medium">识别为</th>
                <th className="px-3 py-2 text-left font-medium">表头行</th>
                <th className="px-3 py-2 text-left font-medium">数据行</th>
                <th className="px-3 py-2 text-left font-medium">读取结果</th>
              </tr>
            </thead>
            <tbody>
              {file.sheets.map((s) => {
                const role = s.code ? SHEET[s.code].role : null
                const meta = role === "meta" || role === "instruction"
                return (
                  <tr key={s.rawName} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{s.rawName}</td>
                    <td className="px-3 py-2">
                      {s.code ? sheetTitle(s.code) : <span className="text-muted-foreground">未识别</span>}
                      {s.recognizedBy === "header" ? <span className="ml-1 text-xs text-muted-foreground">（按表头）</span> : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{meta || !s.headerLine ? "—" : `第 ${s.headerLine} 行`}</td>
                    <td className="px-3 py-2 tabular-nums">{meta ? "—" : s.rows.length}</td>
                    <td className="px-3 py-2">
                      {meta ? (
                        <Badge>说明/元数据，不导入</Badge>
                      ) : !s.code ? (
                        s.empty ? <Badge>无数据，忽略</Badge> : <Badge tone="warning">未知表含数据，不导入</Badge>
                      ) : s.empty ? (
                        <Badge>空表，不导入</Badge>
                      ) : s.missingRequired.length ? (
                        <Badge tone="danger">缺少必填列</Badge>
                      ) : s.unknownCols.length ? (
                        <Badge tone="warning">含 {s.unknownCols.length} 个未识别列</Badge>
                      ) : (
                        <Badge tone="success">已读取</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {unknown.length ? (
          <Notice tone="warning">
            {unknown.map((s) => `「${s.rawName}」`).join("")}的表名和表头都不属于本模板，含数据但不会导入。
          </Notice>
        ) : null}
        {empty.length || blank.length ? (
          <p className="text-xs text-muted-foreground">
            空表：{[...empty, ...blank].map((s) => s.rawName).join("、")} —— 未填写的表可忽略，不代表删除任何已有数据。
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button disabled={unsupported || recognized.filter((s) => !s.empty).length === 0} onClick={onNext}>
            下一步：内容与依赖
          </Button>
        </div>
      </div>
    </Card>
  )
}
