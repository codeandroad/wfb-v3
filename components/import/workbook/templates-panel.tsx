"use client"

import { Badge, Card, CardHeader } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { SAMPLES } from "@/lib/import/samples"
import { dependsOn, PRESETS, SHEET, sheetTitle, TEMPLATE_VERSION, type SheetCode } from "@/lib/import/schema"
import { buildCsvTemplate, buildTemplateBytes, downloadBytes } from "@/lib/import/workbook-out"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Notice } from "./shared"
import { sampleBuffer } from "./workbook-flow"

export function TemplatesPanel({ initialPreset, onUseSample }: { initialPreset?: string; onUseSample: (id: string) => void }) {
  const [presetId, setPresetId] = useState(initialPreset ?? PRESETS[2].id)
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]
  const [open, setOpen] = useState<SheetCode | null>(null)
  const sampleId = presetId === "full" ? "full" : presetId === "teaching" ? "teaching" : presetId === "family" ? "family" : presetId === "timetable" ? "timetable" : presetId === "people-base" ? "people-first" : null
  const outside = [...new Set(preset.sheets.flatMap(dependsOn))].filter((d) => !preset.sheets.includes(d))

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <nav aria-label="数据分类" className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPresetId(p.id)}
            className={cn(
              "flex flex-col items-start gap-0.5 whitespace-nowrap rounded-lg px-3 py-2 text-left transition-colors lg:whitespace-normal",
              p.id === presetId ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className="text-[13px] font-medium">{p.label}</span>
            <span className="hidden text-xs lg:block">{p.desc}</span>
          </button>
        ))}
      </nav>

      <Card>
        <CardHeader
          title={`${preset.label} · ${preset.sheets.length} 张工作表`}
          desc={`原型模板 ${TEMPLATE_VERSION}：按字段设计草案生成，不是已适配正式后台的模板`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => downloadBytes(buildTemplateBytes(preset.sheets), `空白模板_${preset.label}.xlsx`)}>
                下载空白模板结构
              </Button>
              {sampleId ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => downloadBytes(sampleBuffer(sampleId), SAMPLES.find((s) => s.id === sampleId)!.fileName)}>
                    下载合成示例
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onUseSample(sampleId)}>
                    使用示例预览
                  </Button>
                </>
              ) : null}
            </div>
          }
        />
        <div className="flex flex-col gap-4 p-5">
          <Notice tone="neutral">
            XLSX 可含多个工作表，未填写的表可忽略；CSV 只能放单一类型（表名按文件名识别）。日期写 YYYY-MM-DD；编号、电话按文本保存前导零。选项和元数据不是授权，资格与任命需按学校合法办理。
          </Notice>
          {outside.length ? (
            <Notice tone="info">
              本组引用 {outside.map(sheetTitle).join("、")}：不必同批上传，可引用目标学校已有对象（待匹配）。
              {preset.sheets.includes("23") ? " 任教安排依赖员工、任职资格与真实教学目标（教学班或分工）。" : ""}
            </Notice>
          ) : null}

          <ul className="flex flex-col gap-2">
            {preset.sheets.map((code) => {
              const def = SHEET[code]
              const isOpen = open === code
              return (
                <li key={code} className="rounded-lg border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <button className="flex flex-col items-start text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : code)}>
                      <span className="text-[13px] font-medium">{sheetTitle(code)}</span>
                      <span className="text-xs text-muted-foreground">{def.guard}</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge>{def.fields.length} 列</Badge>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => downloadBytes(buildCsvTemplate(code), `${sheetTitle(code)}.csv`)}>
                        CSV 表头
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(isOpen ? null : code)}>
                        {isOpen ? "收起字段" : "仅查看字段"}
                      </Button>
                    </div>
                  </div>
                  {isOpen ? (
                    <div className="overflow-x-auto border-t border-border">
                      <table className="w-full min-w-[560px] text-[13px]">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">中文列名</th>
                            <th className="px-4 py-2 text-left font-medium">必填</th>
                            <th className="px-4 py-2 text-left font-medium">引用</th>
                            <th className="px-4 py-2 text-left font-medium">可选项 / 说明</th>
                          </tr>
                        </thead>
                        <tbody>
                          {def.fields.map((f) => (
                            <tr key={f.key} className="border-t border-border">
                              <td className="px-4 py-1.5">{f.label}</td>
                              <td className="px-4 py-1.5">{f.required ? "*" : ""}</td>
                              <td className="px-4 py-1.5 text-muted-foreground">{f.ref ? sheetTitle(f.ref) : "—"}</td>
                              <td className="px-4 py-1.5 text-xs text-muted-foreground">
                                {f.options?.join(" / ") ?? (f.kind === "date" ? "YYYY-MM-DD" : f.kind === "personNo" ? "留空＝自动编号" : f.kind === "phone" ? "文本" : "")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      </Card>
    </div>
  )
}
