"use client"

import { PageHeader, Tabs } from "@/components/kit"
import { LinkButton } from "@/components/kit"
import { CalendarPanel } from "@/components/timetable/calendar-panel"
import { TimetableDemoBar } from "@/components/timetable/demo-bar"
import { OverviewPanel } from "@/components/timetable/overview-panel"
import { PublishPanel } from "@/components/timetable/publish-panel"
import { useTimetable } from "@/lib/timetable/store"
import { useDemo } from "@/lib/demo/store"
import { PERSONAS } from "@/lib/demo/nav"
import { Upload } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function TimetableCenterPage() {
  const tt = useTimetable()
  const { persona } = useDemo()
  const router = useRouter()
  const [tab, setTab] = useState("overview")

  // 无教务治理权限的人物（纯任课教师）进入中心时跳转到“我的课表”
  useEffect(() => {
    if (!PERSONAS[persona].admin) router.replace("/timetable/my")
  }, [persona, router])

  return (
    <div>
      <PageHeader
        title="课表中心"
        desc="教务/管理员课表治理 · 学校发布、教师采用、差异对比与校历调休统一入口"
        actions={
          <LinkButton href="/timetable/import" variant="outline">
            <Upload className="size-3.5" />
            导入课表
          </LinkButton>
        }
      />

      <TimetableDemoBar />

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "overview", label: "课表总览" },
            { value: "publish", label: "发布与更新" },
            { value: "calendar", label: "校历与调休" },
          ]}
        />
      </div>

      {tab === "overview" ? <OverviewPanel /> : null}
      {tab === "publish" ? <PublishPanel /> : null}
      {tab === "calendar" ? <CalendarPanel /> : null}
    </div>
  )
}
