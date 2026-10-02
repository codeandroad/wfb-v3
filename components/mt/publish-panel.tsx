"use client"

import { Badge, Card } from "@/components/kit"
import { SaveState } from "@/components/mt/shared"
import { Btn, inputCls, Modal, Section, useAutoText } from "@/components/mt/ui"
import { nameOf, permittedTasks, taskWeek, type TaskWeek } from "@/lib/mt/derive"
import { buildLegends, buildStudents, coverageNames, diffSnap, pubTitle, renderStudentImages, type Draft } from "@/lib/mt/publish"
import {
  classOf,
  clockLabel,
  courseOf,
  fmtMD,
  homeroomName,
  hwStatus,
  STUDENTS,
  uniq,
  WEEKDAY_CN,
  weekdayIdx,
  type Publication,
  type SnapStudent,
} from "@/lib/mt/model"
import { entryKey, scopeTask, useHomeworkWriters, useMt, useTextWriters } from "@/lib/mt/store"
import { AlertTriangle, Download, Eye, ImageIcon, Info, Send } from "lucide-react"
import { useRef, useState } from "react"

type Issue = { level: "block" | "warn"; text: string; actions?: { label: string; run: () => void }[] }

export function PublishPanel({ tw, teacherId, onOpenStudent }: { tw: TaskWeek; teacherId: string; onOpenStudent: (sid: string) => void }) {
  const mt = useMt()
  const tx = useTextWriters()
  const hw = useHomeworkWriters()
  const summaryRef = useRef<HTMLTextAreaElement>(null)

  const siblings = permittedTasks(mt.biz, teacherId).filter(
    (t) => t.class_id === tw.task.class_id && t.course_id === tw.task.course_id && t.teacher_id === teacherId,
  )
  const [taskIds, setTaskIds] = useState<string[]>([tw.task.id])
  const tws = taskIds.map((id) => (id === tw.task.id ? tw : taskWeek(mt.biz, siblings.find((s) => s.id === id)!, tw.week)))
  const setKey = taskIds.slice().sort().join()
  const history = mt.biz.publications
    .filter((p) => p.periodId === tw.periodId && p.taskIds.slice().sort().join() === setKey)
    .sort((a, b) => b.revision - a.revision)
  const latest = history[0] ?? null
  const first = history[history.length - 1] ?? null
  const allHistory = mt.biz.publications.filter((p) => p.periodId === tw.periodId && p.taskIds.includes(tw.task.id)).sort((a, b) => b.stamp - a.stamp)

  const elapsedDates = (x: TaskWeek) => uniq(x.days.filter((d) => d.elapsed.length).map((d) => d.date)).sort()
  const [picked, setPicked] = useState<Record<string, string[]>>(() => Object.fromEntries(tws.map((x) => [x.task.id, elapsedDates(x)])))
  const coverage: Record<string, string[]> = Object.fromEntries(
    tws.map((x) => [x.task.id, uniq([...(latest?.coverage[x.task.id] ?? []), ...(picked[x.task.id] ?? elapsedDates(x))]).sort()]),
  )
  const allAssign = tws.flatMap((x) => x.assignments)
  const [unpicked, setUnpicked] = useState<string[]>([])
  const assignmentIds = allAssign.map((a) => a.id).filter((id) => !unpicked.includes(id))
  const [excluded, setExcluded] = useState<Draft["excludedHomework"]>(latest?.excludedHomework ?? [])
  const summary = useAutoText(mt.biz.summaries[entryKey(tw.task.id, tw.week)]?.text ?? "", (v) => tx.setSummary(tw.task.id, tw.week, v))

  const draft: Draft = { publicSummary: summary.value, coverage, assignmentIds, excludedHomework: excluded }
  const students = buildStudents(mt.biz, tws, draft, first)
  const diff = diffSnap(latest, summary.value, students)
  const nowTs = Date.parse(mt.biz.clock)

  const [idem, setIdem] = useState(() => `PUBK_${Date.now().toString(36)}`)
  const [lost, setLost] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState<string>(students[0]?.studentId ?? "")
  const [viewPub, setViewPub] = useState<Publication | null>(null)

  /* ---------- 校验 ---------- */
  const issues: Issue[] = []
  const unsettled = taskIds.flatMap((id) => mt.unsettled(scopeTask(id)))
  if (unsettled.length)
    issues.push({
      level: "block",
      text: `${unsettled.length} 项修改未保存（${unsettled[0].label}）`,
      actions: [{ label: "重试保存", run: () => taskIds.forEach((id) => mt.retryScope(scopeTask(id))) }],
    })
  const revoked = taskIds.filter((id) => mt.biz.revoked.includes(id))
  if (revoked.length) issues.push({ level: "block", text: "已失去任务权限，不能发布" })
  const nameHit = STUDENTS.find((s) => s.name.length >= 2 && summary.value.includes(s.name))
  if (nameHit)
    issues.push({
      level: "block",
      text: `公共总结包含学生姓名“${nameHit.name}”，会被所有家长看到`,
      actions: [{ label: "定位字段", run: () => summaryRef.current?.focus() }],
    })
  for (const a of allAssign.filter((a) => assignmentIds.includes(a.id)))
    for (const sid of a.recipients) {
      if (hwStatus(a, sid, nowTs).s !== "SUSPECTED_MISSING") continue
      if (excluded.some((x) => x.assignmentId === a.id && x.studentId === sid)) continue
      issues.push({
        level: "block",
        text: `${nameOf(sid)}「${a.title}」疑似未交，需核实或本次暂不纳入`,
        actions: [
          { label: "核实为未交", run: () => hw.setResult(a, sid, { submission: "MISSING", submissionConfirmed: true }, "核实未交") },
          { label: "本次暂不纳入", run: () => setExcluded([...excluded, { assignmentId: a.id, studentId: sid }]) },
          { label: "定位", run: () => onOpenStudent(sid) },
        ],
      })
    }
  const hasContent =
    students.some((s) => s.days.some((d) => d.status !== "UNRECORDED") || s.homework.length || s.highlights.length || s.comment) ||
    !!summary.value.trim()
  if (!hasContent) issues.push({ level: "block", text: "没有可发布的内容：选中日期均未记录，也没有作业、亮点、评语或总结" })
  if (latest && !diff.length) issues.push({ level: "block", text: `与已发布第 ${latest.revision} 版内容相同，无需发布新版本` })
  const unrec = students.filter((s) => s.days.some((d) => d.status === "UNRECORDED"))
  if (unrec.length)
    issues.push({
      level: "warn",
      text: `${unrec.length} 名学生有日期未记录，家长结果将如实显示“未记录”，不会自动补 A`,
      actions: [{ label: "定位首位", run: () => onOpenStudent(unrec[0].studentId) }],
    })
  const noContact = students.filter((s) => !s.hasContact)
  if (noContact.length) issues.push({ level: "warn", text: `${noContact.length} 名学生无已核验监护人联系方式：可生成结果，不会投送` })
  if (!summary.value.trim()) issues.push({ level: "warn", text: "公共总结为空（可发布）" })
  const blocks = issues.filter((i) => i.level === "block")

  const doPublish = () => {
    summary.flush()
    const t0 = tws[0].task
    const r = mt.publish({
      taskIds,
      periodId: tw.periodId,
      week: tw.week,
      idemKey: idem,
      classNameFormal: classOf(t0).name,
      courseName: courseOf(t0)?.name ?? "",
      coverage,
      assignmentIds,
      excludedHomework: excluded,
      publicSummary: summary.value,
      students,
      diffFromPrev: diff,
      image: { status: "NONE", attempts: 0 },
      downloads: {},
      manualSent: {},
      legends: buildLegends(mt.biz, tws, { publicSummary: summary.value, coverage, assignmentIds, excludedHomework: excluded }),
    })
    if (!r.ok) {
      setLost(!!r.lost)
      setMsg({ ok: false, text: r.error })
      return
    }
    setLost(false)
    setMsg({ ok: true, text: r.reused ? `已确认：第 ${r.pub.revision} 版此前已成功写入，未生成重复版本。` : `已发布第 ${r.pub.revision} 版。` })
    setIdem(`PUBK_${Date.now().toString(36)}`)
  }

  const prevStu = students.find((s) => s.studentId === preview) ?? students[0]

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <div>
        {tw.unpublishedChanges ? (
          <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-[#fbf1dd] px-3 py-2 text-xs text-[#8a5a12]">
            <Info className="size-3.5" aria-hidden />
            已发布后有新的保存修改尚未发布；发布新版本会生成差异，旧版本保留。
          </p>
        ) : null}

        {siblings.length > 1 ? (
          <Section title="发布范围（同源任务）">
            <div className="flex flex-wrap gap-3 text-sm">
              {siblings.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    disabled={t.id === tw.task.id}
                    checked={taskIds.includes(t.id)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...taskIds, t.id] : taskIds.filter((x) => x !== t.id)
                      setTaskIds(next)
                      if (e.target.checked) setPicked({ ...picked, [t.id]: elapsedDates(taskWeek(mt.biz, t, tw.week)) })
                    }}
                  />
                  {t.label} <span className="text-[11px] text-muted-foreground">{t.id}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">仅同一教学班、同一课程、本人任教的任务可合并为同一份家长结果；各任务记录仍独立保存。</p>
          </Section>
        ) : null}

        <Section title="课堂日期">
          {tws.map((x) => {
            const dates = elapsedDates(x)
            return (
              <div key={x.task.id} className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                {tws.length > 1 ? <span className="w-12 text-xs text-muted-foreground">{x.task.label}</span> : null}
                {dates.length ? (
                  dates.map((d) => {
                    const kept = latest?.coverage[x.task.id]?.includes(d)
                    return (
                      <label key={d} className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs">
                        <input
                          type="checkbox"
                          disabled={kept}
                          checked={coverage[x.task.id]?.includes(d)}
                          onChange={(e) => {
                            const cur = picked[x.task.id] ?? dates
                            setPicked({ ...picked, [x.task.id]: e.target.checked ? [...cur, d] : cur.filter((y) => y !== d) })
                          }}
                        />
                        {WEEKDAY_CN[weekdayIdx(d)]} {fmtMD(d)}
                        {kept ? <span className="text-[10px] text-muted-foreground">已发布·保留</span> : null}
                      </label>
                    )
                  })
                ) : (
                  <span className="text-xs text-muted-foreground">本周尚无已发生课次</span>
                )}
              </div>
            )
          })}
        </Section>

        <Section title={`作业（${allAssign.length}）`}>
          {allAssign.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {allAssign.map((a) => (
                <li key={a.id}>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={assignmentIds.includes(a.id)}
                      onChange={(e) => setUnpicked(e.target.checked ? unpicked.filter((x) => x !== a.id) : [...unpicked, a.id])}
                    />
                    {a.title}
                    <span className="text-[11px] text-muted-foreground">{a.id}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">本周期没有作业。</p>
          )}
          {excluded.length ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              本次暂不纳入：{excluded.map((x) => `${nameOf(x.studentId)}·${x.assignmentId}`).join("、")}
              <button type="button" className="ml-2 text-primary underline" onClick={() => setExcluded([])}>
                全部恢复
              </button>
            </p>
          ) : null}
        </Section>

        <Section title="公共总结" aside={<SaveState scope={scopeTask(tw.task.id)} compact />}>
          <textarea
            ref={summaryRef}
            aria-label="公共总结"
            rows={4}
            className={inputCls}
            value={summary.value}
            onChange={(e) => summary.onChange(e.target.value)}
            onBlur={summary.flush}
            placeholder="本周学习内容，所有家长可见；不要写个别学生信息。"
          />
          {mt.biz.plans[tw.task.id]?.items.length ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              计划候选（未采用前不进入结果）：
              {mt.biz.plans[tw.task.id].items.slice(0, 3).map((i) => (
                <button key={i.id} type="button" className="ml-1.5 text-primary underline" onClick={() => summary.set(`${summary.value}${summary.value ? "\n" : ""}${i.title}`)}>
                  {i.title}
                </button>
              ))}
            </p>
          ) : null}
        </Section>

        <Section title="发布前检查">
          {issues.length ? (
            <ul className="flex flex-col gap-1.5">
              {issues.map((i, k) => (
                <li
                  key={k}
                  className={`flex flex-wrap items-center gap-2 rounded-md px-3 py-1.5 text-xs ${i.level === "block" ? "bg-[#fbe6e4] text-[#9a2b22]" : "bg-muted text-foreground"}`}
                >
                  {i.level === "block" ? <AlertTriangle className="size-3.5" aria-hidden /> : <Info className="size-3.5" aria-hidden />}
                  <span className="flex-1">{i.text}</span>
                  {i.actions?.map((a) => (
                    <Btn key={a.label} size="sm" onClick={a.run}>
                      {a.label}
                    </Btn>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#256a49]">检查通过。</p>
          )}
          {latest ? (
            <div className="mt-2 text-xs">
              <p className="font-medium">相对第 {latest.revision} 版的差异（{diff.length}）</p>
              <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-4 text-muted-foreground">
                {diff.map((d, k) => (
                  <li key={k}>{d}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Btn variant="primary" disabled={!!blocks.length} onClick={doPublish}>
              <Send className="size-3.5" aria-hidden />
              {lost ? "重试发布（同一提交）" : latest ? `发布第 ${latest.revision + 1} 版` : "发布"}
            </Btn>
            <span className="text-[11px] text-muted-foreground">发布 = 生成不可变版本；原型不会真实发送给家长。</span>
          </div>
          {msg ? (
            <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-xs ${msg.ok ? "text-[#256a49]" : "text-[#9a2b22]"}`}>
              {msg.text}
            </p>
          ) : null}
        </Section>
      </div>

      <aside className="flex flex-col gap-4">
        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">家长视角预览</h3>
            <select aria-label="预览学生" value={prevStu?.studentId ?? ""} onChange={(e) => setPreview(e.target.value)} className="h-7 rounded-md border border-input bg-card px-1.5 text-xs">
              {students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {prevStu ? (
            <ParentView title={pubTitle(tws)} week={tw.week} summary={summary.value} s={prevStu} />
          ) : (
            <p className="text-xs text-muted-foreground">没有纳入的学生。</p>
          )}
        </Card>

        <Card className="p-3">
          <h3 className="mb-2 text-sm font-semibold">发布历史（{allHistory.length}）</h3>
          {allHistory.length ? (
            <ul className="flex flex-col gap-2">
              {allHistory.map((p) => (
                <li key={p.id} className="rounded-md border border-border px-2.5 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      第 {p.revision} 版{p.taskIds.length > 1 ? ` · 合并 ${p.taskIds.length} 个任务` : ""}
                    </span>
                    <Btn size="sm" variant="ghost" onClick={() => setViewPub(p)}>
                      <Eye className="size-3" aria-hidden />
                      查看
                    </Btn>
                  </div>
                  <p className="text-muted-foreground">
                    {clockLabel(p.publishedAt)} · {p.students.length} 人 · {coverageNames(p)}
                  </p>
                  <p className="text-muted-foreground">{p.diffFromPrev.slice(0, 2).join("；")}{p.diffFromPrev.length > 2 ? ` 等 ${p.diffFromPrev.length} 项` : ""}</p>
                  <p className="mt-0.5">
                    图片：
                    {{ NONE: "未生成", GENERATING: "生成中", READY: "已生成", FAILED: "生成失败" }[p.image.status]}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">本期尚未发布。</p>
          )}
        </Card>
      </aside>

      {viewPub ? <PubViewer pub={mt.biz.publications.find((p) => p.id === viewPub.id) ?? viewPub} onClose={() => setViewPub(null)} /> : null}
    </div>
  )
}

export function ParentView({ title, week, summary, s }: { title: string; week: number; summary: string; s: SnapStudent }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed">
      <p className="text-sm font-semibold">
        {title} · 第 {week} 周
      </p>
      <p>
        学生：{s.name}（{homeroomName(s.homeroomId)}）{s.hasContact ? "" : <Badge tone="warning">无已核验联系方式</Badge>}
      </p>
      {summary.trim() ? (
        <div>
          <p className="font-medium">本周学习</p>
          <p className="whitespace-pre-wrap">{summary}</p>
        </div>
      ) : null}
      <div>
        <p className="font-medium">课堂情况</p>
        {s.days.length ? (
          <ul>
            {s.days.map((d, k) => (
              <li key={k}>
                {WEEKDAY_CN[weekdayIdx(d.date)]} {fmtMD(d.date)}：
                {d.status === "UNRECORDED" ? "未记录" : d.status === "EXPLICIT_EMPTY" ? "不评价" : d.status === "NOT_APPLICABLE" ? "不适用" : `评价 ${d.grade ?? "—"}`}
                {d.attendance.length ? ` · ${d.attendance.map((a) => `${a.lesson}${a.v}${a.outboundReason ? `（${a.outboundReason}）` : ""}`).join("，")}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">不含课堂日期</p>
        )}
      </div>
      {s.homework.length ? (
        <div>
          <p className="font-medium">作业</p>
          <ul>
            {s.homework.map((h) => (
              <li key={h.assignmentId}>
                {h.title}：{h.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {s.highlights.length ? <p>亮点：{s.highlights.join("；")}</p> : null}
      {s.comment ? <p className="whitespace-pre-wrap">评语：{s.comment}</p> : null}
    </div>
  )
}

function PubViewer({ pub, onClose }: { pub: Publication; onClose: () => void }) {
  const mt = useMt()
  const [sid, setSid] = useState(pub.students[0]?.studentId ?? "")
  const [urls, setUrls] = useState<Record<string, string[]>>({})
  const [err, setErr] = useState("")
  const s = pub.students.find((x) => x.studentId === sid)
  const patch = (label: string, fn: (p: Publication) => Partial<Publication>) =>
    mt.command(label, (b) => ({ ...b, publications: b.publications.map((p) => (p.id === pub.id ? { ...p, ...fn(p) } : p)) }))

  const generate = async () => {
    if (!s) return
    setErr("")
    patch("生成图片", (p) => ({ image: { status: "GENERATING", attempts: p.image.attempts + 1 } }))
    try {
      if (mt.faults.imageFail) throw new Error("图片生成失败（故障注入）")
      const u = await renderStudentImages(pub, s)
      setUrls((m) => ({ ...m, [s.studentId]: u }))
      patch("图片已生成", (p) => ({ image: { ...p.image, status: "READY" } }))
    } catch (e) {
      patch("图片失败", (p) => ({ image: { ...p.image, status: "FAILED" } }))
      setErr(e instanceof Error ? e.message : "图片生成失败")
    }
  }

  return (
    <Modal
      wide
      title={`第 ${pub.revision} 版快照 · ${pub.classNameFormal} ${pub.courseName}`}
      desc={`${pub.id} · 发布于 ${clockLabel(pub.publishedAt)} · 快照不随之后的修改变化`}
      onClose={onClose}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select aria-label="选择学生" value={sid} onChange={(e) => setSid(e.target.value)} className="h-8 rounded-md border border-input bg-card px-2 text-sm">
          {pub.students.map((x) => (
            <option key={x.studentId} value={x.studentId}>
              {x.name}
            </option>
          ))}
        </select>
        <Btn size="sm" onClick={generate} disabled={!s}>
          <ImageIcon className="size-3.5" aria-hidden />
          {pub.image.status === "FAILED" ? "重试生成图片" : "生成该生图片"}
        </Btn>
        {err ? <span className="text-xs text-[#9a2b22]">{err}</span> : null}
      </div>
      {s ? (
        <>
          <ParentView title={`${pub.classNameFormal} · ${pub.courseName}`} week={pub.week} summary={pub.publicSummary} s={s} />
          {urls[s.studentId]?.length ? (
            <div className="mt-3 flex flex-col gap-2">
              {urls[s.studentId].map((u, i) => (
                <div key={u} className="flex items-center gap-2 text-xs">
                  <a href={u} target="_blank" rel="noreferrer" className="text-primary underline">
                    打开第 {i + 1}/{urls[s.studentId].length} 张
                  </a>
                  <a
                    href={u}
                    download={`${pub.id}-${s.studentId}-${i + 1}.png`}
                    onClick={() => patch("下载图片", (p) => ({ downloads: { ...p.downloads, [s.studentId]: mt.biz.clock } }))}
                    className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-2 py-0.5 hover:bg-muted"
                  >
                    <Download className="size-3" aria-hidden />
                    下载
                  </a>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {pub.downloads[s.studentId] ? <span>已下载（演示记录 {clockLabel(pub.downloads[s.studentId])}）</span> : null}
            {pub.manualSent[s.studentId] ? (
              <span>已人工发送（演示记录 {clockLabel(pub.manualSent[s.studentId])}，不代表家长已读）</span>
            ) : (
              <Btn size="sm" onClick={() => patch("标记人工发送", (p) => ({ manualSent: { ...p.manualSent, [s.studentId]: mt.biz.clock } }))}>
                标记已人工发送
              </Btn>
            )}
          </div>
        </>
      ) : null}
      <div className="mt-4 text-xs">
        <p className="font-medium">本版差异</p>
        <ul className="list-disc pl-4 text-muted-foreground">
          {pub.diffFromPrev.map((d, k) => (
            <li key={k}>{d}</li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
