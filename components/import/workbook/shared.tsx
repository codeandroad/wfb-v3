import { Badge } from "@/components/kit"
import type { Level, RowStatus } from "@/lib/import/validate"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export const LEVEL_LABEL: Record<Level, string> = { block: "阻断", pending: "待核验", warn: "提醒" }
const LEVEL_TONE = { block: "danger", pending: "info", warn: "warning" } as const

export function LevelBadge({ level }: { level: Level }) {
  return <Badge tone={LEVEL_TONE[level]}>{LEVEL_LABEL[level]}</Badge>
}

const ROW_LABEL: Record<RowStatus, string> = { block: "阻断", pending: "待核验", warn: "提醒", ok: "可处理", excluded: "不导入" }
const ROW_TONE = { block: "danger", pending: "info", warn: "warning", ok: "success", excluded: "neutral" } as const

export function RowStatusBadge({ status }: { status: RowStatus }) {
  return <Badge tone={ROW_TONE[status]}>{ROW_LABEL[status]}</Badge>
}

export function Stat({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: "danger" | "warning" | "info" | "success"; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-card px-3.5 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-xl font-semibold tabular-nums leading-tight",
          tone === "danger" && "text-[#9a2b22]",
          tone === "warning" && "text-[#8a5a12]",
          tone === "info" && "text-[#2a5b6e]",
          tone === "success" && "text-[#256a49]",
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "danger" | "success" | "neutral"; title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed",
        tone === "info" && "border-[#c4dae2] bg-[#eef4f6] text-[#234b5a]",
        tone === "warning" && "border-[#e6d4a8] bg-[#fbf5e8] text-[#6f4a10]",
        tone === "danger" && "border-[#eec4bf] bg-[#fbeeec] text-[#7d231c]",
        tone === "success" && "border-[#bcdcc8] bg-[#eef6f1] text-[#1f5a3d]",
        tone === "neutral" && "border-border bg-muted/40 text-foreground",
        className,
      )}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title && "mt-0.5")}>{children}</div> : null}
    </div>
  )
}

export function ExampleTag({ children = "结果示例" }: { children?: ReactNode }) {
  return <Badge tone="warning">{children}</Badge>
}

export function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[13px]" aria-label="导入步骤">
      {steps.map((s, i) => {
        const active = i === current
        const passed = i < current
        return (
          <li key={s} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                active ? "bg-primary text-primary-foreground" : passed ? "bg-[#2f7d5b] text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span className={active ? "font-medium" : "text-muted-foreground"}>{s}</span>
            {i < steps.length - 1 ? <span className="mx-1 h-px w-6 bg-border" /> : null}
          </li>
        )
      })}
    </ol>
  )
}
