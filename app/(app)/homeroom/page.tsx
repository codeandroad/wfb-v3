"use client"

import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Segmented,
  Select,
  Sheet,
  Textarea,
  useToast,
} from "@/components/kit"
import { Button } from "@/components/ui/button"
import { WEEK_LABEL } from "@/lib/demo/data"
import { HomeroomPublications } from "@/components/mt/homeroom-publications"
import {
  mainHeadTeacherOf,
  studentProfilesByClass,
  type BehaviorRecord,
  type StudentProfile,
} from "@/lib/demo/school"
import { moduleEnabled } from "@/lib/demo/nav"
import { useDemo } from "@/lib/demo/store"
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  Eye,
  Home,
  Lock,
  MessageSquare,
  Plus,
  PlugZap,
  Sparkles,
  Undo2,
  Users,
} from "lucide-react"
import { useMemo, useState } from "react"

// 当前班主任负责的主班（演示：同时带两个班）
const MY_HOMEROOMS = ["高一1班", "高一2班"] as const

type LeaveType = "事假" | "病假" | "公假"
const LEAVE_TYPES: LeaveType[] = ["事假", "病假", "公假"]

interface LeaveRecord {
  id: string
  studentId: string
  type: LeaveType
  from: string
  to: string
  reason: string
}

type BehaviorKind = BehaviorRecord["kind"]
const BEHAVIOR_KINDS: BehaviorKind[] = ["表扬", "提醒", "事件"]
const BEHAVIOR_TONE = { 表扬: "success", 提醒: "warning", 事件: "info" } as const

interface LocalBehavior {
  id: string
  studentId: string
  date: string
  kind: BehaviorKind
  title: string
  note: string
}

type InterviewWith = "家长" | "学生" | "家长 + 学生"
const INTERVIEW_WITH: InterviewWith[] = ["家长", "学生", "家长 + 学生"]

interface InterviewRecord {
  id: string
  studentId: string
  date: string
  time: string
  with: InterviewWith
  topic: string
  note: string
}

// 当前登记教师（演示）
const CURRENT_TEACHER = "示例林老师"

export default function HomeroomPage() {
  const demo = useDemo()
  const [room, setRoom] = useState<string | null>(null)
  const [active, setActive] = useState<StudentProfile | null>(null)

  const [leaves, setLeaves] = useState<LeaveRecord[]>([])
  const [behaviors, setBehaviors] = useState<LocalBehavior[]>([])
  const [interviews, setInterviews] = useState<InterviewRecord[]>([])

  if (!moduleEnabled("teaching", demo.config)) {
    return (
      <div>
        <PageHeader title="我的主班" desc="演示配置 B · 教学模块未接入" />
        <EmptyState
          tone="warning"
          icon={<PlugZap className="size-7" />}
          title="教学模块未接入"
          desc="请在原型演示控制切换回配置 A。"
        />
      </div>
    )
  }

  function leavesFor(studentId: string) {
    return leaves.filter((l) => l.studentId === studentId)
  }
  function behaviorsFor(studentId: string) {
    return behaviors.filter((b) => b.studentId === studentId)
  }
  function interviewsFor(studentId: string) {
    return interviews.filter((i) => i.studentId === studentId)
  }

  // 主班列表视图
  if (!room) {
    return (
      <div>
        <PageHeader title="我的主班" desc={`班主任视角 · ${WEEK_LABEL}`} />
        <div className="grid gap-4 sm:grid-cols-2">
          {MY_HOMEROOMS.map((r) => {
            const students = studentProfilesByClass(r)
            const onLeave = students.filter((s) => leavesFor(s.id).length).length
            return (
              <button
                key={r}
                onClick={() => setRoom(r)}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="size-5" />
                  </span>
                  <Badge tone={onLeave ? "warning" : "success"}>
                    {onLeave ? `${onLeave} 人请假中` : "全员在校"}
                  </Badge>
                </div>
                <div>
                  <p className="text-[15px] font-semibold">{r}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    班主任 {mainHeadTeacherOf(r) ?? "暂缺"} · {students.length} 名学生
                  </p>
                </div>
                <span className="text-[13px] font-medium text-primary">进入管理 →</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <Lock className="size-3.5" />
            班主任视角
          </span>
          ：可管理本班学生的考勤请假、行为记录与面谈预约，并查看任课教师<strong>已发布</strong>的周反馈。未发布的内部草稿不会出现在这里。
        </div>
      </div>
    )
  }

  const students = studentProfilesByClass(room)
  const onLeaveCount = students.filter((s) => leavesFor(s.id).length).length

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => setRoom(null)}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          返回主班列表
        </button>
      </div>

      <PageHeader title={room} desc={`班主任管理 · ${students.length} 名学生 · 请假中 ${onLeaveCount} 人`} />

      <Card className="mb-5 p-0">
        <CardHeader
          title="学生名册"
          desc="点击学生姓名查看详情：选课情况、行为记录、请假与面谈。"
        />
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="w-14 px-4 py-2.5 font-medium">序号</th>
                <th className="px-4 py-2.5 font-medium">学生</th>
                <th className="px-4 py-2.5 font-medium">性别</th>
                <th className="px-4 py-2.5 font-medium">进班日期</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const recs = leavesFor(s.id)
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setActive(s)}
                        className="inline-flex items-center gap-2.5 font-medium text-primary transition-colors hover:underline"
                      >
                        <span className="flex size-7 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
                          {s.name.slice(-2)}
                        </span>
                        {s.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.gender}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{s.joinClassDate}</td>
                    <td className="px-4 py-3">
                      {recs.length ? <Badge tone="warning">请假中</Badge> : <Badge tone="success">在校</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="xs" onClick={() => setActive(s)}>
                        详情
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <PublishedFeedback room={room} />

      {active ? (
        <StudentDetailSheet
          key={active.id}
          student={active}
          leaves={leavesFor(active.id)}
          behaviors={behaviorsFor(active.id)}
          interviews={interviewsFor(active.id)}
          onAddLeave={(input) => setLeaves((ls) => [...ls, { ...input, id: `lv-${Date.now().toString(36)}` }])}
          onRemoveLeave={(id) => setLeaves((ls) => ls.filter((l) => l.id !== id))}
          onAddBehavior={(input) => setBehaviors((bs) => [...bs, { ...input, id: `bh-${Date.now().toString(36)}` }])}
          onAddInterview={(input) => setInterviews((is) => [...is, { ...input, id: `iv-${Date.now().toString(36)}` }])}
          onClose={() => setActive(null)}
        />
      ) : null}
    </div>
  )
}

function StudentDetailSheet({
  student,
  leaves,
  behaviors,
  interviews,
  onAddLeave,
  onRemoveLeave,
  onAddBehavior,
  onAddInterview,
  onClose,
}: {
  student: StudentProfile
  leaves: LeaveRecord[]
  behaviors: LocalBehavior[]
  interviews: InterviewRecord[]
  onAddLeave: (input: Omit<LeaveRecord, "id">) => void
  onRemoveLeave: (id: string) => void
  onAddBehavior: (input: Omit<LocalBehavior, "id">) => void
  onAddInterview: (input: Omit<InterviewRecord, "id">) => void
  onClose: () => void
}) {
  const [openForm, setOpenForm] = useState<null | "leave" | "behavior" | "interview">(null)

  // 合并系统内既有行为记录与本地新增，按日期倒序
  const mergedBehaviors = useMemo(() => {
    const base = student.behaviors.map((b) => ({ ...b, local: false as const }))
    const local = behaviors.map((b) => ({
      id: b.id,
      date: b.date,
      kind: b.kind,
      title: b.title,
      note: b.note,
      by: CURRENT_TEACHER,
      scope: `${student.adminClass}（班主任登记）`,
      local: true as const,
    }))
    return [...local, ...base].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [student, behaviors])

  return (
    <Sheet
      open
      onClose={onClose}
      title={student.name}
      desc={`${student.adminClass} · ${student.gender} · 进班 ${student.joinClassDate}`}
      width="max-w-2xl"
      footer={
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* 主班信息 */}
        <section>
          <SectionTitle icon={<Home className="size-3.5 text-primary" />}>主班信息</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <InfoTile label="性别" value={student.gender} />
            <InfoTile label="进班日期" value={student.joinClassDate} icon={<CalendarDays className="size-3" />} />
            <InfoTile label="修读路径" value={student.path === "AS" ? "AS 阶段" : "完整 A Level"} />
            <InfoTile label="主班主任" value={mainHeadTeacherOf(student.adminClass) ?? "暂缺"} muted={!mainHeadTeacherOf(student.adminClass)} />
          </div>
        </section>

        {/* 选课情况 */}
        <section>
          <SectionTitle icon={<BookOpen className="size-3.5 text-primary" />}>
            选课情况
            <span className="text-xs font-normal text-muted-foreground">（{student.courses.length} 门课程）</span>
          </SectionTitle>
          <div className="space-y-2">
            {student.courses.map((c) => (
              <div key={c.teachingClass} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-medium">{c.course}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.teachingClass}</p>
                  </div>
                  <Badge tone={c.status === "在读" ? "success" : "neutral"}>{c.status}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{c.role}</span>
                  <span className="text-muted-foreground/40">·</span>
                  {c.units.map((u) => (
                    <span
                      key={u.short}
                      className="rounded-md bg-accent px-1.5 py-0.5 text-xs font-medium text-primary"
                      title={u.name}
                    >
                      {u.short} · {u.name}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground/80">选课生效日 {c.since}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 行为记录 */}
        <section>
          <SectionTitle
            icon={<Sparkles className="size-3.5 text-primary" />}
            action={
              <RecordToggle
                open={openForm === "behavior"}
                onClick={() => setOpenForm((f) => (f === "behavior" ? null : "behavior"))}
                label="添加行为记录"
              />
            }
          >
            行为记录
            <span className="text-xs font-normal text-muted-foreground">（{mergedBehaviors.length} 条）</span>
          </SectionTitle>

          {openForm === "behavior" ? (
            <BehaviorForm
              studentName={student.name}
              onCancel={() => setOpenForm(null)}
              onSubmit={(input) => {
                onAddBehavior({ ...input, studentId: student.id })
                setOpenForm(null)
              }}
            />
          ) : null}

          {mergedBehaviors.length ? (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {mergedBehaviors.map((b) => (
                <li key={b.id} className="relative">
                  <span
                    className="absolute -left-[21px] top-1 flex size-2.5 items-center justify-center rounded-full ring-2 ring-card"
                    style={{ background: "var(--primary)" }}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={BEHAVIOR_TONE[b.kind]}>{b.kind}</Badge>
                    <span className="text-[13px] font-medium">{b.title}</span>
                    <span className="text-xs text-muted-foreground">{b.date}</span>
                    {b.local ? <Badge tone="neutral">本次登记</Badge> : null}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{b.note}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    记录人 {b.by} · {b.scope}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyLine>暂无行为记录，可添加表扬、提醒或事件。</EmptyLine>
          )}
        </section>

        {/* 请假记录 */}
        <section>
          <SectionTitle
            icon={<CalendarOff className="size-3.5 text-primary" />}
            action={
              <RecordToggle
                open={openForm === "leave"}
                onClick={() => setOpenForm((f) => (f === "leave" ? null : "leave"))}
                label="登记请假"
              />
            }
          >
            请假记录
            <span className="text-xs font-normal text-muted-foreground">（{leaves.length} 条）</span>
          </SectionTitle>

          {openForm === "leave" ? (
            <LeaveForm
              onCancel={() => setOpenForm(null)}
              onSubmit={(input) => {
                onAddLeave({ ...input, studentId: student.id })
                setOpenForm(null)
              }}
            />
          ) : null}

          {leaves.length ? (
            <div className="space-y-2">
              {leaves.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2.5"
                >
                  <Badge tone="info">{l.type}</Badge>
                  <span className="text-[13px] text-muted-foreground">
                    {fmt(l.from)} – {fmt(l.to)}
                    {l.reason ? ` · ${l.reason}` : ""}
                  </span>
                  <button
                    onClick={() => onRemoveLeave(l.id)}
                    className="ml-auto inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Undo2 className="size-3" />
                    销假
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine>本周暂无请假记录。请假会同步排除任课教师对应课节的课堂评价。</EmptyLine>
          )}
        </section>

        {/* 面谈预约 */}
        <section>
          <SectionTitle
            icon={<MessageSquare className="size-3.5 text-primary" />}
            action={
              <RecordToggle
                open={openForm === "interview"}
                onClick={() => setOpenForm((f) => (f === "interview" ? null : "interview"))}
                label="新建面谈预约"
              />
            }
          >
            面谈预约
            <span className="text-xs font-normal text-muted-foreground">（{interviews.length} 条）</span>
          </SectionTitle>

          {openForm === "interview" ? (
            <InterviewForm
              onCancel={() => setOpenForm(null)}
              onSubmit={(input) => {
                onAddInterview({ ...input, studentId: student.id })
                setOpenForm(null)
              }}
            />
          ) : null}

          {interviews.length ? (
            <div className="space-y-2">
              {interviews.map((iv) => (
                <div key={iv.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="primary">
                      <CalendarClock className="size-3" />
                      {iv.date} {iv.time}
                    </Badge>
                    <span className="text-[13px] font-medium">{iv.topic}</span>
                    <span className="text-xs text-muted-foreground">面谈对象：{iv.with}</span>
                  </div>
                  {iv.note ? (
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{iv.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine>暂无面谈预约。可约定与家长或学生的面谈时间与主题。</EmptyLine>
          )}
        </section>
      </div>
    </Sheet>
  )
}

function BehaviorForm({
  studentName,
  onCancel,
  onSubmit,
}: {
  studentName: string
  onCancel: () => void
  onSubmit: (input: Omit<LocalBehavior, "id" | "studentId">) => void
}) {
  const { push: toast } = useToast()
  const [kind, setKind] = useState<BehaviorKind>("表扬")
  const [date, setDate] = useState("2026-09-18")
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")

  return (
    <FormShell>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="类型">
            <Segmented<BehaviorKind>
              size="sm"
              value={kind}
              onChange={setKind}
              options={BEHAVIOR_KINDS.map((k) => ({ value: k, label: k }))}
            />
          </Field>
          <Field label="日期">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="标题">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：课堂积极发言" />
        </Field>
        <Field label="说明">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={`记录 ${studentName} 的具体表现或事件经过`}
          />
        </Field>
      </div>
      <FormActions
        onCancel={onCancel}
        onSubmit={() => {
          if (!title.trim()) {
            toast("请填写行为记录标题")
            return
          }
          onSubmit({ kind, date, title: title.trim(), note: note.trim() })
          toast(`已为 ${studentName} 添加${kind}记录`)
        }}
        submitLabel="添加记录"
      />
    </FormShell>
  )
}

function LeaveForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (input: Omit<LeaveRecord, "id" | "studentId">) => void
}) {
  const { push: toast } = useToast()
  const [type, setType] = useState<LeaveType>("事假")
  const [from, setFrom] = useState("2026-09-14")
  const [to, setTo] = useState("2026-09-14")
  const [reason, setReason] = useState("")

  return (
    <FormShell>
      <div className="grid gap-3">
        <Field label="请假类型">
          <Segmented<LeaveType>
            size="sm"
            value={type}
            onChange={setType}
            options={LEAVE_TYPES.map((t) => ({ value: t, label: t }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="起始日期">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="结束日期">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label="事由（可选）">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="如：家中有事、就医、校队比赛等"
          />
        </Field>
      </div>
      <FormActions
        onCancel={onCancel}
        onSubmit={() => {
          if (to < from) {
            toast("结束日期不能早于起始日期")
            return
          }
          onSubmit({ type, from, to, reason: reason.trim() })
          toast(`已登记${type}`)
        }}
        submitLabel="登记请假"
      />
    </FormShell>
  )
}

function InterviewForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (input: Omit<InterviewRecord, "id" | "studentId">) => void
}) {
  const { push: toast } = useToast()
  const [date, setDate] = useState("2026-09-21")
  const [time, setTime] = useState("16:30")
  const [wth, setWth] = useState<InterviewWith>("家长")
  const [topic, setTopic] = useState("")
  const [note, setNote] = useState("")

  return (
    <FormShell>
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="日期">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="时间">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="面谈对象">
            <Select value={wth} onChange={(e) => setWth(e.target.value as InterviewWith)}>
              {INTERVIEW_WITH.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="主题">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="如：近期学习状态沟通" />
        </Field>
        <Field label="备注（可选）">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="面谈地点、需准备的材料或希望沟通的要点"
          />
        </Field>
      </div>
      <FormActions
        onCancel={onCancel}
        onSubmit={() => {
          if (!topic.trim()) {
            toast("请填写面谈主题")
            return
          }
          onSubmit({ date, time, with: wth, topic: topic.trim(), note: note.trim() })
          toast("已新建面谈预约")
        }}
        submitLabel="新建预约"
      />
    </FormShell>
  )
}

function PublishedFeedback({ room }: { room: string }) {
  return <HomeroomPublications room={room} />
}

function SectionTitle({
  icon,
  children,
  action,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold">
        {icon}
        {children}
      </p>
      {action}
    </div>
  )
}

function RecordToggle({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <Button variant={open ? "secondary" : "outline"} size="xs" onClick={onClick}>
      <Plus className={`size-3.5 transition-transform ${open ? "rotate-45" : ""}`} />
      {open ? "取消" : label}
    </Button>
  )
}

function FormShell({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 rounded-xl border border-border bg-muted/30 p-3">{children}</div>
}

function FormActions({
  onCancel,
  onSubmit,
  submitLabel,
}: {
  onCancel: () => void
  onSubmit: () => void
  submitLabel: string
}) {
  return (
    <div className="mt-3 flex justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={onCancel}>
        取消
      </Button>
      <Button size="sm" onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  )
}

function InfoTile({
  label,
  value,
  icon,
  muted,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  muted?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 flex items-center gap-1 text-[13px] font-medium ${muted ? "text-muted-foreground" : ""}`}>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        {value}
      </p>
    </div>
  )
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-3 text-[12.5px] text-muted-foreground">{children}</p>
  )
}

function fmt(iso: string) {
  const [, m, d] = iso.split("-")
  return `${Number(m)}月${Number(d)}日`
}
