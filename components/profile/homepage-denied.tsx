"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import type { DenyReason } from "@/lib/profile/store"

const COPY: Record<DenyReason, { title: string; desc: string }> = {
  not_staff: {
    title: "教师主页仅对本校教职工开放",
    desc: "当前身份不是本校在职教职工，无法查看教师主页。如需与老师沟通，请使用学校提供的家校沟通方式。",
  },
  invalid_staff: {
    title: "当前账号不能访问教师主页",
    desc: "你的账号已停用或已不在本校任职。如有疑问，请联系学校管理员。",
  },
  not_found: {
    title: "该教师主页不可用",
    desc: "链接对应的主页不存在或已不可用。",
  },
  no_homepage: {
    title: "该教师主页不可用",
    desc: "该教职工当前没有可访问的教师主页。",
  },
  private: {
    title: "该教师主页当前不对你开放",
    desc: "主页主人已设为仅自己可见。主页内容与留言不会展示，也不能留言。",
  },
}

export function HomepageDenied({ reason, isParent }: { reason: DenyReason; isParent?: boolean }) {
  const c = COPY[reason]
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock className="size-5" aria-hidden />
      </span>
      <h1 className="text-balance text-lg font-semibold">{c.title}</h1>
      <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">{c.desc}</p>
      <Link href={isParent ? "/parent" : "/"} className={buttonVariants({ variant: "outline", size: "sm" })}>
        {isParent ? "返回家长首页" : "返回工作台"}
      </Link>
    </div>
  )
}
