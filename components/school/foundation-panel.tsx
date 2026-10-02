"use client"

import { Badge, Card, EmptyState, Field, Input, Modal, Segmented, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  CLASSROOM_ITEMS,
  DEPARTMENT_ITEMS,
  FOUNDATION_STATUS_LABEL,
  JOB_TITLE_ITEMS,
  type ClassroomItem,
  type DepartmentItem,
  type FoundationStatus,
  type JobTitleItem,
} from "@/lib/demo/foundation"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp, Building2, DoorOpen, Pencil, Plus, Upload, UserSquare2 } from "lucide-react"
import { useMemo, useState } from "react"
import { ListToolbar, type FilterGroup, type FilterState } from "./list-toolbar"

type FoundationTab = "departments" | "jobs" | "classrooms"
type ScenarioState = "data" | "empty"

const STATUS_FILTER: FilterGroup = {
  key: "status",
  label: "状态",
  options: [
    { value: "active", label: "启用" },
    { value: "inactive", label: "停用" },
  ],
}

export function FoundationPanel() {
  const [tab, setTab] = useState<FoundationTab>("departments")
  // 演示：是否有权维护全校通用条目（可选/新增的差别）
  const [canMaintain, setCanMaintain] = useState(true)
  const [scenario, setScenario] = useState<ScenarioState>("data")

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-muted-foreground">
        维护本校部门、职务与教室等基础资料，供新增人员、排课等处选用。部门与职务名称不产生系统角色或权限。
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="thin-scroll -mx-1 max-w-full overflow-x-auto px-1">
          <Segmented<FoundationTab>
            ariaLabel="基础资料分区"
            value={tab}
            onChange={setTab}
            options={[
              { value: "departments", label: "部门" },
              { value: "jobs", label: "职务" },
              { value: "classrooms", label: "教室" },
            ]}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setScenario((s) => (s === "data" ? "empty" : "data"))}>
          {scenario === "data" ? "查看空学校状态" : "查看示例数据"}
        </Button>
      </div>

      <label className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="size-3.5 accent-[var(--primary)]"
          checked={!canMaintain}
          onChange={(e) => setCanMaintain(!e.target.checked)}
        />
        演示：模拟“只能选择现有值、无基础资料维护权”的填写者
      </label>

      {tab === "departments" ? <DepartmentsTab canMaintain={canMaintain} scenario={scenario} /> : null}
      {tab === "jobs" ? <JobsTab canMaintain={canMaintain} scenario={scenario} /> : null}
      {tab === "classrooms" ? <ClassroomsTab canMaintain={canMaintain} scenario={scenario} /> : null}

      <p className="text-xs text-muted-foreground/70">
        导入仍集中在「数据导入」模块办理，此处不新造上传入口。被引用的条目优先停用，不做一键删除断链。
      </p>
    </div>
  )
}

/* ---------------- 通用：无维护权提示 ---------------- */

function NoPermissionBanner() {
  return (
    <div className="rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] px-3 py-2 text-xs text-[#7a5514]">
      当前账号只能选择现有基础资料，无权新增或停用全校通用条目。如需调整，请联系有权维护人员。
    </div>
  )
}

/* ---------------- 部门 ---------------- */

function DepartmentsTab({ canMaintain, scenario }: { canMaintain: boolean; scenario: ScenarioState }) {
  const { push } = useToast()
  const [items, setItems] = useState<DepartmentItem[]>(scenario === "empty" ? [] : DEPARTMENT_ITEMS)
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})
  const [editing, setEditing] = useState<DepartmentItem | "new" | null>(null)

  // 场景切换时同步数据
  const scenarioItems = useMemo(() => (scenario === "empty" ? [] : DEPARTMENT_ITEMS), [scenario])
  const [lastScenario, setLastScenario] = useState(scenario)
  if (lastScenario !== scenario) {
    setLastScenario(scenario)
    setItems(scenarioItems)
  }

  const sorted = [...items].sort((a, b) => a.order - b.order)
  const rows = sorted.filter((d) => {
    const fStatus = filters.status ?? []
    return (!q || d.name.includes(q)) && (!fStatus.length || fStatus.includes(d.status))
  })

  function move(id: string, dir: -1 | 1) {
    setItems((list) => reorder(list, id, dir))
  }
  function toggleStatus(d: DepartmentItem) {
    setItems((list) => list.map((x) => (x.id === d.id ? { ...x, status: flip(x.status) } : x)))
    push(d.status === "active" ? `已停用「${d.name}」（演示）` : `已启用「${d.name}」（演示）`)
  }

  return (
    <>
      <Card>
        <div className="px-5 py-4">
          <ListToolbar
            search={q}
            onSearch={setQ}
            searchPlaceholder="搜索部门名称"
            groups={[STATUS_FILTER]}
            value={filters}
            onChange={setFilters}
            resultCount={rows.length}
            totalCount={items.length}
            right={
              canMaintain ? (
                <Button onClick={() => setEditing("new")}>
                  <Plus className="size-3.5" />
                  新增部门
                </Button>
              ) : undefined
            }
          />
          {!canMaintain ? <div className="mt-3"><NoPermissionBanner /></div> : null}
        </div>

        {items.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={<Building2 className="size-6" />}
              title="暂无部门"
              desc="新增第一个部门，或从数据导入批量建立。示例数据不会自动预置到所有学校。"
              action={canMaintain ? <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-3.5" />新增部门</Button> : undefined}
            />
          </div>
        ) : (
          <ItemTable
            columns={["部门", "状态", "被引用", "顺序"]}
            rows={rows}
            sorted={sorted}
            canMaintain={canMaintain}
            onMove={move}
            onEdit={(d) => setEditing(d)}
            onToggle={toggleStatus}
            render={(d) => (
              <>
                <td className="px-3 py-3">
                  <span className="font-medium text-foreground">{d.name}</span>
                  {d.note ? <p className="mt-0.5 text-xs text-muted-foreground">{d.note}</p> : null}
                </td>
                <StatusCell status={d.status} />
                <td className="px-3 py-3 text-muted-foreground">{d.referencedBy} 人</td>
              </>
            )}
          />
        )}
      </Card>

      <FoundationForm
        open={editing !== null}
        kind="department"
        initialName={editing && editing !== "new" ? editing.name : ""}
        onClose={() => setEditing(null)}
        onSave={(name) => {
          setItems((list) => {
            if (editing && editing !== "new") return list.map((x) => (x.id === editing.id ? { ...x, name } : x))
            const order = (Math.max(0, ...list.map((x) => x.order)) || 0) + 10
            return [...list, { id: `dep-${Date.now()}`, name, status: "active", order, referencedBy: 0 }]
          })
          push(editing === "new" ? `已新增部门「${name}」（演示）` : "已保存部门修改（演示）")
          setEditing(null)
        }}
      />
    </>
  )
}

/* ---------------- 职务 ---------------- */

function JobsTab({ canMaintain, scenario }: { canMaintain: boolean; scenario: ScenarioState }) {
  const { push } = useToast()
  const [items, setItems] = useState<JobTitleItem[]>(scenario === "empty" ? [] : JOB_TITLE_ITEMS)
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})
  const [editing, setEditing] = useState<JobTitleItem | "new" | null>(null)

  const scenarioItems = useMemo(() => (scenario === "empty" ? [] : JOB_TITLE_ITEMS), [scenario])
  const [lastScenario, setLastScenario] = useState(scenario)
  if (lastScenario !== scenario) {
    setLastScenario(scenario)
    setItems(scenarioItems)
  }

  const sorted = [...items].sort((a, b) => a.order - b.order)
  const rows = sorted.filter((d) => {
    const fStatus = filters.status ?? []
    return (!q || d.name.includes(q)) && (!fStatus.length || fStatus.includes(d.status))
  })

  return (
    <>
      <Card>
        <div className="px-5 py-4">
          <ListToolbar
            search={q}
            onSearch={setQ}
            searchPlaceholder="搜索职务名称"
            groups={[STATUS_FILTER]}
            value={filters}
            onChange={setFilters}
            resultCount={rows.length}
            totalCount={items.length}
            right={
              canMaintain ? (
                <Button onClick={() => setEditing("new")}>
                  <Plus className="size-3.5" />
                  新增职务
                </Button>
              ) : undefined
            }
          />
          {!canMaintain ? <div className="mt-3"><NoPermissionBanner /></div> : null}
          <p className="mt-2 text-xs text-muted-foreground/70">
            职务是人事资料，不自动建立系统角色或访问资格。“校长”不自动授学校管理员，“教师”不自动授任课资格。
          </p>
        </div>

        {items.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={<UserSquare2 className="size-6" />}
              title="暂无职务"
              desc="新增第一个常用职务；少见职务也可在人员表单中按“本次职务”临时填写。"
              action={canMaintain ? <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-3.5" />新增职务</Button> : undefined}
            />
          </div>
        ) : (
          <ItemTable
            columns={["职务", "状态", "被引用", "顺序"]}
            rows={rows}
            sorted={sorted}
            canMaintain={canMaintain}
            onMove={(id, dir) => setItems((list) => reorder(list, id, dir))}
            onEdit={(d) => setEditing(d)}
            onToggle={(d) => {
              setItems((list) => list.map((x) => (x.id === d.id ? { ...x, status: flip(x.status) } : x)))
              push(d.status === "active" ? `已停用「${d.name}」（演示）` : `已启用「${d.name}」（演示）`)
            }}
            render={(d) => (
              <>
                <td className="px-3 py-3">
                  <span className="font-medium text-foreground">{d.name}</span>
                  {d.note ? <p className="mt-0.5 text-xs text-muted-foreground">{d.note}</p> : null}
                </td>
                <StatusCell status={d.status} />
                <td className="px-3 py-3 text-muted-foreground">{d.referencedBy} 人</td>
              </>
            )}
          />
        )}
      </Card>

      <FoundationForm
        open={editing !== null}
        kind="job"
        initialName={editing && editing !== "new" ? editing.name : ""}
        onClose={() => setEditing(null)}
        onSave={(name) => {
          setItems((list) => {
            if (editing && editing !== "new") return list.map((x) => (x.id === editing.id ? { ...x, name } : x))
            const order = (Math.max(0, ...list.map((x) => x.order)) || 0) + 10
            return [...list, { id: `job-${Date.now()}`, name, status: "active", order, referencedBy: 0 }]
          })
          push(editing === "new" ? `已新增职务「${name}」（演示）` : "已保存职务修改（演示）")
          setEditing(null)
        }}
      />
    </>
  )
}

/* ---------------- 教室 ---------------- */

function ClassroomsTab({ canMaintain, scenario }: { canMaintain: boolean; scenario: ScenarioState }) {
  const { push } = useToast()
  const [items, setItems] = useState<ClassroomItem[]>(scenario === "empty" ? [] : CLASSROOM_ITEMS)
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})
  const [editing, setEditing] = useState<ClassroomItem | "new" | null>(null)

  const scenarioItems = useMemo(() => (scenario === "empty" ? [] : CLASSROOM_ITEMS), [scenario])
  const [lastScenario, setLastScenario] = useState(scenario)
  if (lastScenario !== scenario) {
    setLastScenario(scenario)
    setItems(scenarioItems)
  }

  const sorted = [...items].sort((a, b) => a.order - b.order)
  const rows = sorted.filter((d) => {
    const fStatus = filters.status ?? []
    return (!q || d.name.includes(q) || d.building.includes(q)) && (!fStatus.length || fStatus.includes(d.status))
  })

  return (
    <>
      <Card>
        <div className="px-5 py-4">
          <ListToolbar
            search={q}
            onSearch={setQ}
            searchPlaceholder="搜索教室名称或楼栋"
            groups={[STATUS_FILTER]}
            value={filters}
            onChange={setFilters}
            resultCount={rows.length}
            totalCount={items.length}
            right={
              canMaintain ? (
                <Button onClick={() => setEditing("new")}>
                  <Plus className="size-3.5" />
                  新增教室
                </Button>
              ) : undefined
            }
          />
          {!canMaintain ? <div className="mt-3"><NoPermissionBanner /></div> : null}
          <p className="mt-2 text-xs text-muted-foreground/70">
            教室是实际地点对象，选择时显示“楼栋 · 名称”。两栋楼同名的 201 属于不同教室，不会合并为一个。
          </p>
        </div>

        {items.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={<DoorOpen className="size-6" />}
              title="暂无教室"
              desc="新增第一间教室（含楼栋 / 位置）；临时或校外地点在排课处以文字模式登记，不在此建正式教室。"
              action={canMaintain ? <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-3.5" />新增教室</Button> : undefined}
            />
          </div>
        ) : (
          <ItemTable
            columns={["教室", "楼栋 / 位置", "状态", "顺序"]}
            rows={rows}
            sorted={sorted}
            canMaintain={canMaintain}
            onMove={(id, dir) => setItems((list) => reorder(list, id, dir))}
            onEdit={(d) => setEditing(d)}
            onToggle={(d) => {
              setItems((list) => list.map((x) => (x.id === d.id ? { ...x, status: flip(x.status) } : x)))
              push(d.status === "active" ? `已停用「${d.building} · ${d.name}」（演示）` : `已启用「${d.building} · ${d.name}」（演示）`)
            }}
            render={(d) => (
              <>
                <td className="px-3 py-3">
                  <span className="font-medium text-foreground">{d.name}</span>
                  {d.note ? <p className="mt-0.5 text-xs text-muted-foreground">{d.note}</p> : null}
                </td>
                <td className="px-3 py-3 text-muted-foreground">{d.building}</td>
                <StatusCell status={d.status} />
              </>
            )}
          />
        )}
      </Card>

      <ClassroomForm
        open={editing !== null}
        initial={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSave={(name, building) => {
          setItems((list) => {
            if (editing && editing !== "new") return list.map((x) => (x.id === editing.id ? { ...x, name, building } : x))
            const order = (Math.max(0, ...list.map((x) => x.order)) || 0) + 10
            return [...list, { id: `room-${Date.now()}`, name, building, status: "active", order }]
          })
          push(editing === "new" ? `已新增教室「${building} · ${name}」（演示）` : "已保存教室修改（演示）")
          setEditing(null)
        }}
      />
    </>
  )
}

/* ---------------- 通用表格 ---------------- */

interface OrderedItem {
  id: string
  order: number
  status: FoundationStatus
}

function ItemTable<T extends OrderedItem>({
  columns,
  rows,
  sorted,
  canMaintain,
  onMove,
  onEdit,
  onToggle,
  render,
}: {
  columns: string[]
  rows: T[]
  sorted: T[]
  canMaintain: boolean
  onMove: (id: string, dir: -1 | 1) => void
  onEdit: (item: T) => void
  onToggle: (item: T) => void
  render: (item: T) => React.ReactNode
}) {
  return (
    <div className="thin-scroll overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-[13px]">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c} className={cn("px-3 py-2.5 font-medium", c === columns[0] && "pl-5")}>
                {c}
              </th>
            ))}
            <th className="px-5 py-2.5 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => {
            const idx = sorted.findIndex((x) => x.id === d.id)
            const first = idx === 0
            const last = idx === sorted.length - 1
            return (
              <tr key={d.id} className="border-t border-border align-top [&>td:first-child]:pl-5">
                {render(d)}
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {canMaintain ? (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={first}
                          onClick={() => onMove(d.id, -1)}
                          aria-label="上移"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={last}
                          onClick={() => onMove(d.id, 1)}
                          aria-label="下移"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => onEdit(d)} aria-label="编辑">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => onToggle(d)}>
                          {d.status === "active" ? "停用" : "启用"}
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">仅可选择</span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatusCell({ status }: { status: FoundationStatus }) {
  return (
    <td className="px-3 py-3">
      <Badge tone={status === "active" ? "success" : "neutral"}>{FOUNDATION_STATUS_LABEL[status]}</Badge>
    </td>
  )
}

/* ---------------- 表单 ---------------- */

function FoundationForm({
  open,
  kind,
  initialName,
  onClose,
  onSave,
}: {
  open: boolean
  kind: "department" | "job"
  initialName: string
  onClose: () => void
  onSave: (name: string) => void
}) {
  const label = kind === "department" ? "部门" : "职务"
  const [name, setName] = useState(initialName)
  const [touched, setTouched] = useState(false)
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setName(initialName)
      setTouched(false)
    }
  }
  const missing = touched && !name.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-md"
      title={initialName ? `编辑${label}` : `新增${label}`}
      desc={`${label}名称将加入本校通用选项，供人员等处选用。`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              setTouched(true)
              if (!name.trim()) return
              onSave(name.trim())
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <Field label={`${label}名称`} required error={missing ? "请输入名称。" : undefined}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === "department" ? "如 生物组" : "如 升学导师"}
          aria-invalid={missing}
        />
      </Field>
    </Modal>
  )
}

function ClassroomForm({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial: ClassroomItem | null
  onClose: () => void
  onSave: (name: string, building: string) => void
}) {
  const [name, setName] = useState("")
  const [building, setBuilding] = useState("")
  const [touched, setTouched] = useState(false)
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setName(initial?.name ?? "")
      setBuilding(initial?.building ?? "")
      setTouched(false)
    }
  }
  const missing = touched && !name.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-md"
      title={initial ? "编辑教室" : "新增教室"}
      desc="教室为实际地点对象；内部编号由系统处理，无需手填。"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              setTouched(true)
              if (!name.trim()) return
              onSave(name.trim(), building.trim() || "未标注位置")
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="教室名称" required error={missing ? "请输入教室名称。" : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 201、阶梯教室" aria-invalid={missing} />
        </Field>
        <Field label="楼栋 / 位置说明（可选）">
          <Input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="如 教学楼A、实验楼B" />
          <p className="mt-1 text-xs text-muted-foreground/70">位置用于区分同名教室；本轮不含容量、设备、预约。</p>
        </Field>
      </div>
    </Modal>
  )
}

/* ---------------- 工具 ---------------- */

function flip(s: FoundationStatus): FoundationStatus {
  return s === "active" ? "inactive" : "active"
}

function reorder<T extends OrderedItem>(list: T[], id: string, dir: -1 | 1): T[] {
  const sorted = [...list].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex((x) => x.id === id)
  const swap = idx + dir
  if (idx < 0 || swap < 0 || swap >= sorted.length) return list
  const a = sorted[idx]
  const b = sorted[swap]
  return list.map((x) => {
    if (x.id === a.id) return { ...x, order: b.order }
    if (x.id === b.id) return { ...x, order: a.order }
    return x
  })
}
