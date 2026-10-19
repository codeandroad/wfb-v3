"use client"

import { useState } from "react"
import { ArrowLeft, RotateCcw } from "lucide-react"
import { Badge, LinkButton, PageHeader } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { WeekGrid } from "./week-grid"
import { CardDetail } from "./detail"
import { MATH_QA_DEMO_DATE, MATH_QA_DEMO_ENTRIES, MATH_QA_DEMO_WEEK } from "@/lib/timetable/math-qa-demo"
import type { ProjectedEntry } from "@/lib/timetable/data"

/** Reuses the real activity browsing flow without changing any timetable/provider state. */
export function MathQaDemo() {
  const [detail, setDetail] = useState<ProjectedEntry | null>(null)
  const [attempt, setAttempt] = useState(0)

  return <div>
    <PageHeader title="数学答疑 · 多教师演示" desc="同一时段、不同场所的独立答疑安排" actions={
      <LinkButton href="/timetable" variant="outline"><ArrowLeft className="size-3.5" />退出演示</LinkButton>
    } />
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
      <Badge tone="neutral">独立演示</Badge>
      <span className="text-muted-foreground">仅展示合成安排，原课表、演示时钟和已保存样式保持不变。</span>
      <Button variant="outline" size="xs" className="ml-auto" onClick={() => { setDetail(null); setAttempt(n => n + 1) }}>
        <RotateCcw className="size-3.5" />重新体验
      </Button>
    </div>
    <section className="mb-4 rounded-lg border border-border bg-card px-4 py-3" aria-label="演示场景说明">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">10 月 28 日（周三）· 第 8 节 · 15:15–15:55</h2>
        <span className="text-xs text-muted-foreground">4 位数学教师 · D101 / D102 / D105 / D208</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">向下查看周三第 8 节的摘要卡，点击展开 4 项明细；也可在筛选器中选择一位教师，查看该教师的姓名和场所，再清除筛选恢复摘要。</p>
    </section>
    <WeekGrid key={attempt} entries={MATH_QA_DEMO_ENTRIES} weekStart={MATH_QA_DEMO_WEEK} clockDate={MATH_QA_DEMO_DATE}
      calendarEvents={[]} canonical showTeacher displayControls="admin" allowStyleEditing={false}
      filterScope={{ kind: "activity", activityName: "数学答疑" }} groupActivities onCardClick={setDetail} />
    <CardDetail entry={detail} open={!!detail} onClose={() => setDetail(null)} sourceLine="多人数学答疑演示 · 此安排仅供核验，不写入学校课表。" />
  </div>
}
