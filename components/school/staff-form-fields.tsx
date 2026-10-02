"use client"

import { Field, Input, Select } from "@/components/kit"
import { DEPARTMENT_ITEMS, JOB_TITLE_ITEMS } from "@/lib/demo/foundation"
import { cn } from "@/lib/utils"
import { CalendarClock } from "lucide-react"
import { checkPersonNo, nextPersonNo, registerIssued, yyyymmOf } from "@/lib/school/person-no"
import { useState } from "react"
import { PersonNoField } from "./person-no-field"
import { SearchSelect, type SearchOption } from "./search-select"

/**
 * P03 统一新增 / 编辑教职工表单字段。
 * 两处入口（教职工页、邀请流程内）复用同一组件：相同字段、顺序、标签、必填规则、
 * 默认值、编号高级选项与“更多资料”；仅“返回位置”和“完成按钮”不同（各入口自行提供）。
 * 仅建档：不含系统角色勾选、密码、业务对象、职称 / 工资。
 */

// 部门 / 职务候选来自基础资料；停用条目不作为新候选（由 SearchSelect 过滤）
const DEPT_OPTIONS: SearchOption[] = DEPARTMENT_ITEMS.map((d) => ({
  value: d.name,
  label: d.name,
  inactive: d.status === "inactive",
}))
const JOB_OPTIONS: SearchOption[] = JOB_TITLE_ITEMS.map((j) => ({
  value: j.name,
  label: j.name,
  inactive: j.status === "inactive",
}))

const INTEREST_SUGGESTIONS = ["阅读", "摄影", "徒步", "音乐", "书法"]
const STRENGTH_SUGGESTIONS = ["演讲", "编程", "活动组织", "竞赛辅导"]

export interface StaffFormState {
  name: string
  useCustomNo: boolean
  customNo: string
  department: string | null // 已选常用部门（null = 不填写）
  jobMode: "common" | "custom" // 职务：选常用 / 本条补充
  jobTitle: string | null // 常用职务（jobMode=common）
  jobCustom: string // 本条补充职务（jobMode=custom）
  joinedAt: string
  email: string
  phone: string
  gender: string
  englishName: string
  wechat: string
  interests: string[]
  interestExtra: string
  strengths: string[]
  strengthExtra: string
  touched: boolean
}

export function initialStaffForm(): StaffFormState {
  return {
    name: "",
    useCustomNo: false,
    customNo: "",
    department: null,
    jobMode: "common",
    jobTitle: null,
    jobCustom: "",
    joinedAt: "2026-09-23",
    email: "",
    phone: "",
    gender: "未填写",
    englishName: "",
    wechat: "",
    interests: [],
    interestExtra: "",
    strengths: [],
    strengthExtra: "",
    touched: false,
  }
}

export function useStaffForm(initial?: Partial<StaffFormState>) {
  const [state, setState] = useState<StaffFormState>({ ...initialStaffForm(), ...initial })
  const set = <K extends keyof StaffFormState>(key: K, value: StaffFormState[K]) =>
    setState((s) => ({ ...s, [key]: value }))
  const nameValid = state.name.trim().length > 0
  const noCheck = checkPersonNo(state.customNo, "E", state.joinedAt)
  const noValid = noCheck.status !== "invalid" && (noCheck.status === "valid" || !!yyyymmOf(state.joinedAt))
  const displayName = state.name.trim() || "新教职工"
  const jobLabel = state.jobMode === "common" ? state.jobTitle ?? "" : state.jobCustom.trim()
  // 创建成功时确定正式编号：手工编号原样使用；留空则按首次正式入职年月从教职工流水号池取号
  function issueNo(): string {
    const no = noCheck.status === "valid" ? state.customNo : nextPersonNo("E", yyyymmOf(state.joinedAt)!)
    registerIssued(no, "E")
    return no
  }
  return { state, set, setState, nameValid, noValid, issueNo, displayName, jobLabel }
}

export function StaffFormFields({
  state,
  set,
  canMaintainCatalog = true,
}: {
  state: StaffFormState
  set: <K extends keyof StaffFormState>(key: K, value: StaffFormState[K]) => void
  canMaintainCatalog?: boolean
}) {
  const nameMissing = state.touched && !state.name.trim()
  const [showMore, setShowMore] = useState(false)
  // 就地新增到候选（演示态，仅本表单局部）
  const [extraDepts, setExtraDepts] = useState<SearchOption[]>([])
  const [extraJobs, setExtraJobs] = useState<SearchOption[]>([])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        {/* 1. 姓名 */}
        <Field label="姓名" required error={nameMissing ? "请输入姓名。" : undefined} className="sm:col-span-2">
          <Input
            value={state.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="如 王老师"
            aria-invalid={nameMissing}
          />
        </Field>

        {/* 2. 员工编号 */}
        <PersonNoField
          type="E"
          value={state.customNo}
          onChange={(v) => set("customNo", v)}
          sourceDate={state.joinedAt}
          showErrors={state.touched}
          className="sm:col-span-2"
        />

        {/* 3. 所属部门 */}
        <Field label="所属部门（可选）">
          <SearchSelect
            value={state.department}
            onChange={(v) => set("department", v)}
            options={[...DEPT_OPTIONS, ...extraDepts]}
            placeholder="搜索部门 / 可不填写"
            canCreate={canMaintainCatalog}
            onCreate={(name) => {
              setExtraDepts((prev) => (prev.some((d) => d.value === name) ? prev : [...prev, { value: name, label: name }]))
              return name
            }}
          />
        </Field>

        {/* 4. 职务（常用 / 本条补充） */}
        <Field label="职务（可选）">
          <div className="mb-2 inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs">
            {[
              { k: "common", label: "选择常用职务" },
              { k: "custom", label: "其他，填写本次职务" },
            ].map((m) => (
              <button
                key={m.k}
                type="button"
                onClick={() => set("jobMode", m.k as StaffFormState["jobMode"])}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  state.jobMode === m.k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          {state.jobMode === "common" ? (
            <SearchSelect
              value={state.jobTitle}
              onChange={(v) => set("jobTitle", v)}
              options={[...JOB_OPTIONS, ...extraJobs]}
              placeholder="搜索常用职务"
              canCreate={canMaintainCatalog}
              emptyHint="未找到常用职务。"
              onCreate={(name) => {
                setExtraJobs((prev) => (prev.some((j) => j.value === name) ? prev : [...prev, { value: name, label: name }]))
                return name
              }}
            />
          ) : (
            <>
              <Input
                value={state.jobCustom}
                onChange={(e) => set("jobCustom", e.target.value)}
                placeholder="仅本条人员的职务文字，如 科学活动顾问"
              />
              <p className="mt-1 text-xs text-muted-foreground/70">
                仅记录到本人档案，不加入全校通用职务；如需成为常用职务请由有维护权者在“基础资料”新增。
              </p>
            </>
          )}
        </Field>

        {/* 5. 入职日期 */}
        <Field label="首次正式入职日期" hint="决定员工编号中的 YYYYMM；不是录入或创建时间。">
          <div className="relative">
            <CalendarClock className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={state.joinedAt} onChange={(e) => set("joinedAt", e.target.value)} className="pl-9" />
          </div>
        </Field>

        {/* 6. 邮箱、联系电话（两个独立可选字段） */}
        <Field label="邮箱（可选）">
          <Input
            value={state.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="如 name@demo.school"
            type="email"
          />
          <p className="mt-1 text-xs text-muted-foreground/70">工作联系用；不等于登录名或账号恢复渠道。</p>
        </Field>

        <Field label="联系电话（可选）">
          <Input value={state.phone} onChange={(e) => set("phone", e.target.value)} placeholder="可选" />
        </Field>
      </div>

      {/* 7. 更多资料（可选） */}
      <div className="rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          更多资料（可选）
          <span className="text-xs text-muted-foreground/70">{showMore ? "收起" : "展开"}</span>
        </button>
        {showMore ? (
          <div className="space-y-4 border-t border-border p-3">
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              <Field label="性别">
                <Select value={state.gender} onChange={(e) => set("gender", e.target.value)}>
                  {["未填写", "男", "女"].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </Select>
              </Field>
              <Field label="英文名 / 常用名">
                <Input value={state.englishName} onChange={(e) => set("englishName", e.target.value)} placeholder="辅助称呼与检索" />
              </Field>
              <Field label="微信号" className="sm:col-span-2">
                <Input value={state.wechat} onChange={(e) => set("wechat", e.target.value)} placeholder="仅联系方式，不等于微信登录" />
              </Field>
            </div>

            <TagField
              label="兴趣爱好"
              suggestions={INTEREST_SUGGESTIONS}
              selected={state.interests}
              extra={state.interestExtra}
              onToggle={(tag) =>
                set(
                  "interests",
                  state.interests.includes(tag) ? state.interests.filter((t) => t !== tag) : [...state.interests, tag],
                )
              }
              onExtra={(v) => set("interestExtra", v)}
            />
            <TagField
              label="特长 / 擅长领域"
              suggestions={STRENGTH_SUGGESTIONS}
              selected={state.strengths}
              extra={state.strengthExtra}
              onToggle={(tag) =>
                set(
                  "strengths",
                  state.strengths.includes(tag) ? state.strengths.filter((t) => t !== tag) : [...state.strengths, tag],
                )
              }
              onExtra={(v) => set("strengthExtra", v)}
              hint="特长不自动授予资格、任课或管理权。"
            />
            <p className="text-xs text-muted-foreground/70">
              可留空、可清空；这些个人补充资料默认不进入列表，也不默认向学生、家长公开。
            </p>
          </div>
        ) : null}
      </div>

      <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground/70">
        先建立人员档案，账号与职责可稍后安排。
      </p>
    </div>
  )
}

function TagField({
  label,
  suggestions,
  selected,
  extra,
  onToggle,
  onExtra,
  hint,
}: {
  label: string
  suggestions: string[]
  selected: string[]
  extra: string
  onToggle: (tag: string) => void
  onExtra: (v: string) => void
  hint?: string
}) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((tag) => {
          const active = selected.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              {tag}
            </button>
          )
        })}
      </div>
      <Input value={extra} onChange={(e) => onExtra(e.target.value)} placeholder="可补充其他，逗号分隔" className="mt-2" />
      {hint ? <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p> : null}
    </Field>
  )
}
