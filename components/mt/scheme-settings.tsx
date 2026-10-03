"use client"

import { Badge, Card, LinkButton, PageHeader } from "@/components/kit"
import { MtLoadError, MtLoading } from "@/components/mt/shared"
import { Btn, Modal, inputCls } from "@/components/mt/ui"
import { useTeacherId } from "@/lib/mt/derive"
const weekLabel = (n: number) => `第 ${n} 周`
import {
  classroomUsedThisPeriod,
  curWeekOf,
  defaultUsesScheme,
  mySchemes,
  retireScheme,
  restoreArchived,
  saveScheme,
  schemeInBusiness,
  setDefault,
  type ClassroomTiming,
} from "@/lib/mt/scheme-ops"
import {
  LIMITS,
  PURPOSE_LABEL,
  SYSTEM_DEFAULT_REV,
  SYSTEM_SCHEMES,
  classroomDefaultAt,
  draftOfRev,
  homeworkDefaultNow,
  latestRev,
  levelText,
  ownerKey,
  parentText,
  pendingClassroom,
  revById,
  validateDraft,
  type Draft,
  type Purpose,
  type Scheme,
  type SchemeRev,
} from "@/lib/mt/schemes"
import { useMt } from "@/lib/mt/store"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { HwDaysCard, PageSizeCard, PhraseLibraryCard, StyleCard } from "@/components/mt/teacher-prefs"
import { SETTINGS_TABS, type SettingsTab } from "@/components/mt/teaching-hub"
import { useEffect, useMemo, useState } from "react"

const LAST_TAB_KEY = "tgs-mt:settings-tab"

function safeRet(v: string | null): string | null {
  return v && v.startsWith("/teaching") && !v.startsWith("//") ? v : null
}

function revTitle(rev: SchemeRev | null) {
  return rev ? rev.name : "未知方案"
}

type Editing = { schemeId: string | null; draft: Draft; source: Scheme["source"] }

export function SchemeSettings() {
  const mt = useMt()
  const teacherId = useTeacherId()
  const sp = useSearchParams()
  const ret = safeRet(sp.get("ret"))
  const [editing, setEditing] = useState<Editing | null>(null)
  const [adopt, setAdopt] = useState<SchemeRev | null>(null)
  const [retire, setRetire] = useState<{ scheme: Scheme; mode: "ARCHIVE" | "DELETE" } | null>(null)
  const [viewing, setViewing] = useState<SchemeRev | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const router = useRouter()
  const urlTab = SETTINGS_TABS.find(([k]) => k === sp.get("tab"))?.[0] ?? null
  const [lastTab, setLastTab] = useState<SettingsTab>("schemes")
  useEffect(() => {
    const v = window.localStorage.getItem(LAST_TAB_KEY)
    if (SETTINGS_TABS.some(([k]) => k === v)) setLastTab(v as SettingsTab)
  }, [])
  const tab: SettingsTab = urlTab ?? lastTab
  const goTab = (t: SettingsTab) => {
    setLastTab(t)
    window.localStorage.setItem(LAST_TAB_KEY, t)
    const p = new URLSearchParams(sp.toString())
    p.set("tab", t)
    router.replace(`/teaching/settings?${p.toString()}`, { scroll: false })
  }

  const header = (
    <>
      <PageHeader
        title="教学设置"
        desc="只影响你本人的教学界面与之后的新操作；不改写学生已有结果，也不改变他人设置。"
        actions={
          <LinkButton href={ret ?? "/teaching"} variant="outline">
            <ArrowLeft className="size-3.5" aria-hidden />
            {ret ? "返回原处" : "返回我的教学"}
          </LinkButton>
        }
      />
      <div role="tablist" aria-label="设置分类" className="mb-5 flex flex-wrap gap-1 border-b border-border">
        {SETTINGS_TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`settings-tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`settings-panel-${k}`}
            onClick={() => goTab(k)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  )

  if (!mt.ready) return <>{header}<MtLoading /></>
  if (mt.loadError) return <>{header}<MtLoadError /></>
  if (!teacherId)
    return (
      <>
        {header}
        <Card className="p-6 text-sm text-muted-foreground">当前身份不是任课教师，无法管理评价方案。</Card>
      </>
    )

  const biz = mt.biz
  const owner = ownerKey(teacherId)
  const cur = curWeekOf(biz)
  const clsNow = classroomDefaultAt(biz.schemes, owner, cur)
  const hwNow = homeworkDefaultNow(biz.schemes, owner, biz.clock)
  const pending = pendingClassroom(biz.schemes, owner, cur)
  const mine = mySchemes(biz.schemes, teacherId)
  const active = mine.filter((s) => !s.archived)
  const archived = mine.filter((s) => s.archived)
  const myNames = (exceptId: string | null) => mine.filter((s) => s.id !== exceptId).map((s) => latestRev(biz.schemes, s.id)?.name ?? "")

  const roleOf = (rev: SchemeRev) => {
    const out: string[] = []
    if (rev.schemeId === revById(clsNow)?.schemeId) out.push(clsNow === rev.id ? "课堂默认" : "课堂默认（旧修订）")
    if (rev.schemeId === revById(hwNow)?.schemeId) out.push(hwNow === rev.id ? "作业默认" : "作业默认（旧修订）")
    if (pending && revById(pending.revId)?.schemeId === rev.schemeId) out.push(`课堂·${weekLabel(pending.fromWeek)}起`)
    return out
  }

  const run = (label: string, fn: Parameters<typeof mt.command>[1], ok: string) => {
    const r = mt.command(label, fn)
    if (!r.ok) {
      setNotice(null)
      return r.error
    }
    setNotice(ok)
    return null
  }

  return (
    <>
      {header}

      {notice ? (
        <div role="status" className="mb-4 rounded-lg border border-[#cfe3d6] bg-[#eef6f0] px-3 py-2 text-sm text-[#1f5a3a]">
          {notice}
        </div>
      ) : null}

      <div role="tabpanel" id="settings-panel-schemes" aria-labelledby="settings-tab-schemes" hidden={tab !== "schemes"}>
      <section aria-label="当前默认" className="mb-5 grid gap-3 md:grid-cols-2">
        <DefaultCard
          purpose="CLASSROOM"
          rev={revById(clsNow)}
          isSystem={clsNow === SYSTEM_DEFAULT_REV}
          note={
            pending
              ? `已选择：${weekLabel(pending.fromWeek)}起使用「${revTitle(revById(pending.revId))}」，本期保持「${revTitle(revById(clsNow))}」`
              : classroomUsedThisPeriod(biz, teacherId)
                ? "修改可立即生效；本期已有评价的任务保留其已固定的标准"
                : "修改可立即生效"
          }
          onView={() => setViewing(revById(clsNow))}
        />
        <DefaultCard
          purpose="HOMEWORK"
          rev={revById(hwNow)}
          isSystem={hwNow === SYSTEM_DEFAULT_REV}
          note="用于之后新布置的作业；已布置作业保留原方案"
          onView={() => setViewing(revById(hwNow))}
        />
      </section>
      <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
        课堂默认与作业默认相互独立：设置其中一个不会改变另一个。默认适用于本人全部有权的教学任务，单个任务可在其课堂或作业页另行选择；不受列表搜索、筛选或正在浏览的周次影响，不改变其他教师。
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold">系统方案</h2>
          <p className="mb-3 text-xs text-muted-foreground">通用起点，不代表考试局、考试成绩或 GPA 标准；不能原地修改，可复制后调整。</p>
          <ul className="flex flex-col gap-2">
            {SYSTEM_SCHEMES.map((s) => {
              const rev = revById(s.revIds.at(-1))!
              return (
                <SchemeRow key={s.id} rev={rev} tags={[...(rev.id === SYSTEM_DEFAULT_REV ? ["系统推荐"] : []), ...roleOf(rev)]}>
                  <Btn size="sm" variant="ghost" onClick={() => setViewing(rev)}>查看</Btn>
                  <Btn size="sm" onClick={() => setAdopt(rev)}>采用</Btn>
                  <Btn
                    size="sm"
                    onClick={() =>
                      setEditing({
                        schemeId: null,
                        draft: { ...draftOfRev(rev), name: uniqueName(`我的${rev.name}`, myNames(null)) },
                        source: { schemeId: s.id, revId: rev.id, name: rev.name },
                      })
                    }
                  >
                    复制为我的
                  </Btn>
                </SchemeRow>
              )
            })}
          </ul>
        </Card>

        <Card className="p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">我的方案</h2>
            <Btn
              size="sm"
              variant="primary"
              onClick={() =>
                setEditing({
                  schemeId: null,
                  draft: { name: uniqueName("新方案", myNames(null)), desc: "", levels: blankLevels(), defaultLevelId: null, parentMode: "CODE_LABEL" },
                  source: null,
                })
              }
            >
              <Plus className="size-3.5" aria-hidden />
              新建空白
            </Btn>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">保存仅备用，不自动设为默认。复制得到独立副本，不与来源同步。</p>
          {active.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              还没有个人方案。可从系统方案复制，或新建空白方案。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {active.map((s) => {
                const rev = latestRev(biz.schemes, s.id)!
                return (
                  <SchemeRow key={s.id} rev={rev} tags={roleOf(rev)} source={s.source?.name}>
                    <Btn size="sm" variant="ghost" onClick={() => setViewing(rev)}>查看</Btn>
                    <Btn size="sm" onClick={() => setEditing({ schemeId: s.id, draft: draftOfRev(rev), source: s.source })}>编辑</Btn>
                    <Btn size="sm" onClick={() => setAdopt(rev)}>设为默认</Btn>
                    <Btn
                      size="sm"
                      onClick={() => setEditing({ schemeId: null, draft: { ...draftOfRev(rev), name: uniqueName(`${rev.name} 副本`, myNames(null)) }, source: { schemeId: s.id, revId: rev.id, name: rev.name } })}
                    >
                      复制
                    </Btn>
                    <Btn size="sm" variant="danger" onClick={() => setRetire({ scheme: s, mode: schemeInBusiness(biz, s) ? "ARCHIVE" : "DELETE" })}>
                      {schemeInBusiness(biz, s) ? "归档" : "删除"}
                    </Btn>
                  </SchemeRow>
                )
              })}
            </ul>
          )}
          {archived.length ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-muted-foreground">已归档 {archived.length} 套（仍可查看、复制；已采用的周期与作业可继续录入）</summary>
              <ul className="mt-2 flex flex-col gap-2">
                {archived.map((s) => {
                  const rev = latestRev(biz.schemes, s.id)!
                  return (
                    <SchemeRow key={s.id} rev={rev} tags={["已归档"]} muted>
                      <Btn size="sm" variant="ghost" onClick={() => setViewing(rev)}>查看</Btn>
                      <Btn size="sm" onClick={() => setEditing({ schemeId: null, draft: { ...draftOfRev(rev), name: uniqueName(`${rev.name} 副本`, myNames(null)) }, source: { schemeId: s.id, revId: rev.id, name: rev.name } })}>复制</Btn>
                      <Btn size="sm" onClick={() => { const e = run("恢复方案", (b) => restoreArchived(b, teacherId, s.id), `已恢复「${rev.name}」到我的方案`); if (e) setNotice(e) }}>恢复</Btn>
                    </SchemeRow>
                  )
                })}
              </ul>
            </details>
          ) : null}
        </Card>
      </div>
      </div>

      <div role="tabpanel" id="settings-panel-list" aria-labelledby="settings-tab-list" hidden={tab !== "list"}>
        <div className="grid gap-4 md:grid-cols-2">
          <HwDaysCard teacherId={teacherId} />
          <PageSizeCard teacherId={teacherId} />
        </div>
      </div>
      <div role="tabpanel" id="settings-panel-style" aria-labelledby="settings-tab-style" hidden={tab !== "style"}>
        <StyleCard teacherId={teacherId} />
      </div>
      <div role="tabpanel" id="settings-panel-phrases" aria-labelledby="settings-tab-phrases" hidden={tab !== "phrases"}>
        <PhraseLibraryCard teacherId={teacherId} />
      </div>

      {viewing ? <ViewModal rev={viewing} onClose={() => setViewing(null)} /> : null}

      {editing ? (
        <EditorModal
          key={editing.schemeId ?? "new"}
          init={editing}
          otherNames={myNames(editing.schemeId)}
          usedNow={classroomUsedThisPeriod(biz, teacherId)}
          curWeek={cur}
          onClose={() => setEditing(null)}
          onSave={(draft, purposes, timing) => {
            let msg = ""
            const r = mt.command("保存评价方案", (b) => {
              const s = saveScheme(b, teacherId, editing.schemeId, draft, editing.source)
              if ("error" in s) return s
              msg = s.changed ? `已保存「${draft.name.trim()}」` : "内容无变化，未产生新修订"
              if (!purposes.length) return s.biz
              const d = setDefault(s.biz, teacherId, s.revId, purposes, timing)
              if ("error" in d) return d
              msg += `，并设为${purposeScope(purposes, timing, cur)}`
              return d
            })
            if (!r.ok) return r.error
            setNotice(msg)
            setEditing(null)
            return null
          }}
        />
      ) : null}

      {adopt ? (
        <AdoptModal
          rev={adopt}
          usedNow={classroomUsedThisPeriod(biz, teacherId)}
          curWeek={cur}
          onClose={() => setAdopt(null)}
          onConfirm={(purposes, timing) => {
            const e = run("设为默认", (b) => setDefault(b, teacherId, adopt.id, purposes, timing), `「${adopt.name}」已设为${purposeScope(purposes, timing, cur)}`)
            if (!e) setAdopt(null)
            return e
          }}
        />
      ) : null}

      {retire ? (
        <RetireModal
          scheme={retire.scheme}
          mode={retire.mode}
          usedBy={defaultUsesScheme(biz, teacherId, retire.scheme.id)}
          options={[
            ...SYSTEM_SCHEMES.map((s) => revById(s.revIds.at(-1))!),
            ...active.filter((s) => s.id !== retire.scheme.id).map((s) => latestRev(biz.schemes, s.id)!),
          ]}
          onClose={() => setRetire(null)}
          onConfirm={(rep) => {
            const name = latestRev(biz.schemes, retire.scheme.id)?.name
            const e = run(
              retire.mode === "ARCHIVE" ? "归档方案" : "删除方案",
              (b) => retireScheme(b, teacherId, retire.scheme.id, retire.mode, rep),
              `已${retire.mode === "ARCHIVE" ? "归档" : "删除"}「${name}」；学生已有结果不变，不重算、不重新发布`,
            )
            if (!e) setRetire(null)
            return e
          }}
        />
      ) : null}
    </>
  )
}

function purposeScope(p: Purpose[], timing: ClassroomTiming, cur: number) {
  return p
    .map((x) => (x === "CLASSROOM" ? `课堂默认（${timing === "NOW" ? "本期起" : `${weekLabel(cur + 1)}起`}）` : "作业默认（之后新布置的作业）"))
    .join("、")
}

function uniqueName(base: string, taken: string[]) {
  if (!taken.includes(base)) return base
  for (let i = 2; ; i++) if (!taken.includes(`${base} ${i}`)) return `${base} ${i}`
}

let lid = 0
function nextLevelId() {
  lid += 1
  return `L${Date.now().toString(36)}${lid}`
}
function blankLevels() {
  return [
    { id: nextLevelId(), code: "", label: "", guide: "" },
    { id: nextLevelId(), code: "", label: "", guide: "" },
  ]
}

function DefaultCard({ purpose, rev, isSystem, note, onView }: { purpose: Purpose; rev: SchemeRev | null; isSystem: boolean; note: string; onView: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{PURPOSE_LABEL[purpose]}默认</p>
          <p className="mt-0.5 text-base font-semibold">
            {revTitle(rev)}
            {isSystem ? <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">系统默认</span> : null}
          </p>
        </div>
        <Btn size="sm" variant="ghost" onClick={onView}>查看等级</Btn>
      </div>
      {rev ? (
        <p className="mt-2 flex flex-wrap gap-1">
          {rev.levels.map((l) => (
            <span key={l.id} className={cn("rounded-md border border-border px-1.5 py-0.5 text-xs", l.id === rev.defaultLevelId && "border-primary/40 bg-primary/5 text-primary")}>
              {levelText(l)}
            </span>
          ))}
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{note}</p>
    </Card>
  )
}

function SchemeRow({ rev, tags, source, muted, children }: { rev: SchemeRev; tags: string[]; source?: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex flex-col gap-2 rounded-lg border border-border p-3", muted && "bg-muted/40")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{rev.name}</span>
        <span className="text-xs text-muted-foreground">{rev.levels.length} 档</span>
        {tags.map((t) => (
          <Badge key={t} tone={t.includes("默认") || t.includes("起") ? "info" : "neutral"}>{t}</Badge>
        ))}
        {source ? <span className="text-xs text-muted-foreground">来自「{source}」</span> : null}
      </div>
      <p className="truncate text-xs text-muted-foreground">{rev.levels.map(levelText).join(" · ")}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </li>
  )
}

function LevelTable({ rev }: { rev: Pick<SchemeRev, "levels" | "defaultLevelId"> }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">等级与判断说明（从高到低）</caption>
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="py-1 pr-3 font-normal">等级</th>
          <th className="py-1 font-normal">判断说明</th>
        </tr>
      </thead>
      <tbody>
        {rev.levels.map((l) => (
          <tr key={l.id} className="border-t border-border align-top">
            <td className="whitespace-nowrap py-1.5 pr-3 font-medium">
              {levelText(l)}
              {l.id === rev.defaultLevelId ? <span className="ml-1.5 text-xs font-normal text-primary">常规默认</span> : null}
            </td>
            <td className="py-1.5 text-muted-foreground">{l.guide || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ViewModal({ rev, onClose }: { rev: SchemeRev; onClose: () => void }) {
  return (
    <Modal title={rev.name} desc={rev.desc || undefined} onClose={onClose} footer={<Btn onClick={onClose}>关闭</Btn>}>
      <LevelTable rev={rev} />
      <p className="mt-3 text-xs text-muted-foreground">家长呈现：{rev.parentMode === "LABEL_ONLY" ? "仅文字释义" : "等级＋释义"}</p>
    </Modal>
  )
}

function PurposePicker({ value, onChange, timing, setTiming, usedNow, curWeek }: { value: Purpose[]; onChange: (v: Purpose[]) => void; timing: ClassroomTiming; setTiming: (t: ClassroomTiming) => void; usedNow: boolean; curWeek: number }) {
  const toggle = (p: Purpose) => onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p])
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xs text-muted-foreground">用于</legend>
      {(["CLASSROOM", "HOMEWORK"] as Purpose[]).map((p) => (
        <label key={p} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.includes(p)} onChange={() => toggle(p)} />
          {PURPOSE_LABEL[p]}
          <span className="text-xs text-muted-foreground">{p === "HOMEWORK" ? "之后新布置的作业" : ""}</span>
        </label>
      ))}
      {value.includes("CLASSROOM") ? (
        <div className="ml-6 flex flex-col gap-1 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="timing" checked={timing === "NOW"} onChange={() => setTiming("NOW")} />
            立即生效（本期 {weekLabel(curWeek)} 起）
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="timing" checked={timing === "NEXT"} onChange={() => setTiming("NEXT")} />
            自{weekLabel(curWeek + 1)}起
          </label>
          {usedNow && timing === "NOW" ? (
            <p className="text-xs leading-relaxed text-muted-foreground">本期尚未评价的任务立即改用新方案；本期已有评价的任务保留其已固定的标准，已录入的等级不受影响。</p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  )
}

function AdoptModal({ rev, usedNow, curWeek, onClose, onConfirm }: { rev: SchemeRev; usedNow: boolean; curWeek: number; onClose: () => void; onConfirm: (p: Purpose[], t: ClassroomTiming) => string | null }) {
  const [purposes, setPurposes] = useState<Purpose[]>([])
  const [timing, setTiming] = useState<ClassroomTiming>("NOW")
  const [err, setErr] = useState<string | null>(null)
  return (
    <Modal
      title={`采用「${rev.name}」`}
      desc="请明确选择用途；未勾选的用途保持不变。不会改写已有评价，也不会重新发布。"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>取消</Btn>
          <Btn variant="primary" disabled={!purposes.length} onClick={() => setErr(onConfirm(purposes, timing))}>确认采用</Btn>
        </>
      }
    >
      <PurposePicker value={purposes} onChange={setPurposes} timing={timing} setTiming={setTiming} usedNow={usedNow} curWeek={curWeek} />
      {err ? <p role="alert" className="mt-3 text-sm text-[#9a2b22]">{err}</p> : null}
    </Modal>
  )
}

function RetireModal({ scheme, mode, usedBy, options, onClose, onConfirm }: { scheme: Scheme; mode: "ARCHIVE" | "DELETE"; usedBy: Purpose[]; options: SchemeRev[]; onClose: () => void; onConfirm: (rep: string) => string | null }) {
  const [rep, setRep] = useState(SYSTEM_DEFAULT_REV)
  const [err, setErr] = useState<string | null>(null)
  const verb = mode === "ARCHIVE" ? "归档" : "删除"
  return (
    <Modal
      title={`${verb}方案`}
      desc={
        mode === "ARCHIVE"
          ? "该方案已被评价、作业或发布引用，只能归档。已采用的周期与作业仍可继续录入和补评。"
          : "该方案尚未被任何评价、作业或发布引用，可以删除。"
      }
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>取消</Btn>
          <Btn variant="danger" onClick={() => setErr(onConfirm(rep))}>确认{verb}</Btn>
        </>
      }
    >
      {usedBy.length ? (
        <label className="flex flex-col gap-1 text-sm">
          <span>它仍是你的{usedBy.map((p) => PURPOSE_LABEL[p]).join("、")}默认，请选择替代：</span>
          <select className={inputCls} value={rep} onChange={(e) => setRep(e.target.value)}>
            {options.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.id === SYSTEM_DEFAULT_REV ? "（系统默认）" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-muted-foreground">未被默认引用。{verb}不删除学生结果，不重算、不重新发布。</p>
      )}
      <input type="hidden" value={scheme.id} />
      {err ? <p role="alert" className="mt-3 text-sm text-[#9a2b22]">{err}</p> : null}
    </Modal>
  )
}

function EditorModal({
  init,
  otherNames,
  usedNow,
  curWeek,
  onClose,
  onSave,
}: {
  init: Editing
  otherNames: string[]
  usedNow: boolean
  curWeek: number
  onClose: () => void
  onSave: (d: Draft, purposes: Purpose[], timing: ClassroomTiming) => string | null
}) {
  const [d, setD] = useState<Draft>(init.draft)
  const [touched, setTouched] = useState(false)
  const [asDefault, setAsDefault] = useState(false)
  const [purposes, setPurposes] = useState<Purpose[]>([])
  const [timing, setTiming] = useState<ClassroomTiming>("NOW")
  const [err, setErr] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const issues = useMemo(() => validateDraft(d, otherNames), [d, otherNames])
  const fieldErr = (f: string) => (touched ? issues.filter((i) => i.field === f || i.field.startsWith(`${f}:`)).map((i) => i.msg) : [])

  const setLevel = (i: number, patch: Partial<Draft["levels"][number]>) => setD((x) => ({ ...x, levels: x.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))
  const move = (i: number, dir: -1 | 1) =>
    setD((x) => {
      const ls = [...x.levels]
      const j = i + dir
      if (j < 0 || j >= ls.length) return x
      ;[ls[i], ls[j]] = [ls[j], ls[i]]
      return { ...x, levels: ls }
    })
  const remove = (i: number) =>
    setD((x) => {
      const gone = x.levels[i]
      return { ...x, levels: x.levels.filter((_, j) => j !== i), defaultLevelId: x.defaultLevelId === gone.id ? "__REMOVED" : x.defaultLevelId }
    })

  const previewRev = { ...d, id: "preview", schemeId: "preview", n: 0, at: "", defaultLevelId: d.defaultLevelId === "__REMOVED" ? null : d.defaultLevelId }
  const sample = previewRev.levels.find((l) => l.id === preview) ?? previewRev.levels.find((l) => l.id === previewRev.defaultLevelId) ?? previewRev.levels[0]

  const submit = () => {
    setTouched(true)
    if (issues.length) {
      setErr("请先修正标出的问题")
      return
    }
    if (asDefault && !purposes.length) {
      setErr("请选择要设为默认的用途，或取消“同时设为默认”")
      return
    }
    setErr(onSave(d, asDefault ? purposes : [], timing))
  }

  return (
    <Modal
      wide
      title={init.schemeId ? "编辑方案" : init.source ? `复制自「${init.source.name}」` : "新建方案"}
      desc="保存只保留方案备用，不改变已采用的标准，也不给学生评分。已被使用的修订不会被改写。"
      onClose={onClose}
      footer={
        <>
          {err ? <span role="alert" className="mr-auto text-sm text-[#9a2b22]">{err}</span> : null}
          <Btn onClick={onClose}>取消</Btn>
          <Btn variant="primary" onClick={submit}>{asDefault ? "保存并设为默认" : "保存"}</Btn>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            方案名称
            <input className={inputCls} maxLength={LIMITS.name + 4} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
            <FieldErr msgs={fieldErr("name")} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>方案说明 <span className="text-xs text-muted-foreground">（可选）</span></span>
            <input className={inputCls} maxLength={LIMITS.desc + 4} value={d.desc} onChange={(e) => setD({ ...d, desc: e.target.value })} />
            <FieldErr msgs={fieldErr("desc")} />
          </label>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm">等级（从高到低，顺序即评价语义）</span>
              <Btn size="sm" variant="ghost" disabled={d.levels.length >= LIMITS.levels} onClick={() => setD({ ...d, levels: [...d.levels, { id: nextLevelId(), code: "", label: "", guide: "" }] })}>
                <Plus className="size-3.5" aria-hidden />
                增加一档
              </Btn>
            </div>
            <FieldErr msgs={fieldErr("levels")} />
            <ol className="flex flex-col gap-2">
              {d.levels.map((l, i) => (
                <li key={l.id} className="rounded-lg border border-border p-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
                    <input aria-label={`第 ${i + 1} 档标识`} placeholder="标识，如 A 或 达到目标" className={cn(inputCls, "w-32")} value={l.code} onChange={(e) => setLevel(i, { code: e.target.value })} />
                    <input aria-label={`第 ${i + 1} 档简短释义`} placeholder="简短释义" className={inputCls} value={l.label} onChange={(e) => setLevel(i, { label: e.target.value })} />
                    <Btn size="sm" variant="ghost" aria-label="上移" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></Btn>
                    <Btn size="sm" variant="ghost" aria-label="下移" disabled={i === d.levels.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></Btn>
                    <Btn size="sm" variant="ghost" aria-label="删除此档" onClick={() => remove(i)}><Trash2 className="size-3.5" /></Btn>
                  </div>
                  <input aria-label={`第 ${i + 1} 档判断说明`} placeholder="判断说明（可选），帮助区分相邻等级" className={cn(inputCls, "mt-1.5")} value={l.guide} onChange={(e) => setLevel(i, { guide: e.target.value })} />
                  <FieldErr msgs={fieldErr(`level:${l.id}`)} />
                </li>
              ))}
            </ol>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              常规确认默认等级
              <select className={inputCls} value={d.defaultLevelId ?? ""} onChange={(e) => setD({ ...d, defaultLevelId: e.target.value || null })}>
                {d.defaultLevelId === "__REMOVED" ? <option value="__REMOVED">（原默认已删除，请重新选择）</option> : null}
                <option value="">不设置</option>
                {d.levels.map((l, i) => (
                  <option key={l.id} value={l.id}>{l.code || l.label ? levelText({ ...l, code: l.code.trim(), label: l.label.trim() }) : `第 ${i + 1} 档`}</option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">仅在你明确执行常规确认时作为候选值</span>
              <FieldErr msgs={fieldErr("default")} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              家长呈现方式
              <select className={inputCls} value={d.parentMode} onChange={(e) => setD({ ...d, parentMode: e.target.value as Draft["parentMode"] })}>
                <option value="CODE_LABEL">等级＋释义</option>
                <option value="LABEL_ONLY">仅文字释义</option>
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={asDefault} onChange={(e) => setAsDefault(e.target.checked)} />
              同时设为默认
            </label>
            {asDefault ? (
              <div className="mt-2">
                <PurposePicker value={purposes} onChange={setPurposes} timing={timing} setTiming={setTiming} usedNow={usedNow} curWeek={curWeek} />
              </div>
            ) : null}
          </div>
        </div>

        <aside aria-label="效果预览" className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">预览 · 样例，不写入学生记录</p>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">教师选择时</p>
            <div className="flex flex-wrap gap-1">
              {previewRev.levels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setPreview(l.id)}
                  className={cn("rounded-md border border-border bg-card px-1.5 py-0.5 text-xs", sample?.id === l.id && "border-primary bg-primary text-primary-foreground")}
                >
                  {l.code.trim() || l.label.trim() ? levelText({ ...l, code: l.code.trim(), label: l.label.trim() }) : "（空）"}
                </button>
              ))}
            </div>
            {sample?.guide ? <p className="mt-1 text-xs text-muted-foreground">{sample.guide}</p> : null}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">家长看到</p>
            <div className="rounded-md border border-border bg-card p-2 text-sm">
              <p className="text-xs text-muted-foreground">示例学生 · 课堂表现</p>
              <p className="font-medium">{sample ? parentText(previewRev, { ...sample, code: sample.code.trim(), label: sample.label.trim() }) : "—"}</p>
            </div>
          </div>
        </aside>
      </div>
    </Modal>
  )
}

function FieldErr({ msgs }: { msgs: string[] }) {
  if (!msgs.length) return null
  return (
    <span role="alert" className="text-xs text-[#9a2b22]">
      {[...new Set(msgs)].join("；")}
    </span>
  )
}
