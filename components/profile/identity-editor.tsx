"use client"

import { useRef, useState } from "react"
import { ImageUp, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/kit"
import { StaffAvatar } from "@/components/profile/staff-avatar"
import { cn } from "@/lib/utils"
import { staffById } from "@/lib/demo/staff"
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  displayOptions,
  useProfile,
  type DisplayStyle,
} from "@/lib/profile/store"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 裁成居中正方形并压缩，便于在会话存储中保存
function toAvatarData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("read"))
    reader.onload = () => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onerror = () => reject(new Error("decode"))
      img.onload = () => {
        const side = Math.min(img.naturalWidth, img.naturalHeight)
        if (!side) return reject(new Error("decode"))
        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = 256
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("decode"))
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, 256, 256)
        ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256)
        resolve(canvas.toDataURL("image/jpeg", 0.86))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

/** 头像：选择 → 预览 → 确认 / 取消；失败或取消时保留原头像 */
export function AvatarEditor({ staffId }: { staffId: string }) {
  const profile = useProfile()
  const { push } = useToast()
  const input = useRef<HTMLInputElement>(null)
  // undefined = 无待确认；string = 新头像；null = 待恢复缺省
  const [pending, setPending] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null)
  const current = profile.avatarOf(staffId)

  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = ""
    if (!file) return
    setError("")
    if (!AVATAR_TYPES.includes(file.type)) {
      setError(file.type === "image/gif" ? "不支持 GIF 或动态头像，请选择 JPG、PNG 或 WebP 静态图片。" : "文件格式不支持，请选择 JPG、PNG 或 WebP 图片。")
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError(`图片为 ${(file.size / 1024 / 1024).toFixed(1)} MB，超过 2 MB 上限，请压缩后再选择。`)
      return
    }
    setBusy("reading")
    try {
      setPending(await toAvatarData(file))
    } catch {
      setError("图片读取失败，文件可能已损坏。原头像未改变。")
    } finally {
      setBusy(null)
    }
  }

  const confirm = async () => {
    if (pending === undefined || busy) return
    setBusy("saving")
    setError("")
    await sleep(500)
    const r = profile.setAvatar(staffId, staffId, pending)
    setBusy(null)
    if (r.ok) {
      push(pending === null ? "已恢复缺省头像" : "头像已更新（原型：仅保存在当前浏览器会话）")
      setPending(undefined)
    } else setError(`${r.message} 原头像未改变。`)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <StaffAvatar staffId={staffId} size="lg" src={pending} />
        <div className="flex min-w-0 flex-col gap-2">
          {pending === undefined ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy !== null}>
                {busy === "reading" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ImageUp className="size-3.5" aria-hidden />}
                {current ? "更换头像" : "上传头像"}
              </Button>
              {current ? (
                <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
                  <RotateCcw className="size-3.5" aria-hidden />
                  恢复缺省
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{pending === null ? "将恢复为缺省头像" : "预览：待使用的新头像"}</span>
              <Button size="sm" onClick={confirm} disabled={busy !== null}>
                {busy === "saving" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                {busy === "saving" ? "保存中" : "确认使用"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setPending(undefined); setError("") }} disabled={busy !== null}>
                取消
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">JPG / PNG / WebP 静态图片，不超过 2 MB，将裁成正方形。</p>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={AVATAR_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label="选择头像图片"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {error ? (
        <p role="alert" className="text-xs leading-relaxed text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** 主页显示名：只能在档案已有姓名的组合中选择，不改正式姓名 */
export function DisplayNameEditor({ staffId }: { staffId: string }) {
  const profile = useProfile()
  const { push } = useToast()
  const me = staffById(staffId)
  const saved: DisplayStyle = profile.identityOf(staffId).displayStyle ?? "formal"
  const [choice, setChoice] = useState<DisplayStyle>(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  if (!me) return null
  const options = displayOptions(me)

  const save = async (style: DisplayStyle) => {
    setSaving(true)
    setError("")
    await sleep(400)
    const r = profile.setDisplayStyle(staffId, staffId, style)
    setSaving(false)
    if (r.ok) push(style === "formal" ? "已恢复默认显示名" : "主页显示名已更新")
    else setError(`${r.message} 显示名未改变。`)
  }

  return (
    <div className="flex flex-col gap-2">
      <fieldset className="flex flex-col gap-1.5" disabled={saving}>
        <legend className="sr-only">主页显示名</legend>
        {options.map((o) => (
          <label
            key={o.style}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
              choice === o.style ? "border-primary bg-accent" : "border-border hover:bg-muted/50",
            )}
          >
            <input
              type="radio"
              name={`display-${staffId}`}
              checked={choice === o.style}
              onChange={() => setChoice(o.style)}
              className="accent-primary"
            />
            <span className="font-medium">{o.label}</span>
            {o.style === "formal" ? <span className="text-xs text-muted-foreground">默认 · 正式姓名</span> : null}
          </label>
        ))}
      </fieldset>
      {options.length === 1 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          档案中暂无英文名或常用名，显示名使用正式姓名。如需补充，请联系学校管理员维护档案。
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          仅能从档案中的姓名组合选择。修改只影响主页和留言中的显示，不改正式姓名、编号或登录账号。
        </p>
      )}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {options.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => save(choice)} disabled={saving || choice === saved}>
            {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {saving ? "保存中" : "保存显示名"}
          </Button>
          {saved !== "formal" ? (
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => { setChoice("formal"); save("formal") }}>
              恢复默认
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
