"use client"

import { Badge, Card, Sheet } from "@/components/kit"
import { Button } from "@/components/ui/button"
import {
  EMAIL_STATUS_LABEL,
  EMAIL_STATUS_TONE,
  INVITE_RECORDS,
  INVITE_STATUS_LABEL,
  INVITE_STATUS_TONE,
  SYSTEM_ROLE_LABEL,
  type InviteRecord,
  type InviteStatus,
} from "@/lib/demo/staff"
import { cn } from "@/lib/utils"
import { Link2, Mail, RotateCcw, Send, Ticket, Undo2, X } from "lucide-react"
import { useMemo, useState } from "react"
import { InfoNote, RoleBadge } from "./duty-bits"

const STATUS_FILTERS: { value: InviteStatus | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: INVITE_STATUS_LABEL.pending },
  { value: "accepted", label: INVITE_STATUS_LABEL.accepted },
  { value: "expired", label: INVITE_STATUS_LABEL.expired },
  { value: "revoked", label: INVITE_STATUS_LABEL.revoked },
  { value: "superseded", label: INVITE_STATUS_LABEL.superseded },
]

export function InviteRecordsPanel() {
  const [status, setStatus] = useState<InviteStatus | "all">("all")
  const [q, setQ] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => {
    return INVITE_RECORDS.filter((r) => {
      const matchStatus = status === "all" || r.status === status
      const matchQ = !q || r.person.includes(q) || r.id.toLowerCase().includes(q.toLowerCase())
      return matchStatus && matchQ
    })
  }, [status, q])

  const openRecord = openId ? INVITE_RECORDS.find((r) => r.id === openId) : undefined

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        一份邀请一行；无审批环节。交付情况（链接 / 邀请码 / 邮件）与邀请状态分列显示——邮件送达成功不等于对方已接受。
      </p>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  status === f.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索受邀人 / 编号"
            className="w-52 rounded-md border border-input bg-card px-3 py-1.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
          />
        </div>

        <div className="thin-scroll overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-[13px]">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">受邀人员 / 编号</th>
                <th className="px-3 py-2.5 font-medium">拟开通角色</th>
                <th className="px-3 py-2.5 font-medium">邀请状态</th>
                <th className="px-3 py-2.5 font-medium">交付情况</th>
                <th className="px-3 py-2.5 font-medium">有效截止</th>
                <th className="px-5 py-2.5 font-medium">最近操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-border align-top hover:bg-muted/40"
                  onClick={() => setOpenId(r.id)}
                >
                  <td className="px-5 py-3.5">
                    <span className="block font-medium text-foreground hover:text-primary hover:underline">
                      {r.person}
                    </span>
                    <span className="block font-mono text-xs text-muted-foreground">{r.id}</span>
                  </td>
                  <td className="px-3 py-3.5">
                    {r.roles.length ? (
                      <span className="flex flex-wrap gap-1">
                        {r.roles.map((role) => (
                          <span key={role} className="text-xs text-foreground">
                            {SYSTEM_ROLE_LABEL[role]}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">仅账号自服务</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    <Badge tone={INVITE_STATUS_TONE[r.status]}>{INVITE_STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td className="px-3 py-3.5">
                    <DeliveryCell record={r} />
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="text-[12.5px] text-muted-foreground">{r.expiresAt}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[12.5px] text-muted-foreground">{r.lastAction}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">没有符合条件的邀请。</div>
        ) : (
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">共 {rows.length} 份邀请</div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoNote>重发不改变编号与受邀人；重置凭证会使旧链接 / 旧码失效并升级版本；撤销后所有入口不可再接受。</InfoNote>
        <InfoNote>邀请有效期只影响“能否接受”，不决定职责期限或管理员任期；过期 / 撤销都不会带回失效的职责。</InfoNote>
      </div>

      {openRecord ? <InviteDetailSheet record={openRecord} onClose={() => setOpenId(null)} /> : null}
    </div>
  )
}

function DeliveryCell({ record }: { record: InviteRecord }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Link2 className="size-3" /> 链接
        <Ticket className="ml-1 size-3" /> 邀请码
      </span>
      <Badge tone={EMAIL_STATUS_TONE[record.emailStatus]}>
        <Mail className="size-3" />
        {EMAIL_STATUS_LABEL[record.emailStatus]}
      </Badge>
    </div>
  )
}

/* ---------------- P10 邀请详情 ---------------- */

function InviteDetailSheet({ record, onClose }: { record: InviteRecord; onClose: () => void }) {
  // 本地演示状态：重发 / 重置凭证 / 撤销只切换预设状态，不写真实系统
  const [status, setStatus] = useState<InviteStatus>(record.status)
  const [emailStatus, setEmailStatus] = useState(record.emailStatus)
  const [version, setVersion] = useState(record.credentialVersion)
  const [log, setLog] = useState<string[]>([])

  const active = status === "pending"

  function push(text: string) {
    setLog((l) => [...l, text])
  }

  function resend() {
    if (!active) return
    setEmailStatus("sent")
    push("重发邀请：编号与受邀人不变，邮件重新发送（示例）。")
  }
  function resetCred() {
    if (!active) return
    setVersion((v) => v + 1)
    push("重置凭证：旧链接 / 旧邀请码失效，凭证版本升级；人员与既定工作不重建。")
  }
  function revoke() {
    if (!active) return
    setStatus("revoked")
    push("撤销邀请：当前所有入口不可再接受；如仍需开通须重新核对并重新签发。")
  }

  return (
    <Sheet
      open
      onClose={onClose}
      width="max-w-xl"
      title={`邀请详情 · ${record.id}`}
      desc="编号为稳定非秘密标识，用于对账与查找，不能用于登录或授权。"
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      <div className="space-y-4">
        {/* 概要 */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{record.person}</span>
            <span className="text-xs text-muted-foreground">{record.personSub}</span>
            <Badge tone={INVITE_STATUS_TONE[status]}>{INVITE_STATUS_LABEL[status]}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {record.roles.length ? (
              record.roles.map((r) => <RoleBadge key={r} role={r} />)
            ) : (
              <Badge tone="neutral">仅账号自服务</Badge>
            )}
          </div>
          <dl className="mt-2.5 space-y-1 border-t border-border pt-2 text-xs">
            <Row k="工作安排" v={record.workPlan} />
            <Row k="账号处理" v={record.accountMode === "reuse" ? "复用既有账号" : "新建账号"} />
            <Row k="有效截止" v={`${record.expiresAt}（仅影响接受）`} />
            <Row k="凭证版本" v={`v${version}${version > record.credentialVersion ? "（已重置，旧入口失效）" : ""}`} />
          </dl>
        </div>

        {/* 交付情况 */}
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">交付情况（三种入口使用同一编号）</p>
          <div className="mt-2 space-y-1.5 text-[13px]">
            <p className="flex items-center gap-1.5">
              <Link2 className="size-3.5 text-primary" />
              <code className="truncate rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs">{record.link}</code>
            </p>
            <p className="flex items-center gap-1.5">
              <Ticket className="size-3.5 text-primary" />
              <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs">{record.code}</code>
            </p>
            <p className="flex items-center gap-1.5">
              <Mail className="size-3.5 text-muted-foreground" />
              <Badge tone={EMAIL_STATUS_TONE[emailStatus]}>{EMAIL_STATUS_LABEL[emailStatus]}</Badge>
              {record.emailTo ? <span className="text-xs text-muted-foreground">{record.emailTo}</span> : null}
            </p>
          </div>
        </div>

        {/* 操作 */}
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">邀请操作（示例，仅切换状态）</p>
          {active ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={resend}>
                <Send className="size-3.5" />
                重发
              </Button>
              <Button size="sm" variant="outline" onClick={resetCred}>
                <RotateCcw className="size-3.5" />
                重置凭证
              </Button>
              <Button size="sm" variant="outline" onClick={revoke}>
                <Undo2 className="size-3.5" />
                撤销
              </Button>
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <X className="size-3.5" />
              {status === "accepted"
                ? "已接受：不再重发或撤销；再次访问入口只显示既有结果。"
                : status === "revoked"
                  ? "已撤销：普通重发不能复活；如仍需开通请重新签发。"
                  : status === "superseded"
                    ? "旧版本已被替代：此入口失效，另见当前有效版本。"
                    : "已过期：可由有权者重新核对并重新签发。"}
            </p>
          )}
        </div>

        {record.supersededNote ? (
          <div className="rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] p-3 text-xs text-[#7a5514]">
            版本区：{record.supersededNote}
          </div>
        ) : null}

        {/* 事件历史 */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">事件历史</p>
          <ol className="space-y-2 border-l border-border pl-4">
            {record.events.map((e, i) => (
              <li key={i} className="relative text-[13px]">
                <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary/60" />
                <span className="font-mono text-xs text-muted-foreground">{e.time}</span>
                <span className="ml-2 text-foreground">{e.text}</span>
              </li>
            ))}
            {log.map((t, i) => (
              <li key={`live-${i}`} className="relative text-[13px]">
                <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                <span className="font-mono text-xs text-muted-foreground">本次</span>
                <span className="ml-2 text-foreground">{t}</span>
              </li>
            ))}
          </ol>
        </div>

        {record.note ? <InfoNote>{record.note}</InfoNote> : null}
      </div>
    </Sheet>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-muted-foreground/70">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  )
}
