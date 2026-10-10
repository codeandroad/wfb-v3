"use client"

import { Badge, Modal, Sheet, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { DUTY_BY_KEY, WORK_MODE_LABEL, type DutyRecord } from "@/lib/demo/staff"
import { AdvancedBasis, CanCannotBlock, DutyStatusBadge, periodText } from "./duty-bits"
import { CircleAlert } from "lucide-react"
import { useState } from "react"
import { isResearchDuty, manageableResearchGroups } from "@/lib/school/duty-model"
import { useStaffDutyContext } from "@/lib/school/staff-store"
import { StaffDutyRevisionForm } from "./staff-duty-revision-form"

interface DetailProps {
  open: boolean
  onClose: () => void
  duty: DutyRecord
  staffName: string
  currentUseLimit?: string
  otherScopesRetained?: string[] // 结束本项后仍保留的其他范围
  onAdjust?: () => void
  onEnded?: (dutyId: string) => void
}

export function DutyDetailSheet({
  open,
  onClose,
  duty,
  staffName,
  currentUseLimit,
  otherScopesRetained,
  onAdjust,
  onEnded,
}: DetailProps) {
  const { push } = useToast()
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [revision, setRevision] = useState<"revise" | "end" | null>(null)
  const { state, people, actor, ready, error } = useStaffDutyContext()
  const def = DUTY_BY_KEY[duty.type]
  const shared = isResearchDuty(duty.type) ? state.assignments.find(item => item.id === duty.id) : undefined
  const canManage = !!shared && ready && !error && manageableResearchGroups(state, people, actor, shared.type).includes(shared.scopeRefs[0].id)
  const canEnd = !!shared && ready && !error && manageableResearchGroups(state, people, actor, shared.type, true).includes(shared.scopeRefs[0].id)

  if (!open) return null
  if (shared && revision) return <Sheet open onClose={onClose} title={revision === "end" ? "结束职责" : "修订职责任期"} desc={`${staffName} · ${def.label} · ${duty.scopeLabel}`} width="max-w-lg"><StaffDutyRevisionForm key={`${shared.id}:${revision}`} duty={shared} mode={revision} onCancel={() => setRevision(null)} onDone={message => { push(message); onClose() }} /></Sheet>

  const ended = duty.status === "ended"

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={`${def.label} · ${duty.scopeLabel}`}
        desc={staffName}
        width="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            {ended ? (
              <Button size="sm" variant="outline" onClick={onAdjust}>
                重新安排
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" disabled={!!shared && (!canEnd || duty.status === "pending" || duty.end === actor.date)} onClick={() => shared ? setRevision("end") : setConfirmEnd(true)}>
                  结束职责
                </Button>
                <Button size="sm" variant="outline" disabled={!!shared && (!canManage || people.find(person => person.id === shared.staffId)?.status === "left")} onClick={() => shared ? setRevision("revise") : onAdjust?.()}>
                  调整职责
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <DutyStatusBadge duty={duty} />
            <Badge tone="neutral">{WORK_MODE_LABEL[duty.workMode]}</Badge>
            <span className="text-[12.5px] text-muted-foreground">{periodText(duty)}</span>
          </div>

          {duty.scopeSub ? <p className="text-[13px] text-muted-foreground">范围补充：{duty.scopeSub}</p> : null}

          <CanCannotBlock duty={duty} />
          {shared && <p className="text-sm leading-relaxed text-muted-foreground">来自教职工管理的同一份职责记录，按业务日期 {actor.date} 核验；结束日期含当日。{duty.end === actor.date ? "今日为最后有效日，次日起停止本项访问。" : "未生效与已结束职责不授予教研工作区访问。"}{canEnd && !canManage && "负责对象已停用；当前只能结束旧职责，不可新增或延长任期。"}{!canEnd && "当前身份没有此负责对象的职责安排权。"}</p>}

          {currentUseLimit ? (
            <div className="flex items-start gap-2 rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] p-3 text-[12.5px] text-[#7a5514]">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <div>当前使用限制：{currentUseLimit}</div>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[13px] font-semibold">变更历史</p>
            <div className="space-y-1.5">
              {duty.history?.length ? duty.history.map((item, index) => <HistoryRow key={`${item.date}:${index}`} date={item.date} text={item.text} />) : <HistoryRow date={duty.start} text={`安排职责 · ${def.label}`} />}
              {duty.status === "pending" ? <HistoryRow date={duty.start} text="登记为未生效，到期自动生效" /> : null}
              {duty.status === "paused" ? <HistoryRow date={duty.start} text="职责暂停" /> : null}
              {ended ? <HistoryRow date={duty.end ?? duty.start} text="职责结束（历史保留）" /> : null}
            </div>
          </div>

          <AdvancedBasis duty={duty} />
        </div>
      </Sheet>

      <Modal
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title={`结束「${def.label} · ${duty.scopeLabel}」？`}
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmEnd(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirmEnd(false)
                onEnded?.(duty.id)
                push(`已结束「${def.label} · ${duty.scopeLabel}」（示例，未写入真实系统）`)
                onClose()
              }}
            >
              确认结束
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[13px] text-muted-foreground">
          <p>生效时间：即时结束（示例）。</p>
          <p>将结束此项本范围的权限；不会删除员工、账号、学生档案或历史记录；其他职责不受影响。</p>
          <p>无需先安排接任人员，允许暂时空缺。</p>
          {otherScopesRetained && otherScopesRetained.length ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-[12.5px]">
              <p className="mb-1 font-medium text-foreground">该人员仍保留的其他职责：</p>
              <ul className="list-inside list-disc space-y-0.5">
                {otherScopesRetained.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  )
}

function HistoryRow({ date, text }: { date: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5 text-[12.5px]">
      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <span className="font-mono text-muted-foreground">{date}</span>
      <span className="text-foreground">{text}</span>
    </div>
  )
}
