// 合成示例：用于“载入示例”与下载示例文件。先生成真实 XLSX 字节，再走与用户文件相同的解析。
// 人物、学校均为合成数据，不是真实学校资料，也不是数据库种子。

import type { SheetCode } from "./schema"

type Rows = Record<string, string>[]
export type SampleData = Partial<Record<SheetCode, Rows>>

const T1 = { start: "2026-09-01", end: "2027-01-29" }

const FULL: SampleData = {
  "01": [{ name: "示例国际课程学校", nameEn: "Demo International School", address: "示例路 1 号" }],
  "02": [{ id: "YR01", name: "2026—2027学年", start: "2026-09-01", end: "2027-07-31" }],
  "03": [{ id: "TR01", year: "YR01", name: "第一学期", ...T1 }],
  "04": [
    { id: "DEP01", name: "数学组", status: "启用" },
    { id: "DEP02", name: "信息技术组", status: "启用" },
  ],
  "05": [
    { id: "JOB01", name: "教师", status: "启用" },
    { id: "JOB02", name: "教务人员", status: "启用" },
  ],
  "06": [
    { id: "ROOM01", name: "B305", building: "教学楼B", status: "启用" },
    { id: "ROOM02", name: "机房二", building: "实验楼", status: "启用" },
  ],
  "07": [
    { id: "SUB01", name: "数学", short: "数" },
    { id: "SUB02", name: "计算机", short: "计" },
  ],
  "08": [{ id: "COURSE01", subject: "SUB01", name: "A Level 数学", org: "CAIE", version: "9709" }],
  "09": [
    { id: "UNIT01", name: "纯数学1", short: "P1" },
    { id: "UNIT02", name: "概率与统计1", short: "S1" },
  ],
  "10": [
    { course: "COURSE01", unit: "UNIT01", order: "1" },
    { course: "COURSE01", unit: "UNIT02", order: "2" },
  ],
  "11": [
    { id: "EMP01", name: "示例教职工甲", firstDate: "2026-09-01", no: "", dept: "DEP01", title: "JOB01", email: "jia@example.edu", phone: "13800000001" },
    { id: "EMP02", name: "示例教职工乙", firstDate: "2026-09-01", no: "", dept: "DEP01", title: "JOB01", email: "yi@example.edu", phone: "" },
    { id: "EMP03", name: "示例教职工丙", firstDate: "2025-02-17", no: "", dept: "DEP02", title: "JOB01", email: "", phone: "" },
    { id: "EMP04", name: "示例教职工丁", firstDate: "2026-08-20", no: "", dept: "", title: "JOB02", email: "ding@example.edu", phone: "" },
  ],
  "12": [
    { id: "Q01", staff: "EMP01", kind: "任课资格", start: "2026-09-01" },
    { id: "Q02", staff: "EMP01", kind: "班主任资格", start: "2026-09-01" },
    { id: "Q03", staff: "EMP02", kind: "任课资格", start: "2026-09-01" },
    { id: "Q04", staff: "EMP03", kind: "任课资格", start: "2026-09-01" },
    { id: "Q05", staff: "EMP02", kind: "班主任资格", start: "2026-09-01" },
  ],
  "13": [
    { id: "STU01", name: "示例学生一", firstDate: "2026-09-01", no: "", grade: "10年级" },
    { id: "STU02", name: "示例学生二", firstDate: "2026-09-01", no: "", grade: "10年级" },
    { id: "STU03", name: "示例学生三", firstDate: "2026-09-01", no: "", grade: "10年级" },
    { id: "STU04", name: "示例学生四", firstDate: "2025-09-01", no: "", grade: "10年级" },
  ],
  "14": [
    { id: "GUA01", name: "示例家长甲", phone: "13700000001", email: "" },
    { id: "GUA02", name: "示例家长乙", phone: "13700000002", email: "" },
    { id: "GUA03", name: "示例家长丙", phone: "", email: "bing@example.com" },
  ],
  "15": [
    { student: "STU01", guardian: "GUA01", kind: "母亲", primary: "是" },
    { student: "STU02", guardian: "GUA01", kind: "母亲", primary: "是" },
    { student: "STU03", guardian: "GUA02", kind: "父亲", primary: "是" },
    { student: "STU03", guardian: "GUA03", kind: "母亲", primary: "否" },
  ],
  "16": [{ id: "AC01", name: "10年级1班", term: "TR01", grade: "10年级", no: "" }],
  "17": [
    { klass: "AC01", student: "STU01", start: "2026-09-01", state: "正式" },
    { klass: "AC01", student: "STU02", start: "2026-09-01", state: "正式" },
    { klass: "AC01", student: "STU03", start: "2026-09-01", state: "正式" },
    { klass: "AC01", student: "STU04", start: "2026-09-01", state: "待确认" },
  ],
  "18": [
    { id: "HRT01", staff: "EMP01", qual: "Q02", klass: "AC01", role: "主", ...T1 },
    { id: "HRT02", staff: "EMP02", qual: "Q05", klass: "AC01", role: "辅助", ...T1 },
  ],
  "19": [
    { id: "TC01", term: "TR01", subject: "SUB01", name: "10年级数学A", short: "数学A", homeClass: "AC01", course: "" },
    { id: "TC02", term: "TR01", subject: "SUB02", name: "10年级计算机", short: "计算机", homeClass: "", course: "" },
  ],
  "20": [
    { tc: "TC01", student: "STU01", ...T1 },
    { tc: "TC01", student: "STU02", ...T1 },
    { tc: "TC01", student: "STU03", ...T1 },
    { tc: "TC02", student: "STU01", ...T1 },
  ],
  "21": [
    { id: "DIV01", tc: "TC01", name: "P1", short: "P1", mode: "INHERIT", unit: "" },
    { id: "DIV02", tc: "TC01", name: "S1", short: "S1", mode: "EXPLICIT_SUBSET", unit: "" },
  ],
  "22": [
    { div: "DIV02", student: "STU01", ...T1 },
    { div: "DIV02", student: "STU02", ...T1 },
  ],
  "23": [
    { id: "TA01", staff: "EMP01", qual: "Q01", tc: "TC01", target: "分工", div: "DIV01", work: "主讲", ...T1 },
    { id: "TA02", staff: "EMP02", qual: "Q03", tc: "TC01", target: "分工", div: "DIV02", work: "主讲", ...T1 },
    { id: "TA03", staff: "EMP03", qual: "Q04", tc: "TC02", target: "整科", div: "", work: "主讲", ...T1 },
  ],
  "24": [{ id: "DLG01", staff: "EMP04", qual: "", duty: "课表维护", target: "学校", targetRef: "标准教务配置", start: "2026-09-01" }],
  "25": [
    { staff: "EMP01", role: "教师", preset: "", channel: "邀请链接" },
    { staff: "EMP04", role: "教务", preset: "标准教务配置", channel: "邀请码" },
  ],
}

const pick = (codes: SheetCode[], src: SampleData = FULL): SampleData => Object.fromEntries(codes.map((c) => [c, src[c]])) as SampleData

const WITH_ISSUES: SampleData = {
  ...FULL,
  "11": [
    ...FULL["11"]!,
    { id: "EMP05", name: "示例教职工戊", firstDate: "2026-09-01", no: "TGS-202609-005E", dept: "DEP09", title: "JOB01", email: "", phone: "" },
  ],
  "13": [
    ...FULL["13"]!,
    { id: "STU05", name: "示例学生五", firstDate: "2026-09-01", no: "tgs202609031s", grade: "10年级" },
  ],
  "14": [...FULL["14"]!, { id: "GUA04", name: "示例家长甲", phone: "13900000009", email: "" }],
  "18": [...FULL["18"]!, { id: "HRT03", staff: "EMP02", qual: "Q05", klass: "AC01", role: "主", ...T1 }],
  "22": [...FULL["22"]!, { div: "DIV02", student: "STU04", ...T1 }],
  "24": [...FULL["24"]!, { id: "DLG02", staff: "EMP02", qual: "", duty: "全校人事审批", target: "学校", targetRef: "全部", start: "2026-09-01" }],
}

export interface SampleDef {
  id: string
  label: string
  fileName: string
  desc: string
  data: SampleData
  info?: Record<string, string>
}

export const SAMPLES: SampleDef[] = [
  { id: "full", label: "完整合成示例（无阻断）", fileName: "示例_完整学校基础.xlsx", desc: "01—25 全部表，含 P1 继承 / S1 子集与多家长多子女", data: FULL },
  { id: "issues", label: "含问题示例", fileName: "示例_含问题.xlsx", desc: "部门引用缺失、主班主任冲突、学生不在父班、同名家长、无权职责、编号错误", data: WITH_ISSUES },
  { id: "rooms", label: "单表：教室", fileName: "示例_教室.xlsx", desc: "只有 06 教室，无课程/学生依赖", data: pick(["06"]) },
  { id: "staff-dept", label: "部门＋职务＋员工", fileName: "示例_部门职务员工.xlsx", desc: "同批引用，员工编号留空预览自动", data: pick(["04", "05", "11"]) },
  { id: "people-first", label: "分批①人员", fileName: "示例_分批1_人员.xlsx", desc: "先导入员工和学生", data: pick(["04", "05", "11", "12", "13"]) },
  { id: "teaching-later", label: "分批②教学关系", fileName: "示例_分批2_教学.xlsx", desc: "引用已有员工/学生，不重复上传", data: pick(["07", "19", "20", "21", "22", "23"]) },
  { id: "hrt", label: "员工无账号＋班主任任命", fileName: "示例_班主任任命.xlsx", desc: "资格与任命已登记，访问待开户", data: pick(["03", "11", "12", "13", "16", "17", "18"]) },
  { id: "teaching", label: "教学班：有学科无课程", fileName: "示例_教学班P1S1.xlsx", desc: "P1 继承、S1 指定子集", data: pick(["03", "07", "11", "12", "13", "19", "20", "21", "22", "23"]) },
  { id: "family", label: "多家长/多子女", fileName: "示例_家校关系.xlsx", desc: "引用已有学生；关系数与人数分开", data: pick(["14", "15"]) },
  {
    id: "numbering", label: "编号错误", fileName: "示例_编号错误.xlsx", desc: "格式、大小写、年月、已占用与本文件重复",
    data: {
      "13": [
        { id: "S01", name: "示例学生甲", firstDate: "2026-09-01", no: "TGS 202609041S", grade: "10年级" },
        { id: "S02", name: "示例学生乙", firstDate: "2026-09-01", no: "tgs202609042s", grade: "10年级" },
        { id: "S03", name: "示例学生丙", firstDate: "2026-09-01", no: "TGS202509043S", grade: "10年级" },
        { id: "S04", name: "示例学生丁", firstDate: "2026-09-01", no: "TGS202609044E", grade: "10年级" },
        { id: "S05", name: "示例学生戊", firstDate: "2026-09-01", no: "TGS202609001S", grade: "10年级" },
        { id: "S06", name: "示例学生己", firstDate: "2026-09-01", no: "TGS202609077S", grade: "10年级" },
        { id: "S07", name: "示例学生己", firstDate: "2026-09-01", no: "TGS202609077S", grade: "10年级" },
        { id: "S08", name: "示例学生庚", firstDate: "", no: "", grade: "10年级" },
        { id: "S09", name: "示例学生辛", firstDate: "2026-09-01", no: "", grade: "10年级" },
      ],
    },
  },
  {
    id: "existing", label: "已存在对象", fileName: "示例_已存在对象.xlsx", desc: "同名部门与已占用员工编号：复用或确认新建",
    data: {
      "03": [{ id: "TR01", year: "YR01", name: "第一学期", ...T1 }],
      "04": [{ id: "DEP01", name: "数学组", status: "启用" }],
      "11": [
        { id: "EMP01", name: "示例教职工甲", firstDate: "2026-09-01", no: "TGS202609001E", dept: "DEP01", title: "", email: "", phone: "" },
        { id: "EMP09", name: "示例教职工新", firstDate: "2026-09-01", no: "", dept: "DEP01", title: "", email: "", phone: "" },
      ],
    },
  },
  { id: "prep", label: "管理委派＋开户准备", fileName: "示例_开户准备.xlsx", desc: "只保存方案，不激活、不发邀请", data: pick(["11", "24", "25"]) },
  {
    id: "timetable", label: "学校课表（可选）", fileName: "示例_学校课表.xlsx", desc: "节次＋学校排课，导入为待确认学校版本",
    data: {
      "06": FULL["06"],
      "26": [
        { id: "PER1", name: "第1节", from: "08:00", to: "08:45" },
        { id: "PER2", name: "第2节", from: "08:55", to: "09:40" },
      ],
      "27": [
        { id: "SCH01", tc: "TC01", day: "周一", period: "PER1", room: "ROOM01", weeks: "每周" },
        { id: "SCH02", tc: "TC02", day: "周二", period: "PER2", room: "ROOM02", weeks: "单周" },
      ],
    },
  },
  {
    id: "old-version", label: "未支持版本", fileName: "示例_旧版本.xlsx", desc: "模板版本不被当前原型支持", data: pick(["04"]),
    info: { 模板版本: "WFB-IMPORT-2024-OLD" },
  },
]

export function sampleById(id: string) {
  return SAMPLES.find((s) => s.id === id)
}
