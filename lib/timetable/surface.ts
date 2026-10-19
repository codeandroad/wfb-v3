import type { CSSProperties } from "react"
import { cardStyle, normalizeHex, resolvePreference, saveStylePatch, STYLE_COLORS, type ResolvedStyle, type StylePref } from "../mt/styles"
import { appearanceKey, appearancePref, cardPartForEntry, resolveCardAppearance, type Appearance, type CardIdentity, type DisplayMode, type DisplayPart } from "./display"

export interface SurfacePref {
  borderColor?: string
  borderWidth?: 0 | 1 | 2 | 3
  borderStyle?: "solid" | "dashed" | "dotted"
  radius?: 0 | 4 | 6 | 10 | 14
}
export type AppearancePatch = StylePref & SurfacePref
const surfaceFields = ["borderColor", "borderWidth", "borderStyle", "radius"] as const

function cleanSurface(raw: SurfacePref): SurfacePref {
  const out: SurfacePref = {}
  const color = typeof raw.borderColor === "string" ? normalizeHex(raw.borderColor) ?? STYLE_COLORS.find(c => c.id === raw.borderColor)?.hex : null
  if (color) out.borderColor = color
  if ([0, 1, 2, 3].includes(raw.borderWidth as number)) out.borderWidth = raw.borderWidth
  if (["solid", "dashed", "dotted"].includes(raw.borderStyle ?? "")) out.borderStyle = raw.borderStyle
  if ([0, 4, 6, 10, 14].includes(raw.radius as number)) out.radius = raw.radius
  return out
}

/** Split editor concerns without migrating or reinterpreting existing CARD.bg preferences. */
export function appearanceEditorPref(appearance: Appearance, part: DisplayPart, id: string): AppearancePatch {
  const card = appearancePref(appearance, part.startsWith("ACTIVITY_") ? "ACTIVITY" : "CARD", id) ?? {}
  if (part === "CARD_SURFACE" || part === "ACTIVITY_SURFACE") return { bg: card.bg, ...cleanSurface((appearancePref(appearance, part, id) ?? {}) as SurfacePref) }
  if (part === "CARD_OBJECT_TEXT" || part === "ACTIVITY_OBJECT_TEXT") return { color: card.color, weight: card.weight, font: card.font, bg: appearancePref(appearance, part, id)?.bg }
  return appearancePref(appearance, part, id) ?? {}
}

/** Show the same effective colors as the card, including legacy AUTO backgrounds. */
export function appearanceEditorEffective(appearance: Appearance, part: DisplayPart, id: string, entry: CardIdentity): ResolvedStyle {
  const own = appearanceEditorPref(appearance, part, id)
  if (part === "CARD_SURFACE" || part === "ACTIVITY_SURFACE") return resolveCardAppearance(appearance, entry)
  if (part === "CARD_OBJECT_TEXT" || part === "ACTIVITY_OBJECT_TEXT") {
    const title = resolveCardAppearance(appearance, entry)
    return resolvePreference({ color: title.hex ?? undefined, weight: title.weight ?? undefined, font: title.font ?? undefined, bg: own.bg })
  }
  return resolvePreference(own)
}

export function saveAppearancePatch(all: Record<string, StylePref>, viewer: string, mode: DisplayMode, part: DisplayPart, id: string, patch: AppearancePatch | null): Record<string, StylePref> {
  const key = appearanceKey(viewer, mode, part, id)
  const cardKey = appearanceKey(viewer, mode, part.startsWith("ACTIVITY_") ? "ACTIVITY" : "CARD", id)
  if (part === "CARD_OBJECT_TEXT" || part === "ACTIVITY_OBJECT_TEXT") {
    const text: StylePref = {}
    for (const field of ["color", "font", "weight"] as const) {
      if (patch === null || Object.hasOwn(patch, field)) Object.assign(text, { [field]: patch?.[field] })
    }
    const next = Object.keys(text).length ? saveStylePatch(all, cardKey, text) : all
    return patch === null || Object.hasOwn(patch, "bg") ? saveStylePatch(next, key, { bg: patch?.bg }) : next
  }
  if (part === "CARD_SURFACE" || part === "ACTIVITY_SURFACE") {
    const next = patch === null || Object.hasOwn(patch, "bg") ? saveStylePatch(all, cardKey, { bg: patch?.bg }) : all
    const saved = { ...next[key] } as AppearancePatch
    const clean = cleanSurface(patch ?? {})
    for (const field of surfaceFields) {
      if (patch !== null && !Object.hasOwn(patch, field)) continue
      if (patch?.[field] !== undefined && clean[field] === undefined) continue
      if (clean[field] === undefined) delete saved[field]
      else Object.assign(saved, { [field]: clean[field] })
    }
    return { ...next, [key]: saved }
  }
  return saveStylePatch(all, key, patch)
}

/** Shared by normal cards and the settings preview; status cards keep their original surfaces. */
export function cardSurfaceStyle(appearance: Appearance | undefined, entry: CardIdentity, base: ResolvedStyle): CSSProperties | undefined {
  const style: CSSProperties = { ...cardStyle(base) }
  if (appearance && (appearance.mode === "admin" || entry.kind === "activity")) {
    const pref = cleanSurface((appearancePref(appearance, cardPartForEntry("CARD_SURFACE", entry), entry.className) ?? {}) as SurfacePref)
    if (pref.borderColor !== undefined) style.borderColor = pref.borderColor
    if (pref.borderWidth !== undefined) style.borderWidth = pref.borderWidth
    if (pref.borderStyle !== undefined) style.borderStyle = pref.borderStyle
    if (pref.radius !== undefined) style.borderRadius = pref.radius
  }
  return Object.keys(style).length ? style : undefined
}

export function objectTextBackground(appearance: Appearance | undefined, entry: CardIdentity): string | undefined {
  if (!appearance || (appearance.mode !== "admin" && entry.kind !== "activity")) return undefined
  const bg = appearancePref(appearance, cardPartForEntry("CARD_OBJECT_TEXT", entry), entry.className)?.bg
  if (!bg) return undefined
  const color = resolveCardAppearance(appearance, entry).hex ?? undefined
  return resolvePreference({ color, bg }).bg?.hex
}
