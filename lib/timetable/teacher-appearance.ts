import type { CSSProperties } from "react"
import type { STask } from "../mt/model"
import type { MtBiz } from "../mt/store"
import {
  cardStyle, normalizeHex, resolvePreference, resolveStyle, saveStylePatch, styleKey, STYLE_COLORS,
  type ResolvedStyle, type StyleAttribute, type StyleLevel, type StylePref,
} from "../mt/styles"
import type { AppearancePatch, SurfacePref } from "./surface"

export type TeacherAppearancePart = "CARD_SURFACE" | "CARD_OBJECT_TEXT" | "CARD_TEACHER_TEXT" | "CARD_ROOM_TEXT"
type SurfaceField = keyof SurfacePref
type Supplement = Omit<StylePref, "order"> & SurfacePref & { order?: Partial<Record<StyleAttribute | SurfaceField, number>> }
const surfaceFields = ["borderColor", "borderWidth", "borderStyle", "radius"] as const
const textFields = ["color", "bg", "font", "weight"] as const

/** Real teaching identity and legacy scope remain authoritative; staff-viewer preferences use another namespace. */
export const teacherPartKey = (teacherId: string, level: StyleLevel, id: string, part: TeacherAppearancePart) => `${styleKey(teacherId, level, id)}|${part}`

function scopeChain(teacherId: string, task: STask): [StyleLevel, string][] {
  return [["TASK", task.id], ["CLASS", task.class_id], ["COURSE", task.course_id]]
    .filter(([, id]) => !!id).map(([level, id]) => [level as StyleLevel, styleKey(teacherId, level as StyleLevel, id)])
}

function legacyStyle(styles: Record<string, StylePref>, teacherId: string | null, task: STask): ResolvedStyle {
  return resolveStyle({ styles } as MtBiz, teacherId, task)
}

/** Reuse the existing per-attribute precedence and reset tombstones for supplemental text. */
function partStyle(styles: Record<string, StylePref>, teacherId: string | null, task: STask, part: TeacherAppearancePart): ResolvedStyle {
  if (!teacherId) return resolvePreference()
  const mapped = Object.fromEntries(scopeChain(teacherId, task).map(([, key]) => [key, styles[`${key}|${part}`] ?? {}]))
  return legacyStyle(mapped, teacherId, task)
}

function winningField(styles: Record<string, StylePref>, teacherId: string | null, task: STask, part: TeacherAppearancePart, field: StyleAttribute | SurfaceField) {
  if (!teacherId) return undefined
  return scopeChain(teacherId, task)
    .map(([, key], index) => ({ pref: styles[`${key}|${part}`] as Supplement | undefined, index }))
    .filter(({ pref }) => pref && (pref[field] !== undefined || pref.order?.[field] !== undefined))
    .sort((a, b) => (b.pref!.order?.[field] ?? 0) - (a.pref!.order?.[field] ?? 0) || a.index - b.index)[0]?.pref?.[field]
}

function cleanSurface(raw: SurfacePref): SurfacePref {
  const out: SurfacePref = {}
  const color = typeof raw.borderColor === "string" ? normalizeHex(raw.borderColor) ?? STYLE_COLORS.find(c => c.id === raw.borderColor)?.hex : null
  if (color) out.borderColor = color
  if ([0, 1, 2, 3].includes(raw.borderWidth as number)) out.borderWidth = raw.borderWidth
  if (["solid", "dashed", "dotted"].includes(raw.borderStyle ?? "")) out.borderStyle = raw.borderStyle
  if ([0, 4, 6, 10, 14].includes(raw.radius as number)) out.radius = raw.radius
  return out
}

function selectedTextPatch(patch: AppearancePatch | null, fields: readonly StyleAttribute[]): StylePref {
  const out: StylePref = {}
  for (const field of fields) {
    if (patch !== null && !Object.hasOwn(patch, field)) continue
    const value = patch?.[field]
    if (value !== undefined && typeof value !== "string") continue
    if (field === "font" && value !== undefined && !["sans", "serif", "mono"].includes(value)) continue
    if (field === "weight" && value !== undefined && !["normal", "semibold", "bold"].includes(value)) continue
    Object.assign(out, { [field]: value })
  }
  return out
}

function writeTextFields(styles: Record<string, StylePref>, key: string, patch: AppearancePatch | null, fields: readonly StyleAttribute[]) {
  const selected = selectedTextPatch(patch, fields)
  return Object.keys(selected).length ? saveStylePatch(styles, key, selected) : styles
}

function writeSurfaceFields(styles: Record<string, StylePref>, key: string, patch: AppearancePatch | null): Record<string, StylePref> {
  const clean = cleanSurface(patch ?? {})
  const fields = surfaceFields.filter(field => (patch === null || Object.hasOwn(patch, field)) && (patch?.[field] === undefined || clean[field] !== undefined))
  if (!fields.length) return styles
  const sequence = Math.max(0, ...Object.values(styles).flatMap(pref => Object.values(pref.order ?? {}).filter(value => Number.isFinite(value)))) + 1
  const saved: Supplement = { ...styles[key], order: { ...styles[key]?.order } }
  for (const field of fields) {
    if (clean[field] === undefined) delete saved[field]
    else Object.assign(saved, { [field]: clean[field] })
    saved.order![field] = sequence
  }
  return { ...styles, [key]: saved }
}

export function teacherEditorPref(styles: Record<string, StylePref>, teacherId: string, level: StyleLevel, id: string, part: TeacherAppearancePart): AppearancePatch {
  const legacy = styles[styleKey(teacherId, level, id)] ?? {}
  const supplement = styles[teacherPartKey(teacherId, level, id, part)] ?? {}
  if (part === "CARD_SURFACE") return { bg: legacy.bg, ...cleanSurface(supplement as SurfacePref) }
  if (part === "CARD_OBJECT_TEXT") return { color: legacy.color, font: legacy.font, weight: legacy.weight, bg: supplement.bg }
  return supplement
}

export function saveTeacherAppearancePatch(styles: Record<string, StylePref>, teacherId: string, level: StyleLevel, id: string, part: TeacherAppearancePart, patch: AppearancePatch | null): Record<string, StylePref> {
  const legacyKey = styleKey(teacherId, level, id)
  const partKey = teacherPartKey(teacherId, level, id, part)
  if (part === "CARD_SURFACE") return writeSurfaceFields(writeTextFields(styles, legacyKey, patch, ["bg"]), partKey, patch)
  if (part === "CARD_OBJECT_TEXT") return writeTextFields(writeTextFields(styles, legacyKey, patch, ["color", "font", "weight"]), partKey, patch, ["bg"])
  return writeTextFields(styles, partKey, patch, textFields)
}

export function teacherEditorEffective(styles: Record<string, StylePref>, teacherId: string | null, task: STask, part: TeacherAppearancePart): ResolvedStyle {
  const legacy = legacyStyle(styles, teacherId, task)
  if (part === "CARD_SURFACE") return legacy
  if (part === "CARD_OBJECT_TEXT") {
    const bg = winningField(styles, teacherId, task, part, "bg") as string | undefined
    const resolved = resolvePreference({ color: legacy.hex ?? undefined, font: legacy.font ?? undefined, weight: legacy.weight ?? undefined, bg })
    const highlight = partStyle(styles, teacherId, task, part)
    const from = { ...legacy.from }
    delete from.bg
    if (highlight.from.bg) from.bg = highlight.from.bg
    return { ...legacy, bg: resolved.bg, from }
  }
  return partStyle(styles, teacherId, task, part)
}

export function teacherSurfaceStyle(styles: Record<string, StylePref>, teacherId: string | null, task: STask): CSSProperties | undefined {
  const css: CSSProperties = { ...cardStyle(legacyStyle(styles, teacherId, task)) }
  const raw: SurfacePref = {}
  for (const field of surfaceFields) Object.assign(raw, { [field]: winningField(styles, teacherId, task, "CARD_SURFACE", field) })
  const surface = cleanSurface(raw)
  if (surface.borderColor !== undefined) css.borderColor = surface.borderColor
  if (surface.borderWidth !== undefined) css.borderWidth = surface.borderWidth
  if (surface.borderStyle !== undefined) css.borderStyle = surface.borderStyle
  if (surface.radius !== undefined) css.borderRadius = surface.radius
  return Object.keys(css).length ? css : undefined
}

export function teacherObjectBackground(styles: Record<string, StylePref>, teacherId: string | null, task: STask): string | undefined {
  return teacherEditorEffective(styles, teacherId, task, "CARD_OBJECT_TEXT").bg?.hex
}

export function teacherCardTextStyle(styles: Record<string, StylePref>, teacherId: string | null, task: STask, field: "teacher" | "room"): ResolvedStyle {
  return partStyle(styles, teacherId, task, field === "teacher" ? "CARD_TEACHER_TEXT" : "CARD_ROOM_TEXT")
}
