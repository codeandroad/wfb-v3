// 本批文件内校验：必填、日期、枚举、编号格式、导入标识重复、表间引用与少量业务规则。
// 只检查本文件内能判断的内容；目标学校是否存在、编号是否被占用、操作者权限等保持“待后端核验”。

import { CURRENT_SCHOOL } from "@/lib/school/instance"
import { checkPersonNo, nextPersonNo, yyyymmOf } from "@/lib/school/person-no"
import { isRealDate, type ParsedFile, type ParsedSheet } from "./parse"
import { validBackgroundDate, workRangeInvalid } from "@/lib/school/staff-background"
import { idField, SHEET, sheetTitle, type FieldDef, type SheetCode, type SheetDef } from "./schema"
import { candidateById, EXISTING_PREFIX, TARGET_SAMPLE } from "./target-sample"

export type SheetState = "import" | "reference" | "skip"
export type Level = "block" | "pending" | "warn"
export type Fix = "edit" | "auto-no" | "match-existing" | "add-sheet" | "reference-sheet" | "exclude-row" | "confirm-new"

export interface Issue {
  id: string
  sheet: SheetCode
  rowKey?: string
  line?: number
  field?: string
  fieldLabel?: string
  cell?: string
  level: Level
  title: string
  detail: string
  fixes: Fix[]
  refSheet?: SheetCode
}

export type RowStatus = "block" | "pending" | "warn" | "ok" | "excluded"

export interface RowResult {
  key: string
  sheet: SheetCode
  line: number
  values: Record<string, string>
  original: Record<string, string>
  cols: Record<string, string>
  status: RowStatus
  action: string
  issues: Issue[]
  matched?: string
  reuse?: boolean
  numberPreview?: string
  numberSource?: string
  personId?: string
  edited: string[]
}

export interface SheetResult {
  code: SheetCode
  def: SheetDef
  parsed: ParsedSheet
  state: SheetState
  rows: RowResult[]
  sheetIssues: Issue[]
  counts: { block: number; pending: number; warn: number; ok: number; excluded: number }
}

export interface Plan {
  sheets: SheetResult[]
  fileIssues: Issue[]
  unknownSheets: ParsedSheet[]
  emptySheets: ParsedSheet[]
  metaSheets: ParsedSheet[]
  totals: {
    rows: number
    newObjects: number
    newRelations: number
    reuse: number
    externalRefs: number
    block: number
    pending: number
    warn: number
    excluded: number
  }
  key: string
}

export interface PlanInput {
  file: ParsedFile
  sheetState: Partial<Record<SheetCode, SheetState>>
  overrides: Record<string, string>
  excluded: string[]
}

export const rowKeyOf = (code: SheetCode, line: number) => `${code}#${line}`
export const overrideKey = (rowKey: string, field: string) => `${rowKey}|${field}`
export const MATCH_FIELD = "@match"
export const NEW_FIELD = "@new"

const SCHOOL = CURRENT_SCHOOL.code
const ALLOWED_DUTIES = ["学科教务", "年级事务", "课表维护", "学生档案维护"]

function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const aE = aEnd || "9999-12-31"
  const bE = bEnd || "9999-12-31"
  return aStart <= bE && bStart <= aE
}

export function defaultSheetState(file: ParsedFile, focus?: SheetCode[]): Partial<Record<SheetCode, SheetState>> {
  const out: Partial<Record<SheetCode, SheetState>> = {}
  const seen = new Set<SheetCode>()
  for (const s of file.sheets) {
    if (!s.code || seen.has(s.code)) continue
    seen.add(s.code)
    const role = SHEET[s.code].role
    if (role === "meta" || role === "instruction") continue
    if (s.empty) out[s.code] = "skip"
    else out[s.code] = focus && !focus.includes(s.code) ? "skip" : "import"
  }
  return out
}

export function buildPlan(input: PlanInput): Plan {
  const { file, sheetState, overrides } = input
  const excluded = new Set(input.excluded)
  const fileIssues: Issue[] = []
  const bySheet = new Map<SheetCode, ParsedSheet>()
  const unknownSheets: ParsedSheet[] = []
  const emptySheets: ParsedSheet[] = []
  const metaSheets: ParsedSheet[] = []

  for (const s of file.sheets) {
    if (!s.code) {
      if (s.empty) emptySheets.push(s)
      else {
        unknownSheets.push(s)
        fileIssues.push({
          id: `unknown:${s.rawName}`, sheet: "00", level: "warn", title: `未识别的工作表「${s.rawName}」含 ${s.rows.length} 行数据`,
          detail: "表名与表头都不属于本模板，本批不会导入。若应导入，请改用模板表名或列名后重新选择文件。", fixes: [],
        })
      }
      continue
    }
    const role = SHEET[s.code].role
    if (role === "meta" || role === "instruction") {
      metaSheets.push(s)
      continue
    }
    if (bySheet.has(s.code)) {
      fileIssues.push({
        id: `dup:${s.rawName}`, sheet: s.code, level: "warn", title: `工作表「${s.rawName}」与「${bySheet.get(s.code)!.rawName}」为同一类型`,
        detail: "同一类型只读取第一张，第二张不导入。请合并后重新选择文件。", fixes: [],
      })
      continue
    }
    if (s.empty) emptySheets.push(s)
    bySheet.set(s.code, s)
  }

  const stateOf = (code: SheetCode): SheetState | "absent" => (bySheet.has(code) ? (sheetState[code] ?? "skip") : "absent")

  // 应用本批修正值
  const rowValues = new Map<string, Record<string, string>>()
  for (const [code, s] of bySheet) {
    for (const r of s.rows) {
      const key = rowKeyOf(code, r.line)
      const v = { ...r.values }
      for (const f of [...SHEET[code].fields.map((x) => x.key), MATCH_FIELD, NEW_FIELD]) {
        const o = overrides[overrideKey(key, f)]
        if (o !== undefined) v[f] = o
      }
      rowValues.set(key, v)
    }
  }

  // 本批导入标识索引（仅导入中的表）
  const idIndex = new Map<SheetCode, Map<string, string>>()
  const excludedIds = new Map<SheetCode, Set<string>>()
  for (const [code, s] of bySheet) {
    const idf = idField(code)
    if (!idf || stateOf(code) !== "import") continue
    const m = new Map<string, string>()
    const ex = new Set<string>()
    for (const r of s.rows) {
      const key = rowKeyOf(code, r.line)
      const v = rowValues.get(key)![idf.key]
      if (!v) continue
      if (excluded.has(key)) ex.add(v)
      else if (!m.has(v)) m.set(v, key)
    }
    idIndex.set(code, m)
    excludedIds.set(code, ex)
  }
  const lookup = (code: SheetCode, id: string) => {
    const key = idIndex.get(code)?.get(id)
    return key ? rowValues.get(key) : undefined
  }

  const results: SheetResult[] = []
  let seq = 0
  const nid = () => `i${++seq}`
  const personNos = new Map<string, string[]>()
  const autoQueue: { row: RowResult; type: "S" | "E"; yyyymm: string }[] = []

  for (const [code, s] of bySheet) {
    const def = SHEET[code]
    const state = sheetState[code] ?? "skip"
    const sheetIssues: Issue[] = []
    if (s.missingRequired.length) {
      sheetIssues.push({
        id: nid(), sheet: code, level: "block", title: `缺少必填列：${s.missingRequired.join("、")}`,
        detail: `第 ${s.headerLine} 行表头中找不到这些列。请按模板补列后重新选择文件；原型不会猜测列含义。`, fixes: [],
      })
    }
    if (s.unknownCols.length) {
      sheetIssues.push({ id: nid(), sheet: code, level: "warn", title: `未识别列：${s.unknownCols.join("、")}`, detail: "这些列不属于本表字段，不会导入。", fixes: [] })
    }
    if (s.truncated) {
      sheetIssues.push({ id: nid(), sheet: code, level: "block", title: "超出原型处理上限", detail: "本表只读取了前 3000 行。请拆分为多批导入。", fixes: [] })
    }
    if (s.recognizedBy === "header") {
      sheetIssues.push({ id: nid(), sheet: code, level: "warn", title: `表名「${s.rawName}」按表头识别为 ${sheetTitle(code)}`, detail: "请确认识别正确；建议使用模板表名。", fixes: [] })
    }

    const rows: RowResult[] = []
    const seenIds = new Map<string, number>()
    const nameIds = new Map<string, string[]>()
    const pairSeen = new Map<string, number>()

    for (const r of s.rows) {
      const key = rowKeyOf(code, r.line)
      const values = rowValues.get(key)!
      const issues: Issue[] = []
      const edited = Object.keys(values).filter((k) => r.values[k] !== values[k])
      const push = (level: Level, field: FieldDef | null, title: string, detail: string, fixes: Fix[], refSheet?: SheetCode) =>
        issues.push({
          id: nid(), sheet: code, rowKey: key, line: r.line, field: field?.key, fieldLabel: field?.label,
          cell: field ? r.cols[field.key] : undefined, level, title, detail, fixes, refSheet,
        })

      const row: RowResult = {
        key, sheet: code, line: r.line, values, original: r.values, cols: r.cols, status: "ok", action: "", issues, edited,
      }

      if (state !== "import" || excluded.has(key)) {
        row.status = "excluded"
        row.action = excluded.has(key) ? "已明确排除，不导入" : state === "reference" ? "表改为引用已有，不新建" : "本表未选择导入"
        rows.push(row)
        continue
      }

      const matchId = values[MATCH_FIELD]
      if (matchId) {
        const c = candidateById(code, matchId)
        row.matched = c?.label ?? matchId
        row.reuse = true
      }

      for (const n of r.cellErrors) push("block", def.fields.find((x) => x.key === n.field) ?? null, "单元格无法读取", n.text, ["edit"])
      for (const n of r.notes) {
        if (/公式|数字格式/.test(n.text) && !edited.includes(n.field)) push("warn", def.fields.find((x) => x.key === n.field) ?? null, "单元格读取提示", n.text, ["edit"])
      }

      for (const fd of def.fields) {
        const v = values[fd.key] ?? ""
        if (v === "") {
          if (fd.required) push("block", fd, `${fd.label}为必填`, `第 ${r.line} 行「${fd.label}」为空。`, ["edit", "exclude-row"])
          continue
        }
        if (fd.kind === "date" && !isRealDate(v)) push("block", fd, "日期格式错误", `「${v}」不是有效日期，应为 YYYY-MM-DD 的真实日期。`, ["edit"])
        if (fd.kind === "month" && !yyyymmOf(v)) push("block", fd, "年月格式错误", "请填写真实 YYYY-MM 年月；已有准确具体日期可保留。", ["edit"])
        if (fd.kind === "partialDate" && !validBackgroundDate(v)) push("block", fd, "时间格式错误", "请填写年份或年月，不补造日期。", ["edit"])
        if (fd.kind === "time" && !/^\d{2}:\d{2}$/.test(v)) push("block", fd, "时间格式错误", `「${v}」应为 HH:MM。`, ["edit"])
        if (fd.kind === "enum" && fd.options && !fd.options.includes(v)) push("block", fd, "不是合法选项", `「${v}」不在可选项中：${fd.options.join(" / ")}。`, ["edit"])
        if (fd.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) push("warn", fd, "邮箱格式可疑", `「${v}」看起来不是有效邮箱；仅作联系字段，不用于合并身份。`, ["edit"])
        if (fd.kind === "phone" && !/^[0-9+\-\s()]{6,20}$/.test(v)) push("warn", fd, "电话格式可疑", `「${v}」包含非号码字符。`, ["edit"])
        if (fd.kind === "id") {
          const first = seenIds.get(v)
          if (first !== undefined) push("block", fd, "导入标识重复", `「${v}」已在第 ${first} 行使用。导入标识只在本文件内区分对象，不是学号或工号。`, ["edit", "exclude-row"])
          else seenIds.set(v, r.line)
        }
        if (fd.kind === "ref" && fd.ref) {
          if (v.startsWith(EXISTING_PREFIX)) {
            const c = candidateById(fd.ref, v.slice(EXISTING_PREFIX.length))
            push("pending", fd, "已选择目标学校已有对象", `选用「${c?.label ?? v}」（对照示例数据）。是否仍存在、操作者是否可引用，需后端核验。`, ["edit"], fd.ref)
            continue
          }
          const st = stateOf(fd.ref)
          const refName = sheetTitle(fd.ref)
          if (st === "import") {
            if (lookup(fd.ref, v)) continue
            if (excludedIds.get(fd.ref)?.has(v)) push("block", fd, "引用的行已被排除", `「${v}」在 ${refName} 中已被明确排除，本行依赖它。`, ["edit", "match-existing", "exclude-row"], fd.ref)
            else push("block", fd, `引用不存在：${v}`, `本文件已提供 ${refName}，但其中没有「${v}」。请修正、改为匹配已有对象或排除本行；不会自动置空。`, ["edit", "match-existing", "exclude-row"], fd.ref)
          } else if (st === "skip") {
            push("block", fd, `依赖表已取消：${refName}`, `本文件包含 ${refName}，但当前未选择导入，「${v}」无法解析。可补选该表、改为引用已有或排除本行。`, ["add-sheet", "reference-sheet", "exclude-row"], fd.ref)
          } else {
            const hint = TARGET_SAMPLE[fd.ref]?.length ? "可从对照示例候选中选择。" : ""
            push(
              "pending", fd, st === "reference" ? "已改为引用已有，待匹配" : "本文件未提供，待匹配已有对象",
              `「${v}」不在本文件中，不等于系统里不存在。${hint}需后端核验目标学校中的对象。`, ["match-existing", "edit", "exclude-row"], fd.ref,
            )
          }
        }
      }

      // 日期区间
      const start = values.start ?? values.firstDate
      if (values.end && start && isRealDate(values.end) && isRealDate(start) && values.end < start) {
        push("block", def.fields.find((x) => x.key === "end") ?? null, "结束日期早于开始日期", `${start} 至 ${values.end} 不是有效期间。`, ["edit"])
      }

      // 人员编号
      const noField = def.fields.find((x) => x.kind === "personNo")
      if (noField && !row.reuse) {
        const type = noField.personType!
        const no = values.no ?? ""
        const date = values.firstDate ?? ""
        if (!no.trim()) {
          if (values.numberIntent === "自动生成") {
            const ym = yyyymmOf(date)
            if (ym) autoQueue.push({ row, type, yyyymm: ym })
            else push("block", noField, `请填写首次${type === "E" ? "入职" : "入学"}年月`, "自动生成只读取本校首次年月；也可改为暂不编号。", ["edit"])
          } else if (values.numberIntent === "手工填写") push("block", noField, "未填写编号", "请填写合法编号或改为暂不编号。", ["edit"])
        } else {
          const c = checkPersonNo(no, type, yyyymmOf(date) ? date : undefined)
          if (c.status === "invalid") {
            if (c.issue === "conflict") push("block", noField, "编号已存在", `${c.detail} 若是同一人请引用已有；若确为新人员，请改为自动编号。`, ["match-existing", "confirm-new"])
            else push("block", noField, c.title, c.detail, ["edit", "auto-no", "exclude-row"])
          } else if (c.status === "valid") {
            if (c.monthMismatch) push("block", noField, "编号年月与日期不符", `编号年月 ${c.yyyymm} 与${noField.personType === "S" ? "首次正式入学" : "首次正式入职"}日期 ${date} 不一致。`, ["edit", "auto-no"])
            const list = personNos.get(no) ?? []
            list.push(key)
            personNos.set(no, list)
          }
        }
      }

      if (code === "11" && workRangeInvalid(values.workStart, values.workEnd)) push("block", def.fields.find((field) => field.key === "workEnd") ?? null, "结束时间早于开始时间", "请修正对应的过往工作经历。", ["edit"])

      // 同名不同身份
      if ((code === "11" || code === "13" || code === "14") && values.name) {
        const list = nameIds.get(values.name) ?? []
        list.push(values.id ?? "")
        nameIds.set(values.name, list)
        if (list.length > 1 && values[NEW_FIELD] !== "1") {
          push("warn", def.fields.find((x) => x.key === "name") ?? null, code === "14" ? "同名家长不同身份" : "同名不同身份",
            `本文件中有 ${list.length} 行姓名均为「${values.name}」且导入标识不同（${list.join("、")}）。不会按姓名、电话或邮箱自动合并；请确认确为不同人，或排除重复行。`,
            ["confirm-new", "exclude-row", "edit"])
        }
      }

      // 目标学校可能已有同名对象（对照示例）
      const cand = TARGET_SAMPLE[code]?.find((c) => c.label === values.name)
      if (cand && !row.reuse && ["02", "03", "04", "05", "06", "07", "08"].includes(code)) {
        if (code === "02" || code === "03") {
          row.reuse = true
          row.matched = cand.label
          push("pending", null, "准确复用目标已有期间", `对照示例中目标学校已有「${cand.label}」（${cand.context}）。准确复用，不改变当前${code === "02" ? "学年" : "学期"}；需后端核验日期一致。`, [])
        } else if (values[NEW_FIELD] !== "1") {
          push("warn", def.fields.find((x) => x.key === "name") ?? null, "目标学校可能已有同名对象", `对照示例中已有「${cand.label}」（${cand.context}）。可改为复用已有，或确认本批新建。`, ["match-existing", "confirm-new"])
        }
      }

      // 业务规则
      if (code === "17" && values.state === "正式" && values.student) {
        const pair = `${values.klass}|${values.student}`
        if (pairSeen.has(pair)) push("block", null, "行政名单关系重复", `与第 ${pairSeen.get(pair)} 行重复；同一关系只建立一次。`, ["exclude-row"])
        else pairSeen.set(pair, r.line)
        for (const other of rows) {
          if (other.status === "excluded") continue
          const o = other.values
          if (o.student === values.student && o.klass !== values.klass && o.state === "正式" && overlap(values.start, values.end, o.start, o.end)) {
            push("block", def.fields.find((x) => x.key === "klass") ?? null, "正式行政班冲突", `${values.student} 在第 ${other.line} 行已属正式行政班 ${o.klass}，期间重叠。导入不是调班命令。`, ["edit", "exclude-row"])
          }
        }
      }
      if (code === "18") {
        const q = values.qual ? lookup("12", values.qual) : undefined
        if (q && q.staff !== values.staff) push("block", def.fields.find((x) => x.key === "qual") ?? null, "资格不属于该员工", `资格 ${values.qual} 属于 ${q.staff}，不是 ${values.staff}。`, ["edit"])
        if (q && q.kind !== "班主任资格") push("block", def.fields.find((x) => x.key === "qual") ?? null, "资格类型不符", `班主任任命需要“班主任资格”，${values.qual} 为“${q.kind}”。`, ["edit"])
        if (values.role === "主") {
          const clash = rows.find((o) => o.status !== "excluded" && o.values.klass === values.klass && o.values.role === "主" && overlap(values.start, values.end, o.values.start, o.values.end))
          if (clash) push("block", def.fields.find((x) => x.key === "role") ?? null, "主班主任冲突", `${values.klass} 在第 ${clash.line} 行已有同期主班主任 ${clash.values.staff}。同时最多一位主班主任，可有多位辅助。`, ["edit", "exclude-row"])
        }
        if (!q && values.qual && !values.qual.startsWith(EXISTING_PREFIX) && stateOf("12") !== "import") {
          // 资格来自已有对象时由后端核验
        }
        push("pending", null, "任命办理权限待核验", "文件不是授权证明。需要后端确认经办者有权办理班主任任命；员工无账号时登记为“访问待开户”。", [])
      }
      if (code === "20" && values.tc && values.student) {
        const pair = `${values.tc}|${values.student}`
        if (pairSeen.has(pair)) push("block", null, "父名单关系重复", `与第 ${pairSeen.get(pair)} 行重复。`, ["exclude-row"])
        else pairSeen.set(pair, r.line)
      }
      if (code === "22" && values.div) {
        const d = lookup("21", values.div)
        if (d && d.mode !== "EXPLICIT_SUBSET") push("block", def.fields.find((x) => x.key === "div") ?? null, "继承分工不写指定名单", `${values.div} 为 INHERIT，直接跟随父教学班名单，不展开固定写入。`, ["edit", "exclude-row"])
        if (d && d.mode === "EXPLICIT_SUBSET" && values.student) {
          if (stateOf("20") === "import") {
            const inParent = [...(bySheet.get("20")?.rows ?? [])].some((pr) => {
              const pv = rowValues.get(rowKeyOf("20", pr.line))!
              return !excluded.has(rowKeyOf("20", pr.line)) && pv.tc === d.tc && pv.student === values.student
            })
            if (!inParent) push("block", def.fields.find((x) => x.key === "student") ?? null, "学生不在父教学班名单", `${values.student} 不在 ${d.tc} 的父名单（20_教学班学生）中；指定子集只能选父班合法学生。`, ["edit", "exclude-row"], "20")
          } else {
            push("pending", null, "父名单未随本批提供", `无法在文件内确认 ${values.student} 属于 ${d.tc} 的父名单，需后端核验。`, ["add-sheet"], "20")
          }
        }
      }
      if (code === "23") {
        if (values.target === "整科" && values.div) push("block", def.fields.find((x) => x.key === "div") ?? null, "整科目标不填分工", "目标类型为整科时分工引用应为空。", ["edit"])
        if (values.target === "分工" && !values.div) push("block", def.fields.find((x) => x.key === "div") ?? null, "分工目标缺少分工引用", "目标类型为分工时必须填写分工引用。", ["edit"])
        const d = values.div ? lookup("21", values.div) : undefined
        if (d && d.tc !== values.tc) push("block", def.fields.find((x) => x.key === "div") ?? null, "分工不属于该教学班", `${values.div} 属于 ${d.tc}，不是 ${values.tc}。`, ["edit"])
        const q = values.qual ? lookup("12", values.qual) : undefined
        if (q && q.kind !== "任课资格") push("block", def.fields.find((x) => x.key === "qual") ?? null, "资格类型不符", `任教安排需要“任课资格”，${values.qual} 为“${q.kind}”。`, ["edit"])
        if (q && q.staff !== values.staff) push("block", def.fields.find((x) => x.key === "qual") ?? null, "资格不属于该员工", `资格 ${values.qual} 属于 ${q.staff}。`, ["edit"])
        push("pending", null, "任命办理权限待核验", "需要后端确认经办者可办理该任教安排；多教师按多行登记，不自动以首行为负责人。", [])
      }
      if (code === "24") {
        if (values.duty && !ALLOWED_DUTIES.includes(values.duty)) {
          push("block", def.fields.find((x) => x.key === "duty") ?? null, "无权安排的职责", `「${values.duty}」不是已实现、可由当前经办者授予的事项（可选：${ALLOWED_DUTIES.join("、")}）。文件写了职责不等于获得授权。`, ["edit", "exclude-row"])
        } else push("pending", null, "委派权限待核验", "需要后端确认经办者有权授予；不影响最后管理员。", [])
      }
      if (code === "25") {
        if (values.role === "管理员") push("warn", def.fields.find((x) => x.key === "role") ?? null, "拟增管理员角色", "仅记录开户方案；须在账号与权限由有权者办理。不会覆盖或撤销当前初始管理员。", [])
      }
      if (code === "01") push("pending", null, "对照目标学校信息", "不覆盖目标校名、编号前缀、当前学期或管理员；显示信息差异需后端核验。", [])

      if (row.reuse && matchId) push("pending", null, "复用目标已有对象", `本行不新建，复用「${row.matched}」（对照示例），需后端核验。`, ["edit"])

      row.status = issues.some((i) => i.level === "block") ? "block" : issues.some((i) => i.level === "pending") ? "pending" : issues.some((i) => i.level === "warn") ? "warn" : "ok"
      row.action = actionText(def, row)
      rows.push(row)
    }

    results.push({ code, def, parsed: s, state, rows, sheetIssues, counts: { block: 0, pending: 0, warn: 0, ok: 0, excluded: 0 } })
  }

  // 文件内编号重复
  for (const [no, keys] of personNos) {
    if (keys.length < 2) continue
    for (const k of keys) {
      const row = results.flatMap((s) => s.rows).find((r) => r.key === k)!
      const others = keys.filter((x) => x !== k).map((x) => x.split("#")[1])
      row.issues.push({
        id: nid(), sheet: row.sheet, rowKey: k, line: row.line, field: "no", fieldLabel: SHEET[row.sheet].fields.find((f) => f.key === "no")?.label,
        cell: row.cols.no, level: "block", title: "本文件内编号重复", detail: `${no} 同时出现在第 ${others.join("、")} 行。可能是同一人重复录入；自动编号不能消除重复人员，请修正或排除。`, fixes: ["edit", "exclude-row"],
      })
      row.status = "block"
      row.action = actionText(SHEET[row.sheet], row)
    }
  }

  // 自动编号预览（不占号）
  const used = new Set(personNos.keys())
  for (const q of autoQueue) {
    try {
      const candidate = nextPersonNo(q.type, q.yyyymm, used)
      used.add(candidate)
      q.row.numberPreview = candidate
    } catch (error) {
      q.row.issues.push({ id: nid(), sheet: q.row.sheet, rowKey: q.row.key, line: q.row.line, field: "no", level: "block", title: "无法生成编号", detail: error instanceof Error ? error.message : "请检查号段。", fixes: ["edit"] })
      q.row.status = "block"
    }
    q.row.action = actionText(SHEET[q.row.sheet], q.row)
  }

  const totals = { rows: 0, newObjects: 0, newRelations: 0, reuse: 0, externalRefs: 0, block: 0, pending: 0, warn: 0, excluded: 0 }
  const externals = new Set<string>()
  for (const s of results) {
    for (const r of s.rows) {
      totals.rows++
      s.counts[r.status]++
      if (r.status === "excluded") {
        totals.excluded++
        continue
      }
      for (const i of r.issues) {
        totals[i.level]++
        if (i.refSheet && i.level === "pending" && i.field) externals.add(`${i.refSheet}:${r.values[i.field]}`)
      }
      if (r.status === "block") continue
      if (r.reuse) totals.reuse++
      else if (s.def.role === "object") totals.newObjects++
      else if (s.def.role === "relation") totals.newRelations++
    }
    for (const i of s.sheetIssues) if (s.state === "import") totals[i.level]++
  }
  for (const i of fileIssues) totals[i.level]++
  totals.externalRefs = externals.size

  return {
    sheets: results.sort((a, b) => a.code.localeCompare(b.code)),
    fileIssues,
    unknownSheets,
    emptySheets,
    metaSheets,
    totals,
    key: `${file.fingerprint}|${JSON.stringify(sheetState)}|${JSON.stringify(overrides)}|${input.excluded.join(",")}`,
  }
}

function actionText(def: SheetDef, row: RowResult) {
  if (row.status === "block") return "阻断，需处理"
  if (row.reuse) return `复用已有：${row.matched}`
  if (def.role === "school") return "对照目标学校（不覆盖）"
  if (def.code === "25") return "开户准备（不激活、不发邀请）"
  if (def.code === "27") return "待确认学校课表版本"
  const noun = def.name
  if (def.role === "relation") return `拟新增${noun}`
  if (row.numberPreview) return `拟新增${noun} · 预览编号 ${row.numberPreview}`
  return `拟新增${noun}${(def.code === "11" || def.code === "13") && !row.values.no?.trim() ? " · 待编号" : ""}`
}

export function dependencyImpact(plan: Plan, code: SheetCode) {
  const out: { sheet: SheetCode; rows: number }[] = []
  for (const s of plan.sheets) {
    if (s.code === code) continue
    const refFields = s.def.fields.filter((f) => f.ref === code)
    if (!refFields.length) continue
    const n = s.rows.filter((r) => refFields.some((f) => r.values[f.key] && !r.values[f.key].startsWith(EXISTING_PREFIX))).length
    if (n) out.push({ sheet: s.code, rows: n })
  }
  return out
}

export function displayValue(v: string | undefined, ref?: SheetCode) {
  if (!v) return ""
  if (v.startsWith(EXISTING_PREFIX) && ref) return `已有·${candidateById(ref, v.slice(EXISTING_PREFIX.length))?.label ?? v}`
  return v
}
