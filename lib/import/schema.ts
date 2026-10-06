// 多工作表导入的原型字段合同（依据 03_WORKBOOK_BLUEPRINT 草案）。
// 这是原型格式，不是现有后台已经接受的正式模板。

export const TEMPLATE_VERSION = "WFB-IMPORT-PROTO-1.1"
export const SUPPORTED_VERSIONS = [TEMPLATE_VERSION]

export type SheetCode =
  | "00" | "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10"
  | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "18" | "19" | "20" | "21"
  | "22" | "23" | "24" | "25" | "26" | "27" | "90" | "91" | "92"

export type FieldKind = "id" | "text" | "date" | "partialDate" | "month" | "enum" | "ref" | "personNo" | "phone" | "email" | "time"

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  required?: boolean
  ref?: SheetCode
  options?: string[]
  note?: string
  personType?: "S" | "E"
  aliases?: string[]
}

export type GroupId = "base" | "catalog" | "people" | "admin" | "teaching" | "family" | "prep" | "timetable" | "meta"

export const GROUPS: { id: GroupId; label: string; desc: string }[] = [
  { id: "base", label: "基础", desc: "学校信息、学年学期、部门、职务、教室" },
  { id: "catalog", label: "课程目录", desc: "学科、课程、官方单元定义及关系" },
  { id: "people", label: "人员", desc: "教职工、任职资格、学生" },
  { id: "admin", label: "行政", desc: "行政班、行政名单、班主任任命" },
  { id: "teaching", label: "教学", desc: "教学班、独立名单、实际分工、任教安排" },
  { id: "family", label: "家校", desc: "家长/监护人、学生家长关系" },
  { id: "prep", label: "管理准备", desc: "管理委派、开户准备方案" },
  { id: "timetable", label: "学校课表（可选）", desc: "既有课表合同的节次与学校排课" },
  { id: "meta", label: "包信息", desc: "引用与版本、编号保留、覆盖清单" },
]

export type SheetRole = "instruction" | "school" | "object" | "relation" | "meta"

export interface SheetDef {
  code: SheetCode
  name: string
  group: GroupId
  role: SheetRole
  unit: string
  fields: FieldDef[]
  guard: string
}

const STATUS = ["启用", "停用"]
const f = (key: string, label: string, kind: FieldKind, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, kind, ...extra })
const id = (label: string) => f("id", label, "id", { required: true })
const req = { required: true }

export const SHEETS: SheetDef[] = [
  {
    code: "00", name: "使用说明", group: "meta", role: "instruction", unit: "", guard: "不导入成业务对象",
    fields: [f("k", "项目", "text"), f("v", "内容", "text")],
  },
  {
    code: "01", name: "学校信息", group: "base", role: "school", unit: "项信息", guard: "不能更改租户ID、连接、来源信任、密码或安全配置；不覆盖目标校名与编号前缀",
    fields: [f("name", "学校显示名", "text", req), f("nameEn", "英文名", "text"), f("address", "地址", "text")],
  },
  {
    code: "02", name: "学年", group: "base", role: "object", unit: "个学年", guard: "已存在学年准确复用，不暗改当前学年",
    fields: [id("学年标识"), f("name", "名称", "text", req), f("start", "开始日期", "date", req), f("end", "结束日期", "date", req)],
  },
  {
    code: "03", name: "学期", group: "base", role: "object", unit: "个学期", guard: "不自动切换当前学期",
    fields: [id("学期标识"), f("year", "学年引用", "ref", { required: true, ref: "02" }), f("name", "名称", "text", req), f("start", "开始日期", "date", req), f("end", "结束日期", "date", req)],
  },
  {
    code: "04", name: "部门", group: "base", role: "object", unit: "个部门", guard: "扁平，不建部门树、不从部门授角色",
    fields: [id("部门标识"), f("name", "名称", "text", req), f("status", "启用状态", "enum", { options: STATUS })],
  },
  {
    code: "05", name: "职务", group: "base", role: "object", unit: "个职务", guard: "人事名称，不是系统角色或资格",
    fields: [id("职务标识"), f("name", "名称", "text", req), f("status", "启用状态", "enum", { options: STATUS })],
  },
  {
    code: "06", name: "教室", group: "base", role: "object", unit: "间教室", guard: "稳定地点，临时地点不同",
    fields: [id("教室标识"), f("name", "名称", "text", req), f("building", "楼栋/位置", "text"), f("status", "启用状态", "enum", { options: STATUS })],
  },
  {
    code: "07", name: "学科", group: "catalog", role: "object", unit: "个学科", guard: "复用目录定义",
    fields: [id("学科标识"), f("name", "名称", "text", req), f("short", "合法短名", "text")],
  },
  {
    code: "08", name: "课程", group: "catalog", role: "object", unit: "门课程", guard: "范围依当前目录合同，不凑造所有字段",
    fields: [id("课程标识"), f("subject", "学科引用", "ref", { required: true, ref: "07" }), f("name", "登记名称", "text", req), f("org", "机构/体系", "text"), f("version", "版本", "text")],
  },
  {
    code: "09", name: "课程单元定义", group: "catalog", role: "object", unit: "个单元定义", guard: "是目录定义，不是实际教学分工",
    fields: [id("单元标识"), f("name", "登记名称", "text", req), f("short", "短名", "text")],
  },
  {
    code: "10", name: "课程单元关系", group: "catalog", role: "relation", unit: "条课程单元关系", guard: "单元定义只维护一份",
    fields: [f("course", "课程引用", "ref", { required: true, ref: "08" }), f("unit", "单元引用", "ref", { required: true, ref: "09" }), f("order", "排序", "text")],
  },
  {
    code: "11", name: "教职工", group: "people", role: "object", unit: "名教职工", guard: "不自动开户或赋教师角色；同名不可合并",
    fields: [
      id("人员标识"), f("name", "姓名", "text", req), f("firstDate", "首次入职年月", "month", { aliases: ["首次正式入职日期", "首次入职日期"], note: "本校首次入职，可空；历史具体日期原样保留" }),
      f("no", "员工编号", "personNo", { personType: "E", note: "留空默认待编号；明确选择自动生成才发号" }),
      f("numberIntent", "编号方式", "enum", { options: ["暂不编号", "自动生成", "手工填写"] }),
      f("dept", "部门引用", "ref", { ref: "04" }), f("title", "职务引用", "ref", { ref: "05" }),
      f("email", "邮箱", "email"), f("phone", "电话", "phone"),
      f("englishName", "英文名/常用名", "text", { aliases: ["英文名", "常用名", "英文名／常用名"] }), f("educationLevel", "学历", "text"),
      f("school", "毕业学校", "text", { aliases: ["就读院校", "院校"] }), f("major", "专业", "text"), f("graduation", "毕业时间", "partialDate"),
      f("firstWorkAt", "首次参加工作年月", "partialDate", { aliases: ["首次参加工作时间"] }),
      f("organization", "过往工作单位", "text"), f("pastRole", "过往岗位", "text"), f("workStart", "过往工作开始", "partialDate"), f("workEnd", "过往工作结束", "partialDate"),
    ],
  },
  {
    code: "12", name: "任职资格", group: "people", role: "relation", unit: "项资格", guard: "员工＋经办者合法授予能力；不是membership角色",
    fields: [id("资格标识"), f("staff", "员工引用", "ref", { required: true, ref: "11" }), f("kind", "资格类型", "enum", { required: true, options: ["任课资格", "班主任资格", "管理资格"] }), f("start", "起始日期", "date", req), f("end", "结束日期", "date")],
  },
  {
    code: "13", name: "学生", group: "people", role: "object", unit: "名学生", guard: "不自动猜生日/国籍或课程路径；行政班关系独立",
    fields: [id("学生标识"), f("name", "姓名", "text", req), f("firstDate", "首次正式入学日期", "date", req), f("no", "学生编号", "personNo", { personType: "S", note: "留空默认待编号；明确选择自动生成才发号" }), f("numberIntent", "编号方式", "enum", { options: ["暂不编号", "自动生成", "手工填写"] }), f("grade", "年级", "text")],
  },
  {
    code: "14", name: "家长监护人", group: "family", role: "object", unit: "位家长/监护人", guard: "一个真实家长可被多名学生引用；不自动开家长账号",
    fields: [id("家长标识"), f("name", "姓名", "text", req), f("email", "邮箱", "email"), f("phone", "电话", "phone")],
  },
  {
    code: "15", name: "学生家长关系", group: "family", role: "relation", unit: "条家长关系", guard: "多对多；关系不作为门户身份核验结果",
    fields: [f("student", "学生引用", "ref", { required: true, ref: "13" }), f("guardian", "家长引用", "ref", { required: true, ref: "14" }), f("kind", "关系类型", "enum", { required: true, options: ["父亲", "母亲", "祖父母", "其他监护人"] }), f("primary", "主要联系人", "enum", { options: ["是", "否"] }), f("start", "开始日期", "date"), f("end", "结束日期", "date")],
  },
  {
    code: "16", name: "行政班", group: "admin", role: "object", unit: "个行政班", guard: "允许空班和无班主任；由管理员合法建立",
    fields: [id("班级标识"), f("name", "名称", "text", req), f("term", "学期引用", "ref", { required: true, ref: "03" }), f("grade", "年级", "text"), f("no", "正式编号", "text")],
  },
  {
    code: "17", name: "行政班学生", group: "admin", role: "relation", unit: "条行政名单关系", guard: "正式班冲突阻断；不是覆盖名单或调班命令",
    fields: [f("klass", "行政班引用", "ref", { required: true, ref: "16" }), f("student", "学生引用", "ref", { required: true, ref: "13" }), f("start", "开始日期", "date", req), f("end", "结束日期", "date"), f("state", "名单状态", "enum", { required: true, options: ["正式", "待确认"] })],
  },
  {
    code: "18", name: "班主任任命", group: "admin", role: "relation", unit: "项班主任任命", guard: "同时最多一主、可多辅；无账号是明确待登录访问状态",
    fields: [id("任命标识"), f("staff", "员工引用", "ref", { required: true, ref: "11" }), f("qual", "资格引用", "ref", { required: true, ref: "12" }), f("klass", "行政班引用", "ref", { required: true, ref: "16" }), f("role", "主/辅助", "enum", { required: true, options: ["主", "辅助"] }), f("start", "开始日期", "date", req), f("end", "结束日期", "date")],
  },
  {
    code: "19", name: "教学班", group: "teaching", role: "object", unit: "个教学班", guard: "学科必要；课程和排课归属可空；归属不推导学生",
    fields: [id("教学班标识"), f("term", "学期引用", "ref", { required: true, ref: "03" }), f("subject", "学科引用", "ref", { required: true, ref: "07" }), f("name", "登记名称", "text", req), f("short", "教学班简称", "text"), f("homeClass", "排课归属行政班引用", "ref", { ref: "16" }), f("course", "本期课程引用", "ref", { ref: "08", note: "可空；填了就必须存在" })],
  },
  {
    code: "20", name: "教学班学生", group: "teaching", role: "relation", unit: "条父名单关系", guard: "独立父班名单；不是分工并集反推",
    fields: [f("tc", "教学班引用", "ref", { required: true, ref: "19" }), f("student", "学生引用", "ref", { required: true, ref: "13" }), f("start", "开始日期", "date", req), f("end", "结束日期", "date")],
  },
  {
    code: "21", name: "教学分工", group: "teaching", role: "object", unit: "个实际分工", guard: "实际分工可无官方定义；不建立伪默认单元",
    fields: [id("分工标识"), f("tc", "教学班引用", "ref", { required: true, ref: "19" }), f("name", "分工登记名称", "text", req), f("short", "简称", "text"), f("mode", "名单模式", "enum", { required: true, options: ["INHERIT", "EXPLICIT_SUBSET"] }), f("unit", "官方单元关联", "ref", { ref: "09" })],
  },
  {
    code: "22", name: "分工指定学生", group: "teaching", role: "relation", unit: "条子集关系", guard: "仅EXPLICIT_SUBSET；必须属于同一父班名单",
    fields: [f("div", "分工引用", "ref", { required: true, ref: "21" }), f("student", "学生引用", "ref", { required: true, ref: "13" }), f("start", "开始日期", "date", req), f("end", "结束日期", "date")],
  },
  {
    code: "23", name: "任教安排", group: "teaching", role: "relation", unit: "项任教安排", guard: "整科不填分工；分工目标必须填；多教师多行，不自动把首行当负责人",
    fields: [id("任命标识"), f("staff", "员工引用", "ref", { required: true, ref: "11" }), f("qual", "资格引用", "ref", { required: true, ref: "12" }), f("tc", "教学班引用", "ref", { required: true, ref: "19" }), f("target", "目标类型", "enum", { required: true, options: ["整科", "分工"] }), f("div", "分工引用", "ref", { ref: "21" }), f("work", "工作类型", "enum", { required: true, options: ["主讲", "协同", "助教"] }), f("start", "开始日期", "date", req), f("end", "结束日期", "date")],
  },
  {
    code: "24", name: "管理委派", group: "prep", role: "relation", unit: "项管理委派", guard: "只有已实现和操作者可授事项；保护最后管理员",
    fields: [id("委派标识"), f("staff", "员工引用", "ref", { required: true, ref: "11" }), f("qual", "资格引用", "ref", { ref: "12" }), f("duty", "具体职责", "text", req), f("target", "目标类型", "enum", { required: true, options: ["学科", "年级", "学校"] }), f("targetRef", "目标引用/标准配置", "text", req), f("start", "开始日期", "date", req), f("end", "结束日期", "date")],
  },
  {
    code: "25", name: "开户准备", group: "prep", role: "relation", unit: "项开户准备", guard: "只是待办理方案，不激活账号、不含密码/token，不自动发邀请",
    fields: [f("staff", "员工引用", "ref", { required: true, ref: "11" }), f("role", "拟系统角色", "enum", { required: true, options: ["教师", "教务", "学科负责人", "管理员"] }), f("preset", "获准配置标记", "text"), f("channel", "建议渠道", "enum", { options: ["邀请码", "邀请链接", "邮件"] })],
  },
  {
    code: "26", name: "学校节次", group: "timetable", role: "object", unit: "个节次", guard: "作为现有课表合同扩展，不规定另一套时间表格式",
    fields: [id("节次标识"), f("name", "名称", "text", req), f("from", "开始时间", "time", req), f("to", "结束时间", "time", req)],
  },
  {
    code: "27", name: "学校排课", group: "timetable", role: "relation", unit: "条学校排课", guard: "导入为待确认学校版本；不自动采用/发布/授任教",
    fields: [id("排课标识"), f("tc", "教学班引用", "ref", { required: true, ref: "19" }), f("day", "星期", "enum", { required: true, options: ["周一", "周二", "周三", "周四", "周五"] }), f("period", "节次引用", "ref", { required: true, ref: "26" }), f("room", "教室引用", "ref", { ref: "06" }), f("weeks", "周模式", "enum", { options: ["每周", "单周", "双周"] })],
  },
  {
    code: "90", name: "引用与版本信息", group: "meta", role: "meta", unit: "", guard: "校验而非信任，不是授权凭据",
    fields: [f("k", "项目", "text"), f("v", "内容", "text")],
  },
  {
    code: "91", name: "编号保留信息", group: "meta", role: "meta", unit: "", guard: "不回收旧编号；不能降低目标现有保留状态",
    fields: [f("k", "项目", "text"), f("v", "内容", "text")],
  },
  {
    code: "92", name: "包覆盖清单", group: "meta", role: "meta", unit: "", guard: "权限受限或脱敏时如实，不能声称完整恢复",
    fields: [f("k", "项目", "text"), f("v", "内容", "text")],
  },
]

export const SHEET: Record<SheetCode, SheetDef> = Object.fromEntries(SHEETS.map((s) => [s.code, s])) as Record<SheetCode, SheetDef>

export function sheetTitle(code: SheetCode) {
  return `${code}_${SHEET[code].name}`
}

export function dependsOn(code: SheetCode): SheetCode[] {
  return [...new Set(SHEET[code].fields.filter((x) => x.ref).map((x) => x.ref as SheetCode))]
}

export function dependents(code: SheetCode): SheetCode[] {
  return SHEETS.filter((s) => s.fields.some((x) => x.ref === code)).map((s) => s.code)
}

export function idField(code: SheetCode) {
  return SHEET[code].fields.find((x) => x.kind === "id")
}

export interface Preset {
  id: string
  label: string
  desc: string
  sheets: SheetCode[]
}

export const PRESETS: Preset[] = [
  { id: "students", label: "单独学生", desc: "只有学生档案，没有跨表关系", sheets: ["13"] },
  { id: "admin-roster", label: "学生与行政名单", desc: "已有班级时可只引用行政班", sheets: ["13", "16", "17"] },
  { id: "people-base", label: "人员与基础选项", desc: "部门、职务、教室与教职工；资格按需", sheets: ["04", "05", "06", "11", "12"] },
  { id: "teaching", label: "教学组织", desc: "课程可选，不强迫官方单元", sheets: ["07", "19", "20", "21", "22", "23"] },
  { id: "family", label: "家校联系", desc: "引用已有学生，不重复建立学生", sheets: ["14", "15"] },
  {
    id: "full", label: "完整学校基础", desc: "01—25 的必要集合；学校课表独立可选",
    sheets: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25"],
  },
  { id: "timetable", label: "学校课表（可选）", desc: "既有课表合同扩展，导入为待确认学校版本", sheets: ["26", "27"] },
]
