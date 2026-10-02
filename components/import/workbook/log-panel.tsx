"use client"

import { Badge, Card, Select, Sheet } from "@/components/kit"
import { useLogs, type LogRecord, type LogStatus, type LogType } from "@/lib/import/log-store"
import { useState } from "react"
import { ExampleTag, Notice } from "./shared"

const TYPE_LABEL: Record<LogType, string> = { import: "导入", export: "导出", rebuild: "重建" }
const STATUS_LABEL: Record<LogStatus, string> = { done: "完成", failed: "失败", pending: "待查询", partial: "不完整" }
const STATUS_TONE = { done: "success", failed: "danger", pending: "info", partial: "warning" } as const

export function LogPanel({ openId, onOpenChange }: { openId: string | null; onOpenChange: (id: string | null) => void }) {
  const logs = useLogs()
  const [type, setType] = useState<LogType | "all">("all")
  const [status, setStatus] = useState<LogStatus | "all">("all")
  const [period, setPeriod] = useState("all")
  const periods = [...new Set(logs.map((l) => l.period))]
  const list = logs.filter((l) => (type === "all" || l.type === type) && (status === "all" || l.status === status) && (period === "all" || l.period === period))
  const open = logs.find((l) => l.id === openId) ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Select aria-label="类型" value={type} onChange={(e) => setType(e.target.value as LogType | "all")} className="w-36">
          <option value="all">全部类型</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select aria-label="状态" value={status} onChange={(e) => setStatus(e.target.value as LogStatus | "all")} className="w-36">
          <option value="all">全部状态</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select aria-label="期间" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-56">
          <option value="all">全部期间</option>
          {periods.map((p) => <option key={p}>{p}</option>)}
        </Select>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">批次</th>
              <th className="px-4 py-2 text-left font-medium">类型</th>
              <th className="px-4 py-2 text-left font-medium">内容</th>
              <th className="px-4 py-2 text-left font-medium">经办人</th>
              <th className="px-4 py-2 text-left font-medium">时间</th>
              <th className="px-4 py-2 text-left font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">没有符合条件的记录。</td></tr>
            ) : (
              list.map((l) => (
                <tr key={l.id} className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={() => onOpenChange(l.id)}>
                  <td className="px-4 py-2.5">
                    <button className="font-mono text-xs text-primary hover:underline" onClick={() => onOpenChange(l.id)}>{l.id}</button>
                    {l.sessionCreated ? <span className="ml-2 text-[11px] text-muted-foreground">本会话</span> : null}
                  </td>
                  <td className="px-4 py-2.5">{TYPE_LABEL[l.type]}</td>
                  <td className="px-4 py-2.5">{l.title}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.operator}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{l.startedAt}</td>
                  <td className="px-4 py-2.5"><Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">每批一行；同一批的重试与查询更新同一条记录。记录只保留在本次浏览会话中，历史不展示密码、令牌或未授权个人值。</p>
      <LogDetail log={open} onClose={() => onOpenChange(null)} />
    </div>
  )
}

function LogDetail({ log, onClose }: { log: LogRecord | null; onClose: () => void }) {
  if (!log) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>
  const rows: [string, string][] = [
    ["经办人", log.operator], ["来源", log.source], ["版本", log.version], ["选定范围", log.scope], ["期间", log.period],
    ["开始", log.startedAt], ["结束", log.endedAt], ["计划摘要", log.plan], ["结果", log.result],
  ]
  return (
    <Sheet open onClose={onClose} width="max-w-lg" title={log.id} desc={<span className="flex items-center gap-2">{TYPE_LABEL[log.type]} · {STATUS_LABEL[log.status]} {log.example ? <ExampleTag>示例记录</ExampleTag> : null}</span>}>
      <div className="flex flex-col gap-4 text-[13px]">
        <dl className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-3 px-3.5 py-2">
              <dt className="w-20 shrink-0 text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <List title="错误位置" items={log.errors} empty="无" />
        <List title="修正与引用映射" items={log.mappings} empty="无" mono />
        <List title="后续动作" items={log.followUps} empty="无" />
        {log.fingerprint ? <p className="text-xs text-muted-foreground">内容指纹 {log.fingerprint}：再次导入相同内容会识别为已完成批次，复用而不再新增。</p> : null}
        <Notice tone="neutral">结果文件下载需要相应权限；链接不会因曾生成而永久公开。</Notice>
      </div>
    </Sheet>
  )
}

function List({ title, items, empty, mono }: { title: string; items: string[]; empty: string; mono?: boolean }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {items.length === 0 ? <p className="text-muted-foreground">{empty}</p> : (
        <ul className={`flex max-h-40 flex-col gap-0.5 overflow-auto ${mono ? "font-mono text-xs" : ""}`}>
          {items.map((i) => <li key={i}>{i}</li>)}
        </ul>
      )}
    </section>
  )
}
