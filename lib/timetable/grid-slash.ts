// TIMETABLE_GRID_SLASH_V1 — 词法参考实现（TypeScript 移植自 reference_parser/grid_slash.mjs）
//
// 仅做词法：把单元格文本按 ASCII "/" 拆成定位字段，保留 null，不做对象绑定/权限/XLSX 安全。
// 与 contract/parser_test_vectors.json 的 38 个向量保持一致。

export type GridView = "TEACHER" | "CLASS"
export type KindHint = "COURSE_CANDIDATE" | "ACTIVITY"

export class ParseError extends Error {
  code: string
  offset: number
  constructor(code: string, message: string, offset = 0) {
    super(message)
    this.name = "ParseError"
    this.code = code
    this.offset = offset
  }
}

const fail = (code: string, text: string, i = 0): never => {
  throw new ParseError(code, text, i)
}

const ws = (ch: string) => ch !== "\n" && /\s/u.test(ch)

interface Token {
  value: string
  quoted: boolean
}
interface RawRow {
  line: number
  tokens: Token[]
}

export function tokenizeCell(value: unknown): RawRow[] {
  if (value === null || value === undefined || value === "") return []
  if (typeof value !== "string") fail("CELL_NOT_TEXT", "安排格必须为文本；不得把公式缓存或数字猜成安排。", 0)
  const raw = value as string
  if (raw.length > 32767) fail("CELL_TOO_LONG", "单元格内容超限。", 0)
  const text = raw.replace(/\r\n?/g, "\n")
  if (!text.trim()) return []

  const rows: RawRow[] = []
  let fields: Token[] = []
  let buf = ""
  let quoted = false
  let state: "start" | "plain" | "quoted" | "closed" = "start"
  let line = 1
  let rowLine = 1

  function field() {
    fields.push({ value: quoted ? buf : buf.trim(), quoted })
    buf = ""
    quoted = false
    state = "start"
  }
  function row() {
    field()
    if (!(fields.length === 1 && !fields[0].quoted && fields[0].value === "")) rows.push({ line: rowLine, tokens: fields })
    fields = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (state === "quoted") {
      if (ch === "\n") fail("NEWLINE_IN_QUOTED_FIELD", "引号内不能嵌入硬换行；每行是一条安排。", i)
      if (ch === '"') {
        if (text[i + 1] === '"') {
          buf += '"'
          i++
        } else state = "closed"
      } else buf += ch
      continue
    }
    if (ch === "/" || ch === "\n") {
      if (ch === "/") field()
      else {
        row()
        line++
        rowLine = line
      }
      continue
    }
    if (state === "closed") {
      if (!ws(ch)) fail("CHAR_AFTER_QUOTE", "结束引号后只能是空白、分隔符或行尾。", i)
      continue
    }
    if (state === "start") {
      if (ws(ch)) continue
      if (ch === '"') {
        quoted = true
        state = "quoted"
        continue
      }
      state = "plain"
    }
    if (ch === '"') fail("QUOTE_IN_UNQUOTED_FIELD", "含双引号的字段须整体引用，并用两个双引号转义。", i)
    buf += ch
  }
  if (state === "quoted") fail("UNCLOSED_QUOTE", "双引号未闭合。", text.length)
  row()
  return rows
}

export interface ParsedRecord {
  view: GridView
  line: number
  kindHint: KindHint
  name: string
  unitGroupShortName: string | null
  teacherText: string | null
  locationText: string | null
  warnings: string[]
}

export type FieldOrder = "V1" | "LEGACY"

export function parseCell(value: unknown, view: GridView, order: FieldOrder = "V1"): ParsedRecord[] {
  if (!["TEACHER", "CLASS"].includes(view)) fail("VIEW_REQUIRED", "必须明确选择教师视角或班级视角。", 0)
  const limit = view === "TEACHER" ? 3 : 4
  return tokenizeCell(value).map(({ line, tokens }) => {
    const toks = tokens.map((t) => ({ ...t }))
    const warnings: string[] = []
    while (toks.length > 1 && !toks[toks.length - 1].quoted && toks[toks.length - 1].value === "") {
      toks.pop()
      if (!warnings.includes("TRAILING_EMPTY_OMITTED")) warnings.push("TRAILING_EMPTY_OMITTED")
    }
    if (toks.length > limit) fail("FIELD_COUNT", `当前${view}布局最多${limit}字段。`, line)
    for (let i = 0; i < toks.length; i++) {
      if (!toks[i].quoted && toks[i].value === "") fail("EMPTY_MIDDLE_FIELD", "中间空字段必须用 -，不能删空项后移动位置。", line)
      if (toks[i].quoted && toks[i].value === "") warnings.push("QUOTED_EMPTY_AS_NULL")
      if (toks[i].value.includes("／")) warnings.push("FULLWIDTH_SLASH_LITERAL")
    }
    const fields: (string | null)[] = toks.map((t) => ((!t.quoted && t.value === "-") || t.value === "" ? null : t.value))
    while (fields.length < limit) fields.push(null)
    if (fields[0] === null || !fields[0].trim()) fail("ARRANGEMENT_REQUIRED", "安排名称不能为空或 -。", line)
    let name = fields[0] as string
    let kindHint: KindHint = "COURSE_CANDIDATE"
    if (/^活动[:：]/u.test(name)) {
      kindHint = "ACTIVITY"
      name = name.replace(/^活动[:：]/u, "").trim()
    } else if (/^课程[:：]/u.test(name)) name = name.replace(/^课程[:：]/u, "").trim()
    if (!name) fail("ARRANGEMENT_REQUIRED", "类型前缀后必须有安排名称。", line)
    return {
      view,
      line,
      kindHint,
      name,
      ...(order === "V1"
        ? {
            // TEACHING_TARGET_GRID_V1：教师视角 名称/地点/分工；班级视角 名称/教师/地点/分工
            teacherText: view === "CLASS" ? fields[1] ?? null : null,
            locationText: (view === "CLASS" ? fields[2] : fields[1]) ?? null,
            unitGroupShortName: fields[limit - 1] ?? null,
          }
        : {
            // 旧版模板：教师视角 名称/分组/地点；班级视角 名称/分组/教师/地点
            unitGroupShortName: fields[1] ?? null,
            teacherText: view === "CLASS" ? fields[2] ?? null : null,
            locationText: fields[limit - 1] ?? null,
          }),
      warnings: [...new Set(warnings)],
    }
  })
}

function encode(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-"
  const s = String(value)
  if (s.includes("\n") || s.includes("\r")) fail("FIELD_NEWLINE", "字段中不能包含硬换行。", 0)
  return s === "-" || s.includes("/") || s.includes('"') || s !== s.trim() ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function serializeRecord(record: ParsedRecord, view: GridView = record.view): string {
  if (!["TEACHER", "CLASS"].includes(view)) fail("VIEW_REQUIRED", "未知布局。", 0)
  let name = record.name
  if (record.kindHint === "ACTIVITY") name = "活动:" + name
  else if (/^(活动|课程)[:：]/u.test(name)) name = "课程:" + name
  const fields =
    view === "TEACHER"
      ? [name, record.locationText, record.unitGroupShortName]
      : [name, record.teacherText, record.locationText, record.unitGroupShortName]
  while (fields.length > 1 && (fields[fields.length - 1] === null || fields[fields.length - 1] === undefined || fields[fields.length - 1] === "")) fields.pop()
  return fields.map(encode).join("/")
}

// 展示字段：仅在定位解析之后过滤 null / 空，保持 V1 顺序（教师: 名→地点→分工；班级: 名→教师→地点→分工）
export function displayFields(record: ParsedRecord, view: GridView = record.view): string[] {
  const a =
    view === "TEACHER"
      ? [record.name, record.locationText, record.unitGroupShortName]
      : [record.name, record.teacherText, record.locationText, record.unitGroupShortName]
  return a.filter((x): x is string => x !== null && x !== undefined && x !== "")
}
