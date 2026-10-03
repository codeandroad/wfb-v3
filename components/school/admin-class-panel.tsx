"use client"

import { Badge, Card, EmptyState, Field, Input, Modal, Sheet, Textarea, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { updateAdminClasses, useAdminClasses } from "@/lib/school/admin-class-store"
import {
  STUDENT_PROFILES,
  studentProfilesByClass,
  type AdminClass,
  type ClassEvent,
  type HeadRole,
} from "@/lib/demo/school"
import { CalendarDays, Plus, Sparkles, UserRound, Users, X } from "lucide-react"
import { useMemo, useState } from "react"
import { DutyArrangeSheet } from "./duty-arrange-sheet"
import { InfoNote } from "./duty-bits"
import { HomeroomTimetableSheet } from "./homeroom-timetable-sheet"
import { ListToolbar, type FilterGroup, type FilterState } from "./list-toolbar"

const ROLE_TONE: Record<HeadRole, "primary" | "info"> = {
  主班主任: "primary",
  辅助班主任: "info",
}

// 会话内工作副本：额外加入的学生按班级名归集（演示用，不落库）
type ExtraRoster = Record<string, string[]>

export function AdminClassPanel() {
  const { push } = useToast()
  const classes = useAdminClasses()
  const setClasses = updateAdminClasses
  const [extraRoster, setExtraRoster] = useState<ExtraRoster>({})
  const [removedRoster, setRemovedRoster] = useState<ExtraRoster>({})
  const [summaryId, setSummaryId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [arrangingId, setArrangingId] = useState<string | null>(null)
  const [timetableName, setTimetableName] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})

  const filterGroups: FilterGroup[] = useMemo(
    () => [
      {
        key: "grade",
        label: "年级",
        options: Array.from(new Set(classes.map((c) => c.grade))).map((v) => ({ value: v, label: v })),
      },
      {
        key: "head",
        label: "主班主任",
        options: [
          { value: "assigned", label: "已配置" },
          { value: "vacant", label: "暂缺" },
        ],
      },
      {
        key: "assistant",
        label: "辅助班主任",
        options: [
          { value: "assigned", label: "已配置" },
          { value: "vacant", label: "暂缺" },
        ],
      },
    ],
    [classes],
  )

  const rows = useMemo(
    () =>
      classes.filter((c) => {
        if (q && !(c.name.includes(q) || c.room.includes(q))) return false
        const f = filters
        if (f.grade?.length && !f.grade.includes(c.grade)) return false
        const hasPrimary = c.heads.some((h) => h.role === "主班主任")
        const hasAssistant = c.heads.some((h) => h.role === "辅助班主任")
        if (f.head?.length && !f.head.includes(hasPrimary ? "assigned" : "vacant")) return false
        if (f.assistant?.length && !f.assistant.includes(hasAssistant ? "assigned" : "vacant")) return false
        return true
      }),
    [classes, q, filters],
  )

  const summary = classes.find((c) => c.id === summaryId) ?? null
  const detail = classes.find((c) => c.id === detailId) ?? null
  const arranging = classes.find((c) => c.id === arrangingId) ?? null

  function rosterFor(c: AdminClass) {
    const removed = removedRoster[c.name] ?? []
    return [...studentProfilesByClass(c.name).map((s) => s.name), ...(extraRoster[c.name] ?? [])].filter(
      (n) => !removed.includes(n),
    )
  }

  function handleRemoveStudent(className: string, name: string) {
    setExtraRoster((r) => ({ ...r, [className]: (r[className] ?? []).filter((n) => n !== name) }))
    setRemovedRoster((r) => ({ ...r, [className]: [...(r[className] ?? []), name] }))
    push(`已将「${name}」移出班级名单（演示）`, "success")
  }

  function handleCreate(next: AdminClass) {
    setClasses((cs) => [...cs, next])
    setCreating(false)
    push(`已新建行政班「${next.name}」（演示）`, "success")
  }

  function handleAddEvent(classId: string, ev: ClassEvent) {
    setClasses((cs) => cs.map((c) => (c.id === classId ? { ...c, events: [ev, ...c.events] } : c)))
    push("已记录一条大事件（演示）", "success")
  }

  function handleUpdateFounded(classId: string, date: string) {
    setClasses((cs) => cs.map((c) => (c.id === classId ? { ...c, foundedDate: date } : c)))
    push("已更新创班日期（演示）", "success")
  }

  function handleAddStudent(className: string, name: string) {
    const wasOriginal = studentProfilesByClass(className).some((s) => s.name === name)
    setRemovedRoster((r) => ({ ...r, [className]: (r[className] ?? []).filter((n) => n !== name) }))
    if (!wasOriginal) setExtraRoster((r) => ({ ...r, [className]: [...(r[className] ?? []), name] }))
    push(`已将「${name}」加入班级名单（演示）`, "success")
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-muted-foreground">
          行政班是学生的归属班级。一个行政班可配置多名班主任：主班主任（最多一人，可暂缺）与辅助班主任（可多人）。
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" />
          新建行政班
        </Button>
      </div>

      <ListToolbar
        search={q}
        onSearch={setQ}
        searchPlaceholder="搜索班级名称或教室"
        groups={filterGroups}
        value={filters}
        onChange={setFilters}
        resultCount={rows.length}
        totalCount={classes.length}
      />

      {rows.length === 0 ? (
        <Card className="px-5 py-10">
          <EmptyState icon={<Users className="size-6" />} title="没有匹配的行政班" desc="调整搜索或筛选后重试。" />
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => {
          const primary = c.heads.find((h) => h.role === "主班主任")
          const assistants = c.heads.filter((h) => h.role === "辅助班主任")
          const count = rosterFor(c).length
          return (
            <Card key={c.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-semibold">{c.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.grade} · {c.room}
                  </p>
                </div>
                <Badge tone="neutral">
                  <Users className="size-3" />
                  {count} 人
                </Badge>
              </div>

              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">班主任团队</p>
                <div className="flex items-center gap-2 text-[13px]">
                  <Badge tone="primary">主班主任</Badge>
                  {primary ? <span>{primary.name}</span> : <span className="text-muted-foreground">暂缺</span>}
                </div>
                <div className="flex items-start gap-2 text-[13px]">
                  <Badge tone="info">辅助班主任</Badge>
                  {assistants.length ? (
                    <span>{assistants.map((a) => a.name).join("、")}</span>
                  ) : (
                    <span className="text-muted-foreground">暂缺</span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" />
                  {c.foundedDate || "未填写创班日期"}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button size="xs" variant="ghost" onClick={() => setTimetableName(c.name)}>
                    <CalendarDays className="size-3" />
                    课表
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setDetailId(c.id)}>
                    查看详情
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => setSummaryId(c.id)}>
                    班级概要
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* 班级概要：班主任团队 + 创班日期 + 大事件 */}
      {summary ? (
        <ClassSummarySheet
          cls={summary}
          onClose={() => setSummaryId(null)}
          onArrange={() => setArrangingId(summary.id)}
          onAddEvent={(ev) => handleAddEvent(summary.id, ev)}
          onUpdateFounded={(d) => handleUpdateFounded(summary.id, d)}
        />
      ) : null}

      {/* 班级详情：学生名单 + 增添学生 */}
      {detail ? (
        <ClassDetailSheet
          cls={detail}
          roster={rosterFor(detail)}
          onClose={() => setDetailId(null)}
          onAddStudent={(name) => handleAddStudent(detail.name, name)}
          onRemoveStudent={(name) => handleRemoveStudent(detail.name, name)}
          onOpenSummary={() => {
            setDetailId(null)
            setSummaryId(detail.id)
          }}
        />
      ) : null}

      {/* 新建行政班 */}
      {creating ? <CreateClassModal onClose={() => setCreating(false)} onCreate={handleCreate} /> : null}

      {/* 复用 P03：班级已选，职责限主/辅班主任，人员待选 */}
      {arranging ? (
        <DutyArrangeSheet
          open
          mode="arrange"
          presetClass={{ id: arranging.id, name: arranging.name }}
          existingPrimaryHead={arranging.heads.find((h) => h.role === "主班主任")?.name}
          onClose={() => setArrangingId(null)}
        />
      ) : null}

      {/* 行政班课表：归属安排 / 学生实际去向 双视图 */}
      {timetableName ? (
        <HomeroomTimetableSheet homeroomName={timetableName} onClose={() => setTimetableName(null)} />
      ) : null}
    </div>
  )
}

/* ---------------- 班级概要 ---------------- */

function ClassSummarySheet({
  cls,
  onClose,
  onArrange,
  onAddEvent,
  onUpdateFounded,
}: {
  cls: AdminClass
  onClose: () => void
  onArrange: () => void
  onAddEvent: (ev: ClassEvent) => void
  onUpdateFounded: (date: string) => void
}) {
  const [founded, setFounded] = useState(cls.foundedDate)
  const [evTitle, setEvTitle] = useState("")
  const [evDate, setEvDate] = useState("")
  const [evNote, setEvNote] = useState("")
  const [adding, setAdding] = useState(false)

  function submitEvent() {
    if (!evTitle.trim()) return
    onAddEvent({
      id: `ev-${cls.id}-${Date.now()}`,
      date: evDate || new Date().toISOString().slice(0, 10),
      title: evTitle.trim(),
      note: evNote.trim(),
    })
    setEvTitle("")
    setEvDate("")
    setEvNote("")
    setAdding(false)
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${cls.name} · 班级概要`}
      desc={`${cls.grade} · ${cls.room} · ${cls.studentCount} 名学生`}
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            返回
          </Button>
          <Button size="sm" onClick={onArrange}>
            <UserRound className="size-3.5" />
            添加班主任
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* 班级信息 */}
        <section>
          <p className="mb-2 text-[13px] font-semibold">班级信息</p>
          <div className="rounded-xl border border-border p-3.5">
            <Field label="创班日期" hint="创建时可填写，也可随时修改；非必填。">
              <div className="flex items-center gap-2">
                <Input type="date" value={founded} onChange={(e) => setFounded(e.target.value)} className="max-w-44" />
                <Button
                  size="xs"
                  variant="outline"
                  disabled={founded === cls.foundedDate}
                  onClick={() => onUpdateFounded(founded)}
                >
                  保存
                </Button>
                {founded ? null : <span className="text-xs text-muted-foreground">未填写</span>}
              </div>
            </Field>
          </div>
        </section>

        {/* 班主任团队 */}
        <section>
          <p className="mb-2 text-[13px] font-semibold">班主任团队</p>
          <div className="space-y-3">
            <TeamRow
              role="主班主任"
              names={cls.heads.filter((h) => h.role === "主班主任").map((h) => h.name)}
              hint="主岗最多一人，允许暂缺"
            />
            <TeamRow
              role="辅助班主任"
              names={cls.heads.filter((h) => h.role === "辅助班主任").map((h) => h.name)}
              hint="可多人；本班日常学生管理与主班主任同权"
            />
          </div>
        </section>

        {/* 大事件 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Sparkles className="size-3.5 text-primary" />
              大事件
              <span className="text-xs font-normal text-muted-foreground">（{cls.events.length} 条）</span>
            </p>
            <Button size="xs" variant="outline" onClick={() => setAdding((v) => !v)}>
              <Plus className="size-3.5" />
              记录事件
            </Button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">用于登记班级参加活动、获得奖励等集体记录，由班主任填写。</p>

          {adding ? (
            <div className="mb-3 space-y-2.5 rounded-xl border border-border bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="事件标题" required>
                  <Input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="如：校运会班级方阵第一名" />
                </Field>
                <Field label="日期">
                  <Input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} />
                </Field>
              </div>
              <Field label="说明">
                <Textarea value={evNote} onChange={(e) => setEvNote(e.target.value)} placeholder="补充事件的简要说明（可选）" />
              </Field>
              <div className="flex justify-end gap-2">
                <Button size="xs" variant="ghost" onClick={() => setAdding(false)}>
                  取消
                </Button>
                <Button size="xs" disabled={!evTitle.trim()} onClick={submitEvent}>
                  保存事件
                </Button>
              </div>
            </div>
          ) : null}

          {cls.events.length ? (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {cls.events.map((ev) => (
                <li key={ev.id} className="relative">
                  <span
                    className="absolute -left-[21px] top-1 size-2.5 rounded-full ring-2 ring-card"
                    style={{ background: "var(--primary)" }}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium">{ev.title}</span>
                    <span className="text-xs text-muted-foreground">{ev.date}</span>
                  </div>
                  {ev.note ? (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{ev.note}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-[12.5px] text-muted-foreground">
              暂无大事件记录。
            </p>
          )}
        </section>

        <InfoNote>
          “添加班主任”只在本班安排主 / 辅班主任职责，不新建行政班；班主任本人也没有创建或删除班级的权限。
        </InfoNote>
      </div>
    </Sheet>
  )
}

/* ---------------- 班级详情：学生名单 ---------------- */

function ClassDetailSheet({
  cls,
  roster,
  onClose,
  onAddStudent,
  onRemoveStudent,
  onOpenSummary,
}: {
  cls: AdminClass
  roster: string[]
  onClose: () => void
  onAddStudent: (name: string) => void
  onRemoveStudent: (name: string) => void
  onOpenSummary: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [pick, setPick] = useState("")
  const [manual, setManual] = useState("")

  // 可添加的学生：其他班级学生 + 尚未在本班名单中的
  const candidates = useMemo(
    () => STUDENT_PROFILES.filter((s) => s.adminClass !== cls.name && !roster.includes(s.name)).map((s) => s.name),
    [cls.name, roster],
  )

  function submit() {
    const name = pick || manual.trim()
    if (!name) return
    onAddStudent(name)
    setPick("")
    setManual("")
    setAdding(false)
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${cls.name} · 班级详情`}
      desc={`${cls.grade} · ${cls.room} · 创班日期 ${cls.foundedDate || "未填写"}`}
      width="max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            返回
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenSummary}>
            班级概要
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile label="学生数" value={`${roster.length} 人`} />
          <StatTile label="男生" value={`${cls.boys} 人`} />
          <StatTile label="女生" value={`${cls.girls} 人`} />
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Users className="size-3.5 text-primary" />
              学生名单
              <span className="text-xs font-normal text-muted-foreground">（{roster.length} 人）</span>
            </p>
            <Button size="xs" onClick={() => setAdding((v) => !v)}>
              <Plus className="size-3.5" />
              添加学生
            </Button>
          </div>

          {adding ? (
            <div className="mb-3 space-y-2.5 rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                从其他班级选择一名学生转入，或手动输入姓名（演示，不影响原始示例数据）。
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="从现有学生选择">
                  <select
                    className="w-full cursor-pointer rounded-lg border border-input bg-card px-3 py-2 pr-8 text-[14px] shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
                    value={pick}
                    onChange={(e) => {
                      setPick(e.target.value)
                      if (e.target.value) setManual("")
                    }}
                  >
                    <option value="">未选择</option>
                    {candidates.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="或手动输入姓名">
                  <Input
                    value={manual}
                    onChange={(e) => {
                      setManual(e.target.value)
                      if (e.target.value) setPick("")
                    }}
                    placeholder="输入学生姓名"
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="xs" variant="ghost" onClick={() => setAdding(false)}>
                  取消
                </Button>
                <Button size="xs" disabled={!pick && !manual.trim()} onClick={submit}>
                  加入名单
                </Button>
              </div>
            </div>
          ) : null}

          {roster.length ? (
            <div className="flex flex-wrap gap-1.5">
              {roster.map((n) => (
                <span
                  key={n}
                  className="group inline-flex items-center gap-1 rounded-md bg-muted py-1 pl-2 pr-1 text-xs text-muted-foreground"
                >
                  {n}
                  <button
                    type="button"
                    onClick={() => onRemoveStudent(n)}
                    aria-label={`将${n}移出名单`}
                    title="移出名单"
                    className="flex size-4 items-center justify-center rounded text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-[12.5px] text-muted-foreground">
              本班暂无学生名单。
            </p>
          )}
        </section>

        <InfoNote>班级详情用于查看与维护本班名单，点击学生右侧 × 可移出名单；跨班转入与移出仅为演示，不会改动其他班级的原始示例数据。</InfoNote>
      </div>
    </Sheet>
  )
}

/* ---------------- 新建行政班 ---------------- */

function CreateClassModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: AdminClass) => void }) {
  const [grade, setGrade] = useState("高一")
  const [name, setName] = useState("")
  const [room, setRoom] = useState("")
  const [founded, setFounded] = useState("")
  const [err, setErr] = useState<string | null>(null)

  function submit() {
    if (!name.trim()) {
      setErr("请填写班级名称")
      return
    }
    onCreate({
      id: `ac-${Date.now()}`,
      name: name.trim(),
      grade,
      room: room.trim() || "待分配",
      heads: [],
      studentCount: 0,
      boys: 0,
      girls: 0,
      foundedDate: founded,
      events: [],
      note: "新建行政班（示例）",
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="新建行政班"
      desc="填写班级基本信息后创建；班主任与学生名单可在创建后维护。"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={submit}>
            创建
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="年级" required>
            <select
              className="w-full cursor-pointer rounded-lg border border-input bg-card px-3 py-2 pr-8 text-[14px] shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              {["高一", "高二", "高三"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="教室">
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="如：A-201" />
          </Field>
        </div>
        <Field label="班级名称" required error={err ?? undefined}>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setErr(null)
            }}
            placeholder="如：高一3班"
          />
        </Field>
        <Field label="创班日期" hint="非必填，创建后仍可修改。">
          <Input type="date" value={founded} onChange={(e) => setFounded(e.target.value)} className="max-w-44" />
        </Field>
      </div>
    </Modal>
  )
}

/* ---------------- 复用小组件 ---------------- */

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-[13px] font-semibold">{value}</p>
    </div>
  )
}

function TeamRow({ role, names, hint }: { role: HeadRole; names: string[]; hint: string }) {
  return (
    <div className="rounded-xl border border-border p-3.5">
      <div className="flex items-center gap-2">
        <Badge tone={ROLE_TONE[role]}>{role}</Badge>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      {names.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {names.map((n) => (
            <div key={n} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[13px]">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                {n.slice(-2)}
              </span>
              {n}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground">暂缺（允许暂时空缺）。</p>
      )}
    </div>
  )
}
