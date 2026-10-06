"use client"

import { Sheet } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { CheckCircle2, IdCard, UserCog } from "lucide-react"
import { useState } from "react"
import { FormalNoBadge } from "./person-no-field"
import { StaffFormFields, useStaffForm } from "./staff-form-fields"

/**
 * P04 新增教职工（教职工页入口）。
 * 与邀请流程内的“新增教职工”共用同一份表单字段（StaffFormFields）；
 * 仅返回位置与完成按钮不同：此处按钮为“创建教职工”，完成后回教职工页。
 * 仅建立人事档案（示例）；账号与工作在后续单独入口安排。
 */
export function StaffCreateModal({
  open,
  onClose,
  onArrange,
  onInvite,
}: {
  open: boolean
  onClose: () => void
  onArrange: (name: string) => void
  onInvite: (name: string) => void
}) {
  const [step, setStep] = useState<"form" | "done">("form")
  const [issuedNo, setIssuedNo] = useState("")
  const { state, set, setState, save, reset, saveError, displayName, jobLabel } = useStaffForm()
  const summaryMeta = [state.department, jobLabel].filter(Boolean).join(" / ") || "未填写部门 / 职务"

  function close() {
    if (step === "done") reset()
    else setState((s) => ({ ...s, touched: false }))
    setStep("form")
    onClose()
  }

  function submit() {
    set("touched", true)
    const person = save()
    if (!person) return
    setIssuedNo(person.employeeNo)
    setStep("done")
  }

  if (step === "done") {
    return (
      <Sheet
        open={open}
        onClose={close}
        width="max-w-lg"
        title="教职工档案已建立（示例）"
        desc="已保存到本次会话的共享原型档案，未写入正式后台。"
        footer={<Button onClick={close}>完成</Button>}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <span className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CheckCircle2 className="size-5" />
            </span>
            <div className="text-[13px]">
              <p className="font-medium text-foreground">
                {displayName} · {summaryMeta}
              </p>
              <dl className="mt-1.5 space-y-0.5 text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="w-16 shrink-0 text-muted-foreground/70">员工编号</dt>
                  <dd className="font-mono font-semibold tracking-wide text-foreground">{issuedNo || "待编号"}</dd>
                  {issuedNo ? <FormalNoBadge /> : null}
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted-foreground/70">来源</dt>
                  <dd>{!issuedNo ? "暂不编号" : state.numberIntent === "manual" ? "手工填写" : `按首次入职日期 ${state.joinedAt} 自动生成`}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted-foreground/70">职责</dt>
                  <dd>暂未安排</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted-foreground/70">账号</dt>
                  <dd>未开通</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border p-4">
            <p className="text-xs font-medium text-muted-foreground">后续可选（同一人物已预选）</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const n = displayName
                  close()
                  onArrange(n)
                }}
              >
                <UserCog className="size-3.5" />
                安排职责
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const n = displayName
                  close()
                  onInvite(n)
                }}
              >
                <IdCard className="size-3.5" />
                开通账号
              </Button>
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground/70">
              安排职责与开通账号是两个独立入口；关闭后可在人员列表重新打开同一份档案。
            </p>
          </div>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      width="max-w-2xl"
      title="新增教职工"
      desc="先建立人员档案，账号和工作可以稍后安排。"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            取消
          </Button>
          <Button onClick={submit}>创建教职工</Button>
        </>
      }
    >
      <StaffFormFields state={state} set={set} />
      {saveError ? <p role="alert" className="mt-3 text-sm text-destructive">{saveError}</p> : null}
    </Sheet>
  )
}
