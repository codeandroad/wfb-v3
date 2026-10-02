"use client"

import { LinkButton, PageHeader, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { useTimetable } from "@/lib/timetable/store"
import { ImportWorkspace } from "@/components/timetable/import-workspace"

export default function ImportPage() {
  const tt = useTimetable()
  const { push } = useToast()

  return (
    <div>
      <PageHeader
        title="导入课表"
        desc="上传网格式 Excel → 词法解析安排格 → 绑定系统作息与在册教师/教学班 → 冲突预检 → 写入学校发布草稿。"
        actions={<LinkButton href="/timetable" variant="outline">返回课表中心</LinkButton>}
      />

      <ImportWorkspace mode="school" />

      <div className="mt-8 border-t border-border pt-5">
        <h3 className="text-[14px] font-semibold text-foreground">快速演示：直接发布内置样例批次</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          无需上传文件，直接发布预置的学校调整批次，用于演示“按实际变化分批、只影响生效日之后、保留个人调整”的更新链路。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onPublish("lin")}>发布·林老师调整</Button>
          <Button variant="outline" size="sm" onClick={() => onPublish("chen")}>发布·陈老师调整</Button>
          <Button variant="outline" size="sm" onClick={() => onPublish("zhouOct")}>发布·周老师10月新增</Button>
        </div>
      </div>
    </div>
  )

  function onPublish(target: "lin" | "chen" | "zhouOct") {
    const rel = tt.publishSample(target)
    if (rel) push(`已发布 ${rel.id}（${rel.effectiveDate} 起生效）`)
  }
}
