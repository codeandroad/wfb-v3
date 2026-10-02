"use client"

import {
  Badge,
  Card,
  CardHeader,
  Checkbox,
  Dot,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Modal,
  PageHeader,
  Segmented,
  Sheet,
  Tabs,
  Textarea,
  useToast,
} from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  GRADES,
  hasClassroomRecord,
  hasPendingHomework,
  STUDENTS,
  TEACHING_CLASS,
  UNITS,
  WEEK_LABEL,
  type Grade,
  type HomeworkState,
  type Student,
  type StudentFeedback,
} from "@/lib/demo/data"
import { moduleEnabled } from "@/lib/demo/nav"
import { unitProgress, unitStatus, useDemo, type UnitState } from "@/lib/demo/store"
import { CheckCheck, PlugZap, Sparkles, Wand2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">加载中…</div>}>
      <FeedbackInner />
    </Suspense>
  )
}

type Filter = "all" | "todo" | "exception" | "homework" | "highlight"
type TabKey = "students" | "summary" | "homework"

function FeedbackInner() {
  const demo = useDemo()
  const router = useRouter()
  const params = useSearchParams()
  const { push } = useToast()

  const rawUnit = params.get("unit")
  const unitCode = (rawUnit === "S1" || rawUnit === "M1" ? rawUnit : "P1") as "P1" | "S1" | "M1"
  const unitDef = UNITS.find((u) => u.code === unitCode)!
  const unit = demo.units[unitCode]

  const [tab, setTab] = useState<TabKey>("students")
  const [filter, setFilter] = useState<Filter>("all")
  const [openStudent, setOpenStudent] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!moduleEnabled("teaching", demo.config)) {
    return (
      <div>
        <PageHeader title="周反馈编辑" desc="演示配置 B · 教学反馈模块未接入" />
        <EmptyState
          tone="warning"
          icon={<PlugZap className="size-7" />}
          title="教学反馈模块未接入"
          desc="当前演示配置 B 未接入教学与数据模块，无法编辑周反馈。请在原型演示控制切换回配置 A。"
        />
      </div>
    )
  }

  const published = !!demo.publication?.units.includes(unitCode)
  const st = unitStatus(unit, published)
  const p = unitProgress(unit)

  const rows = STUDENTS.filter((s) => applyFilter(filter, unit.feedback[s.id]))

  const batchPreview = previewBatch(unit)

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {unitCode} · {unitDef.title}
            <StatusPill status={st} />
          </span>
        }
        desc={`${TEACHING_CLASS.name} · ${TEACHING_CLASS.course} · ${WEEK_LABEL}`}
        actions={
          <div className="flex items-center gap-2">
            <Segmented
              size="sm"
              ariaLabel="切换单元"
              value={unitCode}
              onChange={(v) => router.push(`/feedback?unit=${v}`)}
              options={UNITS.map((u) => ({ value: u.code, label: u.code }))}
            />
            <LinkButton href="/publish" variant="outline">
              前往发布
            </LinkButton>
          </div>
        }
      />

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as TabKey)}
          tabs={[
            { value: "students", label: "学生逐项", badge: p.pending > 0 ? <Badge tone="warning">{p.pending}</Badge> : null },
            { value: "summary", label: "公共总结" },
            { value: "homework", label: "周末作业" },
          ]}
        />
      </div>

      {tab === "students" ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <Segmented
              size="sm"
              ariaLabel="筛选学生"
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: "all", label: `全部 ${STUDENTS.length}` },
                { value: "todo", label: `待处理 ${p.pending}` },
                { value: "exception", label: `例外 ${p.exceptions}` },
                { value: "homework", label: `作业待确认 ${p.pendingHomework}` },
                { value: "highlight", label: "亮点" },
              ]}
            />
            <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={published}>
              <CheckCheck className="size-3.5" />
              批量确认常规情况
            </Button>
          </div>

          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="没有符合筛选条件的学生" desc="切换筛选条件查看其他学生。" />
            </div>
          ) : (
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-[13px]">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">学生</th>
                    <th className="px-4 py-2.5 font-medium">课堂表现</th>
                    <th className="px-4 py-2.5 font-medium">考勤 / 例外</th>
                    <th className="px-4 py-2.5 font-medium">作业</th>
                    <th className="px-4 py-2.5 font-medium">亮点</th>
                    <th className="px-4 py-2.5 font-medium">评语</th>
                    <th className="px-4 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <StudentRow
                      key={s.id}
                      student={s}
                      f={unit.feedback[s.id]}
                      unit={unitDef}
                      onOpen={() => setOpenStudent(s.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === "summary" ? <SummaryTab unitCode={unitCode} /> : null}
      {tab === "homework" ? <WeekendTab unitCode={unitCode} /> : null}

      {/* 学生详情抽屉 */}
      <StudentDrawer
        unitCode={unitCode}
        studentId={openStudent}
        onClose={() => setOpenStudent(null)}
        published={published}
      />

      {/* 批量确认弹窗 */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="批量确认常规课堂情况"
        desc="用于快速确认没有特殊情况的学生，例外与已单独记录的学生会自动排除。"
        width="max-w-lg"
        footer={
          <>
            <button
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted"
              onClick={() => setConfirmOpen(false)}
            >
              取消
            </button>
            <button
              className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
              disabled={batchPreview.affected === 0}
              onClick={() => {
                const r = demo.batchConfirmRoutine(unitCode, "A-")
                setConfirmOpen(false)
                push(`已确认 ${r.affected} 名学生，自动排除 ${r.excluded.length} 名例外/已记录学生`)
              }}
            >
              确认 {batchPreview.affected} 名学生
            </button>
          </>
        }
      >
        <div className="space-y-3 text-[13px]">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="font-medium">将确认（默认课堂表现 A-）</p>
            <p className="mt-1 text-muted-foreground">
              {batchPreview.affected} 名尚未记录、且本周无考勤例外的学生。
            </p>
          </div>
          <div className="rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] p-3">
            <p className="font-medium text-[#7a5514]">自动排除</p>
            <ul className="mt-1 space-y-1 text-[#7a5514]">
              <li>· 有考勤例外：{batchPreview.exceptions.map((id) => name(id)).join("、") || "无"}</li>
              <li>· 已单独记录：{batchPreview.recorded.length} 名</li>
            </ul>
            <p className="mt-2 text-xs text-[#7a5514]/80">例外学生需在其详情中单独判断课堂表现。</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ---------------- 行 ---------------- */

function StudentRow({
  student,
  f,
  unit,
  onOpen,
}: {
  student: Student
  f: StudentFeedback
  unit: (typeof UNITS)[number]
  onOpen: () => void
}) {
  return (
    <tr className="border-t border-border hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{student.name}</span>
          {student.asOnly ? <Badge tone="neutral">仅 AS</Badge> : null}
        </div>
        <span className="text-xs text-muted-foreground">{student.homeroom}</span>
      </td>
      <td className="px-4 py-3">
        <ClassroomCell f={f} unit={unit} />
      </td>
      <td className="px-4 py-3">
        <AttendanceCell f={f} unit={unit} />
      </td>
      <td className="px-4 py-3">
        <HomeworkCell f={f} unit={unit} />
      </td>
      <td className="px-4 py-3">
        <HighlightCell f={f} />
      </td>
      <td className="max-w-52 px-4 py-3">
        {f.comment ? (
          <span className="line-clamp-2 text-muted-foreground">
            {f.commentIsDraft ? <Badge tone="info" className="mr-1">草稿</Badge> : null}
            {f.comment}
          </span>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <Button size="xs" variant="outline" onClick={onOpen}>
          详情
        </Button>
      </td>
    </tr>
  )
}

function ClassroomCell({ f, unit }: { f: StudentFeedback; unit: (typeof UNITS)[number] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {unit.teachingDays.map((d) => {
        const att = f.attendance[d.date]
        if (att && att !== "present") {
          return (
            <span key={d.date} title={att === "leave" ? "请假，无法评价" : "在他班上课，不计入本班"}>
              <Badge tone="neutral">
                {d.weekday} {att === "leave" ? "请假" : "他班"}
              </Badge>
            </span>
          )
        }
        const g = f.classroom[d.date]?.grade
        if (!g) {
          return (
            <span
              key={d.date}
              className="rounded-md border border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted-foreground/60"
            >
              {d.weekday} —
            </span>
          )
        }
        return (
          <Badge key={d.date} tone={gradeTone(g)}>
            {d.weekday} {g}
          </Badge>
        )
      })}
    </div>
  )
}

function AttendanceCell({ f, unit }: { f: StudentFeedback; unit: (typeof UNITS)[number] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {unit.teachingDays.map((d) => {
        const kind = f.attendance[d.date] ?? "present"
        const tone = kind === "present" ? "success" : kind === "leave" ? "warning" : "info"
        const label = kind === "present" ? "出勤" : kind === "leave" ? "请假" : "在他班"
        return (
          <Badge key={d.date} tone={tone as never}>
            {d.weekday} {label}
          </Badge>
        )
      })}
    </div>
  )
}

function HomeworkCell({ f, unit }: { f: StudentFeedback; unit: (typeof UNITS)[number] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {unit.teachingDays.map((d) => {
        const h = f.homework[d.date]
        if (!h) return null
        return (
          <span key={d.date} className="inline-flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">{d.weekday}</span>
            <HomeworkStateBadge h={h} />
          </span>
        )
      })}
    </div>
  )
}

function HomeworkStateBadge({ h }: { h: HomeworkState }) {
  if (h.status === "pending") return <Badge tone="danger">待确认</Badge>
  if (h.status === "not_submitted") return <Badge tone="danger">未交</Badge>
  if (h.ungraded) return <Badge tone="info">待评分</Badge>
  return <Badge tone="success">已交·{h.grade}</Badge>
}

function HighlightCell({ f }: { f: StudentFeedback }) {
  if (f.highlights.length) {
    return (
      <div className="flex flex-wrap gap-1">
        {f.highlights.map((h) => (
          <Badge key={h} tone="primary">
            {h}
          </Badge>
        ))}
      </div>
    )
  }
  if (f.suggestedHighlights.length) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#2a5b6e]">
        <Sparkles className="size-3" />
        有建议待确认
      </span>
    )
  }
  return <span className="text-muted-foreground/60">—</span>
}

/* ---------------- 学生详情抽屉 ---------------- */

function StudentDrawer({
  unitCode,
  studentId,
  onClose,
  published,
}: {
  unitCode: "P1" | "S1" | "M1"
  studentId: string | null
  onClose: () => void
  published: boolean
}) {
  const demo = useDemo()
  const { push } = useToast()
  const [custom, setCustom] = useState("")
  const unitDef = UNITS.find((u) => u.code === unitCode)!
  if (!studentId) return null
  const student = STUDENTS.find((s) => s.id === studentId)!
  const f = demo.units[unitCode].feedback[studentId]
  const suggestions = Array.from(new Set([...f.suggestedHighlights, "课堂参与积极", "书写规范", "乐于助人"]))

  return (
    <Sheet
      open={!!studentId}
      onClose={onClose}
      width="max-w-lg"
      title={`${student.name} · ${unitCode}`}
      desc={`${student.homeroom} · ${published ? "已发布，编辑将进入新版本" : "草稿编辑中"}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
          <Button
            size="sm"
            onClick={() => {
              demo.confirmStudent(unitCode, studentId)
              push(`已确认 ${student.name} 的本周情况`)
              onClose()
            }}
          >
            确认该学生
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {student.parentContactMissing ? (
          <div className="rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] p-3 text-[13px] text-[#7a5514]">
            该学生缺少家长联系方式。反馈仍可正常记录与发布，但系统不会自动送达，需手动转达。
          </div>
        ) : null}

        {/* 考勤 */}
        <section>
          <p className="mb-2 text-[13px] font-medium">本周课节考勤</p>
          <div className="space-y-2">
            {unitDef.teachingDays.map((d) => {
              const val = f.attendance[d.date] ?? "present"
              return (
                <div key={d.date} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <span className="text-[13px]">
                    {d.weekday} · {d.date.slice(5)}（{d.periods} 节）
                  </span>
                  <Segmented
                    size="sm"
                    ariaLabel="考勤"
                    value={val}
                    onChange={(v) => demo.setAttendance(unitCode, studentId, d.date, v)}
                    options={[
                      { value: "present", label: "出勤" },
                      { value: "leave", label: "请假" },
                      { value: "elsewhere", label: "在他班" },
                    ]}
                  />
                </div>
              )
            })}
          </div>
          {f.elsewhereTo ? (
            <p className="mt-2 text-xs text-muted-foreground">在他班上课：{f.elsewhereTo}（该课节不计入本班表现）</p>
          ) : null}
        </section>

        {/* 课堂表现（按课节） */}
        <section>
          <p className="mb-2 text-[13px] font-medium">课堂表现（按课节）</p>
          <div className="space-y-2.5">
            {unitDef.teachingDays.map((d) => {
              const att = f.attendance[d.date] ?? "present"
              const c = f.classroom[d.date]
              return (
                <div key={d.date} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">
                      {d.weekday} · {d.date.slice(5)}（{d.periods} 节）
                    </span>
                    {att !== "present" ? (
                      <Badge tone={att === "leave" ? "warning" : "info"}>{att === "leave" ? "请假" : "在他班"}</Badge>
                    ) : null}
                  </div>
                  {att !== "present" ? (
                    <p className="text-xs text-muted-foreground">
                      该次课不计入本班课堂表现
                      {att === "leave" ? "（本次请假）" : `（在 ${f.elsewhereTo ?? "他班"} 上课）`}。
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {GRADES.map((g) => (
                          <button
                            key={g}
                            onClick={() => demo.setClassroomGrade(unitCode, studentId, d.date, g)}
                            className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                              c?.grade === g
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card hover:bg-muted"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2">
                        <Input
                          placeholder="本次课堂备注（可选，仅教师可见）"
                          value={c?.note ?? ""}
                          onChange={(e) => demo.setClassroomNote(unitCode, studentId, d.date, e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* 作业（按课节） */}
        <section>
          <p className="mb-2 text-[13px] font-medium">作业（按课节）</p>
          <div className="space-y-2">
            {unitDef.teachingDays.map((d) => {
              const h = f.homework[d.date]
              if (!h) return null
              return (
                <div key={d.date} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">
                      {d.weekday} · {d.date.slice(5)}
                    </span>
                    <HomeworkStateBadge h={h} />
                  </div>
                  {h.status === "pending" ? (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => demo.resolveHomework(unitCode, studentId, d.date, "not_submitted")}
                      >
                        确认未交
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => demo.resolveHomework(unitCode, studentId, d.date, "submitted")}
                      >
                        其实已交
                      </Button>
                    </div>
                  ) : null}
                  {h.ungraded ? (
                    <p className="mt-2 text-xs text-muted-foreground">已提交但尚未评分——不会显示为未交，可稍后补录评分。</p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>

        {/* 亮点 */}
        <section>
          <p className="mb-2 text-[13px] font-medium">具体亮点</p>
          <div className="space-y-1.5">
            {suggestions.map((h) => (
              <Checkbox
                key={h}
                checked={f.highlights.includes(h)}
                onChange={() => demo.toggleHighlight(unitCode, studentId, h)}
                label={
                  <span>
                    {h}
                    {f.suggestedHighlights.includes(h) ? (
                      <Badge tone="info" className="ml-1.5">
                        系统建议
                      </Badge>
                    ) : null}
                  </span>
                }
              />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input placeholder="自定义亮点" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (custom.trim()) {
                  demo.toggleHighlight(unitCode, studentId, custom.trim())
                  setCustom("")
                }
              }}
            >
              添加
            </Button>
          </div>
        </section>

        {/* 评语 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium">个别评语（可选）</p>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                const s = STUDENTS.find((x) => x.id === studentId)!
                const hl = f.highlights.length ? f.highlights.join("、") : "课堂参与稳定"
                demo.setComment(unitCode, studentId, `${s.name}本周表现：${hl}。建议：继续保持，尝试口头复述解题思路。`)
                push("已生成评语草稿，可继续修改")
              }}
            >
              <Wand2 className="size-3.5" />
              生成草稿
            </Button>
          </div>
          <Textarea
            placeholder="给该学生的个别评语（发布后家长可见）"
            value={f.comment}
            onChange={(e) => demo.setComment(unitCode, studentId, e.target.value)}
          />
        </section>
      </div>
    </Sheet>
  )
}

/* ---------------- 公共总结 ---------------- */

function SummaryTab({ unitCode }: { unitCode: "P1" | "S1" | "M1" }) {
  const demo = useDemo()
  const { push } = useToast()
  const unit = demo.units[unitCode]
  const fields: { key: keyof typeof unit.summary; label: string; hint: string }[] = [
    { key: "content", label: "本周内容", hint: "本周教授的主题与重点" },
    { key: "overall", label: "整体掌握", hint: "全班整体情况，面向家长" },
    { key: "highlights", label: "整体亮点", hint: "值得表扬的共性表现" },
    { key: "homework", label: "作业情况", hint: "提交与完成概况" },
    { key: "next", label: "下一步", hint: "下周计划与家长可协助之处" },
  ]
  return (
    <Card>
      <CardHeader
        title="公共总结（面向全班家长）"
        desc="所有关联家长都会看到的统一内容；个别评语单独在学生详情中填写。"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              demo.generateDrafts(unitCode)
              push("已生成公共总结与部分评语草稿，请检查后再发布")
            }}
          >
            <Wand2 className="size-3.5" />
            生成草稿
          </Button>
        }
      />
      <div className="space-y-4 px-5 py-5">
        {fields.map((fl) => (
          <Field key={fl.key} label={fl.label} hint={fl.hint}>
            <Textarea
              value={unit.summary[fl.key]}
              onChange={(e) => demo.setSummaryField(unitCode, fl.key, e.target.value)}
              placeholder={`填写${fl.label}…`}
            />
          </Field>
        ))}
      </div>
    </Card>
  )
}

/* ---------------- 周末作业 ---------------- */

function WeekendTab({ unitCode }: { unitCode: "P1" | "S1" | "M1" }) {
  const demo = useDemo()
  const { push } = useToast()
  const w = demo.units[unitCode].weekendHomework
  return (
    <Card>
      <CardHeader title="周末作业" desc="随本周反馈一起发布给家长；也可明确标记本周无作业。" />
      <div className="space-y-4 px-5 py-5">
        <Checkbox
          checked={w.none}
          onChange={(v) => demo.setWeekendHomework(unitCode, { none: v })}
          label="本周无周末作业（将向家长明确说明）"
        />
        <div className={w.none ? "pointer-events-none space-y-4 opacity-50" : "space-y-4"}>
          <Field label="作业说明" hint="面向家长的清晰描述">
            <Textarea
              value={w.instructions}
              onChange={(e) => demo.setWeekendHomework(unitCode, { instructions: e.target.value })}
              placeholder="例如：完成专题练习册第 20–22 页，重点复习有效数字。"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="截止时间">
              <Input
                type="date"
                value={w.due}
                onChange={(e) => demo.setWeekendHomework(unitCode, { due: e.target.value })}
              />
            </Field>
            <Field label="附件（占位）">
              <Input
                value={w.attachment}
                onChange={(e) => demo.setWeekendHomework(unitCode, { attachment: e.target.value })}
                placeholder="练习册第20-22页.pdf"
              />
            </Field>
          </div>
          <Field label="必做" hint="全体学生需完成">
            <Input
              value={w.required}
              onChange={(e) => demo.setWeekendHomework(unitCode, { required: e.target.value })}
              placeholder="练习册 20–21 页全部题目"
            />
          </Field>
          <Field label="选做" hint="学有余力可选">
            <Input
              value={w.optional}
              onChange={(e) => demo.setWeekendHomework(unitCode, { optional: e.target.value })}
              placeholder="第 22 页挑战题"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => push("周末作业已保存到本周反馈草稿")}>
            保存周末作业
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* ---------------- helpers ---------------- */

function name(id: string) {
  return STUDENTS.find((s) => s.id === id)?.name ?? id
}

function gradeTone(g: Grade) {
  if (g === "A+" || g === "A") return "success"
  if (g === "A-" || g === "B") return "primary"
  return "warning"
}

function applyFilter(filter: Filter, f: StudentFeedback) {
  const hasException = Object.values(f.attendance).some((a) => a !== "present")
  switch (filter) {
    case "todo":
      return !f.confirmed && !hasClassroomRecord(f)
    case "exception":
      return hasException
    case "homework":
      return hasPendingHomework(f)
    case "highlight":
      return f.highlights.length > 0 || f.suggestedHighlights.length > 0
    default:
      return true
  }
}

function previewBatch(unit: UnitState) {
  const exceptions: string[] = []
  const recorded: string[] = []
  let affected = 0
  for (const sid of Object.keys(unit.feedback)) {
    const f = unit.feedback[sid]
    const hasException = Object.values(f.attendance).some((a) => a !== "present")
    if (hasException) {
      exceptions.push(sid)
      continue
    }
    if (f.confirmed || hasClassroomRecord(f)) {
      recorded.push(sid)
      continue
    }
    affected++
  }
  return { affected, exceptions, recorded }
}

function StatusPill({ status }: { status: { key: string; label: string } }) {
  const tone =
    status.key === "published"
      ? "success"
      : status.key === "pending"
        ? "warning"
        : status.key === "in_progress"
          ? "info"
          : "neutral"
  return (
    <Badge tone={tone as never}>
      <Dot tone={tone as never} />
      {status.label}
    </Badge>
  )
}
