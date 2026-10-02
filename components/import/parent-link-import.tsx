"use client"

import { Badge, Card, CardHeader, Dot, useToast } from "@/components/kit"
import { STUDENTS } from "@/lib/demo/data"
import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react"
import { useState } from "react"
import { ImportStepper, type ImportStep } from "./import-stepper"

export function ParentLinkImport() {
  const { push } = useToast()
  const [step, setStep] = useState<ImportStep>("upload")

  const rows = STUDENTS.map((s) => ({
    name: s.name,
    homeroom: s.homeroom,
    parent: s.parentContactMissing ? "" : `示例家长 · 138****${s.id.slice(1)}00`,
    note: s.asOnly ? "仅修 AS" : "",
  }))
  const missingContact = STUDENTS.filter((s) => s.parentContactMissing).length

  return (
    <div>
      <ImportStepper step={step} />

      {step === "upload" ? (
        <Card>
          <CardHeader title="选择数据文件" desc="为已有学生建立家长关联。支持 .xlsx / .csv。此原型使用内置示例文件。" />
          <div className="p-5">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-muted/30 px-6 py-12 text-center">
              <Upload className="mb-3 size-7 text-muted-foreground" />
              <p className="text-[14px] font-medium">拖拽文件到此处，或选择示例文件</p>
              <p className="mt-1 text-[13px] text-muted-foreground">示例：高一年级_学生家长关联.xlsx（22 行）</p>
              <button
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"
                onClick={() => setStep("review")}
              >
                <FileSpreadsheet className="size-4" />
                载入示例文件
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {step === "review" ? (
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title="校验结果"
              desc="导入前逐行校验，区分阻断错误与提醒；提醒不阻塞导入。"
              action={<Badge tone="success">{STUDENTS.length} 行 · 0 处错误</Badge>}
            />
            <div className="flex flex-col gap-2.5 px-5 py-4 text-[13px]">
              <Row tone="success" text={`成功解析 ${STUDENTS.length} 名学生，归属 高一1班（12）/ 高一2班（10）。`} />
              <Row tone="warning" text={`${missingContact} 名学生缺少家长联系方式（示例学生12）：可导入，发布反馈时需手动转达。`} />
              <Row tone="info" text="1 名学生标记为“仅修 AS”（示例学生21）：分层不影响任教关系，仍随班上课。" />
            </div>
          </Card>

          <Card>
            <CardHeader title="数据预览" desc="确认无误后提交导入。" />
            <div className="thin-scroll max-h-80 overflow-auto">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead className="sticky top-0 bg-muted/70 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">学生</th>
                    <th className="px-4 py-2 font-medium">主班</th>
                    <th className="px-4 py-2 font-medium">家长联系</th>
                    <th className="px-4 py-2 font-medium">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{r.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.homeroom}</td>
                      <td className="px-4 py-2">
                        {r.parent ? <span className="text-muted-foreground">{r.parent}</span> : <Badge tone="warning">缺失</Badge>}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{r.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted"
                onClick={() => setStep("upload")}
              >
                返回
              </button>
              <button
                className="rounded-lg bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground"
                onClick={() => {
                  setStep("done")
                  push("示例数据导入完成（未写入真实系统）")
                }}
              >
                确认导入 {STUDENTS.length} 行
              </button>
            </div>
          </Card>
        </div>
      ) : null}

      {step === "done" ? (
        <Card>
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-[#e6f2ea]">
              <CheckCircle2 className="size-6 text-[#2f7d5b]" />
            </div>
            <p className="text-[15px] font-semibold">导入完成</p>
            <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
              已导入 {STUDENTS.length} 名学生与家长关联（示例）。缺失联系方式的记录已保留并标记，供发布时手动转达。
            </p>
            <button
              className="mt-4 rounded-lg border border-border px-4 py-2 text-[13px] font-medium hover:bg-muted"
              onClick={() => setStep("upload")}
            >
              再次导入
            </button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}

function Row({ tone, text }: { tone: "success" | "warning" | "info"; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1.5">
        <Dot tone={tone} />
      </span>
      <span className="text-foreground/90">{text}</span>
    </div>
  )
}
