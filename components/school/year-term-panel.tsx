"use client"

import { Badge, Card, Field, Input, Modal, Select, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { ACADEMIC_YEARS, type TermRow } from "@/lib/demo/school"
import { CalendarDays, Plus } from "lucide-react"
import { useMemo, useState } from "react"

const STATUS: Record<TermRow["status"], { label: string; tone: "success" | "neutral" | "warning" }> = {
  current: { label: "当前", tone: "success" },
  upcoming: { label: "未开始", tone: "warning" },
  ended: { label: "已结束", tone: "neutral" },
}

export function YearTermPanel() {
  const { push } = useToast()
  const [yearId, setYearId] = useState(ACADEMIC_YEARS[0].id)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<TermRow | null>(null)

  const year = useMemo(() => ACADEMIC_YEARS.find((y) => y.id === yearId)!, [yearId])
  const current = year.terms.find((t) => t.status === "current")

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold">学年与学期</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              当前学期：
              {current ? (
                <span className="text-foreground">
                  {current.name} · 第 {current.currentWeek} 周
                </span>
              ) : (
                "本学年无进行中学期"
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={yearId} onChange={(e) => setYearId(e.target.value)} className="w-auto" aria-label="选择学年">
              {ACADEMIC_YEARS.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </Select>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              新建学期
            </Button>
          </div>
        </div>

        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">学期名称</th>
                <th className="px-3 py-2.5 font-medium">学年范围</th>
                <th className="px-3 py-2.5 font-medium">学期日期</th>
                <th className="px-3 py-2.5 font-medium">周数</th>
                <th className="px-3 py-2.5 font-medium">状态</th>
                <th className="px-5 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {year.terms.map((t) => (
                <tr key={t.id} className="border-t border-border align-top">
                  <td className="px-5 py-3.5">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{year.label}</p>
                  </td>
                  <td className="px-3 py-3.5 text-muted-foreground">{t.yearRange}</td>
                  <td className="px-3 py-3.5 text-muted-foreground">{t.termRange}</td>
                  <td className="px-3 py-3.5 text-muted-foreground">
                    {t.weeks} 周{t.currentWeek ? ` · 第 ${t.currentWeek} 周` : ""}
                  </td>
                  <td className="px-3 py-3.5">
                    <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button size="xs" variant="outline" onClick={() => setEditing(t)}>
                      编辑
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarDays className="size-4" />
        </span>
        <div>
          <p className="text-[13.5px] font-semibold">学期周次是全系统的时间基准</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            周反馈、发布基准日与家长页均按此处的学期周次定位。修改学期日期会影响全校的周次编号，原型仅演示编辑界面，不写入真实系统。
          </p>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="新建学期（演示）"
        desc="设置学期名称与起止日期，系统据此生成周次。"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setCreateOpen(false)
                push("演示：学期创建流程完成（未写入真实系统）")
              }}
            >
              创建
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="所属学年" required>
            <Select defaultValue={year.label}>
              {ACADEMIC_YEARS.map((y) => (
                <option key={y.id}>{y.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="学期名称" required>
            <Select defaultValue="上学期">
              <option>上学期</option>
              <option>下学期</option>
            </Select>
          </Field>
          <Field label="开始日期" required>
            <Input type="date" defaultValue="2027-02-22" />
          </Field>
          <Field label="结束日期" required>
            <Input type="date" defaultValue="2027-07-13" />
          </Field>
        </div>
      </Modal>

      {editing ? (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={`编辑学期 · ${editing.name}`}
          desc={`${year.label} · 修改起止日期将重新计算周次`}
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null)
                  push("演示：学期已更新（未写入真实系统）")
                }}
              >
                保存
              </Button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="学期名称">
              <Input defaultValue={editing.name} />
            </Field>
            <Field label="周数">
              <Input defaultValue={String(editing.weeks)} />
            </Field>
            <Field label="学期日期">
              <Input defaultValue={editing.termRange} />
            </Field>
            <Field label="状态">
              <Select defaultValue={editing.status}>
                <option value="current">当前</option>
                <option value="upcoming">未开始</option>
                <option value="ended">已结束</option>
              </Select>
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
