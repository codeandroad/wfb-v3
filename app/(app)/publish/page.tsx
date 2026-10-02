"use client"

import {
  Badge,
  Card,
  CardHeader,
  Checkbox,
  Dot,
  EmptyState,
  LinkButton,
  PageHeader,
  Segmented,
  useToast,
} from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  HOMEROOMS,
  hasPendingHomework,
  hasClassroomRecord,
  overallGrade,
  overallHomework,
  PUBLISH_BASE_DATE,
  SCHOOL_NAME,
  STUDENTS,
  TEACHING_CLASS,
  UNITS,
  WEEK_LABEL,
  WEEK_RANGE,
  studentsByHomeroom,
} from "@/lib/demo/data"
import { moduleEnabled } from "@/lib/demo/nav"
import { useDemo } from "@/lib/demo/store"
import { downloadDataUrl, renderSummaryImage } from "@/lib/demo/render-image"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ImageIcon,
  PlugZap,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react"
import { useState } from "react"

type UnitCode = "P1" | "S1" | "M1"

export default function PublishPage() {
  const demo = useDemo()
  const { push } = useToast()
  const [selected, setSelected] = useState<UnitCode[]>(["P1"])
  const [viewRoom, setViewRoom] = useState<string>(HOMEROOMS[0])
  const [simulateFail, setSimulateFail] = useState(false)

  if (!moduleEnabled("teaching", demo.config)) {
    return (
      <div>
        <PageHeader title="发布与反馈图片" desc="演示配置 B · 教学反馈模块未接入" />
        <EmptyState
          tone="warning"
          icon={<PlugZap className="size-7" />}
          title="教学反馈模块未接入"
          desc="当前演示配置 B 未接入教学与数据模块，无法发布反馈。请在原型演示控制切换回配置 A。"
        />
      </div>
    )
  }

  const toggleUnit = (code: UnitCode) =>
    setSelected((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code]))

  const validation = validate(demo, selected)
  const published = demo.publication?.units.join(",") === [...selected].sort().join(",")
  const canPublish = selected.length > 0 && validation.blocking.length === 0

  return (
    <div>
      <PageHeader
        title="发布与反馈图片"
        desc={`${WEEK_LABEL} · ${WEEK_RANGE}`}
        actions={<LinkButton href="/feedback?unit=P1" variant="outline">返回编辑</LinkButton>}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* 单元选择 */}
          <Card>
            <CardHeader title="1 · 选择要合并发布的单元" desc="可将本人任教的多个单元合并为一次家长反馈。" />
            <div className="space-y-2 px-5 py-4">
              {UNITS.map((u) => {
                const isPublished = demo.publication?.units.includes(u.code)
                return (
                  <label
                    key={u.code}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selected.includes(u.code)}
                        onChange={() => toggleUnit(u.code)}
                      />
                      <div>
                        <p className="text-[13.5px] font-medium">
                          {u.code} · {u.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {u.teachingDays.length} 个教学日 · {TEACHING_CLASS.name}
                        </p>
                      </div>
                    </div>
                    {isPublished ? <Badge tone="success">已发布</Badge> : null}
                  </label>
                )
              })}
              <p className="text-xs text-muted-foreground">
                当前选择：{selected.length ? selected.join(" + ") : "未选择"}
              </p>
            </div>
          </Card>

          {/* 校验 */}
          <Card>
            <CardHeader title="2 · 发布前校验" desc="阻断项需处理后才能发布；提醒项不阻塞发布。" />
            <div className="space-y-2.5 px-5 py-4">
              {validation.blocking.length === 0 && validation.warnings.length === 0 ? (
                <div className="flex items-center gap-2 text-[13px] text-[#256a49]">
                  <CheckCircle2 className="size-4" />
                  校验通过，可以发布。
                </div>
              ) : null}
              {validation.blocking.map((v, i) => (
                <CheckRow key={`b${i}`} tone="danger" text={v} label="阻断" />
              ))}
              {validation.warnings.map((v, i) => (
                <CheckRow key={`w${i}`} tone="warning" text={v} label="提醒" />
              ))}
            </div>
          </Card>

          {/* 主班预览 */}
          <Card>
            <CardHeader
              title="3 · 按主班分组预览"
              desc="发布后，家长看到本班公共总结与自己孩子的部分；班主任可查看本班已发布反馈。"
              action={
                <Segmented
                  size="sm"
                  ariaLabel="选择主班"
                  value={viewRoom}
                  onChange={setViewRoom}
                  options={HOMEROOMS.map((r) => ({
                    value: r,
                    label: `${r}（${studentsByHomeroom(r).length}）`,
                  }))}
                />
              }
            />
            <RoomPreview room={viewRoom} units={selected} />
          </Card>
        </div>

        {/* 右栏：发布 + 图片 */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="发布" desc={published ? "本组合已发布" : "确认后向家长发布"} />
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-lg bg-muted/50 p-3 text-[13px]">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">单元</span>
                  <span className="font-medium">{selected.join(" + ") || "—"}</span>
                </p>
                <p className="mt-1.5 flex justify-between">
                  <span className="text-muted-foreground">覆盖学生</span>
                  <span className="font-medium">{STUDENTS.length} 名 · 2 个主班</span>
                </p>
                <p className="mt-1.5 flex justify-between">
                  <span className="text-muted-foreground">发布日期</span>
                  <span className="font-medium">{PUBLISH_BASE_DATE}</span>
                </p>
              </div>
              <Button
                className="w-full"
                disabled={!canPublish || published}
                onClick={() => {
                  demo.publish([...selected].sort() as UnitCode[])
                  push(`已发布 ${selected.join(" + ")} 反馈`)
                }}
              >
                <Send className="size-3.5" />
                {published ? "已发布" : `发布 ${selected.join(" + ") || ""}`}
              </Button>
              {!canPublish && selected.length > 0 ? (
                <p className="text-xs text-destructive">存在阻断项，请先在反馈编辑中处理。</p>
              ) : null}
              {demo.publication ? (
                <p className="text-center text-xs text-muted-foreground">
                  当前已发布：{demo.publication.units.join(" + ")}（第 {demo.publication.version} 版）
                </p>
              ) : null}
            </div>
          </Card>

          {/* 图片输出 */}
          <Card>
            <CardHeader
              title="反馈图片"
              desc="发布后生成公共总结图，可下载或群发；未接入送达渠道的家长需手动送达。"
            />
            <div className="space-y-4 px-5 py-4">
              {!demo.publication ? (
                <p className="text-[13px] text-muted-foreground">发布后可生成反馈图片。</p>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-primary"
                      checked={simulateFail}
                      onChange={(e) => setSimulateFail(e.target.checked)}
                    />
                    模拟生成失败（演示重试）
                  </label>
                  <ImageOutput room={viewRoom} units={demo.publication.units} simulateFail={simulateFail} />
                  <UndeliverableList />
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CheckRow({ tone, text, label }: { tone: "danger" | "warning"; text: string; label: string }) {
  return (
    <div className="flex items-start gap-2 text-[13px]">
      <span className="mt-0.5">
        {tone === "danger" ? (
          <AlertTriangle className="size-4 text-[#b4342a]" />
        ) : (
          <ShieldCheck className="size-4 text-[#b5791f]" />
        )}
      </span>
      <span>
        <Badge tone={tone} className="mr-1.5">
          {label}
        </Badge>
        {text}
      </span>
    </div>
  )
}

function RoomPreview({ room, units }: { room: string; units: UnitCode[] }) {
  const demo = useDemo()
  const students = studentsByHomeroom(room)
  const primaryUnit = units[0] ?? "P1"
  const summary = demo.units[primaryUnit].summary
  return (
    <div className="px-5 py-4">
      <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-[13px] font-semibold">{room} · 公共总结（家长可见）</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">
          {summary.overall || <span className="text-muted-foreground/70">尚未填写整体掌握，将以空白发布。</span>}
        </p>
      </div>
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">学生</th>
              <th className="px-3 py-2 font-medium">课堂</th>
              <th className="px-3 py-2 font-medium">作业</th>
              <th className="px-3 py-2 font-medium">亮点</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const f = demo.units[primaryUnit].feedback[s.id]
              const grade = overallGrade(f, UNITS.find((u) => u.code === primaryUnit)!.teachingDays)
              const hw = overallHomework(f)
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">
                    {s.name}
                    {s.parentContactMissing ? <Badge tone="warning" className="ml-1.5">缺联系</Badge> : null}
                  </td>
                  <td className="px-3 py-2">
                    {grade ? grade : <span className="text-muted-foreground/60">未记录</span>}
                  </td>
                  <td className="px-3 py-2">
                    {hw.status === "pending"
                      ? "待确认"
                      : hw.status === "not_submitted"
                        ? "未交"
                        : hw.ungraded
                          ? "已交·待评分"
                          : `已交·${hw.grade}`}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {f.highlights.length ? f.highlights.join("、") : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ImageOutput({
  room,
  units,
  simulateFail,
}: {
  room: string
  units: string[]
  simulateFail: boolean
}) {
  const demo = useDemo()
  const { push } = useToast()
  const key = `summary:${room}`
  const img = demo.images[key] ?? { status: "idle" as const }

  const generate = async () => {
    demo.setImage(key, "generating")
    try {
      if (simulateFail) {
        await new Promise((r) => setTimeout(r, 700))
        throw new Error("simulated")
      }
      const primaryUnit = (units[0] ?? "P1") as UnitCode
      const s = demo.units[primaryUnit].summary
      const w = demo.units[primaryUnit].weekendHomework
      const dataUrl = await renderSummaryImage({
        school: SCHOOL_NAME,
        week: WEEK_LABEL,
        weekRange: WEEK_RANGE,
        className: TEACHING_CLASS.name,
        course: TEACHING_CLASS.course,
        units,
        homeroom: room,
        studentCount: studentsByHomeroom(room).length,
        sections: [
          { label: "本周内容", text: s.content },
          { label: "整体掌握", text: s.overall },
          { label: "整体亮点", text: s.highlights },
          { label: "作业情况", text: s.homework },
          { label: "下一步", text: s.next },
        ],
        weekend:
          w.none || !w.instructions
            ? w.none
              ? { title: "周末作业", body: "本周无周末作业。" }
              : null
            : { title: "周末作业", body: w.instructions },
      })
      demo.setImage(key, "ready", dataUrl)
      push(`${room} 公共总结图已生成`)
    } catch {
      demo.setImage(key, "failed")
      push(`${room} 图片生成失败，可重试`, "danger")
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-medium">{room} · 公共总结图</span>
        <ImageStatusBadge status={img.status} />
      </div>

      {img.status === "ready" && img.dataUrl ? (
        <div className="overflow-hidden rounded-md border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.dataUrl} alt={`${room} 公共总结反馈图`} className="w-full" />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground">
          {img.status === "generating" ? (
            <span className="flex items-center gap-2 text-[13px]">
              <RefreshCw className="size-4 animate-spin" />
              生成中…
            </span>
          ) : img.status === "failed" ? (
            <span className="text-[13px] text-destructive">生成失败</span>
          ) : (
            <span className="flex items-center gap-2 text-[13px]">
              <ImageIcon className="size-4" />
              尚未生成
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {img.status === "ready" ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadDataUrl(img.dataUrl!, `${room}-周反馈.png`)}
            >
              <Download className="size-3.5" />
              下载
            </Button>
            <Button
              size="sm"
              onClick={() => {
                demo.markManualSent(`send:${room}`)
                push(`已标记 ${room} 公共总结为“已群发”（演示）`)
              }}
            >
              <Send className="size-3.5" />
              {demo.manualSent[`send:${room}`] ? "已群发" : "群发给家长"}
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={generate} disabled={img.status === "generating"}>
            {img.status === "failed" ? (
              <>
                <RefreshCw className="size-3.5" />
                重试生成
              </>
            ) : (
              <>
                <ImageIcon className="size-3.5" />
                生成图片
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

function ImageStatusBadge({ status }: { status: string }) {
  if (status === "ready") return <Badge tone="success"><Dot tone="success" />已生成</Badge>
  if (status === "generating") return <Badge tone="info"><Dot tone="info" />生成中</Badge>
  if (status === "failed") return <Badge tone="danger"><Dot tone="danger" />失败</Badge>
  return <Badge tone="neutral">未生成</Badge>
}

function UndeliverableList() {
  const demo = useDemo()
  const { push } = useToast()
  const missing = STUDENTS.filter((s) => s.parentContactMissing)
  if (missing.length === 0) return null
  return (
    <div className="rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] p-3">
      <p className="text-[13px] font-medium text-[#7a5514]">未自动送达（缺家长联系方式）</p>
      <div className="mt-2 space-y-2">
        {missing.map((s) => {
          const done = demo.manualSent[`manual:${s.id}`]
          return (
            <div key={s.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-[#7a5514]">{s.name} · {s.homeroom}</span>
              <Button
                size="xs"
                variant={done ? "secondary" : "outline"}
                onClick={() => {
                  demo.markManualSent(`manual:${s.id}`)
                  push(`已标记 ${s.name} 为手动转达完成`)
                }}
              >
                {done ? "已手动转达" : "标记手动转达"}
              </Button>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-[#7a5514]/80">缺少联系方式不阻塞发布；反馈已生成，仅需线下或其他渠道转达。</p>
    </div>
  )
}

/* ---------------- 校验逻辑 ---------------- */

function validate(demo: ReturnType<typeof useDemo>, selected: UnitCode[]) {
  const blocking: string[] = []
  const warnings: string[] = []
  if (selected.length === 0) {
    blocking.push("请至少选择一个要发布的单元。")
    return { blocking, warnings }
  }
  for (const code of selected) {
    const unit = demo.units[code]
    const all = Object.values(unit.feedback)
    const pending = all.filter((f) => hasPendingHomework(f))
    if (pending.length) {
      blocking.push(`${code}：仍有 ${pending.length} 名学生的作业疑似未交待确认，请先在编辑中处理。`)
    }
    const unrecorded = all.filter(
      (f) => !f.confirmed && !hasClassroomRecord(f) && !Object.values(f.attendance).some((a) => a !== "present"),
    )
    if (unrecorded.length) {
      warnings.push(`${code}：${unrecorded.length} 名学生尚未记录课堂表现，将以空白发布。`)
    }
    if (!unit.summary.overall.trim()) {
      warnings.push(`${code}：公共总结的“整体掌握”为空，建议补充。`)
    }
  }
  const missing = STUDENTS.filter((s) => s.parentContactMissing)
  if (missing.length) {
    warnings.push(`${missing.length} 名学生缺少家长联系方式，发布后需手动转达（不阻塞发布）。`)
  }
  return { blocking, warnings }
}
