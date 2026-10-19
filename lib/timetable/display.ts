import registry from "../teaching/fixture.json"
import { ADMIN_CLASSES, TEACHING_CLASSES, finalMarker, teacherById, type ProjectedEntry } from "./data"
import { CLASSES, HOMEROOMS, TASKS, personalDisplay, prefKey } from "../mt/model"
import type { MtBiz } from "../mt/store"
import { resolvePreference, type StylePref } from "../mt/styles"

export type DisplayMode = "teacher" | "admin"
export type DisplayPart = "CARD" | "TEACHER" | "SUBJECT" | "HOMEROOM" | "ACTIVITY" | "CARD_TEACHER_TEXT" | "CARD_ROOM_TEXT" | "CARD_SURFACE" | "CARD_OBJECT_TEXT" | "ACTIVITY_SURFACE" | "ACTIVITY_OBJECT_TEXT" | "ACTIVITY_TEACHER_TEXT" | "ACTIVITY_ROOM_TEXT"
export const DISPLAY_PART_LABEL: Record<DisplayPart, string> = { CARD: "整张课卡", TEACHER: "按教师", SUBJECT: "学科文字", HOMEROOM: "行政班文字", ACTIVITY: "活动", CARD_TEACHER_TEXT: "教师姓名", CARD_ROOM_TEXT: "场所", CARD_SURFACE: "课卡外观", CARD_OBJECT_TEXT: "对象名称", ACTIVITY_SURFACE: "课卡外观", ACTIVITY_OBJECT_TEXT: "对象名称", ACTIVITY_TEACHER_TEXT: "教师姓名", ACTIVITY_ROOM_TEXT: "场所" }
export const appearanceKey = (viewer: string, mode: DisplayMode, part: DisplayPart, id: string) => `timetable-display|${viewer}|${mode}|${part}|${id}`
export type Appearance = { teacherId?: string | null; teachingTaskIds?: string[]; mode: DisplayMode; viewer: string; styles: Record<string, StylePref> }
export const appearancePref = (appearance: Appearance, part: DisplayPart, id: string) => appearance.styles[appearanceKey(appearance.viewer, appearance.mode, part, id)]

export type CardIdentity = Pick<ProjectedEntry, "className" | "subject"> & Partial<ProjectedEntry> & { searchText?: string }
export type CardTextField = "teacher" | "room"
export const cardTextPart = (field: CardTextField): DisplayPart => field === "teacher" ? "CARD_TEACHER_TEXT" : "CARD_ROOM_TEXT"
export const cardPartForEntry = (part: DisplayPart, entry: CardIdentity): DisplayPart => entry.kind === "activity" && part.startsWith("CARD_") ? part.replace("CARD_", "ACTIVITY_") as DisplayPart : part

/** Optional metadata text styling must not recolor the title, whole card or status indicators. */
export function resolveCardTextAppearance(appearance: Appearance | undefined, entry: CardIdentity, field: CardTextField) {
  return resolvePreference(appearance && (appearance.mode === "admin" || entry.kind === "activity") ? appearancePref(appearance, cardPartForEntry(cardTextPart(field), entry), entry.className) : undefined)
}

/** Admin teacher defaults fill only attributes that the specific card has not set. */
export function resolveCardAppearance(appearance: Appearance, entry: CardIdentity) {
  const teacher = appearance.mode === "admin" && entry.teacherId ? appearancePref(appearance, "TEACHER", entry.teacherId) : undefined
  const card = appearancePref(appearance, entry.kind === "activity" ? "ACTIVITY" : "CARD", entry.className)
  const merged: StylePref = {}
  for (const field of ["color", "bg", "weight", "font"] as const) {
    // A cleared value inherits; its save-order tombstone is not a concrete override here.
    Object.assign(merged, { [field]: card?.[field] ?? teacher?.[field] })
  }
  // Resolve AUTO backgrounds after merging so they follow the final text color.
  return resolvePreference(merged)
}

const normalizeName = (name: string) => name.replace(/[()（）\s]/g, "")

/** Only recognized composite names split. Preserve their exact visible text, spacing and separator. */
export function titleParts(entry: CardIdentity) {
  if (entry.kind === "activity") return null
  const match = entry.className.match(/^(.+?)(\s*[•·]\s*)([^•·]+)$/)
  if (!match || match[3].trim() !== entry.subject.trim()) return null
  const registered = registry.teachingClasses.find(c => c.name === entry.className)
  const scenarioClass = CLASSES.find(c => c.name === entry.className)
  const home = registered?.placementHomeroomId
    ? registry.homerooms.find(h => h.id === registered.placementHomeroomId)
    : scenarioClass ? HOMEROOMS.find(h => h.id === scenarioClass.scheduling_homeroom_id) : undefined
  const homeName = home?.name ?? ADMIN_CLASSES.find(h => normalizeName(h.name) === normalizeName(match[1]))?.name
  if (!registered && !scenarioClass && !homeName && !TEACHING_CLASSES.some(c => c.name === entry.className)) return null
  // A teaching group alias is not automatically its placement homeroom's name.
  const homeroomId = homeName && normalizeName(homeName) === normalizeName(match[1]) ? normalizeName(homeName) : null
  const subjectId = registered?.subjectId ?? registry.subjects.find(s => s.name === entry.subject)?.id ?? entry.subject
  return { classText: match[1], separator: match[2], subjectText: match[3], subjectId, homeroomId }
}

export interface CardFilters {
  kind: "all" | "class" | "activity"
  subject: string
  className: string
  activityName: string
  teacherId: string
  query: string
}
export const EMPTY_CARD_FILTERS: CardFilters = { kind: "all", subject: "", className: "", activityName: "", teacherId: "", query: "" }
export const hasCardFilters = (value: CardFilters) => value.kind !== "all" || !!(value.subject || value.className || value.activityName || value.teacherId || value.query.trim())
/** Type changes discard only incompatible object filters; teacher and keyword remain useful. */
export function changeCardFilterKind(value: CardFilters, kind: CardFilters["kind"]): CardFilters {
  return { ...value, kind, ...(kind === "activity" ? { subject: "", className: "" } : kind === "class" ? { activityName: "" } : {}) }
}
export function matchesCardFilters(entry: CardIdentity, value: CardFilters): boolean {
  const activity = entry.kind === "activity"
  if (value.kind !== "all" && (value.kind === "activity") !== activity) return false
  if (value.subject && entry.subject !== value.subject) return false
  if (value.className && (activity || entry.className !== value.className)) return false
  if (value.activityName && (!activity || entry.className !== value.activityName)) return false
  if (value.teacherId && entry.teacherId !== value.teacherId) return false
  const query = value.query.trim().toLocaleLowerCase()
  return !query || [entry.className, entry.subject, entry.group, entry.unitName, entry.searchText, entry.room, entry.teacherId && teacherById(entry.teacherId)?.name].filter(Boolean).join(" ").toLocaleLowerCase().includes(query)
}

/** Resolve visible labels once for both the card and its search index. */
export function cardDisplayLabels(entry: CardIdentity, canonical: boolean, teacherId: string | null, biz: Pick<MtBiz, "taskPrefs" | "lessonOverrides">, normative: string | null) {
  const ownTask = !canonical && entry.taskId && teacherId ? TASKS.find(t => t.id === entry.taskId && t.teacher_id === teacherId) : undefined
  const lessonCustom = !canonical && entry.displayMode === "CUSTOM" && !!entry.customLabel?.trim()
  const pref = ownTask && teacherId ? biz.taskPrefs[prefKey(teacherId, ownTask.id)] : undefined
  const taskCustom = !lessonCustom && !!pref?.enabled && !!pref.text.trim()
  const display = ownTask && teacherId ? personalDisplay(ownTask, teacherId, biz.taskPrefs, biz.lessonOverrides) : null
  return {
    ownTask,
    marker: taskCustom ? display?.division : finalMarker(entry, canonical, normative),
    customShown: lessonCustom || taskCustom,
    courseLabel: display?.course ?? null,
  }
}
