import type { ConfigId, ScenarioId } from "./data"

export type ModuleId = "teaching" | "data" | "identity" | "observe"

// 演示人物：驱动全局导航可见性与课表中心/我的课表两个入口。
export type Persona = "admin" | "lin" | "zhou" | "chen"

export interface PersonaCaps {
  label: string
  role: string // 顶栏身份行
  scenario: ScenarioId // 复用既有场景驱动非课表导航
  admin: boolean // 可见「课表中心」（教务治理）
  teacher: boolean // 可见「我的课表」（本人任课）
  landing: string // 选择该人物后进入的落地页
  teacherId?: string // 对应教师数据 id
  staffId: string // 当前登录账号关联的教职工档案（账号中心 / 教师主页的身份来源）
}

// 教务管理员=纯教务；林老师=兼任（教务+任课+班主任）；周/陈=纯任课教师。
export const PERSONAS: Record<Persona, PersonaCaps> = {
  admin: { label: "教务管理员", role: "教务管理员", scenario: "staff", admin: true, teacher: false, landing: "/timetable", staffId: "u-xu" },
  lin: { label: "示例林老师", role: "学校管理员 · 任课教师 · 班主任", scenario: "staff", admin: true, teacher: true, landing: "/timetable/my", teacherId: "lin", staffId: "u-lin" },
  zhou: { label: "示例周老师", role: "任课教师", scenario: "teacher", admin: false, teacher: true, landing: "/timetable/my", teacherId: "zhou", staffId: "u-zhou" },
  chen: { label: "示例陈老师", role: "任课教师", scenario: "teacher", admin: false, teacher: true, landing: "/timetable/my", teacherId: "chen", staffId: "u-chen" },
}

export interface NavItem {
  href: string
  label: string
  icon: string // lucide icon name key resolved in shell
  scenarios: ScenarioId[]
  module: ModuleId
  // 课表两个入口按人物能力显隐（教务治理 vs 本人任课），而非仅按场景。
  timetableRole?: "center" | "my"
}

export const NAV: NavItem[] = [
  { href: "/home", label: "系统主页", icon: "home", scenarios: ["teacher", "staff"], module: "identity" },
  { href: "/", label: "工作台", icon: "dashboard", scenarios: ["teacher", "staff"], module: "teaching" },
  { href: "/teaching", label: "我的教学", icon: "book", scenarios: ["teacher", "staff"], module: "teaching" },
  { href: "/homework", label: "作业管理", icon: "clipboardList", scenarios: ["teacher", "staff"], module: "teaching" },
  { href: "/timetable/my", label: "我的课表", icon: "myTimetable", scenarios: ["teacher", "staff"], module: "teaching", timetableRole: "my" },
  { href: "/homeroom", label: "我的主班", icon: "users", scenarios: ["staff"], module: "teaching" },
  { href: "/timetable", label: "课表中心", icon: "timetable", scenarios: ["staff"], module: "teaching", timetableRole: "center" },
  { href: "/catalog", label: "课程管理", icon: "library", scenarios: ["staff"], module: "identity" },
  { href: "/management", label: "教学管理", icon: "clipboard", scenarios: ["staff"], module: "teaching" },
  { href: "/school", label: "学校管理", icon: "building", scenarios: ["staff"], module: "identity" },
  { href: "/import", label: "数据导入", icon: "upload", scenarios: ["staff"], module: "data" },
]

// 导航可见性：课表两个入口按人物能力显隐，其余沿用场景。家长外壳不显示员工导航。
export function navVisible(item: NavItem, scenario: ScenarioId, persona: Persona): boolean {
  if (scenario === "parent") return false
  if (item.timetableRole === "center") return PERSONAS[persona].admin
  if (item.timetableRole === "my") return PERSONAS[persona].teacher
  return item.scenarios.includes(scenario)
}

// 配置 B（仅身份与权限）：DATA 与教学反馈模块未接入
export function moduleEnabled(module: ModuleId, config: ConfigId): boolean {
  if (config === "full") return true
  return module === "identity"
}

export function pageTitle(pathname: string): string {
  const map: Record<string, string> = {
    "/": "工作台",
    "/home": "系统主页",
    "/catalog": "课程管理",
    "/teaching": "我的教学",
    "/teaching/schedule": "我的课表",
    "/homework": "作业管理",
    "/observe": "我的听课",
    "/observe/record": "听课记录",
    "/observe/manage": "听课管理",
    "/feedback": "周反馈编辑",
    "/publish": "发布与反馈图片",
    "/homeroom": "我的主班",
    "/timetable": "课表中心",
    "/timetable/my": "我的课表",
    "/timetable/import": "导入课表",
    "/management": "教学管理",
    "/import": "数据导入",
    "/school": "学校管理",
    "/account": "账号中心",
    "/people": "教师主页",
  }
  if (map[pathname]) return map[pathname]
  const base = "/" + pathname.split("/")[1]
  return map[base] ?? "工作台"
}
