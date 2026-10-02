"use client"

import { Badge, Card } from "@/components/kit"
import { SaveState } from "@/components/mt/shared"
import { Btn, inputCls } from "@/components/mt/ui"
import { clockLabel, type PlanItem, type STask } from "@/lib/mt/model"
import { scopeTask, useMt, usePlanWriter } from "@/lib/mt/store"
import { Download, Plus, Trash2, Upload } from "lucide-react"
import { useState } from "react"

/** 解析本地文本：“# 主题”开始一条，“- ”为内容点，“课时: n”“目标:”“资源:”“备注:” */
export function parsePlanText(src: string): PlanItem[] {
  const trimmed = src.trim()
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const j = JSON.parse(trimmed)
    const arr = Array.isArray(j) ? j : j.items
    return arr.map((x: Partial<PlanItem>, i: number) => ({
      id: `IMP_${Date.now()}_${i}`,
      title: String(x.title ?? ""),
      points: Array.isArray(x.points) ? x.points.map(String) : [],
      estimatedLessons: x.estimatedLessons ?? null,
      objectives: x.objectives ?? "",
      resources: x.resources ?? "",
      notes: x.notes ?? "",
    }))
  }
  const out: PlanItem[] = []
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const cur = out[out.length - 1]
    if (line.startsWith("#")) out.push({ id: `IMP_${Date.now()}_${out.length}`, title: line.replace(/^#+\s*/, ""), points: [], estimatedLessons: null, objectives: "", resources: "", notes: "" })
    else if (!cur) continue
    else if (/^[-*•]\s*/.test(line)) cur.points.push(line.replace(/^[-*•]\s*/, ""))
    else if (/^课时[:：]/.test(line)) cur.estimatedLessons = Number(line.replace(/^课时[:：]\s*/, "")) || null
    else if (/^目标[:：]/.test(line)) cur.objectives = line.replace(/^目标[:：]\s*/, "")
    else if (/^资源[:：]/.test(line)) cur.resources = line.replace(/^资源[:：]\s*/, "")
    else if (/^备注[:：]/.test(line)) cur.notes = line.replace(/^备注[:：]\s*/, "")
    else cur.points.push(line)
  }
  return out
}

export function PlanPanel({ task }: { task: STask }) {
  const mt = useMt()
  const write = usePlanWriter()
  const plan = mt.biz.plans[task.id]
  const [items, setItems] = useState<PlanItem[]>(plan?.items ?? [])
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState("")
  const upd = (i: number, patch: Partial<PlanItem>) => {
    setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
    setDirty(true)
  }
  const invalid = items.some((x) => !x.title.trim())

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={plan?.state === "ADOPTED" ? "success" : "neutral"}>{plan ? (plan.state === "ADOPTED" ? "已采用" : "草稿") : "尚无计划"}</Badge>
        <span className="text-xs text-muted-foreground">计划与推算进度是建议，不是已教事实；采用不会改写已发生课堂记录。</span>
        <span className="ml-auto flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-card px-3.5 text-sm font-medium hover:bg-muted">
            <Upload className="size-3.5" aria-hidden />
            导入
            <input
              type="file"
              accept=".txt,.md,.json,.csv"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  const parsed = parsePlanText(await f.text())
                  if (!parsed.length) return setMsg("文件中没有可识别的条目（每条以“# 主题”开始）")
                  setItems(parsed)
                  setDirty(true)
                  setMsg(`已解析 ${parsed.length} 条，核对后保存。`)
                } catch {
                  setMsg("解析失败：文件格式不正确")
                }
                e.target.value = ""
              }}
            />
          </label>
          <Btn
            onClick={() => {
              const text = items
                .map((x) =>
                  [`# ${x.title}`, ...x.points.map((p) => `- ${p}`), x.estimatedLessons ? `课时: ${x.estimatedLessons}` : "", x.objectives ? `目标: ${x.objectives}` : "", x.resources ? `资源: ${x.resources}` : "", x.notes ? `备注: ${x.notes}` : ""]
                    .filter(Boolean)
                    .join("\n"),
                )
                .join("\n\n")
              const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }))
              const a = document.createElement("a")
              a.href = url
              a.download = `${task.id}-教学计划.txt`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            <Download className="size-3.5" aria-hidden />
            导出
          </Btn>
          <Btn disabled={!dirty || invalid} onClick={() => (write(task.id, items, "保存草稿"), setDirty(false))}>
            保存
          </Btn>
          <Btn variant="primary" disabled={invalid || !items.length} onClick={() => (write(task.id, items, "采用", "ADOPTED"), setDirty(false))}>
            采用
          </Btn>
        </span>
      </div>
      {msg ? <p className="text-xs text-primary">{msg}</p> : null}
      <SaveState scope={scopeTask(task.id)} compact />
      {dirty ? <p className="text-xs text-[#8a5a12]">有尚未保存的计划修改</p> : null}

      <ol className="flex flex-col gap-2">
        {items.map((x, i) => (
          <li key={x.id}>
            <Card className="flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                <input aria-label="教学主题" className={inputCls} value={x.title} placeholder="教学主题（必填）" onChange={(e) => upd(i, { title: e.target.value })} />
                <input
                  aria-label="预计课时"
                  type="number"
                  min={0}
                  className="h-8 w-20 rounded-lg border border-input bg-card px-2 text-sm"
                  placeholder="课时"
                  value={x.estimatedLessons ?? ""}
                  onChange={(e) => upd(i, { estimatedLessons: e.target.value ? Number(e.target.value) : null })}
                />
                <Btn size="sm" variant="ghost" aria-label="删除条目" onClick={() => (setItems(items.filter((_, j) => j !== i)), setDirty(true))}>
                  <Trash2 className="size-3.5" aria-hidden />
                </Btn>
              </div>
              <textarea
                aria-label="内容点（每行一条）"
                rows={2}
                className={inputCls}
                placeholder="内容点，每行一条"
                value={x.points.join("\n")}
                onChange={(e) => upd(i, { points: e.target.value.split("\n") })}
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <input aria-label="目标（可选）" className={inputCls} placeholder="目标（可选）" value={x.objectives} onChange={(e) => upd(i, { objectives: e.target.value })} />
                <input aria-label="资源（可选）" className={inputCls} placeholder="资源（可选）" value={x.resources} onChange={(e) => upd(i, { resources: e.target.value })} />
                <input aria-label="备注（可选）" className={inputCls} placeholder="备注（可选）" value={x.notes} onChange={(e) => upd(i, { notes: e.target.value })} />
              </div>
            </Card>
          </li>
        ))}
      </ol>
      <Btn
        className="self-start"
        onClick={() => {
          setItems([...items, { id: `NEW_${Date.now()}`, title: "", points: [], estimatedLessons: null, objectives: "", resources: "", notes: "" }])
          setDirty(true)
        }}
      >
        <Plus className="size-3.5" aria-hidden />
        添加条目
      </Btn>
      {plan?.history.length ? (
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground">历史</p>
          <ul>
            {plan.history.map((h, i) => (
              <li key={i}>
                {clockLabel(h.at)} · {h.action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
