"use client"

import { Card, CardHeader, Checkbox, Select } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { addLog, newBatchId, nowText, type LogRecord } from "@/lib/import/log-store"
import type { ParsedFile } from "@/lib/import/parse"
import { sheetTitle, TEMPLATE_VERSION } from "@/lib/import/schema"
import { EXISTING_PREFIX } from "@/lib/import/target-sample"
import type { Plan } from "@/lib/import/validate"
import { useState } from "react"
import { ExampleTag, Notice } from "./shared"

export type ResultKind = "done" | "failed" | "pending"

export function StepConfirm({
  file, plan, completed, onBack, onDone, onOpenLog,
}: {
  file: ParsedFile
  plan: Plan
  completed?: LogRecord
  onBack: () => void
  onDone: (k: ResultKind, batchId: string) => void
  onOpenLog: (id: string) => void
}) {
  const [kind, setKind] = useState<ResultKind>("done")
  const [stale, setStale] = useState(false)
  const [staleHit, setStaleHit] = useState(false)
  const [selfCheck, setSelfCheck] = useState(false)
  const s = (code: string) => plan.sheets.find((x) => x.code === code && x.state === "import")
  const live = (code: string) => s(code)?.rows.filter((r) => r.status !== "excluded" && r.status !== "block") ?? []

  const groups = plan.sheets
    .filter((x) => x.state === "import")
    .map((x) => {
      const rows = x.rows.filter((r) => r.status !== "excluded")
      return { code: x.code, name: sheetTitle(x.code), unit: x.def.unit, create: rows.filter((r) => !r.reuse && r.status !== "block").length, reuse: rows.filter((r) => r.reuse).length, block: rows.filter((r) => r.status === "block").length, excluded: x.counts.excluded }
    })

  const roster = live("17")
  const divs = live("21")
  const hrt = live("18")
  const ta = live("23")
  const staff = live("11").filter((r) => !r.reuse)
  const prep = live("25")
  const accessChanges = [...hrt, ...ta, ...live("24")].filter((r) => r.values.staff?.startsWith(EXISTING_PREFIX) || (r.values.staff && !s("11")))
  const blocked = plan.totals.block > 0
  const alreadyDone = !!completed

  const confirm = () => {
    if (stale) {
      setStaleHit(true)
      return
    }
    const id = newBatchId()
    const mappings = plan.sheets.flatMap((x) => x.rows.filter((r) => r.numberPreview).map((r) => `${r.values.id} → ${r.numberPreview}（示例）`))
    addLog({
      id, type: "import", status: kind === "done" ? "done" : kind === "failed" ? "failed" : "pending",
      title: plan.sheets.filter((x) => x.state === "import").map((x) => x.def.name).slice(0, 4).join("、") + (groups.length > 4 ? " 等" : ""),
      operator: "当前经办者（演示身份）", source: file.fileName, version: file.version ?? TEMPLATE_VERSION,
      scope: groups.map((g) => g.name).join("、"), startedAt: nowText(), endedAt: kind === "pending" ? "—" : nowText(),
      period: file.sourcePeriod ?? "未声明", plan: `新增对象 ${plan.totals.newObjects}、关系 ${plan.totals.newRelations}、复用 ${plan.totals.reuse}`,
      result: kind === "done" ? "完成（结果示例，未写入真实学校）" : kind === "failed" ? "当前批失败，未写本批业务（结果示例）" : "结果待查询（示例）",
      errors: kind === "failed" ? ["后端事务失败示例：本批全部未写入"] : [], mappings,
      followUps: [staff.length ? `${staff.length} 名教职工待开户` : "", live("27").length ? "学校课表待确认版本" : ""].filter(Boolean),
      fingerprint: kind === "failed" ? undefined : file.fingerprint, example: true, sessionCreated: true,
    })
    onDone(kind, id)
  }

  return (
    <div className="flex flex-col gap-4">
      {staleHit ? (
        <Notice tone="danger" title="旧计划已不可用">
          预览之后目标数据或经办者权限已变化（示例），本计划不能再提交。请返回重新校验生成新计划；不会沿用旧计划部分提交。
          <div className="mt-2">
            <Button
              size="sm"
              onClick={() => {
                setStale(false)
                setStaleHit(false)
                onBack()
              }}
            >
              返回重新校验
            </Button>
          </div>
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="确认导入" desc={`${file.fileName} · 计划基于当前修正与选表生成`} />
          <div className="flex flex-col gap-4 p-5">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[520px] text-[13px]">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">工作表</th>
                    <th className="px-3 py-2 text-right font-medium">新增</th>
                    <th className="px-3 py-2 text-right font-medium">复用</th>
                    <th className="px-3 py-2 text-right font-medium">阻断</th>
                    <th className="px-3 py-2 text-right font-medium">排除</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.code} className="border-t border-border">
                      <td className="px-3 py-2">{g.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {g.create} <span className="text-xs text-muted-foreground">{g.unit}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.reuse}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${g.block ? "font-medium text-[#9a2b22]" : ""}`}>{g.block}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{g.excluded}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
              {roster.length ? <Item k="行政名单" v={`正式 ${roster.filter((r) => r.values.state === "正式").length} · 待确认 ${roster.filter((r) => r.values.state === "待确认").length}`} /> : null}
              {divs.length ? <Item k="教学分工" v={`INHERIT ${divs.filter((r) => r.values.mode === "INHERIT").length}（跟随父名单） · EXPLICIT_SUBSET ${divs.filter((r) => r.values.mode === "EXPLICIT_SUBSET").length}（指定子集 ${live("22").length} 人次）`} /> : null}
              {hrt.length ? <Item k="班主任任命" v={`主 ${hrt.filter((r) => r.values.role === "主").length} · 辅助 ${hrt.filter((r) => r.values.role === "辅助").length} · ${periods(hrt)}`} /> : null}
              {ta.length ? <Item k="任教安排" v={`整科 ${ta.filter((r) => r.values.target === "整科").length} · 分工 ${ta.filter((r) => r.values.target === "分工").length} · ${periods(ta)}`} /> : null}
              {live("24").length ? <Item k="管理委派" v={`${live("24").length} 项，权限待后端核验`} /> : null}
              {staff.length ? <Item k="无账号人员" v={`${staff.length} 名新教职工无账号：工作已登记，访问待开户`} /> : null}
              {prep.length ? <Item k="开户准备" v={`${prep.length} 项方案，不激活、不发邀请`} /> : null}
              {live("27").length ? <Item k="学校课表" v={`${live("27").length} 条排课 → 待确认学校版本，不发布`} /> : null}
            </dl>

            {accessChanges.length ? (
              <Notice tone="warning" title={`已有账号访问变化：${accessChanges.length} 项`}>
                以下任命引用目标学校已有员工，若其已有账号，确认后其可访问的班级或职责会改变：
                <ul className="mt-1 list-disc pl-5">
                  {accessChanges.slice(0, 5).map((r) => (
                    <li key={r.key}>
                      {sheetTitle(r.sheet)} 第 {r.line} 行 · {r.values.id ?? ""} · 员工 {r.values.staff.startsWith(EXISTING_PREFIX) ? "已有对象（对照示例）" : r.values.staff}
                    </li>
                  ))}
                </ul>
              </Notice>
            ) : null}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Notice tone="neutral" title="本批导入保证">
            <ul className="list-disc pl-5">
              <li>不会覆盖已有人员</li>
              <li>不会删除文件中未列出的数据</li>
              <li>不会覆盖当前管理员</li>
              <li>不会自动开户、发邮件或发送邀请</li>
              <li>资格与任命按合法办理登记，文件不是授权证明</li>
            </ul>
          </Notice>

          {blocked ? (
            <Notice tone="danger" title={`还有 ${plan.totals.block} 个阻断，不能确认`}>
              请返回预览逐项处理，或把相关表设为不导入 / 排除相关行后重新预览。没有“一键忽略错误”。
            </Notice>
          ) : null}
          {alreadyDone ? (
            <Notice tone="warning" title={`已完成批次 ${completed!.id}`}>
              同一内容已完成过，不再新增。
              <button className="ml-1 text-primary hover:underline" onClick={() => onOpenLog(completed!.id)}>
                查看记录并核验差异
              </button>
            </Notice>
          ) : null}

          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              提交结果 <ExampleTag>未接后台，结果为示例</ExampleTag>
            </div>
            <Select aria-label="结果示例" value={kind} onChange={(e) => setKind(e.target.value as ResultKind)}>
              <option value="done">完成</option>
              <option value="failed">当前批失败</option>
              <option value="pending">结果待查询（如提交后断网）</option>
            </Select>
            <Checkbox checked={stale} onChange={setStale} label="模拟：预览后目标数据或权限已变化" />
            <Checkbox checked={selfCheck} onChange={setSelfCheck} label="本人已核对上述计划（静态示例，不需要第二管理员审批）" />
          </Card>

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={onBack}>
              返回修改
            </Button>
            <Button disabled={blocked || alreadyDone || !selfCheck} onClick={confirm}>
              确认导入
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-muted/40 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

function periods(rows: { values: Record<string, string> }[]) {
  const set = new Set(rows.map((r) => `${r.values.start || "?"} 至 ${r.values.end || "长期"}`))
  return [...set].slice(0, 2).join("；")
}
