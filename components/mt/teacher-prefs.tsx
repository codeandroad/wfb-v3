"use client"

import { Badge, Card, CardHeader, Input, Segmented } from "@/components/kit"
import { buttonVariants } from "@/components/ui/button"
import { HW_DAYS_MAX, PAGE_SIZE_MAX, PAGE_SIZE_MIN, PAGE_SIZES, pageSizeError } from "@/lib/mt/hw"
import { permittedTasks } from "@/lib/mt/derive"
import { ATT_LABEL, classOf, courseOf, dutyOf, personalDisplay, type Attendance, type STask } from "@/lib/mt/model"
import {
  FONT_LABEL,
  LEVEL_LABEL,
  resolveStyle,
  STYLE_COLORS,
  STYLE_BGS,
  cardStyle,
  tagStyle,
  styleKey,
  titleClass,
  WEIGHT_LABEL,
  type StyleFont,
  type StyleLevel,
  type StylePref,
  type StyleWeight,
} from "@/lib/mt/styles"
import { emptyLib, PHRASE_MAX, REASON_STATES, SYSTEM_PHRASES, type PersonalPhrase, type PhraseKind } from "@/lib/mt/phrases"
import { useMt, usePhraseWriters, usePrefWriters, useTeacherPrefs } from "@/lib/mt/store"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import { StyleColorInput } from "@/components/mt/style-color-input"

const btn = (variant: "outline" | "ghost" | "default" = "outline") => cn(buttonVariants({ variant, size: "sm" }), "h-7 gap-1 px-2 text-xs")

export function TeacherPrefsPanel({ teacherId }: { teacherId: string }) {
  return (
    <section id="prefs" aria-label="我的偏好" className="mt-6 flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <HwDaysCard teacherId={teacherId} />
        <PageSizeCard teacherId={teacherId} />
      </div>
      <StyleCard teacherId={teacherId} />
      <PhraseLibraryCard teacherId={teacherId} />
    </section>
  )
}

export function StyleCard({ teacherId }: { teacherId: string }) {
  const mt = useMt()
  const pw = usePrefWriters(teacherId)
  const tasks = permittedTasks(mt.biz, teacherId)
  const [level, setLevel] = useState<StyleLevel>("TASK")
  const targets = (() => {
    const seen = new Map<string, { id: string; label: string; task: STask }>()
    for (const t of tasks) {
      const id = level === "TASK" ? t.id : level === "CLASS" ? t.class_id : t.course_id
      if (!id || seen.has(id)) continue
      const duty = dutyOf(t)?.normative_label ?? null
      const pd = personalDisplay(t, teacherId, mt.biz.taskPrefs, mt.biz.lessonOverrides)
      const custom = pd.division && pd.division !== duty ? `（显示为「${pd.division}」）` : ""
      const label = level === "TASK" ? `${classOf(t).name}${duty ? ` · ${duty}` : ""}` : level === "CLASS" ? classOf(t).name : (courseOf(t)?.name ?? id)
      seen.set(id, { id, label, task: t })
    }
    const list = [...seen.values()]
    const count = new Map<string, number>()
    return list.map((x) => {
      const total = list.filter((y) => y.label === x.label).length
      if (total < 2) return x
      return { ...x, label: `${x.label} · ${courseOf(x.task)?.name ?? x.task.valid_from}` }
    })
  })()
  const [pick, setPick] = useState<string | null>(null)
  const [styleNotice, setStyleNotice] = useState("")
  const [undoStyles, setUndoStyles] = useState<{ stamp: number; entries: Record<string, StylePref> } | null>(null)
  const target = targets.find((x) => x.id === pick) ?? targets[0]
  if (!target) return null
  const targetDivision = personalDisplay(target.task, teacherId, mt.biz.taskPrefs, mt.biz.lessonOverrides).division
  const key = styleKey(teacherId, level, target.id)
  const own = mt.biz.styles?.[key] ?? {}
  const eff = resolveStyle(mt.biz, teacherId, target.task)
  const set = (patch: Partial<StylePref>) => pw.setStyle(key, { ...own, ...patch })

  return (
    <Card>
      <CardHeader
        title="我的显示样式"
        desc="只改变你自己界面中课表卡片的名称样式，不影响共享名称、排课或他人。优先级：本任务 > 本班级 > 本课程 > 系统默认。"
        action={
          <Segmented<StyleLevel>
            size="sm"
            ariaLabel="样式层级"
            value={level}
            onChange={(v) => {
              setLevel(v)
              setPick(null)
            }}
            options={(["TASK", "CLASS", "COURSE"] as StyleLevel[]).map((l) => ({ value: l, label: LEVEL_LABEL[l] }))}
          />
        }
      />
      <div className="grid gap-5 px-5 py-4 md:grid-cols-[2fr_3fr]">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">设置对象</span>
            <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={target.id} onChange={(e) => setPick(e.target.value)}>
              {targets.map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-border bg-card px-3 py-2.5" style={cardStyle(eff)} data-testid="style-preview">
            <p className="text-[11px] text-muted-foreground">卡片预览（当前生效）</p>
            <p className={cn("text-sm font-semibold leading-snug", titleClass(eff))} style={eff.hex ? { color: eff.hex } : undefined}>
              {classOf(target.task).name}
            </p>
            {targetDivision ? (
              <span className="mt-1 inline-block rounded px-1 text-xs font-medium" style={tagStyle(eff) ?? { backgroundColor: "rgba(0,0,0,.06)" }}>
                {targetDivision}
              </span>
            ) : (
              <span className="mt-1 block text-[11px] text-muted-foreground">整科任务，无分工标签</span>
            )}
            <span className="mt-1 block text-[11px] font-medium text-[#8a5a10]">待评价 3 · 示例状态文字</span>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {(["color", "tag", "bg", "weight", "font"] as const)
                .map((f) => `${{ color: "文字", tag: "分工", bg: "背景", weight: "字重", font: "字体" }[f]}：${eff.from[f] ? LEVEL_LABEL[eff.from[f]!] : "系统默认"}`)
                .join(" · ")}
            </p>
          </div>
          <button type="button" className={cn(btn(), "self-start")} disabled={!mt.biz.styles?.[key]} onClick={() => pw.setStyle(key, null)}>
            恢复{LEVEL_LABEL[level]}继承
          </button>
          {level === "CLASS" ? <>
            <p className="text-sm">本教学班全部本人任务</p>
            {tasks.filter(t => t.class_id === target.id).map(t => {
              const style = resolveStyle(mt.biz, teacherId, t)
              const separate = mt.biz.styles?.[styleKey(teacherId, "TASK", t.id)]
              const display = personalDisplay(t, teacherId, mt.biz.taskPrefs, mt.biz.lessonOverrides)
              return <div key={t.id} className="rounded border border-border p-3 text-sm" style={cardStyle(style)}>
                <strong style={{ color: style.hex ?? undefined }}>{display.division ?? classOf(t).subject}</strong>
                <p>{dutyOf(t)?.normative_label ?? "整科"} · {separate ? "有独立覆盖（普通班级修改不会清除）" : "继承班级样式"}</p>
                <p>{(["color", "bg", "weight", "font"] as const).map(f => `${{ color: "主题", bg: "背景", weight: "字重", font: "字体" }[f]}：${style.from[f] ? LEVEL_LABEL[style.from[f]!] : "系统"}`).join(" · ")}</p>
              </div>
            })}
            <button type="button" className={btn()} onClick={() => {
              let snapshot: Record<string, StylePref> = {}
              let stamp = 0
              const result = mt.command("统一使用本班样式", s => {
                const styles = { ...s.styles }
                for (const t of permittedTasks(s, teacherId).filter(t => t.class_id === target.id)) {
                  const k = styleKey(teacherId, "TASK", t.id)
                  if (styles[k]) snapshot[k] = styles[k]
                  delete styles[k]
                }
                stamp = s.stamp + 1
                return { ...s, styles }
              })
              if (result.ok) { setUndoStyles({ stamp, entries: snapshot }); setStyleNotice("已统一本人本班任务，个人分工名称与其他设置不变。") }
              else setStyleNotice(result.error)
            }}>统一使用本班样式（{tasks.filter(t => t.class_id === target.id).length} 个任务）</button>
          </> : null}
          {styleNotice ? <p role="status" className="text-sm">{styleNotice}</p> : null}
          {undoStyles ? <button type="button" className={btn()} onClick={() => {
            const result = mt.command("撤销统一样式", s => s.stamp !== undoStyles.stamp ? { error: "之后已有修改，为保护新设置，本次撤销未执行。" } : { ...s, styles: { ...s.styles, ...undoStyles.entries } })
            setStyleNotice(result.ok ? "已恢复统一前的任务样式。" : result.error)
            setUndoStyles(null)
          }}>撤销统一本班</button> : null}
        </div>
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs text-muted-foreground">颜色</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!own.color} onClick={() => set({ color: undefined })} className={cn("rounded-md border px-2 py-1 text-xs", !own.color ? "border-primary ring-2 ring-primary/30" : "border-border")}>
                继承
              </button>
              {STYLE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={own.color === c.id}
                  aria-label={c.label}
                  title={c.label}
                  onClick={() => set({ color: c.id })}
                  className={cn("size-7 rounded-md border-2", own.color === c.id ? "border-foreground" : "border-transparent")}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </fieldset>
          <StyleColorInput key={`${key}:color:${own.color}`} label="主题色" value={own.color?.startsWith("#") ? own.color : STYLE_COLORS.find(c => c.id === own.color)?.hex ?? eff.hex ?? ""} onChange={color => set({ color })} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs text-muted-foreground">课卡背景</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!own.bg} onClick={() => set({ bg: undefined })} className={cn("rounded-md border px-2 py-1 text-xs", !own.bg ? "border-primary ring-2 ring-primary/30" : "border-border")}>
                继承
              </button>
              <button type="button" aria-pressed={own.bg === "AUTO"} onClick={() => set({ bg: "AUTO" })} className="rounded-md border px-2 py-1 text-sm">跟随主题色</button>
              {STYLE_BGS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={own.bg === b.id}
                  onClick={() => set({ bg: b.id })}
                  className={cn("rounded-md border px-2 py-1 text-xs", own.bg === b.id ? "ring-2 ring-foreground" : "")}
                  style={b.id === "NONE" ? { borderStyle: "dashed" } : { backgroundColor: b.hex, borderColor: b.border }}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{"「无染色」是明确设置，会盖住上级背景；「继承」才沿用课程/班级层。背景均为浅底，待办、锁定、冲突等状态文字保持可读。"}</p>
          </fieldset>
          <StyleColorInput key={`${key}:bg:${own.bg}`} label="背景色" value={own.bg?.startsWith("#") ? own.bg : STYLE_BGS.find(b => b.id === own.bg)?.hex ?? ""} onChange={bg => set({ bg })} />
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">字重</span>
              <Segmented<string>
                size="sm"
                ariaLabel="字重"
                value={own.weight ?? ""}
                onChange={(v) => set({ weight: (v || undefined) as StyleWeight | undefined })}
                options={[{ value: "", label: "继承" }, ...(Object.keys(WEIGHT_LABEL) as StyleWeight[]).map((w) => ({ value: w, label: WEIGHT_LABEL[w] }))]}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">字体</span>
              <Segmented<string>
                size="sm"
                ariaLabel="字体"
                value={own.font ?? ""}
                onChange={(v) => set({ font: (v || undefined) as StyleFont | undefined })}
                options={[{ value: "", label: "继承" }, ...(Object.keys(FONT_LABEL) as StyleFont[]).map((f) => ({ value: f, label: FONT_LABEL[f] }))]}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function HwDaysCard({ teacherId }: { teacherId: string }) {
  const prefs = useTeacherPrefs(teacherId)
  const pw = usePrefWriters(teacherId)
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? String(prefs.hwDays)
  const n = Number(value)
  const valid = value.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= HW_DAYS_MAX
  const dirty = draft !== null && n !== prefs.hwDays
  return (
    <Card>
      <CardHeader title="作业默认截止天数" desc="新布置作业时，截止日期默认为布置日 + N 天。只影响之后新建的作业，已有作业不变。" />
      <form
        className="flex flex-wrap items-center gap-2 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid || !dirty) return
          pw.setHwDays(n)
          setDraft(null)
        }}
      >
        <label htmlFor="hw-days" className="text-sm">布置日 +</label>
        <Input id="hw-days" type="number" inputMode="numeric" min={0} max={HW_DAYS_MAX} className="w-20" value={value} onChange={(e) => setDraft(e.target.value)} aria-invalid={!valid} />
        <span className="text-sm">天</span>
        <button type="submit" className={btn("default")} disabled={!valid || !dirty}>保存</button>
        {!valid ? <span className="w-full text-xs text-destructive">请输入 0–{HW_DAYS_MAX} 的整数</span> : null}
        {valid && n === 0 ? <span className="w-full text-xs text-muted-foreground">0 天表示当天截止</span> : null}
      </form>
    </Card>
  )
}

export function PageSizeCard({ teacherId }: { teacherId: string }) {
  const prefs = useTeacherPrefs(teacherId)
  const pw = usePrefWriters(teacherId)
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? String(prefs.pageSize)
  const err = pageSizeError(value)
  const canSave = !!value.trim() && !err && Number(value.trim()) !== prefs.pageSize
  return (
    <Card>
      <CardHeader title="学生列表每页人数" desc="作业评阅、周反馈矩阵共用此偏好；各列表页码独立。改动只影响显示分页，不缩小批量、搜索、统计或发布范围。" />
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">推荐</span>
          {PAGE_SIZES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={prefs.pageSize === n}
              onClick={() => (pw.setPageSize(n), setDraft(null))}
              className={cn("rounded-md border px-2.5 py-1 text-xs", prefs.pageSize === n ? "border-primary bg-accent font-medium text-primary" : "border-border")}
            >
              每页 {n} 人
            </button>
          ))}
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!canSave) return
            pw.setPageSize(Number(value.trim()))
            setDraft(null)
          }}
        >
          <label htmlFor="page-size-custom" className="text-xs text-muted-foreground">自定义</label>
          <span className="text-sm">每页</span>
          <Input
            id="page-size-custom"
            inputMode="numeric"
            className="h-8 w-20"
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!!err}
            aria-describedby="page-size-hint"
            data-testid="page-size-input"
          />
          <span className="text-sm">人</span>
          <button type="submit" className={btn("default")} disabled={!canSave}>保存</button>
          <span id="page-size-hint" className={cn("w-full text-xs", err ? "text-destructive" : "text-muted-foreground")}>
            {err ?? (value.trim() ? `范围 ${PAGE_SIZE_MIN}–${PAGE_SIZE_MAX}；当前生效：每页 ${prefs.pageSize} 人` : "请输入人数（输入中不按 0 处理）")}
          </span>
        </form>
      </div>
    </Card>
  )
}

export function PhraseLibraryCard({ teacherId }: { teacherId: string }) {
  const mt = useMt()
  const pw = usePhraseWriters(teacherId)
  const [kind, setKind] = useState<PhraseKind>("REASON")
  const lib = mt.biz.phrases[teacherId] ?? emptyLib()
  const mine = lib.items.filter((p) => p.kind === kind).sort((a, b) => a.order - b.order)
  const system = SYSTEM_PHRASES.filter((p) => p.kind === kind)
  const savedFrom = new Set(lib.items.map((p) => p.fromSystemId).filter(Boolean))

  return (
    <Card>
      <CardHeader
        title="常用内容"
        desc="维护考勤原因与学生亮点的个人快捷文字。修改、停用或删除不会改写学生记录中已保存的文字。"
        action={
          <Segmented<PhraseKind>
            size="sm"
            ariaLabel="内容类型"
            value={kind}
            onChange={setKind}
            options={[
              { value: "REASON", label: "考勤原因" },
              { value: "HIGHLIGHT", label: "学生亮点" },
            ]}
          />
        }
      />
      <div className="grid gap-0 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-3 border-border px-5 py-4 lg:border-r">
          <h3 className="text-sm font-semibold">我的常用（{mine.length}）</h3>
          <AddPhrase key={kind} kind={kind} onAdd={(text, states) => pw.add(kind, text, { states })} />
          {mine.length ? (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {mine.map((p, i) => (
                <PhraseRow
                  key={p.id}
                  p={p}
                  first={i === 0}
                  last={i === mine.length - 1}
                  fav={lib.favs.includes(p.id)}
                  onMove={(d) => pw.move(p.id, d)}
                  onEdit={(text, states) => pw.edit(p.id, { text, states })}
                  onActive={(a) => pw.setActive(p.id, a)}
                  onRemove={() => pw.remove(p.id)}
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">还没有个人常用内容，可新增或从右侧系统建议另存。</p>
          )}
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <h3 className="text-sm font-semibold">系统建议</h3>
          <p className="text-xs text-muted-foreground">系统原文不可修改；另存为个人项后可编辑。</p>
          <ul className="flex flex-col gap-1.5">
            {system.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-1.5">
                <span className="min-w-0 text-sm">
                  {p.text}
                  <span className="ml-2 text-[11px] text-muted-foreground">{p.states?.map((s) => ATT_LABEL[s]).join("、") ?? p.category}</span>
                </span>
                {savedFrom.has(p.id) ? (
                  <Badge>已另存</Badge>
                ) : (
                  <button type="button" className={btn("ghost")} onClick={() => pw.add(kind, p.text, { states: p.states, category: p.category, fromSystemId: p.id })}>
                    <Plus className="size-3.5" aria-hidden />
                    另存
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}

function StatePicker({ value, onChange }: { value: Attendance[]; onChange: (v: Attendance[]) => void }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">适用出勤状态</legend>
      {REASON_STATES.map((s) => {
        const on = value.includes(s)
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== s) : [...value, s])}
            className={cn("rounded-full border px-2 py-0.5 text-xs", on ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground hover:text-foreground")}
          >
            {ATT_LABEL[s]}
          </button>
        )
      })}
    </fieldset>
  )
}

function AddPhrase({ kind, onAdd }: { kind: PhraseKind; onAdd: (text: string, states?: Attendance[]) => void }) {
  const [text, setText] = useState("")
  const [states, setStates] = useState<Attendance[]>([])
  const t = text.trim()
  const ok = t.length > 0 && t.length <= PHRASE_MAX && (kind !== "REASON" || states.length > 0)
  return (
    <form
      className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!ok) return
        onAdd(t, kind === "REASON" ? states : undefined)
        setText("")
      }}
    >
      <div className="flex gap-2">
        <Input aria-label="新增常用内容" placeholder={kind === "REASON" ? "例如：参加校队训练" : "例如：主动整理错题"} value={text} maxLength={PHRASE_MAX} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className={cn(btn("default"), "h-9")} disabled={!ok}>
          <Plus className="size-3.5" aria-hidden />
          新增
        </button>
      </div>
      {kind === "REASON" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">适用于</span>
          <StatePicker value={states} onChange={setStates} />
        </div>
      ) : null}
    </form>
  )
}

function PhraseRow({
  p,
  first,
  last,
  fav,
  onMove,
  onEdit,
  onActive,
  onRemove,
}: {
  p: PersonalPhrase
  first: boolean
  last: boolean
  fav: boolean
  onMove: (d: -1 | 1) => void
  onEdit: (text: string, states?: Attendance[]) => void
  onActive: (a: boolean) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [text, setText] = useState(p.text)
  const [states, setStates] = useState<Attendance[]>(p.states ?? [])
  const t = text.trim()
  const ok = t.length > 0 && t.length <= PHRASE_MAX && (p.kind !== "REASON" || states.length > 0)

  if (editing)
    return (
      <li className="flex flex-col gap-2 bg-accent/40 px-3 py-2">
        <Input aria-label="编辑常用内容" value={text} maxLength={PHRASE_MAX} onChange={(e) => setText(e.target.value)} autoFocus />
        {p.kind === "REASON" ? <StatePicker value={states} onChange={setStates} /> : null}
        <div className="flex gap-1.5">
          <button
            type="button"
            className={btn("default")}
            disabled={!ok}
            onClick={() => {
              onEdit(t, p.kind === "REASON" ? states : undefined)
              setEditing(false)
            }}
          >
            <Check className="size-3.5" aria-hidden />
            保存
          </button>
          <button
            type="button"
            className={btn()}
            onClick={() => {
              setText(p.text)
              setStates(p.states ?? [])
              setEditing(false)
            }}
          >
            取消
          </button>
        </div>
      </li>
    )

  return (
    <li className={cn("flex items-center gap-2 px-3 py-2", !p.active && "bg-muted/40")}>
      <div className="flex flex-col">
        <button type="button" aria-label={`上移「${p.text}」`} disabled={first} onClick={() => onMove(-1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
          <ArrowUp className="size-3.5" aria-hidden />
        </button>
        <button type="button" aria-label={`下移「${p.text}」`} disabled={last} onClick={() => onMove(1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
          <ArrowDown className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", !p.active && "text-muted-foreground line-through")}>{p.text}</p>
        <p className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
          {p.states?.map((s) => ATT_LABEL[s]).join("、")}
          {p.category ? <span>{p.category}</span> : null}
          {fav ? <span>· 已收藏</span> : null}
          {p.fromSystemId ? <span>· 来自系统建议</span> : null}
          {!p.active ? <span>· 已停用</span> : null}
        </p>
      </div>
      {confirmDel ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-destructive">确认删除？</span>
          <button type="button" className={cn(btn(), "text-destructive")} onClick={onRemove}>删除</button>
          <button type="button" aria-label="取消删除" className={btn("ghost")} onClick={() => setConfirmDel(false)}>
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button type="button" className={btn("ghost")} onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden />
            编辑
          </button>
          <button type="button" className={btn("ghost")} onClick={() => onActive(!p.active)}>
            {p.active ? "停用" : "启用"}
          </button>
          <button type="button" aria-label={`删除「${p.text}」`} className={btn("ghost")} onClick={() => setConfirmDel(true)}>
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </li>
  )
}
