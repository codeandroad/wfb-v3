"use client"

import { Badge, Field, Modal, Segmented, Select } from "@/components/kit"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { recordKey, useLessonRecords } from "@/lib/timetable/lesson-records"
import { weekOfDate } from "@/lib/mt/model"
import { cn } from "@/lib/utils"
import { dutyName, useDuties } from "@/lib/timetable/duty-store"
import {
  fmtDateFull,
  PERIODS,
  periodById,
  ROOMS,
  WEEKDAYS,
  type DiffRow,
  type EditAction,
  type ProjectedEntry,
} from "@/lib/timetable/data"
import { ArrowRight, MinusCircle, PlusCircle, MoveRight, DoorOpen, Trash2 } from "lucide-react"
import { useState, type ReactNode } from "react"

export function ConfirmModal({
  open,
  title,
  desc,
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: ReactNode
  desc?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      desc={desc}
      width="max-w-md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    />
  )
}

export interface EditResult {
  ok: boolean
  msg: string
}

/* 课堂记录已统一为“按日记录”：课卡不再自带可写表单，只导航到同一份学生日记录；旧课后记录只读保留。 */
function DayRecordEntry({ entry }: { entry: ProjectedEntry }) {
  const records = useLessonRecords()
  const legacy = records[recordKey(entry)]
  const href = entry.taskId
    ? `/teaching?${new URLSearchParams({ view: "days", week: String(weekOfDate(entry.date)), day: `${entry.taskId}|${entry.date}` }).toString()}`
    : null
  return (
    <section className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-[13px]" aria-label="课堂记录">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">课堂记录</span>
        {href ? (
          <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
            打开本日课堂记录
          </Link>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        出勤、本日课堂评价与课堂小结在“按日记录”中填写，与整周反馈共用同一份记录。
      </p>
      {legacy ? (
        <p className="rounded-md bg-muted/60 p-2 text-xs leading-relaxed text-muted-foreground">
          {`此课次有旧版课后记录（只读保留，未自动转换为日评价）`}
          {legacy.summary ? `：小结“${legacy.summary}”` : ""}
        </p>
      ) : null}
    </section>
  )
}

/* 只读课卡详情 */
export function CardDetail({
  entry,
  open,
  onClose,
  sourceLine,
  recordClockDate,
}: {
  entry: ProjectedEntry | null
  open: boolean
  onClose: () => void
  sourceLine?: ReactNode
  // 传入当前日期时启用课后记录：日期早于它的课次显示出勤/表现记录入口
  recordClockDate?: string
}) {
  const duties = useDuties()
  if (!entry) return null
  const canRecord = !!recordClockDate && entry.date < recordClockDate && entry.kind !== "activity"
  const p = periodById(entry.periodId)
  const wd = WEEKDAYS.find((w) => w.n === entry.weekday)?.label ?? ""
  return (
    <Modal open={open} onClose={onClose} title={entry.className} width="max-w-md">
      <dl className="space-y-2.5 text-[13px]">
        {entry.kind !== "activity" ? (
          <Row k="教学分工">{entry.group ? dutyName(duties, entry.className, entry.group) : "整科（无分工）"}</Row>
        ) : null}
        <Row k="实际日期">{fmtDateFull(entry.date)}（{wd}）</Row>
        <Row k="节次时间">{p ? `${p.label} · ${p.start}–${p.end}` : entry.periodId}</Row>
        <Row k="教室">{entry.room ?? "未排教室（未纳入教室冲突检查）"}</Row>
        {entry.makeupFrom ? <Row k="补课来源">{`补 ${entry.makeupFrom} 课程`}</Row> : null}
        {entry.movedTo ? <Row k="调休去向">{`已调至 ${entry.movedTo}`}</Row> : null}
      </dl>
      {sourceLine ? <div className="mt-3 rounded-lg border border-border bg-muted/40 p-2.5 text-[12px] text-muted-foreground">{sourceLine}</div> : null}
      {canRecord ? <DayRecordEntry entry={entry} /> : null}
      {!canRecord && (entry.kind === "history" || entry.locked) ? (
        <p className="mt-3 text-xs text-muted-foreground">该课次已记录/锁定，为只读；更正需通过受控的后续修订，不迁移课堂事实。</p>
      ) : null}
    </Modal>
  )
}

/* 可编辑课卡弹窗：直接修改时间/教室或删除该课次（作用于草稿） */
export function EditableCardModal({
  entry,
  open,
  onClose,
  scope,
  onScopeChange,
  effectiveDate,
  onEffectiveDateChange,
  onSubmit,
  onRemove,
  allowScope = true,
  rooms = ROOMS,
}: {
  entry: ProjectedEntry | null
  open: boolean
  onClose: () => void
  scope: "once" | "range"
  onScopeChange?: (s: "once" | "range") => void
  effectiveDate?: string
  onEffectiveDateChange?: (d: string) => void
  onSubmit: (patch: {
    action: EditAction
    weekday: number
    periodId: string
    room: string | null
    className?: string
    group?: string
  }) => EditResult
  onRemove: () => EditResult
  allowScope?: boolean
  rooms?: string[]
}) {
  const [weekday, setWeekday] = useState(String(entry?.weekday ?? 1))
  const [periodId, setPeriodId] = useState(entry?.periodId ?? "m1")
  const [room, setRoom] = useState(entry?.room ?? "")
  const [className, setClassName] = useState(entry?.className ?? "")
  const [group, setGroup] = useState(entry?.group ?? "")
  const [err, setErr] = useState<string | null>(null)

  // 每次打开新课卡时重置本地表单
  const [lastKey, setLastKey] = useState<string | null>(null)
  if (entry && `${entry.key}@${entry.date}` !== lastKey) {
    setLastKey(`${entry.key}@${entry.date}`)
    setWeekday(String(entry.weekday))
    setPeriodId(entry.periodId)
    setRoom(entry.room ?? "")
    setClassName(entry.className ?? "")
    setGroup(entry.group ?? "")
    setErr(null)
  }

  if (!entry) return null
  const readOnly = entry.kind === "history" || entry.locked

  function save() {
    const trimmedName = className.trim()
    if (!trimmedName) {
      setErr("教学班名不能为空")
      return
    }
    const nameChanged = trimmedName !== entry!.className || (group.trim() || undefined) !== (entry!.group || undefined)
    const posChanged = Number(weekday) !== entry!.weekday || periodId !== entry!.periodId
    // 仅改名（位置/教室未变）时也用 room 动作承载，保证改名被记录
    const action: EditAction = posChanged ? "move" : "room"
    const r = onSubmit({
      action,
      weekday: Number(weekday),
      periodId,
      room: room || null,
      className: nameChanged ? trimmedName : undefined,
      group: nameChanged ? group.trim() : undefined,
    })
    if (r.ok) onClose()
    else setErr(r.msg)
  }

  function remove() {
    const r = onRemove()
    if (r.ok) onClose()
    else setErr(r.msg)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`调整：${entry.className}${entry.group ? " · " + entry.group : ""}`}
      desc={readOnly ? "该课次已记录/锁定，为只读，不可调整。" : "直接修改星期/节次/教室，或删除该课次。改动进入草稿，未应用前不影响正式安排。"}
      width="max-w-md"
      footer={
        readOnly ? undefined : (
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="destructive" size="sm" onClick={remove}>
              <Trash2 className="size-3.5" />删除该课次
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
              <Button size="sm" onClick={save}>保存调整</Button>
            </div>
          </div>
        )
      }
    >
      {readOnly ? (
        <dl className="space-y-2.5 text-[13px]">
          <Row k="课程标识">{entry.key}</Row>
          <Row k="节次">{periodById(entry.periodId)?.label} · {periodById(entry.periodId)?.start}–{periodById(entry.periodId)?.end}</Row>
          <Row k="教室">{entry.room ?? "未排教室"}</Row>
        </dl>
      ) : (
        <div className="space-y-3">
          {allowScope ? (
            <Field label="生效范围" hint={scope === "once" ? "仅本次：只改这一周的该次课，不影响以后各周。" : "固定区间：自生效日起各周持续生效。"}>
              <Segmented
                ariaLabel="生效范围"
                value={scope}
                onChange={(v) => onScopeChange?.(v as "once" | "range")}
                options={[
                  { value: "once", label: "仅本次" },
                  { value: "range", label: "固定区间" },
                ]}
              />
            </Field>
          ) : null}
          {allowScope && scope === "range" ? (
            <Field label="生效日期" hint="仅影响生效日��后；不改��其之前的已用安排与已记录事实。">
              <input
                type="date"
                value={effectiveDate ?? ""}
                onChange={(e) => onEffectiveDateChange?.(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[14px]"
              />
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="教学班名">
              <input
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="如 高二数学A"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[14px]"
              />
            </Field>
            <Field label="教学单元组" hint="可留空">
              <input
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder="如 P1 · Pure Mathematics 1"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[14px]"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="星期">
              <Select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                {WEEKDAYS.slice(0, 5).map((w) => <option key={w.n} value={w.n}>{w.label}</option>)}
              </Select>
            </Field>
            <Field label="节次">
              <Select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}（{p.start}–{p.end}）</option>)}
              </Select>
            </Field>
          </div>
          <Field label="教室">
            <Select value={room} onChange={(e) => setRoom(e.target.value)}>
              {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="">未排教室</option>
            </Select>
          </Field>
          {err ? <p className="rounded-lg border border-[#eec4bf] bg-[#fbe6e4] px-3 py-2 text-[12px] text-[#9a2b22]">{err}</p> : null}
        </div>
      )}
    </Modal>
  )
}

/* 新增课次弹窗：在空闲格新增课程（作用于草稿） */
export function AddCardModal({
  cell,
  open,
  onClose,
  onSubmit,
  defaultSubject = "",
  rooms = ROOMS,
}: {
  cell: { weekday: number; periodId: string; date: string } | null
  open: boolean
  onClose: () => void
  onSubmit: (data: { className: string; subject: string; group?: string; room: string | null }) => EditResult
  defaultSubject?: string
  rooms?: string[]
}) {
  const [className, setClassName] = useState("")
  const [subject, setSubject] = useState(defaultSubject)
  const [group, setGroup] = useState("")
  const [room, setRoom] = useState(rooms[0] ?? "")
  const [err, setErr] = useState<string | null>(null)

  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = cell ? `${cell.weekday}-${cell.periodId}-${cell.date}` : null
  if (key !== lastKey) {
    setLastKey(key)
    setClassName("")
    setSubject(defaultSubject)
    setGroup("")
    setRoom(rooms[0] ?? "")
    setErr(null)
  }

  if (!cell) return null
  const p = periodById(cell.periodId)
  const wd = WEEKDAYS.find((w) => w.n === cell.weekday)?.label ?? ""

  function save() {
    if (!className.trim()) {
      setErr("请填写班级/课程名称")
      return
    }
    const r = onSubmit({ className: className.trim(), subject: subject.trim() || "自定义", group: group.trim() || undefined, room: room || null })
    if (r.ok) onClose()
    else setErr(r.msg)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新增课次"
      desc={`落点：${wd} ${p?.label ?? cell.periodId}（${p ? `${p.start}–${p.end}` : ""}）。改动进入草稿，未应用前不影响正式安排。`}
      width="max-w-md"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={save}><PlusCircle className="size-3.5" />添加到草稿</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="班级 / 课程名称">
          <input
            autoFocus
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="如：高一物理A班"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[14px]"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="科目">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="如：物理"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[14px]"
            />
          </Field>
          <Field label="分组 / 备注" hint="可留空">
            <input
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="如：力学"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[14px]"
            />
          </Field>
        </div>
        <Field label="教室">
          <Select value={room} onChange={(e) => setRoom(e.target.value)}>
            {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
            <option value="">未排教室</option>
          </Select>
        </Field>
        {err ? <p className="rounded-lg border border-[#eec4bf] bg-[#fbe6e4] px-3 py-2 text-[12px] text-[#9a2b22]">{err}</p> : null}
      </div>
    </Modal>
  )
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-muted-foreground">{k}</dt>
      <dd className="min-w-0 flex-1 font-medium text-foreground">{children}</dd>
    </div>
  )
}

/* 差异变化列表（before→after 直观对照，不靠颜色区分） */
function slotText(slot: DiffRow["school"]): string {
  if (!slot) return "—"
  const wd = WEEKDAYS.find((w) => w.n === slot.weekday)?.label ?? ""
  const p = periodById(slot.periodId)
  return `${wd} ${p?.label ?? slot.periodId} · ${p ? `${p.start}–${p.end}` : ""} · ${slot.room ?? "未排教室"}`
}

export function DiffList({
  rows,
  emptyText = "所选范围无差异",
  fromLabel = "学校版",
  toLabel = "我的版",
}: {
  rows: DiffRow[]
  emptyText?: string
  fromLabel?: string
  toLabel?: string
}) {
  const changed = rows.filter((r) => r.kind !== "same")
  if (changed.length === 0) {
    return <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-[13px] text-muted-foreground">{emptyText}</p>
  }
  return (
    <ul className="space-y-2">
      {changed.map((r) => (
        <li key={r.key} className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <DiffIcon kind={r.kind} />
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight">{r.label}</p>
            <DiffTag kind={r.kind} />
          </div>
          <div className="mt-2 grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1 pl-6 text-[12px]">
            <span className="text-muted-foreground">{fromLabel}</span>
            <span className={cn("font-medium", !r.school && "text-muted-foreground")}>{slotText(r.school)}</span>
            <span className="text-muted-foreground">{toLabel}</span>
            <span className={cn("font-medium", !r.personal && "text-muted-foreground")}>{slotText(r.personal)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function DiffIcon({ kind }: { kind: DiffRow["kind"] }) {
  const map = {
    added: <PlusCircle className="size-4 text-[#256a49]" />,
    removed: <MinusCircle className="size-4 text-[#9a2b22]" />,
    moved: <MoveRight className="size-4 text-[#8a5a12]" />,
    room: <DoorOpen className="size-4 text-[#2a5b6e]" />,
    same: <ArrowRight className="size-4 text-muted-foreground" />,
  }
  return <span className="mt-0.5 shrink-0">{map[kind]}</span>
}

function DiffTag({ kind }: { kind: DiffRow["kind"] }) {
  const map: Record<DiffRow["kind"], { tone: "success" | "danger" | "warning" | "info" | "neutral"; label: string }> = {
    added: { tone: "success", label: "学校新增" },
    removed: { tone: "warning", label: "学校未含" },
    moved: { tone: "warning", label: "时间调整" },
    room: { tone: "info", label: "教室调整" },
    same: { tone: "neutral", label: "无变化" },
  }
  const m = map[kind]
  return (
    <span className="shrink-0">
      <Badge tone={m.tone}>{m.label}</Badge>
    </span>
  )
}

/* 双栏对比：学校 vs 我的 */
export function DiffColumns({
  rows,
  schoolTitle,
  personalTitle,
}: {
  rows: DiffRow[]
  schoolTitle: ReactNode
  personalTitle: ReactNode
}) {
  const changed = rows.filter((r) => r.kind !== "same")
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <ColumnCard title={schoolTitle} side="school" rows={changed} />
      <ColumnCard title={personalTitle} side="personal" rows={changed} />
    </div>
  )
}

function ColumnCard({ title, side, rows }: { title: ReactNode; side: "school" | "personal"; rows: DiffRow[] }) {
  return (
    <div className="rounded-lg border border-border">
      <div className={cn("border-b border-border px-3 py-2 text-[12px] font-medium", side === "school" ? "bg-accent" : "bg-[#fbf3e2]")}>
        {title}
      </div>
      <ul className="divide-y divide-border">
        {rows.length === 0 ? (
          <li className="px-3 py-4 text-center text-[12px] text-muted-foreground">无差异条目</li>
        ) : (
          rows.map((r) => {
            const slot = side === "school" ? r.school : r.personal
            return (
              <li key={r.key} className="px-3 py-2">
                <p className="text-[12px] font-medium">{r.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {slot
                    ? `${WEEKDAYS.find((w) => w.n === slot.weekday)?.label ?? ""} ${periodById(slot.periodId)?.label ?? ""} · ${slot.room ?? "未排教室"}`
                    : side === "school"
                      ? "学校版无此课"
                      : "我的版暂无（学校新增）"}
                </p>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
