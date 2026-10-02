"use client"

import { Badge, Modal, useToast } from "@/components/kit"

export function PasswordModal({ open, onClose, accountName }: { open: boolean; onClose: () => void; accountName: string }) {
  const { push } = useToast()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="修改密码"
      desc="个人操作，独立于管理他人账户；原型不校验真实密码。"
      width="max-w-md"
      footer={
        <>
          <button className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted" onClick={onClose}>
            取消
          </button>
          <button
            className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground"
            onClick={() => {
              onClose()
              push("提示：密码修改流程完成（未写入真实系统）")
            }}
          >
            确认修改
          </button>
        </>
      }
    >
      <div className="space-y-3 text-[13px] text-muted-foreground">
        <p>此处仅演示个人改密码的入口位置，与“为他人管理职责”明确分离。</p>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
          当前账户：{accountName} · 修改密码不改变已获得的任何职责。
        </div>
      </div>
    </Modal>
  )
}

export function PermissionDiagnosis({ scenario }: { scenario: string }) {
  const rows =
    scenario === "teacher"
      ? [
          { action: "编辑周反馈草稿", scope: "本人任教：高一数学A班 P1、S1", state: "草稿 / 已发布（本人）", ok: true },
          { action: "查看其他教师草稿", scope: "—", state: "内部草稿", ok: false },
          { action: "管理全校账号", scope: "—", state: "—", ok: false },
        ]
      : [
          { action: "管理全校账号职责", scope: "全校 STAFF", state: "账户与职责", ok: true },
          { action: "编辑周反馈草稿", scope: "本人任教：P1、S1", state: "草稿 / 已发布（本人）", ok: true },
          { action: "查看本主班已发布反馈", scope: "高一1班", state: "仅已发布", ok: true },
          { action: "编辑其他教师草稿", scope: "—", state: "内部草稿", ok: false },
        ]
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        权限按“动作 + 对象范围 + 内容状态”组合。同一个人可以管理全校账号，但仍只能编辑自己负责的单元；一个管理动作的全校范围不会扩大到所有教学动作。
      </p>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">动作</th>
              <th className="px-3 py-2 font-medium">对象范围</th>
              <th className="px-3 py-2 font-medium">内容状态</th>
              <th className="px-3 py-2 font-medium">结果</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-3 py-2">{r.action}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.scope}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.state}</td>
                <td className="px-3 py-2">{r.ok ? <Badge tone="success">允许</Badge> : <Badge tone="danger">拒绝</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
