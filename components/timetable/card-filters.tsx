"use client"

import { Input } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { EMPTY_CARD_FILTERS, changeCardFilterKind, hasCardFilters, type CardFilters } from "@/lib/timetable/display"
import { teacherById, type ProjectedEntry } from "@/lib/timetable/data"
import { Filter } from "lucide-react"

export function TimetableFilterBar({ entries, value, onChange, showTeacher = false, fixedKind }: { entries: ProjectedEntry[]; value: CardFilters; onChange: (value: CardFilters) => void; showTeacher?: boolean; fixedKind?: "class" | "activity" }) {
  type Field = "subject" | "className" | "activityName" | "teacherId"
  const kind = fixedKind ?? value.kind
  const options = (field: Field) => [...new Set(entries.filter(e => field === "activityName" ? e.kind === "activity" : field === "className" || field === "subject" ? e.kind !== "activity" : kind === "all" || (e.kind === "activity") === (kind === "activity")).map(e => field === "activityName" ? e.className : e[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"))
  const select = (field: Field, label: string) => <label className="flex min-w-0 items-center gap-1.5 text-xs">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <select aria-label={`筛选${label}`} value={value[field]} onChange={e => onChange({ ...(e.target.value && field === "activityName" ? changeCardFilterKind(value, "activity") : e.target.value && (field === "className" || field === "subject") ? changeCardFilterKind(value, "class") : value), [field]: e.target.value })} className="h-8 min-w-0 max-w-52 rounded-md border border-input bg-card px-2 text-xs">
      <option value="">全部</option>
      {value[field] && !options(field).includes(value[field]) ? <option value={value[field]}>{field === "teacherId" ? teacherById(value[field])?.name ?? value[field] : value[field]}（本周无课卡）</option> : null}
      {options(field).map(x => <option key={x} value={x}>{field === "teacherId" ? teacherById(x)?.name ?? x : x}</option>)}
    </select>
  </label>
  return <div aria-label="课卡筛选" className="flex flex-wrap items-center gap-x-3 gap-y-2">
    <Filter className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
    {!fixedKind ? <label className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground">类型</span><select aria-label="筛选课卡类型" value={value.kind} onChange={e => onChange(changeCardFilterKind(value, e.target.value as CardFilters["kind"]))} className="h-8 rounded-md border border-input bg-card px-2"><option value="all">课程与活动</option><option value="class">课程</option><option value="activity">活动</option></select></label> : null}
    {kind !== "activity" ? <>{select("subject", "学科")}{select("className", "教学班")}</> : null}
    {kind !== "class" ? select("activityName", "活动") : null}{showTeacher ? select("teacherId", "教师") : null}
    <Input aria-label="搜索课卡" placeholder="名称、分工或场所" value={value.query} onChange={e => onChange({ ...value, query: e.target.value })} className="h-8 w-40 max-w-full text-xs" />
    {hasCardFilters(value) ? <Button variant="ghost" size="xs" onClick={() => onChange({ ...EMPTY_CARD_FILTERS })}>清除筛选</Button> : null}
  </div>
}
