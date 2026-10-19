"use client"

import { useState } from "react"
import { normalizeHex } from "@/lib/mt/styles"
import type { AppearancePatch } from "@/lib/timetable/surface"

export type ColorField = "color" | "bg" | "borderColor"
export type StyleDrafts = Partial<Record<ColorField, string>>

export function draftPatch(drafts: StyleDrafts): AppearancePatch {
  const patch: AppearancePatch = {}
  for (const field of ["color", "bg", "borderColor"] as const) {
    const hex = drafts[field] === undefined ? null : normalizeHex(drafts[field])
    if (hex) patch[field] = hex
  }
  return patch
}

export function clearSavedDrafts(drafts: StyleDrafts, saved: AppearancePatch | null): StyleDrafts {
  if (saved === null) return {}
  return Object.fromEntries(Object.entries(drafts).filter(([field]) => !Object.hasOwn(saved, field)))
}

/** Retain unfinished inputs across one object's parts; never carry them into another object/viewer. */
export function useStyleDrafts(key: string, scopeKey = key) {
  const [state, setState] = useState<{ scopeKey: string; parts: Record<string, StyleDrafts> }>({ scopeKey, parts: {} })
  const parts = state.scopeKey === scopeKey ? state.parts : {}
  const values = parts[key] ?? {}
  if (state.scopeKey !== scopeKey) setState({ scopeKey, parts: {} })
  const update = (run: (current: StyleDrafts) => StyleDrafts) => setState(s => {
    const parts = s.scopeKey === scopeKey ? s.parts : {}
    return { scopeKey, parts: { ...parts, [key]: run(parts[key] ?? {}) } }
  })
  return {
    values,
    patch: draftPatch(values),
    pending: Object.keys(values).length > 0,
    pendingElsewhere: Object.entries(parts).some(([partKey, drafts]) => partKey !== key && Object.keys(drafts).length > 0),
    change: (field: ColorField, raw: string) => update(current => ({ ...current, [field]: raw })),
    saved: (patch: AppearancePatch | null) => update(current => clearSavedDrafts(current, patch)),
    reset: () => setState({ scopeKey, parts: {} }),
  }
}
