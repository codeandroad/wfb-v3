"use client"

// 行政班课表（双视图）：
// - 归属安排：该行政班作为“排课归属”的课次（读教学班显式 placementHomeroomId）。
// - 学生实际去向：该行政班学生实际所在课次（按有效名单求交集，可能跨班/分层）。
// 两视图强调“归属 ≠ 去向”：走班后学生实际去向可与归属不同。

import { Badge, Sheet, Segmented } from "@/components/kit"
import {
  HOMEROOMS,
  PERIODS,
  PREVIEW_WEEK_START,
  destinationEvents,
  locationName,
  placementEvents,
  subjectName,
  teacherName,
  useTeaching,
  WEEKDAY_LABELS,
  type CalEvent,
} from "@/lib/teaching/store"
import { useMemo, useState } from "react"

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

type ViewMode = "placement" | "destination"

export function HomeroomTimetableSheet({ homeroomName, onClose }: { homeroomName: string; onClose: () => void }) {
  const teaching = useTeaching()
  const [mode, setMode] = useState<ViewMode>("placement")

  const homeroom = HOMEROOMS.find((h) => h.name === homeroomName)
  const homeroomId = homeroom?.id ?? null

  // 预览周：周一(=PREVIEW_WEEK_START) 到 周六
  const week = useMemo(() => {
    const days: { weekday: number; date: string; label: string }[] = []
    for (let i = 0; i < 6; i++) {
      const weekday = i + 1
      days.push({ weekday, date: addDays(PREVIEW_WEEK_START, i), label: WEEKDAY_LABELS[weekday] })
    }
    return days
  }, [])

  // 只显示实际出现课次的节次，避免空行过多
  const activePeriods = useMemo(() => {
    if (!homeroomId) return []
    const ids = new Set<string>()
    for (const d of week) {
      const evs =
        mode === "placement"
          ? placementEvents(teaching, homeroomId, d.date)
          : destinationEvents(teaching, homeroomId, d.date).map((r) => r.event)
      evs.forEach((e) => ids.add(e.periodId))
    }
    return PERIODS.filter((p) => ids.has(p.id))
  }, [teaching, homeroomId, week, mode])

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${homeroomName} · 课表`}
      desc="归属安排＝按“排课归属”看本班课次；学生实际去向＝本班学生实际所在课次（走班/分层后可不同）。"
      width="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            ariaLabel="课表视图"
            value={mode}
            onChange={(v) => setMode(v as ViewMode)}
            options={[
              { value: "placement", label: "归属安排" },
              { value: "destination", label: "学生实际去向" },
            ]}
          />
          <span className="text-xs text-muted-foreground">
            预览周 · {PREVIEW_WEEK_START} 起（原型示例数据）
          </span>
        </div>

        {!homeroomId ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            该行政班在示例课表数据中暂无课次。
          </p>
        ) : activePeriods.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            本周该视图下暂无课次。
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="w-24 border-b border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    节次
                  </th>
                  {week.map((d) => (
                    <th
                      key={d.weekday}
                      className="border-b border-l border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activePeriods.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="border-b border-border px-3 py-2">
                      <div className="text-[13px] font-medium">{p.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.start}–{p.end}
                      </div>
                    </td>
                    {week.map((d) => (
                      <td key={d.weekday} className="border-b border-l border-border px-2 py-2">
                        <CellContent teaching={teaching} homeroomId={homeroomId} date={d.date} periodId={p.id} mode={mode} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          说明：同一节次下，本班部分学生可能因走班 / 分层去往其他教学班；“学生实际去向”按有效名单求交集得出，可能与“归属安排”不一致。
        </p>
      </div>
    </Sheet>
  )
}

function CellContent({
  teaching,
  homeroomId,
  date,
  periodId,
  mode,
}: {
  teaching: ReturnType<typeof useTeaching>
  homeroomId: string
  date: string
  periodId: string
  mode: ViewMode
}) {
  if (mode === "placement") {
    const evs = placementEvents(teaching, homeroomId, date, periodId)
    if (evs.length === 0) return null
    return (
      <div className="space-y-1.5">
        {evs.map((ev) => (
          <PlacementCard key={ev.id} ev={ev} teaching={teaching} />
        ))}
      </div>
    )
  }
  const rows = destinationEvents(teaching, homeroomId, date, periodId)
  if (rows.length === 0) return null
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.event.id} className="rounded-lg border border-border bg-card px-2 py-1.5">
          <div className="text-[12.5px] font-medium leading-tight">{r.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            <Badge tone="info">{r.memberIds.length} 人去向</Badge>
            {r.teacherIds.length ? <span>{r.teacherIds.map(teacherName).join("、")}</span> : null}
            {r.locationId ? <span>· {locationName(r.locationId)}</span> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function PlacementCard({ ev, teaching }: { ev: CalEvent; teaching: ReturnType<typeof useTeaching> }) {
  const cls = ev.teachingClassId ? teaching.classes.find((c) => c.id === ev.teachingClassId) : null
  const title = cls?.name ?? ev.title
  return (
    <div className="rounded-lg border border-border bg-card px-2 py-1.5">
      <div className="text-[12.5px] font-medium leading-tight">{title}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        {cls ? <span>{subjectName(cls.subjectId)}</span> : null}
        {ev.teacherIds.length ? <span>· {ev.teacherIds.map(teacherName).join("、")}</span> : null}
        {ev.locationId ? <span>· {locationName(ev.locationId)}</span> : null}
      </div>
    </div>
  )
}
