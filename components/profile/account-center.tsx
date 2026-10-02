"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { KeyRound, LogOut, ShieldCheck } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge, Card, CardHeader, Modal, useToast } from "@/components/kit"
import { PasswordModal, PermissionDiagnosis } from "@/components/profile/account-tools"
import { HomepageDenied } from "@/components/profile/homepage-denied"
import { HomepageSettingsPanel } from "@/components/profile/homepage-settings"
import { AvatarEditor, DisplayNameEditor } from "@/components/profile/identity-editor"
import { SCHOOL_NAME } from "@/lib/demo/data"
import { useDemo } from "@/lib/demo/store"
import {
  ACCOUNT_STATUS_LABEL,
  activeDuties,
  DUTY_BY_KEY,
  STAFF_STATUS_LABEL,
  staffById,
  SYSTEM_ROLE_LABEL,
} from "@/lib/demo/staff"
import { hasTeacherHomepage, useProfile, useViewer } from "@/lib/profile/store"

export function AccountCenter() {
  const demo = useDemo()
  const viewer = useViewer()
  const profile = useProfile()
  const { push } = useToast()
  const [pwd, setPwd] = useState(false)
  const [diag, setDiag] = useState(false)

  if (viewer.kind !== "staff") return <HomepageDenied reason="not_staff" isParent={viewer.kind === "parent"} />
  const me = staffById(viewer.staffId)
  if (!me) return <HomepageDenied reason="invalid_staff" />

  const duties = activeDuties(me)
  const homepage = hasTeacherHomepage(me)
  const settings = profile.settingsOf(me.id)
  const counts = profile.countOf(me.id)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-balance text-xl font-semibold">账号中心</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">查看自己的账号与教职工身份，管理个人设置。</p>
      </div>

      <Card>
        <CardHeader title="个人资料" desc="头像与显示名只在这里修改，用于顶栏、教师主页、留言与通知，不改变正式档案。" />
        <div className="grid gap-6 px-5 py-4 md:grid-cols-2">
          <section className="flex flex-col gap-2">
            <h3 className="text-xs text-muted-foreground">头像</h3>
            <AvatarEditor staffId={me.id} />
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-xs text-muted-foreground">主页显示名</h3>
            <DisplayNameEditor staffId={me.id} />
          </section>
        </div>
      </Card>

      <Card>
        <CardHeader title="账号" />
        <div className="flex flex-col gap-4 px-5 py-4">
          <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
            <Info label="姓名">{me.name}</Info>
            <Info label="用户名">{me.username}</Info>
            <Info label="所属学校">{SCHOOL_NAME}</Info>
            <Info label="账号状态">
              <Badge tone={me.accountStatus === "enabled" ? "success" : "danger"}>{ACCOUNT_STATUS_LABEL[me.accountStatus]}</Badge>
            </Info>
          </dl>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={() => setPwd(true)}>
              <KeyRound className="size-3.5" aria-hidden />
              修改密码
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDiag(true)}>
              <ShieldCheck className="size-3.5" aria-hidden />
              权限诊断
            </Button>
            <Button variant="ghost" size="sm" onClick={() => push("已模拟退出登录（普通退出，非安全撤销）")}>
              <LogOut className="size-3.5" aria-hidden />
              退出登录
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="教职工身份" desc="由学校管理员维护。如信息有误，请联系学校管理员。" />
        <div className="flex flex-col gap-4 px-5 py-4">
          <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
            <Info label="教职工编号">
              <span className="font-mono">{me.employeeNo}</span>
            </Info>
            <Info label="任职状态">{STAFF_STATUS_LABEL[me.status]}</Info>
            <Info label="部门">{me.department}</Info>
            <Info label="岗位">{me.jobTitle}</Info>
          </dl>
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">系统角色</p>
            <div className="flex flex-wrap gap-1.5">
              {me.systemRoles.length ? me.systemRoles.map((r) => <Badge key={r}>{SYSTEM_ROLE_LABEL[r]}</Badge>) : <span className="text-[13px] text-muted-foreground">无</span>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">当前职责</p>
            {duties.length ? (
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {duties.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{DUTY_BY_KEY[d.type]?.label ?? d.type}</span>
                    <span className="text-muted-foreground">{d.scopeLabel}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted-foreground">{me.qualificationNote ?? "暂无职责。"}</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="联系方式" desc="教职工档案中的校内联系信息，只读。" />
        <div className="flex flex-col gap-3 px-5 py-4">
          <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
            <Info label="手机">{me.phone || "—"}</Info>
            <Info label="邮箱">{me.email || "—"}</Info>
          </dl>
          <p className="text-xs leading-relaxed text-muted-foreground">
            这些是人事档案信息，用于校内联系，不代表登录、验证或找回密码的方式。当前原型不提供账号恢复渠道设置。
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="教师主页" desc={homepage ? "与主页上的“主页设置”为同一份设置。" : undefined} />
        <div className="flex flex-col gap-4 px-5 py-4 text-[13px]">
          {homepage ? (
            <>
              <HomepageSettingsPanel ownerId={me.id} settings={settings} />
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Badge>{settings.intro ? "已填写教学介绍" : "未填写教学介绍"}</Badge>
                <Badge>{`留言 ${counts.comments} · 回复 ${counts.replies}`}</Badge>
                <Link href={`/people/${me.id}`} className={buttonVariants({ size: "sm", className: "ml-auto" })}>
                  查看我的主页
                </Link>
              </div>
            </>
          ) : (
            <p className="leading-relaxed text-muted-foreground">
              教师主页适用于任课教师与班主任。当前账号没有这些角色，因此没有教师主页；这不影响其他功能的使用。
            </p>
          )}
        </div>
      </Card>

      <PasswordModal open={pwd} onClose={() => setPwd(false)} accountName={me.name} />
      <Modal open={diag} onClose={() => setDiag(false)} title="权限诊断（演示）" desc="以普通语言解释当前账户的动作 × 对象范围 × 内容状态。" width="max-w-xl">
        <PermissionDiagnosis scenario={demo.scenario} />
      </Modal>
    </div>
  )
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
