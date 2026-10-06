"use client"

import { Field, Input, Select } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { DEPARTMENT_ITEMS, JOB_TITLE_ITEMS } from "@/lib/demo/foundation"
import type { EducationExperience, WorkExperience } from "@/lib/demo/staff"
import { checkPersonNo, nextPersonNo, registerIssued, yyyymmOf } from "@/lib/school/person-no"
import { BriefcaseBusiness, GraduationCap, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { PersonNoField } from "./person-no-field"
import { SearchSelect, type SearchOption } from "./search-select"

const DEPT_OPTIONS: SearchOption[] = DEPARTMENT_ITEMS.map((item) => ({ value: item.name, label: item.name, inactive: item.status === "inactive" }))
const JOB_OPTIONS: SearchOption[] = JOB_TITLE_ITEMS.map((item) => ({ value: item.name, label: item.name, inactive: item.status === "inactive" }))
const EDUCATION_LEVELS = ["未填写", "高中/中专及以下", "大专", "本科", "硕士研究生", "博士研究生", "其他"]
const INTEREST_SUGGESTIONS = ["阅读", "摄影", "徒步", "音乐", "书法"]
export type NumberIntent = "none" | "auto" | "manual"

export interface StaffFormState {
  name: string
  numberIntent: NumberIntent
  customNo: string
  department: string | null
  jobTitle: string | null
  joinedAt: string
  email: string
  phone: string
  englishName: string
  gender: string
  educationLevel: string
  firstWorkAt: string
  educationExperiences: EducationExperience[]
  workExperiences: WorkExperience[]
  wechat: string
  interests: string[]
  interestExtra: string
  touched: boolean
}

export function initialStaffForm(): StaffFormState {
  return {
    name: "", numberIntent: "none", customNo: "", department: null, jobTitle: null, joinedAt: "", email: "", phone: "",
    englishName: "", gender: "未填写", educationLevel: "未填写", firstWorkAt: "", educationExperiences: [], workExperiences: [],
    wechat: "", interests: [], interestExtra: "", touched: false,
  }
}

export function useStaffForm(initial?: Partial<StaffFormState>) {
  const [state, setState] = useState<StaffFormState>({ ...initialStaffForm(), ...initial })
  const set = <K extends keyof StaffFormState>(key: K, value: StaffFormState[K]) => setState((current) => ({ ...current, [key]: value }))
  const nameValid = state.name.trim().length > 0
  const noCheck = checkPersonNo(state.customNo, "E", state.joinedAt)
  const noValid = state.numberIntent === "none" || (state.numberIntent === "auto" ? !!yyyymmOf(state.joinedAt) : noCheck.status === "valid")
  function issueNo() {
    if (state.numberIntent === "none") return ""
    const no = state.numberIntent === "manual" && noCheck.status === "valid" ? state.customNo : nextPersonNo("E", yyyymmOf(state.joinedAt)!)
    registerIssued(no, "E")
    return no
  }
  return { state, set, setState, nameValid, noValid, issueNo, displayName: state.name.trim() || "新教职工", jobLabel: state.jobTitle ?? "" }
}

export function StaffFormFields({ state, set }: { state: StaffFormState; set: <K extends keyof StaffFormState>(key: K, value: StaffFormState[K]) => void; canMaintainCatalog?: boolean }) {
  const [showMore, setShowMore] = useState(false)
  const nameMissing = state.touched && !state.name.trim()
  const patchEducation = (id: string, patch: Partial<EducationExperience>) => set("educationExperiences", state.educationExperiences.map((item) => item.id === id ? { ...item, ...patch } : item))
  const patchWork = (id: string, patch: Partial<WorkExperience>) => set("workExperiences", state.workExperiences.map((item) => item.id === id ? { ...item, ...patch } : item))

  return <div className="space-y-4">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="姓名" required error={nameMissing ? "请输入姓名。" : undefined} className="sm:col-span-2">
        <Input value={state.name} onChange={(event) => set("name", event.target.value)} placeholder="如 王老师" aria-invalid={nameMissing} />
      </Field>
      <Field label="英文名 / 常用名（可选）">
        <Input value={state.englishName} onChange={(event) => set("englishName", event.target.value)} placeholder="辅助称呼与检索" />
      </Field>
      <Field label="联系电话（可选）"><Input value={state.phone} onChange={(event) => set("phone", event.target.value)} /></Field>
      <Field label="所属部门（可选）">
        <SearchSelect value={state.department} onChange={(value) => set("department", value)} options={DEPT_OPTIONS} placeholder="搜索部门 / 可不填写" />
      </Field>
      <Field label="当前职务（可选）">
        <SearchSelect value={state.jobTitle} onChange={(value) => set("jobTitle", value)} options={JOB_OPTIONS} placeholder="搜索职务 / 可不填写" />
      </Field>
      <Field label="首次入职年月（可选）" hint="第一次正式加入当前学校；与首次参加工作时间不同。">
        <Input type="month" value={state.joinedAt.slice(0, 7)} onChange={(event) => set("joinedAt", event.target.value)} />
      </Field>
      <Field label="邮箱（可选）"><Input type="email" value={state.email} onChange={(event) => set("email", event.target.value)} /></Field>
    </div>

    <div className="rounded-xl border border-border p-3">
      <p className="text-[13px] font-semibold">员工编号</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="员工编号方式">
        {([{ value: "none", label: "暂不编号" }, { value: "auto", label: "自动生成" }, { value: "manual", label: "手工填写" }] as const).map((option) =>
          <Button key={option.value} type="button" size="sm" variant={state.numberIntent === option.value ? "default" : "outline"} onClick={() => set("numberIntent", option.value)}>{option.label}</Button>)}
      </div>
      {state.numberIntent === "none" ? <p className="mt-2 text-xs text-muted-foreground">保存后显示“待编号”，不会占用号段，也不会因后补日期自动发号。</p> : null}
      {state.numberIntent === "auto" ? <p className="mt-2 text-xs text-muted-foreground">保存时按本校首次入职年月生成；未填写年月时不能生成。</p> : null}
      {state.numberIntent === "manual" ? <div className="mt-3"><PersonNoField type="E" value={state.customNo} onChange={(value) => set("customNo", value)} sourceDate={state.joinedAt} showErrors={state.touched} /></div> : null}
    </div>

    <div className="rounded-xl border border-border">
      <button type="button" onClick={() => setShowMore((value) => !value)} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-medium">
        更多资料（可选）<span className="text-xs text-muted-foreground">{showMore ? "收起" : "展开"}</span>
      </button>
      {showMore ? <div className="space-y-5 border-t border-border p-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="性别"><Select value={state.gender} onChange={(event) => set("gender", event.target.value)}>{["未填写", "男", "女"].map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="学历"><Select value={state.educationLevel} onChange={(event) => set("educationLevel", event.target.value)}>{EDUCATION_LEVELS.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="首次参加工作年月" hint="个人第一次参加工作，不用于本校工号。"><Input type="month" value={state.firstWorkAt} onChange={(event) => set("firstWorkAt", event.target.value)} /></Field>
          <Field label="微信号"><Input value={state.wechat} onChange={(event) => set("wechat", event.target.value)} /></Field>
        </div>

        <ExperienceSection icon={GraduationCap} title="教育经历" addLabel="添加教育经历" onAdd={() => set("educationExperiences", [...state.educationExperiences, { id: crypto.randomUUID() }])}>
          {state.educationExperiences.map((item) => <div key={item.id} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-3">
            <Input value={item.school ?? ""} onChange={(event) => patchEducation(item.id, { school: event.target.value })} placeholder="毕业学校 / 就读院校" />
            <Input value={item.major ?? ""} onChange={(event) => patchEducation(item.id, { major: event.target.value })} placeholder="专业" />
            <div className="flex gap-2"><Input value={item.graduation ?? ""} onChange={(event) => patchEducation(item.id, { graduation: event.target.value })} placeholder="毕业时间，如 2014 或 2014-06" /><RemoveButton label="移除教育经历" onClick={() => set("educationExperiences", state.educationExperiences.filter((entry) => entry.id !== item.id))} /></div>
          </div>)}
        </ExperienceSection>

        <ExperienceSection icon={BriefcaseBusiness} title="过往工作经历" addLabel="添加工作经历" onAdd={() => set("workExperiences", [...state.workExperiences, { id: crypto.randomUUID() }])}>
          {state.workExperiences.map((item) => <div key={item.id} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
            <Input value={item.organization ?? ""} onChange={(event) => patchWork(item.id, { organization: event.target.value })} placeholder="工作单位" />
            <Input value={item.role ?? ""} onChange={(event) => patchWork(item.id, { role: event.target.value })} placeholder="当时岗位 / 职务" />
            <Input value={item.start ?? ""} onChange={(event) => patchWork(item.id, { start: event.target.value })} placeholder="开始，如 2018 或 2018-09" />
            <div className="flex gap-2"><Input value={item.end ?? ""} onChange={(event) => patchWork(item.id, { end: event.target.value })} placeholder="结束（可空）" /><RemoveButton label="移除工作经历" onClick={() => set("workExperiences", state.workExperiences.filter((entry) => entry.id !== item.id))} /></div>
            {item.start && item.end && item.end < item.start ? <p className="text-xs text-destructive sm:col-span-2">结束时间不能早于开始时间。</p> : null}
          </div>)}
        </ExperienceSection>

        <Field label="兴趣爱好"><div className="flex flex-wrap gap-2">{INTEREST_SUGGESTIONS.map((tag) => <Button key={tag} type="button" size="sm" variant={state.interests.includes(tag) ? "default" : "outline"} onClick={() => set("interests", state.interests.includes(tag) ? state.interests.filter((item) => item !== tag) : [...state.interests, tag])}>{tag}</Button>)}</div><Input className="mt-2" value={state.interestExtra} onChange={(event) => set("interestExtra", event.target.value)} placeholder="可补充其他，逗号分隔" /></Field>
        <p className="text-xs text-muted-foreground">背景资料可全部留空，不自动公开到教师主页或普通名单，也不改变资格、职责或在职状态。</p>
      </div> : null}
    </div>
  </div>
}

function ExperienceSection({ icon: Icon, title, addLabel, onAdd, children }: { icon: typeof GraduationCap; title: string; addLabel: string; onAdd: () => void; children: React.ReactNode }) {
  return <section className="space-y-2"><div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-[13px] font-semibold"><Icon className="size-4 text-muted-foreground" />{title}</h3><Button type="button" size="sm" variant="outline" onClick={onAdd}><Plus className="size-3.5" />{addLabel}</Button></div>{children}</section>
}
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) { return <Button type="button" size="icon" variant="ghost" aria-label={label} onClick={onClick}><Trash2 className="size-4" /></Button> }
