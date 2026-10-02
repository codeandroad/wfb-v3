import type { ReactNode } from "react"

// r4：TimetableProvider 已上移到 (app)/layout 与「我的教学」共用；此处不再创建第二份课表状态。
export default function TimetableLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
