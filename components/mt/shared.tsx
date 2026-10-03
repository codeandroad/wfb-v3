"use client"

import { Badge } from "@/components/kit"
import {
  ATT_LABEL,
  CLOCK_PRESETS,
  clockLabel,
  TASKS,
  VARIANTS,
  formalTaskName,
  type Attendance,
  type VariantId,
} from "@/lib/mt/model"
import { levelText, type SchemeRev } from "@/lib/mt/schemes"
import { useMt, type SaveEntry } from "@/lib/mt/store"
import { cn } from "@/lib/utils"
import { AlertTriangle, Check, ChevronDown, FlaskConical, Loader2, RotateCcw } from "lucide-react"
import { useState } from "react"

/* ---------------- 保存状态 ---------------- */

export function SaveState({ scope, compact }: { scope: string; compact?: boolean }) {
  const mt = useMt()
  const list = mt.unsettled(scope)
  const saving = list.filter((e) => e.status === "saving")
  const failed = list.filter((e) => e.status !== "saving")
  if (!list.length)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
        <Check className="size-3.5 text-[#256a49]" aria-hidden />
        已保存到模拟存储
      </span>
    )
  if (failed.length)
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-xs text-[#9a2b22]" role="alert">
        <AlertTriangle className="size-3.5" aria-hidden />
        {failed.length} 项未保存{compact ? "" : `：${failed[0].label}（${failed[0].error ?? "失败"}）`}
        <button
          type="button"
          onClick={() => mt.retryScope(scope)}
          className="inline-flex items-center gap-1 rounded-md border border-[#eec4bf] bg-card px-2 py-0.5 font-medium hover:bg-[#fbe6e4]"
        >
          <RotateCcw className="size-3" aria-hidden />
          重试
        </button>
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      保存中（{saving.length}）
    </span>
  )
}

export function FieldMark({ entry }: { entry?: { has: boolean; status?: SaveEntry["status"] } }) {
  if (!entry?.has) return null
  if (entry.status === "saving") return <Loader2 className="size-3 animate-spin text-muted-foreground" aria-label="保存中" />
  return <AlertTriangle className="size-3 text-[#9a2b22]" aria-label="未保存" />
}

/* ---------------- 出勤/评价选择 ---------------- */

const ATT_ORDER: Attendance[] = ["NORMAL", "LATE", "EARLY_LEAVE", "LEAVE", "ABSENT", "ELSEWHERE"]

export function AttSelect({
  value,
  mixed,
  disabled,
  onChange,
  label,
  className,
}: {
  value: Attendance | null
  mixed?: boolean
  disabled?: boolean
  onChange: (v: Attendance) => void
  label: string
  className?: string
}) {
  return (
    <select
      aria-label={label}
      disabled={disabled}
      value={mixed ? "__MIXED" : value ?? ""}
      onChange={(e) => {
        const v = e.target.value
        if (v && v !== "__MIXED") onChange(v as Attendance)
      }}
      className={cn(
        "h-7 rounded-md border border-input bg-card px-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50",
        value && value !== "NORMAL" && !mixed && "border-[#e6d4a8] bg-[#fbf1dd] text-[#8a5a12]",
        !value && !mixed && "text-muted-foreground",
        className,
      )}
    >
      {!value && !mixed ? <option value="">出勤待处理</option> : null}
      {mixed ? <option value="__MIXED">各节不同</option> : null}
      {ATT_ORDER.map((a) => (
        <option key={a} value={a}>
          {ATT_LABEL[a]}
        </option>
      ))}
    </select>
  )
}

export function GradeSelect({
  value,
  handling,
  disabled,
  onChange,
  label,
  className,
  rev,
}: {
  value: string | null
  handling: string
  disabled?: boolean
  onChange: (v: string) => void
  label: string
  className?: string
  /** 对象已绑定或本期有效的评价修订；只显示该修订的等级 */
  rev: SchemeRev | null
}) {
  const cur = handling === "EXPLICIT_EMPTY" ? "EMPTY" : handling === "CONFIRMED" ? value ?? "" : ""
  const orphan = cur && cur !== "EMPTY" && !rev?.levels.some((l) => l.id === cur)
  return (
    <select
      aria-label={label}
      disabled={disabled}
      value={cur}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className={cn(
        "h-7 rounded-md border border-input bg-card px-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50",
        !cur && "text-muted-foreground",
        cur === "EMPTY" && "italic text-muted-foreground",
        className,
      )}
    >
      {!cur ? <option value="">{handling === "NOT_APPLICABLE" ? "不适用" : "评价待处理"}</option> : null}
      {orphan ? (
        <option value={cur} disabled>
          {cur}（标准待核对）
        </option>
      ) : null}
      {(rev?.levels ?? []).map((l) => (
        <option key={l.id} value={l.id} title={l.guide || undefined}>
          {levelText(l)}
        </option>
      ))}
      <option value="EMPTY">明确不评价</option>
    </select>
  )
}

/* ---------------- 原型演示控制（非日常业务） ---------------- */

export function MtDemoBar() {
  const mt = useMt()
  const [open, setOpen] = useState(false)
  const f = mt.faults
  const cur = mt.biz.clock
  return (
    <div className="mb-5 rounded-xl border border-dashed border-[#c4dae2] bg-[#f3f7f9]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs text-[#2a5b6e]"
      >
        <FlaskConical className="size-3.5" aria-hidden />
        <span className="font-semibold">原型演示控制</span>
        <span className="truncate text-[#2a5b6e]/80">
          {VARIANTS.find((v) => v.id === mt.biz.variant)?.label} · 演示时钟 {clockLabel(cur)}
          {f.saveFail || f.storageFail || f.delayMs > 1000 || f.publishLost || f.imageFail ? " · 故障注入中" : ""}
        </span>
        <ChevronDown className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="grid gap-4 border-t border-dashed border-[#c4dae2] px-4 py-3 text-xs md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <p className="font-semibold text-foreground">场景变体（独立命名空间）</p>
            {VARIANTS.map((v) => (
              <label key={v.id} className="flex items-start gap-2">
                <input
                  type="radio"
                  name="mt-variant"
                  checked={mt.biz.variant === v.id}
                  onChange={() => mt.setVariant(v.id as VariantId)}
                  className="mt-0.5"
                />
                <span>
                  {v.label}
                  <span className="block text-muted-foreground">{v.desc}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="font-semibold text-foreground">演示时钟（只前进）</p>
            <select
              aria-label="演示时钟"
              value={cur}
              onChange={(e) => mt.setClock(e.target.value)}
              className="h-8 rounded-md border border-input bg-card px-2"
            >
              {CLOCK_PRESETS.map((c) => (
                <option key={c.iso} value={c.iso} disabled={Date.parse(c.iso) < Date.parse(cur)}>
                  {c.label}
                </option>
              ))}
              {!CLOCK_PRESETS.some((c) => c.iso === cur) ? <option value={cur}>{clockLabel(cur)}</option> : null}
            </select>
            <p className="mt-2 font-semibold text-foreground">名单与权限</p>
            <button type="button" className="mt-0.5 text-left underline-offset-2 hover:underline" onClick={() => mt.applyRosterEvent("G1P1_JOIN_21")}>
              {mt.biz.rosterEvents.includes("G1P1_JOIN_21") ? "已模拟：" : ""}学生21 次日加入 高一1班 P1
            </button>
            <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => mt.applyRosterEvent("G1P1_LEAVE_12")}>
              {mt.biz.rosterEvents.includes("G1P1_LEAVE_12") ? "已模拟：" : ""}学生12 今日后退出 高一1班 P1
            </button>
            <button
              type="button"
              aria-pressed={!!mt.biz.bigDemo}
              data-testid="big-demo-toggle"
              className="text-left underline-offset-2 hover:underline"
              onClick={() => mt.setBigDemo(!mt.biz.bigDemo)}
            >
              {mt.biz.bigDemo ? "已加载大班分页演示（38/72/123 人）· 点击移除" : "加载大班分页演示（38/72/123 人，隔离数据）"}
            </button>
            <select
              aria-label="模拟撤销任务权限"
              value=""
              onChange={(e) => e.target.value && mt.toggleRevoke(e.target.value)}
              className="mt-1 h-8 rounded-md border border-input bg-card px-2"
            >
              <option value="">模拟撤销/恢复任务权限…</option>
              {TASKS.filter((t) => t.teacher_id === "TEACHER_LYNN").map((t) => (
                <option key={t.id} value={t.id}>
                  {mt.biz.revoked.includes(t.id) ? "恢复 " : "撤销 "}
                  {formalTaskName(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="font-semibold text-foreground">故障注入</p>
            {(
              [
                ["saveFail", "保存失败"],
                ["storageFail", "模拟存储写入失败"],
                ["publishLost", "下一次发布响应丢失"],
                ["imageFail", "出图失败"],
                ["loadFail", "刷新后读取失败"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" checked={!!f[k]} onChange={(e) => mt.setFault({ [k]: e.target.checked })} />
                {l}
              </label>
            ))}
            <label className="flex items-center gap-2">
              保存延迟
              <select
                aria-label="保存延迟"
                value={f.delayMs}
                onChange={(e) => mt.setFault({ delayMs: Number(e.target.value) })}
                className="h-7 rounded-md border border-input bg-card px-1"
              >
                <option value={250}>0.25 秒</option>
                <option value={1500}>1.5 秒</option>
                <option value={4000}>4 秒</option>
              </select>
            </label>
            <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => mt.setFault({ slowNextMs: 5000 })}>
              {f.slowNextMs ? "已设置：" : ""}下一次保存慢响应 5 秒（旧响应晚到）
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("仅清除当前变体的原型业务数据（tgs-mt-r3 命名空间），不影响其他浏览器存储。继续？")) mt.resetVariant()
              }}
              className="mt-2 inline-flex w-fit items-center gap-1 rounded-md border border-input bg-card px-2 py-1 font-medium hover:bg-muted"
            >
              <RotateCcw className="size-3" aria-hidden />
              重置当前变体
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function MtLoading() {
  return (
    <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      正在读取模拟存储…
    </div>
  )
}

export function MtLoadError() {
  const mt = useMt()
  return (
    <div role="alert" className="rounded-xl border border-[#eec4bf] bg-[#fbe6e4] px-5 py-6 text-sm text-[#9a2b22]">
      <p className="font-semibold">读取模拟存储失败</p>
      <p className="mt-1">未显示任何缓存或示例替代数据。可重试读取；此失败由原型故障注入产生。</p>
      <button
        type="button"
        onClick={mt.retryLoad}
        className="mt-3 rounded-md border border-[#eec4bf] bg-card px-3 py-1.5 text-xs font-medium hover:bg-[#fff]"
      >
        重试读取
      </button>
    </div>
  )
}

export { Badge }
