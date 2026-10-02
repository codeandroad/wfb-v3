"use client"

import { Badge, Sheet, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { CardDetail, DiffList } from "@/components/timetable/detail"
import { WeekGrid } from "@/components/timetable/week-grid"
import { TeacherLink } from "@/components/profile/teacher-link"
import {
  fmtClock,
  TEACHERS,
  teacherById,
  weekStartOf,
  type ProjectedEntry,
} from "@/lib/timetable/data"
import {
  contentSource,
  perLabel,
  diffFor,
  isPending,
  latestSeq,
  releaseBySeq,
  schLabel,
  teacherCurrent,
  teacherWeekEntries,
  useTimetable,
  type Release,
} from "@/lib/timetable/store"
import { CalendarClock, Eye, GitCompare, Plus, Redo2, Undo2 } from "lucide-react"
import { useState } from "react"

export function PublishPanel() {
  const tt = useTimetable()
  const { push } = useToast()
  const [batch, setBatch] = useState<Release | null>(null)

  const releases = [...tt.releases].sort((a, b) => b.seq - a.seq)

  function publish(target: "lin" | "chen" | "zhouOct") {
    const rel = tt.publishSample(target)
    if (rel) push(`已发布 ${rel.id} · 发布时间 ${fmtClock(rel.publishedAt)}`)
  }

  const topSeq = latestSeq(tt)
  const canUndo = topSeq > 6
  const canRedo = tt.redoStack.length > 0

  function undoLast() {
    const r = tt.undoLastPublish()
    push(r.msg)
  }

  function redoLast() {
    const r = tt.redoLastPublish()
    push(r.msg)
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-[13px] text-muted-foreground">发布批次按实际内容变化分发；无变化教师不收提醒，也不标落后。</p>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => publish("lin")}><Plus className="size-3.5" />样例发布 · 改林老师</Button>
          <Button variant="outline" size="sm" onClick={() => publish("chen")}><Plus className="size-3.5" />样例发布 · 改陈老师</Button>
          <Button variant="outline" size="sm" onClick={() => publish("zhouOct")}><Plus className="size-3.5" />样例发布 · 10月起</Button>
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            disabled={!canUndo}
            onClick={undoLast}
            title={canUndo ? `撤销最近发布 ${schLabel(topSeq)}` : "仅剩初始基线，无可撤销的发布"}
          >
            <Undo2 className="size-3.5" />撤销最近发布{canUndo ? ` · ${schLabel(topSeq)}` : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="disabled:opacity-50"
            disabled={!canRedo}
            onClick={redoLast}
            title={canRedo ? "回退最近一次撤销，恢复该发布" : "没有可回退的撤销操作"}
          >
            <Redo2 className="size-3.5" />回退撤销
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">发布编号 / 说明</th>
              <th className="px-3 py-2 font-medium">发布时间</th>
              <th className="px-3 py-2 font-medium">生效日期</th>
              <th className="px-3 py-2 font-medium">影响教师</th>
              <th className="px-3 py-2 font-medium">更新概况</th>
              <th className="px-3 py-2 font-medium text-right">查看</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((r) => {
              const affected = r.changedTeachers
              const adopted = affected.filter((tid) => {
                const a = tt.adoptions[tid]
                if (!a) return false
                return a.revisions.some((rev) => rev.sourceSch >= r.seq)
              }).length
              return (
                <tr key={r.seq} className="border-t border-border align-top">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{r.id}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.note}</p>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtClock(r.publishedAt)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.effectiveDate}</td>
                  <td className="px-3 py-2.5">
                    <AffectedTeachers ids={affected} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {r.seq === 6 ? "初始对象" : `${adopted}/${affected.length} 已采用`}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button variant="ghost" size="xs" onClick={() => setBatch(r)}>批次详情</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <BatchDrawer batch={batch} onClose={() => setBatch(null)} />
    </div>
  )
}

const AFFECTED_PREVIEW = 4

function AffectedTeachers({ ids }: { ids: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const overflow = ids.length - AFFECTED_PREVIEW
  const shown = expanded || overflow <= 0 ? ids : ids.slice(0, AFFECTED_PREVIEW)
  return (
    <div className="flex max-w-80 flex-wrap items-center gap-1">
      {shown.map((tid) => (
        <Badge key={tid} tone="neutral">{teacherById(tid)?.name.replace("示例", "")}</Badge>
      ))}
      {overflow > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="rounded px-1 text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          {expanded ? "收起" : `更多 ${overflow} 位…`}
        </button>
      ) : null}
    </div>
  )
}

function BatchDrawer({ batch, onClose }: { batch: Release | null; onClose: () => void }) {
  const tt = useTimetable()
  const [viewer, setViewer] = useState<{ teacherId: string; mode: "schedule" | "diff" } | null>(null)

  if (!batch) return null
  return (
    <>
      <Sheet open={!!batch} onClose={onClose} title={batch.id} desc={batch.note} width="max-w-xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <InfoCell k="发布时间" v={fmtClock(batch.publishedAt)} />
            <InfoCell k="生效日期" v={batch.effectiveDate} />
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium">受影响教师</p>
            <ul className="space-y-2">
              {batch.changedTeachers.map((tid) => {
                const t = teacherById(tid)!
                const a = tt.adoptions[tid]
                const rev = a?.revisions.reduce((m, r) => (r.perSeq > m.perSeq ? r : m), a.revisions[0])
                const adopted = a?.revisions.some((r) => r.sourceSch >= batch.seq)
                const pending = isPending(tt, tid) && contentSource(tt, tid) >= batch.seq
                return (
                  <li key={tid} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center gap-2">
                      <TeacherLink teacherId={tid} className="text-[13px] font-medium hover:text-primary hover:underline">
                        {t.name}
                      </TeacherLink>
                      {!t.hasAccount ? (
                        <Badge tone="neutral">无账号 · 暂无法送达</Badge>
                      ) : adopted ? (
                        <Badge tone="success">已更新{rev ? ` · ${perLabel(tid, rev.perSeq)}` : ""}</Badge>
                      ) : pending ? (
                        <Badge tone="warning">待更新</Badge>
                      ) : (
                        <Badge tone="neutral">无相关变化</Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[12px] text-muted-foreground">
                      <span>采用来源 {schLabel(contentSource(tt, tid))}</span>
                      {a && rev ? <span>个人使用版 {perLabel(tid, rev.perSeq)}</span> : null}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="xs" onClick={() => setViewer({ teacherId: tid, mode: "schedule" })}><Eye className="size-3 mr-1" />查看课表</Button>
                      <Button variant="outline" size="xs" onClick={() => setViewer({ teacherId: tid, mode: "diff" })}><GitCompare className="size-3 mr-1" />查看差异</Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
          <p className="text-[11px] text-muted-foreground">查看课表/差异进入同一只读比对器，带入该教师与本次发布相关的生效周；未来发布不冒称今天现用。</p>
        </div>
      </Sheet>

      {viewer ? <TeacherViewer batch={batch} teacherId={viewer.teacherId} mode={viewer.mode} onClose={() => setViewer(null)} /> : null}
    </>
  )
}

function TeacherViewer({ batch, teacherId, mode, onClose }: { batch: Release; teacherId: string; mode: "schedule" | "diff"; onClose: () => void }) {
  const tt = useTimetable()
  const [detail, setDetail] = useState<ProjectedEntry | null>(null)
  // 带入该发布相关的生效周
  const weekStart = weekStartOf(batch.effectiveDate)
  const t = teacherById(teacherId)!
  const cur = teacherCurrent(tt, teacherId, batch.effectiveDate)
  const { entries } = teacherWeekEntries(tt, teacherId, weekStart)
  const diff = diffFor(tt, teacherId, batch.effectiveDate)

  return (
    <Sheet
      open
      onClose={onClose}
      width="max-w-3xl"
      title={`${t.name} · ${mode === "schedule" ? "教师当前课表" : "差异对比"}`}
      desc={`带入生效周 ${weekStart} 起 · ${cur.kind === "ok" ? `${perLabel(teacherId, cur.rev.perSeq)} · 来源 ${schLabel(cur.rev.sourceSch)}` : "教师当前不可用"}`}
    >
      <div className="mb-2 flex items-center gap-2 text-[12px] text-muted-foreground">
        <CalendarClock className="size-3.5" />
        本视图为只读；未来发布展示其适用周，如需今天请回到本周。
      </div>
      {cur.kind !== "ok" ? (
        <div className="rounded-lg border border-dashed border-[#e6d4a8] bg-[#fbf7ee] px-4 py-8 text-center text-[13px] text-[#7a5514]">
          {cur.kind === "no_account" ? "该教师无账号，无法送达/采用" : cur.kind === "load_error" ? "教师当前读取失败，不以学校版冒充" : "尚无可用个人课表"}
        </div>
      ) : mode === "schedule" ? (
        <WeekGrid weekStart={weekStart} entries={entries} onCardClick={setDetail} />
      ) : diff ? (
        <DiffList rows={diff.rows} />
      ) : null}
      <CardDetail entry={detail} open={!!detail} onClose={() => setDetail(null)} />
    </Sheet>
  )
}

function InfoCell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-muted-foreground">{k}</p>
      <p className="mt-0.5 font-medium text-foreground">{v}</p>
    </div>
  )
}
