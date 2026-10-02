"use client"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { X } from "lucide-react"
import { createPortal } from "react-dom"
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react"

/* ---------------- Card ---------------- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  desc,
  action,
  className,
}: {
  title: ReactNode
  desc?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
        {desc ? <p className="mt-1 text-[13px] text-muted-foreground">{desc}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/* ---------------- Badge / StatusPill ---------------- */

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info"

const toneMap: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-accent text-primary border-primary/20",
  success: "bg-[#e6f2ea] text-[#256a49] border-[#bcdcc8]",
  warning: "bg-[#fbf1dd] text-[#8a5a12] border-[#e6d4a8]",
  danger: "bg-[#fbe6e4] text-[#9a2b22] border-[#eec4bf]",
  info: "bg-[#e5eef2] text-[#2a5b6e] border-[#c4dae2]",
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-none",
        toneMap[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  const c: Record<Tone, string> = {
    neutral: "bg-muted-foreground/60",
    primary: "bg-primary",
    success: "bg-[#2f7d5b]",
    warning: "bg-[#b5791f]",
    danger: "bg-[#b4342a]",
    info: "bg-[#2a5b6e]",
  }
  return <span className={cn("inline-block size-2 rounded-full", c[tone])} aria-hidden="true" />
}

/* ---------------- Segmented ---------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  size?: "sm" | "md"
  ariaLabel?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1",
        size === "sm" && "p-0.5",
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- Tabs ---------------- */

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: ReactNode; badge?: ReactNode }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-border">
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative -mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.badge}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- Form controls ---------------- */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  required,
  className,
}: {
  label: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  required?: boolean
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

const inputBase =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-[14px] text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60"

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return <textarea className={cn(inputBase, "min-h-20 resize-y leading-relaxed", className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, "cursor-pointer pr-8", className)} {...props}>
      {children}
    </select>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  id?: string
}) {
  const autoId = useId()
  const fid = id ?? autoId
  return (
    <label htmlFor={fid} className="flex cursor-pointer items-start gap-2 text-[13px] leading-snug">
      <input
        id={fid}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span>{label}</span>
    </label>
  )
}

/* ---------------- Portal ---------------- */

function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

/* ---------------- Sheet (drawer) ---------------- */

export function Sheet({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  width = "max-w-md",
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  desc?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEscClose(open, onClose)
  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])
  if (!open) return null
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="absolute inset-0 bg-[#21372f]/35 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
        <div
          ref={ref}
          tabIndex={-1}
          className={cn(
            "relative flex h-full w-full flex-col bg-card shadow-2xl outline-none animate-in slide-in-from-right duration-200",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold">{title}</h2>
              {desc ? <p className="mt-0.5 text-[13px] text-muted-foreground">{desc}</p> : null}
            </div>
            <IconButton label="关闭" onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          </div>
          <div className="thin-scroll flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="border-t border-border bg-muted/40 px-5 py-3">{footer}</div> : null}
        </div>
      </div>
    </Portal>
  )
}

/* ---------------- Modal (dialog) ---------------- */

export function Modal({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  desc?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEscClose(open, onClose)
  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])
  if (!open) return null
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-[#21372f]/40" onClick={onClose} aria-hidden="true" />
        <div
          ref={ref}
          tabIndex={-1}
          className={cn(
            "relative flex max-h-[86vh] w-full flex-col overflow-hidden rounded-xl bg-card shadow-2xl outline-none animate-in zoom-in-95 duration-150",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold">{title}</h2>
              {desc ? <p className="mt-0.5 text-[13px] text-muted-foreground">{desc}</p> : null}
            </div>
            <IconButton label="关闭" onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          </div>
          {children ? <div className="thin-scroll flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
          {footer ? <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">{footer}</div> : null}
        </div>
      </div>
    </Portal>
  )
}

function useEscClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
}

/* ---------------- IconButton ---------------- */

export function IconButton({
  children,
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/* ---------------- EmptyState ---------------- */

export function EmptyState({
  icon,
  title,
  desc,
  action,
  tone = "neutral",
}: {
  icon?: ReactNode
  title: ReactNode
  desc?: ReactNode
  action?: ReactNode
  tone?: "neutral" | "warning"
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center",
        tone === "warning" ? "border-[#e6d4a8] bg-[#fbf7ee]" : "border-border bg-muted/30",
      )}
    >
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      {desc ? <p className="mt-1 max-w-md text-[13px] text-muted-foreground">{desc}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/* ---------------- Toast ---------------- */

type Toast = { id: number; msg: string; tone?: Tone }
const ToastCtx = createContext<{ push: (msg: string, tone?: Tone) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = (msg: string, tone: Tone = "primary") => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-[13px] shadow-lg animate-in slide-in-from-bottom-2"
          >
            <Dot tone={t.tone} />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) return { push: () => {} }
  return ctx
}

/* ---------------- LinkButton ---------------- */

export function LinkButton({
  href,
  children,
  variant = "default",
  size = "sm",
  className,
}: {
  href: string
  children: ReactNode
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  size?: "default" | "xs" | "sm" | "lg"
  className?: string
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  )
}

/* ---------------- PageHeader ---------------- */

export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: ReactNode
  desc?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight text-foreground">{title}</h1>
        {desc ? <p className="mt-1 text-[13px] text-muted-foreground">{desc}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
