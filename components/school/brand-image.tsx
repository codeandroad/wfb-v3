"use client"

import { cn } from "@/lib/utils"
import { ImageOff } from "lucide-react"
import { useState } from "react"

// 学校正式素材在资源缺失时显示中性占位，不自行绘制替代 Logo。
export function BrandImage({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackLabel,
}: {
  src: string
  alt: string
  className?: string
  fallbackClassName?: string
  fallbackLabel?: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span
        role="img"
        aria-label={`${alt}（素材未上传）`}
        title={`素材未上传：${src}`}
        className={cn("flex items-center justify-center gap-1.5 text-[11px]", fallbackClassName)}
      >
        <ImageOff className="size-4 shrink-0 opacity-70" aria-hidden />
        {fallbackLabel ? <span>{fallbackLabel}</span> : null}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  )
}
