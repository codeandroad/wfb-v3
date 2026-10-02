"use client"

import { Badge, Field, Modal, Select, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { addCalendarEvent, eventDays, removeCalendarEvent, updateCalendarEvent, useCalendarEvents } from "@/lib/timetable/calendar-store"
import { fmtDateFull, type CalEvent, type CalKind } from "@/lib/timetable/data"
import { CalendarOff, CalendarPlus, CalendarSync, Pencil, Plus, Undo2 } from "lucide-react"
import { useState } from "react"

const KIND_LABEL: Record<CalKind, { label: string; tone: "warning" | "info" | "primary" }> = {
  holiday: { label: "假期 / 停课", tone: "warning" },
  exception: { label: "允许上课例外", tone: "info" },
  swap: { label: "整日调休", tone: "primary" },
}

export function CalendarPanel() {
  const { push } = useToast()
  const events = useCalendarEvents()
  const [addOpen, setAddOpen] = useState(false)
  const [preview, setPreview] = useState<CalEvent | null>(null)
  const [editing, setEditing] = useState<CalEvent | null>(null)
  const [revoking, setRevoking] = useState<CalEvent | null>(null)

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <p className="text-[13px] text-muted-foreground">复用学年/学期/时区与节次；合成日期，不联网抓取法定假日。</p>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />新增校历事项
        </Button>
      </div>

      <ul className="space-y-2">
        {events.map((e) => {
          const meta = KIND_LABEL[e.kind]
          return (
            <li key={e.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <span className="mt-0.5 shrink-0 text-muted-foreground">
                {e.kind === "holiday" ? <CalendarOff className="size-4" /> : e.kind === "swap" ? <CalendarSync className="size-4" /> : <CalendarPlus className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  {e.title ? <span className="text-[13px] font-semibold">{e.title}</span> : null}
                  <span className="text-[13px] font-medium">
                    {fmtDateFull(e.date)}
                    {e.endDate && e.endDate !== e.date ? ` – ${fmtDateFull(e.endDate)}` : ""}
                  </span>
                  {eventDays(e) > 1 ? <span className="text-[12px] text-muted-foreground">共 {eventDays(e)} 天</span> : null}
                  {e.targetDate ? <span className="text-[12px] text-muted-foreground">→ 补课日 {fmtDateFull(e.targetDate)}</span> : null}
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">{e.scope} · {e.note}</p>
                {e.traceable ? <p className="mt-1 text-[11px] text-muted-foreground/80">来源日被本次停课遮罩，仍取得可追溯的停课前来源；目标原有课不清空。</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {e.kind === "swap" ? <Button variant="ghost" size="xs" onClick={() => setPreview(e)}>影响预览</Button> : null}
                <Button variant="ghost" size="xs" onClick={() => setEditing(e)}>
                  <Pencil className="size-3.5" />编辑
                </Button>
                <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive" onClick={() => setRevoking(e)}>
                  <Undo2 className="size-3.5" />撤销
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">暂无校历事项，课表按学校发布版本正常执行。</p>
      ) : null}

      <EventModal
        key={addOpen ? "add-open" : "add-closed"}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={(ev) => {
          addCalendarEvent(ev)
          push(
            ev.kind === "holiday" && ev.endDate && ev.endDate !== ev.date
              ? `已新增${ev.title ?? "假期"}：${eventDays(ev)} 天内课表整体失效`
              : `已新增校历事项：${KIND_LABEL[ev.kind].label}`,
          )
          setAddOpen(false)
        }}
      />

      <EventModal
        key={editing?.id ?? "edit-none"}
        open={!!editing}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={(ev) => {
          updateCalendarEvent(ev)
          push("已保存校历事项，受影响课表已按新安排重新计算")
          setEditing(null)
        }}
      />

      <Modal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title="撤销校历事项"
        desc="撤销后该事项不再生效，受影响日期的课表恢复为学校发布安排。"
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRevoking(null)}>取消</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (revoking) removeCalendarEvent(revoking.id)
                push("已撤销校历事项，受影响课表已恢复")
                setRevoking(null)
              }}
            >
              确认撤销
            </Button>
          </>
        }
      >
        {revoking ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={KIND_LABEL[revoking.kind].tone}>{KIND_LABEL[revoking.kind].label}</Badge>
              {revoking.title ? <span className="font-semibold">{revoking.title}</span> : null}
            </div>
            <p className="mt-1.5">
              {fmtDateFull(revoking.date)}
              {revoking.endDate && revoking.endDate !== revoking.date ? ` – ${fmtDateFull(revoking.endDate)}` : ""}
              {revoking.targetDate ? ` → 补课日 ${fmtDateFull(revoking.targetDate)}` : ""}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">{revoking.scope}</p>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="调休影响预览" desc="两端一次提交模拟结果，重复点击不重复生成。" width="max-w-lg">
        {preview ? (
          <div className="space-y-3 text-[13px]">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="font-medium">来源日 {fmtDateFull(preview.targetDate!)}（周六）</p>
              <p className="mt-1 text-[12px] text-muted-foreground">执行 {fmtDateFull(preview.date)}（周一）安排；实际归第 4/5 周，不复制来源日请假/出勤/评价。</p>
            </div>
            <ul className="space-y-1.5 text-[12px]">
              <li className="flex justify-between rounded-md border border-border px-2.5 py-1.5"><span>高一1班 • 数学 · 周一 P1（2 节）</span><Badge tone="primary">补 9/28 课程</Badge></li>
              <li className="flex justify-between rounded-md border border-border px-2.5 py-1.5"><span>高一1班 • 物理 · 周一 F1（1 节）</span><Badge tone="primary">补 9/28 课程</Badge></li>
            </ul>
            <p className="text-[11px] text-muted-foreground">来源日标“已调至 9/26”；同一课次不在两端重复成为有效授课。时间冲突、缺节次、源=目标、循环、同一来源重复补到两处会被阻止。</p>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function EventModal({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean
  initial?: CalEvent
  onClose: () => void
  onSubmit: (e: CalEvent) => void
}) {
  const isEdit = !!initial
  const [kind, setKind] = useState<CalKind>(initial?.kind ?? "holiday")
  const [date, setDate] = useState(initial?.date ?? "2026-10-12")
  const [endDate, setEndDate] = useState(initial?.endDate ?? initial?.date ?? "2026-10-12")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [target, setTarget] = useState(initial?.targetDate ?? "2026-10-04")
  const [scope, setScope] = useState(initial?.scope ?? "全校")
  const isRange = kind !== "swap"
  const rangeInvalid = isRange && endDate < date
  const swapInvalid = kind === "swap" && target === date
  const unchanged =
    isEdit &&
    initial.kind === kind &&
    initial.date === date &&
    (initial.endDate ?? initial.date) === (isRange ? endDate : date) &&
    (initial.title ?? "") === title.trim() &&
    (initial.targetDate ?? "") === (kind === "swap" ? target : "") &&
    initial.scope === scope
  const inputCls = "w-full rounded-lg border border-input bg-card px-3 py-2 text-[14px]"
  const scopeOptions = ["全校", "高一年级", "高一1班 • 数学"]
  if (initial?.scope && !scopeOptions.includes(initial.scope)) scopeOptions.push(initial.scope)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "编辑校历事项" : "新增校历事项"}
      desc={
        isEdit
          ? "保存后受影响课表立即按新日期重新计算；原日期的停课/补课随之恢复。"
          : "停课 / 允许上课例外 / 整日调休。整日调休须选择来源与实际补课日，并关联来源日停课。"
      }
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button
            size="sm"
            disabled={rangeInvalid || swapInvalid || unchanged}
            onClick={() =>
              onSubmit({
                ...(initial ?? {}),
                id: initial?.id ?? `c-${Date.now().toString(36)}`,
                kind,
                date,
                endDate: isRange && endDate !== date ? endDate : undefined,
                title: title.trim() || undefined,
                targetDate: kind === "swap" ? target : undefined,
                scope,
                note:
                  kind === "swap"
                    ? "整日调休（合成，未声明法定放假）"
                    : kind === "exception"
                      ? "指定对象允许上课例外"
                      : endDate !== date
                        ? "区间内受影响课表整体失效（合成）"
                        : "停课（合成）",
                traceable: kind === "swap",
              })
            }
          >
            {isEdit ? "保存" : "添加"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="类型">
          <Select value={kind} onChange={(e) => setKind(e.target.value as CalKind)}>
            <option value="holiday">假期 / 停课</option>
            <option value="exception">允许上课例外</option>
            <option value="swap">整日调休</option>
          </Select>
        </Field>
        {kind === "holiday" ? (
          <Field label="名称" hint="可选，如“国庆长假”“期中考��周”，将显示在课表日期栏。">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：国庆长假" className={inputCls} />
          </Field>
        ) : null}
        {isRange ? (
          <Field
            label="日期范围"
            hint={rangeInvalid ? "结束日期不能早于开始日期。" : kind === "holiday" ? "范围内受影响课表整体失效，整日以背景色标注。单日请将起止设为同一天。" : "单日请将起止设为同一天。"}
          >
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="开始日期"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  if (endDate < e.target.value) setEndDate(e.target.value)
                }}
                className={inputCls}
              />
              <span className="shrink-0 text-muted-foreground">至</span>
              <input type="date" aria-label="结束日期" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </Field>
        ) : (
          <Field label="来源日期（原安排日）">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
        )}
        {kind === "swap" ? (
          <Field label="实际补课日期" hint={swapInvalid ? "补课日不能与来源日相同。" : "须关联来源日停课；不只写“按周一”。"}>
            <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[14px]" />
          </Field>
        ) : null}
        <Field label="对象范围" hint="允许上课例外限定具体日期、对象、必要节次，不为一个班开放全校。">
          <Select value={scope} onChange={(e) => setScope(e.target.value)}>
            {scopeOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
