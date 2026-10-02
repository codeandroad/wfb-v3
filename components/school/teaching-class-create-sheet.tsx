"use client"

import { Badge, Field, Input, Sheet, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  coursesForSubject,
  findSimilar,
  useHomerooms,
  homeroomName,
  SEMESTER,
  SUBJECTS,
  suggestClassName,
  useTeaching,
  type TeachingClass,
} from "@/lib/teaching/store"
import { AlertTriangle, CheckCircle2, ChevronDown, RotateCcw } from "lucide-react"
import { useMemo, useState } from "react"

const selectClass =
  "w-full cursor-pointer rounded-lg border border-input bg-card px-3 py-2 pr-8 text-[14px] text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"

const SEMESTER_LABEL = "2026–2027 上学期"

export function TeachingClassCreateSheet({
  open,
  onClose,
  presetHomeroomId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  presetHomeroomId?: string | null
  onCreated?: (cls: TeachingClass) => void
}) {
  const teaching = useTeaching()
  const homerooms = useHomerooms()
  const { push } = useToast()

  const [subjectId, setSubjectId] = useState(SUBJECTS[0].id)
  const [placement, setPlacement] = useState<string | null>(presetHomeroomId ?? null)
  const [name, setName] = useState(suggestClassName(SUBJECTS[0].id, presetHomeroomId ?? null))
  const [nameEdited, setNameEdited] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [shortName, setShortName] = useState("")
  const [creating, setCreating] = useState(false)

  const suggestion = suggestClassName(subjectId, placement)
  const courseOptions = useMemo(() => coursesForSubject(subjectId), [subjectId])
  const similar = useMemo(
    () => (name.trim() ? findSimilar(teaching, subjectId, placement) : []),
    [teaching, subjectId, placement, name],
  )

  // 改学科/归属：未手改名时同步建议名；改学科时若课程不属于新学科则清除
  function onSubject(next: string) {
    setSubjectId(next)
    if (!nameEdited) setName(suggestClassName(next, placement))
    if (courseId && !coursesForSubject(next).some((c) => c.id === courseId)) {
      setCourseId(null)
      push("已更换学科，原本期课程与新学科不相容，已清除待重选", "info")
    }
  }
  function onPlacement(next: string | null) {
    setPlacement(next)
    if (!nameEdited) setName(suggestClassName(subjectId, next))
  }
  function onName(v: string) {
    setName(v)
    setNameEdited(true)
  }
  function restoreSuggestion() {
    setName(suggestion)
    setNameEdited(false)
  }

  const canConfirm = Boolean(subjectId) && Boolean(name.trim()) && !creating

  function confirm() {
    if (!canConfirm) return
    setCreating(true) // 防重复：双击/重试只产生一个对象
    const cls = teaching.createClass({
      subjectId,
      placementHomeroomId: placement,
      name: name.trim(),
      courseId,
      sharedShortName: shortName.trim() || null,
      nameEdited,
    })
    push(`已创建教学班「${cls.name}」`, "success")
    onCreated?.(cls)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="新建教学班"
      desc={SEMESTER_LABEL}
      width="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" disabled={!canConfirm} onClick={confirm}>
            <CheckCircle2 className="size-3.5" />
            创建教学班
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="学科" required>
            <select className={selectClass} value={subjectId} onChange={(e) => onSubject(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="排课归属行政班（可选）" hint="用于课表归类，不自动加入学生或指定任教。">
            <select
              className={selectClass}
              value={placement ?? ""}
              onChange={(e) => onPlacement(e.target.value || null)}
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

        <Field label="教学班名称" required hint="选择归属后自动建议“行政班名 • 学科名”，可直接改。">
          <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="如：数学竞赛A班" />
          {nameEdited && suggestion && name.trim() !== suggestion ? (
            <button
              type="button"
              onClick={restoreSuggestion}
              className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="size-3" />
              恢复建议名称「{suggestion}」
            </button>
          ) : null}
        </Field>

        {/* 更多资料（可选）：本期课程 + 教学班简称，不折叠已删除的五步骤 */}
        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-[13px] font-medium"
            aria-expanded={moreOpen}
          >
            <span>更多资料（可选）</span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${moreOpen ? "rotate-180" : ""}`} />
          </button>
          {moreOpen ? (
            <div className="space-y-4 border-t border-border px-3.5 py-3.5">
              <Field label="本期课程" hint="按学科筛选本校目录；可稍后设置，不影响创建与排课。">
                <select className={selectClass} value={courseId ?? ""} onChange={(e) => setCourseId(e.target.value || null)}>
                  <option value="">暂不设置</option>
                  {courseOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="教学班简称" hint="仅用于简短显示，不改变正式名与关联。">
                <Input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="如：数学A班" />
              </Field>
            </div>
          ) : null}
        </div>

        {similar.length ? (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-[13px] dark:bg-amber-950/20">
            <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4" />
              已有相似教学班
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              同学期 · {homeroomName(placement) ?? "无归属"} · {SUBJECTS.find((s) => s.id === subjectId)?.name} 下已有：
            </p>
            <div className="mt-2 space-y-1.5">
              {similar.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t.name}</span>
                  <Badge tone="neutral">{t.id}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button size="xs" variant="outline" onClick={() => { onCreated?.(similar[0]); onClose() }}>
                查看已有班
              </Button>
              <span className="text-xs text-muted-foreground">或改一个可识别的名称后继续建立独立班。</span>
            </div>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          学科必选、名称必填即可创建。课程、教师、学生名单与教学分工都在创建后于教学班详情按需完善。
        </p>
      </div>
    </Sheet>
  )
}
