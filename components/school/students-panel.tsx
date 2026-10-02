"use client"

import { Badge, Card, EmptyState, Field, Input, LinkButton, Select, Sheet, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  mainHeadTeacherOf,
  STUDENT_FIELDS,
  STUDENT_PROFILES,
  type StudentFieldKey,
  type StudentProfile,
} from "@/lib/demo/school"
import { BookOpen, CalendarDays, Home, IdCard, SlidersHorizontal, Sparkles, Upload, UserPlus, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { checkPersonNo, nextPersonNo, registerIssued, yyyymmOf } from "@/lib/school/person-no"
import { ListToolbar, type FilterGroup, type FilterState } from "./list-toolbar"
import { PersonNoField } from "./person-no-field"
import { DisplaySettingsSheet, type DisplayFieldRow } from "./display-settings-sheet"

// 列表默认显示字段（学号明确默认关闭）
function defaultVisibility(): Record<StudentFieldKey, boolean> {
  const v = {} as Record<StudentFieldKey, boolean>
  for (const f of STUDENT_FIELDS) v[f.key] = f.defaultInList
  return v
}

const BEHAVIOR_TONE = { 表扬: "success", 提醒: "warning", 事件: "info" } as const

function InfoTile({
  label,
  value,
  icon,
  muted,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  muted?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 flex items-center gap-1 text-[13px] font-medium ${muted ? "text-muted-foreground" : ""}`}>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        {value}
      </p>
    </div>
  )
}

function fieldValue(s: StudentProfile, key: StudentFieldKey): string {
  switch (key) {
    case "studentNo":
      return s.studentNo
    case "gender":
      return s.gender
    case "birthday":
      return s.birthday
    case "nationality":
      return s.nationality
    case "enrollDate":
      return s.enrollDate
    case "path":
      return s.path === "AS" ? "AS 阶段" : "完整 A Level"
    case "teachingClasses":
      return s.teachingClasses.join("、")
    case "guardianName":
      return s.guardianName
    case "guardianPhone":
      return s.guardianPhone || "未登记"
  }
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    key: "adminClass",
    label: "行政班",
    options: Array.from(new Set(STUDENT_PROFILES.map((s) => s.adminClass))).map((v) => ({ value: v, label: v })),
  },
  {
    key: "grade",
    label: "年级",
    options: Array.from(new Set(STUDENT_PROFILES.map((s) => s.adminClass.replace(/\d+班$/, "")))).map((v) => ({
      value: v,
      label: v,
    })),
  },
  { key: "gender", label: "性别", options: [{ value: "男", label: "男" }, { value: "女", label: "女" }] },
  {
    key: "path",
    label: "修读路径",
    options: [
      { value: "AS", label: "AS 阶段" },
      { value: "Full", label: "完整 A Level" },
    ],
  },
  {
    key: "teachingClass",
    label: "教学班",
    options: Array.from(new Set(STUDENT_PROFILES.flatMap((s) => s.courses.map((c) => c.course)))).map((v) => ({
      value: v,
      label: v,
    })),
  },
]

export function StudentsPanel() {
  const [q, setQ] = useState("")
  const [filters, setFilters] = useState<FilterState>({})
  const [visibility, setVisibility] = useState<Record<StudentFieldKey, boolean>>(defaultVisibility)
  const [active, setActive] = useState<StudentProfile | null>(null)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState<StudentProfile[]>([])
  const [showSettings, setShowSettings] = useState(false)

  const allStudents = useMemo(() => [...added, ...STUDENT_PROFILES], [added])

  // 列表可选列：排除学号（学号不在列表出现），仅取被开启的字段
  const listColumns = STUDENT_FIELDS.filter((f) => f.key !== "studentNo" && visibility[f.key])

  const rows = useMemo(
    () =>
      allStudents.filter((s) => {
        if (q && !(s.name.includes(q) || s.studentNo.includes(q))) return false
        const f = filters
        if (f.adminClass?.length && !f.adminClass.includes(s.adminClass)) return false
        if (f.grade?.length && !f.grade.includes(s.adminClass.replace(/\d+班$/, ""))) return false
        if (f.gender?.length && !f.gender.includes(s.gender)) return false
        if (f.path?.length && !f.path.includes(s.path)) return false
        if (f.teachingClass?.length && !s.courses.some((c) => f.teachingClass.includes(c.course))) return false
        return true
      }),
    [q, filters],
  )

  const filtering = rows.length !== allStudents.length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div>
          <p className="text-[15px] font-semibold">学生资料</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filtering ? `显示 ${rows.length} 名，共 ${allStudents.length} 名` : `共 ${allStudents.length} 名学生`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>
            <SlidersHorizontal className="size-3.5" />
            显示设置
          </Button>
          <LinkButton href="/import?type=students" variant="outline">
            <Upload className="size-3.5" />
            批量导入
          </LinkButton>
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="size-3.5" />
            新增学生
          </Button>
        </div>
      </div>

      <div className="px-0.5">
        <ListToolbar
          search={q}
          onSearch={setQ}
          searchPlaceholder="搜索学生姓名或学号"
          groups={FILTER_GROUPS}
          value={filters}
          onChange={setFilters}
        />
      </div>

      <Card>
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">姓名</th>
                <th className="px-3 py-2.5 font-medium">行政班</th>
                {listColumns.map((c) => (
                  <th key={c.key} className="px-3 py-2.5 font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 font-medium">状态</th>
                <th className="px-5 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
                        {s.name.slice(-2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActive(s)}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {s.name}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{s.adminClass}</td>
                  {listColumns.map((c) => (
                    <td key={c.key} className="px-3 py-3 text-muted-foreground">
                      {fieldValue(s, c.key)}
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    <Badge tone="success">{s.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button size="xs" variant="outline" onClick={() => setActive(s)}>
                      查看详情
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState icon={<Users className="size-6" />} title="没有匹配的学生" desc="调整搜索或筛选后重试。" />
          </div>
        ) : null}
      </Card>

      {active ? (
        <StudentDetail
          key={active.id}
          student={active}
          onOpenSettings={() => setShowSettings(true)}
          onClose={() => setActive(null)}
        />
      ) : null}

      {showSettings ? (
        <DisplaySettingsSheet
          scope="student"
          rows={studentDisplayRows(visibility)}
          onSave={(next) => {
            const map = {} as Record<StudentFieldKey, boolean>
            for (const f of STUDENT_FIELDS) map[f.key] = f.defaultInList
            for (const r of next) if (!r.detailOnly && !r.noAccess) map[r.key as StudentFieldKey] = r.list
            map.studentNo = false
            setVisibility(map)
          }}
          onResetDefault={() => setVisibility(defaultVisibility())}
          onClose={() => setShowSettings(false)}
        />
      ) : null}

      <AddStudentSheet
        open={adding}
        existingCount={allStudents.length}
        onClose={() => setAdding(false)}
        onCreate={(s) => setAdded((prev) => [s, ...prev])}
      />
    </div>
  )
}

// 学生“我的显示设置”行：姓名/行政班为必显；学号仅详情；监护人电话为敏感字段。
function studentDisplayRows(visibility: Record<StudentFieldKey, boolean>): DisplayFieldRow[] {
  const IDENTITY = "识别资料"
  const STUDY = "学业资料"
  const CONTACT = "联系资料"
  const groupOf: Record<StudentFieldKey, string> = {
    studentNo: IDENTITY,
    gender: IDENTITY,
    birthday: IDENTITY,
    nationality: IDENTITY,
    enrollDate: STUDY,
    path: STUDY,
    teachingClasses: STUDY,
    guardianName: CONTACT,
    guardianPhone: CONTACT,
  }
  const rows: DisplayFieldRow[] = [
    { key: "__name", label: "姓名", group: IDENTITY, detail: true, list: true, detailLocked: true, listLocked: true },
    { key: "__adminClass", label: "行政班", group: IDENTITY, detail: true, list: true, detailLocked: true, listLocked: true },
  ]
  for (const f of STUDENT_FIELDS) {
    rows.push({
      key: f.key,
      label: f.label,
      group: groupOf[f.key],
      detail: !f.sensitive,
      list: !!visibility[f.key],
      detailOnly: f.key === "studentNo",
      reason: f.key === "studentNo" ? "学号仅在详情展示，不能加入列表；有权时仍可用学号搜索。" : undefined,
      sensitive: f.sensitive,
      noAccess: f.key === "guardianPhone",
    })
  }
  return rows
}

function StudentDetail({
  student,
  onOpenSettings,
  onClose,
}: {
  student: StudentProfile
  onOpenSettings: () => void
  onClose: () => void
}) {
  return (
    <Sheet
      open
      onClose={onClose}
      title={student.name}
      desc={`${student.adminClass} · 学号 ${student.studentNo} · ${student.status}`}
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onOpenSettings}>
            <SlidersHorizontal className="size-3.5" />
            显示设置
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* 主班信息 */}
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
            <Home className="size-3.5 text-primary" />
            主班信息
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <InfoTile label="学号" value={student.studentNo} />
            <InfoTile label="主班级" value={student.adminClass} />
            <InfoTile label="主班主任" value={mainHeadTeacherOf(student.adminClass) ?? "暂缺"} muted={!mainHeadTeacherOf(student.adminClass)} />
            <InfoTile label="进班日期" value={student.joinClassDate} icon={<CalendarDays className="size-3" />} />
          </div>
        </section>

        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
            <IdCard className="size-3.5 text-primary" />
            基本资料
          </p>
          <dl className="grid grid-cols-1 overflow-hidden rounded-xl border border-border sm:grid-cols-2">
            {[
              ["性别", student.gender],
              ["出生日期", student.birthday],
              ["国籍/地区", student.nationality],
              ["入学日期", student.enrollDate],
              ["修读路径", fieldValue(student, "path")],
              ["在读状态", student.status],
              ["所在教学班", student.teachingClasses.length ? student.teachingClasses.join("、") : "暂无"],
              ["监护人", student.guardianName],
              ["监护人电话", student.guardianPhone || "未登记"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-3 border-b border-border px-3 py-2.5 sm:odd:border-r">
                <dt className="w-20 shrink-0 text-xs text-muted-foreground">{label}</dt>
                <dd className="text-[13px] leading-relaxed">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 选课列表 */}
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
            <BookOpen className="size-3.5 text-primary" />
            选课列表
            <span className="text-xs font-normal text-muted-foreground">（{student.courses.length} 门课程）</span>
          </p>
          <div className="space-y-2">
            {student.courses.map((c) => (
              <div key={c.teachingClass} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-medium">{c.course}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.teachingClass}</p>
                  </div>
                  <Badge tone={c.status === "在读" ? "success" : "neutral"}>{c.status}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{c.role}</span>
                  <span className="text-muted-foreground/40">·</span>
                  {c.units.map((u) => (
                    <span
                      key={u.short}
                      className="rounded-md bg-accent px-1.5 py-0.5 text-xs font-medium text-primary"
                      title={u.name}
                    >
                      {u.short} · {u.name}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground/80">选课生效日 {c.since}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 行为记录 */}
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
            <Sparkles className="size-3.5 text-primary" />
            行为记录
            <span className="text-xs font-normal text-muted-foreground">（{student.behaviors.length} 条）</span>
          </p>
          {student.behaviors.length ? (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {student.behaviors.map((b) => (
                <li key={b.id} className="relative">
                  <span
                    className="absolute -left-[21px] top-1 flex size-2.5 items-center justify-center rounded-full ring-2 ring-card"
                    style={{ background: "var(--primary)" }}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={BEHAVIOR_TONE[b.kind]}>{b.kind}</Badge>
                    <span className="text-[13px] font-medium">{b.title}</span>
                    <span className="text-xs text-muted-foreground">{b.date}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{b.note}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    记录人 {b.by} · {b.scope}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-[12.5px] text-muted-foreground">
              暂无行为记录。班主任与任课教师可在此登记表扬、提醒或事件（演示）。
            </p>
          )}
        </section>

        {student.guardianContactMissing ? (
          <div className="flex items-start gap-2 rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] p-3 text-[12.5px] text-[#7a5514]">
            <SlidersHorizontal className="mt-0.5 size-4 shrink-0" />
            该学生监护人电话未登记；发布家长可见内容前建议补全联系方式。
          </div>
        ) : null}

        {student.note ? (
          <div className="rounded-lg border border-border p-3 text-[12.5px] text-muted-foreground">{student.note}</div>
        ) : null}
      </div>
    </Sheet>
  )
}

const ADMIN_CLASS_OPTIONS: StudentProfile["adminClass"][] = ["高一1班", "高一2班"]

/**
 * 新增学生（右侧抽屉）。
 * 与教学班/教职工等实体创建统一采用右侧抽屉：为多字段表单预留空间，并保留列表上下文。
 * 仅建立学生基础档案与主班归属；选课、行为记录、字段显示在详情页另行维护。
 */
function AddStudentSheet({
  open,
  existingCount,
  onClose,
  onCreate,
}: {
  open: boolean
  existingCount: number
  onClose: () => void
  onCreate: (s: StudentProfile) => void
}) {
  const { push } = useToast()
  const [name, setName] = useState("")
  const [gender, setGender] = useState<StudentProfile["gender"]>("男")
  const [adminClass, setAdminClass] = useState<StudentProfile["adminClass"]>("高一1班")
  const [path, setPath] = useState<StudentProfile["path"]>("Full")
  const [customNo, setCustomNo] = useState("")
  const [enrollDate, setEnrollDate] = useState("2026-09-01")
  const [joinClassDate, setJoinClassDate] = useState("2026-09-01")
  const [birthday, setBirthday] = useState("2010-09-01")
  const [nationality, setNationality] = useState("中国")
  const [guardianName, setGuardianName] = useState("")
  const [guardianPhone, setGuardianPhone] = useState("")
  const [note, setNote] = useState("")
  const [touched, setTouched] = useState(false)

  const nameMissing = touched && !name.trim()

  function reset() {
    setName("")
    setGender("男")
    setAdminClass("高一1班")
    setPath("Full")
    setCustomNo("")
    setEnrollDate("2026-09-01")
    setJoinClassDate("2026-09-01")
    setBirthday("2010-09-01")
    setNationality("中国")
    setGuardianName("")
    setGuardianPhone("")
    setNote("")
    setTouched(false)
  }

  function close() {
    reset()
    onClose()
  }

  function submit() {
    setTouched(true)
    const trimmed = name.trim()
    const noCheck = checkPersonNo(customNo, "S", enrollDate)
    const period = yyyymmOf(enrollDate)
    if (!trimmed || noCheck.status === "invalid" || (noCheck.status !== "valid" && !period)) return
    // 手工编号原样使用；留空则按首次正式入学年月从学生流水号池取号（与教职工池独立）
    const studentNo = noCheck.status === "valid" ? customNo : nextPersonNo("S", period!)
    registerIssued(studentNo, "S")
    const student: StudentProfile = {
      id: `stu-new-${Date.now()}`,
      name: trimmed,
      gender,
      adminClass,
      studentNo,
      status: "在读",
      enrollDate,
      joinClassDate,
      birthday,
      nationality: nationality.trim() || "未登记",
      path,
      teachingClasses: [],
      courses: [],
      behaviors: [],
      guardianName: guardianName.trim() || "未登记",
      guardianPhone: guardianPhone.trim(),
      guardianContactMissing: !guardianPhone.trim(),
      note: note.trim() || undefined,
    }
    onCreate(student)
    push(`已新增学生 ${trimmed}，正式学号 ${studentNo}（演示）`, "success")
    close()
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="新增学生"
      desc="先建立学生基础档案与主班归属；选课与字段显示可在详情页维护。"
      width="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={close}>
            取消
          </Button>
          <Button size="sm" onClick={submit}>
            创建学生
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        <Field label="姓名" required error={nameMissing ? "请填写姓名" : undefined} className="sm:col-span-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如 示例陈同学"
            aria-invalid={nameMissing}
          />
        </Field>

        <Field label="性别">
          <Select value={gender} onChange={(e) => setGender(e.target.value as StudentProfile["gender"])}>
            {["男", "女"].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>

        <Field label="主班级">
          <Select value={adminClass} onChange={(e) => setAdminClass(e.target.value as StudentProfile["adminClass"])}>
            {ADMIN_CLASS_OPTIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground/70">主班主任按行政班配置自动解析。</p>
        </Field>

        <PersonNoField
          type="S"
          value={customNo}
          onChange={setCustomNo}
          sourceDate={enrollDate}
          showErrors={touched}
          className="sm:col-span-2"
        />

        <Field label="修读路径">
          <Select value={path} onChange={(e) => setPath(e.target.value as StudentProfile["path"])}>
            <option value="Full">完整 A Level</option>
            <option value="AS">AS 阶段</option>
          </Select>
        </Field>

        <Field label="国籍/地区">
          <Input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="如 中国" />
        </Field>

        <Field label="出生日期">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="pl-9" />
          </div>
        </Field>

        <Field label="首次正式入学日期" hint="决定学号中的 YYYYMM；不是录入或创建时间。">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={enrollDate} onChange={(e) => setEnrollDate(e.target.value)} className="pl-9" />
          </div>
        </Field>

        <Field label="进班日期">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={joinClassDate} onChange={(e) => setJoinClassDate(e.target.value)} className="pl-9" />
          </div>
        </Field>

        <Field label="监护人姓名">
          <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="如 示例��长" />
        </Field>

        <Field label="监护人电话">
          <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="可选，敏感字段" />
          <p className="mt-1 text-xs text-muted-foreground/70">敏感字段，默认不在列表显示；留空标记为待补全。</p>
        </Field>

        <Field label="备注" className="sm:col-span-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
        </Field>
      </div>

      <p className="mt-4 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground/70">
        本表单仅建立基础档案与主班归属。选课（教学班/单元）、行为记录与字段显示设置在学生详情页维护。
      </p>
    </Sheet>
  )
}
