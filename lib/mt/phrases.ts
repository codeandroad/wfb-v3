import type { Attendance } from "./model"

/**
 * 常用内容（r3）：考勤原因与学生亮点的快捷文字。
 * - 系统项是本原型初始建议内容，不代表学校批准的请假政策。
 * - 个人项按教师隔离；实际学生记录保存当时选用 / 编辑后的文字，模板以后修改、停用或删除不改写已保存文字。
 */
export type PhraseKind = "REASON" | "HIGHLIGHT"

export interface Phrase {
  id: string
  kind: PhraseKind
  text: string
  /** 仅考勤原因：适用的出勤状态 */
  states?: Attendance[]
  /** 仅亮点：查找分类，不是评价维度 */
  category?: string
  system: boolean
}

export interface PersonalPhrase extends Phrase {
  system: false
  ownerId: string
  active: boolean
  order: number
  /** 由系统项另存而来时记录来源，系统原文不变 */
  fromSystemId?: string
}

export interface PhraseLib {
  items: PersonalPhrase[]
  favs: string[]
}

const R = (id: string, text: string, states: Attendance[]): Phrase => ({ id, kind: "REASON", text, states, system: true })
const H = (id: string, text: string, category: string): Phrase => ({ id, kind: "HIGHLIGHT", text, category, system: true })

export const SYSTEM_PHRASES: Phrase[] = [
  R("SR_LATE_TRAFFIC", "交通延误", ["LATE"]),
  R("SR_LATE_ACTIVITY", "上一项活动延时", ["LATE"]),
  R("SR_LATE_UNWELL", "临时身体不适", ["LATE"]),
  R("SR_LATE_ERRAND", "临时事务", ["LATE"]),
  R("SR_EARLY_UNWELL", "身体不适", ["EARLY_LEAVE", "LEAVE"]),
  R("SR_EARLY_MEDICAL", "就医安排", ["EARLY_LEAVE"]),
  R("SR_FAMILY", "家庭事务", ["EARLY_LEAVE", "LEAVE"]),
  R("SR_EARLY_SCHOOL", "校内其他安排", ["EARLY_LEAVE"]),
  R("SR_LEAVE_COMP", "校外比赛", ["LEAVE"]),
  R("SR_LEAVE_SCHOOL", "学校活动", ["LEAVE"]),
  R("SR_LEAVE_PERSONAL", "其他个人事务", ["LEAVE"]),
  R("SR_ABS_NORETURN", "已核实未返校", ["ABSENT"]),
  R("SR_ABS_TRAVEL", "行程延误", ["ABSENT"]),
  R("SR_ABS_EXPLAINED", "其他已说明原因", ["ABSENT"]),
  R("SR_ELSE_SWAP", "临时调班", ["ELSEWHERE"]),
  R("SR_ELSE_OTHER", "参加其他教学安排", ["ELSEWHERE"]),
  R("SR_ELSE_TUTOR", "补课／辅导", ["ELSEWHERE"]),
  R("SR_UNVERIFIED", "原因待核实", ["LATE", "EARLY_LEAVE", "LEAVE", "ABSENT"]),
  R("SR_OTHER", "其他", ["LATE", "EARLY_LEAVE", "ELSEWHERE"]),
  H("SH_EXPLAIN", "主动解释解题思路", "课堂参与"),
  H("SH_QUESTION", "提出了有价值的问题", "课堂参与"),
  H("SH_METHODS", "尝试了不同解法", "思维与表达"),
  H("SH_REASONING", "能够清楚说明推理依据", "思维与表达"),
  H("SH_CORRECT", "主动订正并解释错因", "学习习惯"),
  H("SH_CHECK", "认真核对关键步骤", "学习习惯"),
  H("SH_HELP", "帮助同伴理解知识点", "合作沟通"),
  H("SH_GROUP", "清楚展示小组讨论结果", "合作沟通"),
]

export const REASON_STATES: Attendance[] = ["LATE", "EARLY_LEAVE", "LEAVE", "ABSENT", "ELSEWHERE"]
export const PHRASE_MAX = 60

export function emptyLib(): PhraseLib {
  return { items: [], favs: [] }
}

/** 可选项：本人启用的个人项（收藏优先、按排序） + 系统项（收藏优先）；按状态过滤考勤原因 */
export function phraseOptions(lib: PhraseLib | undefined, kind: PhraseKind, state?: Attendance | null): { mine: Phrase[]; system: Phrase[] } {
  const l = lib ?? emptyLib()
  const fits = (p: Phrase) => p.kind === kind && (kind !== "REASON" || !state || !p.states?.length || p.states.includes(state))
  const favFirst = (a: Phrase, b: Phrase) => Number(l.favs.includes(b.id)) - Number(l.favs.includes(a.id))
  const mine = l.items.filter((p) => p.active && fits(p)).sort((a, b) => favFirst(a, b) || a.order - b.order)
  const system = SYSTEM_PHRASES.filter(fits).sort(favFirst)
  return { mine, system }
}

/** 原因是否适用于该状态：只按常用库判断；自由文字无法判断时视为可能适用（由教师复核） */
export function reasonFitsState(lib: PhraseLib | undefined, text: string, state: Attendance): boolean {
  const all = [...SYSTEM_PHRASES, ...(lib?.items ?? [])].filter((p) => p.kind === "REASON" && p.text === text)
  if (!all.length) return true
  return all.some((p) => !p.states?.length || p.states.includes(state))
}

export function cleanPhrase(text: string): string {
  return text.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, PHRASE_MAX)
}
