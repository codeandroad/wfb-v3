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
export const WEIGHT_LABEL: Record<StyleWeight, string> = { normal: "常规", semibold: "中粗", bold: "粗体" }
export const FONT_LABEL: Record<StyleFont, string> = { sans: "无衬线", serif: "衬线", mono: "等宽" }
export const LEVEL_LABEL: Record<StyleLevel, string> = { TASK: "本任务", CLASS: "本班级", COURSE: "本课程" }

export const styleKey = (teacherId: string, level: StyleLevel, id: string) => `${teacherId}|${level}|${id}`

export interface ResolvedStyle {
  hex: string | null
  colorLabel: string | null
  weight: StyleWeight | null
  font: StyleFont | null
  from: Partial<Record<keyof StylePref, StyleLevel>>
}

export function resolveStyle(biz: MtBiz, teacherId: string | null, task: STask): ResolvedStyle {
  const out: ResolvedStyle = { hex: null, colorLabel: null, weight: null, font: null, from: {} }
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
      if (c) {
        out.hex = c.hex
        out.colorLabel = c.label
        out.from.color = lvl
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
  return out
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
  if (p.color && STYLE_COLORS.some((c) => c.id === p.color)) out.color = p.color
  if (p.weight && p.weight in WEIGHT_LABEL) out.weight = p.weight
  if (p.font && p.font in FONT_LABEL) out.font = p.font
  return Object.keys(out).length ? out : null
}
