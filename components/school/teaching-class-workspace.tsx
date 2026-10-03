"use client"

import { Badge, EmptyState, Field, Input, Sheet, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TeacherLink } from "@/components/profile/teacher-link"
import { DivisionForm, TeamManager } from "@/components/school/teaching-assign"
import {
  respKey,
  wholeKey,
  classRoster,
  coursesForSubject,
  courseName,
  homeroomName,
  rosterComposition,
  studentsOfHomeroom,
  useHomerooms,
  responsibilitiesOf,
  responsibilityRoster,
  STUDENTS,
  studentById,
  SUBJECTS,
  subjectName,
  suggestClassName,
  TEACHERS,
  teacherName,
  useTeaching,
  type Responsibility,
  type RosterMode,
  type TeachingClass,
} from "@/lib/teaching/store"
import { ArrowLeft, CalendarDays, GraduationCap, Layers, Pencil, Plus, Users, X } from "lucide-react"
import { useMemo, useState } from "react"

type Tab = "arrangements" | "students" | "basic"

const selectClass =
  "w-full cursor-pointer rounded-lg border border-input bg-card px-3 py-2 pr-8 text-[14px] text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"

export function TeachingClassWorkspace({
  classId,
  open,
  onClose,
  initialTask,
  onViewTimetable,
}: {
  classId: string
  open: boolean
  onClose: () => void
  initialTask?: string | null
  onViewTimetable?: (cls: TeachingClass) => void
}) {
  const teaching = useTeaching()
  const cls = teaching.classes.find((c) => c.id === classId)
  const [tab, setTab] = useState<Tab>("arrangements")

  if (!cls) return null

  const subj = subjectName(cls.subjectId)
  const placement = homeroomName(cls.placementHomeroomId)
  const course = courseName(cls.courseId)
  const rosterCount = classRoster(cls).length

  return (
    <Sheet
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title={
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-normal text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            教学班
          </button>
          <span>{cls.name}</span>
        </span>
      }
      desc={`${subj} · 排课归属 ${placement ?? "未设置"} · 本期${course ?? "课程未设置"}`}
    >
      {onViewTimetable ? (
        <div className="mb-4 flex justify-end">
          <Button variant="outline" size="xs" onClick={() => onViewTimetable(cls)}>
            <CalendarDays className="size-3.5" />
            查看课表
          </Button>
        </div>
      ) : null}
      <div className="thin-scroll -mx-1 mb-5 overflow-x-auto px-1">
        <div role="tablist" className="flex min-w-max gap-1 border-b border-border">
          {(
            [
              { id: "arrangements", label: "教学安排", icon: <Layers className="size-4" /> },
              { id: "students", label: "学生名单", icon: <Users className="size-4" /> },
              { id: "basic", label: "基本信息", icon: <Pencil className="size-4" /> },
            ] as const
          ).map((t) => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === "arrangements" ? <ArrangementsTab cls={cls} initialTask={initialTask} /> : null}
      {tab === "students" ? <StudentsTab cls={cls} /> : null}
      {tab === "basic" ? <BasicTab cls={cls} /> : null}
    </Sheet>
  )
}

/* ---------------- 教学安排 ---------------- */

function ArrangementsTab({ cls, initialTask }: { cls: TeachingClass; initialTask?: string | null }) {
  const teaching = useTeaching()
  const { push } = useToast()
  const responsibilities = responsibilitiesOf(teaching, cls.id)
  const [editingCourse, setEditingCourse] = useState(false)
  const [editingTeachers, setEditingTeachers] = useState(false)
  const [respEditor, setRespEditor] = useState<{ id: string | null } | null>(null)

  const rosterCount = classRoster(cls).length

  return (
    <div className="space-y-5">
      {/* 整科：本期课程 / 任课教师 / 学生范围 */}
      <div className="rounded-xl border border-border">
        <RowLine label="本期课程">
          {editingCourse ? (
            <div className="flex items-center gap-2">
              <select
                className={cn(selectClass, "h-8 w-48 py-1")}
                value={cls.courseId ?? ""}
                onChange={(e) => {
                  teaching.setCourse(cls.id, e.target.value || null)
                }}
              >
                <option value="">暂不设置</option>
                {coursesForSubject(cls.subjectId).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button size="xs" variant="ghost" onClick={() => setEditingCourse(false)}>
                完成
              </Button>
            </div>
          ) : cls.courseId ? (
            <div className="flex items-center gap-2">
              <Badge tone="primary">{courseName(cls.courseId)}</Badge>
              <Button size="xs" variant="ghost" onClick={() => setEditingCourse(true)}>
                更改
              </Button>
            </div>
          ) : (
            <Button size="xs" variant="outline" onClick={() => setEditingCourse(true)}>
              设置课程
            </Button>
          )}
        </RowLine>
        <RowLine label="任教团队">
          <TeamManager targetKey={wholeKey(cls.id)} emptyText="未指定（整科任教可留空）" />
        </RowLine>
        <RowLine label="学生范围" last>
          <div className="flex flex-col gap-1">
            <span className="text-[13px]">本班有效学生 {rosterCount} 人</span>
            {rosterComposition(classRoster(cls)).length > 1 ? (
              <span className="text-xs text-muted-foreground">
                来自{" "}
                {rosterComposition(classRoster(cls))
                  .map((c) => `${c.name} ${c.count} 人`)
                  .join(" · ")}
                （跨行政班，可在“学生名单”调整）
              </span>
            ) : null}
          </div>
        </RowLine>
      </div>

      {/* 按需教学分工 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-semibold">教学分工</p>
          <Button size="xs" variant="outline" onClick={() => setRespEditor({ id: null })}>
            <Plus className="size-3.5" />
            添加教学分工
          </Button>
        </div>
        {responsibilities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
            暂无教学分工。普通整科教学直接使用上方安排即可；确需独立教师、学生范围或反馈时再添加分工。
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">分工名称</th>
                  <th className="px-3 py-2 font-medium">任课教师</th>
                  <th className="px-3 py-2 font-medium">学生范围</th>
                  <th className="px-4 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {responsibilities.map((r, i) => {
                  const count = responsibilityRoster(teaching, r).length
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        {r.sharedMark ? (
                          <span className="rounded-md bg-accent px-1.5 py-0.5 text-xs font-semibold text-primary">{r.sharedMark}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">未命名分工 #{i + 1}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {r.teacherIds.length
                          ? r.teacherIds.map((id, j) => (
                              <span key={id}>
                                {j > 0 ? "、" : null}
                                <TeacherLink teacherId={id} className="hover:text-primary hover:underline">
                                  {teacherName(id)}
                                </TeacherLink>
                              </span>
                            ))
                          : "待指定"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {count} 人{r.rosterMode === "INHERIT" ? "（继承本班）" : "（子集）"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="xs" variant="ghost" onClick={() => setRespEditor({ id: r.id })}>
                            编辑
                          </Button>
                          <Button size="xs" variant="ghost" onClick={() => push(`进入教学：${cls.name} · ${r.sharedMark ?? "分工"}（原型工作区）`)}>
                            进入教学
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          分工名称只是可识别的显示文字，不是身份；分工有稳定 ID。团队成员不自动参加每节课，课次授课教师独立核对。
        </p>
      </div>

      {respEditor && respEditor.id === null ? (
        <Sheet
          open
          onClose={() => setRespEditor(null)}
          width="max-w-lg"
          title="添加教学分工"
          desc="新建分工与安排任教一次提交；可暂不安排教师"
        >
          <DivisionForm
            cls={cls}
            mode="direct"
            onCancel={() => setRespEditor(null)}
            onSubmitted={(msg) => {
              push(msg)
              setRespEditor(null)
            }}
          />
        </Sheet>
      ) : null}
      {respEditor && respEditor.id ? (
        <ResponsibilityEditor cls={cls} respId={respEditor.id} onClose={() => setRespEditor(null)} />
      ) : null}
    </div>
  )
}

function RowLine({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 px-4 py-3", !last && "border-b border-border")}>
      <span className="w-20 shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function TeacherMultiPicker({
  value,
  onChange,
  onDone,
}: {
  value: string[]
  onChange: (ids: string[]) => void
  onDone: () => void
}) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {TEACHERS.map((t) => {
          const on = value.includes(t.id)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              {t.name}
              {!t.accountAvailable ? "（无账号）" : ""}
            </button>
          )
        })}
      </div>
      <Button size="xs" variant="ghost" onClick={onDone}>
        完成
      </Button>
    </div>
  )
}

/* ---------------- 教学分工编辑器 ---------------- */

function ResponsibilityEditor({ cls, respId, onClose }: { cls: TeachingClass; respId: string | null; onClose: () => void }) {
  const teaching = useTeaching()
  const { push } = useToast()
  const existing = respId ? teaching.responsibilities.find((r) => r.id === respId) : null

  const [mark, setMark] = useState(existing?.sharedMark ?? "")
  const [teacherIds, setTeacherIds] = useState<string[]>(existing?.teacherIds ?? [])
  const [rosterMode, setRosterMode] = useState<RosterMode>(existing?.rosterMode ?? "INHERIT")
  const [subset, setSubset] = useState<string[]>(existing?.studentIds ?? [])

  const roster = classRoster(cls)

  function toggleTeacher(id: string) {
    setTeacherIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  function toggleStudent(id: string) {
    setSubset((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  function save() {
    if (!existing) return onClose()
    if (rosterMode === "EXPLICIT_SUBSET" && !subset.length) return push("明确子集至少选择 1 名学生")
    // 任教团队在下方独立办理（带任期），这里只保存分工本身
    teaching.editResponsibility(existing.id, {
      sharedMark: mark.trim() || null,
      rosterMode,
      studentIds: rosterMode === "EXPLICIT_SUBSET" ? subset : [],
    })
    push("已更新教学分工")
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      width="max-w-lg"
      title={existing ? "编辑教学分工" : "添加教学分工"}
      desc={`${cls.name} · 分工有稳定身份，可稍后完善`}
      footer={
        <div className="flex items-center justify-between gap-2">
          {existing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                teaching.removeResponsibility(existing.id)
                push("已删除教学分工")
                onClose()
              }}
            >
              <X className="size-3.5" />
              删除分工
            </Button>
          ) : (
            <span />
          )}
          <Button size="sm" onClick={save}>
            保存分工
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="分工名称" hint="可识别的显示文字（如 P1、S1）；可稍后完善，但要能识别实际任务。">
          <Input value={mark} onChange={(e) => setMark(e.target.value)} placeholder="如：P1" />
        </Field>

        {existing ? (
          <div>
            <p className="mb-1.5 text-[13px] font-medium">任教团队</p>
            <TeamManager targetKey={respKey(existing.id)} />
            <p className="mt-1.5 text-xs text-muted-foreground">任教团队即时生效，与教职工侧“安排任教”是同一份任教关系；每位教师任期独立。</p>
          </div>
        ) : null}

        <div>
          <p className="mb-1.5 text-[13px] font-medium">学生范围</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setRosterMode("INHERIT")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                rosterMode === "INHERIT" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
              )}
            >
              继承本班有效名单（{roster.length} 人）
            </button>
            <button
              type="button"
              onClick={() => setRosterMode("EXPLICIT_SUBSET")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                rosterMode === "EXPLICIT_SUBSET" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
              )}
            >
              明确子集
            </button>
          </div>
          {rosterMode === "EXPLICIT_SUBSET" ? (
            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-border p-2">
              {roster.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">本班暂无有效学生，请先在“学生名单”添加。</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {roster.map((id) => {
                    const st = studentById(id)
                    const on = subset.includes(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleStudent(id)}
                        className={cn(
                          "flex items-center justify-between rounded-md border px-2 py-1 text-left text-xs transition-colors",
                          on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                        )}
                      >
                        <span>{st?.name ?? id}</span>
                        {on ? <span className="text-primary">✓</span> : null}
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="mt-1.5 px-1 text-xs text-muted-foreground">已选 {subset.length} 人。增加班级成员不会自动塞进该子集。</p>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">跟随本班有效名单变化；后续增删本班学生会同步反映。</p>
          )}
        </div>
      </div>
    </Sheet>
  )
}

/* ---------------- 学生名单 ---------------- */

function StudentsTab({ cls }: { cls: TeachingClass }) {
  const teaching = useTeaching()
  const { push } = useToast()
  const homerooms = useHomerooms()
  const roster = classRoster(cls)
  const [query, setQuery] = useState("")
  const [homeFilter, setHomeFilter] = useState("")

  const inRoster = new Set(roster)
  const q = query.trim()
  const candidates =
    q || homeFilter
      ? STUDENTS.filter(
          (st) => !inRoster.has(st.id) && (!homeFilter || st.homeroomId === homeFilter) && (!q || st.name.includes(q)),
        ).slice(0, 24)
      : []

  function addOne(id: string) {
    teaching.setClassStudents(cls.id, [...cls.studentIds, id])
    push(`已添加 ${studentById(id)?.name ?? id}`)
  }
  function removeOne(id: string) {
    teaching.setClassStudents(
      cls.id,
      cls.studentIds.filter((x) => x !== id),
    )
    push(`已移出 ${studentById(id)?.name ?? id}`)
  }

  const byHomeroom = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const id of roster) {
      const st = studentById(id)
      if (!st) continue
      const arr = map.get(st.homeroomId) ?? []
      arr.push(id)
      map.set(st.homeroomId, arr)
    }
    return map
  }, [roster])

  const composition = rosterComposition(roster)
  const outsidePlacement = cls.placementHomeroomId
    ? roster.filter((id) => studentById(id)?.homeroomId !== cls.placementHomeroomId).length
    : 0
  const filterRoom = homeFilter ? homerooms.find((h) => h.id === homeFilter) : undefined
  const filterRoomAll = homeFilter ? studentsOfHomeroom(homeFilter) : []
  const filterRoomMissing = filterRoomAll.filter((st) => !inRoster.has(st.id)).length

  function removeHomeroom(hid: string) {
    const drop = new Set(studentsOfHomeroom(hid).map((st) => st.id))
    const before = cls.studentIds.length
    teaching.setClassStudents(
      cls.id,
      cls.studentIds.filter((id) => !drop.has(id)),
    )
    push(`已移出 ${homeroomName(hid)} 的 ${before - cls.studentIds.filter((id) => !drop.has(id)).length} 名学生`)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-[13px]">
          本班有效学生 <strong>{roster.length}</strong> 人
          {composition.length > 0 && (
            <span className="text-muted-foreground">
              {" = "}
              {composition.map((c) => `${c.name} ${c.count}`).join(" + ")}
            </span>
          )}
        </p>
        {outsidePlacement > 0 && (
          <p className="text-xs text-muted-foreground">
            其中 {outsidePlacement} 人不属于排课归属「{homeroomName(cls.placementHomeroomId)}」。跨班走班属正常情况；若是误加，可在下方按行政班整组移出。
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-[13px] font-medium">添加学生</p>
        <div className="flex flex-wrap gap-2">
          <select
            className={cn(selectClass, "h-9 w-40 py-1")}
            value={homeFilter}
            onChange={(e) => setHomeFilter(e.target.value)}
            aria-label="选择行政班"
          >
            <option value="">全部行政班</option>
            {homerooms.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}（{studentsOfHomeroom(h.id).length} 人）
              </option>
            ))}
          </select>
          <Input
            className="h-9 min-w-40 flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入学生姓名搜索"
            aria-label="搜索学生姓名"
          />
          {filterRoom && (
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              disabled={filterRoomMissing === 0}
              onClick={() => {
                const n = teaching.addStudentsFromHomeroom(cls.id, filterRoom.id)
                push(`已从 ${filterRoom.name} 添加 ${n} 名学生`)
              }}
            >
              <Plus className="size-3.5" />
              {filterRoomAll.length === 0
                ? "该班暂无学生"
                : filterRoomMissing === 0
                  ? "该班已全部在名单"
                  : `添加该班其余 ${filterRoomMissing} 人`}
            </Button>
          )}
        </div>
        {q || homeFilter ? (
          candidates.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {candidates.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => addOne(st.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/5"
                >
                  <Plus className="size-3" />
                  {st.name}
                  <span className="text-muted-foreground">· {homeroomName(st.homeroomId)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">没有可添加的匹配学生（已在名单中的学生不再列出）。</p>
          )
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">选择行政班或输入姓名，点击候选学生即可逐个加入本班。</p>
        )}
      </div>

      {roster.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-6" />}
          title="尚无学生"
          desc="“排课归属”不会自动加入行政班全体。在上方选择行政班后整班添加，或按姓名逐个添加。"
        />
      ) : (
        <div className="space-y-4">
          {Array.from(byHomeroom.entries()).map(([hid, ids]) => (
            <div key={hid}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {homeroomName(hid)} · {ids.length} 人
                </p>
                <button
                  type="button"
                  onClick={() => removeHomeroom(hid)}
                  className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                >
                  整组移出
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ids.map((id) => {
                  const name = studentById(id)?.name ?? id
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 py-1 pl-2 pr-1 text-xs"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => removeOne(id)}
                        aria-label={`移出 ${name}`}
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- 基本信息 ---------------- */

function BasicTab({ cls }: { cls: TeachingClass }) {
  const teaching = useTeaching()
  const { push } = useToast()
  const homerooms = useHomerooms()
  const [name, setName] = useState(cls.name)

  const suggestion = suggestClassName(cls.subjectId, cls.placementHomeroomId)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="学科" hint="学科为核心字段；本期课程按学科筛选目录。">
          <select className={selectClass} value={cls.subjectId} disabled>
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="排课归属行政班" hint="修改只改变归属安排视图，不移动学生行政归属或教学名单。">
          <select
            className={selectClass}
            value={cls.placementHomeroomId ?? ""}
            onChange={(e) => teaching.setPlacement(cls.id, e.target.value || null)}
          >
            <option value="">不关联</option>
            {homerooms.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="教学班名称" hint="改名称不改归属、学生、教师或分工。">
        <div className="flex items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              teaching.renameClass(cls.id, name, name.trim() !== suggestion)
              push("已更新名称")
            }}
          >
            保存
          </Button>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="本期课程" hint="修改课程不改名称。">
          <select
            className={selectClass}
            value={cls.courseId ?? ""}
            onChange={(e) => teaching.setCourse(cls.id, e.target.value || null)}
          >
            <option value="">暂不设置</option>
            {coursesForSubject(cls.subjectId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="开课期间">
          <Input value={`${cls.validFrom} – ${cls.validToExclusive}`} readOnly className="text-muted-foreground" />
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        不出现 AUTO/CUSTOM 与官方单元建组模式。学科为核心字段；已发布/已发生事实维持记录的正常版本边界。
      </p>
    </div>
  )
}
