export type ImportStep = "upload" | "review" | "done"

const STEPS: { id: ImportStep; label: string }[] = [
  { id: "upload", label: "选择文件" },
  { id: "review", label: "校验预览" },
  { id: "done", label: "完成导入" },
]

export function ImportStepper({ step }: { step: ImportStep }) {
  const current = STEPS.findIndex((s) => s.id === step)
  return (
    <ol className="mb-5 flex items-center gap-2 text-[13px]" aria-label="导入步骤">
      {STEPS.map((s, i) => {
        const active = i === current
        const passed = i < current
        return (
          <li key={s.id} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                active ? "bg-primary text-primary-foreground" : passed ? "bg-[#2f7d5b] text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span className={active ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            {i < STEPS.length - 1 ? <span className="mx-1 h-px w-6 bg-border" /> : null}
          </li>
        )
      })}
    </ol>
  )
}
