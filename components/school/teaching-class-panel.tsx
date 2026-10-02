"use client"

import { Badge, Card, EmptyState, Input } from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  classRoster,
  courseName,
  useHomerooms,
  homeroomName,
  responsibilitiesOf,
  SUBJECTS,
  subjectName,
  teacherName,
  useTeaching,
  type TeachingClass,
} from "@/lib/teaching/store"
import { Layers, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { TeachingClassCreateSheet } from "./teaching-class-create-sheet"
import { TeachingClassWorkspace } from "./teaching-class-workspace"

const selectClass =
  "h-9 cursor-pointer rounded-lg border border-input bg-card px-3 pr-8 text-[13px] text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"

export function TeachingClassPanel() {
  const teaching = useTeaching()
  const homerooms = useHomerooms()
  const [q, setQ] = useState("")
  const [subjectFilter, setSubjectFilter] = useState("")
  const [placementFilter, setPlacementFilter] = useState("")
  const [creating, setCreating] = useState(false)
  const [openClassId, setOpenClassId] = useState<string | null>(null)

  const rows = useMemo(() => {
    return teaching.classes.filter((c) => {
      if (q && !(c.name.includes(q) || subjectName(c.subjectId).includes(q))) return false
      if (subjectFilter && c.subjectId !== subjectFilter) return false
      if (placementFilter && c.placementHomeroomId !== placementFilter) return false
      return true
    })
  }, [teaching.classes, q, subjectFilter, placementFilter])

  function teachingSummary(cls: TeachingClass): string {
    const resp = responsibilitiesOf(teaching, cls.id)
    if (resp.length === 0) {
      return cls.wholeTeacherIds.length ? cls.wholeTeacherIds.map(teacherName).join("、") : "未安排"
    }
    if (resp.length <= 2) {
      return resp
        .map((r) => {
          const t = r.teacherIds.length ? teacherName(r.teacherIds[0]) : "待指定"
          return `${t}/${r.sharedMark ?? "分工"}`
        })
        .join("、")
    }
    return `${resp.length}项分工`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          教学班以学科与实际教学组织为核心；本期课程可稍后设置，任教与名单按需完善。
        </p>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11.5px] text-muted-foreground sm:inline">
            2026–2027 上学期
          </span>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            新建教学班
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索教学班 / 学科…" className="h-9 pl-9" />
        </div>
        <select className={selectClass} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} aria-label="学科筛选">
          <option value="">全部学科</option>
          {SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className={selectClass} value={placementFilter} onChange={(e) => setPlacementFilter(e.target.value)} aria-label="排课归属筛选">
          <option value="">全部归属</option>
          {homerooms.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted-foreground">共 {rows.length} / {teaching.classes.length} 个教学班</p>

      <Card>
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">教学班</th>
                <th className="px-3 py-2.5 font-medium">学科</th>
                <th className="px-3 py-2.5 font-medium">排课归属</th>
                <th className="px-3 py-2.5 font-medium">本期课程</th>
                <th className="px-3 py-2.5 font-medium">任教安排</th>
                <th className="px-3 py-2.5 font-medium">学生</th>
                <th className="px-5 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border align-middle">
                  <td className="px-5 py-3">
                    <p className="font-medium">{c.name}</p>
                    {c.sharedShortName ? <p className="text-xs text-muted-foreground">简称 {c.sharedShortName}</p> : null}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{subjectName(c.subjectId)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{homeroomName(c.placementHomeroomId) ?? "—"}</td>
                  <td className="px-3 py-3">
                    {c.courseId ? (
                      <span className="text-muted-foreground">{courseName(c.courseId)}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenClassId(c.id)}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        设置课程
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{teachingSummary(c)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{classRoster(c).length}</td>
                  <td className="px-5 py-3 text-right">
                    <Button size="xs" variant="outline" onClick={() => setOpenClassId(c.id)}>
                      查看
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState icon={<Layers className="size-6" />} title="没有匹配的教学班" desc="调整搜索或筛选后重试，或新建教学班。" />
          </div>
        ) : null}
      </Card>

      {creating ? (
        <TeachingClassCreateSheet
          open
          onClose={() => setCreating(false)}
          onCreated={(cls) => setOpenClassId(cls.id)}
        />
      ) : null}

      {openClassId ? (
        <TeachingClassWorkspace classId={openClassId} open onClose={() => setOpenClassId(null)} />
      ) : null}
    </div>
  )
}
