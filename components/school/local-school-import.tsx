"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Badge, Card, CardHeader, Input, Select, Segmented } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { getFoundation, PLACE_KIND_LABEL } from "@/lib/school/foundation-store"
import { getStaffList, useStaffPermission } from "@/lib/school/staff-store"
import { useStaffDuties } from "@/lib/school/duty-store"
import { validateLocalSchoolImport, type LocalSchoolImportBundle, type LocalSchoolImportMetadata } from "@/lib/school/local-import-model"
import { commitSchoolChange } from "@/lib/school/system-client"
import { applyLocalSchoolImport } from "@/lib/school/local-import-commit"

export function LocalSchoolImport({ metadata }: { metadata: LocalSchoolImportMetadata }) {
  const canMaintain = useStaffPermission()
  const [mounted, setMounted] = useState(false)
  const [loaded, setLoaded] = useState<{ bundle: LocalSchoolImportBundle; alreadyImported: boolean } | null>(null)
  const [error, setError] = useState("")
  const capability = useRef("")
  const requested = useRef(false)
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1)).get("import")
    if (fragment) {
      capability.current = fragment
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search)
    }
    setMounted(true)
  }, [])
  useEffect(() => {
    if (!mounted || !canMaintain || requested.current) return
    requested.current = true
    const foundation = getFoundation()
    const staff = getStaffList().filter(person => person.sourceBatch === metadata.batchId)
    const places = foundation.places.filter(place => place.sourceBatch === metadata.batchId)
    if (staff.length === metadata.summary.staffRows && places.length === metadata.summary.places && !capability.current) {
      setLoaded({ alreadyImported: true, bundle: { ...metadata, schema: 1, staff, places, departments: foundation.departments.filter(item => item.name in metadata.summary.departments), jobs: foundation.jobs } })
      return
    }
    fetch("/api/local-school-import", { method: "POST", credentials: "same-origin", cache: "no-store", headers: capability.current ? { Authorization: `Bearer ${capability.current}` } : {} })
      .then(async response => {
        if (!response.ok) throw new Error("unavailable")
        const bundle = validateLocalSchoolImport(await response.json())
        if (bundle.batchId !== metadata.batchId) throw new Error("batch changed")
        setLoaded({ bundle, alreadyImported: false })
      })
      .catch(() => setError("当前浏览器尚未连接本机人员资料。请在这个浏览器打开本次专用载入链接；仅打开普通核验页不会取得人员读取权限。"))
  }, [mounted, canMaintain, metadata])
  if (!mounted) return <p className="text-sm text-muted-foreground">正在载入本机文件核验…</p>
  if (!canMaintain) return <Card className="p-6">请使用具有教职工维护权限的身份进入本机文件核验。</Card>
  if (loaded) return <LocalSchoolImportContents {...loaded} />
  return <Card><CardHeader title="人员与场所 · 文件核验" desc={`${metadata.summary.staffRows} 条人员记录 · ${Object.keys(metadata.summary.departments).length} 个部门 · ${metadata.summary.places} 个场所`} /><p role="status" className="p-5 text-sm text-muted-foreground">{error || "正在载入本次文件…"}</p></Card>
}

function LocalSchoolImportContents({ bundle, alreadyImported }: { bundle: LocalSchoolImportBundle; alreadyImported: boolean }) {
  const canMaintain = useStaffPermission()
  const groups = useStaffDuties().groups
  const [mounted, setMounted] = useState(false)
  const [state, setState] = useState<"waiting" | "done" | "error">(alreadyImported ? "done" : "waiting")
  const [error, setError] = useState("")
  const [tab, setTab] = useState<"mapping" | "staff" | "places">("mapping")
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState("")
  const [onlyIssues, setOnlyIssues] = useState(false)
  const attempted = useRef(false)

  async function apply() {
    if (!canMaintain) return
    try {
      await commitSchoolChange(()=>applyLocalSchoolImport(bundle, canMaintain))
      setState("done"); setError("")
    } catch {
      setState("error"); setError("本机存储未能完成导入。已有数据和已追加的记录均保留，恢复存储后可以重试，不会重复新增。")
    }
  }
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!mounted || !canMaintain || alreadyImported || attempted.current) return
    attempted.current = true
    apply()
    // Import once into the ordinary persistent stores. School pages never
    // revisit this source; saved records remain usable without the source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, canMaintain, alreadyImported])

  const people = useMemo(() => bundle.staff.filter(person => (!scope || person.department === scope) && (!onlyIssues || person.duplicateName) && `${person.name} ${person.department} ${person.jobTitle}`.includes(query.trim())), [bundle, scope, query, onlyIssues])
  const places = useMemo(() => bundle.places.filter(place => (!scope || place.area === scope) && (!onlyIssues || !!place.note) && `${place.roomCode} ${place.usage} ${place.building}`.includes(query.trim())), [bundle, scope, query, onlyIssues])
  const switchTab = (value: typeof tab) => { setTab(value); setQuery(""); setScope(""); setOnlyIssues(false) }
  if (!mounted) return <p className="text-sm text-muted-foreground">正在载入本机文件核验…</p>
  if (!canMaintain) return <Card className="p-6">请使用具有教职工维护权限的身份进入本机文件核验。</Card>

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-semibold">人员与场所 · 文件核验</h1><p className="mt-1 text-sm text-muted-foreground">{bundle.staff.length} 条人员记录 · {bundle.departments.length} 个部门 · {bundle.places.length} 个场所</p></div>
      <div className="flex flex-wrap items-center gap-3 text-sm"><Link className="text-primary underline underline-offset-4" href="/school?tab=staff">查看教职工管理</Link><Link className="text-primary underline underline-offset-4" href="/school?tab=foundation&section=classrooms">查看场所目录</Link></div>
    </div>
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
      {state === "done" ? <><Badge tone="success">已导入当前浏览器</Badge><span>已保留原有数据。新人员为未开户档案；可在教职工管理中补充资料、安排职责。</span></> : state === "error" ? <><Badge tone="danger">导入未完成</Badge><span>{error}</span><Button size="sm" onClick={apply}>重试导入</Button></> : <span>正在追加到本机数据…</span>}
    </div>
    <Segmented value={tab} onChange={switchTab} ariaLabel="文件核验内容" options={[{ value: "mapping", label: "组织映射" }, { value: "staff", label: "教职工核验" }, { value: "places", label: "场所核验" }]} />
    {tab === "mapping" ? <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader title="部门与教研组" desc="部门记录行政归属；教研组记录教学协作范围。" /><div className="space-y-3 p-5 text-sm">
        {Object.entries(bundle.summary.departments).map(([name, count]) => <div key={name} className="border-b border-border pb-3 last:border-0"><div className="flex justify-between font-medium"><span>{name}</span><span className="text-muted-foreground">{count} 条记录</span></div>{name === "教务处" ? <div className="mt-2 flex flex-wrap gap-2 border-l-2 border-primary/30 pl-3">{groups.filter(g => g.department === "教务处" && g.active).map(group => <Badge key={group.id}>{group.name}</Badge>)}</div> : null}</div>)}
        <p className="text-muted-foreground">已有教研组与课程、资料的关联保留。组长、参与教师和学校统筹权限仍通过“安排职责”明确指定。</p>
      </div></Card>
      <Card><CardHeader title="待核对信息" desc="职位可用于提示学科，不能代替正式组员名单。" /><div className="space-y-4 p-5 text-sm">
        <div className="flex flex-wrap gap-2">{Object.entries(bundle.summary.suggestedSubjects).map(([name, count]) => <Badge key={name}>{name} {count}</Badge>)}</div>
        <p className="text-muted-foreground">兼任学科会同时列出。核对后可通过教职工的“安排职责”加入相应教研组；文件未提供的组长、任期、账号和工号保持空缺。</p>
        <p>{bundle.summary.duplicateNameRows} 条同名记录分别保留，未按姓名自动合并。</p>
        <p>{bundle.summary.multiUsePlaces} 个门牌包含多项用途，按原表合为一个场所并保留说明。</p>
        <p className="text-muted-foreground">区域按原表 A–F 区记录；楼层未提供，未根据门牌数字推断。空置与申请用途保留原文。</p>
      </div></Card>
    </div> : <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <Input className="max-w-sm" aria-label="搜索导入记录" placeholder={tab === "staff" ? "搜索姓名、部门或职位" : "搜索门牌、用途或区域"} value={query} onChange={event => setQuery(event.target.value)} />
        <Select aria-label={tab === "staff" ? "筛选部门" : "筛选区域"} value={scope} onChange={event => setScope(event.target.value)}><option value="">{tab === "staff" ? "全部部门" : "全部区域"}</option>{Object.keys(tab === "staff" ? bundle.summary.departments : bundle.summary.areas).map(name => <option key={name}>{name}</option>)}</Select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyIssues} onChange={event => setOnlyIssues(event.target.checked)} />{tab === "staff" ? "仅看同名待核对" : "仅看共用门牌"}</label>
        <span className="ml-auto text-sm text-muted-foreground">{tab === "staff" ? people.length : places.length} 条</span>
      </div>
      <div className="max-h-[65vh] overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-muted"><tr>{(tab === "staff" ? ["姓名", "部门", "职位", "待核对学科", "来源"] : ["区域 / 门牌", "类型", "原表用途", "核对说明", "来源"]).map(title => <th key={title} className="whitespace-nowrap px-4 py-3 font-medium">{title}</th>)}</tr></thead><tbody>
        {tab === "staff" ? people.map(person => <tr key={person.id} className="border-t border-border"><td className="px-4 py-3"><span className="whitespace-nowrap font-medium">{person.name}</span>{person.duplicateName ? <span className="ml-2"><Badge tone="warning">同名待核对</Badge></span> : null}</td><td className="px-4 py-3">{person.department}</td><td className="px-4 py-3">{person.jobTitle}</td><td className="px-4 py-3 text-muted-foreground">{person.suggestedResearchSubjects?.join("、") || "—"}</td><td className="px-4 py-3 text-xs text-muted-foreground">{person.sourceRefs?.join("；")}</td></tr>) : places.map(place => <tr key={place.id} className="border-t border-border"><td className="whitespace-nowrap px-4 py-3 font-medium">{place.area} · {place.roomCode}</td><td className="px-4 py-3">{PLACE_KIND_LABEL[place.kind ?? "other"]}</td><td className="px-4 py-3">{place.usage}</td><td className="px-4 py-3 text-muted-foreground">{place.note || "—"}</td><td className="px-4 py-3 text-xs text-muted-foreground">{place.sourceRef}</td></tr>)}
        {(tab === "staff" ? people.length : places.length) === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">没有符合条件的记录。</td></tr> : null}
      </tbody></table></div>
    </Card>}
    <p className="text-xs text-muted-foreground">{alreadyImported ? "当前显示本批次已保存的资料，统计保留导入时的来源数量。" : "文件核验显示本批次原始映射；后续修改请到教职工管理或场所目录查看。"}实际名单仅保存在本机，未加入代码仓库。</p>
  </div>
}
