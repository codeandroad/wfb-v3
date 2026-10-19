"use client"

import { cn } from "@/lib/utils"
import { useState, type CSSProperties, type ReactNode } from "react"
import { Card, CardHeader, Modal } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { useStyleDrafts, type StyleDrafts, type ColorField } from "@/components/mt/use-style-drafts"
import { StyleColorInput } from "@/components/mt/style-color-input"
import { useTeacherId, permittedTasks } from "@/lib/mt/derive"
import { useMt } from "@/lib/mt/store"
import { useDemo } from "@/lib/demo/store"
import { PERSONAS } from "@/lib/demo/nav"
import { classOf, courseOf, dutyOf, taskById, type STask } from "@/lib/mt/model"
import { useTimetable, teacherWeekEntries } from "@/lib/timetable/store"
import { resolveStyle, resolvePreference, STYLE_COLORS, STYLE_BGS, titleClass, FONT_LABEL, WEIGHT_LABEL, LEVEL_LABEL, type StyleLevel, type ResolvedStyle, type StyleFont, type StyleWeight } from "@/lib/mt/styles"
import { teacherEditorPref, teacherEditorEffective, saveTeacherAppearancePatch, teacherSurfaceStyle, teacherObjectBackground, teacherCardTextStyle, type TeacherAppearancePart } from "@/lib/timetable/teacher-appearance"
import { appearanceEditorPref, appearanceEditorEffective, saveAppearancePatch, cardSurfaceStyle, objectTextBackground, type AppearancePatch, type SurfacePref } from "@/lib/timetable/surface"
import { appearanceKey, appearancePref, cardTextPart, cardPartForEntry, resolveCardAppearance, resolveCardTextAppearance, DISPLAY_PART_LABEL, titleParts, type Appearance, type CardIdentity, type CardTextField, type DisplayMode, type DisplayPart } from "@/lib/timetable/display"
import { teacherById, type ProjectedEntry } from "@/lib/timetable/data"

export function useTimetableAppearance(mode: DisplayMode) {
  const mt = useMt()
  const teacherId = useTeacherId()
  const { persona } = useDemo()
  const viewer = PERSONAS[persona].staffId
  const appearance: Appearance = { mode, viewer, teacherId, teachingTaskIds: mode === "teacher" ? permittedTasks(mt.biz, teacherId).map(task => task.id) : undefined, styles: mt.biz.styles ?? {} }
  const save = (part: DisplayPart, id: string, patch: AppearancePatch | null) => {
    if (!mt.ready || mt.loadError) return { ok: false as const, error: "显示设置尚未加载，请重试。" }
    // Namespace always comes from the active viewer, never the teacher being inspected.
    return mt.command("课表显示设置", s => ({ ...s, styles: saveAppearancePatch(s.styles ?? {}, viewer, mode, part, id, patch) }))
  }
  return { appearance, save }
}

export function personalAppearanceTask(appearance: Appearance | undefined, entry: CardIdentity) {
  if (appearance?.mode !== "teacher" || !appearance.teacherId || !entry.taskId || entry.kind === "activity") return null
  const task = taskById(entry.taskId)
  return task && (appearance.teachingTaskIds ? appearance.teachingTaskIds.includes(task.id) : task.teacher_id === appearance.teacherId) ? task : null
}

export function StyledLessonTitle({ entry, appearance }: { entry: CardIdentity; appearance?: Appearance }) {
  const parts = titleParts(entry)
  const segment = (part: DisplayPart, id: string | null, text: string) => {
    const style = resolvePreference(id && appearance ? appearancePref(appearance, part, id) : undefined)
    const css: CSSProperties = { color: style.hex ?? undefined, backgroundColor: style.bg?.hex }
    return <span data-title-part={part.toLowerCase()} className={titleClass(style) || undefined} style={css}>{text}</span>
  }
  const content = parts && appearance ? <>{segment("HOMEROOM", parts.homeroomId, parts.classText)}{parts.separator}{segment("SUBJECT", parts.subjectId, parts.subjectText)}</> : entry.className
  const task = personalAppearanceTask(appearance, entry)
  const backgroundColor = task && appearance?.teacherId
    ? teacherObjectBackground(appearance.styles, appearance.teacherId, task)
    : objectTextBackground(appearance, entry)
  return backgroundColor ? <span data-card-text="object" style={{ backgroundColor }}>{content}</span> : <>{content}</>
}

export function StyledCardText({ entry, appearance, field, children }: { entry: CardIdentity; appearance?: Appearance; field: CardTextField; children: ReactNode }) {
  const task = personalAppearanceTask(appearance, entry)
  const style = task && appearance?.teacherId
    ? teacherCardTextStyle(appearance.styles, appearance.teacherId, task, field)
    : resolveCardTextAppearance(appearance, entry, field)
  return <span data-card-text={field} className={titleClass(style) || undefined} style={{ color: style.hex ?? undefined, backgroundColor: style.bg?.hex }}>{children}</span>
}

export function PersonalLessonTitle({ task, name }: { task: STask; name?: string }) {
  const { appearance } = useTimetableAppearance("teacher")
  const cls = classOf(task)
  return <StyledLessonTitle entry={{ className: name ?? cls.name, subject: cls.subject, taskId: task.id }} appearance={appearance} />
}

export function PersonalCardText({ task, field, children }: { task: STask; field: CardTextField; children: ReactNode }) {
  const { appearance } = useTimetableAppearance("teacher")
  const cls = classOf(task)
  return <StyledCardText entry={{ className: cls.name, subject: cls.subject, taskId: task.id }} appearance={appearance} field={field}>{children}</StyledCardText>
}

export function TeacherTitleStyleCard({ tasks }: { tasks: STask[] }) {
  const [open, setOpen] = useState(false)
  const tt = useTimetable()
  const { persona } = useDemo()
  const entries: ProjectedEntry[] = [...teacherWeekEntries(tt, persona, tt.weekStart).entries]
  entries.push(...tasks.filter(t => !entries.some(entry => entry.taskId === t.id)).map(t => ({ key: t.id, taskId: t.id, className: classOf(t).name, subject: classOf(t).subject, teacherId: persona, date: tt.weekStart, weekday: 1, periodId: "m1", room: null })))
  return <Card className="mt-4"><CardHeader title="课表显示样式" desc="课卡外观与文字分开设置，教学对象和活动统一选择，也可细分学科与行政班文字。" action={<Button variant="outline" size="sm" onClick={() => setOpen(true)}>设置显示样式</Button>} />
    {open ? <TimetableDisplaySettings mode="teacher" entries={entries} onClose={() => setOpen(false)} /> : null}
  </Card>
}

export function TimetableDisplaySettings({ mode, entries, onClose }: { mode: DisplayMode; entries: ProjectedEntry[]; onClose: () => void }) {
  const { appearance, save } = useTimetableAppearance(mode)
  const mt = useMt()
  const teacherId = useTeacherId()
  const [part, setPart] = useState<DisplayPart>("CARD")
  const [cardField, setCardField] = useState<"surface" | "object" | CardTextField>("surface")
  const [pick, setPick] = useState("")
  const [notice, setNotice] = useState("")
  const targets = new Map<string, { label: string; entry: ProjectedEntry }>()
  entries.forEach(entry => {
    const parts = titleParts(entry)
    const id = part === "TEACHER" ? entry.teacherId
      : part === "CARD" ? JSON.stringify([entry.kind === "activity" ? "activity" : "teaching", entry.className])
      : part === "SUBJECT" ? parts?.subjectId : parts?.homeroomId
    if (id && !targets.has(id)) targets.set(id, { label: part === "TEACHER" ? teacherById(id)?.name ?? id : part === "SUBJECT" ? parts!.subjectText : part === "HOMEROOM" ? parts!.classText : entry.className, entry })
  })
  const id = targets.has(pick) ? pick : [...targets.keys()][0]
  const target = targets.get(id)
  const textField = part === "CARD" && (cardField === "teacher" || cardField === "room") ? cardField : null
  const editorPart = part === "CARD" ? cardField === "surface" ? "CARD_SURFACE" : cardField === "object" ? "CARD_OBJECT_TEXT" : cardTextPart(cardField) : part
  const savedPart = part === "CARD" && target ? cardPartForEntry(editorPart, target.entry) : editorPart
  const editorId = part === "CARD" ? target?.entry.className ?? "" : id ?? ""
  const key = appearanceKey(appearance.viewer, mode, savedPart, editorId)
  const drafts = useStyleDrafts(key, JSON.stringify([appearance.viewer, mode, part, id]))
  const own = appearanceEditorPref(appearance, savedPart, editorId)
  const draft = Object.keys(drafts.patch).length ? { ...appearance, styles: saveAppearancePatch(appearance.styles, appearance.viewer, mode, savedPart, editorId, drafts.patch) } : appearance
  const effective = target ? appearanceEditorEffective(draft, savedPart, editorId, target.entry) : resolvePreference()
  const whole = part === "TEACHER"
  const previewTask = target?.entry.taskId ? taskById(target.entry.taskId) : null
  const base = mode === "admin" && target ? resolveCardAppearance(draft, target.entry)
    : whole ? effective : mode === "teacher" && previewTask
    ? resolveStyle(mt.biz, teacherId, previewTask)
    : resolvePreference(target ? appearancePref(draft, "CARD", target.entry.className) : undefined)
  const specific = target ? appearancePref(draft, target.entry.kind === "activity" ? "ACTIVITY" : "CARD", target.entry.className) : undefined
  const overrideLabels = part === "TEACHER" ? (["color", "bg", "weight", "font"] as const)
    .filter(field => specific?.[field] !== undefined)
    .map(field => ({ color: "文字颜色", bg: "课卡背景", weight: "字重", font: "字体" })[field]) : []
  const set = (patch: AppearancePatch | null) => {
    if (!id) return false
    const result = save(savedPart, editorId, patch)
    setNotice(result.ok ? patch ? "已保存，仅更新本次属性。" : "已恢复继承。" : result.error)
    if (result.ok) drafts.saved(patch)
    return result.ok
  }
  const levels: DisplayPart[] = mode === "admin" ? ["CARD", "TEACHER", "SUBJECT", "HOMEROOM"] : ["CARD", "SUBJECT", "HOMEROOM"]
  const switchCardField = (field: typeof cardField) => {
    const saved = Object.keys(drafts.patch).length ? set(drafts.patch) : true
    setCardField(field)
    if (saved) setNotice("")
  }
  return <Modal open onClose={onClose} title={mode === "admin" ? "我的教务课表样式" : "我的课表样式"} desc={mode === "admin" ? "只改变本人显示。教师样式作为基础，独立整卡或活动设置优先；学科与行政班文字保留各自设置。" : "只改变本人显示。课卡外观与各部分文字独立设置，保留已有任务、班级和课程范围。"} width="max-w-3xl" footer={<Button variant="outline" onClick={onClose}>完成</Button>}>
    <div className="flex flex-wrap gap-2" role="group" aria-label="样式类别">{levels.map(p => <Button key={p} size="sm" variant={p === part ? "default" : "outline"} aria-pressed={p === part} onClick={() => { setPart(p); setCardField("surface"); setPick(""); setNotice(""); drafts.reset() }}>{DISPLAY_PART_LABEL[p]}</Button>)}</div>
    {mode === "teacher" && part === "CARD" ? <TeacherCardStyleEditor teacherId={teacherId} entries={entries} /> : !target ? <p className="py-8 text-sm text-muted-foreground">{part === "TEACHER" ? "当前范围没有教师课卡，可切换对象或周次后再设置。" : `当前范围没有可设置的${DISPLAY_PART_LABEL[part]}。可切换对象或周次后再设置；未识别为组合名称的课卡保留整体样式。`}</p> : <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-4">
        <label className="block space-y-1 text-sm"><span>{part === "TEACHER" ? "选择教师（当前课表范围）" : "设置对象"}</span><select aria-label={part === "TEACHER" ? "教师样式对象" : "细分样式对象"} value={id} onChange={e => { setPick(e.target.value); setNotice(""); drafts.reset() }} className="h-9 w-full rounded-md border border-input bg-card px-2">{part === "CARD" ? <CardObjectOptions options={[...targets].map(([value, t]) => ({ value, label: t.label, activity: t.entry.kind === "activity" }))} /> : [...targets].map(([value, t]) => <option key={value} value={value}>{t.label}</option>)}</select></label>
        {part === "CARD" ? <div role="group" aria-label="课卡内容样式" className="flex flex-wrap gap-1.5">{(["surface", "object", "teacher", "room"] as const).map(field => <Button key={field} size="xs" variant={field === cardField ? "default" : "outline"} aria-pressed={field === cardField} onClick={() => switchCardField(field)}>{field === "surface" ? "课卡外观" : field === "object" ? "对象名称" : DISPLAY_PART_LABEL[cardTextPart(field)]}</Button>)}</div> : null}
        {part === "CARD" && target.entry.kind === "activity" ? <p className="text-xs text-muted-foreground">按完整活动名称应用到同名活动，不拆分学科或行政班。</p> : null}
        <TimetableCardPreview entry={target.entry} appearance={draft} base={base} showTeacher={mode === "admin"} previewing={drafts.pending} />
        <p className="text-xs leading-relaxed text-muted-foreground">{editorPart === "CARD_SURFACE" ? "设置整张课卡的背景、边框与圆角。文字样式单独保留；停课、锁定、草稿、补课等状态外观优先，冲突提示继续显示。" : editorPart === "CARD_OBJECT_TEXT" ? "只设置名称文字与局部底色。整卡背景、边框在“课卡外观”设置；教学对象仍保留学科、行政班片段样式。" : textField === "teacher" ? "只设置此对象课卡中的教师姓名文字。教学班、行政班视图生效；教师视图仍不重复显示姓名。" : textField === "room" ? "只设置此对象课卡中的地点文字（教室、办公室等），沿用已排地点；文字底色不影响整张课卡。" : part === "TEACHER" ? "应用到该教师的所有课程与活动，在教师、教学班、行政班视图中通用。状态底色、冲突提示继续保留。" : whole ? "按完整名称应用到同名课卡。状态标识、冲突提示继续保留。" : "同一学科或行政班的名称片段统一显示。整张课卡的背景、分工和状态文字保持各自设置。"}</p>
        {textField === "room" && !target.entry.room ? <p className="text-xs text-muted-foreground">此示例尚未安排场所；样式保存后会用于此对象已排地点的课卡。</p> : null}
        {overrideLabels.length ? <p className="text-xs leading-relaxed text-muted-foreground">此预览课卡已有独立设置：{overrideLabels.join("、")}，优先沿用。可在“整张课卡 → 课卡外观 / 对象名称”中恢复相应属性以使用教师样式。</p> : null}
        <Button variant="outline" size="sm" onClick={() => set(null)}>{editorPart === "CARD_SURFACE" ? "恢复课卡外观继承" : part === "CARD" ? "恢复此文字部位默认" : "恢复此对象继承"}</Button>
        <p className="text-xs text-muted-foreground">教务显示与教师个人显示分别保存。</p>
      </div>
      <div className="min-w-0 space-y-4">
        {notice ? <p role="status" className="text-sm">{notice}</p> : null}
        {drafts.pendingElsewhere ? <p role="status" className="text-sm text-destructive">其他部位有未保存的颜色输入，请返回检查并重试，或恢复该部位默认。</p> : null}
        <AppearanceEditorControls part={editorPart} own={own} effective={effective} controlKey={key} onSave={set} drafts={drafts.values} onDraftChange={drafts.change} />
      </div>
    </div>}
  </Modal>
}

export function CardObjectOptions({ options }: { options: { value: string; label: string; activity: boolean }[] }) {
  return <>{[false, true].map(activity => {
    const items = options.filter(option => option.activity === activity)
    return items.length ? <optgroup key={String(activity)} label={activity ? "活动" : "教学对象"}>{items.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup> : null
  })}</>
}

/** Teacher task scopes keep their existing keys; activities keep their full-name preferences. */
export function TeacherCardStyleEditor({ teacherId, entries }: { teacherId: string | null; entries?: ProjectedEntry[] }) {
  const mt = useMt()
  const currentTeacher = useTeacherId()
  const tt = useTimetable()
  const { persona } = useDemo()
  const { appearance } = useTimetableAppearance("teacher")
  const [level, setLevel] = useState<StyleLevel>("TASK")
  const [part, setPart] = useState<TeacherAppearancePart>("CARD_SURFACE")
  const [pick, setPick] = useState("")
  const [notice, setNotice] = useState("")
  const tasks = teacherId && teacherId === currentTeacher ? permittedTasks(mt.biz, teacherId) : []
  const weekEntries = entries ?? teacherWeekEntries(tt, persona, tt.weekStart).entries
  type Target = { id: string; label: string; task: STask; activity: false } | { id: string; label: string; entry: ProjectedEntry; activity: true }
  const targets = new Map<string, Target>()
  for (const task of tasks) {
    const id = level === "TASK" ? task.id : level === "CLASS" ? task.class_id : task.course_id
    const key = JSON.stringify(["teaching", id])
    if (!id || targets.has(key)) continue
    const duty = dutyOf(task)?.normative_label
    const label = level === "COURSE" ? courseOf(task)?.name ?? id : `${classOf(task).name}${level === "TASK" && duty ? ` · ${duty}` : ""}`
    targets.set(key, { id, label, task, activity: false })
  }
  for (const entry of weekEntries.filter(entry => entry.kind === "activity")) {
    const key = JSON.stringify(["activity", entry.className])
    if (!targets.has(key)) targets.set(key, { id: entry.className, label: entry.className, entry, activity: true })
  }
  const selection = targets.has(pick) ? pick : [...targets.keys()][0]
  const target = targets.get(selection)
  const savedPart = target?.activity ? cardPartForEntry(part, target.entry) : part
  const key = target?.activity ? appearanceKey(appearance.viewer, "teacher", savedPart, target.id) : `${teacherId}|${level}|${target?.id}|${part}`
  const drafts = useStyleDrafts(key, JSON.stringify([appearance.viewer, teacherId, level, selection]))
  if (!target) return <p className="py-6 text-sm text-muted-foreground">当前范围没有可设置的教学对象或活动。</p>
  const id = target.id
  const savePatch = (styles: Appearance["styles"], patch: AppearancePatch | null) => target.activity
    ? saveAppearancePatch(styles, appearance.viewer, "teacher", savedPart, id, patch)
    : saveTeacherAppearancePatch(styles, teacherId!, level, id, part, patch)
  const own = target.activity ? appearanceEditorPref(appearance, savedPart, id) : teacherEditorPref(mt.biz.styles ?? {}, teacherId!, level, id, part)
  const styles = Object.keys(drafts.patch).length ? savePatch(mt.biz.styles ?? {}, drafts.patch) : mt.biz.styles ?? {}
  const draft = { ...appearance, teacherId, styles }
  const actual = !target.activity ? weekEntries.find(e => e.taskId === target.task.id && e.kind !== "activity") : null
  const cls = !target.activity ? classOf(target.task) : null
  const entry: ProjectedEntry = target.activity ? target.entry : actual ?? { key: target.task.id, taskId: target.task.id, teacherId: persona, className: cls!.name, subject: cls!.subject, date: tt.weekStart, weekday: 1, periodId: "m1", room: null }
  const effective = target.activity ? appearanceEditorEffective(draft, savedPart, id, entry) : teacherEditorEffective(styles, teacherId, target.task, part)
  const base = target.activity ? resolveCardAppearance(draft, entry) : resolveStyle({ ...mt.biz, styles }, teacherId, target.task)
  const set = (patch: AppearancePatch | null) => {
    if (!mt.ready || mt.loadError) { setNotice("显示设置尚未加载，请重试。"); return false }
    const result = mt.command("我的课卡显示样式", state => ({ ...state, styles: savePatch(state.styles ?? {}, patch) }))
    setNotice(result.ok ? patch ? "已保存当前属性，其他设置保留。" : "已恢复当前部位默认。" : result.error)
    if (result.ok) drafts.saved(patch)
    return result.ok
  }
  const switchPart = (value: TeacherAppearancePart) => {
    const saved = Object.keys(drafts.patch).length ? set(drafts.patch) : true
    setPart(value)
    if (saved) setNotice("")
  }
  return <div className="mt-4 space-y-4" data-teacher-style-editor>
    {target.activity ? <p className="text-xs text-muted-foreground">按完整活动名称应用到同名活动，不使用任务、班级或课程范围。</p> : <div className="flex flex-wrap items-center gap-2" role="group" aria-label="样式范围">
      {(["TASK", "CLASS", "COURSE"] as const).map(value => <Button key={value} size="sm" variant={level === value ? "default" : "outline"} aria-pressed={level === value} onClick={() => { setLevel(value); setPick(""); setNotice(""); drafts.reset() }}>{LEVEL_LABEL[value]}</Button>)}
      <span className="text-xs text-muted-foreground">同一属性以最后成功保存为准</span>
    </div>}
    <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-4">
        <label className="block space-y-1 text-sm"><span>设置对象</span><select aria-label="教师样式对象" value={selection} className="h-9 w-full rounded-md border border-input bg-card px-2" onChange={e => { setPick(e.target.value); setNotice(""); drafts.reset() }}><CardObjectOptions options={[...targets].map(([value, item]) => ({ value, label: item.label, activity: item.activity }))} /></select></label>
        <div role="group" aria-label="课卡内容样式" className="flex flex-wrap gap-1.5">{(["CARD_SURFACE", "CARD_OBJECT_TEXT", "CARD_TEACHER_TEXT", "CARD_ROOM_TEXT"] as const).map(value => <Button key={value} size="xs" variant={part === value ? "default" : "outline"} aria-pressed={part === value} onClick={() => switchPart(value)}>{DISPLAY_PART_LABEL[value]}</Button>)}</div>
        <TimetableCardPreview entry={entry} appearance={draft} base={base} showTeacher previewing={drafts.pending} />
        <p className="text-xs leading-relaxed text-muted-foreground">{part === "CARD_SURFACE" ? "设置背景、边框和圆角；状态课卡仍保留原状态外观。" : part === "CARD_TEACHER_TEXT" ? "设置课卡中教师姓名的文字样式；本人课表仍不重复显示姓名。" : part === "CARD_ROOM_TEXT" ? "只改变已安排场所的文字样式，不修改地点。" : target.activity ? "设置完整活动名称的文字与局部底色，不拆分学科或行政班。" : "设置对象名称的文字与局部底色；学科和行政班片段保留各自设置。"}</p>
        <Button variant="outline" size="sm" onClick={() => set(null)}>恢复{part === "CARD_SURFACE" ? "课卡外观" : "此文字部位"}默认</Button>
        <p className="text-xs text-muted-foreground">{target.activity ? "仅改变本人同名活动的显示，原活动配色保留。" : `仅改变本人显示，保留原任务、班级与课程设置。当前范围影响 ${tasks.filter(t => level === "TASK" ? t.id === id : level === "CLASS" ? t.class_id === id : t.course_id === id).length} 个本人任务。`}</p>
      </div>
      <div className="min-w-0 space-y-4">
        {notice ? <p role="status" className="text-sm">{notice}</p> : null}
        {drafts.pendingElsewhere ? <p role="status" className="text-sm text-destructive">其他部位有未保存的颜色输入，请返回检查并重试，或恢复该部位默认。</p> : null}
        <AppearanceEditorControls part={part} own={own} effective={effective} controlKey={key} onSave={set} drafts={drafts.values} onDraftChange={drafts.change} />
      </div>
    </div>
  </div>
}


export function TimetableCardPreview({ entry, appearance, base, showTeacher, previewing = false }: {
  entry: ProjectedEntry; appearance: Appearance; base: ResolvedStyle; showTeacher: boolean; previewing?: boolean
}) {
  const task = personalAppearanceTask(appearance, entry)
  const surface = task && appearance.teacherId
    ? teacherSurfaceStyle(appearance.styles, appearance.teacherId, task) : cardSurfaceStyle(appearance, entry, base)
  return <div data-card-preview className="rounded-md border border-primary/20 bg-accent p-3" style={surface}>
    <p className="mb-2 text-xs text-muted-foreground">{previewing ? "候选预览（尚未保存）" : "常规课卡预览"}</p>
    <p className={cn("font-semibold", titleClass(base))} style={{ color: base.hex ?? undefined }}><StyledLessonTitle entry={entry} appearance={appearance} /></p>
    {showTeacher ? <p className="mt-1 text-xs"><StyledCardText entry={entry} appearance={appearance} field="teacher">{teacherById(entry.teacherId)?.name ?? entry.teacherId}</StyledCardText></p> : null}
    <p className="mt-2 text-xs">{entry.room ? <StyledCardText entry={entry} appearance={appearance} field="room">{entry.room}</StyledCardText> : <span className="text-muted-foreground">未安排场所</span>}</p>
  </div>
}

/** All three card text tabs use this same layout; surface-only controls stay together. */
export function AppearanceEditorControls({ part, own, effective, controlKey, onSave, drafts = {}, onDraftChange = () => {} }: {
  part: DisplayPart; own: AppearancePatch; effective: ResolvedStyle; controlKey: string
  onSave: (patch: AppearancePatch | null) => boolean; drafts?: StyleDrafts; onDraftChange?: (field: ColorField, raw: string) => void
}) {
  const surface = part === "CARD_SURFACE" || part === "ACTIVITY_SURFACE"
  const whole = surface || part === "TEACHER" || part === "ACTIVITY"
  const bgLabel = whole ? "课卡背景" : "文字底色"
  const swatch = "size-7 rounded-md border-2 border-transparent focus-visible:outline-2 focus-visible:outline-primary aria-pressed:ring-2 aria-pressed:ring-foreground"
  return <div className="space-y-4" data-appearance-controls={surface ? "surface" : "text"}>
    {!surface ? <>
      <fieldset><legend className="mb-2 text-xs text-muted-foreground">文字颜色</legend><div className="flex flex-wrap gap-2">
        <Button variant="outline" size="xs" onClick={() => onSave({ color: undefined })}>继承文字</Button>
        {STYLE_COLORS.map(c => <button type="button" key={c.id} aria-label={`文字${c.label}`} aria-pressed={own.color === c.id} title={c.label} onClick={() => onSave({ color: c.id })} className={swatch} style={{ backgroundColor: c.hex }} />)}
      </div></fieldset>
      <StyleColorInput key={`${controlKey}:color`} label="文字颜色" value={effective.hex ?? ""} onChange={color => onSave({ color })} draft={drafts.color} onDraftChange={raw => onDraftChange("color", raw)} />
    </> : null}
    <fieldset><legend className="mb-2 text-xs text-muted-foreground">{bgLabel}</legend><div className="flex flex-wrap gap-2">
      <Button variant="outline" size="xs" onClick={() => onSave({ bg: undefined })}>继承背景</Button>
      <Button variant="outline" size="xs" aria-pressed={own.bg === "AUTO"} onClick={() => onSave({ bg: "AUTO" })}>{surface ? "跟随对象名称颜色" : "跟随文字颜色"}</Button>
      {STYLE_BGS.map(bg => <button key={bg.id} type="button" aria-pressed={own.bg === bg.id} onClick={() => onSave({ bg: bg.id })} className="rounded-md border px-2 py-1 text-xs aria-pressed:ring-2 aria-pressed:ring-foreground" style={{ backgroundColor: bg.hex, borderColor: bg.border || undefined }}>{bg.label}</button>)}
    </div></fieldset>
    <StyleColorInput key={`${controlKey}:bg`} label={bgLabel} value={effective.bg?.hex === "transparent" ? "" : effective.bg?.hex ?? ""} onChange={bg => onSave({ bg })} draft={drafts.bg} onDraftChange={raw => onDraftChange("bg", raw)} />
    {own.bg === "AUTO" ? <p className="text-xs text-muted-foreground">当前底色跟随文字颜色自动配套；选择具体底色后，两者独立。</p> : null}
    {surface ? <>
      <fieldset><legend className="mb-2 text-xs text-muted-foreground">边框颜色</legend><div className="flex flex-wrap gap-2">
        <Button variant="outline" size="xs" onClick={() => onSave({ borderColor: undefined })}>继承边框</Button>
        {STYLE_COLORS.map(c => <button type="button" key={c.id} aria-label={`边框${c.label}`} title={c.label} aria-pressed={own.borderColor?.toLowerCase() === c.hex} className={swatch} style={{ backgroundColor: c.hex }} onClick={() => onSave({ borderColor: c.hex })} />)}
      </div></fieldset>
      <StyleColorInput key={`${controlKey}:border`} label="边框颜色" value={own.borderColor ?? ""} onChange={borderColor => onSave({ borderColor })} draft={drafts.borderColor} onDraftChange={raw => onDraftChange("borderColor", raw)} />
      <div className="flex flex-wrap gap-3">
        <label className="space-x-2 text-sm"><span>边框粗细</span><select aria-label="边框粗细" className="h-8 rounded border bg-card px-2" value={own.borderWidth ?? ""} onChange={e => onSave({ borderWidth: e.target.value === "" ? undefined : Number(e.target.value) as SurfacePref["borderWidth"] })}>
          <option value="">默认</option><option value="0">无边框</option><option value="1">细 · 1px</option><option value="2">中 · 2px</option><option value="3">粗 · 3px</option>
        </select></label>
        <label className="space-x-2 text-sm"><span>边框线型</span><select aria-label="边框线型" className="h-8 rounded border bg-card px-2" value={own.borderStyle ?? ""} onChange={e => onSave({ borderStyle: (e.target.value || undefined) as SurfacePref["borderStyle"] })}>
          <option value="">默认</option><option value="solid">实线</option><option value="dashed">虚线</option><option value="dotted">点线</option>
        </select></label>
        <label className="space-x-2 text-sm"><span>圆角</span><select aria-label="课卡圆角" className="h-8 rounded border bg-card px-2" value={own.radius ?? ""} onChange={e => onSave({ radius: e.target.value === "" ? undefined : Number(e.target.value) as SurfacePref["radius"] })}>
          <option value="">默认</option><option value="0">直角</option><option value="4">小 · 4px</option><option value="6">常规 · 6px</option><option value="10">中 · 10px</option><option value="14">大 · 14px</option>
        </select></label>
      </div>
    </> : <div className="flex flex-wrap gap-3">
      <label className="space-x-2 text-sm"><span>字重</span><select aria-label="细分字重" className="h-8 rounded border bg-card px-2" value={own.weight ?? ""} onChange={e => onSave({ weight: (e.target.value || undefined) as StyleWeight | undefined })}><option value="">继承</option>{Object.entries(WEIGHT_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
      <label className="space-x-2 text-sm"><span>字体</span><select aria-label="细分字体" className="h-8 rounded border bg-card px-2" value={own.font ?? ""} onChange={e => onSave({ font: (e.target.value || undefined) as StyleFont | undefined })}><option value="">继承</option>{Object.entries(FONT_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
    </div>}
  </div>
}
