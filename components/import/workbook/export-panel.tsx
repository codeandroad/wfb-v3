"use client"

import { Badge, Card, CardHeader, Checkbox, Segmented, Select } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { addLog, newBatchId, nowText } from "@/lib/import/log-store"
import { parseFile, ParseFailure, type ParsedFile } from "@/lib/import/parse"
import { sampleById, type SampleData } from "@/lib/import/samples"
import { GROUPS, SHEETS, sheetTitle, TEMPLATE_VERSION, type GroupId, type SheetCode } from "@/lib/import/schema"
import { buildWorkbookBytes, downloadBytes } from "@/lib/import/workbook-out"
import { CURRENT_SCHOOL } from "@/lib/school/instance"
import { cn } from "@/lib/utils"
import { useRef, useState } from "react"
import { ExampleTag, Notice } from "./shared"

export type PackKind = "structure" | "full" | "demo"
type Scope = "school" | "restricted"

const PACKS: { id: PackKind; title: string; desc: string; limit: string }[] = [
  { id: "structure", title: "组织结构包（默认）", desc: "学年学期、部门、职务、教室、学科课程、行政班与教学班定义。", limit: "不含真实人员、名单和个人任命，不能完整恢复学校。" },
  { id: "full", title: "完整基础重建包（受控目标）", desc: "在结构包之上，加入获准的人员、联系、关系与任命。", limit: "需要敏感导出权限与加密配置；原型只展示条件，不启用真实敏感导出。" },
  { id: "demo", title: "脱敏演示包", desc: "合成或脱敏资料，用于测试与演示。", limit: "不能用于恢复原真实人员。" },
]

const STRUCTURE: SheetCode[] = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "16", "19"]
const PERSONAL_GROUPS: GroupId[] = ["people", "admin", "teaching", "family", "prep"]

function fullData() {
  return sampleById("full")!.data
}

export function ExportPanel({ initialPack, initialScope, initialMode }: { initialPack?: PackKind; initialScope?: Scope; initialMode?: "export" | "rebuild" }) {
  const [mode, setMode] = useState<"export" | "rebuild">(initialMode ?? "export")
  return (
    <div className="flex flex-col gap-4">
      <Segmented<"export" | "rebuild">
        ariaLabel="导出或重建"
        value={mode}
        onChange={setMode}
        options={[
          { value: "export", label: "导出" },
          { value: "rebuild", label: "从包重建" },
        ]}
      />
      {mode === "export" ? <ExportFlow key={`${initialPack}${initialScope}`} initialPack={initialPack} initialScope={initialScope} /> : <RebuildFlow />}
    </div>
  )
}

function ExportFlow({ initialPack, initialScope }: { initialPack?: PackKind; initialScope?: Scope }) {
  const [pack, setPack] = useState<PackKind>(initialPack ?? "structure")
  const [period, setPeriod] = useState("2026—2027学年 第一学期")
  const [groups, setGroups] = useState<GroupId[]>(["base", "catalog", "admin", "teaching"])
  const [scope, setScope] = useState<Scope>(initialScope ?? "school")
  const [permit, setPermit] = useState(false)
  const [encrypt, setEncrypt] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const personal = pack !== "structure"
  const needs = pack === "full"
  const blockedFull = needs && (!permit || !encrypt)
  const restrictedGaps =
    scope === "restricted" && personal
      ? [
          groups.includes("family") ? "兄弟姐妹与其他班学生的家长关系：无权读取，不纳入" : "",
          groups.includes("people") ? "全校教职工与学生：仅限本人任教班学生，其余不导出" : "",
          groups.includes("admin") ? "其他行政班名单：无权读取，标为不完整" : "",
        ].filter(Boolean)
      : []
  const deps = [
    groups.includes("teaching") && !groups.includes("people") ? "任教安排与教学名单依赖人员：结构包只保留教学班定义，名单与分工人员不含" : "",
    groups.includes("admin") && !groups.includes("people") ? "行政名单与班主任依赖人员：仅导出行政班定义" : "",
    groups.includes("family") && !groups.includes("people") ? "家校关系依赖学生：必须同时选择人员，或标为不完整" : "",
  ].filter(Boolean)

  const includes = SHEETS.filter((s) => s.role !== "instruction" && s.role !== "meta" && groups.includes(s.group) && (personal || STRUCTURE.includes(s.code)))

  const generate = () => {
    const src = fullData()
    const data: SampleData = Object.fromEntries(includes.map((s) => [s.code, src[s.code] ?? []]))
    const title = pack === "structure" ? "组织结构包" : pack === "full" ? "完整基础重建包（示例）" : "脱敏演示包"
    const bytes = buildWorkbookBytes(data, `${title}：原型本地预览产物，不是真实学校备份`, {
      模板版本: TEMPLATE_VERSION, 来源学校: `${CURRENT_SCHOOL.nameZh}（${CURRENT_SCHOOL.code}）· 内容为合成示例`, 来源期间: period,
      包类型: title, 快照时点: nowText(), 覆盖范围: includes.map((s) => s.code).join(","), 不完整项: restrictedGaps.join("；") || "无",
      不含: "密码、会话、旧邀请码、原始权限来源",
    })
    const name = `${CURRENT_SCHOOL.code}_${title}_${new Date().toISOString().slice(0, 10)}.xlsx`
    downloadBytes(bytes, name)
    const id = newBatchId("EXP")
    addLog({
      id, type: "export", status: restrictedGaps.length ? "partial" : "done", title, operator: scope === "restricted" ? "当前经办者（受限：本人任教班）" : "当前经办者（全校范围）",
      source: CURRENT_SCHOOL.nameZh, version: TEMPLATE_VERSION, scope: includes.map((s) => sheetTitle(s.code)).join("、"), startedAt: nowText(), endedAt: nowText(), period,
      plan: `${includes.length} 张表`, result: pack === "structure" ? "组织结构已导出（合成内容）" : "所选包已生成（示例）", errors: restrictedGaps, mappings: [],
      followUps: personal ? ["重建后账号需重新邀请"] : [], example: true, sessionCreated: true,
    })
    setDone(`${pack === "structure" ? "组织结构已导出" : "所选基础重建包已生成（示例）"}：${name}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        {PACKS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setPack(p.id)
              setDone(null)
              setGroups(p.id === "structure" ? ["base", "catalog", "admin", "teaching"] : ["base", "catalog", "people", "admin", "teaching", "family"])
            }}
            aria-pressed={pack === p.id}
            className={cn(
              "flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              pack === p.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
            )}
          >
            <span className="text-[14px] font-semibold">{p.title}</span>
            <span className="text-[13px] leading-relaxed text-muted-foreground">{p.desc}</span>
            <span className="text-xs leading-relaxed text-[#8a5a12]">{p.limit}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="导出范围与覆盖清单" desc="引用依赖明确可见；无权读取的内容标为不完整，不会默默补全" />
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap gap-4">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                期间
                <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-56">
                  <option>2026—2027学年 第一学期</option>
                  <option>2025—2026学年 第二学期</option>
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                经办者范围（示例）
                <Select value={scope} onChange={(e) => setScope(e.target.value as Scope)} className="w-56">
                  <option value="school">全校管理员</option>
                  <option value="restricted">受限：仅本人任教班</option>
                </Select>
              </label>
            </div>
            <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
              <legend className="mb-1 text-xs text-muted-foreground">数据分类</legend>
              {GROUPS.filter((g) => g.id !== "meta").map((g) => {
                const disabled = pack === "structure" && PERSONAL_GROUPS.includes(g.id) && g.id !== "admin" && g.id !== "teaching"
                return (
                  <span key={g.id} className={disabled ? "opacity-50" : ""}>
                    <Checkbox
                      checked={groups.includes(g.id) && !disabled}
                      onChange={(v) => !disabled && setGroups((x) => (v ? [...x, g.id] : x.filter((y) => y !== g.id)))}
                      label={g.label}
                    />
                  </span>
                )
              })}
            </fieldset>

            <div className="grid gap-3 md:grid-cols-2">
              <Box title={`包含项（${includes.length} 张表）`}>
                {includes.length ? includes.map((s) => sheetTitle(s.code)).join("、") : "未选择"}
              </Box>
              <Box title="缺少 / 不含">
                {pack === "structure" ? "人员、行政名单、教学名单、个人任命、家校关系；" : ""}
                密码、会话、旧邀请码、原始权限来源永不导出。
              </Box>
              <Box title="必须另备">照片、证件扫描等附件不在包内；学校徽标与品牌资源另行准备。</Box>
              <Box title="编号与账号">
                {personal ? "保留合法学生/员工编号与高水位；重建后全部账号需重新邀请。" : "不含人员编号；计数器状态不导出。"}
              </Box>
            </div>

            {deps.map((d) => (
              <Notice key={d} tone="info">{d}</Notice>
            ))}
            {restrictedGaps.length ? (
              <Notice tone="warning" title="范围缺口：包将标为不完整">
                <ul className="list-disc pl-5">{restrictedGaps.map((g) => <li key={g}>{g}</li>)}</ul>
              </Notice>
            ) : null}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {needs ? (
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                安全条件 <ExampleTag>静态示例</ExampleTag>
              </div>
              <Checkbox checked={permit} onChange={setPermit} label="经办者已获敏感导出权限（示例）" />
              <Checkbox checked={encrypt} onChange={setEncrypt} label="已配置导出加密（示例，v0 不实现加密）" />
              {blockedFull ? <Notice tone="danger">条件未满足：不能生成完整基础重建包。仍可改选组织结构包。</Notice> : <Notice tone="warning">包含人员与联系信息，仅用于受控目标学校。</Notice>}
            </Card>
          ) : null}
          <Button disabled={blockedFull || includes.length === 0} onClick={generate}>
            生成并下载{pack === "structure" ? "组织结构包" : pack === "full" ? "重建包（示例）" : "演示包"}
          </Button>
          {done ? <Notice tone="success">{done}。内容为合成数据，不是真实学校备份。</Notice> : null}
        </div>
      </div>
    </div>
  )
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted/40 px-3.5 py-2.5 text-[13px] leading-relaxed">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <span>{children}</span>
    </div>
  )
}

type Source = "same" | "other" | "file"

function RebuildFlow() {
  const [source, setSource] = useState<Source>("same")
  const [file, setFile] = useState<ParsedFile | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ran, setRan] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const srcSchool = source === "same" ? `${CURRENT_SCHOOL.nameZh}（${CURRENT_SCHOOL.code}）` : source === "other" ? "示例国际课程学校（EIS）" : file?.sourceSchool ?? "未声明"
  const srcVersion = source === "file" ? file?.version ?? "未声明" : TEMPLATE_VERSION
  const snapshot =
    source !== "file" ? "2026-09-20 18:00（示例）"
    : !file ? "未声明"
    : file.snapshotStatus === "ok" ? `${file.snapshotAt}（文件声明，待后端核验）`
    : file.snapshotStatus === "invalid" ? `无法识别「${file.snapshotAt}」，请用 YYYY-MM-DD HH:MM`
    : "文件未声明快照时点"
  const crossSchool = source === "other" || (source === "file" && !!file && !(file.sourceSchool ?? "").includes(CURRENT_SCHOOL.code))
  const unsupported = source === "file" && file?.versionStatus === "unsupported"
  const ready = source !== "file" || !!file
  const blocked = crossSchool || unsupported

  const data = fullData()
  const n = (c: SheetCode) => (source === "file" && file ? file.sheets.find((s) => s.code === c)?.rows.length ?? 0 : data[c]?.length ?? 0)
  const checks: [string, number, string][] = [
    ["教职工", n("11"), "编号按源值保留"],
    ["学生", n("13"), "编号按源值保留"],
    ["家长关系", n("15"), "关系数，与家长人数分开"],
    ["行政名单", n("17"), "正式/待确认分别核对"],
    ["教学父班名单", n("20"), "独立父名单"],
    ["分工模式", n("21"), "INHERIT / EXPLICIT_SUBSET 保持"],
    ["教师任命", n("18") + n("23"), "班主任＋任教安排"],
    ["需重新开户", n("11") + n("14"), "不恢复密码、会话、旧邀请"],
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader title="从包重建：预检" desc="目标是已安装并有首位管理员的学校，不是空服务器" />
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              导出包来源
              <Select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as Source)
                  setRan(false)
                }}
                className="w-60"
              >
                <option value="same">同校导出包（示例）</option>
                <option value="other">其他学校导出包（示例）</option>
                <option value="file">选择本地导出包文件</option>
              </Select>
            </label>
            {source === "file" ? (
              <>
                <input
                  ref={input}
                  type="file"
                  accept=".xlsx"
                  className="sr-only"
                  aria-label="选择导出包"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ""
                    if (!f) return
                    setRan(false)
                    try {
                      setFile(await parseFile(f))
                      setErr(null)
                    } catch (x) {
                      setFile(null)
                      setErr(x instanceof ParseFailure ? x.message : String(x))
                    }
                  }}
                />
                <Button variant="outline" onClick={() => input.current?.click()}>
                  {file ? `更换：${file.fileName}` : "选择 .xlsx 包"}
                </Button>
              </>
            ) : null}
          </div>
          {err ? <Notice tone="danger">{err}</Notice> : null}

          <dl className="grid grid-cols-2 gap-3 text-[13px] md:grid-cols-4">
            {[["源学校", srcSchool], ["目标学校", `${CURRENT_SCHOOL.nameZh}（${CURRENT_SCHOOL.code}）`], ["源版本", srcVersion], ["快照时点", snapshot]].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-medium">{ready ? v : "—"}</dd>
              </div>
            ))}
          </dl>

          {ready ? (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-[13px]">
              {[
                ["学年学期", crossSchool ? "冲突：来源不是同一逻辑学校" : "复用目标已有初始学期 2026—2027 第一学期", crossSchool],
                ["校名与编号前缀", `保留目标 ${CURRENT_SCHOOL.nameZh} / ${CURRENT_SCHOOL.code}，不被包覆盖`, false],
                ["当前学期与管理员", "保留目标当前学期与首位管理员", false],
                ["编号", crossSchool ? "阻断：不默认改号跨校" : "按合法源值保留，含保留编号与计数高水位；不默认全部重编", crossSchool],
                ["缺项", source === "file" && file ? `包内 ${file.sheets.filter((s) => s.code && !s.empty).length} 张表有数据，未含的表列入核对清单` : "照片附件、账号凭据不在包内", false],
              ].map(([k, v, bad]) => (
                <li key={k as string} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className={cn("text-right", bad && "font-medium text-[#9a2b22]")}>{v}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Notice tone="neutral">请选择导出包文件；读取后显示包声明的来源与版本。</Notice>
          )}

          {crossSchool && ready ? <Notice tone="danger" title="源与目标不是同一逻辑学校">不能直接重建。跨校迁移需另行办理，不会默认改号。</Notice> : null}
          {unsupported ? <Notice tone="danger">包的模板版本不受支持：{file?.version}</Notice> : null}
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Button
          disabled={!ready || blocked}
          onClick={() => {
            setRan(true)
            addLog({
              id: newBatchId("RBD"), type: "rebuild", status: "done", title: "从包重建", operator: "首位管理员（演示身份）", source: source === "file" ? file!.fileName : srcSchool,
              version: srcVersion, scope: checks.map((c) => c[0]).join("、"), startedAt: nowText(), endedAt: nowText(), period: "2026—2027学年 第一学期",
              plan: "预检通过后重建", result: "重建完成（结果示例，未写入真实学校）", errors: [], mappings: [], followUps: ["全部账号需重新邀请"], example: true, sessionCreated: true,
            })
          }}
        >
          开始重建
        </Button>
        {ran ? (
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              往返核对 <ExampleTag />
            </div>
            <ul className="flex flex-col gap-1.5 text-[13px]">
              {checks.map(([k, v, note]) => (
                <li key={k} className="flex items-start justify-between gap-2">
                  <span>
                    {k}
                    <span className="block text-[11px] text-muted-foreground">{note}</span>
                  </span>
                  <Badge tone={k === "需重新开户" ? "warning" : "success"}>
                    {k === "需重新开户" ? `${v} 人` : `源 ${v} · 目标 ${v}`}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">核对按对象与关系逐类比较，不只比总行数。完整学校恢复属于后续后端工作。</p>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
