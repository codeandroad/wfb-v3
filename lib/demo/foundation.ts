// 学校管理 · 基础资料（部门 / 职务 / 教室）— 合成演示数据（仅交互原型）
// 轻量维护对象：不是部门树、人事系统或教室预约系统。
// 部门 / 职务名称不产生任何系统角色或权限；教室是实际地点对象（名称 + 位置）。

export type FoundationStatus = "active" | "inactive"

export const FOUNDATION_STATUS_LABEL: Record<FoundationStatus, string> = {
  active: "启用",
  inactive: "停用",
}

/* ---------------- 部门 ---------------- */

export interface DepartmentItem {
  id: string
  name: string
  status: FoundationStatus
  order: number
  referencedBy: number // 被引用的人员数（停用优先，不做一键删除断链）
  note?: string
}

export const DEPARTMENT_ITEMS: DepartmentItem[] = [
  { id: "dep-math", name: "数学组", status: "active", order: 10, referencedBy: 3 },
  { id: "dep-phy", name: "物理组", status: "active", order: 20, referencedBy: 2 },
  { id: "dep-eng", name: "英语组", status: "active", order: 30, referencedBy: 1 },
  { id: "dep-affairs", name: "教务处", status: "active", order: 40, referencedBy: 2 },
  { id: "dep-admin", name: "行政部", status: "active", order: 50, referencedBy: 1 },
  {
    id: "dep-guide",
    name: "升学指导中心",
    status: "inactive",
    order: 60,
    referencedBy: 1,
    note: "已停用；仍被历史人员记录引用，编辑其原值时显示停用标识，不静默清空。",
  },
]

/* ---------------- 职务 ---------------- */

export interface JobTitleItem {
  id: string
  name: string
  status: FoundationStatus
  order: number
  referencedBy: number
  note?: string
}

export const JOB_TITLE_ITEMS: JobTitleItem[] = [
  { id: "job-teacher", name: "教师", status: "active", order: 10, referencedBy: 5 },
  { id: "job-lead", name: "教研组长", status: "active", order: 20, referencedBy: 1 },
  { id: "job-affairs-head", name: "教务处长", status: "active", order: 30, referencedBy: 1 },
  { id: "job-principal", name: "校长", status: "active", order: 40, referencedBy: 1 },
  { id: "job-guide", name: "升学导师", status: "active", order: 50, referencedBy: 1 },
  { id: "job-assistant", name: "行政助理", status: "active", order: 60, referencedBy: 1 },
]

/* ---------------- 教室 ---------------- */
// 教室是实际地点对象：名称 + 楼栋/位置说明 + 状态。
// 允许两栋楼各有一间“201”，选择时显示完整位置，不能只剩一个“201”。

export interface ClassroomItem {
  id: string
  name: string
  building: string // 楼栋 / 位置说明
  status: FoundationStatus
  order: number
  note?: string
}

export const CLASSROOM_ITEMS: ClassroomItem[] = [
  { id: "room-a201", name: "201", building: "教学楼A", status: "active", order: 10 },
  { id: "room-a202", name: "202", building: "教学楼A", status: "active", order: 20 },
  { id: "room-b201", name: "201", building: "实验楼B", status: "active", order: 30, note: "与教学楼A · 201 同名不同楼，属于不同地点对象。" },
  { id: "room-lib", name: "阅览研讨室", building: "图书馆三层", status: "active", order: 40 },
  {
    id: "room-old-gym",
    name: "旧体育馆",
    building: "校区西侧",
    status: "inactive",
    order: 50,
    note: "已停用；历史课表原文仍保留，不作为新记录候选。",
  },
]

// 教室完整展示：名称 + 位置，避免只剩“201”
export function classroomLabel(r: Pick<ClassroomItem, "name" | "building">): string {
  return `${r.building} · ${r.name}`
}

/* ---------------- 常用职务补充说明 ---------------- */
// 职务选择的三种含义：选常用 / 本条补充 / 新增为常用（仅有维护权者）
export const JOB_TITLE_MODES = [
  { key: "common", label: "选择常用职务", hint: "选用本校已维护的常用职务条目。" },
  { key: "custom", label: "其他，填写本次职务", hint: "仅补充本条人员记录的职务文字，不加入全校通用选项。" },
  { key: "new", label: "新增为常用职务", hint: "有维护权者可执行；需要明确确认，加入全校通用条目。" },
] as const

export type JobTitleMode = (typeof JOB_TITLE_MODES)[number]["key"]
