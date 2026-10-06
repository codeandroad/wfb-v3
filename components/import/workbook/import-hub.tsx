"use client"

import { Card, LinkButton, PageHeader, Sheet, Tabs } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { PRESETS, type SheetCode } from "@/lib/import/schema"
import { Boxes, FileStack, Route, Undo2 } from "lucide-react"
import { useRef, useState } from "react"
import { ExportPanel, type PackKind } from "./export-panel"
import { LogPanel } from "./log-panel"
import { TemplatesPanel } from "./templates-panel"
import { WorkbookFlow, type FlowHandle } from "./workbook-flow"

type Tab = "import" | "templates" | "export" | "log"

interface ExportPreset {
  pack?: PackKind
  scope?: "school" | "restricted"
  mode?: "export" | "rebuild"
  n: number
}

export function ImportHub({ initialFocus }: { initialFocus?: SheetCode[] }) {
  const [tab, setTab] = useState<Tab>("import")
  const [view, setView] = useState<"home" | "flow">(initialFocus ? "flow" : "home")
  const [logId, setLogId] = useState<string | null>(null)
  const [preset, setPreset] = useState<string | undefined>()
  const [exp, setExp] = useState<ExportPreset>({ n: 0 })
  const [journeys, setJourneys] = useState(false)
  const flow = useRef<FlowHandle>(null)

  const startSample = (id: string) => {
    setTab("import")
    setView("flow")
    requestAnimationFrame(() => flow.current?.loadSample(id))
  }
  const startIntake = (focus?: SheetCode[], hint?: string) => {
    setTab("import")
    setView("flow")
    requestAnimationFrame(() => flow.current?.reset(focus, hint))
  }
  const openLog = (id: string) => {
    setLogId(id)
    setTab("log")
  }
  const openExport = (p: Omit<ExportPreset, "n">) => {
    setExp((e) => ({ ...p, n: e.n + 1 }))
    setTab("export")
  }

  const JOURNEYS: { id: string; title: string; go: () => void }[] = [
    { id: "J01", title: "单表教室：真实读取与预览，无课程/学生依赖", go: () => startIntake(["06"], "选择一个只含教室的 XLSX 或 CSV；也可载入“单表：教室”示例。") },
    { id: "J02", title: "部门＋职务＋员工：同批引用，编号留空默认待编号", go: () => startSample("staff-dept") },
    { id: "J03", title: "多工作表 XLSX：实际表名/行数据/统计与本地校验", go: () => startIntake(undefined, "选择一个含多个工作表的 XLSX；统计全部来自实际解析。") },
    { id: "J04", title: "分批：先人员，后教学关系，引用已有对象", go: () => startSample("teaching-later") },
    { id: "J05", title: "员工无账号：资格与班主任任命，访问待开户", go: () => startSample("hrt") },
    { id: "J06", title: "教学班有学科无课程：P1 继承 / S1 子集", go: () => startSample("teaching") },
    { id: "J07", title: "多家长/多子女：关系数与人数分开，不开家长账号", go: () => startSample("family") },
    { id: "J08", title: "编号错误：逐行修改 / 有限批量设自动", go: () => startSample("numbering") },
    { id: "J09", title: "已存在对象与已完成批次：复用，不重复新建", go: () => startSample("existing") },
    { id: "J10", title: "取消依赖表：影响提示，补选或排除后重新预览", go: () => startSample("issues") },
    { id: "J11", title: "结构导出：缺少人员名单说明", go: () => openExport({ pack: "structure", scope: "school", mode: "export" }) },
    { id: "J12", title: "完整基础包：受控字段与安全条件", go: () => openExport({ pack: "full", scope: "school", mode: "export" }) },
    { id: "J13", title: "同校新安装目标重建：复用学期、保留管理员、往返核对", go: () => openExport({ mode: "rebuild" }) },
    { id: "J14", title: "管理/开户准备：不自动激活或发送", go: () => startSample("prep") },
    { id: "J15", title: "预览后数据或权限变化：旧计划不可用，返回重验", go: () => startSample("full") },
    { id: "J16", title: "提交后断网：结果待查询，同一批完成", go: () => startSample("full") },
    { id: "J17", title: "受限经办者导出：明确范围缺口", go: () => openExport({ pack: "full", scope: "restricted", mode: "export" }) },
    { id: "J18", title: "可选学校课表：待确认学校版本，进入课表中心", go: () => startSample("timetable") },
  ]
  const JOURNEY_TIP: Record<string, string> = {
    J09: "先完成一次导入，再重新载入同一示例，会提示“已完成批次”。",
    J10: "在“内容与依赖”中把 04_部门 改为“不导入”。",
    J15: "在确认页勾选“模拟：预览后目标数据或权限已变化”。",
    J16: "在确认页选择“结果待查询”，再在结果页查询。",
    J12: "勾选两项安全条件（示例）后才能生成。",
  }

  return (
    <div>
      <PageHeader
        title="数据导入"
        desc="文件在本机真实解析；教职工和编号保存到共享会话原型，其他业务仍模拟。未接正式后台，不会自动开户或发送邀请。"
        actions={
          <Button variant="outline" size="sm" onClick={() => setJourneys(true)}>
            <Route className="size-4" aria-hidden />
            演示旅程 J01—J18
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        tabs={[
          { value: "import", label: "导入" },
          { value: "templates", label: "模板与示例" },
          { value: "export", label: "导出与重建" },
          { value: "log", label: "操作记录" },
        ]}
      />

      <div className="mt-5">
        <div hidden={tab !== "import" || view !== "home"}>
          <ImportHome
            onWorkbook={() => startIntake(undefined)}
            onByType={(sheets) => startIntake(sheets)}
            onRebuild={() => openExport({ mode: "rebuild" })}
            onTemplates={(id) => {
              setPreset(id)
              setTab("templates")
            }}
            onSample={startSample}
          />
        </div>
        <div hidden={tab !== "import" || view !== "flow"}>
          <WorkbookFlow ref={flow} initialFocus={initialFocus} onHome={() => setView("home")} onOpenLog={openLog} />
        </div>
        {tab === "templates" ? <TemplatesPanel key={preset} initialPreset={preset} onUseSample={startSample} /> : null}
        {tab === "export" ? <ExportPanel key={exp.n} initialPack={exp.pack} initialScope={exp.scope} initialMode={exp.mode} /> : null}
        {tab === "log" ? <LogPanel openId={logId} onOpenChange={setLogId} /> : null}
      </div>

      <Sheet open={journeys} onClose={() => setJourneys(false)} title="演示旅程 J01—J18" desc="点击直接进入对应画面；带说明的旅程需按提示操作一步">
        <ol className="flex flex-col gap-1.5">
          {JOURNEYS.map((j) => (
            <li key={j.id}>
              <button
                className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => {
                  setJourneys(false)
                  j.go()
                }}
              >
                <span className="text-[13px]">
                  <span className="mr-2 font-mono text-xs text-primary">{j.id}</span>
                  {j.title}
                </span>
                {JOURNEY_TIP[j.id] ? <span className="pl-10 text-xs text-muted-foreground">{JOURNEY_TIP[j.id]}</span> : null}
              </button>
            </li>
          ))}
        </ol>
      </Sheet>
    </div>
  )
}

function ImportHome({
  onWorkbook, onByType, onRebuild, onTemplates, onSample,
}: {
  onWorkbook: () => void
  onByType: (sheets?: SheetCode[]) => void
  onRebuild: () => void
  onTemplates: (presetId: string) => void
  onSample: (id: string) => void
}) {
  const PRESET_SAMPLE: Record<string, string> = { students: "people-first", "admin-roster": "hrt", "people-base": "people-first", teaching: "teaching", family: "family", full: "full", timetable: "timetable" }
  const ways = [
    { icon: FileStack, title: "完整建校工作簿", desc: "一个 XLSX 多表一起建立资料与关系；未填的表可忽略。", cta: "选择工作簿", go: onWorkbook },
    { icon: Boxes, title: "按类型导入", desc: "只处理本次需要的数据；课程、人员、关系可分批，不要求一起上传。", cta: "选择文件", go: () => onByType() },
    { icon: Undo2, title: "使用导出包重建", desc: "恢复到已有首位管理员的新学校环境，保留目标校名与管理员。", cta: "进入重建预检", go: onRebuild },
  ]
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-3">
        {ways.map((w) => (
          <Card key={w.title} className="flex flex-col gap-3 p-5">
            <w.icon className="size-5 text-primary" aria-hidden />
            <div className="flex flex-col gap-1">
              <h2 className="text-[15px] font-semibold">{w.title}</h2>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{w.desc}</p>
            </div>
            <Button className="mt-auto self-start" onClick={w.go}>{w.cta}</Button>
          </Card>
        ))}
      </div>
      <p className="text-[13px] text-muted-foreground">
        导入默认新增，或明确引用已有对象；不会更新已有人员，文件中缺少的行也不表示删除。
      </p>

      <section aria-labelledby="cat-h" className="flex flex-col gap-3">
        <h2 id="cat-h" className="text-[14px] font-semibold">数据分类</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PRESETS.map((p) => (
            <Card key={p.id} className="flex flex-col gap-2 p-4">
              <h3 className="text-[13px] font-semibold">{p.label}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
              <div className="mt-auto flex gap-3 pt-1 text-[13px]">
                <button className="text-primary hover:underline" onClick={() => onTemplates(p.id)}>查看模板</button>
                {PRESET_SAMPLE[p.id] ? <button className="text-primary hover:underline" onClick={() => onSample(PRESET_SAMPLE[p.id])}>使用示例</button> : null}
                <button className="text-primary hover:underline" onClick={() => onByType(p.sheets)}>导入此类</button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="short-h" className="flex flex-col gap-2">
        <h2 id="short-h" className="text-[14px] font-semibold">常用捷径（原单类导入）</h2>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/import?type=students" variant="outline">学生</LinkButton>
          <LinkButton href="/import?type=staff" variant="outline">教职工</LinkButton>
          <LinkButton href="/import?type=parents" variant="outline">学生家长关联</LinkButton>
        </div>
      </section>
    </div>
  )
}
