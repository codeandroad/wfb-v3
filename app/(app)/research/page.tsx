import type { Metadata } from "next"
import { Suspense } from "react"
import { ResearchWorkspace } from "@/components/research/workspace"

export const metadata: Metadata = { title: "我的教研 · 周反馈系统", description: "科组课程共建、个人教学资料与教研协作原型" }
export default function Page() {
  return <Suspense fallback={<p className="p-6">正在读取教研工作区…</p>}><ResearchWorkspace /></Suspense>
}
