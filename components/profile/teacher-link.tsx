"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { homepageEligible, staffIdForTeacher, useProfile } from "@/lib/profile/store"

// 教师姓名 → 教师主页。只有具备教师主页的教职工才显示为链接；能否查看由主页按当前权限判定。
export function TeacherLink({
  staffId,
  teacherId,
  children,
  className,
}: {
  staffId?: string
  teacherId?: string
  children?: ReactNode
  className?: string
}) {
  const profile = useProfile()
  const id = staffId ?? (teacherId ? staffIdForTeacher(teacherId) : undefined)
  const label = children ?? (id ? profile.displayNameOf(id) : null)
  if (!id || !homepageEligible(id)) return <span className={className}>{label}</span>
  return (
    <Link
      href={`/people/${id}`}
      className={
        className ??
        "font-medium text-foreground underline decoration-border underline-offset-2 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      }
    >
      {label}
    </Link>
  )
}
