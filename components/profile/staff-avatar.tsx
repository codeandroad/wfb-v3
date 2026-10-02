"use client"

import { cn } from "@/lib/utils"
import { staffById } from "@/lib/demo/staff"
import { useProfile } from "@/lib/profile/store"

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-20 text-2xl",
} as const

// 统一的头像来源：自定义头像优先，否则显示姓名首字缺省头像
export function StaffAvatar({
  staffId,
  size = "sm",
  src,
  className,
}: {
  staffId: string
  size?: keyof typeof SIZES
  src?: string | null // 预览待使用的头像；null 表示预览“恢复缺省”
  className?: string
}) {
  const profile = useProfile()
  const url = src === null ? undefined : (src ?? profile.avatarOf(staffId))
  const initial = (staffById(staffId)?.name ?? "?").replace(/^示例/, "").slice(0, 1)
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-primary-foreground",
        SIZES[size],
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- 本地数据 URL 与静态示例图，无需优化管线
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        initial
      )}
    </span>
  )
}
