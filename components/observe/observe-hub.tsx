"use client"

import { Badge, Card, Checkbox, Dot, EmptyState, Field, Input, Modal, PageHeader, Segmented, Select, Tabs, Textarea, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  ARRANGEMENTS,
  ATTENDANCE_ROSTER,
  MY_TEACHING_SLOTS,
  OPEN_SESSIONS,
  PUBLISHED_SESSIONS,
  RECORDS,
  RECV_APPLICATIONS,
  SENT_APPLICATIONS,
  type Arrangement,
  type CheckStatus,
  type OpenSession,
  type PublishedSession,
  type RecvApplication,
  type SentApplication,
} from "@/lib/proto/data"
import { CalendarClock, CalendarPlus, CheckCircle2, ClipboardList, Clock, Eye, Inbox, LayoutGrid, MapPin, Plus, Send, Users } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useState } from "react"

const openStatusMeta = {
  open: { tone: "success" as const, label: "报名中" },
  full: { tone: "warning" as const, label: "已满" },
  closed: { tone: "neutral" as const, label: "已截止" },
}

const recordStatusMeta = {
  none: { tone: "neutral" as const, label: "未开始" },
  draft: { tone: "warning" as const, label: "草稿" },
  submitted: { tone: "info" as const, label: "已提交" },
  shared: { tone: "success" as const, label: "已分享" },
}

const attendMeta = {
  "self-going": { tone: "info" as const, label: "自行前往" },
  "pending-check": { tone: "warning" as const, label: "待授课教师核对到场" },
  "checked-present": { tone: "success" as const, label: "已核对到场" },
  "cannot-confirm": { tone: "neutral" as const, label: "无法确认到场" },
}

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

export function ObserveHub() {
  const [view, setView] = useState<"observer" | "teacher">("observer")
  const isTeacher = view === "teacher"
  const params = useSearchParams()
  const router = useRouter()

  const teacherTabs = [
    { value: "published", label: "我开放的课" },
    { value: "received", label: "收到的申请" },
    { value: "schedule", label: "我的安排" },
    { value: "records", label: "听课记录" },
  ]
  const observerTabs = [
    { value: "open", label: "开放课报名" },
    { value: "sent", label: "我的申请" },
    { value: "schedule", label: "我的安排" },
    { value: "records", label: "听课记录" },
  ]
  const tabs = isTeacher ? teacherTabs : observerTabs
  const requested = params.get("tab")
  const active = tabs.some((t) => t.value === requested) ? (requested as string) : tabs[0].value

  const setTab = (v: string) => router.replace(`/observe?tab=${v}`)

  return (
    <>
      <ProtoViewBar
        value={view}
        onChange={setView}
        options={[
          { value: "observer", label: "听课教师视图" },
          { value: "teacher", label: "授课教师视图" },
        ]}
      />
      <PageHeader
        title="我的听课"
        desc={isTeacher ? "管理你开放的课节、回复定向申请，并整理个人听课记录。" : "浏览开放课节、发起定向听课申请，管理安排与记录。"}
        actions={
          isTeacher ? (
            <NewPublishButton />
          ) : (
            <NewApplicationButton />
          )
        }
      />

      <Tabs tabs={tabs} value={active} onChange={setTab} />

      <div className="mt-5">
        {active === "open" && <OpenTab />}
        {active === "sent" && <SentTab />}
        {active === "schedule" && <ScheduleTab />}
        {active === "records" && <RecordsTab />}
        {active === "published" && <PublishedTab />}
        {active === "received" && <ReceivedTab />}
      </div>
    </>
  )
}

/* ============ 开放课报名 ============ */

function OpenTab() {
  const [filter, setFilter] = useState<"all" | "open">("open")
  const [detail, setDetail] = useState<OpenSession | null>(null)
  const list = OPEN_SESSIONS.filter((s) => (filter === "open" ? s.status === "open" : true))

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          size="sm"
          ariaLabel="筛选开放课"
          options={[
            { value: "open", label: "报名中" },
            { value: "all", label: "全部" },
          ]}
        />
        <p className="text-[12.5px] text-muted-foreground">共 {list.length} 个课节 · 示例数据</p>
      </div>

      {list.length === 0 ? (
        <EmptyState title="暂无开放课节" desc="切换到“全部”查看已截止或已满的课节。" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const m = openStatusMeta[s.status]
            return (
              <Card key={s.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <Badge tone="primary">{s.course}</Badge>
                  <Badge tone={m.tone}>{m.label}</Badge>
                </div>
                <h3 className="mt-2.5 text-[15px] font-semibold leading-snug">{s.topic}</h3>
                <div className="mt-3 space-y-1.5 text-[12.5px] text-muted-foreground">
                  <Line icon={<Users className="size-3.5" />}>{s.teacher}</Line>
                  <Line icon={<CalendarClock className="size-3.5" />}>{s.date} {s.weekday} · {s.time}</Line>
                  <Line icon={<MapPin className="size-3.5" />}>{s.campus}</Line>
                </div>
                <p className="mt-3 rounded-lg bg-muted/60 px-2.5 py-2 text-[12px] text-muted-foreground">
                  关注点：{s.focus}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[12px] text-muted-foreground">
                    {s.status === "open" ? <>余 <b className="text-foreground tabular-nums">{s.seatsLeft}</b>/{s.seatsTotal} · {s.deadline}</> : s.deadline}
                  </span>
                  <Button size="sm" variant={s.status === "open" ? "default" : "secondary"} disabled={s.status !== "open"} onClick={() => setDetail(s)}>
                    {s.status === "open" ? "查看并预约" : "已结束"}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ReserveModal session={detail} onClose={() => setDetail(null)} />
    </>
  )
}

function ReserveModal({ session, onClose }: { session: OpenSession | null; onClose: () => void }) {
  const toast = useToast()
  const [done, setDone] = useState(false)
  const router = useRouter()
  const open = !!session

  const close = () => {
    setDone(false)
    onClose()
  }

  if (!session) return null

  return (
    <Modal
      open={open}
      onClose={close}
      title={done ? "预约成功" : "预约听课"}
      desc={done ? undefined : session.topic}
      footer={
        done ? (
          <>
            <Button variant="secondary" onClick={close}>关闭</Button>
            <Button onClick={() => { close(); router.replace("/observe?tab=schedule") }}>查看我的安排</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>取消</Button>
            <Button onClick={() => { setDone(true); toast.push("已进入“预约成功”示例状态") }}>
              <CheckCircle2 className="mr-1.5 size-4" /> 确认预约
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center py-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-[#e6f2ea] text-[#2f7d5b]">
            <CheckCircle2 className="size-7" />
          </span>
          <p className="mt-3 text-[15px] font-semibold">预约已提交（示例）</p>
          <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
            这是预设的结果画面。原型中不会真正占用名额，也不会改变其他页面的数据。到场情况将由授课教师在课堂核对。
          </p>
          <div className="mt-4 w-full rounded-lg border border-border bg-muted/40 p-3 text-left text-[12.5px]">
            <InfoRow k="课节" v={session.topic} />
            <InfoRow k="授课教师" v={session.teacher} />
            <InfoRow k="时间" v={`${session.date} ${session.weekday} ${session.time}`} />
            <InfoRow k="地点" v={session.campus} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-[12.5px]">
            <InfoRow k="授课教师" v={session.teacher} />
            <InfoRow k="课程" v={session.course} />
            <InfoRow k="时间" v={`${session.date} ${session.weekday} ${session.time}`} />
            <InfoRow k="地点" v={session.campus} />
            <InfoRow k="余量" v={`${session.seatsLeft}/${session.seatsTotal} · ${session.deadline}`} />
          </div>
          <Field label="本次关注点" hint="将同步给授课教师，便于其准备。">
            <Textarea defaultValue={`希望观察：${session.focus}`} rows={3} />
          </Field>
          <Field label="备注（可选）">
            <Input placeholder="如需说明特殊情况可在此填写" />
          </Field>
          <p className="text-[12px] text-muted-foreground">原型说明：确认后仅进入“预约成功”示例画面，不做名额计算。</p>
        </div>
      )}
    </Modal>
  )
}

/* ============ 我的申请（听课教师发起） ============ */

function SentTab() {
  const [detail, setDetail] = useState<SentApplication | null>(null)
  const sentMeta: Record<string, { tone: "neutral" | "info" | "warning" | "success" | "danger"; label: string }> = {
    "await-reply": { tone: "warning", label: "待授课教师回复" },
    "await-pick": { tone: "info", label: "待我选定课次" },
    settled: { tone: "success", label: "已约定" },
    declined: { tone: "neutral", label: "已婉拒" },
  }

  return (
    <>
      <div className="space-y-3">
        {SENT_APPLICATIONS.map((a) => {
          const m = sentMeta[a.status]
          return (
            <Card key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14.5px] font-semibold">{a.topic}</h3>
                  <Badge tone={m.tone}>{m.label}</Badge>
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">申请对象：{a.target} · 期望时间：{a.myTime}</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{a.lastReply}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant={a.status === "await-pick" ? "default" : "secondary"} onClick={() => setDetail(a)}>
                  {a.status === "await-pick" ? "选定课次" : "查看详情"}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
      <SentDetailModal app={detail} onClose={() => setDetail(null)} />
    </>
  )
}

function SentDetailModal({ app, onClose }: { app: SentApplication | null; onClose: () => void }) {
  const toast = useToast()
  const router = useRouter()
  const [picked, setPicked] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const close = () => {
    setPicked(null)
    setDone(false)
    onClose()
  }
  if (!app) return null

  const canPick = app.status === "await-pick" && app.candidates

  return (
    <Modal
      open={!!app}
      onClose={close}
      title={done ? "已约定听课时间" : app.topic}
      desc={done ? undefined : `申请对象：${app.target}`}
      footer={
        done ? (
          <Button onClick={() => { close(); router.replace("/observe?tab=schedule") }}>查看我的安排</Button>
        ) : canPick ? (
          <>
            <Button variant="ghost" onClick={close}>稍后再定</Button>
            <Button disabled={!picked} onClick={() => { setDone(true); toast.push("已进入“已约定”示例状态") }}>确认选定</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={close}>关闭</Button>
        )
      }
    >
      {done ? (
        <PresetSuccess
          title="已约定听课时间（示例）"
          desc="这是预设的结果画面。原型不会联动其他页面，安排将出现在“我的安排”示例列表中。"
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-[12.5px]">
            <InfoRow k="我的意向" v={app.wish} />
            <InfoRow k="期望时间" v={app.myTime} />
            <InfoRow k="备注" v={app.note} />
            <InfoRow k="最新进展" v={app.lastReply} />
          </div>
          {canPick && (
            <div>
              <p className="mb-2 text-[13px] font-medium">授课教师提供的候选课次（请选择一个）</p>
              <div className="space-y-2">
                {app.candidates!.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setPicked(c.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      picked === c.id ? "border-primary bg-accent" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div>
                      <p className="text-[13.5px] font-medium">{c.date} {c.weekday} · {c.time}</p>
                      <p className="text-[12px] text-muted-foreground">{c.course} · {c.campus}</p>
                    </div>
                    {picked === c.id ? <CheckCircle2 className="size-5 text-primary" /> : <span className="size-5 rounded-full border border-border" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function NewApplicationButton() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const toast = useToast()
  const close = () => { setOpen(false); setTimeout(() => setDone(false), 200) }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" /> 发起定向申请
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={done ? "申请已发送" : "发起定向听课申请"}
        desc={done ? undefined : "向指定授课教师说明你的听课意向。"}
        footer={
          done ? (
            <Button onClick={close}>完成</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>取消</Button>
              <Button onClick={() => { setDone(true); toast.push("已进入“申请已发送”示例状态") }}>
                <Send className="mr-1.5 size-4" /> 发送申请
              </Button>
            </>
          )
        }
      >
        {done ? (
          <PresetSuccess title="申请已发送（示例）" desc="这是预设的结果画面。授课教师将提供候选课次，原型不会真正通知对方。" />
        ) : (
          <div className="space-y-4">
            <Field label="授课教师" required>
              <Select defaultValue="示例王老师">
                <option>示例王老师</option>
                <option>示例陈老师</option>
                <option>示例赵老师</option>
              </Select>
            </Field>
            <Field label="听课主题 / 关注点" required>
              <Input placeholder="例如：算法课的课堂提问设计" />
            </Field>
            <Field label="观察意向">
              <Textarea placeholder="希望观察的具体内容" rows={3} />
            </Field>
            <Field label="期望时间" hint="仅作沟通参考，最终由授课教师提供课次。">
              <Input placeholder="例如：本周一、周三上午" />
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}

/* ============ 我的安排 ============ */

function ScheduleTab() {
  const [detail, setDetail] = useState<Arrangement | null>(null)
  return (
    <>
      <div className="space-y-3">
        {ARRANGEMENTS.map((a) => {
          const am = attendMeta[a.attend]
          const rm = recordStatusMeta[a.record]
          return (
            <Card key={a.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-muted py-1.5">
                    <span className="text-[11px] text-muted-foreground">{a.weekday}</span>
                    <span className="text-[15px] font-semibold tabular-nums">{a.date.split("-")[1]}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[14.5px] font-semibold">{a.topic}</h3>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">{a.teacher} · {a.course} · {a.time}{a.room ? ` · ${a.room}` : ""}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {a.change ? <Badge tone="warning">时间变更待确认</Badge> : null}
                      <Badge tone={am.tone}><Dot tone={am.tone} /> {am.label}</Badge>
                      <Badge tone={rm.tone}>记录：{rm.label}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setDetail(a)}>详情</Button>
                  <Link href={`/observe/record?from=${a.id}`} className="inline-flex">
                    <Button size="sm" variant={a.record === "none" ? "default" : "secondary"}>
                      {a.record === "none" ? "写记录" : "查看记录"}
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      <ArrangementModal a={detail} onClose={() => setDetail(null)} />
    </>
  )
}

function ArrangementModal({ a, onClose }: { a: Arrangement | null; onClose: () => void }) {
  const toast = useToast()
  if (!a) return null
  const am = attendMeta[a.attend]
  return (
    <Modal
      open={!!a}
      onClose={onClose}
      title={a.topic}
      desc={`${a.teacher} · ${a.course}`}
      footer={<Button variant="secondary" onClick={onClose}>关闭</Button>}
    >
      <div className="space-y-4">
        {a.change && (
          <div className="rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] p-3">
            <p className="text-[13px] font-medium text-[#8a5a12]">授课教师调整了上课时间</p>
            <p className="mt-1 text-[12.5px] text-[#8a5a12]/90">原：{a.change.oldTime} → 新：{a.change.newTime}</p>
            <div className="mt-2.5 flex gap-2">
              <Button size="sm" onClick={() => { toast.push("已进入“接受新时间”示例状态"); onClose() }}>接受新时间</Button>
              <Button size="sm" variant="secondary" onClick={() => { toast.push("已进入“取消该安排”示例状态"); onClose() }}>取消该安排</Button>
            </div>
          </div>
        )}
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-[12.5px]">
          <InfoRow k="时间" v={`${a.date} ${a.weekday} ${a.time}`} />
          <InfoRow k="地点" v={a.room ?? "以授课教师通知为准"} />
          <InfoRow k="到场状态" v={am.label} />
        </div>
        <div className="rounded-lg border border-border p-3 text-[12.5px] text-muted-foreground">
          <p className="font-medium text-foreground">到场核对说明</p>
          <p className="mt-1">到场情况由授课教师在课堂核对。若你实际到场但未被记录，可在课后与授课教师确认，或改为“线下听课补录”。</p>
        </div>
      </div>
    </Modal>
  )
}

/* ============ 听课记录 ============ */

function RecordsTab() {
  return (
    <div className="space-y-3">
      {RECORDS.map((r) => {
        const m = recordStatusMeta[r.status]
        return (
          <Card key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                <ClipboardList className="size-4.5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14.5px] font-semibold">{r.topic}</h3>
                  <Badge tone={m.tone}>{m.label}</Badge>
                  {r.makeup ? <Badge tone="neutral">线下补录</Badge> : null}
                </div>
                <p className="mt-1 text-[12.5px] text-muted-foreground">{r.teacher} · {r.course} · {r.date} {r.time}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{r.updatedAt}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href={`/observe/record?id=${r.id}`} className="inline-flex">
                <Button size="sm" variant={r.status === "draft" ? "default" : "secondary"}>
                  {r.status === "draft" ? "继续整理" : "查看"}
                </Button>
              </Link>
            </div>
          </Card>
        )
      })}
      <Card className="border-dashed p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-muted-foreground">
            <CalendarPlus className="size-5" />
            <div>
              <p className="text-[13.5px] font-medium text-foreground">线下听课补录</p>
              <p className="text-[12.5px]">未通过系统预约、线下直接听课的，可在此补录记录，交授课教师核验。</p>
            </div>
          </div>
          <Link href="/observe/record?makeup=1" className="inline-flex">
            <Button size="sm" variant="secondary"><Plus className="mr-1.5 size-4" /> 补录记录</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}

/* ============ 我开放的课（授课教师） ============ */

const publishMeta = {
  draft: { tone: "neutral" as const, label: "草稿" },
  enrolling: { tone: "success" as const, label: "报名中" },
  full: { tone: "warning" as const, label: "已满" },
  closed: { tone: "neutral" as const, label: "已截止" },
  ended: { tone: "neutral" as const, label: "已结束" },
}

function PublishedTab() {
  const [detail, setDetail] = useState<PublishedSession | null>(null)
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PUBLISHED_SESSIONS.map((s) => {
          const m = publishMeta[s.status]
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <Badge tone="primary">{s.course}</Badge>
                <Badge tone={m.tone}>{m.label}</Badge>
              </div>
              <h3 className="mt-2.5 text-[15px] font-semibold">{s.topic}</h3>
              <div className="mt-2 space-y-1.5 text-[12.5px] text-muted-foreground">
                <Line icon={<CalendarClock className="size-3.5" />}>{s.date} {s.weekday} · {s.time}</Line>
                <Line icon={<Clock className="size-3.5" />}>{s.deadline}</Line>
                <Line icon={<Users className="size-3.5" />}>
                  {s.status === "draft" ? "尚未发布" : `已报名 ${s.enrolled.length} 人 · 余 ${s.seatsLeft}/${s.seatsTotal}`}
                </Line>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[12px] text-muted-foreground">{s.status === "draft" ? "草稿未发布" : `名额 ${s.seatsTotal}`}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setDetail(s)}>{s.status === "draft" ? "编辑" : "报名名单"}</Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      <PublishedDetailModal s={detail} onClose={() => setDetail(null)} />
    </>
  )
}

function PublishedDetailModal({ s, onClose }: { s: PublishedSession | null; onClose: () => void }) {
  const [checkOpen, setCheckOpen] = useState(false)
  if (!s) return null
  return (
    <>
      <Modal
        open={!!s && !checkOpen}
        onClose={onClose}
        title={s.topic}
        desc={`${s.course} · ${s.date} ${s.weekday} ${s.time}`}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>关闭</Button>
            {s.status !== "draft" && (
              <Button onClick={() => setCheckOpen(true)}>
                <CheckCircle2 className="mr-1.5 size-4" /> 到场核对
              </Button>
            )}
          </>
        }
      >
        {s.status === "draft" ? (
          <PresetSuccess tone="neutral" title="草稿课节" desc="此课节尚未发布，其他教师看不到。发布后将进入“报名中”示例状态。" />
        ) : (
          <div>
            <p className="mb-2 text-[13px] font-medium">报名名单（{s.enrolled.length} 人）</p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {s.enrolled.map((name) => (
                <div key={name} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-[13.5px]">{name}</span>
                  <Badge tone="info">已预约</Badge>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground">到场情况由你在课堂核对。点击“到场核对”进入核对示例画面。</p>
          </div>
        )}
      </Modal>
      <AttendanceModal open={checkOpen} onClose={() => { setCheckOpen(false); onClose() }} topic={s.topic} />
    </>
  )
}

function AttendanceModal({ open, onClose, topic }: { open: boolean; onClose: () => void; topic: string }) {
  const toast = useToast()
  const [rows, setRows] = useState(() => ATTENDANCE_ROSTER.map((r) => ({ ...r, state: r.initial as CheckStatus })))
  const set = (name: string, state: CheckStatus) => setRows((rs) => rs.map((r) => (r.name === name ? { ...r, state } : r)))

  const checkOptions: { value: CheckStatus; label: string }[] = [
    { value: "present", label: "到场" },
    { value: "absent", label: "缺席" },
    { value: "cannot", label: "无法确认" },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="到场核对"
      desc={topic}
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={() => { toast.push("已进入“到场核对已保存”示例状态"); onClose() }}>保存核对结果</Button>
        </>
      }
    >
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-[13.5px] font-medium">{r.name}</p>
              <p className="text-[12px] text-muted-foreground">{r.subject}</p>
            </div>
            <Segmented value={r.state} onChange={(v) => set(r.name, v)} size="sm" options={checkOptions} ariaLabel={`${r.name} 到场状态`} />
          </div>
        ))}
        <p className="text-[12px] text-muted-foreground">原型说明：核对结果仅进入示例状态，不联动听课教师的安排页面。</p>
      </div>
    </Modal>
  )
}

function NewPublishButton() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const toast = useToast()
  const close = () => { setOpen(false); setTimeout(() => setDone(false), 200) }
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" /> 开放课节
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={done ? "课节已发布" : "开放一节课供听课"}
        desc={done ? undefined : "选择一节你的课并设置可听人数。"}
        footer={
          done ? (
            <Button onClick={close}>完成</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>存草稿</Button>
              <Button onClick={() => { setDone(true); toast.push("已进入“课节已发布”示例状态") }}>
                <Eye className="mr-1.5 size-4" /> 发布
              </Button>
            </>
          )
        }
      >
        {done ? (
          <PresetSuccess title="课节已发布（示例）" desc="这是预设的结果画面。原型不会真正对外开放报名，也不做名额计算。" />
        ) : (
          <div className="space-y-4">
            <Field label="选择课次" required hint="从你的课表中选择，不展开完整课表。">
              <Select defaultValue={MY_TEACHING_SLOTS[0].id}>
                {MY_TEACHING_SLOTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.date} {s.weekday} {s.time} · {s.course}</option>
                ))}
              </Select>
            </Field>
            <Field label="本节主题 / 关注点" required>
              <Input placeholder="例如：二分查找的边界处理" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="可听人数" required>
                <Input type="number" defaultValue={6} min={1} />
              </Field>
              <Field label="报名截止">
                <Input type="date" defaultValue="2026-09-21" />
              </Field>
            </div>
            <Field label="给听课教师的说明（可选）">
              <Textarea placeholder="课堂环节安排、观察建议等" rows={2} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}

/* ============ 收到的申请（授课教师） ============ */

function ReceivedTab() {
  const [reply, setReply] = useState<RecvApplication | null>(null)
  const recvMeta = {
    "await-offer": { tone: "warning" as const, label: "待提供课次" },
    "await-pick": { tone: "info" as const, label: "待对方选定" },
    settled: { tone: "success" as const, label: "已约定" },
  }
  return (
    <>
      <div className="space-y-3">
        {RECV_APPLICATIONS.map((a) => {
          const m = recvMeta[a.status]
          return (
            <Card key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                  <Inbox className="size-4.5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14.5px] font-semibold">{a.topic}</h3>
                    <Badge tone={m.tone}>{m.label}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">申请人：{a.from} · 期望时间：{a.applicantTime}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">{a.wish}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant={a.status === "await-offer" ? "default" : "secondary"} onClick={() => setReply(a)}>
                  {a.status === "await-offer" ? "提供课次" : "查看"}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
      <ReplyModal app={reply} onClose={() => setReply(null)} />
    </>
  )
}

function ReplyModal({ app, onClose }: { app: RecvApplication | null; onClose: () => void }) {
  const toast = useToast()
  const [picks, setPicks] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const close = () => { setPicks([]); setDone(false); onClose() }
  if (!app) return null
  const toggle = (id: string) => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <Modal
      open={!!app}
      onClose={close}
      title={done ? "候选课次已发送" : "回复听课申请"}
      desc={done ? undefined : `申请人：${app.from} · ${app.topic}`}
      footer={
        done ? (
          <Button onClick={close}>完成</Button>
        ) : app.status === "await-offer" ? (
          <>
            <Button variant="ghost" onClick={close}>取消</Button>
            <Button disabled={picks.length === 0} onClick={() => { setDone(true); toast.push("已进入“候选课次已发送”示例状态") }}>
              <Send className="mr-1.5 size-4" /> 发送候选课次
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={close}>关闭</Button>
        )
      }
    >
      {done ? (
        <PresetSuccess title="候选课次已发送（示例）" desc="这是预设的结果画面。申请人将从候选中选定，原型不会真正通知对方。" />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-[12.5px]">
            <InfoRow k="观察意向" v={app.wish} />
            <InfoRow k="期望时间" v={app.applicantTime} />
            <InfoRow k="备注" v={app.note} />
          </div>
          {app.status === "await-offer" ? (
            <div>
              <p className="mb-2 text-[13px] font-medium">从我的课次中挑选候选（可多选）</p>
              <div className="space-y-2">
                {MY_TEACHING_SLOTS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      picks.includes(c.id) ? "border-primary bg-accent" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div>
                      <p className="text-[13.5px] font-medium">{c.date} {c.weekday} · {c.time}</p>
                      <p className="text-[12px] text-muted-foreground">{c.course} · {c.campus}</p>
                    </div>
                    <span className={`flex size-5 items-center justify-center rounded border ${picks.includes(c.id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                      {picks.includes(c.id) ? <CheckCircle2 className="size-4" /> : null}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">原型说明：仅进入示例状态，不展开你的完整课表，也不改变对方页面。</p>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-[13px] font-medium">已提供的候选课次</p>
              {app.offered?.map((c) => (
                <div key={c.id} className="rounded-lg border border-border px-3 py-2.5">
                  <p className="text-[13.5px] font-medium">{c.date} {c.weekday} · {c.time}</p>
                  <p className="text-[12px] text-muted-foreground">{c.course} · {c.campus}</p>
                </div>
              ))}
              <p className="mt-2 text-[12.5px] text-muted-foreground">等待 {app.from} 从候选中选定。</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

/* ============ 小工具 ============ */

function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5">
      <span className="text-muted-foreground/70">{icon}</span>
      {children}
    </p>
  )
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-16 shrink-0 text-muted-foreground">{k}</span>
      <span className="flex-1 text-foreground">{v}</span>
    </div>
  )
}

function PresetSuccess({ title, desc, tone = "success" }: { title: string; desc: string; tone?: "success" | "neutral" }) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className={`flex size-14 items-center justify-center rounded-full ${tone === "success" ? "bg-[#e6f2ea] text-[#2f7d5b]" : "bg-muted text-muted-foreground"}`}>
        <CheckCircle2 className="size-7" />
      </span>
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{desc}</p>
    </div>
  )
}
