import type React from "react"
import type { STask } from "./model"
import type { MtBiz } from "./store"

/**
 * 个人显示样式：只影响当前教师自己的界面。
 * 不改变共享课程 / 班级 / 任务名称、排课版本、分工或任何业务数据。
 * 优先级：本任务 > 本班级 > 本课程 > 系统默认；颜色、字重、字体分别继承。
 */
export type StyleLevel = "TASK" | "CLASS" | "COURSE"
export type StyleWeight = "normal" | "semibold" | "bold"
export type StyleFont = "sans" | "serif" | "mono"
export interface StylePref {
  color?: string
  /** 分工标签色，取 STYLE_COLORS id */
  tag?: string
  /** 课卡背景：STYLE_BGS id；"NONE" 为明确无染色，与未设置（继承）不同 */
  bg?: string
  weight?: StyleWeight
  font?: StyleFont
}

/** 受控色板：每个色值都与卡片底色有足够对比，不允许任意十六进制 */
export const STYLE_COLORS: { id: string; label: string; hex: string }[] = [
  { id: "pine", label: "松绿", hex: "#2f6b4f" },
  { id: "ink", label: "墨蓝", hex: "#2d4f7c" },
  { id: "brick", label: "砖红", hex: "#a2422e" },
  { id: "ochre", label: "赭黄", hex: "#9a6a12" },
  { id: "plum", label: "梅紫", hex: "#6e3f6a" },
  { id: "slate", label: "石灰", hex: "#55606b" },
  { id: "teal", label: "青碧", hex: "#1f6f74" },
  { id: "olive", label: "橄榄", hex: "#5c6b23" },
]
/** 课卡背景：浅底，保证深色正文与状态文字可读 */
export const STYLE_BGS: { id: string; label: string; hex: string; border: string }[] = [
  { id: "NONE", label: "无染色", hex: "transparent", border: "" },
  { id: "mint", label: "薄荷", hex: "#e8f3ec", border: "#bcd9c6" },
  { id: "sky", label: "天青", hex: "#e7eff8", border: "#bccde2" },
  { id: "sand", label: "沙黄", hex: "#f8f0dc", border: "#e3d1a6" },
  { id: "rose", label: "浅绯", hex: "#f8e9e6", border: "#e6c3bc" },
  { id: "lilac", label: "浅紫", hex: "#f0eaf5", border: "#d5c6e0" },
  { id: "stone", label: "石灰", hex: "#eef0f2", border: "#cfd4d9" },
]
export const WEIGHT_LABEL: Record<StyleWeight, string> = { normal: "常规", semibold: "中粗", bold: "粗体" }
export const FONT_LABEL: Record<StyleFont, string> = { sans: "无衬线", serif: "衬线", mono: "等宽" }
export const LEVEL_LABEL: Record<StyleLevel, string> = { TASK: "本任务", CLASS: "本班级", COURSE: "本课程" }

export const styleKey = (teacherId: string, level: StyleLevel, id: string) => `${teacherId}|${level}|${id}`

export interface ResolvedStyle {
  hex: string | null
  colorLabel: string | null
  weight: StyleWeight | null
  font: StyleFont | null
  tagHex: string | null
  /** null＝继承到系统默认；"transparent"＝明确无染色 */
  bg: { hex: string; border: string; label: string } | null
  from: Partial<Record<keyof StylePref, StyleLevel>>
}

export function resolveStyle(biz: MtBiz, teacherId: string | null, task: STask): ResolvedStyle {
  const out: ResolvedStyle = { hex: null, colorLabel: null, weight: null, font: null, tagHex: null, bg: null, from: {} }
  if (!teacherId) return out
  const all = biz.styles ?? {}
  const chain: [StyleLevel, string][] = [
    ["TASK", task.id],
    ["CLASS", task.class_id],
    ["COURSE", task.course_id],
  ]
  for (const [lvl, id] of chain) {
    if (!id) continue
    const p = all[styleKey(teacherId, lvl, id)]
    if (!p) continue
    if (!out.from.color && p.color) {
      const c = STYLE_COLORS.find((x) => x.id === p.color)
      const hex = normalizeHex(p.color) ?? c?.hex
      if (hex) {
        out.hex = hex
        out.colorLabel = c?.label ?? hex
        out.from.color = lvl
      }
    }
    if (!out.from.bg && p.bg) {
      const b = STYLE_BGS.find((x) => x.id === p.bg)
      const hex = normalizeHex(p.bg)
      if (b || hex || p.bg === "AUTO") {
        out.bg = p.bg === "AUTO" ? { hex: "AUTO", border: "", label: "自动配套" } : b ? { ...b } : { hex: hex!, border: hex!, label: hex! }
        out.from.bg = lvl
      }
    }
    if (!out.from.weight && p.weight) {
      out.weight = p.weight
      out.from.weight = lvl
    }
    if (!out.from.font && p.font) {
      out.font = p.font
      out.from.font = lvl
    }
  }
  out.tagHex = out.hex
  if (out.bg?.hex === "AUTO") {
    const c = out.hex ?? "#55606b"
    const channels = [1, 3, 5].map(i => Math.round(parseInt(c.slice(i, i + 2), 16) * .12 + 255 * .88).toString(16).padStart(2, "0"))
    out.bg = { hex: `#${channels.join("")}`, border: `${c}55`, label: "自动配套" }
  }
  return out
}

export function normalizeHex(raw: string): string | null {
  const s = raw.trim()
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(s)) return `#${s.slice(1).split("").map(c => c + c).join("")}`.toUpperCase()
  return null
}

/** 标题文字类：只在有个人设置时覆盖，否则沿用调用方默认 */
export function titleClass(s: ResolvedStyle): string {
  return [
    s.weight === "normal" ? "font-normal" : s.weight === "semibold" ? "font-semibold" : s.weight === "bold" ? "font-bold" : "",
    s.font === "serif" ? "font-serif" : s.font === "mono" ? "font-mono" : s.font === "sans" ? "font-sans" : "",
  ]
    .filter(Boolean)
    .join(" ")
}

export function cleanStyle(p: StylePref): StylePref | null {
  const out: StylePref = {}
  if (p.color && (normalizeHex(p.color) || STYLE_COLORS.some((c) => c.id === p.color))) out.color = normalizeHex(p.color) ?? p.color
  if (p.bg && (p.bg === "AUTO" || normalizeHex(p.bg) || STYLE_BGS.some((c) => c.id === p.bg))) out.bg = normalizeHex(p.bg) ?? p.bg
  if (p.weight && p.weight in WEIGHT_LABEL) out.weight = p.weight
  if (p.font && p.font in FONT_LABEL) out.font = p.font
  return Object.keys(out).length ? out : null
}

/** 课卡容器样式：仅在有个人背景时覆盖；状态（锁定/草稿/冲突）调用方优先 */
export function cardStyle(s: ResolvedStyle): React.CSSProperties | undefined {
  if (!s.bg) return undefined
  if (s.bg.hex === "transparent") return { backgroundColor: "transparent" }
  return { backgroundColor: s.bg.hex, borderColor: s.bg.border }
}
export function tagStyle(s: ResolvedStyle): React.CSSProperties | undefined {
  return s.tagHex ? { color: s.tagHex, backgroundColor: `${s.tagHex}1a` } : undefined
}
