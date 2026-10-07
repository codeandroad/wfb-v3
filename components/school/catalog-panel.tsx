"use client"

import { Badge, Card, EmptyState, Field, Input, Modal, Segmented, Select, Sheet, Textarea, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  CATALOG_COURSES,
  CATALOG_SUBJECTS,
  CATALOG_UNITS,
  type CatalogCourse,
  type CatalogSubject,
  type CatalogUnit,
} from "@/lib/demo/school"
import { BookMarked, Boxes, GraduationCap, Layers, Pencil, Plus, Trash2, Upload, Users } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { DutyArrangeSheet } from "./duty-arrange-sheet"
import { ListToolbar, type FilterGroup, type FilterState } from "./list-toolbar"

type CatTab = "subjects" | "courses" | "units"

const UNIT_STAGE_OPTIONS = [
  { value: "IAS", label: "AS / IAS" },
  { value: "IA2", label: "A2 / IA2" },
  { value: "IGCSE", label: "IGCSE" },
] satisfies { value: CatalogUnit["stage"]; label: string }[]

const UNIT_NATURE_OPTIONS = [
  { value: "官方模块", label: "官方模块" },
  { value: "官方试卷", label: "官方试卷" },
  { value: "校内板块", label: "校内板块" },
] satisfies { value: CatalogUnit["nature"]; label: string }[]

const UNIT_RULE_OPTIONS = [
  { value: "必修", label: "必修" },
  { value: "路径必修", label: "路径必修" },
  { value: "选修", label: "选修" },
] satisfies { value: CatalogUnit["rule"]; label: string }[]

// 生成下一个可用条目代码，如 S011 / C902 / U911
function nextCode(prefix: string, existing: { code: string }[]) {
  const nums = existing
    .map((e) => Number.parseInt(e.code.replace(/[^0-9]/g, ""), 10))
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `${prefix}${String(max + 1).padStart(3, "0")}`
}

export function CatalogPanel() {
  const [tab, setTab] = useState<CatTab>("subjects")
  const { push } = useToast()

  // 目录数据提升为本地状态，支持管理员增删改（演示态，不写入真实系统）
  const [subjects, setSubjects] = useState<CatalogSubject[]>(CATALOG_SUBJECTS)
  const [courses, setCourses] = useState<CatalogCourse[]>(CATALOG_COURSES)
  const [units, setUnits] = useState<CatalogUnit[]>(CATALOG_UNITS)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<CatTab>
          ariaLabel="课程目录分区"
          value={tab}
          onChange={setTab}
          options={[
            { value: "subjects", label: "学科" },
            { value: "courses", label: "课程" },
            { value: "units", label: "单元库" },
          ]}
        />
        <Button variant="outline" size="sm" onClick={() => push("演示：课程目录导入流程（未写入真实系统）")}>
          <Upload className="size-3.5" />
          从模板导入
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<GraduationCap className="size-4" />} n={subjects.length} label="学科" />
        <StatCard icon={<BookMarked className="size-4" />} n={courses.length} label="课程（演示子集）" />
        <StatCard icon={<Boxes className="size-4" />} n={units.length} label="单元" />
      </div>

      {tab === "subjects" ? (
        <SubjectsList subjects={subjects} courses={courses} setSubjects={setSubjects} />
      ) : null}
      {tab === "courses" ? (
        <CoursesList subjects={subjects} courses={courses} units={units} setCourses={setCourses} />
      ) : null}
      {tab === "units" ? (
        <UnitsList units={units} courses={courses} setUnits={setUnits} />
      ) : null}

      <p className="text-xs text-muted-foreground">
        目录沿用导入工作簿 v3.0 的结构，并补充官方大纲信息。官方试卷用于展示考核组成，不代表独立模块资格；路径必修指选定分层路径后必考。文件内 S/C/U 标记仅在目录内连线，不是学校永久代码或数据库
        ID；此处的增删改仅在本次演示中生效，不代表本校已批准开设。
      </p>
    </div>
  )
}

function StatCard({ icon, n, label }: { icon: React.ReactNode; n: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <div>
        <p className="text-[20px] font-semibold leading-none">{n}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="编辑">
        <Pencil className="size-3.5" />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={onDelete} aria-label="删除">
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

/* ---------------- 学科 ---------------- */

function SubjectsList({
  subjects,
  courses,
  setSubjects,
}: {
  subjects: CatalogSubject[]
  courses: CatalogCourse[]
  setSubjects: React.Dispatch<React.SetStateAction<CatalogSubject[]>>
}) {
  const { push } = useToast()
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})
  const [editing, setEditing] = useState<CatalogSubject | "new" | null>(null)
  const [del, setDel] = useState<CatalogSubject | null>(null)

  const groups: FilterGroup[] = [
    {
      key: "hasCourse",
      label: "课程情况",
      options: [
        { value: "has", label: "已开设课程" },
        { value: "none", label: "暂无课程" },
      ],
    },
  ]

  const rows = subjects.filter((s) => {
    const matchQ = !q || s.name.includes(q) || s.en.toLowerCase().includes(q.toLowerCase())
    const fHas = filters.hasCourse ?? []
    const count = courses.filter((c) => c.subjectCode === s.code).length
    const matchHas = !fHas.length || fHas.includes(count > 0 ? "has" : "none")
    return matchQ && matchHas
  })

  return (
    <Card>
      <div className="px-5 py-4">
        <ListToolbar
          search={q}
          onSearch={setQ}
          searchPlaceholder="搜索学科名称或英文名"
          groups={groups}
          value={filters}
          onChange={setFilters}
          resultCount={rows.length}
          totalCount={subjects.length}
          right={
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-3.5" />
              新增学科
            </Button>
          }
        />
      </div>
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-[13px]">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-2.5 font-medium">标记</th>
              <th className="px-3 py-2.5 font-medium">学科</th>
              <th className="px-3 py-2.5 font-medium">英文名称</th>
              <th className="px-3 py-2.5 font-medium">课程数</th>
              <th className="px-3 py-2.5 font-medium">说明</th>
              <th className="px-5 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const count = courses.filter((c) => c.subjectCode === s.code).length
              return (
                <tr key={s.code} className="border-t border-border">
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{s.code}</td>
                  <td className="px-3 py-3 font-medium">{s.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{s.en}</td>
                  <td className="px-3 py-3 text-muted-foreground">{count}</td>
                  <td className="px-3 py-3 text-muted-foreground">{s.note}</td>
                  <td className="px-5 py-3">
                    <RowActions onEdit={() => setEditing(s)} onDelete={() => setDel(s)} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState icon={<GraduationCap className="size-6" />} title="没有匹配的学科" desc="调整搜索或新增学科。" />
        </div>
      ) : null}

      <SubjectForm
        open={editing !== null}
        initial={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSave={(data) => {
          setSubjects((list) => {
            if (editing && editing !== "new") return list.map((x) => (x.code === editing.code ? { ...x, ...data } : x))
            return [...list, { ...data, code: nextCode("S", list), order: (list.length + 1) * 10, courses: 0 }]
          })
          push(editing === "new" ? "已新增学科" : "已保存学科修改")
          setEditing(null)
        }}
      />

      <ConfirmDelete
        open={!!del}
        title="删除学科"
        desc={del ? `确认删除「${del.name}」？此操作在演示中不可撤销。` : ""}
        onClose={() => setDel(null)}
        onConfirm={() => {
          if (!del) return
          if (courses.some((c) => c.subjectCode === del.code)) {
            push("该学科下仍有课程，请先删除或转移这些课程")
            setDel(null)
            return
          }
          setSubjects((list) => list.filter((x) => x.code !== del.code))
          push("已删除学科")
          setDel(null)
        }}
      />
    </Card>
  )
}

function SubjectForm({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial: CatalogSubject | null
  onClose: () => void
  onSave: (data: Omit<CatalogSubject, "code" | "order" | "courses">) => void
}) {
  const { push } = useToast()
  const [name, setName] = useState("")
  const [en, setEn] = useState("")
  const [note, setNote] = useState("校内学科分类；课程体系与考试局在课程层区分")

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setEn(initial?.en ?? "")
      setNote(initial?.note ?? "校内学科分类；课程体系与考试局在课程层区分")
    }
  }, [open, initial])

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? "编辑学科" : "新增学科"}
      desc="学科为校内分类层，课程体系与考试局在课程层区分。"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) {
                push("请填写学科名称")
                return
              }
              onSave({ name: name.trim(), en: en.trim(), note: note.trim() })
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="学科名称">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：地理" />
        </Field>
        <Field label="英文名称">
          <Input value={en} onChange={(e) => setEn(e.target.value)} placeholder="例如：Geography" />
        </Field>
        <Field label="说明">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </Field>
      </div>
    </Sheet>
  )
}

/* ---------------- 课程 ---------------- */

function CoursesList({
  subjects,
  courses,
  units,
  setCourses,
}: {
  subjects: CatalogSubject[]
  courses: CatalogCourse[]
  units: CatalogUnit[]
  setCourses: React.Dispatch<React.SetStateAction<CatalogCourse[]>>
}) {
  const { push } = useToast()
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})
  const [active, setActive] = useState<CatalogCourse | null>(null)
  const [editing, setEditing] = useState<CatalogCourse | "new" | null>(null)
  const [del, setDel] = useState<CatalogCourse | null>(null)
  const [arrangeCourse, setArrangeCourse] = useState<CatalogCourse | null>(null)

  const groups: FilterGroup[] = useMemo(() => {
    const uniq = (vals: string[]) => Array.from(new Set(vals.filter(Boolean)))
    return [
      {
        key: "subject",
        label: "学科",
        options: subjects.map((s) => ({ value: s.code, label: s.name })),
      },
      {
        key: "board",
        label: "考试局 / 机构",
        options: uniq(courses.map((c) => c.board)).map((v) => ({ value: v, label: v })),
      },
    ]
  }, [subjects, courses])

  const rows = useMemo(() => {
    const fSubject = filters.subject ?? []
    const fBoard = filters.board ?? []
    return courses.filter((c) => {
      const matchQ = !q || c.name.includes(q) || c.en.toLowerCase().includes(q.toLowerCase()) || c.officialCode.includes(q)
      const matchSubject = !fSubject.length || fSubject.includes(c.subjectCode)
      const matchBoard = !fBoard.length || fBoard.includes(c.board)
      return matchQ && matchSubject && matchBoard
    })
  }, [q, filters, courses])

  return (
    <>
      <Card>
        <div className="px-5 py-4">
          <ListToolbar
            search={q}
            onSearch={setQ}
            searchPlaceholder="搜索课程名称、英文名或官方代码"
            groups={groups}
            value={filters}
            onChange={setFilters}
            resultCount={rows.length}
            totalCount={courses.length}
            right={
              <Button onClick={() => setEditing("new")}>
                <Plus className="size-3.5" />
                新增课程
              </Button>
            }
          />
        </div>
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">课程</th>
                <th className="px-3 py-2.5 font-medium">学科</th>
                <th className="px-3 py-2.5 font-medium">考试局 / 体系</th>
                <th className="px-3 py-2.5 font-medium">官方代码</th>
                <th className="px-3 py-2.5 font-medium">单元</th>
                <th className="px-5 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const subject = subjects.find((s) => s.code === c.subjectCode)
                const unitCount = units.filter((u) => u.courseCode === c.code).length
                return (
                  <tr key={c.code} className="border-t border-border align-top">
                    <td className="px-5 py-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.en}</p>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{subject?.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {c.board}
                      <br />
                      <span className="text-xs">{c.system}</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{c.officialCode}</td>
                    <td className="px-3 py-3 text-muted-foreground">{unitCount}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="xs" variant="outline" onClick={() => setActive(c)}>
                          查看单元
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => setEditing(c)} aria-label="编辑">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => setDel(c)} aria-label="删除">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState icon={<BookMarked className="size-6" />} title="没有匹配的课程" desc="调整搜索或新增课程。" />
          </div>
        ) : null}
      </Card>

      {active ? (
        <Sheet open onClose={() => setActive(null)} title={active.name} desc={active.en} width="max-w-lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <Meta label="考试局 / 机构" value={active.board} />
              <Meta label="课程体系" value={active.system} />
              <Meta label="适用地区" value={active.region} />
              <Meta label="教学组织" value={active.org} />
              <Meta label="考核结构" value={active.structure} />
              <Meta label="官方代码" value={active.officialCode} mono />
              {active.syllabusVersion ? <Meta label="大纲版本" value={active.syllabusVersion} /> : null}
            </div>
            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground">
              <p>{active.note}</p>
              {active.sourceUrl ? (
                <a
                  href={active.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-fit text-primary underline underline-offset-4"
                >
                  查看官方大纲（PDF，新窗口）
                </a>
              ) : null}
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
                <Layers className="size-4 text-primary" />
                课程单元关联
              </p>
              <div className="space-y-2">
                {units
                  .filter((u) => u.courseCode === active.code)
                  .map((u) => (
                    <UnitRow key={u.code} u={u} />
                  ))}
                {units.filter((u) => u.courseCode === active.code).length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                    该课程暂无单元，可在「单元库」中新增并关联到本课程。
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold">
                <Users className="size-4 text-primary" />
                维护人员
              </p>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                课程资料维护面向本课程（如说明与获准发布资源），不等于某个教学班的 P1，也不含课程—单元结构、启停与全校字典维护。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setArrangeCourse(active)
                    setActive(null)
                  }}
                >
                  安排课程资料维护
                </Button>
                <span className="text-xs text-muted-foreground">在同一「安排职责」表单中办理，可取消返回。</span>
              </div>
            </div>
          </div>
        </Sheet>
      ) : null}

      <CourseForm
        open={editing !== null}
        initial={editing === "new" ? null : editing}
        subjects={subjects}
        onClose={() => setEditing(null)}
        onSave={(data) => {
          setCourses((list) => {
            if (editing && editing !== "new") return list.map((x) => (x.code === editing.code ? { ...x, ...data } : x))
            return [...list, { ...data, code: nextCode("C", list) }]
          })
          push(editing === "new" ? "已新增课程" : "已保存课程修改")
          setEditing(null)
        }}
      />

      <ConfirmDelete
        open={!!del}
        title="删除课程"
        desc={del ? `确认删除「${del.name}」？此操作在演示中不可撤销。` : ""}
        onClose={() => setDel(null)}
        onConfirm={() => {
          if (!del) return
          if (units.some((u) => u.courseCode === del.code)) {
            push("该课程下仍有单元，请先在单元库中删除或转移这些单元")
            setDel(null)
            return
          }
          setCourses((list) => list.filter((x) => x.code !== del.code))
          push("已删除课程")
          setDel(null)
        }}
      />

      {arrangeCourse ? (
        <DutyArrangeSheet
          open
          onClose={() => setArrangeCourse(null)}
          mode="arrange"
          presetDuty="course_material"
          presetScope={arrangeCourse.name.includes("数学") ? "course-caie-math" : "course-caie-phy"}
        />
      ) : null}
    </>
  )
}

function CourseForm({
  open,
  initial,
  subjects,
  onClose,
  onSave,
}: {
  open: boolean
  initial: CatalogCourse | null
  subjects: CatalogSubject[]
  onClose: () => void
  onSave: (data: Omit<CatalogCourse, "code">) => void
}) {
  const { push } = useToast()
  const [f, setF] = useState<Omit<CatalogCourse, "code">>(blankCourse(subjects))

  useEffect(() => {
    if (open) {
      if (initial) {
        const { code, ...rest } = initial
        setF(rest)
      } else {
        setF(blankCourse(subjects))
      }
    }
  }, [open, initial, subjects])

  function set<K extends keyof Omit<CatalogCourse, "code">>(k: K, v: Omit<CatalogCourse, "code">[K]) {
    setF((prev) => ({ ...prev, [k]: v }))
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? "编辑课程" : "新增课程"}
      desc="课程层承载考试局、课程体系与官方代码。"
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (!f.name.trim()) {
                push("请填写课程名称")
                return
              }
              onSave({
                ...f,
                name: f.name.trim(),
                en: f.en.trim(),
                officialCode: f.officialCode.trim(),
              })
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="所属学科">
          <Select value={f.subjectCode} onChange={(e) => set("subjectCode", e.target.value)}>
            {subjects.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} · {s.en}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="课程名称">
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="例如：CAIE 化学" />
          </Field>
          <Field label="官方代码">
            <Input value={f.officialCode} onChange={(e) => set("officialCode", e.target.value)} placeholder="例如：9701" />
          </Field>
        </div>
        <Field label="英文名称">
          <Input value={f.en} onChange={(e) => set("en", e.target.value)} placeholder="Cambridge International ..." />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="考试局 / 机构">
            <Input value={f.board} onChange={(e) => set("board", e.target.value)} placeholder="Cambridge International" />
          </Field>
          <Field label="课程体系">
            <Input value={f.system} onChange={(e) => set("system", e.target.value)} placeholder="International AS / A Level" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="适用地区">
            <Input value={f.region} onChange={(e) => set("region", e.target.value)} placeholder="国际版" />
          </Field>
          <Field label="教学组织">
            <Input value={f.org} onChange={(e) => set("org", e.target.value)} placeholder="分单元教学" />
          </Field>
        </div>
        <Field label="考核结构">
          <Input value={f.structure} onChange={(e) => set("structure", e.target.value)} placeholder="模块化" />
        </Field>
        <Field label="说明">
          <Textarea value={f.note} onChange={(e) => set("note", e.target.value)} rows={3} />
        </Field>
      </div>
    </Sheet>
  )
}

function blankCourse(subjects: CatalogSubject[]): Omit<CatalogCourse, "code"> {
  return {
    subjectCode: subjects[0]?.code ?? "S001",
    name: "",
    en: "",
    board: "Cambridge International",
    system: "International AS / A Level",
    region: "国际版",
    org: "分单元教学",
    structure: "模块化",
    officialCode: "",
    note: "",
  }
}

function UnitRow({ u }: { u: CatalogUnit }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-semibold text-primary">
          {u.short}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-pretty text-sm font-medium">{u.name}</p>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{u.en}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={u.rule === "选修" ? "neutral" : "primary"}>{u.rule}</Badge>
          <span className="text-sm text-muted-foreground">
            {UNIT_STAGE_OPTIONS.find((option) => option.value === u.stage)?.label}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="font-mono">{u.officialCode}</span>
        <Badge tone={u.nature === "校内板块" ? "warning" : "info"}>{u.nature}</Badge>
      </div>
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{u.note}</p>
    </div>
  )
}

/* ---------------- 单元库 ---------------- */

function UnitsList({
  units,
  courses,
  setUnits,
}: {
  units: CatalogUnit[]
  courses: CatalogCourse[]
  setUnits: React.Dispatch<React.SetStateAction<CatalogUnit[]>>
}) {
  const { push } = useToast()
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})
  const [editing, setEditing] = useState<CatalogUnit | "new" | null>(null)
  const [del, setDel] = useState<CatalogUnit | null>(null)

  const groups: FilterGroup[] = useMemo(
    () => [
      {
        key: "stage",
        label: "阶段",
        options: UNIT_STAGE_OPTIONS,
      },
      {
        key: "nature",
        label: "性质",
        options: UNIT_NATURE_OPTIONS,
      },
      {
        key: "course",
        label: "所属课程",
        options: courses.map((c) => ({ value: c.code, label: c.name })),
      },
    ],
    [courses],
  )

  const rows = useMemo(() => {
    const fStage = filters.stage ?? []
    const fNature = filters.nature ?? []
    const fCourse = filters.course ?? []
    return units.filter((u) => {
      const matchQ =
        !q ||
        u.name.includes(q) ||
        u.en.toLowerCase().includes(q.toLowerCase()) ||
        u.short.includes(q) ||
        u.officialCode.includes(q)
      const matchStage = !fStage.length || fStage.includes(u.stage)
      const matchNature = !fNature.length || fNature.includes(u.nature)
      const matchCourse = !fCourse.length || fCourse.includes(u.courseCode)
      return matchQ && matchStage && matchNature && matchCourse
    })
  }, [q, filters, units])

  return (
    <Card>
      <div className="px-5 py-4">
        <ListToolbar
          search={q}
          onSearch={setQ}
          searchPlaceholder="搜索单元名称、简称或官方代码"
          groups={groups}
          value={filters}
          onChange={setFilters}
          resultCount={rows.length}
          totalCount={units.length}
          right={
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-3.5" />
              新增单元
            </Button>
          }
        />
      </div>
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-2.5 font-medium">简称</th>
              <th className="px-3 py-2.5 font-medium">单元名称</th>
              <th className="px-3 py-2.5 font-medium">官方代码</th>
              <th className="px-3 py-2.5 font-medium">性质</th>
              <th className="px-3 py-2.5 font-medium">阶段</th>
              <th className="px-3 py-2.5 font-medium">所属课程</th>
              <th className="px-5 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const course = courses.find((c) => c.code === u.courseCode)
              return (
                <tr key={u.code} className="border-t border-border align-top">
                  <td className="px-5 py-3">
                    <span className="inline-flex min-w-9 justify-center rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-primary">
                      {u.short}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.en}</p>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{u.officialCode}</td>
                  <td className="px-3 py-3">
                    <Badge tone={u.nature === "校内板块" ? "warning" : "info"}>{u.nature}</Badge>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {UNIT_STAGE_OPTIONS.find((option) => option.value === u.stage)?.label}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{course?.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <RowActions onEdit={() => setEditing(u)} onDelete={() => setDel(u)} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState icon={<Boxes className="size-6" />} title="没有匹配的单元" desc="调整搜索或新增单元。" />
        </div>
      ) : null}

      <UnitForm
        open={editing !== null}
        initial={editing === "new" ? null : editing}
        courses={courses}
        onClose={() => setEditing(null)}
        onSave={(data) => {
          setUnits((list) => {
            if (editing && editing !== "new") return list.map((x) => (x.code === editing.code ? { ...x, ...data } : x))
            return [...list, { ...data, code: nextCode("U", list) }]
          })
          push(editing === "new" ? "已新增单元" : "已保存单元修改")
          setEditing(null)
        }}
      />

      <ConfirmDelete
        open={!!del}
        title="删除单元"
        desc={del ? `确认删除「${del.name}」？此操作在演示中不可撤销。` : ""}
        onClose={() => setDel(null)}
        onConfirm={() => {
          if (!del) return
          setUnits((list) => list.filter((x) => x.code !== del.code))
          push("已删除单元")
          setDel(null)
        }}
      />
    </Card>
  )
}

function UnitForm({
  open,
  initial,
  courses,
  onClose,
  onSave,
}: {
  open: boolean
  initial: CatalogUnit | null
  courses: CatalogCourse[]
  onClose: () => void
  onSave: (data: Omit<CatalogUnit, "code">) => void
}) {
  const { push } = useToast()
  const [f, setF] = useState<Omit<CatalogUnit, "code">>(blankUnit(courses))

  useEffect(() => {
    if (open) {
      if (initial) {
        const { code, ...rest } = initial
        setF(rest)
      } else {
        setF(blankUnit(courses))
      }
    }
  }, [open, initial, courses])

  function set<K extends keyof Omit<CatalogUnit, "code">>(k: K, v: Omit<CatalogUnit, "code">[K]) {
    setF((prev) => ({ ...prev, [k]: v }))
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? "编辑单元" : "新增单元"}
      desc="单元关联到课程；官方试卷不等于独立模块资格。路径必修指选定分层路径后必须参加。"
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (!f.name.trim() || !f.short.trim()) {
                push("请填写单元名称与简称")
                return
              }
              onSave({
                ...f,
                name: f.name.trim(),
                en: f.en.trim(),
                short: f.short.trim(),
                officialCode: f.officialCode.trim(),
              })
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="所属课程">
          <Select value={f.courseCode} onChange={(e) => set("courseCode", e.target.value)}>
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} · {c.officialCode}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="单元名称">
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="例如：纯数学 4" />
          </Field>
          <Field label="简称">
            <Input value={f.short} onChange={(e) => set("short", e.target.value)} placeholder="例如：P4" />
          </Field>
        </div>
        <Field label="英文名称">
          <Input value={f.en} onChange={(e) => set("en", e.target.value)} placeholder="Pure Mathematics 4" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="官方代码">
            <Input value={f.officialCode} onChange={(e) => set("officialCode", e.target.value)} placeholder="9709/07" />
          </Field>
          <Field label="阶段">
            <Segmented<CatalogUnit["stage"]>
              value={f.stage}
              onChange={(v) => set("stage", v)}
              options={UNIT_STAGE_OPTIONS}
            />
          </Field>
        </div>
        <div className="grid gap-4">
          <Field label="性质">
            <Segmented<CatalogUnit["nature"]>
              value={f.nature}
              onChange={(v) => set("nature", v)}
              options={UNIT_NATURE_OPTIONS}
            />
          </Field>
          <Field label="修读性质">
            <Segmented<CatalogUnit["rule"]>
              value={f.rule}
              onChange={(v) => set("rule", v)}
              options={UNIT_RULE_OPTIONS}
            />
          </Field>
        </div>
        <Field label="说明">
          <Textarea value={f.note} onChange={(e) => set("note", e.target.value)} rows={3} />
        </Field>
      </div>
    </Sheet>
  )
}

function blankUnit(courses: CatalogCourse[]): Omit<CatalogUnit, "code"> {
  return {
    name: "",
    en: "",
    short: "",
    officialCode: "",
    nature: "官方模块",
    stage: "IAS",
    courseCode: courses[0]?.code ?? "C101",
    rule: "必修",
    note: "",
  }
}

/* ---------------- 小组件 ---------------- */

function ConfirmDelete({
  open,
  title,
  desc,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  desc: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      desc={desc}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            删除
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        删除后该条目将从当前演示目录中移除。刷新页面可恢复演示初始数据。
      </p>
    </Modal>
  )
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={mono ? "mt-0.5 font-mono text-[12.5px]" : "mt-0.5 text-[13px]"}>{value}</p>
    </div>
  )
}
