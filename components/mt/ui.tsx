"use client"

import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react"

export function Btn({
  variant = "outline",
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" | "danger"; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "outline" && "border border-input bg-card hover:bg-muted",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "danger" && "border border-[#eec4bf] bg-card text-[#9a2b22] hover:bg-[#fbe6e4]",
        className,
      )}
    />
  )
}

/** 只关闭最上层的对话框 / 抽屉，避免一次 Esc 同时关掉多层 */
const escStack: { current: () => void }[] = []
let escBound = false
export function useEsc(onClose: () => void) {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    if (!escBound && typeof window !== "undefined") {
      escBound = true
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && escStack.length) escStack[escStack.length - 1].current()
      })
    }
    escStack.push(ref)
    return () => {
      const i = escStack.lastIndexOf(ref)
      if (i >= 0) escStack.splice(i, 1)
    }
  }, [])
}

export function Modal({
  title,
  desc,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  desc?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const id = useId()
  useEsc(onClose)
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={cn("flex max-h-[88vh] w-full flex-col rounded-xl border border-border bg-card shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id={id} className="text-base font-semibold">
              {title}
            </h2>
            {desc ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer> : null}
      </div>
    </div>
  )
}

export function Drawer({
  label,
  onClose,
  header,
  children,
}: {
  label: string
  onClose: () => void
  header: ReactNode
  children: ReactNode
}) {
  useEsc(onClose)
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={label} className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl">
        <header className="border-b border-border bg-card px-5 py-3">{header}</header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  )
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * 文本自动保存：本地输入立即显示，停顿后提交；卸载时把尚未提交的输入按发起时绑定的目标提交。
 */
export function useAutoText(initial: string, commit: (v: string) => void, delay = 700) {
  const [value, setValue] = useState(initial)
  const latest = useRef(initial)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commitRef = useRef(commit)
  commitRef.current = commit

  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (dirty.current) {
      dirty.current = false
      commitRef.current(latest.current)
    }
  }
  useEffect(() => () => flush(), [])

  const onChange = (v: string) => {
    setValue(v)
    latest.current = v
    dirty.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, delay)
  }
  const set = (v: string) => {
    onChange(v)
    flush()
  }
  return { value, onChange, flush, set }
}

export const inputCls =
  "w-full rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
