import type { AdminClass, HeadRole } from "@/lib/demo/school"
import { staffById } from "@/lib/demo/staff"
import { homeroomName, normativeLabel, personalDisplay, type STask } from "./model"
import type { MtBiz } from "./store"

/**
 * r5：任务标题与任务选择器共用的唯一显示解析。
 * 教学班名称 + 必要分工（自定义启用时只显示正文）+ 课程名（仅按“显示课程名称”设置）。
 * 仅在同一列表内显示文字重名时补最小规范分工以消歧；选择仍按稳定 ID。
 */
export function taskTitle(task: STask, teacherId: string, biz: MtBiz, siblings: STask[] = []): string {
  const base = rawTitle(task, teacherId, biz)
  const clash = siblings.some((s) => s.id !== task.id && rawTitle(s, teacherId, biz) === base)
  const norm = normativeLabel(task)
  const pd = personalDisplay(task, teacherId, biz.taskPrefs, biz.lessonOverrides)
  if (clash && norm && pd.division !== norm) return `${base}（${norm}）`
  return base
}

function rawTitle(task: STask, teacherId: string, biz: MtBiz): string {
  const pd = personalDisplay(task, teacherId, biz.taskPrefs, biz.lessonOverrides)
  return [pd.className, pd.division, pd.course].filter(Boolean).join(" · ")
}

export interface HeadView {
  staffId: string
  name: string
  role: HeadRole
}

/**
 * 行政班当前班主任团队：以行政班任命为准，再按教职工档案中对应职责的有效期过滤；
 * 历史（已结束或未生效）任命不计为当前。返回 null 表示行政班档案读取不到。
 */
export function homeroomHeads(hrId: string, adminClasses: AdminClass[], date: string): HeadView[] | null {
  const name = homeroomName(hrId)
  const ac = adminClasses.find((a) => a.name === name)
  if (!ac) return null
  return ac.heads
    .filter((h) => {
      const s = staffById(h.staffId)
      if (!s) return false
      const type = h.role === "主班主任" ? "head_primary" : "head_assistant"
      const duty = s.duties.find((d) => d.type === type && d.scopeLabel === name)
      if (!duty) return true
      return duty.status !== "ended" && duty.start <= date && (!duty.end || duty.end >= date)
    })
    .sort((a, b) => (a.role === b.role ? 0 : a.role === "主班主任" ? -1 : 1))
}

/** 只接受本应用内的白名单返回来源，不盲信任意 returnTo。 */
export type FromKey = "list" | "schedule" | "workbench" | "student" | "class"
export function parseFrom(raw: string | null): FromKey {
  return raw === "schedule" || raw === "workbench" || raw === "student" || raw === "class" ? raw : "list"
}

const SAFE_KEYS = ["week", "q", "status", "class", "task", "focus", "f", "sq", "tab", "student", "from", "back", "lesson"]
/** 净化一段查询串，只保留已知参数且值不含协议/路径。 */
export function safeQuery(raw: string | null, keys: string[] = SAFE_KEYS): string {
  const p = new URLSearchParams(raw ?? "")
  const o = new URLSearchParams()
  for (const k of keys) {
    const v = p.get(k)
    if (v && !/[:/\\]/.test(k === "back" ? "" : v)) o.set(k, v)
  }
  return o.toString()
}
