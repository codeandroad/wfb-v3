// 对照示例数据：代表“目标学校可能已有的对象”。
// 未接后台时，只用于展示“引用已有”的交互，结论一律为待后端核验，不与上传内容合并。

import type { SheetCode } from "./schema"

export interface Candidate {
  id: string
  label: string
  context: string
  phone?: string
}

export const TARGET_SAMPLE: Partial<Record<SheetCode, Candidate[]>> = {
  "02": [{ id: "T-YR-2026", label: "2026—2027学年", context: "初始化学年 · 2026-09-01 至 2027-07-31" }],
  "03": [{ id: "T-TR-2026-1", label: "第一学期", context: "当前学期 · 2026-09-01 至 2027-01-29" }],
  "04": [
    { id: "T-DEP-MATH", label: "数学组", context: "已有部门 · 启用" },
    { id: "T-DEP-ACAD", label: "教务处", context: "已有部门 · 启用" },
  ],
  "05": [{ id: "T-JOB-TEACHER", label: "教师", context: "已有职务 · 启用" }],
  "06": [{ id: "T-ROOM-A201", label: "A201", context: "教学楼A" }],
  "07": [
    { id: "T-SUB-MATH", label: "数学", context: "目录学科" },
    { id: "T-SUB-CS", label: "计算机", context: "目录学科" },
  ],
  "08": [{ id: "T-COURSE-CIE-MATH", label: "CIE数学", context: "学科：数学 · 当前版本" }],
  "11": [
    { id: "T-EMP-1", label: "示例教职工甲", context: "员工编号 TGS202609001E · 数学组 · 已有账号", phone: "138****0001" },
    { id: "T-EMP-2", label: "示例教职工甲", context: "员工编号 TGS202402007E · 教务处 · 无账号", phone: "139****2210" },
  ],
  "13": [
    { id: "T-STU-1", label: "示例学生一", context: "学生编号 TGS202609010S · 10年级1班" },
    { id: "T-STU-2", label: "示例学生二", context: "学生编号 TGS202609011S · 10年级1班" },
    { id: "T-STU-3", label: "示例学生三", context: "学生编号 TGS202609012S · 10年级2班" },
  ],
  "14": [{ id: "T-GUA-1", label: "示例家长甲", context: "关联学生：示例学生一", phone: "137****5566" }],
  "16": [{ id: "T-AC-10-1", label: "10年级1班", context: "第一学期 · 正式" }],
  "12": [{ id: "T-Q-1", label: "任课资格 · 示例教职工甲", context: "TGS202609001E · 长期" }],
  "19": [{ id: "T-TC-MATH-A", label: "10年级数学A", context: "学科：数学 · 课程：空" }],
  "21": [{ id: "T-DIV-P1", label: "P1", context: "10年级数学A · INHERIT" }],
}

export const EXISTING_PREFIX = "@existing:"

export function candidateById(sheet: SheetCode, id: string) {
  return TARGET_SAMPLE[sheet]?.find((c) => c.id === id)
}
