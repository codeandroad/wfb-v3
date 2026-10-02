// 操作记录：静态示例记录 + 本会话内产生的批次（仅内存，不持久化，不代表正式后台记录）。

import { useSyncExternalStore } from "react"

export type LogType = "import" | "export" | "rebuild"
export type LogStatus = "done" | "failed" | "pending" | "partial"

export interface LogRecord {
  id: string
  type: LogType
  status: LogStatus
  title: string
  operator: string
  source: string
  version: string
  scope: string
  startedAt: string
  endedAt: string
  period: string
  plan: string
  result: string
  errors: string[]
  mappings: string[]
  followUps: string[]
  fingerprint?: string
  example: boolean
  sessionCreated?: boolean
}

const STATIC: LogRecord[] = [
  {
    id: "BATCH-20260902-001", type: "import", status: "done", title: "人员与基础选项", operator: "林老师（教务管理员）",
    source: "人员基础_2026秋.xlsx", version: "WFB-IMPORT-PROTO-1.1", scope: "04 部门、05 职务、11 教职工", startedAt: "2026-09-02 09:12", endedAt: "2026-09-02 09:13",
    period: "2026—2027学年 第一学期", plan: "新增 2 个部门、2 个职务、4 名教职工", result: "完成（结果示例）", errors: [],
    mappings: ["EMP01 → TGS202609001E", "EMP02 → TGS202609002E"], followUps: ["4 名教职工待开户"], fingerprint: "demo-done-001", example: true,
  },
  {
    id: "BATCH-20260905-002", type: "import", status: "failed", title: "教学组织", operator: "林老师（教务管理员）",
    source: "教学组织_v2.xlsx", version: "WFB-IMPORT-PROTO-1.1", scope: "19—23", startedAt: "2026-09-05 14:02", endedAt: "2026-09-05 14:02",
    period: "2026—2027学年 第一学期", plan: "新增 3 个教学班、5 条分工", result: "当前批失败，未写本批业务；前一批数据保持（结果示例）",
    errors: ["21_教学分工 第 4 行：分工引用的教学班 TC09 不存在"], mappings: [], followUps: ["修正后重新预览"], example: true,
  },
  {
    id: "EXPORT-20260910-001", type: "export", status: "done", title: "组织结构包", operator: "林老师（教务管理员）",
    source: "当前学校（示例）", version: "WFB-EXPORT-PROTO-1.1", scope: "02—10、16、19、21（不含人员）", startedAt: "2026-09-10 10:00", endedAt: "2026-09-10 10:00",
    period: "2026—2027学年 第一学期", plan: "导出组织结构", result: "组织结构已导出（示例）", errors: [], mappings: [],
    followUps: ["不含人员、名单与任命，不能完整恢复学校"], example: true,
  },
  {
    id: "REBUILD-20260912-001", type: "rebuild", status: "partial", title: "同校新安装重建", operator: "初始管理员（目标校）",
    source: "完整基础重建包_20260910", version: "WFB-EXPORT-PROTO-1.1", scope: "01—25", startedAt: "2026-09-12 16:20", endedAt: "2026-09-12 16:24",
    period: "2026—2027学年 第一学期", plan: "复用初始学期，保留目标管理员", result: "基础已重建，12 名人员待重新开户（结果示例）", errors: [],
    mappings: ["编号按源值保留 · 高水位 TGS202609 → 007"], followUps: ["人员重新开户", "学校课表待确认版本"], example: true,
  },
]

let session: LogRecord[] = []
const listeners = new Set<() => void>()
let snapshot: LogRecord[] = [...STATIC]

function emit() {
  snapshot = [...session, ...STATIC]
  for (const l of listeners) l()
}

export function addLog(r: LogRecord) {
  session = [r, ...session.filter((x) => x.id !== r.id)]
  emit()
}

export function updateLog(id: string, patch: Partial<LogRecord>) {
  session = session.map((x) => (x.id === id ? { ...x, ...patch } : x))
  emit()
}

export function findByFingerprint(fp: string) {
  return snapshot.find((r) => r.fingerprint === fp && r.type === "import" && (r.status === "done" || r.status === "pending"))
}

export function useLogs() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
    () => snapshot,
  )
}

export function newBatchId(prefix = "BATCH") {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false }).slice(0, 16)
}
