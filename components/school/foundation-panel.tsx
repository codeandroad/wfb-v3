"use client"

import { Badge, Card, EmptyState, Field, Input, Modal, Segmented, useToast } from "@/components/kit"
import { commitSchoolChange } from "@/lib/school/system-client"
import { Button } from "@/components/ui/button"
import {
  FOUNDATION_STATUS_LABEL,
  type DepartmentItem,
  type FoundationStatus,
  type JobTitleItem,
} from "@/lib/demo/foundation"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp, Building2, DoorOpen, Pencil, Plus, UserSquare2 } from "lucide-react"
import { useState, useSyncExternalStore } from "react"
import { PLACE_KIND_LABEL, placeLabel, updateFoundationItems, useFoundation, useFoundationStatus, type FoundationState, type SchoolPlace, type PlaceKind } from "@/lib/school/foundation-store"
import { foundationPeopleCount, renameFoundationDepartment, reorderFoundationItems } from "@/lib/school/foundation-view"
import { useStaffList, useStaffPermission } from "@/lib/school/staff-store"
import { ListToolbar, type FilterGroup, type FilterState } from "./list-toolbar"

type FoundationTab = "departments" | "jobs" | "classrooms"
type ScenarioState = "data" | "empty"
const subscribeHydration = () => () => {}

const STATUS_FILTER: FilterGroup = {
  key: "status",
  label: "状态",
  options: [
    { value: "active", label: "启用" },
    { value: "inactive", label: "停用" },
  ],
}

export function FoundationPanel({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<FoundationTab>(initialTab === "jobs" || initialTab === "classrooms" ? initialTab : "departments")
  const foundation = useFoundation()
  const view = foundation
  const ready = useSyncExternalStore(subscribeHydration, () => true, () => false)
  // 演示：是否有权维护全校通用条目（可选/新增的差别）
  const permitted = useStaffPermission()
  const [readOnlyPreview, setReadOnlyPreview] = useState(false)
  const storageStatus = useFoundationStatus()
  const canMaintain = permitted && !readOnlyPreview && !storageStatus.error
  const [scenario, setScenario] = useState<ScenarioState>("data")

  if (!ready) return <p role="status" className="text-sm text-muted-foreground">正在读取已保存的基础资料…</p>

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-muted-foreground">
        维护本校部门、职务与场所等基础资料，供新增人员、排课等处选用。部门与职务名称不产生系统角色或权限。
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
              { value: "classrooms", label: "场所" },
            ]}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setScenario((s) => (s === "data" ? "empty" : "data"))}>
          {scenario === "data" ? "查看空学校状态" : "返回当前资料"}
        </Button>
      </div>

      <label className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="size-3.5 accent-[var(--primary)]"
          checked={readOnlyPreview}
          onChange={(e) => setReadOnlyPreview(e.target.checked)}
        />
        演示：模拟“只能选择现有值、无基础资料维护权”的填写者
      </label>

      {storageStatus.error ? <p role="alert" className="text-sm text-destructive">{storageStatus.error}</p> : null}
      {tab === "departments" ? <DepartmentsTab canMaintain={canMaintain && scenario === "data"} scenario={scenario} view={view} onCreated={() => {}} /> : null}
      {tab === "jobs" ? <JobsTab canMaintain={canMaintain && scenario === "data"} scenario={scenario} view={view} onCreated={() => {}} /> : null}
      {tab === "classrooms" ? <ClassroomsTab canMaintain={canMaintain && scenario === "data"} scenario={scenario} view={view} onCreated={() => {}} /> : null}

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

function DepartmentsTab({ canMaintain, scenario, view, onCreated }: { canMaintain: boolean; scenario: ScenarioState; view: FoundationState; onCreated: () => void }) {
  const { push } = useToast()
  const people = useStaffList()
  const foundation = useFoundation()
  const items = scenario === "empty" ? [] : view.departments
  const [saveError, setSaveError] = useState("")
  const setItems = async (updater: (items: typeof foundation.departments) => typeof foundation.departments) => {
    try { await commitSchoolChange(()=>updateFoundationItems("departments", updater)); setSaveError(""); return true }
    catch (error) { setSaveError(error instanceof Error ? error.message : "保存失败，请重试。"); return false }
  }
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})
  const [editing, setEditing] = useState<DepartmentItem | "new" | null>(null)


  const sorted = [...items].sort((a, b) => a.order - b.order)
  const rows = sorted.filter((d) => {
    const fStatus = filters.status ?? []
    return (!q || d.name.includes(q)) && (!fStatus.length || fStatus.includes(d.status))
  })

  function move(id: string, dir: -1 | 1) {
    setItems((list) => reorderFoundationItems(list, id, dir, items.map(item => item.id)))
  }
  async function toggleStatus(d: DepartmentItem) {
    if (!await setItems((list) => list.map((x) => (x.id === d.id ? { ...x, status: flip(x.status) } : x)))) return
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
          {saveError && editing === null ? <p role="alert" className="mt-2 text-sm text-destructive">{saveError}</p> : null}
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
                  {d.note && d.note !== "来自本机人员导入" ? <p className="mt-0.5 text-xs text-muted-foreground">{d.note}</p> : null}
                </td>
                <StatusCell status={d.status} />
                <td className="px-3 py-3 text-muted-foreground">{foundationPeopleCount(d, "department", people).count} 人</td>
              </>
            )}
          />
        )}
      </Card>

      <FoundationForm
        open={editing !== null}
        kind="department"
        error={saveError}
        initialName={editing && editing !== "new" ? editing.name : ""}
        onClose={() => setEditing(null)}
        onSave={async (name) => {
          if (!await setItems((list) => {
            if (editing && editing !== "new") return list.map((x) => (x.id === editing.id ? renameFoundationDepartment(x, name, people) : x))
            const order = (Math.max(0, ...list.map((x) => x.order)) || 0) + 10
            return [...list, { id: `dep-${Date.now()}`, name, status: "active", order, referencedBy: 0 }]
          })) return
          push(editing === "new" ? `已新增部门「${name}」（演示）` : "已保存部门修改（演示）")
          if (editing === "new") onCreated()
          setEditing(null)
        }}
      />
    </>
  )
}

/* ---------------- 职务 ---------------- */

function JobsTab({ canMaintain, scenario, view, onCreated }: { canMaintain: boolean; scenario: ScenarioState; view: FoundationState; onCreated: () => void }) {
  const { push } = useToast()
  const people = useStaffList()
  const foundation = useFoundation()
  const items = scenario === "empty" ? [] : view.jobs
  const [saveError, setSaveError] = useState("")
  const setItems = async (updater: (items: typeof foundation.jobs) => typeof foundation.jobs) => {
    try { await commitSchoolChange(()=>updateFoundationItems("jobs", updater)); setSaveError(""); return true }
    catch (error) { setSaveError(error instanceof Error ? error.message : "保存失败，请重试。"); return false }
  }
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})
  const [editing, setEditing] = useState<JobTitleItem | "new" | null>(null)


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
          {saveError && editing === null ? <p role="alert" className="mt-2 text-sm text-destructive">{saveError}</p> : null}
          <p className="mt-2 text-xs text-muted-foreground/70">
            职务是人事资料，不自动建立职责或访问权限。“校长”不自动获得学校管理权，“教师”不自动指派任教目标。
          </p>
        </div>

        {items.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={<UserSquare2 className="size-6" />}
              title="暂无职务"
              desc="新增第一个常用职务；人员资料使用已有职务选择，不在人员表单中新增职务。"
              action={canMaintain ? <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-3.5" />新增职务</Button> : undefined}
            />
          </div>
        ) : (
          <ItemTable
            columns={["职务", "状态", "被引用", "顺序"]}
            rows={rows}
            sorted={sorted}
            canMaintain={canMaintain}
            onMove={(id, dir) => setItems((list) => reorderFoundationItems(list, id, dir, items.map(item => item.id)))}
            onEdit={(d) => setEditing(d)}
            onToggle={async (d) => {
              if (!await setItems((list) => list.map((x) => (x.id === d.id ? { ...x, status: flip(x.status) } : x)))) return
              push(d.status === "active" ? `已停用「${d.name}」（演示）` : `已启用「${d.name}」（演示）`)
            }}
            render={(d) => (
              <>
                <td className="px-3 py-3">
                  <span className="font-medium text-foreground">{d.name}</span>
                  {d.note && d.note !== "来自本机人员导入" ? <p className="mt-0.5 text-xs text-muted-foreground">{d.note}</p> : null}
                </td>
                <StatusCell status={d.status} />
                <td className="px-3 py-3 text-muted-foreground">{foundationPeopleCount(d, "jobTitle", people).count} 人</td>
              </>
            )}
          />
        )}
      </Card>

      <FoundationForm
        open={editing !== null}
        kind="job"
        error={saveError}
        initialName={editing && editing !== "new" ? editing.name : ""}
        onClose={() => setEditing(null)}
        onSave={async (name) => {
          if (!await setItems((list) => {
            if (editing && editing !== "new") return list.map((x) => (x.id === editing.id ? { ...x, name } : x))
            const order = (Math.max(0, ...list.map((x) => x.order)) || 0) + 10
            return [...list, { id: `job-${Date.now()}`, name, status: "active", order, referencedBy: 0 }]
          })) return
          push(editing === "new" ? `已新增职务「${name}」（演示）` : "已保存职务修改（演示）")
          if (editing === "new") onCreated()
          setEditing(null)
        }}
      />
    </>
  )
}

/* ---------------- 教室 ---------------- */

function ClassroomsTab({ canMaintain, scenario, view, onCreated }: { canMaintain: boolean; scenario: ScenarioState; view: FoundationState; onCreated: () => void }) {
  const { push } = useToast()
  const foundation = useFoundation()
  const items = scenario === "empty" ? [] : view.places
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})
  const [editing, setEditing] = useState<SchoolPlace | "new" | null>(null)
  const [saveError, setSaveError] = useState("")
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const rows = sorted.filter(place => {
    const includes = (key: string, value: string) => !filters[key]?.length || filters[key].includes(value)
    return (!q || [placeLabel(place), place.usage, place.note].filter(Boolean).join(" ").toLowerCase().includes(q.trim().toLowerCase()))
      && includes("status", place.status) && includes("kind", place.kind ?? "classroom") && includes("building", place.building) && includes("area", place.area ?? "")
  })
  const groups: FilterGroup[] = [
    STATUS_FILTER,
    { key: "kind", label: "类型", options: Object.entries(PLACE_KIND_LABEL).map(([value, label]) => ({ value, label })) },
    { key: "building", label: "楼栋 / 位置", options: [...new Set(items.map(place => place.building).filter(Boolean))].map(value => ({ value, label: value })) },
    { key: "area", label: "区域", options: [...new Set(items.map(place => place.area).filter((value): value is string => !!value))].map(value => ({ value, label: value })) },
  ].filter(group => group.options.length)
  async function change(updater: (items: SchoolPlace[]) => SchoolPlace[]) {
    try { await commitSchoolChange(()=>updateFoundationItems("places", updater)); setSaveError(""); return true }
    catch (error) { setSaveError(error instanceof Error ? error.message : "保存失败，请重试。"); return false }
  }
  return <>
    <Card>
      <div className="px-5 py-4">
        <ListToolbar search={q} onSearch={setQ} searchPlaceholder="搜索名称、区域、房间编号或用途" groups={groups} value={filters} onChange={setFilters} resultCount={rows.length} totalCount={items.length}
          right={canMaintain ? <Button onClick={() => { setSaveError(""); setEditing("new") }}><Plus className="size-3.5" />新增场所</Button> : undefined} />
        {!canMaintain ? <div className="mt-3"><NoPermissionBanner /></div> : null}
        {saveError && editing === null ? <p role="alert" className="mt-2 text-sm text-destructive">{saveError}</p> : null}
      </div>
      {items.length === 0 ? <div className="px-5 py-8"><EmptyState icon={<DoorOpen className="size-6" />} title="暂无场所" desc="可在数据导入中加入教室与办公室分布，或新增场所。" /></div> : <ItemTable
        columns={["场所 / 用途", "类型", "楼栋 / 区域", "编号", "状态"]} rows={rows} sorted={sorted} canMaintain={canMaintain}
        onMove={(id, direction) => change(list => reorderFoundationItems(list, id, direction, items.map(item => item.id)))}
        onEdit={place => { setSaveError(""); setEditing(place) }}
        onToggle={async place => { if (await change(list => list.map(item => item.id === place.id ? { ...item, status: flip(item.status) } : item))) push(place.status === "active" ? "场所已停用，历史安排保留。" : "场所已启用。") }}
        render={place => <>
          <td className="px-3 py-3"><span className="font-medium text-foreground">{place.name}</span>
            {place.usage && place.usage !== place.name ? <p className="mt-0.5 text-xs text-muted-foreground">{place.usage}</p> : null}
            {place.note ? <p className="mt-0.5 text-xs text-muted-foreground">{place.note}</p> : null}
          </td>
          <td className="px-3 py-3 text-muted-foreground">{PLACE_KIND_LABEL[place.kind ?? "classroom"]}</td>
          <td className="px-3 py-3 text-muted-foreground">{[place.building, place.area, place.floor].filter(Boolean).join(" · ") || "未标注"}</td>
          <td className="px-3 py-3 text-muted-foreground">{place.roomCode || "—"}</td>
          <StatusCell status={place.status} />
        </>} />}
    </Card>
    <ClassroomForm open={editing !== null} initial={editing === "new" ? null : editing} error={saveError} onClose={() => setEditing(null)} onSave={async patch => {
      if (!await change(list => {
        if (editing && editing !== "new") return list.map(item => item.id === editing.id ? { ...item, ...patch } : item)
        return [...list, { id: `place-${crypto.randomUUID()}`, ...patch, status: "active", order: Math.max(0, ...list.map(item => item.order)) + 10 }]
      })) return
      push(editing === "new" ? "场所已新增。" : "场所修改已保存。")
      if (editing === "new") onCreated()
      setEditing(null)
    }} />
  </>
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
  error,
  onClose,
  onSave,
}: {
  open: boolean
  kind: "department" | "job"
  initialName: string
  error?: string
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
          placeholder={kind === "department" ? "如 教务处" : "如 升学导师"}
          aria-invalid={missing}
        />
      </Field>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </Modal>
  )
}

type PlaceFormValue = Pick<SchoolPlace, "name" | "building" | "kind" | "area" | "floor" | "roomCode" | "usage">
function ClassroomForm({ open, initial, error, onClose, onSave }: {
  open: boolean; initial: SchoolPlace | null; error: string; onClose: () => void; onSave: (value: PlaceFormValue) => void
}) {
  const empty: PlaceFormValue = { name: "", building: "", kind: "classroom", area: "", floor: "", roomCode: "", usage: "" }
  const [value, setValue] = useState<PlaceFormValue>(empty)
  const [touched, setTouched] = useState(false)
  const [lastKey, setLastKey] = useState("")
  const key = open ? initial?.id ?? "new" : "closed"
  if (key !== lastKey) {
    setLastKey(key)
    if (open) { setValue(initial ? { name: initial.name, building: initial.building, kind: initial.kind ?? "classroom", area: initial.area ?? "", floor: initial.floor ?? "", roomCode: initial.roomCode ?? "", usage: initial.usage ?? "" } : empty); setTouched(false) }
  }
  const missing = touched && !value.name.trim()
  const field = (name: keyof PlaceFormValue, label: string, placeholder: string) => <Field label={label}><Input value={value[name] ?? ""} placeholder={placeholder} onChange={event => setValue(previous => ({ ...previous, [name]: event.target.value }))} /></Field>
  return <Modal open={open} onClose={onClose} width="max-w-xl" title={initial ? "编辑场所" : "新增场所"} desc="名称、位置与用途独立保存；区域按原资料填写，不从编号推断楼层。" footer={<><Button variant="ghost" onClick={onClose}>取消</Button><Button onClick={() => {
    setTouched(true)
    if (!value.name.trim()) return
    onSave({ ...value, name: value.name.trim(), building: value.building.trim(), area: value.area?.trim(), floor: value.floor?.trim(), roomCode: value.roomCode?.trim(), usage: value.usage?.trim() })
  }}>保存</Button></>}>
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="场所名称" required error={missing ? "请输入场所名称。" : undefined}><Input value={value.name} onChange={event => setValue(previous => ({ ...previous, name: event.target.value }))} placeholder="如 数学办公室、201 教室" aria-invalid={missing} /></Field>
        <Field label="类型"><select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={value.kind} onChange={event => setValue(previous => ({ ...previous, kind: event.target.value as PlaceKind }))}>{Object.entries(PLACE_KIND_LABEL).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></Field>
        {field("building", "楼栋 / 位置", "按原资料填写")}
        {field("area", "区域", "如 东区、A 区")}
        {field("roomCode", "房间编号", "按原资料填写")}
        {field("floor", "楼层（有明确资料时填写）", "未提供可留空")}
      </div>
      {field("usage", "用途 / 使用说明", "如 备课办公、功能教室")}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  </Modal>
}

/* ---------------- 工具 ---------------- */

function flip(s: FoundationStatus): FoundationStatus {
  return s === "active" ? "inactive" : "active"
}
