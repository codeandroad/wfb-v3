import { SchemeSettings } from "@/components/mt/scheme-settings"
import { Suspense } from "react"

export const metadata = { title: "教学设置 · 评价方案" }

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SchemeSettings />
    </Suspense>
  )
}
