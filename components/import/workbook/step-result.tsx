"use client"

import { Card, CardHeader, LinkButton } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { nowText, updateLog } from "@/lib/import/log-store"
import type { ParsedFile } from "@/lib/import/parse"
import { sheetTitle } from "@/lib/import/schema"
import type { Plan } from "@/lib/import/validate"
import { buildReportBytes, downloadBytes } from "@/lib/import/workbook-out"
import { CheckCircle2, CircleAlert, Clock } from "lucide-react"
import { ExampleTag, Notice, Stat } from "./shared"
import type { ResultKind } from "./step-confirm"

export function StepResult({
  file, plan, kind, batchId, onChangeKind, onOpenLog, onRestart, onBackToPreview,
}: {
  file: ParsedFile
  plan: Plan
  kind: ResultKind
  batchId: string
  onChangeKind: (k: ResultKind) => void
  onOpenLog: (id: string) => void
  onRestart: () => void
  onBackToPreview: () => void
}) {
  const t = plan.totals
  const mapping = plan.sheets.flatMap((s) => s.rows.filter((r) => r.numberPreview && r.status !== "excluded").map((r) => ({ s: s.code, id: r.values.id, name: r.values.name, no: r.numberPreview! })))
  const staffNew = plan.sheets.find((s) => s.code === "11" && s.state === "import")?.rows.filter((r) => r.status !== "excluded" && !r.reuse).length ?? 0
  const hasTimetable = plan.sheets.some((s) => s.code === "27" && s.state === "import")
  const report = () => downloadBytes(buildReportBytes(file, plan), `${batchId}_处理报告.xlsx`)

  if (kind === "failed") {
    return (
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><CircleAlert className="size-4 text-[#9a2b22]" aria-hidden />当前批失败 <ExampleTag /></span>} desc={`批次 ${batchId}`} />
        <div className="flex flex-col gap-3 p-5">
          <Notice tone="danger">本批业务均未写入（示例）。此前已成功的批次数据保持不变，不会被回滚或覆盖。</Notice>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onBackToPreview}>返回预览修改</Button>
            <Button variant="outline" onClick={() => onOpenLog(batchId)}>查看本批记录</Button>
            <Button variant="outline" onClick={report}>下载处理报告</Button>
          </div>
        </div>
      </Card>
    )
  }

  if (kind === "pending") {
    return (
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Clock className="size-4 text-[#2a5b6e]" aria-hidden />结果待查询 <ExampleTag /></span>} desc={`批次 ${batchId}`} />
        <div className="flex flex-col gap-3 p-5">
          <Notice tone="info">提交后连接中断，本批结果尚未确认（示例）。请不要重复提交：同一批次查询后会得到同一结果，不会新建批次。</Notice>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                updateLog(batchId, { status: "done", endedAt: nowText(), result: "查询后确认：完成（结果示例）" })
                onChangeKind("done")
              }}
            >
              查询本批结果
            </Button>
            <Button variant="outline" onClick={() => onOpenLog(batchId)}>查看本批记录</Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[#256a49]" aria-hidden />导入完成 <ExampleTag /></span>} desc={`批次 ${batchId} · 未接真实后台，以下为基于本批计划的结果示例，未写入学校`} />
      <div className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Stat label="新增对象" value={t.newObjects} />
          <Stat label="新增关系" value={t.newRelations} />
          <Stat label="复用已有" value={t.reuse + t.externalRefs} tone="info" />
          <Stat label="未处理（已排除）" value={t.excluded} />
          <Stat label="待开户" value={staffNew} tone={staffNew ? "warning" : undefined} />
        </div>

        {mapping.length ? (
          <section aria-labelledby="map-h" className="flex flex-col gap-2">
            <h3 id="map-h" className="flex items-center gap-2 text-[13px] font-semibold">编号映射回执 <ExampleTag>示例：真实编号由后端分配</ExampleTag></h3>
            <div className="max-h-64 overflow-auto rounded-lg border border-border">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">工作表</th>
                    <th className="px-3 py-2 text-left font-medium">导入标识</th>
                    <th className="px-3 py-2 text-left font-medium">姓名</th>
                    <th className="px-3 py-2 text-left font-medium">正式编号（示例）</th>
                  </tr>
                </thead>
                <tbody>
                  {mapping.map((m) => (
                    <tr key={`${m.s}${m.id}`} className="border-t border-border">
                      <td className="px-3 py-1.5">{sheetTitle(m.s)}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{m.id}</td>
                      <td className="px-3 py-1.5">{m.name}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{m.no}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <Notice tone="neutral" title="后续事项">
          <ul className="list-disc pl-5">
            {staffNew ? <li>{staffNew} 名教职工无账号：在账号与权限中按现有邀请入口办理，不自动发送。</li> : null}
            {hasTimetable ? <li>学校课表已登记为待确认学校版本：在课表中心确认；不自动采用或发布，不改个人版本。</li> : null}
            <li>导入标识（EMP01、STU01 等）只在本文件内有效，不是学号或工号。</li>
          </ul>
        </Notice>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={report}>下载处理报告</Button>
          <LinkButton href="/school" variant="outline">查看人员与班级</LinkButton>
          <LinkButton href="/school" variant="outline">查看待开通人员</LinkButton>
          {hasTimetable ? <LinkButton href="/timetable" variant="outline">进入课表中心</LinkButton> : null}
          <Button variant="outline" onClick={() => onOpenLog(batchId)}>查看本批记录</Button>
          <Button variant="ghost" onClick={onRestart}>返回导入首页</Button>
        </div>
      </div>
    </Card>
  )
}
