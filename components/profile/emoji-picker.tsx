"use client"

import { useEffect, useRef, useState } from "react"
import { Smile } from "lucide-react"
import { cn } from "@/lib/utils"

// 内置标准 Unicode emoji（以文本字符插入，不是图片）
const GROUPS: { label: string; items: string[] }[] = [
  { label: "表情", items: ["😀", "😄", "😊", "🙂", "😉", "😂", "🤔", "😅", "😮", "😌", "🥲", "😎"] },
  { label: "手势", items: ["👍", "👏", "🙌", "🙏", "💪", "👌", "✌️", "🤝", "👋", "☝️"] },
  { label: "学习与工作", items: ["📚", "📖", "✏️", "📝", "📊", "📌", "💡", "🔬", "🧪", "🧮", "🎓", "⏰"] },
  { label: "心情与庆祝", items: ["❤️", "✨", "🎉", "🌟", "🔥", "✅", "💯", "🌱", "☕", "🍀"] },
]

export function EmojiPicker({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="插入 emoji"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
      >
        <Smile className="size-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="选择 emoji"
          className="absolute bottom-full left-0 z-30 mb-1.5 w-72 rounded-xl border border-border bg-card p-2 shadow-lg"
        >
          <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
            {GROUPS.map((g) => (
              <div key={g.label}>
                <p className="px-1 pb-1 text-[11px] text-muted-foreground">{g.label}</p>
                <div className="grid grid-cols-8 gap-0.5">
                  {g.items.map((e) => (
                    <button
                      key={e}
                      type="button"
                      aria-label={`插入 ${e}`}
                      // 阻止按下时夺走输入框焦点，以便保留光标位置并可连续插入
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => onPick(e)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 border-t border-border px-1 pt-1.5 text-[11px] text-muted-foreground">
            可连续选择，选择后不会自动发表。
          </p>
        </div>
      ) : null}
    </div>
  )
}
