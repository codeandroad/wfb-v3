"use client"

import { LinkButton, PageHeader } from "@/components/kit"
import { ImportWorkspace } from "@/components/timetable/import-workspace"

export default function MyImportPage() {
  return (
    <div>
      <PageHeader
        title="导入我的课表"
        desc="上传网格式 Excel，解析后写入个人草稿；时间以系统作息为准，可在“我的课表”复核并应用。"
        actions={<LinkButton href="/timetable/my" variant="outline">返回我的课表</LinkButton>}
      />
      <ImportWorkspace mode="personal" />
    </div>
  )
}
