// 教职工 · 具体职责 · 账号与权限 — 合成演示数据（仅交互原型，非生产初始化）
// 四层含义：系统角色（资格）→ 岗位（人事）→ 业务职责（工作类型）→ 负责范围（对象）。
// 每一项职责与其“负责范围”逐项配对；技术来源仅在高级依据中出现。

import { RESEARCH_GROUPS } from "@/lib/school/responsibility-scopes"

export const DEMO_TODAY = "2026-09-23"

/* ============================================================
 * 系统角色（四类，固定不变）
 * ========================================================== */

export type SystemRoleCode = "SCHOOL_ADMIN" | "SUBJECT_TEACHER" | "HOMEROOM_TEACHER" | "TEACHING_MANAGER"

export const SYSTEM_ROLES: SystemRoleCode[] = [
  "SCHOOL_ADMIN",
  "SUBJECT_TEACHER",
  "HOMEROOM_TEACHER",
  "TEACHING_MANAGER",
]

export const SYSTEM_ROLE_LABEL: Record<SystemRoleCode, string> = {
  SCHOOL_ADMIN: "学校管理员",
  SUBJECT_TEACHER: "任课教师",
  HOMEROOM_TEACHER: "班主任",
  TEACHING_MANAGER: "教务管理",
}

export const SYSTEM_ROLE_DESC: Record<SystemRoleCode, string> = {
  SCHOOL_ADMIN: "授权体系中的治理资格；据此可安排学校管理类职责。",
  SUBJECT_TEACHER: "任课资格；据此可安排主要任课、共同任课、代课、教学协作。",
  HOMEROOM_TEACHER: "班主任资格；据此可安排主班主任、辅助班主任。",
  TEACHING_MANAGER: "教务管理资格；本校统一使用“标准教务配置”，据此可安排课程资料/结构维护、教学班管理、代课管理与课表管理。",
}

/* ============================================================
 * 业务职责目录（受控，不可自由拼装）
 * ========================================================== */

export type DutyKey =
  | "school_admin"
  | "primary_teach"
  | "co_teach"
  | "substitute"
  | "teach_collab"
  | "head_primary"
  | "head_assistant"
  | "course_material"
  | "course_structure"
  | "teaching_class_mgmt"
  | "substitute_mgmt"
  | "timetable_mgmt"
  | "research_lead"
  | "research_participate"
  | "research_manage"
  | "research_view"

export interface DutyTypeDef {
  key: DutyKey
  label: string
  role: SystemRoleCode
  blurb: string
  scopeKind: string
  canDo: string[]
  cannotDo: string[]
  arrangeableBy: string
}

export const DUTY_TYPES: DutyTypeDef[] = [
  {
    key: "research_lead",
    label: "教研组长",
    role: "SUBJECT_TEACHER",
    blurb: "负责指定教研组的公共资料、教研安排与工作分工。",
    scopeKind: "具体教研组（同一任期每组最多一位组长，可暂缺）",
    canDo: ["维护本组公共大纲、教学计划、资源与评价依据", "维护本组教研课表、活动、通知与任务分工", "承接本组学校教研任务"],
    cannotDo: ["任命组长或教师", "管理其他教研组", "改写教师个人资料、私人草稿或教学记录"],
    arrangeableBy: "由学校有权人员通过安排职责办理；组长不因本职责取得人员任命权",
  },
  {
    key: "research_participate",
    label: "教研参与教师",
    role: "SUBJECT_TEACHER",
    blurb: "在指定教研组内使用获授权资料，参与活动并完成本人分工。",
    scopeKind: "具体教研组（可参与多个组，不从任课或部门自动推定）",
    canDo: ["查看并选用获授权的组内资料与评价依据", "维护本人教学资料与调整版，不改写公共原稿", "参与受邀活动、讨论反馈并提交本人负责的成果"],
    cannotDo: ["改写组内公共资料或其他教师个人内容", "维护本组教研课表、通知与人员分工", "任命人员或自动获取其他组资料"],
    arrangeableBy: "由学校有权人员通过安排职责办理",
  },
  {
    key: "research_manage",
    label: "学校教研统筹",
    role: "TEACHING_MANAGER",
    blurb: "在明确负责的教研组内协调学校任务与教研人员安排。",
    scopeKind: "明确获准统筹的教研组，不是全校或所有教学部门",
    canDo: ["向负责教研组下发学校任务、查看正式提交成果", "协调本范围的学校支持事项", "在负责范围内安排教研组长与参与教师职责"],
    cannotDo: ["改写组内公共资料或教师私人内容", "自动成为组长或参与教师", "转授统筹职责、扩大自己的负责范围"],
    arrangeableBy: "由学校管理员明确安排；不从教务资格、部门或组长身份自动取得",
  },
  {
    key: "research_view",
    label: "学校教研查看",
    role: "TEACHING_MANAGER",
    blurb: "在明确负责对象内查看教研概况与获准公开的工作成果。",
    scopeKind: "获准查看的具体教研组",
    canDo: ["查看负责教研组概况与正式提交成果", "读取对学校开放的资料"],
    cannotDo: ["安排人员、下发任务或验收成果", "编辑组内资料或加入组内协作", "查看受限答案、私人草稿与学生记录"],
    arrangeableBy: "由学校管理员明确安排",
  },
  {
    key: "school_admin",
    label: "学校管理",
    role: "SCHOOL_ADMIN",
    blurb: "在本校范围内管理已批准的行政事务。",
    scopeKind: "本校，及实际允许的业务项目（不等于全部操作）",
    canDo: ["管理教职工档案与任命", "开通 / 停用登录账号", "维护行政班与班主任团队"],
    cannotDo: ["编辑教师的反馈草稿", "读取教师私人工作稿", "修改全校学科 / 单元字典"],
    arrangeableBy: "由现任学校管理员安排",
  },
  {
    key: "primary_teach",
    label: "主要任课",
    role: "SUBJECT_TEACHER",
    blurb: "在实际教学班与单元内承担主要教学。",
    scopeKind: "实际教学班 / 单元，不是同名课程下全部班级",
    canDo: ["维护本单元的教学与周反馈", "查看本教学班学生名单"],
    cannotDo: ["管理同名课程下其他班级", "修改课程目录结构"],
    arrangeableBy: "由学校管理员或教务管理安排",
  },
  {
    key: "co_teach",
    label: "共同任课",
    role: "SUBJECT_TEACHER",
    blurb: "在同一教学目标内承担日常教学。",
    scopeKind: "同一教学班 / 单元内的日常教学职责",
    canDo: ["在同一目标内承担日常教学与反馈"],
    cannotDo: ["自动转授他人", "独占该班全部资料权"],
    arrangeableBy: "由学校管理员或教务管理安排",
  },
  {
    key: "substitute",
    label: "代课",
    role: "SUBJECT_TEACHER",
    blurb: "在明确课次或期间内临时承担教学。",
    scopeKind: "明确目标、课次或期间",
    canDo: ["在指定课次 / 期间承担教学"],
    cannotDo: ["自动接管前任全部资料", "超出指定期间继续"],
    arrangeableBy: "由学校管理员或教务管理安排",
  },
  {
    key: "teach_collab",
    label: "教学协作",
    role: "SUBJECT_TEACHER",
    blurb: "在选定资源内的有限协作。",
    scopeKind: "选定作业 / 课次 / 获准资源（有限范围）",
    canDo: ["在选定资源内协作（有限范围）"],
    cannotDo: ["读写该教师全部班级", "转授协作权限"],
    arrangeableBy: "由学校管理员或教务管理安排",
  },
  {
    key: "head_primary",
    label: "主班主任",
    role: "HOMEROOM_TEACHER",
    blurb: "对具体行政班承担主要班级管理责任。",
    scopeKind: "具体行政班（主岗最多一人，允许暂缺）",
    canDo: ["管理本班学生资料与名单", "处理本班学生请假记录"],
    cannotDo: ["创建或删除行政班", "管理其他行政班"],
    arrangeableBy: "由学校管理员安排",
  },
  {
    key: "head_assistant",
    label: "辅助班主任",
    role: "HOMEROOM_TEACHER",
    blurb: "协助管理具体行政班；本班日常管理与主班主任同权。",
    scopeKind: "具体行政班（可多人）",
    canDo: ["本班学生资料、名单与请假记录（与主班主任同权）"],
    cannotDo: ["创建或删除行政班", "管理其他行政班", "读取教师私人草稿"],
    arrangeableBy: "由学校管理员安排",
  },
  {
    key: "course_material",
    label: "课程资料维护",
    role: "TEACHING_MANAGER",
    blurb: "维护指定课程的校内说明与获准发布资源。",
    scopeKind: "指定课程的校内说明及获准发布资源",
    canDo: ["维护校内课程说明", "维护获准发布的资源"],
    cannotDo: ["课程启停", "官方课程代码 / 版本", "课程—单元结构", "全校学科 / 单元字典"],
    arrangeableBy: "由学校管理员或具授予权的教学管理安排",
  },
  {
    key: "course_structure",
    label: "课程结构维护",
    role: "TEACHING_MANAGER",
    blurb: "在指定课程内维护被批准的课程—单元结构。",
    scopeKind: "指定课程及被批准的结构动作",
    canDo: ["在指定课程内维护课程—单元结构"],
    cannotDo: ["修改被多课程共用的学科 / 单元字典", "课程启停或官方身份", "账号管理"],
    arrangeableBy: "由学校管理员或具授予权的教学管理安排",
  },
  {
    key: "teaching_class_mgmt",
    label: "教学班管理",
    role: "TEACHING_MANAGER",
    blurb: "管理被委派教学班的明确事项。",
    scopeKind: "被委派的实际教学班与明确事项",
    canDo: ["管理被委派教学班的指定事项"],
    cannotDo: ["读取教师私人工作稿", "扩展到整个年级或全部项目"],
    arrangeableBy: "由学校管理员安排",
  },
  {
    key: "substitute_mgmt",
    label: "代课管理",
    role: "TEACHING_MANAGER",
    blurb: "在已授范围内为获准教学目标安排符合资格的代课教师。",
    scopeKind: "已授教学目标；明确课次 / 期间与必要工作范围",
    canDo: [
      "为获准教学目标安排符合资格的代课教师",
      "指定课次 / 期间与必要工作范围",
      "在已授范围内直接办理，无需学校管理员逐次审批",
    ],
    cannotDo: [
      "授予管理员 / 教师资格",
      "永久替换主岗、任命班主任、办理离职",
      "读取前任私人稿件或完整个人课表",
      "账号换绑或全校学生主档管理",
    ],
    arrangeableBy: "由具备代课管理的教务人员直接办理（学校管理员亦可）",
  },
  {
    key: "timetable_mgmt",
    label: "课表管理",
    role: "TEACHING_MANAGER",
    blurb: "维护并发布本校学校课表，处理全校性的调课与停课安排�����",
    scopeKind: "本校学校课表（节次、课次安排、调课 / 停课）",
    canDo: [
      "维护学校课表的节次与课次安排",
      "导入课表并发布学校课表更新",
      "登记全校 / 年级停课与调课",
    ],
    cannotDo: [
      "修改教师本人课表中的个人调整",
      "维护学年学期与节假日日历",
      "安排代课（归“代课管理”）",
      "读取教师私人工作稿",
    ],
    arrangeableBy: "由学校管理员安排",
  },
]

export const DUTY_BY_KEY: Record<DutyKey, DutyTypeDef> = Object.fromEntries(
  DUTY_TYPES.map((d) => [d.key, d]),
) as Record<DutyKey, DutyTypeDef>

export const DUTIES_BY_ROLE: { role: SystemRoleCode; duties: DutyTypeDef[] }[] = SYSTEM_ROLES.map((role) => ({
  role,
  duties: DUTY_TYPES.filter((d) => d.role === role),
}))

/* ============================================================
 * 标准教务配置（本校统一）
 * 全体教务人员使用同一份获准配置；本轮不做逐人权限编辑器。
 * 逐项显示“职责 — 允许动作 — 具体范围 — 不包含”。
 * granted：本轮已获准、可用于授权预览的职责。
 * planned：仅规划说明、只读、本轮不授予（未明确批准不放开）。
 * ========================================================== */

export const STANDARD_TM_CONFIG_VERSION = "TEACHING_STD_V1"
export const STANDARD_TM_CONFIG_LABEL = "标准教务配置 · 本校统一"

export interface TmConfigItem {
  key: string
  duty: string // 职责名称
  actions: string[] // 允许动作
  scope: string // 具体范围（共同管理范围，可读，不只写“全校”）
  excludes: string[] // 不包含
}

// 已获准职责（本轮授权预览使用）
export const STANDARD_TM_GRANTED: TmConfigItem[] = [
  {
    key: "course_material",
    duty: "课程资料维护",
    actions: ["维护指定课程的校内说明", "维护获准发布的课程资源"],
    scope: "共同范围：CAIE数学、CAIE物理（本校两门示例课程）",
    excludes: ["课程启停", "官方课程代码 / 版本", "被多课程共用的学科 / 单元字典"],
  },
  {
    key: "course_structure",
    duty: "课程结构维护",
    actions: ["在指定课程内维护课程—单元结构"],
    scope: "共同范围：CAIE数学、CAIE物理课程内结构",
    excludes: ["修改全校学科 / 单元字典", "课程启停或官方身份", "账号管理"],
  },
  {
    key: "teaching_class_mgmt",
    duty: "教学班管理",
    actions: ["管理被委派教学班的名单 / 分组等获准事项"],
    scope: "共同范围：数学A班、数学B班、物理A班（实际教学班）",
    excludes: ["行政班容器的创建 / 删除", "读取教师私人工作稿", "扩展到整个年级"],
  },
  {
    key: "substitute_mgmt",
    duty: "代课管理",
    actions: ["为获准教学目标安排符合资格的代课教师", "指定课次 / 期间与必要工作范围", "在已授范围内直接办理，无需学校管理员逐次审批"],
    scope: "共同范围：本校已授教学目标（如 高一数学A班 → P1）",
    excludes: ["授予管理员 / 教师资格", "永久替换主岗", "读取前任私人稿件", "账号换绑或全校学生主档"],
  },
  {
    key: "timetable_mgmt",
    duty: "课表管理",
    actions: ["维护学校课表的节次与课次安排", "导入课表并发布学校课表更新（教师按需采用）", "登记全校 / 年级停课与调课"],
    scope: "共同范围：本校学校课表（当前学期，全部行政班与教学班）",
    excludes: ["修改教师本人课表中的个人调整", "维护学年学期与节假日日历", "安排代课（归“代课管理”）", "读取教师私人工作稿"],
  },
]

// 由统一配置生成职责记录：两位教务人员据此展开的职责与范围完全一致
export function STANDARD_TM_DUTIES(idPrefix: string): DutyRecord[] {
  return STANDARD_TM_GRANTED.map((c, i) => ({
    id: `${idPrefix}-${i + 1}`,
    type: c.key as DutyKey,
    scopeLabel: c.scope.replace(/^共同范围：/, ""),
    scopeSub: "标准教务配置",
    status: "active" as DutyStatus,
    workMode: "rw" as WorkMode,
    start: "2026-09-01",
    canDo: c.actions,
    cannotDo: c.excludes,
    basis: [{ role: "TEACHING_MANAGER" as SystemRoleCode, config: STANDARD_TM_CONFIG_VERSION, source: "标准教务配置", assignment: "本校统一" }],
  }))
}

// 规划职责（只读说明，本轮不授予、不列入可授予选择）
export const STANDARD_TM_PLANNED: { duty: string; note: string }[] = [
  { duty: "授课出勤核查", note: "仅职责说明；不含上下班考勤、在线时长、薪资或扣分。" },
  { duty: "学生事件登记", note: "仅范围解释；不顺带新增请假审批平台。" },
  { duty: "会议组织、教务公告", note: "两项分别说明对象与受众；本轮不开会议 / 公告事务页面。" },
  { duty: "听课协调、记录审阅", note: "两项独立能力；协调不等于反思全文读取，隐私边界不因统一配置放开。" },
]

// 使用标准教务配置的两位示例教务（应显示相同权限说明）
export const STANDARD_TM_STAFF_IDS = ["u-xu", "u-lu"] as const

/* ============================================================
 * P08 代课管理权限预览（教务可直接办理，非完整代课中心）
 * ========================================================== */

export interface SubstitutePreview {
  operator: string // 操作者示例
  operatorRole: string
  canDo: string[]
  method: string // 办理方式
  scopeExample: string // 范围示例
  replacementExample: string // 接替人员示例
  excludes: string[] // 不包含
}

export const SUBSTITUTE_PREVIEW: SubstitutePreview = {
  operator: "示例许老师",
  operatorRole: "仅教务管理 · 标准教务配置（本人无学校管理员、无本人任课角色）",
  canDo: [
    "为获准教学目标安排符合资格的代课教师",
    "明确课次 / 期间与必要工作范围",
  ],
  method: "在已授范围内直接安排，无需学校管理员逐次审批。",
  scopeExample: "高一数学A班 → P1；明确课次或期间（示例：第 6–8 周）。",
  replacementExample: "已有有效授课资格的示例陈老师。",
  excludes: [
    "任意授予管理员 / 教师资格",
    "永久主岗替换、班主任任命、离职办理",
    "读取前任私人稿件或完整个人课表",
    "账号换绑或全校学生档案管理",
  ],
}

// “接替教师资格不满足”的说明示例
export const SUBSTITUTE_UNQUALIFIED = {
  candidate: "示例孙老师（无对应授课资格）",
  reason: "所选接替教师缺少该教学目标所需的任课资格。",
  note: "不能为继续办理而“自动授予教师角色”；教务本人没有任课资格也不是本处的错误。资格授予属于另行的正式任命治理。",
}

/* ============================================================
 * P09 管理员有效期与最后管理员保护
 * 后台未实际计算；用固定场景表达三类结果。
 * ========================================================== */

export type AdminTenureKind = "indefinite" | "dated"

export interface AdminTenureScenario {
  id: string
  title: string
  summary: string
  // 当前操作对象管理员
  subject: { name: string; account: string; note: string }
  // 是否允许为该管理员设置结束日期
  allowSetEnd: boolean
  // 结论 / 拒绝原因
  outcome: string
  outcomeTone: "success" | "warning" | "danger"
  // 佐证：其他治理管理员的状态
  others: { name: string; state: string; ok: boolean }[]
}

export const ADMIN_TENURE_SCENARIOS: AdminTenureScenario[] = [
  {
    id: "sole",
    title: "唯一有效治理管理员",
    summary: "本校当前仅有一名有效、完整治理管理员。",
    subject: {
      name: "示例赵老师（school.admin）",
      account: "zhao.example",
      note: "当前唯一已激活、有效、完整治理管理员。",
    },
    allowSetEnd: false,
    outcome: "为避免学校失去管理能力，不能为其设置结束日期。“指定结束日期”已禁用。",
    outcomeTone: "danger",
    others: [
      { name: "base.admin（初始化治理）", state: "保留用于应急初始化，不计入日常完整治理接替", ok: false },
      { name: "待激活管理员", state: "邀请待接受，尚不能作为接替", ok: false },
    ],
  },
  {
    id: "has-peer",
    title: "另有长期有效治理管理员",
    summary: "存在另一名已激活、当前有效、完整治理且长期有效的管理员。",
    subject: {
      name: "示例赵老师（school.admin）",
      account: "zhao.example",
      note: "非最后一名管理员，允许显式设置期限。",
    },
    allowSetEnd: true,
    outcome: "允许为该管理员选择结束日期；另一名长期有效治理管理员仍保留，学校不会失去管理能力。",
    outcomeTone: "success",
    others: [
      { name: "peer.admin（示例钱管理）", state: "已激活 · 完整治理 · 长期有效", ok: true },
    ],
  },
  {
    id: "source-expires",
    title: "关键治理来源更早失效",
    summary: "顶部显示长期有效，但其依赖的关键治理来源将更早结束。",
    subject: {
      name: "示例赵老师（school.admin）",
      account: "zhao.example",
      note: "治理有效期受关键来源限制，不能顶部长期、底层却定期失效。",
    },
    allowSetEnd: false,
    outcome: "访问说明须提示“治理有效期受该项来源限制”；在补足长期来源前，不按“长期有效”对外呈现。",
    outcomeTone: "warning",
    others: [{ name: "关键治理来源", state: "将于 2026 学年末结束（早于所显示任期）", ok: false }],
  },
]

export const ADMIN_TENURE_DEFAULT_NOTE =
  "首位管理员与新建学校管理员默认“长期有效（未设结束日期）”。不从邀请码期限、学期、课程或配置发布日期推导管理员结束时间；不使用 9999 年这类伪日期表达永久。"

/* ============================================================
 * 状态词表（统一用语）
 * ========================================================== */

export type DutyStatus = "active" | "pending" | "paused" | "ended"
export const DUTY_STATUS_LABEL: Record<DutyStatus, string> = {
  active: "有效",
  pending: "未生效",
  paused: "暂停",
  ended: "已结束",
}
export const DUTY_STATUS_TONE: Record<DutyStatus, "success" | "info" | "warning" | "neutral"> = {
  active: "success",
  pending: "info",
  paused: "warning",
  ended: "neutral",
}

export type WorkMode = "rw" | "ro" | "paused"
export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  rw: "可读写",
  ro: "只读",
  paused: "已暂停",
}

export type StaffStatus = "active" | "leave" | "left"
export const STAFF_STATUS_LABEL: Record<StaffStatus, string> = {
  active: "在职",
  leave: "请假",
  left: "离职",
}
export const STAFF_STATUS_TONE: Record<StaffStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  leave: "warning",
  left: "neutral",
}

// 部门 / 职务属于人事信息，与系统角色、具体职责相互独立（无职称、职级、部门树）
export const DEPARTMENTS = ["校长室", "办公室", "教学部", "教务部", "学生部", "后勤部"] as const
export const JOB_TITLES = ["教师", "教务主任", "行政助理"] as const

export type AccountStatus = "none" | "pending" | "enabled" | "disabled" | "revoked"
export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  none: "未开通",
  pending: "待激活",
  enabled: "已启用",
  disabled: "已停用",
  revoked: "已注销",
}
export const ACCOUNT_STATUS_TONE: Record<AccountStatus, "success" | "warning" | "danger" | "neutral" | "info"> = {
  none: "neutral",
  pending: "info",
  enabled: "success",
  disabled: "warning",
  revoked: "danger",
}

/* ============================================================
 * 职责记录（一次实际任命 / 委派）
 * ========================================================== */

export interface DutyBasis {
  role: SystemRoleCode
  config: string // 配置版本（高级信息）
  source: string // 技术来源（高级信息）
  assignment: string // 实际任命对象
}

export interface DutyRecord {
  id: string
  type: DutyKey
  scopeLabel: string // 负责范围（可读名称）
  scopeSub?: string // 范围补充说明
  status: DutyStatus
  workMode: WorkMode
  start: string
  end?: string // 不填 = 未设结束日期
  canDo?: string[] // 覆盖默认“可以做”
  cannotDo?: string[] // 覆盖默认“不包含”
  note?: string
  basis: DutyBasis[] // 高级依据（默认折叠）；同一职责的多来源在此合并
  scopeRefs?: { kind: "research_group"; id: string }[]
  history?: HistoryItem[]
}

export function dutyCanDo(d: DutyRecord): string[] {
  return d.canDo ?? DUTY_BY_KEY[d.type].canDo
}
export function dutyCannotDo(d: DutyRecord): string[] {
  return d.cannotDo ?? DUTY_BY_KEY[d.type].cannotDo
}

/* ============================================================
 * 教职工档案
 * ========================================================== */

export interface HistoryItem {
  date: string
  text: string
}

export interface EducationExperience {
  id: string
  school?: string
  educationLevel?: string
  major?: string
  graduation?: string // YYYY 或 YYYY-MM，保留用户实际知道的精度
}

export interface WorkExperience {
  id: string
  organization?: string
  role?: string
  start?: string // YYYY 或 YYYY-MM
  end?: string // YYYY 或 YYYY-MM；空值不表示仍在职
}

export interface StaffProfile {
  id: string
  name: string
  employeeNo: string
  department: string
  jobTitle: string
  gender: "男" | "女" | "未透露"
  joinedAt?: string // 本校首次入职日期，YYYY-MM-DD；兼容历史 YYYY-MM
  phone: string
  email: string
  status: StaffStatus
  systemRoles: SystemRoleCode[]
  duties: DutyRecord[]
  username?: string
  accountStatus: AccountStatus
  isCurrent?: boolean
  qualificationNote?: string // 有资格但无实际职责时的说明
  statusNote?: string // 请假 / 离职对使用的影响
  history: HistoryItem[]
  // 更多资料（可选，个人补充）——按字段权限与个人显示设置展示，列表默认不展示
  englishName?: string
  birthMonth?: string
  birthplace?: string
  educationLevel?: string
  firstWorkAt?: string // 首次参加工作年月；不用于本校工号
  educationExperiences?: EducationExperience[]
  workExperiences?: WorkExperience[]
  wechat?: string
  interests?: string[]
  specialties?: string[] // 仅保留历史存储，不再在普通资料采集或展示
  }

export const STAFF: StaffProfile[] = [
  {
    id: "u-lin",
    name: "示例林老师",
    employeeNo: "TGS202109001E",
    department: "教学部",
    jobTitle: "教师",
    joinedAt: "2021-09-01",
    gender: "女",
    phone: "138****0006",
    email: "lin.example@demo.school",
    status: "active",
    isCurrent: true,
    username: "lin.example",
    accountStatus: "enabled",
    systemRoles: ["SUBJECT_TEACHER", "HOMEROOM_TEACHER", "TEACHING_MANAGER"],
    englishName: "Lynn",
    interests: ["阅读", "徒步"],
    specialties: ["活动组织"],
    history: [
      { date: "2021-09-01", text: "入职 · 数学教学岗" },
      { date: "2026-09-01", text: "学年任命更新：主要任课、主班主任、课程资料维护" },
    ],
    duties: [
      {
        id: "d-lin-1",
        type: "primary_teach",
        scopeLabel: "高一数学A班 → P1、S1",
        status: "active",
        workMode: "rw",
        start: "2026-09-01",
        canDo: ["维护 P1、S1 的教学与周反馈", "查看高一数学A班学生名单"],
        cannotDo: ["管理高一数学B班等其他班级", "修改 CAIE 数学目录结构"],
        basis: [
          { role: "SUBJECT_TEACHER", config: "SUBJECT_M1_V1", source: "学年初始化任命", assignment: "高一数学A班 · P1" },
          { role: "SUBJECT_TEACHER", config: "SUBJECT_M1_V1", source: "学年初始化任命", assignment: "高一数学A班 · S1" },
          { role: "SUBJECT_TEACHER", config: "TEACHING_ROSTER_READ_V1", source: "教学名单读取", assignment: "高一数学A班" },
        ],
      },
      {
        id: "d-lin-2",
        type: "head_primary",
        scopeLabel: "高一1班",
        status: "active",
        workMode: "rw",
        start: "2026-09-01",
        basis: [{ role: "HOMEROOM_TEACHER", config: "HOMEROOM_V1", source: "学年初始化任命", assignment: "高一1班" }],
      },
      {
        id: "d-lin-3",
        type: "course_material",
        scopeLabel: "CAIE 数学",
        scopeSub: "校内说明与获准发布资源",
        status: "active",
        workMode: "rw",
        start: "2026-09-01",
        basis: [{ role: "TEACHING_MANAGER", config: "COURSE_MATERIAL_V1", source: "教务管理授予", assignment: "CAIE 数学" }],
      },
      {
        id: "d-lin-4",
        type: "teach_collab",
        scopeLabel: "作业A · 批阅",
        scopeSub: "有限范围",
        status: "active",
        workMode: "ro",
        start: "2026-09-10",
        basis: [{ role: "SUBJECT_TEACHER", config: "TEACH_COLLAB_V1", source: "教学协作邀请", assignment: "作业A" }],
      },
    ],
  },
  {
    id: "u-wang",
    name: "示例王老师",
    employeeNo: "TGS202309001E",
    department: "教学部",
    jobTitle: "教师",
    joinedAt: "2023-09-01",
    gender: "男",
    phone: "138****0014",
    email: "wang.example@demo.school",
    status: "active",
    accountStatus: "none",
    systemRoles: ["HOMEROOM_TEACHER"],
    statusNote: "账号未开通：职责已登记，开通并激活账号后才可登录使用。",
    history: [
      { date: "2023-09-01", text: "入职 · 数学教学岗" },
      { date: "2026-09-23", text: "登记辅助班主任任命（账号未开通）" },
    ],
    duties: [
      {
        id: "d-wang-1",
        type: "head_assistant",
        scopeLabel: "高一2班",
        status: "active",
        workMode: "rw",
        start: "2026-09-01",
        note: "任命已登记；账号未开通，暂不能登录使用。",
        basis: [{ role: "HOMEROOM_TEACHER", config: "HOMEROOM_V1", source: "学校管理员登记", assignment: "高一2班" }],
      },
    ],
  },
  {
    id: "u-chen",
    name: "示例陈老师",
    employeeNo: "TGS201809001E",
    department: "教学部",
    jobTitle: "教师",
    joinedAt: "2018-09-01",
    gender: "男",
    phone: "138****0002",
    email: "chen.example@demo.school",
    status: "active",
    username: "chen.example",
    accountStatus: "enabled",
    systemRoles: ["SUBJECT_TEACHER"],
    qualificationNote: "已有任课教师资格，暂未安排任教。",
    history: [{ date: "2018-09-01", text: "入职 · 物理教学岗" }],
    duties: [],
  },
  {
    id: "u-zhou",
    name: "示例周老师",
    employeeNo: "TGS202209001E",
    department: "教学部",
    jobTitle: "教师",
    joinedAt: "2022-09-01",
    gender: "女",
    phone: "138****0021",
    email: "zhou.example@demo.school",
    status: "leave",
    username: "zhou.example",
    accountStatus: "enabled",
    systemRoles: ["SUBJECT_TEACHER", "TEACHING_MANAGER"],
    statusNote: "请假期间职责保留；返岗前部分日常操作按只读处理。",
    history: [
      { date: "2022-09-01", text: "入职 · 物理教学岗" },
      { date: "2026-09-15", text: "请假开始（职责保留）" },
    ],
    duties: [
      {
        id: "d-zhou-1",
        type: "primary_teach",
        scopeLabel: "高一物理A班",
        scopeSub: "整门课程（只读）",
        status: "active",
        workMode: "ro",
        start: "2026-09-01",
        canDo: ["查看高一物理A班教学与名单（只读）"],
        cannotDo: ["编辑教学内容（请假期间只读）", "管理其他物理班级"],
        note: "请假期间按只读处理。",
        basis: [{ role: "SUBJECT_TEACHER", config: "SUBJECT_M1_V1", source: "学年初始化任命", assignment: "高一物理A班" }],
      },
      {
        id: "d-zhou-2",
        type: "course_material",
        scopeLabel: "CAIE 物理",
        scopeSub: "校内说明与获准发布资源",
        status: "active",
        workMode: "rw",
        start: "2026-09-01",
        basis: [{ role: "TEACHING_MANAGER", config: "COURSE_MATERIAL_V1", source: "教务管理授予", assignment: "CAIE 物理" }],
      },
    ],
  },
  {
    id: "u-wu",
    name: "示例吴老师",
    employeeNo: "TGS202309002E",
    department: "教学部",
    jobTitle: "教师",
    joinedAt: "2023-09-01",
    gender: "女",
    phone: "138****0030",
    email: "wu.example@demo.school",
    status: "active",
    username: "wu.example",
    accountStatus: "enabled",
    systemRoles: ["SUBJECT_TEACHER"],
    englishName: "Wendy",
    history: [
      { date: "2023-09-01", text: "入职 · 综合教学岗" },
      { date: "2026-09-20", text: "登记代课任命（未生效，10 月起）" },
    ],
    duties: [
      {
        id: "d-wu-1",
        type: "substitute",
        scopeLabel: "高一物理A班",
        scopeSub: "代课 · 2026-10-01 起",
        status: "pending",
        workMode: "rw",
        start: "2026-10-01",
        end: "2026-10-31",
        canDo: ["2026-10-01 起在指定课次承担教学"],
        cannotDo: ["接管前任全部资料", "超出 10 月期间继续"],
        note: "后续职责示例：当前未生效，10-01 自动生效。",
        basis: [{ role: "SUBJECT_TEACHER", config: "SUBSTITUTE_V1", source: "代课任命登记", assignment: "高一物理A班" }],
      },
    ],
  },
  {
    id: "u-xu",
    name: "示例许老师",
    employeeNo: "TGS201909001E",
    department: "教务部",
    jobTitle: "教务主任",
    joinedAt: "2019-09-01",
    gender: "男",
    phone: "138****0042",
    email: "xu.example@demo.school",
    status: "active",
    username: "xu.example",
    accountStatus: "enabled",
    systemRoles: ["TEACHING_MANAGER"],
    qualificationNote: "教务管理统一使用“标准教务配置”，与另一位教务人员展开的职责与范围一致。",
    history: [
      { date: "2019-09-01", text: "入职 · 教务岗" },
      { date: "2026-09-01", text: "纳入标准教务配置（课程资料 / 结构、教学班管理、代课管理、课表管理）" },
    ],
    duties: STANDARD_TM_DUTIES("d-xu"),
  },
  {
    id: "u-lu",
    name: "示例陆老师",
    employeeNo: "TGS202009001E",
    department: "教务部",
    jobTitle: "教务员",
    joinedAt: "2020-09-01",
    gender: "女",
    phone: "138****0060",
    email: "lu.example@demo.school",
    status: "active",
    username: "lu.example",
    accountStatus: "enabled",
    systemRoles: ["TEACHING_MANAGER"],
    qualificationNote: "教务管理统一使用“标准教务配置”，与示例许老师展开的职责与范围一致。",
    history: [
      { date: "2020-09-01", text: "入职 · 教务岗" },
      { date: "2026-09-01", text: "纳入标准教务配置（与许老师同一份配置）" },
    ],
    duties: STANDARD_TM_DUTIES("d-lu"),
  },
  {
    id: "u-qian",
    name: "示例钱老师",
    employeeNo: "TGS201709001E",
    department: "教学部",
    jobTitle: "教师",
    joinedAt: "2017-09-01",
    gender: "男",
    phone: "138****0051",
    email: "qian.example@demo.school",
    status: "left",
    username: "qian.example",
    accountStatus: "disabled",
    systemRoles: [],
    qualificationNote: "已离职；当前无有效职责，历史任教见任职历史。",
    statusNote: "账号已停用；职责与历史记录保留，当前不可登录使用���",
    history: [
      { date: "2017-09-01", text: "入职 · 数学教学岗" },
      { date: "2024-09-01", text: "历史任教：高一数学（2024–2025 学年）" },
      { date: "2026-08-31", text: "离职，账号停用（历史保留）" },
    ],
    duties: [],
  },
  {
    id: "u-zhao",
    name: "示例赵老师",
    employeeNo: "TGS201509001E",
    department: "办公室",
    jobTitle: "行政助理",
    joinedAt: "2015-09-01",
    gender: "男",
    phone: "138****0001",
    email: "zhao.example@demo.school",
    status: "active",
    username: "zhao.example",
    accountStatus: "enabled",
    systemRoles: ["SCHOOL_ADMIN"],
    history: [
      { date: "2015-09-01", text: "入职 · 行政岗" },
      { date: "2026-09-01", text: "学校管理职责（教职工、账号、行政班）" },
    ],
    duties: [
      {
        id: "d-zhao-1",
        type: "school_admin",
        scopeLabel: "本校",
        scopeSub: "教职工、账号、行政班",
        status: "active",
        workMode: "rw",
        start: "2026-09-01",
        canDo: ["管理教职工档案与任命", "开通 / 停用登录账号", "维护行政班与班主任团队"],
        cannotDo: ["编辑教师反馈草稿", "读取教师私人工作稿", "修改全校学科 / 单元字典"],
        note: "示例仅列已选定管理项目，不代表“全部权限”。",
        basis: [{ role: "SCHOOL_ADMIN", config: "SCHOOL_ADMIN_V1", source: "学校授予", assignment: "本校" }],
      },
    ],
  },
  {
    id: "u-he",
    name: "示例何老师",
    employeeNo: "TGS202608001E",
    department: "教学部",
    jobTitle: "教师",
    joinedAt: "2026-08-20",
    gender: "女",
    phone: "138****0015",
    email: "he.example@demo.school",
    status: "active",
    username: "he.example",
    accountStatus: "enabled",
    systemRoles: ["SUBJECT_TEACHER"],
    qualificationNote: "新入职，已有任课教师资格，暂未安排任教。",
    history: [{ date: "2026-08-20", text: "入职 · 英语教学岗" }],
    duties: [],
  },
]

// 教职工档案 → 教学数据中的教师 id。未映射的真实教职工以 `S:<staffId>` 作为任教主体（不虚构账号或 teacher_id）。
export const STAFF_TEACHER_ID: Record<string, string> = {
  "u-lin": "T-LIN",
  "u-zhou": "T-ZHOU",
  "u-chen": "T-CHEN",
  "u-wu": "T-WU",
}
export function staffIdForTeacher(teacherId: string): string | undefined {
  if (teacherId.startsWith("S:")) return teacherId.slice(2)
  return Object.entries(STAFF_TEACHER_ID).find(([, t]) => t === teacherId)?.[0]
}

export function staffById(id: string): StaffProfile | undefined {
  return STAFF.find((s) => s.id === id)
}
export function activeDuties(s: StaffProfile): DutyRecord[] {
  return s.duties.filter((d) => d.status !== "ended")
}

/* ============================================================
 * 账号（另一种对象，独立于教职工档案）
 * 一行一个账号；不按技术来源重复。含未关联教职工的治理账号。
 * ========================================================== */

export interface SessionItem {
  id: string
  device: string
  location: string
  lastActive: string
  current?: boolean
}

// 访问来源类别：区分员工职责依赖来源、可信初始化治理、有限基础来源
export type AccessOrigin = "employee" | "initialization" | "basic" | "none"
export const ACCESS_ORIGIN_LABEL: Record<AccessOrigin, string> = {
  employee: "员工职责依赖来源",
  initialization: "可信初始化治理",
  basic: "有限基础来源",
  none: "尚无有效来源",
}

// 访问状态摘要（列表用），与账号状态分列
export type AccessTone = "success" | "info" | "neutral" | "warning"

// 访问说明：某一示例动作需要满足的条件与结论
export interface AccessCondition {
  label: string
  value: string
  ok: boolean
}
export interface AccessExplain {
  action: string
  scope: string
  conditions: AccessCondition[]
  conclusion: string
  conclusionOk: boolean
}

export interface AccountRecord {
  id: string
  username: string // "待设置登录名" 表示邀请未接受、登录名尚未设定
  loginNameSet: boolean
  staffId?: string // 关联教职工；缺省 = 未关联
  staffName?: string
  status: AccountStatus
  origin: AccessOrigin
  accessSummary: string // 访问状态一句话（列表列）
  accessTone: AccessTone
  systemRoles: SystemRoleCode[]
  lastLogin?: string // 缺省显示“未提供”，不做假精确
  note?: string
  history: HistoryItem[]
  sessions: SessionItem[]
  accessExplains?: AccessExplain[] // P09 访问说明
}

export const ACCOUNTS: AccountRecord[] = [
  {
    id: "acc-lin",
    username: "lin.example",
    loginNameSet: true,
    staffId: "u-lin",
    staffName: "示例林老师",
    status: "enabled",
    origin: "employee",
    accessSummary: "有可用事项",
    accessTone: "success",
    systemRoles: ["SUBJECT_TEACHER", "HOMEROOM_TEACHER", "TEACHING_MANAGER"],
    lastLogin: "2026-09-23 08:40",
    history: [
      { date: "2021-09-02", text: "账号激活" },
      { date: "2026-09-01", text: "职责更新：主要任课、主班主任、课程资料维护" },
    ],
    sessions: [
      { id: "S-1", device: "Chrome · macOS", location: "校内网络", lastActive: "2026-09-23 08:40", current: true },
      { id: "S-2", device: "Safari · iPad", location: "校内网络", lastActive: "2026-09-22 17:12" },
    ],
    accessExplains: [
      {
        action: "查看并录入 数学A班 · P1 单元成绩",
        scope: "教学班 数学A班 · 单元 P1",
        conditions: [
          { label: "员工资格", value: "任课教师资格 · 有效", ok: true },
          { label: "业务任命", value: "主要任课：数学A班 · P1", ok: true },
          { label: "账号关联", value: "已关联 示例林老师", ok: true },
          { label: "本校访问来源", value: "员工职责依赖来源 · 有效", ok: true },
          { label: "账号状态", value: "已启用", ok: true },
        ],
        conclusion: "五项条件同时满足 → 允许在该教学班该单元执行成绩事项",
        conclusionOk: true,
      },
    ],
  },
  {
    id: "acc-chen",
    username: "chen.example",
    loginNameSet: true,
    staffId: "u-chen",
    staffName: "示例陈老师",
    status: "enabled",
    origin: "employee",
    accessSummary: "无任教目标",
    accessTone: "neutral",
    systemRoles: ["SUBJECT_TEACHER"],
    lastLogin: "2026-09-22 15:03",
    note: "有任课教师资格，暂未安排任教。账号可登录，但没有可执行的任教事项。",
    history: [{ date: "2018-09-02", text: "账号激活" }],
    sessions: [{ id: "S-3", device: "Chrome · Windows", location: "校内网络", lastActive: "2026-09-22 15:03", current: true }],
    accessExplains: [
      {
        action: "查看任一教学班成绩",
        scope: "教学班��无具体对象）",
        conditions: [
          { label: "员工资格", value: "任课教师资格 · 有效", ok: true },
          { label: "业务任命", value: "无任课 / 代课任命", ok: false },
          { label: "账号关联", value: "已关联 示例陈老师", ok: true },
          { label: "本校访问来源", value: "员工职责依赖来源 · 有效", ok: true },
          { label: "账号状态", value: "已启用", ok: true },
        ],
        conclusion: "缺少业务任命（没有具体教学班 / 单元） → 有资格但无可执行目标",
        conclusionOk: false,
      },
    ],
  },
  {
    id: "acc-zhou",
    username: "zhou.example",
    loginNameSet: true,
    staffId: "u-zhou",
    staffName: "示例周老师",
    status: "enabled",
    origin: "employee",
    accessSummary: "请假中 · 只读",
    accessTone: "warning",
    systemRoles: ["SUBJECT_TEACHER", "TEACHING_MANAGER"],
    lastLogin: "2026-09-14 09:20",
    note: "关联人员请假中；账号在职，部分操作只读。",
    history: [
      { date: "2022-09-02", text: "账号激活" },
      { date: "2026-09-15", text: "关联人员请假开始" },
    ],
    sessions: [{ id: "S-4", device: "Chrome · macOS", location: "校内网络", lastActive: "2026-09-14 09:20", current: true }],
  },
  {
    id: "acc-wu",
    username: "wu.example",
    loginNameSet: true,
    staffId: "u-wu",
    staffName: "示例吴老师",
    status: "enabled",
    origin: "employee",
    accessSummary: "未来代课 · 待生效",
    accessTone: "info",
    systemRoles: ["SUBJECT_TEACHER"],
    lastLogin: "2026-09-21 11:30",
    note: "代课任命已排定示例期间，尚未到生效日期。",
    history: [{ date: "2023-09-02", text: "账号激活" }],
    sessions: [{ id: "S-5", device: "Chrome · Windows", location: "校内网络", lastActive: "2026-09-21 11:30", current: true }],
  },
  {
    id: "acc-xu",
    username: "xu.example",
    loginNameSet: true,
    staffId: "u-xu",
    staffName: "示例许老师",
    status: "enabled",
    origin: "employee",
    accessSummary: "有可用事项",
    accessTone: "success",
    systemRoles: ["TEACHING_MANAGER"],
    lastLogin: "2026-09-23 07:55",
    note: "教务主任为部门 / 职务；其可执行范围来自“课程资料 / 结构维护”职责，而非职务本身。",
    history: [{ date: "2019-09-02", text: "账号激活" }],
    sessions: [{ id: "S-6", device: "Chrome · Windows", location: "校内网络", lastActive: "2026-09-23 07:55", current: true }],
  },
  {
    id: "acc-wang-pending",
    username: "待设置登录名",
    loginNameSet: false,
    staffId: undefined,
    staffName: "已选 示例王老师",
    status: "pending",
    origin: "none",
    accessSummary: "等待接受邀请",
    accessTone: "warning",
    systemRoles: [],
    // lastLogin 缺省 → 显示“未提供”
    note: "邀请已选定王老师，登录名待其接受后设定。此为流程后独立场景，与教职工列表中王老师“未开通账号”场景不自动联动。",
    history: [
      { date: "2026-09-20", text: "发起邀请（已选王老师，无审批）" },
      { date: "2026-09-20", text: "等待受邀人接受并设置登录名" },
    ],
    sessions: [],
  },
  {
    id: "acc-newteacher",
    username: "new.teacher",
    loginNameSet: true,
    staffId: undefined,
    staffName: undefined,
    status: "enabled",
    origin: "basic",
    accessSummary: "基础来源有效 · 无任教目标",
    accessTone: "neutral",
    systemRoles: ["SUBJECT_TEACHER"],
    lastLogin: "2026-09-19 10:05",
    note: "未关联教职工档案的基础教师账号：本校访问来源为“有限基础来源”，可登录，但没有任何具体教学班 / 单元任命，因此没有可执行的任教目标。",
    history: [{ date: "2026-09-10", text: "基础教师账号创建（未关联档案）" }],
    sessions: [{ id: "S-8", device: "Chrome · Windows", location: "校内网络", lastActive: "2026-09-19 10:05", current: true }],
    accessExplains: [
      {
        action: "查看任一教学班成绩",
        scope: "教学班（无具体对象）",
        conditions: [
          { label: "员工资格", value: "未关联档案 · 以账号基础资格计", ok: true },
          { label: "业务任命", value: "无任课 / 代课任命", ok: false },
          { label: "账号关联", value: "未关联教职工", ok: false },
          { label: "本校访问来源", value: "有限基础来源 · 有效", ok: true },
          { label: "账号状态", value: "已启用", ok: true },
        ],
        conclusion: "基础来源有效但缺少业务任命与档案关联 → 可登录，无任教目标",
        conclusionOk: false,
      },
    ],
  },
  {
    id: "acc-qian",
    username: "qian.example",
    loginNameSet: true,
    staffId: "u-qian",
    staffName: "示例钱老师",
    status: "disabled",
    origin: "none",
    accessSummary: "登录已停用",
    accessTone: "neutral",
    systemRoles: [],
    lastLogin: "2026-08-30 16:40",
    note: "关联人员离职；账号已停用，历史保留。停用后即便曾有职责也一律不可执行。",
    history: [
      { date: "2017-09-02", text: "账号激活" },
      { date: "2026-08-31", text: "账号停用（离职）" },
    ],
    sessions: [],
  },
  {
    id: "acc-zhao",
    username: "zhao.example",
    loginNameSet: true,
    staffId: "u-zhao",
    staffName: "示例赵老师",
    status: "enabled",
    origin: "employee",
    accessSummary: "有可用事项",
    accessTone: "success",
    systemRoles: ["SCHOOL_ADMIN"],
    lastLogin: "2026-09-23 09:10",
    note: "行政部 / 行政助理为部门 / 职务；学校管理来自单独授予的“学校管理”职责，职务本身不自动等于学校管理员。",
    history: [{ date: "2015-09-02", text: "账号激活" }],
    sessions: [{ id: "S-7", device: "Chrome · Windows", location: "校内网络", lastActive: "2026-09-23 09:10", current: true }],
  },
  {
    id: "acc-lu",
    username: "lu.example",
    loginNameSet: true,
    staffId: "u-lu",
    staffName: "示例陆老师",
    status: "enabled",
    origin: "employee",
    accessSummary: "有可用事项",
    accessTone: "success",
    systemRoles: ["TEACHING_MANAGER"],
    lastLogin: "2026-09-23 07:58",
    note: "教务管理统一使用“标准教务配置”，可执行范围与示例许老师一致，均来自该配置而非职务本身。",
    history: [{ date: "2020-09-02", text: "账号激活" }],
    sessions: [{ id: "S-9", device: "Chrome · Windows", location: "校内网络", lastActive: "2026-09-23 07:58", current: true }],
  },
  {
    id: "acc-baseadmin",
    username: "base.admin",
    loginNameSet: true,
    staffId: undefined,
    staffName: undefined,
    status: "enabled",
    origin: "initialization",
    accessSummary: "初始化治理",
    accessTone: "info",
    systemRoles: ["SCHOOL_ADMIN"],
    lastLogin: "2026-09-01 06:00",
    note: "可信初始化治理账号，未关联教职工档案；保留用于系统初始化与应急治理，不作为员工显示。",
    history: [{ date: "2025-08-01", text: "系统初始化账号创建" }],
    sessions: [],
  },
  {
    id: "acc-accountonly",
    username: "account.only",
    loginNameSet: true,
    staffId: undefined,
    staffName: undefined,
    status: "enabled",
    origin: "basic",
    accessSummary: "仅账号自助 · 无业务",
    accessTone: "neutral",
    systemRoles: [],
    lastLogin: "2026-09-18 20:12",
    note: "四个系统角色皆空、且以账号自助��唯一来源的示例：可���录并管理自身账号，但没有任何业务能力（不任课、不带班、不治理、不教务）。",
    history: [{ date: "2026-09-05", text: "账号创建（仅自助，无业务角色）" }],
    sessions: [{ id: "S-10", device: "Safari · iPhone", location: "校外网络", lastActive: "2026-09-18 20:12", current: true }],
    accessExplains: [
      {
        action: "查看任一���务对象（任课 / 带班 / 治理 / 教务）",
        scope: "无任何业务对象",
        conditions: [
          { label: "系统角色", value: "四类角色均未持有", ok: false },
          { label: "业务任命", value: "无任何任命", ok: false },
          { label: "账号自助", value: "���管理自身账号信息", ok: true },
          { label: "账号状态", value: "已启用", ok: true },
        ],
        conclusion: "账号可用于自助，但四角色均为空 → 无任何业务能力",
        conclusionOk: false,
      },
    ],
  },
]

export function accountByStaffId(staffId: string): AccountRecord | undefined {
  return ACCOUNTS.find((a) => a.staffId === staffId)
}
export function accountById(id: string): AccountRecord | undefined {
  return ACCOUNTS.find((a) => a.id === id)
}

/* ============================================================
 * 具体职责筛选项（用于列表工具栏）
 * ========================================================== */

export const DUTY_FILTERS: { value: DutyKey | "all"; label: string }[] = [
  { value: "all", label: "全部职责" },
  ...DUTY_TYPES.map((d) => ({ value: d.key, label: d.label })),
]

/* ============================================================
 * 职责对象候选（P05 对象选择）
 * 对象只能从既有结构中“搜索选择”，界面内不新建班级 / 课程 / 单元。
 * 候选带父级路径以消歧（如 数学A班·P1 与 数学B班·P1）。
 * disabled 表示不可选（归档 / 权限不足 / 主岗冲突），仍展示但不可点。
 * ========================================================== */

export interface ScopeCandidate {
  id: string
  label: string // 主名（如“数学A班 · P1”）
  parentPath: string // 父级路径（用于消歧）
  meta?: string // 补充信息
  disabled?: boolean
  disabledReason?: string
}

export interface ScopeConfig {
  // fixed：对象固定、只读、无需输入（学校管理）
  mode: "search" | "fixed"
  multi: boolean // 是否允许多选（如任课可多单元）
  objectNoun: string // 对象名词（“教学班 / 单元”“行政班”“课程”…）
  searchPlaceholder: string
  emptyHint: string
  items: ScopeCandidate[]
  fixedNote?: string // fixed 模式说明
}

export function researchScopeConfig(items = RESEARCH_GROUPS): ScopeConfig {
  return {
    mode: "search",
    multi: true,
    objectNoun: "教研组",
    searchPlaceholder: "搜索教研组（如 数学、英语）",
    emptyHint: "请选择已有教研组；每个负责对象分别保留任期",
    items: items.map(group => ({
      id: group.id,
      label: group.name,
      parentPath: "教研负责对象",
      meta: `归口 ${group.department} · 非二级部门`,
      disabled: !group.active,
      disabledReason: group.active ? undefined : "负责对象已停用，历史记录仍保留",
    })),
  }
}

export const SCOPE_CANDIDATES: Record<DutyKey, ScopeConfig> = {
  research_lead: researchScopeConfig(),
  research_participate: researchScopeConfig(),
  research_manage: researchScopeConfig(),
  research_view: researchScopeConfig(),
  head_primary: {
    mode: "search",
    multi: false,
    objectNoun: "行政班",
    searchPlaceholder: "搜索行政班（如 高一1班）",
    emptyHint: "先搜索并选择一个行政班",
    items: [
      { id: "ac-g1c1", label: "高一1班", parentPath: "高一年级", meta: "主班主任在岗", disabled: true, disabledReason: "主岗已占用（每班最多一人）" },
      { id: "ac-g1c2", label: "高一2班", parentPath: "高一年级", meta: "主岗暂缺" },
      { id: "ac-g1c3", label: "高一3班", parentPath: "高一年级", meta: "主岗暂缺" },
      { id: "ac-g2c1", label: "高二1班", parentPath: "高二年级", meta: "主岗暂缺" },
    ],
  },
  head_assistant: {
    mode: "search",
    multi: true,
    objectNoun: "行政班",
    searchPlaceholder: "搜索行政班（如 高一2班）",
    emptyHint: "先搜索并选择行政班（可多个）",
    items: [
      { id: "ac-g1c1", label: "高一1班", parentPath: "高一年级" },
      { id: "ac-g1c2", label: "高一2班", parentPath: "高一年级" },
      { id: "ac-g1c3", label: "高一3班", parentPath: "高一年级" },
      { id: "ac-g2c1", label: "高二1班", parentPath: "高二年级" },
    ],
  },
  primary_teach: {
    mode: "search",
    multi: true,
    objectNoun: "教学班与单元",
    searchPlaceholder: "搜索教学班 · 单元（如 数学A班 P1）",
    emptyHint: "先搜索并选择“教学班 · 单元”，可多选",
    items: [
      { id: "tc-mathA-p1", label: "���学A班 · P1", parentPath: "CAIE数学 / 数学A班", meta: "纯数学 Pure 1" },
      { id: "tc-mathA-s1", label: "数学A班 · S1", parentPath: "CAIE数学 / 数学A班", meta: "统计 Statistics 1" },
      { id: "tc-mathB-p1", label: "数学B班 · P1", parentPath: "CAIE数学 / 数学B班", meta: "与数学A班 P1 同名不同班，注意区分" },
      { id: "tc-phyA-full", label: "物理A班 · 整门课程", parentPath: "CAIE物理 / 物理A班", meta: "选整门课程，不预设默认单元" },
      { id: "tc-mathC-p1", label: "数学C班 · P1", parentPath: "CAIE数学 / 数学C班（已归档）", meta: "上学期班级", disabled: true, disabledReason: "该教学班已归档，不可再安排" },
    ],
  },
  co_teach: {
    mode: "search",
    multi: true,
    objectNoun: "教学班与单元",
    searchPlaceholder: "搜索教学班 · 单元（如 数学A班 S1）",
    emptyHint: "先搜索并选择“教学班 · 单元”，可多选",
    items: [
      { id: "tc-mathA-p1", label: "数学A班 · P1", parentPath: "CAIE数学 / 数学A班", meta: "纯数学 Pure 1" },
      { id: "tc-mathA-s1", label: "数学A班 · S1", parentPath: "CAIE数学 / 数学A班", meta: "统计 Statistics 1" },
      { id: "tc-mathB-p1", label: "数学B班 · P1", parentPath: "CAIE数学 / 数学B班" },
      { id: "tc-phyA-full", label: "物理A班 · 整门课程", parentPath: "CAIE物理 / 物理A班" },
    ],
  },
  substitute: {
    mode: "search",
    multi: false,
    objectNoun: "实际目标",
    searchPlaceholder: "搜索代课目标（如 数学A班 P1）",
    emptyHint: "先搜索并选择代课的实际目标（示例期间 / 课次在下一步填写）",
    items: [
      { id: "tc-mathA-p1", label: "数学A班 · P1", parentPath: "CAIE数学 / 数学A班", meta: "示例期间：第 6–8 周" },
      { id: "tc-mathB-p1", label: "数学B班 · P1", parentPath: "CAIE数学 / 数学B班", meta: "示例课次：周三第 3 节" },
      { id: "tc-phyA-full", label: "物理A班 · 整门课程", parentPath: "CAIE物理 / 物理A班", meta: "示例期间：单次调课" },
    ],
  },
  teach_collab: {
    mode: "search",
    multi: true,
    objectNoun: "明确任务",
    searchPlaceholder: "搜索协作任务（如 作业A 批阅）",
    emptyHint: "先搜索并选择明确的协作任务",
    items: [
      { id: "task-hwA-grade", label: "作业A · 批阅", parentPath: "数学A班 / 第 3 次作业", meta: "仅该任务内可协作" },
      { id: "task-hwB-grade", label: "作业B · 批阅", parentPath: "数学B班 / 第 2 次作业" },
      { id: "task-examA-input", label: "月考A · 登分", parentPath: "数学A班 / 9 月月考", meta: "仅登分，不含改卷" },
    ],
  },
  course_material: {
    mode: "search",
    multi: false,
    objectNoun: "课程",
    searchPlaceholder: "搜索课程（如 CAIE数学）",
    emptyHint: "先搜索并选择课程（示例版本在下一步确认）",
    items: [
      { id: "course-caie-math", label: "CAIE数学", parentPath: "数学学科", meta: "示例版本：2026 版" },
      { id: "course-caie-phy", label: "CAIE物理", parentPath: "物理学科", meta: "示例版本：2026 版" },
      { id: "course-edx-math", label: "Edexcel数学", parentPath: "数学学科", meta: "示例版本：2025 版" },
    ],
  },
  course_structure: {
    mode: "search",
    multi: false,
    objectNoun: "课程",
    searchPlaceholder: "搜索课程（如 CAIE数学）",
    emptyHint: "先搜索并选择课程（示例版本在下一步确认）",
    items: [
      { id: "course-caie-math", label: "CAIE数学", parentPath: "数学学科", meta: "示例版本：2026 版" },
      { id: "course-caie-phy", label: "CAIE物理", parentPath: "物理学科", meta: "示例版本：2026 版" },
      { id: "course-edx-math", label: "Edexcel数学", parentPath: "数学学科", meta: "示例版本：2025 版" },
    ],
  },
  teaching_class_mgmt: {
    mode: "search",
    multi: true,
    objectNoun: "已有教学班",
    searchPlaceholder: "搜索已有教学班（如 数学A班）",
    emptyHint: "先搜索并选择已有教学班（获准事项固定，不在此扩展）",
    items: [
      { id: "tc-mathA", label: "数学A班", parentPath: "CAIE数学", meta: "获准事项：名单 / 分组（固定）" },
      { id: "tc-mathB", label: "数学B班", parentPath: "CAIE数学", meta: "获准事项：名单 / 分组（固定）" },
      { id: "tc-phyA", label: "物理A班", parentPath: "CAIE物理", meta: "获准事项：名单 / 分组（固定）" },
    ],
  },
  substitute_mgmt: {
    mode: "search",
    multi: false,
    objectNoun: "已授教学目标",
    searchPlaceholder: "搜索代课目标（如 数学A班 P1）",
    emptyHint: "先搜索并选择需要安排代课的实际教学目标（课次 / 期间在下一步填写）",
    items: [
      { id: "tc-mathA-p1", label: "数学A班 · P1", parentPath: "CAIE数学 / 数学A班", meta: "示例期间：第 6–8 周" },
      { id: "tc-mathB-p1", label: "数学B班 · P1", parentPath: "CAIE数学 / 数学B班", meta: "示例课次：周三第 3 节" },
      { id: "tc-phyA-full", label: "物理A班 · 整门课程", parentPath: "CAIE物理 / 物理A班", meta: "示例期间：单次调课" },
    ],
  },
  timetable_mgmt: {
    mode: "fixed",
    multi: false,
    objectNoun: "本校学校课表",
    searchPlaceholder: "",
    emptyHint: "",
    items: [{ id: "timetable-school", label: "本校 · 学校课表", parentPath: "当前学期", meta: "固定范围，只读" }],
    fixedNote: "课表管理对象固定为“本校学校课表”；教师本人课表中的个人调整仍由教师自己维护，不在此范围内。",
  },
  school_admin: {
    mode: "fixed",
    multi: false,
    objectNoun: "本校",
    searchPlaceholder: "",
    emptyHint: "",
    items: [{ id: "school-fixed", label: "本校 · 学校管理", parentPath: "全校范围", meta: "固定范围，只读" }],
    fixedNote: "学校管理对象固定为“本校”，只读、无需选择对象；获准事项为固定治理项，不在此界面扩展。",
  },
}

/* ============================================================
 * 邀请（一份邀请，三种交付：邀请链接 / 邀请码 / 邮件）
 * 无审批：有权者直接办理；接受、失效与历史统一，不重复开户。
 * 稳定的非秘密编号 INV-DEMO-01 贯穿结果、记录、事件与重复提示；
 * 它不是邀请码，不具授权能力。仅预设状态，不发送真实邮件 / token。
 * ========================================================== */

export const INVITE_DEMO_NO = "INV-DEMO-01"
export const INVITE_DEMO_CODE = "DEMO-7K2M" // 明确无效的示例邀请码
export const INVITE_DEMO_LINK = "https://join.example.invalid/accept/INV-DEMO-01" // 明确无效的示例链接
export const INVITE_VALID_DAYS = 7
export const INVITE_DEMO_EXPIRES = "2026-10-03 18:00"

// 邮件送达状态（与邀请状态分列；成功不等于对方已接受）
export type EmailDeliveryStatus = "none" | "sending" | "sent" | "failed" | "unconfigured"
export const EMAIL_STATUS_LABEL: Record<EmailDeliveryStatus, string> = {
  none: "尚未通过邮件发送",
  sending: "邮件发送中",
  sent: "邮件已发送（示例）",
  failed: "邮件发送失败",
  unconfigured: "邮件服务未配置",
}
export const EMAIL_STATUS_TONE: Record<EmailDeliveryStatus, "neutral" | "info" | "success" | "danger" | "warning"> = {
  none: "neutral",
  sending: "info",
  sent: "success",
  failed: "danger",
  unconfigured: "warning",
}

// 邀请状态（一份邀请一个当前状态；旧版本在详情版本区显示“已替代”）
export type InviteStatus = "pending" | "accepted" | "expired" | "revoked" | "superseded"
export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  pending: "待接受",
  accepted: "已接受",
  expired: "已过期",
  revoked: "已撤销",
  superseded: "已替代",
}
export const INVITE_STATUS_TONE: Record<InviteStatus, "info" | "success" | "neutral" | "danger" | "warning"> = {
  pending: "info",
  accepted: "success",
  expired: "neutral",
  revoked: "danger",
  superseded: "warning",
}

export interface InviteEvent {
  time: string
  text: string
}

export interface InviteRecord {
  id: string // 稳定非秘密编号，如 INV-DEMO-01
  person: string
  personSub: string // 工号 · 部门／职务
  roles: SystemRoleCode[]
  workPlan: string // 工作安排摘要（已有 / 新增）
  status: InviteStatus
  emailStatus: EmailDeliveryStatus
  emailTo?: string
  expiresAt: string // 邀请有效期（仅影响接受，不影响任命 / 治理任期）
  credentialVersion: number // 凭证版本；重置后 +1，旧入口失效
  code: string
  link: string
  accountMode: "new" | "reuse" // 新建账号 / 复用既有
  lastAction: string // 最近操作（列表列）
  events: InviteEvent[]
  supersededNote?: string // 详情版本区：旧版本被替代说明
  note?: string
}

// 主示例邀请 INV-DEMO-01：受邀 示例王老师，拟开通班主任，安排辅助班主任 · 高一2班。
export const INVITE_RECORDS: InviteRecord[] = [
  {
    id: INVITE_DEMO_NO,
    person: "示例王老师",
    personSub: "TGS202309001E · 数学组／教师",
    roles: ["HOMEROOM_TEACHER"],
    workPlan: "辅助班主任 · 高一2班",
    status: "pending",
    emailStatus: "sent",
    emailTo: "w***@example.edu",
    expiresAt: INVITE_DEMO_EXPIRES,
    credentialVersion: 1,
    code: INVITE_DEMO_CODE,
    link: INVITE_DEMO_LINK,
    accountMode: "new",
    lastAction: "重试邮件发送成功（示例）",
    events: [
      { time: "09-26 18:00", text: "某有权管理员生成邀请（无审批）" },
      { time: "09-26 18:01", text: "复制邀请链接" },
      { time: "09-26 18:03", text: "邮件发送失败" },
      { time: "09-26 18:05", text: "重试邮件发送成功（示例）" },
    ],
    note: "同一份邀请：链接、邀请码、邮件三种交付使用同一编号；任一入口接受后其余不可再开户。",
  },
  {
    id: "INV-DEMO-02",
    person: "示例郑老师",
    personSub: "TGS202408001E · 英语组／教师",
    roles: ["SUBJECT_TEACHER"],
    workPlan: "主要任课 · 高一英语A班 → 整门目标",
    status: "accepted",
    emailStatus: "sent",
    emailTo: "z***@example.edu",
    expiresAt: "2026-09-28 12:00",
    credentialVersion: 1,
    code: "DEMO-3P9Q",
    link: "https://join.example.invalid/accept/INV-DEMO-02",
    accountMode: "new",
    lastAction: "受邀人接受并激活（示例）",
    events: [
      { time: "09-21 10:00", text: "有权管理员生成邀请" },
      { time: "09-21 10:02", text: "邮件已发送（示例）" },
      { time: "09-22 09:15", text: "受��人接受并设置登录名、激活账号（示例）" },
    ],
    note: "已接受：链接 / 邀请码再使用只显示既有结果，不新建第二个账号。",
  },
  {
    id: "INV-DEMO-03",
    person: "示例孙老师",
    personSub: "TGS202509001E · 综合组／教师",
    roles: ["SUBJECT_TEACHER"],
    workPlan: "暂不安排任教（仅拟开通任课资格）",
    status: "expired",
    emailStatus: "sent",
    emailTo: "s***@example.edu",
    expiresAt: "2026-09-15 18:00",
    credentialVersion: 1,
    code: "DEMO-5T1V",
    link: "https://join.example.invalid/accept/INV-DEMO-03",
    accountMode: "new",
    lastAction: "邀请已过期",
    events: [
      { time: "09-08 14:00", text: "有权管理员生成邀请" },
      { time: "09-08 14:01", text: "邮件已发送（示例）" },
      { time: "09-15 18:00", text: "有效期到达，邀请过期（未接受）" },
    ],
    note: "已过期只影响接受；可由有权者重新核对方案并重新签发，不带回失效职责。",
  },
  {
    id: "INV-DEMO-04",
    person: "示例待关联账号",
    personSub: "未关联教职工 · 拟仅账号自服务",
    roles: [],
    workPlan: "仅账号自服务（零角色例外）",
    status: "revoked",
    emailStatus: "none",
    expiresAt: "2026-09-19 18:00",
    credentialVersion: 1,
    code: "DEMO-8W4X",
    link: "https://join.example.invalid/accept/INV-DEMO-04",
    accountMode: "new",
    lastAction: "已撤销：所有入口不可再接受",
    events: [
      { time: "09-12 11:00", text: "有权管理员生成邀请（零角色例外）" },
      { time: "09-13 09:00", text: "撤销邀请：当前所有入口不可再接受" },
    ],
    note: "已撤销：普通重发不能复活；如仍需开通须重新核对并重新签发。",
  },
  {
    id: "INV-DEMO-05",
    person: "示例周老师",
    personSub: "TGS202209001E · 物理组／教师",
    roles: ["TEACHING_MANAGER"],
    workPlan: "教务管理 · 标准教务配置（重置凭证后旧版本）",
    status: "superseded",
    emailStatus: "sent",
    emailTo: "z***@example.edu",
    expiresAt: "2026-09-24 18:00",
    credentialVersion: 1,
    code: "DEMO-OLD-0",
    link: "https://join.example.invalid/accept/INV-DEMO-05-v1",
    accountMode: "reuse",
    lastAction: "旧版本已被重签发替代",
    events: [
      { time: "09-17 15:00", text: "有权管理员生成邀请（凭证版本 1）" },
      { time: "09-18 15:00", text: "重置凭证并重新签发：版本 1 失效，版本 2 生效" },
    ],
    supersededNote: "凭证版本 1 已被版本 2 替代；人员、membership 与既定工作不重建，历史保留。",
    note: "已替代：旧凭证入口失效，不同时计作当前待接受。",
  },
]

export function inviteById(id: string): InviteRecord | undefined {
  return INVITE_RECORDS.find((r) => r.id === id)
}
export const INVITE_DEMO = INVITE_RECORDS[0]

/* ============================================================
 * 关联校验（P11）
 * 账号与教职工档案的关联需要人工确认，不做自动匹配即通过。
 * ========================================================== */

export interface AssociationCheck {
  label: string
  value: string
  state: "match" | "review" | "conflict"
}

export interface AssociationCase {
  id: string
  account: string
  candidate: string // 拟关联的教职工
  checks: AssociationCheck[]
  advisory: string // 建议结论（非自动执行）
}

export const ASSOCIATION_CASES: AssociationCase[] = [
  {
    id: "assoc-wang",
    account: "待设置登录名（邀请中）",
    candidate: "示例王老师 · TGS202309001E · 数学组 / 教师",
    checks: [
      { label: "姓名", value: "王 · 与档案一致", state: "match" },
      { label: "工号", value: "TGS202309001E · 与档案一致", state: "match" },
      { label: "部门 / 职务", value: "数学组 / 教师 · 与档案一致", state: "match" },
      { label: "既有账号", value: "该档案暂无在用账号", state: "match" },
      { label: "登录名", value: "受邀人尚未设置", state: "review" },
    ],
    advisory: "各项一致，建议在受邀人接受并设置登录名���确认关联；确认为人工动��，系统不自动完成。",
  },
  {
    id: "assoc-conflict",
    account: "new.teacher（未关联）",
    candidate: "示例陈老师 · TGS201809001E · 物理组 / 教师",
    checks: [
      { label: "姓名", value: "账号无实名，无法比对", state: "review" },
      { label: "工号", value: "账号未提供工号", state: "review" },
      { label: "既有账号", value: "陈老师已关联 chen.example", state: "conflict" },
      { label: "本校访问来源", value: "基础来源 vs 员工来源不一致", state: "conflict" },
    ],
    advisory: "存在既有账号冲突：陈老师已关联 chen.example。不建议关联；如确需处理，应先核对并停用重复账号，由人工决定。",
  },
]
