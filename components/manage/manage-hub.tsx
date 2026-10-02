"use client"

import { Badge, Card, CardHeader, Checkbox, Dot, Field, Input, Modal, PageHeader, Segmented, Select, Tabs, Textarea, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  COMPLETION_ROWS,
  COORD_ROWS,
  REQUIREMENT_SAMPLE,
  REVIEW_QUEUE,
  SAMPLE_RECORD,
} from "@/lib/proto/data"
import { CheckCircle2, FileText, Info, LayoutGrid, Lock, Settings2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

function ProtoViewBar<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <LayoutGrid className="size-3.5" /> 原型视图 · 仅切换示例画面，不改变其他页面数据
      </p>
      <Segmented value={value} onChange={onChange} size="sm" ariaLabel="切换原型视图" options={options} />
    </div>
  )
}

export function ManageHub() {
  const [view, setView] = useState<"coordinator" | "reviewer">("coordinator")
  const isReviewer = view === "reviewer"
  const params = useSearchParams()
  const router = useRouter()

  const tabs = [
    { value: "coord", label: "安排协调" },
    { value: "requirement", label: "听课要求" },
    { value: "completion", label: "完成情况" },
    ...(isReviewer ? [{ value: "review", label: "记录审阅" }] : []),
  ]
  const requested = params.get("tab")
  const active = tabs.some((t) => t.value === requested) ? (requested as string) : "coord"
  const setTab = (v: string) => router.replace(`/observe/manage?tab=${v}`)

  return (
    <>
      <ProtoViewBar
        value={view}
        onChange={setView}
        options={[
          { value: "coordinator", label: "协调管理员视图" },
          { value: "reviewer", label: "记录审阅人视图" },
        ]}
      />
      <PageHeader
        title="听课管理"
        desc={
          isReviewer
            ? `示例审阅人 · 指定审阅人：可查看已提交记录的完整内容。`
            : `示例协调管理员 · 教务协调：协调安排与完成情况，不读取记录全文。`
        }
      />

      {/* 权限边界提示 */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-[12.5px] text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          {isReviewer
            ? "审阅视图可读取已提交记录的完整正文，用于教研反馈；不代表评分或考核。"
            : "协调视图仅处理安排、时间变更与完成状态统计，不展示听课记录的正文内容。"}
          &nbsp;原型中的操作仅进入示例状态，不做真实的名额计算或跨角色联动。
        </p>
      </div>

      <Tabs tabs={tabs} value={active} onChange={setTab} />

      <div className="mt-5">
        {active === "coord" && <CoordTab />}
        {active === "requirement" && <RequirementTab />}
        {active === "completion" && <CompletionTab />}
        {active === "review" && isReviewer && <ReviewTab />}
      </div>
    </>
  )
}

/* ============ 安排协调 ============ */

function CoordTab() {
  const toast = useToast()
  return (
    <Card>
      <CardHeader title="听课安排协调" desc="跟进预约、时间变更与补录核验。示例数据。" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[12px] text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">听课教师</th>
              <th className="px-5 py-2.5 font-medium">课节 · 授课教师</th>
              <th className="px-5 py-2.5 font-medium">时间</th>
              <th className="px-5 py-2.5 font-medium">状态</th>
              <th className="px-5 py-2.5 font-medium">待办</th>
              <th className="px-5 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {COORD_ROWS.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium">{r.teacher}</td>
                <td className="px-5 py-3 text-muted-foreground">{r.session}</td>
                <td className="px-5 py-3 tabular-nums text-muted-foreground">{r.date}</td>
                <td className="px-5 py-3"><Badge tone={r.tone}><Dot tone={r.tone} /> {r.status}</Badge></td>
                <td className="px-5 py-3 text-[12.5px] text-muted-foreground">{r.pending}</td>
                <td className="px-5 py-3 text-right">
                  <Button size="xs" variant="secondary" onClick={() => toast.push("已进入“已催办”示例状态")}>催办</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ============ 听课要求 ============ */

function RequirementTab() {
  const toast = useToast()
  const [enabled, setEnabled] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="听课要求设置"
            desc="学校可选择是否设置听课要求；默认关闭。"
            action={
              <Segmented
                value={enabled ? "on" : "off"}
                onChange={(v) => { setEnabled(v === "on"); toast.push(v === "on" ? "已进入“已启用要求”示例状态" : "已进入“已关闭要求”示例状态") }}
                size="sm"
                ariaLabel="是否启用听课要求"
                options={[{ value: "off", label: "关闭" }, { value: "on", label: "启用" }]}
              />
            }
          />
          <div className="p-5">
            {!enabled ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-5 py-10 text-center">
                <Lock className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-2 text-[14px] font-medium">当前未设置听课要求</p>
                <p className="mx-auto mt-1 max-w-md text-[12.5px] text-muted-foreground">
                  关闭状态下，系统仅作为自愿听课与记录协作工具，不统计欠额、不做红色提示。可根据学校需要启用。
                </p>
                <Button className="mt-4" size="sm" onClick={() => setEnabled(true)}>启用听课要求</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ReqItem k="适用范围" v={REQUIREMENT_SAMPLE.scope} />
                  <ReqItem k="周期" v={REQUIREMENT_SAMPLE.cycle} />
                  <ReqItem k="建议次数" v={REQUIREMENT_SAMPLE.count} />
                  <ReqItem k="达成条件" v={REQUIREMENT_SAMPLE.condition} />
                  <ReqItem k="生效时间" v={REQUIREMENT_SAMPLE.effective} />
                  <ReqItem k="自动豁免" v={REQUIREMENT_SAMPLE.exception} />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                    <Settings2 className="mr-1.5 size-4" /> 调整要求
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-primary" />
            <h2 className="text-[14px] font-semibold">表达边界</h2>
          </div>
          <ul className="mt-2 space-y-2 text-[12.5px] text-muted-foreground">
            <li>· 以“建议次数”表达，不设红色欠额告警。</li>
            <li>· 完成与否以“提交记录”为准，不含质量评分。</li>
            <li>· 要求为学校可选项，非系统默认强制。</li>
            <li>· 临时代课、脱产培训期间自动豁免。</li>
          </ul>
        </Card>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="调整听课要求"
        desc="修改后仅进入示例状态。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={() => { setEditOpen(false); toast.push("已进入“要求已更新”示例状态") }}>保存</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="适用范围"><Select defaultValue="全体任课教师（试用期教师除外）"><option>全体任课教师（试用期教师除外）</option><option>仅教研组长</option><option>自定义分组</option></Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="周期"><Select defaultValue="每学期"><option>每学期</option><option>每学年</option></Select></Field>
            <Field label="建议次数"><Input type="number" defaultValue={2} min={0} /></Field>
          </div>
          <Field label="达成条件"><Input defaultValue="完成听课并提交记录视为达成" /></Field>
          <Field label="说明（可选）"><Textarea rows={2} placeholder="面向教师的说明文字" /></Field>
        </div>
      </Modal>
    </>
  )
}

function ReqItem({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-[12px] text-muted-foreground">{k}</p>
      <p className="mt-0.5 text-[13.5px] font-medium">{v}</p>
    </div>
  )
}

/* ============ 完成情况 ============ */

function CompletionTab() {
  return (
    <Card>
      <CardHeader title="听课完成情况" desc="按教师汇总到场与提交记录的次数；不含记录正文，不做质量评价。" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[12px] text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">教师</th>
              <th className="px-5 py-2.5 font-medium">已到场</th>
              <th className="px-5 py-2.5 font-medium">已提交记录</th>
              <th className="px-5 py-2.5 font-medium">待整理</th>
              <th className="px-5 py-2.5 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {COMPLETION_ROWS.map((r) => (
              <tr key={r.teacher} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium">{r.teacher}</td>
                <td className="px-5 py-3 tabular-nums">{r.attended}</td>
                <td className="px-5 py-3 tabular-nums">{r.submitted}</td>
                <td className="px-5 py-3 tabular-nums text-muted-foreground">{r.pending}</td>
                <td className="px-5 py-3">
                  {r.pending > 0 ? <Badge tone="info">整理中</Badge> : <Badge tone="success">已完成本期</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-5 py-3 text-[12px] text-muted-foreground">
        统计仅反映“是否完成”，以次数呈现，不设欠额红色告警，也不评价记录内容。
      </div>
    </Card>
  )
}

/* ============ 记录审阅（仅审阅人） ============ */

function ReviewTab() {
  const [open, setOpen] = useState(false)
  const toast = useToast()
  const reviewMeta = {
    "await-review": { tone: "warning" as const, label: "待审阅" },
    reviewed: { tone: "success" as const, label: "已审阅" },
  }
  return (
    <>
      <Card>
        <CardHeader title="记录审阅队列" desc="指定审阅人可查看已提交记录的完整正文，用于教研反馈。" />
        <div className="divide-y divide-border">
          {REVIEW_QUEUE.map((r) => {
            const m = reviewMeta[r.status]
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                    <FileText className="size-4.5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-semibold">{r.topic}</h3>
                      <Badge tone={m.tone}>{m.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                      记录人：{r.author} · 授课教师：{r.teacher} · {r.date}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant={r.status === "await-review" ? "default" : "secondary"} onClick={() => setOpen(true)}>
                  阅读全文
                </Button>
              </div>
            )
          })}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="听课记录全文"
        desc={`${SAMPLE_RECORD.teacher} · ${SAMPLE_RECORD.course} · ${SAMPLE_RECORD.date}`}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>关闭</Button>
            <Button onClick={() => { setOpen(false); toast.push("已进入“已标记为已审阅”示例状态") }}>
              <CheckCircle2 className="mr-1.5 size-4" /> 标记为已审阅
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-[#c4dae2] bg-[#e5eef2] px-3 py-2 text-[12px] text-[#2a5b6e]">
            审阅视图：可见完整正文（含记录人勾选不对授课教师分享的部分），仅用于教研反馈。
          </div>
          {SAMPLE_RECORD.sections.map((sec) => (
            <div key={sec.key}>
              <div className="flex items-center gap-2">
                <h4 className="text-[13.5px] font-semibold">{sec.title}</h4>
                {!SAMPLE_RECORD.shareable[sec.key as keyof typeof SAMPLE_RECORD.shareable] ? (
                  <Badge tone="neutral">未对授课教师分享</Badge>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">{sec.value}</p>
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}
