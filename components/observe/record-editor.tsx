"use client"

import { Badge, Card, Checkbox, Field, Input, Modal, Textarea, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { SAMPLE_RECORD } from "@/lib/proto/data"
import { ArrowLeft, CheckCircle2, Lock, Save, Send, Share2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

export function RecordEditor() {
  const params = useSearchParams()
  const router = useRouter()
  const toast = useToast()
  const isMakeup = params.get("makeup") === "1"
  const existingId = params.get("id")
  const readOnly = existingId === "rc-2" // 已分享的示例记录以只读呈现

  const [share, setShare] = useState<Record<string, boolean>>(SAMPLE_RECORD.shareable)
  const [saveOpen, setSaveOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const title = isMakeup ? "线下听课补录" : readOnly ? "听课记录（已分享）" : existingId ? "继续整理听课记录" : "填写听课记录"

  return (
    <>
      {/* 顶部返回 + 操作 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/observe?tab=records" className="inline-flex">
            <Button variant="ghost" size="icon-sm" aria-label="返回">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-semibold leading-tight">{title}</h1>
              {isMakeup ? <Badge tone="neutral">补录</Badge> : null}
              {readOnly ? <Badge tone="success">已分享</Badge> : null}
            </div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {SAMPLE_RECORD.teacher} · {SAMPLE_RECORD.course} · {SAMPLE_RECORD.date} {SAMPLE_RECORD.time}
            </p>
          </div>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setSaveOpen(true); toast.push("已进入“草稿已保存”示例状态") }}>
              <Save className="mr-1.5 size-4" /> 保存草稿
            </Button>
            <Button size="sm" onClick={() => setSubmitOpen(true)}>
              <Send className="mr-1.5 size-4" /> 提交记录
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* 正文 */}
        <div className="space-y-4 lg:col-span-2">
          {isMakeup && (
            <Card className="border-[#e6d4a8] bg-[#fbf7ee] p-4">
              <p className="text-[13px] font-medium text-[#8a5a12]">线下听课补录</p>
              <p className="mt-1 text-[12.5px] text-[#8a5a12]/90">
                该记录未通过系统预约，提交后需授课教师核验到场。请先填写课节信息。
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="授课教师" required><Input placeholder="示例王老师" /></Field>
                <Field label="课程 / 主题" required><Input placeholder="高一信息 · 算法入门" /></Field>
                <Field label="听课日期" required><Input type="date" defaultValue="2026-09-22" /></Field>
                <Field label="节次"><Input placeholder="第3节 10:05–10:50" /></Field>
              </div>
            </Card>
          )}

          {SAMPLE_RECORD.sections.map((sec) => (
            <Card key={sec.key} className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-[14px] font-semibold">{sec.title}</label>
                {sec.key === "reflect" ? (
                  <Badge tone={share[sec.key] ? "info" : "neutral"}>
                    {share[sec.key] ? "将分享给授课教师" : "默认仅自己可见"}
                  </Badge>
                ) : null}
              </div>
              {readOnly ? (
                <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-foreground/90">{sec.value}</p>
              ) : (
                <Textarea defaultValue={sec.value} rows={sec.key === "observe" ? 5 : 3} />
              )}
            </Card>
          ))}
        </div>

        {/* 侧栏：分享设置 */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Share2 className="size-4 text-primary" />
              <h2 className="text-[14px] font-semibold">分享设置</h2>
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              选择提交后哪些内容对授课教师可见。「个人反思」默认不分享。
            </p>
            <div className="mt-3 space-y-2.5">
              {SAMPLE_RECORD.sections.map((sec) => (
                <div key={sec.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-[13px]">{sec.title}</span>
                  {readOnly ? (
                    <Badge tone={SAMPLE_RECORD.shareable[sec.key as keyof typeof SAMPLE_RECORD.shareable] ? "info" : "neutral"}>
                      {SAMPLE_RECORD.shareable[sec.key as keyof typeof SAMPLE_RECORD.shareable] ? "已分享" : "未分享"}
                    </Badge>
                  ) : (
                    <Checkbox
                      checked={!!share[sec.key]}
                      onChange={(v) => setShare((s) => ({ ...s, [sec.key]: v }))}
                      label=""
                    />
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" />
              <h2 className="text-[14px] font-semibold">可见范围说明</h2>
            </div>
            <ul className="mt-2 space-y-1.5 text-[12.5px] text-muted-foreground">
              <li>· 记录默认属于听课教师本人。</li>
              <li>· 授课教师仅能看到你勾选分享的部分。</li>
              <li>· 学校指定的审阅人可查看已提交的完整记录。</li>
              <li>· 协调管理员不读取记录全文，仅看到完成状态。</li>
            </ul>
          </Card>
        </div>
      </div>

      {/* 保存草稿：预设结果 */}
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="草稿已保存"
        footer={<Button onClick={() => setSaveOpen(false)}>继续编辑</Button>}
      >
        <Preset title="草稿已保存（示例）" desc="这是预设的结果画面。原型不做自动保存，也不会改变列表页数据。" />
      </Modal>

      {/* 提交记录：预设结果 */}
      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title={submitted ? "记录已提交" : "提交听课记录"}
        desc={submitted ? undefined : "确认后将按当前分享设置提交。"}
        footer={
          submitted ? (
            <Button onClick={() => { setSubmitOpen(false); router.replace("/observe?tab=records") }}>返回记录列表</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setSubmitOpen(false)}>再检查一下</Button>
              <Button onClick={() => { setSubmitted(true); toast.push("已进入“记录已提交”示例状态") }}>
                <CheckCircle2 className="mr-1.5 size-4" /> 确认提交
              </Button>
            </>
          )
        }
      >
        {submitted ? (
          <Preset title="记录已提交（示例）" desc="这是预设的结果画面。提交后授课教师可见你勾选分享的部分，指定审阅人可见完整记录。原型不联动其他页面。" />
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-[12.5px]">
              <p className="font-medium text-foreground">本次分享设置</p>
              <ul className="mt-1.5 space-y-1">
                {SAMPLE_RECORD.sections.map((sec) => (
                  <li key={sec.key} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{sec.title}</span>
                    <span className={share[sec.key] ? "text-primary" : "text-muted-foreground"}>
                      {share[sec.key] ? "分享" : "不分享"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[12px] text-muted-foreground">原型说明：仅进入“记录已提交”示例状态。</p>
          </div>
        )}
      </Modal>
    </>
  )
}

function Preset({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-[#e6f2ea] text-[#2f7d5b]">
        <CheckCircle2 className="size-7" />
      </span>
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{desc}</p>
    </div>
  )
}
