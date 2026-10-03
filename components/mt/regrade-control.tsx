"use client"

import { useState } from "react"
import { Btn } from "./ui"
import { useMt, scopeTask } from "@/lib/mt/store"
import { useTeacherId } from "@/lib/mt/derive"
import { generationOf, regrade, regradeImpact, regradeKey, type RegradeTarget } from "@/lib/mt/regrading"
import { mySchemes } from "@/lib/mt/scheme-ops"
import { latestRev, revById, SYSTEM_SCHEMES } from "@/lib/mt/schemes"

export function RegradeControl({ target, currentRev, label }: { target: RegradeTarget; currentRev: string | null; label: string }) {
  const mt = useMt()
  const teacherId = useTeacherId()
  const [pick, setPick] = useState(currentRev ?? "")
  const [confirm, setConfirm] = useState<{ token: string; generation: number; stamp: number } | null>(null)
  const [message, setMessage] = useState("")
  if (!teacherId) return null
  const candidates = [...SYSTEM_SCHEMES, ...mySchemes(mt.biz.schemes, teacherId).filter(s => !s.archived)].map(s => s.owner === "SYSTEM" ? revById(s.revIds.at(-1)) : latestRev(mt.biz.schemes, s.id)).filter(r => !!r)
  const count = regradeImpact(mt.biz, target)
  const busy = mt.unsettled(scopeTask(target.taskId)).length > 0
  const submit = (request: NonNullable<typeof confirm>) => {
    if (busy) { setMessage("请先完成或处理当前未保存输入，再更换方案。"); return }
    const result = mt.command("立即采用并重新评价", s => s.stamp !== request.stamp ? { error: "确认期间数据已变化，请核对最新结果后重试" } : regrade(s, teacherId, target, pick, request.generation, request.token))
    setMessage(result.ok ? "新方案已立即采用，未自动填入任何等级。保留文字若引用旧等级，请人工核对。" : result.error)
    setConfirm(null)
  }
  return <section className="flex flex-col gap-3 rounded-lg border border-border p-3" aria-label="当前对象立即重评">
    <p className="text-sm font-medium">{label} · {target.kind === "CLASSROOM" ? `第 ${target.week} 周整个周期` : "整份作业"}</p>
    <p className="text-sm text-muted-foreground">当前：{revById(currentRev)?.name ?? "待核对"} · 评价代次 {generationOf(mt.biz, target)}</p>
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="立即采用方案" value={pick} onChange={e => { setPick(e.target.value); setConfirm(null); setMessage("") }} className="h-9 rounded border border-input bg-card px-2 text-sm">
        <option value="" disabled>选择方案</option>
        {candidates.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <Btn disabled={busy || !pick || pick === currentRev} onClick={() => {
        const request = { token: crypto.randomUUID(), generation: generationOf(mt.biz, target), stamp: mt.biz.stamp }
        if (count) setConfirm(request); else submit(request)
      }}>立即采用并重新评价</Btn>
    </div>
    {confirm ? <div role="alert" className="flex flex-col gap-2 text-sm">
      <p>{label}：将「{revById(currentRev)?.name}」改为「{revById(pick)?.name}」，重置 {count} 条评价等级／确认。范围不受搜索、分页或勾选限制。</p>
      <p>{target.kind === "CLASSROOM" ? "仅清本任务整个周期的课堂等级与评价确认；保留考勤、作业、亮点、备注与已发布历史。" : "仅清这份作业的质量等级与确认；保留提交、迟交、免做、截止、原始数字分数（含0）、备注与发布历史。"}</p>
      <div className="flex gap-2"><Btn onClick={() => submit(confirm)}>确认重置并采用</Btn><Btn onClick={() => setConfirm(null)}>取消</Btn></div>
    </div> : null}
    {busy ? <p className="text-sm">请先处理当前未保存输入。</p> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    <details className="text-sm"><summary>本对象方案更换历史</summary>{(mt.biz.regradeHistory ?? []).filter(h => h.key === regradeKey(target)).map(h => <p key={h.token}>{h.at} · {revById(h.from)?.name} → {revById(h.to)?.name} · 第 {h.generation} 代（旧评价仅留档）</p>)}</details>
  </section>
}
