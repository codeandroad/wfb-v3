"use client"

import { Badge, useToast } from "@/components/kit"
import { DemoControlButton } from "@/components/demo-control"
import { Button } from "@/components/ui/button"
import {
  overallGrade,
  SCHOOL_NAME,
  STUDENTS,
  TEACHING_CLASS,
  UNITS,
  WEEK_LABEL,
  WEEK_RANGE,
  type Grade,
  type StudentFeedback,
} from "@/lib/demo/data"
import { useDemo } from "@/lib/demo/store"
import { downloadDataUrl, renderSummaryImage } from "@/lib/demo/render-image"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Download,
  GraduationCap,
  ImageIcon,
  Info,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type UnitCode = "P1" | "S1" | "M1"

const GRADE_TONE: Record<Grade, "success" | "primary" | "info" | "warning" | "neutral"> = {
  "A+": "success",
  A: "success",
  "A-": "primary",
  B: "info",
  C: "warning",
}

export default function ParentPage() {
  const demo = useDemo()
  const router = useRouter()

  // 若切回员工场景，返回工作台
  useEffect(() => {
    if (demo.scenario !== "parent") router.replace("/")
  }, [demo.scenario, router])

  const published = demo.publication
  const child = STUDENTS.find((s) => s.id === demo.parentChild) ?? STUDENTS[0]
  const childrenOfParent = useMemo(() => STUDENTS.slice(0, 2), [])

  return (
    <div className="flex min-h-svh flex-col items-center bg-[#eef1ee] px-4 py-6">
      {/* 顶部演示条 */}
      <div className="mb-4 flex w-full max-w-[420px] items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          返回员工端
        </Link>
        <DemoControlButton />
      </div>

      {/* 手机框 */}
      <div className="w-full max-w-[420px] overflow-hidden rounded-[28px] border border-border bg-card shadow-xl">
        {/* 应用头 */}
        <div className="bg-primary px-5 pb-5 pt-6 text-primary-foreground">
          <p className="text-[12px] text-primary-foreground/80">{SCHOOL_NAME} · 家长端</p>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-[18px] font-semibold">周反馈</p>
              <p className="mt-0.5 text-[12px] text-primary-foreground/80">
                {WEEK_LABEL} · {WEEK_RANGE}
              </p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-full bg-white/15 text-[15px] font-semibold">
              {child.name.slice(-2)}
            </div>
          </div>

          {/* 孩子切换 */}
          <div className="mt-4 flex gap-2">
            {childrenOfParent.map((c) => {
              const active = c.id === demo.parentChild
              return (
                <button
                  key={c.id}
                  onClick={() => demo.setParentChild(c.id)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-left text-[12px] transition-colors",
                    active ? "bg-white text-foreground" : "bg-white/12 text-primary-foreground/90",
                  )}
                >
                  <span className="block font-semibold">{c.name}</span>
                  <span className="block opacity-80">{c.homeroom}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 内容 */}
        <div className="thin-scroll max-h-[calc(100svh-260px)] min-h-[380px] overflow-y-auto px-4 py-4">
          {published ? (
            <ParentFeedback child={child} units={published.units} />
          ) : (
            <NotPublished />
          )}
        </div>
      </div>

      <p className="mt-4 max-w-[420px] text-center text-[11px] leading-relaxed text-muted-foreground">
        交互原型 · 示例数据。家长端仅显示已发布内容与本人孩子的部分；教师未发布或内部草稿家长不可见。
      </p>
    </div>
  )
}

function NotPublished() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CalendarDays className="size-6" />
      </div>
      <p className="text-[14px] font-medium">本周反馈尚未发布</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
        教师完成本周记录并发布后，这里会显示班级公共总结与您孩子的课堂、作业与评语。
      </p>
      <p className="mt-3 text-[11px] text-muted-foreground/70">
        可在右上角“原型演示控制”切到员工端发布，再切回家长端查看。
      </p>
    </div>
  )
}

function ParentFeedback({ child, units }: { child: (typeof STUDENTS)[number]; units: string[] }) {
  const demo = useDemo()
  const { push } = useToast()
  const primaryUnit = (units[0] ?? "P1") as UnitCode
  const summary = demo.units[primaryUnit].summary
  const weekend = demo.units[primaryUnit].weekendHomework
  const read = demo.parentReads[child.id]

  useEffect(() => {
    if (!read) {
      const t = setTimeout(() => demo.markParentRead(child.id), 900)
      return () => clearTimeout(t)
    }
  }, [child.id, read, demo])

  return (
    <div className="space-y-4">
      {/* 已读回执 */}
      <div className="flex items-center justify-between rounded-lg bg-[#e6f2ea] px-3 py-2 text-[12px] text-[#256a49]">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5" />
          已发布 · 第 {demo.publication?.version} 版
        </span>
        <span>{read ? "已读回执已发送" : "正在标记为已读…"}</span>
      </div>

      {/* 班级公共总结 */}
      <section>
        <SectionTitle icon={<Sparkles className="size-4" />} title={`${child.homeroom} · 班级公共总结`} />
        <div className="space-y-3 rounded-xl border border-border bg-card p-3.5">
          <p className="text-[12px] font-medium text-muted-foreground">
            {TEACHING_CLASS.name} · {TEACHING_CLASS.course} · 单元 {units.join(" + ")}
          </p>
          <SummaryLine label="本周内容" text={summary.content} />
          <SummaryLine label="整体掌握" text={summary.overall} />
          <SummaryLine label="整体亮点" text={summary.highlights} />
          <SummaryLine label="作业情况" text={summary.homework} />
          <SummaryLine label="下一步" text={summary.next} />
        </div>
      </section>

      {/* 我的孩子 */}
      <section>
        <SectionTitle icon={<GraduationCap className="size-4" />} title={`${child.name} · 本周表现`} />
        <div className="space-y-3">
          {units.map((u) => (
            <ChildUnitCard key={u} child={child} unit={u as UnitCode} />
          ))}
        </div>
      </section>

      {/* 周末作业 */}
      <section>
        <SectionTitle icon={<BookOpen className="size-4" />} title="周末作业" />
        <div className="rounded-xl border border-border bg-card p-3.5 text-[13px]">
          {weekend.none ? (
            <p className="text-muted-foreground">本周无周末作业，请安排孩子适当休息与复习。</p>
          ) : weekend.instructions ? (
            <div className="space-y-2">
              <p className="leading-relaxed text-foreground/90">{weekend.instructions}</p>
              {weekend.due ? (
                <p className="text-[12px] text-muted-foreground">截止：{weekend.due}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground">教师尚未填写周末作业说明。</p>
          )}
        </div>
      </section>

      {/* 反馈图片 */}
      <ParentImage room={child.homeroom} units={units} />

      <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        如对反馈有疑问，可通过班主任或任课教师联系。本页仅显示教师已发布的内容。
      </div>
    </div>
  )
}

function ChildUnitCard({ child, unit }: { child: (typeof STUDENTS)[number]; unit: UnitCode }) {
  const demo = useDemo()
  const f = demo.units[unit].feedback[child.id]
  const unitDef = UNITS.find((u) => u.code === unit)!

  const hasLeave = Object.values(f.attendance).some((a) => a === "leave")
  const hasElsewhere = Object.values(f.attendance).some((a) => a === "elsewhere")
  const grade = overallGrade(f, unitDef.teachingDays)

  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[13px] font-semibold">
          {unit} · {unitDef.title}
        </p>
        {grade ? (
          <Badge tone={GRADE_TONE[grade]}>课堂 {grade}</Badge>
        ) : hasLeave ? (
          <Badge tone="neutral">请假 · 未评价</Badge>
        ) : (
          <Badge tone="neutral">未记录</Badge>
        )}
      </div>

      <dl className="space-y-2 text-[12.5px]">
        <Row label="课堂表现">
          <SessionPerformance f={f} unitDef={unitDef} />
        </Row>

        {hasElsewhere ? (
          <Row label="跨班上课">
            <span className="text-muted-foreground">
              本周有课时在 {f.elsewhereTo ?? "其他班级"} 上课，课堂表现以该班记录为准。
            </span>
          </Row>
        ) : null}

        <Row label="作业">
          <HomeworkText f={f} unitDef={unitDef} />
        </Row>

        {f.highlights.length ? (
          <Row label="亮点">
            <div className="flex flex-wrap gap-1.5">
              {f.highlights.map((h) => (
                <Badge key={h} tone="success">
                  {h}
                </Badge>
              ))}
            </div>
          </Row>
        ) : null}

        {f.comment ? (
          <Row label="教师评语">
            <span className="leading-relaxed text-foreground/90">{f.comment}</span>
          </Row>
        ) : null}
      </dl>
    </div>
  )
}

function SessionPerformance({
  f,
  unitDef,
}: {
  f: StudentFeedback
  unitDef: (typeof UNITS)[number]
}) {
  const sessions = unitDef.teachingDays.filter((d) => {
    const att = f.attendance[d.date] ?? "present"
    return att === "present" && f.classroom[d.date]?.grade
  })
  if (!sessions.length) {
    const hasLeave = Object.values(f.attendance).some((a) => a === "leave")
    return (
      <span className="text-muted-foreground">
        {hasLeave ? "本周有请假，课堂表现未作评价。" : "未记录"}
      </span>
    )
  }
  return (
    <div className="space-y-1">
      {sessions.map((d) => {
        const c = f.classroom[d.date]!
        return (
          <div key={d.date} className="flex items-baseline gap-2">
            <Badge tone={GRADE_TONE[c.grade as keyof typeof GRADE_TONE]}>
              {d.weekday} {c.grade}
            </Badge>
            {c.note ? <span className="text-muted-foreground">{c.note}</span> : null}
          </div>
        )
      })}
    </div>
  )
}

function HomeworkText({ f, unitDef }: { f: StudentFeedback; unitDef: (typeof UNITS)[number] }) {
  const items = unitDef.teachingDays.map((d) => ({ d, h: f.homework[d.date] })).filter((x) => x.h)
  if (!items.length) return <span className="text-muted-foreground">无作业</span>
  return (
    <div className="space-y-1">
      {items.map(({ d, h }) => {
        const text =
          h!.status === "not_submitted" ? (
            <span className="text-[#9a2b22]">未提交，请关注</span>
          ) : h!.status === "pending" ? (
            <span className="text-muted-foreground">待教师确认</span>
          ) : h!.ungraded ? (
            <span>已提交，评分中</span>
          ) : (
            <span>已提交 · {h!.grade}</span>
          )
        return (
          <div key={d.date} className="flex items-baseline gap-2">
            <span className="text-muted-foreground">{d.weekday}</span>
            {text}
          </div>
        )
      })}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}

function SummaryLine({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null
  return (
    <div className="text-[13px]">
      <span className="font-medium text-primary">{label}</span>
      <p className="mt-0.5 leading-relaxed text-foreground/90">{text}</p>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
      <span className="text-primary">{icon}</span>
      {title}
    </div>
  )
}

function ParentImage({ room, units }: { room: string; units: string[] }) {
  const demo = useDemo()
  const { push } = useToast()
  const key = `parent-img:${room}`
  const img = demo.images[key] ?? { status: "idle" as const }

  const generate = async () => {
    demo.setImage(key, "generating")
    try {
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
        studentCount: STUDENTS.filter((x) => x.homeroom === room).length,
        sections: [
          { label: "本周内容", text: s.content },
          { label: "整体掌握", text: s.overall },
          { label: "整体亮点", text: s.highlights },
          { label: "作业情况", text: s.homework },
          { label: "下一步", text: s.next },
        ],
        weekend: w.none ? { title: "周末作业", body: "本周无周末作业。" } : w.instructions ? { title: "周末作业", body: w.instructions } : null,
      })
      demo.setImage(key, "ready", dataUrl)
    } catch {
      demo.setImage(key, "failed")
      push("图片生成失败，可重试", "danger")
    }
  }

  return (
    <section>
      <SectionTitle icon={<ImageIcon className="size-4" />} title="班级反馈图片" />
      <div className="rounded-xl border border-border bg-card p-3.5">
        {img.status === "ready" && img.dataUrl ? (
          <>
            <div className="overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.dataUrl} alt={`${room} 周反馈图片`} className="w-full" />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2.5 w-full"
              onClick={() => downloadDataUrl(img.dataUrl!, `${room}-周反馈.png`)}
            >
              <Download className="size-3.5" />
              保存图片
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2.5 py-2 text-center">
            <p className="text-[12.5px] text-muted-foreground">可将本周班级公共总结生成为图片保存或转发。</p>
            <Button size="sm" onClick={generate} disabled={img.status === "generating"} className="w-full">
              {img.status === "generating" ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  生成中…
                </>
              ) : img.status === "failed" ? (
                <>
                  <RefreshCw className="size-3.5" />
                  重试生成
                </>
              ) : (
                <>
                  <ImageIcon className="size-3.5" />
                  生成反馈图片
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
