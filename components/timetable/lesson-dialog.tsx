"use client"

import { Modal, Segmented, Select } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { PERIODS, ROOMS, TERM_END, WEEKDAYS, type DisplayMode, type EditAction, type ProjectedEntry } from "@/lib/timetable/data"
import { canonicalClassName, createDuty, dutiesForClass, dutyName, renameDuty, setDutyActive, teachingObjectsFor, useDuties, type DutyDef } from "@/lib/timetable/duty-store"

const CUSTOM_CLASS = "__custom__"
import { Lock, PlusCircle, Settings2, Trash2 } from "lucide-react"
import { useState } from "react"

export interface EditResult {
  ok: boolean
  msg: string
}

// 统一“课节信息”弹窗提交载荷：新增与编辑共用同一组字段
export interface LessonInfo {
  className: string
  subject: string
  group?: string
  room: string | null
  note?: string
  noteShow?: boolean
  displayMode?: DisplayMode
  customLabel?: string
}

/*
  统一课节信息弹窗：空格新增与已有课卡编辑共用同一弹窗与同一套六个信息区。
  六个信息区（固定顺序）：
    1. 教学目标（班级/课程名称 + 科目）
    2. 生效范围（仅本次 / 固定区间 + 起止日期）
    3. 教学分工（分工名称 + 显示到课卡开关）
    4. 自定义标签（开启后仅显示自定义文字，替代分工名称；关闭恢复分工名称）
    5. 备注（同标签行显示开关；关闭仅隐藏摘要，正文保留）
    6. 教室
  标题下不显示说明、位置或时间摘要。位置仅通过网格拖拽移动，弹窗内不含星期/节次/移动日期选择器。
*/
export function LessonDialog({
  open,
  onClose,
  mode,
  entry,
  cell,
  scope,
  effectiveDate,
  effectiveTo,
  scopeLocked = false,
  onScope,
  defaultSubject = "",
  rooms = ROOMS,
  onCreate,
  onEdit,
  onRemove,
  actor = "teacher",
  teacherId,
}: {
  actor?: "teacher" | "admin"
  teacherId?: string
  open: boolean
  onClose: () => void
  mode: "create" | "edit"
  entry: ProjectedEntry | null
  cell: { weekday: number; periodId: string; date: string } | null
  scope: "once" | "range"
  effectiveDate?: string
  effectiveTo?: string
  scopeLocked?: boolean
  onScope?: (scope: "once" | "range", effectiveDate?: string, effectiveTo?: string) => void
  defaultSubject?: string
  rooms?: string[]
  onCreate?: (data: LessonInfo) => EditResult
  onEdit?: (patch: {
    action: EditAction
    weekday: number
    periodId: string
    room: string | null
    className?: string
    subject?: string
    group?: string
    note?: string
    noteShow?: boolean
    displayMode?: DisplayMode
    customLabel?: string
  }) => EditResult
  onRemove?: () => EditResult
}) {
  const isEdit = mode === "edit"
  const readOnly = isEdit && !!entry && (entry.kind === "history" || !!entry.locked)

  // 本地表单缓冲：取消不写回；仅保存时提交
  const [className, setClassName] = useState("")
  const [subject, setSubject] = useState("")
  const [group, setGroup] = useState("")
  const [room, setRoom] = useState("")
  const [note, setNote] = useState("")
  const [noteShow, setNoteShow] = useState(true)
  const [displayMode, setDisplayMode] = useState<DisplayMode>("SHARED")
  const [customLabel, setCustomLabel] = useState("")
  // 本地生效范围缓冲（保存时才写回草稿）
  const [localScope, setLocalScope] = useState<"once" | "range">(scope)
  const [localFrom, setLocalFrom] = useState(effectiveDate ?? "")
  const [localTo, setLocalTo] = useState(effectiveTo ?? "")
  const [err, setErr] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const duties = useDuties()
  const classOptions = teacherId ? teachingObjectsFor(teacherId) : []
  const [classMode, setClassMode] = useState<"pick" | "custom">("pick")

  // 每次打开新对象时重置表单缓冲
  const identity = isEdit
    ? entry
      ? `edit:${entry.key}@${entry.date}`
      : null
    : cell
      ? `add:${cell.weekday}-${cell.periodId}-${cell.date}`
      : null
  const [lastIdentity, setLastIdentity] = useState<string | null>(null)
  if (identity !== lastIdentity) {
    setLastIdentity(identity)
    if (isEdit && entry) {
      setClassName(canonicalClassName(entry.className ?? ""))
      // 有候选时一律用下拉；不在候选中的现值作为首项保留，不切换为文本框
      setClassMode("pick")
      setSubject(entry.subject ?? "")
      setGroup(entry.group ?? "")
      setRoom(entry.room ?? "")
      setNote(entry.note ?? "")
      setNoteShow(entry.noteShow !== false)
      setDisplayMode(entry.displayMode ?? "SHARED")
      setCustomLabel(entry.customLabel ?? "")
    } else {
      setClassName(classOptions[0] ?? "")
      setClassMode(classOptions.length ? "pick" : "custom")
      setSubject(defaultSubject)
      setGroup("")
      setRoom("")
      setNote("")
      setNoteShow(true)
      setDisplayMode("SHARED")
      setCustomLabel("")
    }
    // 默认固定区间：起始默认为该课次日期，结束默认为学期结束日（未设置学期结束日则留空）
    void scope
    setLocalScope("range")
    setLocalFrom(effectiveDate ?? (isEdit ? entry?.date : cell?.date) ?? "")
    setLocalTo(effectiveTo ?? TERM_END ?? "")
    setErr(null)
  }

  if (isEdit ? !entry : !cell) return null

  const isAdmin = actor === "admin"
  const customOn = displayMode === "CUSTOM"
  const canonicalName = dutyName(duties, className.trim(), group || undefined)
  const teacherDuties = dutiesForClass(duties, className.trim()).filter((d) => d.active || d.code === group)
  const slotWeekday = isEdit ? entry?.weekday : cell?.weekday
  const slotPeriod = PERIODS.find((p) => p.id === (isEdit ? entry?.periodId : cell?.periodId))
  const slotLabel = [
    WEEKDAYS.find((w) => w.n === slotWeekday)?.label,
    slotPeriod ? `${slotPeriod.label}（${slotPeriod.start}–${slotPeriod.end}）` : undefined,
  ]
    .filter(Boolean)
    .join(" · ")
  const dialogTitle = (
    <span className="flex items-baseline gap-2.5">
      <span>课节信息</span>
      {slotLabel ? <span className="text-[12px] font-medium text-primary">{slotLabel}</span> : null}
    </span>
  )

  function pickClass(value: string) {
    if (value === CUSTOM_CLASS) {
      setClassMode("custom")
      setClassName("")
      setGroup("")
      return
    }
    setClassMode("pick")
    setClassName(value)
    // 分工按教学班定义：切换教学班后，原分工若不属于新班则回到整科
    setGroup((g) => (dutiesForClass(duties, value).some((d) => d.code === g) ? g : ""))
  }

  function toggleCustom(on: boolean) {
    setDisplayMode(on ? "CUSTOM" : "SHARED")
    setErr(null)
  }

  function commitScope() {
    if (scopeLocked) return
    onScope?.(localScope, localScope === "range" ? localFrom || undefined : undefined, localScope === "range" ? localTo || undefined : undefined)
  }

  function validate(): string | null {
    if (!className.trim()) return "请填写教学对象"
    if (displayMode === "CUSTOM" && !customLabel.trim()) return "自定义分工开启时必须填写分工文字"
    if (!scopeLocked && localScope === "range" && localFrom && localTo && localTo < localFrom) return "固定区间的结束日期不能早于开始日期"
    return null
  }

  function save() {
    const msg = validate()
    if (msg) {
      setErr(msg)
      return
    }
    commitScope()
    if (isEdit && entry && onEdit) {
      // 位置不在弹窗内更改（仅拖拽移动）：沿用当前星期/节次，动作用 room 承载信息编辑
      const r = onEdit({
        action: "room",
        weekday: entry.weekday,
        periodId: entry.periodId,
        room: room || null,
        className: className.trim(),
        subject: subject.trim() || entry.subject,
        // 分工只能从该教学班已登记的分工中选择；班级未登记分工时不提交
        group: isAdmin || teacherDuties.length ? group.trim() : undefined,
        note: note,
        noteShow,
        displayMode,
        customLabel,
      })
      if (r.ok) onClose()
      else setErr(r.msg)
      return
    }
    if (!isEdit && onCreate) {
      const r = onCreate({
        className: className.trim(),
        subject: subject.trim() || "自定义",
        group: isAdmin || teacherDuties.length ? group.trim() || undefined : undefined,
        room: room || null,
        note: note || undefined,
        noteShow,
        displayMode,
        customLabel: customLabel || undefined,
      })
      if (r.ok) onClose()
      else setErr(r.msg)
    }
  }

  function remove() {
    if (!onRemove) return
    const r = onRemove()
    if (r.ok) onClose()
    else setErr(r.msg)
  }

  if (readOnly) {
    return (
      <Modal open={open} onClose={onClose} title={dialogTitle} width="max-w-lg">
        <dl className="space-y-2.5 text-[13px]">
          <ReadRow k="班级 / 课程名称">{entry!.className}</ReadRow>
          <ReadRow k="科目">{entry!.subject}</ReadRow>
          {entry!.group ? <ReadRow k="教学分工">{dutyName(duties, entry!.className, entry!.group)}</ReadRow> : null}
          <ReadRow k="教室">{entry!.room ?? "未排教室"}</ReadRow>
          {entry!.note ? <ReadRow k="备注">{entry!.note}</ReadRow> : null}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">该课次已记录 / 锁定，为只读，不可编辑。</p>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dialogTitle}
      width="max-w-xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {isEdit && onRemove ? (
            <Button variant="destructive" size="sm" onClick={remove}>
              <Trash2 className="size-3.5" />删除该课次
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={save}>
              {isEdit ? "保存" : <><PlusCircle className="size-3.5" />添加到草稿</>}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-2.5">
        <Row label="教学对象">
          {classMode === "pick" && classOptions.length ? (
            <Select
              value={className}
              onChange={(e) => pickClass(e.target.value)}
              aria-label="教学对象"
              className="h-8 min-w-0 flex-1 py-0 text-[13px]"
            >
              {(classOptions.includes(className) || !className ? classOptions : [className, ...classOptions]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value={CUSTOM_CLASS}>其他教学对象…</option>
            </Select>
          ) : (
            <>
              <input
                autoFocus={!isEdit}
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="如：高一物理A班"
                aria-label="教学对象"
                className={`${inputCls} min-w-0 flex-1`}
              />
              {classOptions.length ? (
                <Button variant="ghost" size="xs" onClick={() => pickClass(classOptions[0])}>
                  从列表选
                </Button>
              ) : null}
            </>
          )}
          <Select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            aria-label="教室"
            className="h-8 w-28 shrink-0 py-0 text-[13px]"
          >
            {rooms.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
            <option value="">未排教室</option>
          </Select>
        </Row>

        <Row label="生效范围">
          <Segmented
            ariaLabel="生效范围"
            value={localScope}
            onChange={(v) => !scopeLocked && setLocalScope(v as "once" | "range")}
            options={[
              { value: "range", label: "固定区间" },
              { value: "once", label: "仅本次" },
            ]}
          />
          {localScope === "range" ? (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <input
                type="date"
                value={localFrom}
                onChange={(e) => setLocalFrom(e.target.value)}
                aria-label="开始日期"
                className={`${inputCls} min-w-0 flex-1 px-2`}
              />
              <span className="text-[12px] text-muted-foreground">至</span>
              <input
                type="date"
                value={localTo}
                onChange={(e) => setLocalTo(e.target.value)}
                aria-label="结束日期"
                title={localTo ? undefined : "未设置到期日"}
                className={`${inputCls} min-w-0 flex-1 px-2 ${localTo ? "" : "text-muted-foreground"}`}
              />
            </div>
          ) : null}
        </Row>
        {localScope === "range" && !localTo ? (
          <p className="pl-[76px] text-[11px] text-muted-foreground">未设置到期日，将持续生效</p>
        ) : null}

        {isAdmin ? (
          <>
            <Row label="教学分工">
              <Select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                aria-label="教学分工"
                disabled={!className.trim()}
                className="h-8 min-w-0 flex-1 py-0 text-[13px] disabled:bg-muted disabled:text-muted-foreground"
              >
                <option value="">{className.trim() ? "整科（无分工）" : "请先选择教学对象"}</option>
                {dutiesForClass(duties, className.trim())
                  .filter((d) => d.active || d.code === group)
                  .map((d) => (
                    <option key={d.id} value={d.code}>
                      {d.name === d.code ? d.code : `${d.code} · ${d.name}`}{d.active ? "" : "（已停用）"}
                    </option>
                  ))}
              </Select>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setManageOpen((v) => !v)}
                disabled={!className.trim()}
                aria-expanded={manageOpen}
              >
                <Settings2 className="size-3.5" />管理
              </Button>
            </Row>
            {!manageOpen && className.trim() && dutiesForClass(duties, className.trim()).length === 0 ? (
              <p className="pl-[76px] text-[11px] text-muted-foreground">
                该教学班尚未登记分工，点击「管理」可新增（如 P1、S1）
              </p>
            ) : null}
            {manageOpen && className.trim() ? (
              <DutyManager className={className.trim()} duties={dutiesForClass(duties, className.trim())} />
            ) : null}
          </>
        ) : (
          <>
            <Row label="教学分工">
              {teacherDuties.length ? (
                <Select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  aria-label="教学分工"
                  disabled={customOn}
                  title={customOn ? "已启用自定义分工，教学分工不可选择" : undefined}
                  className={`h-8 min-w-0 flex-1 py-0 text-[13px] disabled:cursor-not-allowed ${customOn ? "bg-muted text-muted-foreground/60 line-through decoration-muted-foreground/40" : ""}`}
                >
                  <option value="">整科（无分工）</option>
                  {group && !teacherDuties.some((d) => d.code === group) ? (
                    <option value={group} disabled>
                      {group}（未在教学班登记）
                    </option>
                  ) : null}
                  {teacherDuties.map((d) => (
                    <option key={d.id} value={d.code}>
                      {d.name === d.code ? d.code : `${d.code} · ${d.name}`}{d.active ? "" : "（已停用）"}
                    </option>
                  ))}
                </Select>
              ) : (
                <div
                  aria-label="教学分工（该教学班未登记分工）"
                  aria-disabled={customOn}
                  title="该教学班未登记分工，可在教学班页面由教务添加"
                  className={`${inputCls} flex min-w-0 flex-1 items-center gap-1.5 ${customOn ? "bg-muted text-muted-foreground/60 line-through decoration-muted-foreground/40" : "bg-muted/40 text-foreground"}`}
                >
                  <Lock className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{canonicalName ?? "整科（无分工）"}</span>
                </div>
              )}
            </Row>
            <Row label="自定义分工">
              <input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="仅本人课卡显示，替代教学分工"
                aria-label="自定义分工"
                className={`${inputCls} min-w-0 flex-1`}
              />
              <ToggleSwitch label="启用" checked={customOn} onChange={toggleCustom} />
            </Row>
          </>
        )}

        <Row label="备注">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如：实验课，提前到实验室"
            aria-label="备注"
            className={`${inputCls} min-w-0 flex-1`}
          />
          <ToggleSwitch label="显���" checked={noteShow} onChange={setNoteShow} />
        </Row>

        {err ? <p className="rounded-lg border border-[#eec4bf] bg-[#fbe6e4] px-3 py-2 text-[12px] text-[#9a2b22]">{err}</p> : null}
      </div>
    </Modal>
  )
}

const inputCls = "h-8 rounded-md border border-input bg-card px-2.5 text-[13px] placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-ring"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[12px] text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  )
}

// 教务维护教学班下的规范分工：新增 / 改名 / 停用。改名同步到所有引用该分工的课卡
function DutyManager({ className, duties }: { className: string; duties: DutyDef[] }) {
  const [code, setCode] = useState("")
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="ml-[76px] rounded-md border border-border bg-muted/30 p-2">
      <ul className="flex flex-col gap-1">
        {duties.map((d) => (
          <li key={d.id} className="flex items-center gap-2">
            <span className="w-10 shrink-0 font-mono text-[11px] text-muted-foreground">{d.code}</span>
            <input
              defaultValue={d.name}
              aria-label={`${d.code} 规范名称`}
              onBlur={(e) => {
                if (e.target.value.trim() !== d.name) setMsg(renameDuty("admin", d.id, e.target.value).msg)
              }}
              className={`${inputCls} h-7 min-w-0 flex-1 ${d.active ? "" : "text-muted-foreground line-through"}`}
            />
            <ToggleSwitch label="启用" checked={d.active} onChange={(v) => setMsg(setDutyActive("admin", d.id, v).msg)} />
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="新分工名称，如 P2"
          aria-label="新分工名称"
          className={`${inputCls} h-7 min-w-0 flex-1`}
        />
        <Button
          variant="outline"
          size="xs"
          onClick={() => {
            const r = createDuty("admin", className, code)
            setMsg(r.msg)
            if (r.ok) setCode("")
          }}
        >
          新增
        </Button>
      </div>
      {msg ? <p className="mt-1 text-[11px] text-muted-foreground" role="status">{msg}</p> : null}
    </div>
  )
}

function ReadRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
      <dd className="min-w-0 flex-1 font-medium text-foreground">{children}</dd>
    </div>
  )
}

function ToggleSwitch({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-[12px] text-muted-foreground disabled:opacity-50"
    >
      <span className="sr-only sm:not-sr-only">{label}</span>
      <span
        className={
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
          (checked ? "bg-primary" : "bg-muted-foreground/30")
        }
      >
        <span
          className={
            "inline-block size-4 rounded-full bg-card shadow transition-transform " +
            (checked ? "translate-x-4" : "translate-x-0.5")
          }
        />
      </span>
    </button>
  )
}
