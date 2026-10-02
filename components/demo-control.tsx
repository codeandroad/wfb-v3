"use client"

import { Badge, Segmented, Sheet, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { useDemo } from "@/lib/demo/store"
import { FlaskConical, RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function DemoControlButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={compact ? "secondary" : "outline"} size="sm" onClick={() => setOpen(true)}>
        <FlaskConical className="size-3.5" />
        原型演示控制
      </Button>
      <DemoControlSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function DemoControlSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const demo = useDemo()
  const router = useRouter()
  const { push } = useToast()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="原型演示控制"
      desc="仅用于切换测试场景与演示配置，不是产品内的权限切换或自助授权功能。"
    >
      <div className="space-y-6">
        <section className="rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] p-3 text-[13px] leading-relaxed text-[#7a5514]">
          此处切换的是<strong>原型测试场景</strong>与<strong>演示配置</strong>。没有真实后端，权限演示不代表已实现生产级身份安全，
          也不等同于 STAFF 职责切换器。
        </section>

        <div className="space-y-2">
          <p className="text-[13px] font-medium">测试场景</p>
          <div className="space-y-2">
            <ScenarioCard
              active={demo.scenario === "teacher"}
              title="普通任课教师"
              desc="仅任课范围：工作台、我的教学。无管理员/班主任入口。"
              onClick={() => {
                demo.setScenario("teacher")
                router.push("/")
                push("已切换为：普通任课教师")
                onClose()
              }}
            />
            <ScenarioCard
              active={demo.scenario === "staff"}
              title="多职责教职工（示例林老师）"
              desc="同一 STAFF 登录同时具备学校管理员、任课教师、高一1班班主任入口。"
              onClick={() => {
                demo.setScenario("staff")
                router.push("/")
                push("已切换为：多职责教职工")
                onClose()
              }}
            />
            <ScenarioCard
              active={demo.scenario === "parent"}
              title="家长（GUARDIAN）"
              desc="只看关联孩子的已发布反馈，手机布局。不继承任何员工权限。"
              onClick={() => {
                demo.setScenario("parent")
                router.push("/parent")
                push("已切换为：家长模式")
                onClose()
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-medium">演示配置</p>
          <Segmented
            ariaLabel="演示配置"
            value={demo.config}
            onChange={(v) => {
              demo.setConfig(v)
              push(v === "full" ? "完整产品规划演示" : "仅身份与权限模块演示")
            }}
            options={[
              { value: "full", label: "A · 完整产品" },
              { value: "identityOnly", label: "B · 仅身份权限" },
            ]}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            配置 A 用合成数据演示完整教学、反馈与图片输出。配置 B 设定 DATA 与教学反馈模块未接入，业务入口不可操作，
            仅保留身份与权限模块。两者都是测试场景，不代表生产完成度。
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              demo.reset()
              push("已恢复初始演示场景")
            }}
          >
            <RotateCcw className="size-3.5" />
            恢复初始演示场景
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Badge tone="neutral">交互原型 · 示例数据</Badge>
        </p>
      </div>
    </Sheet>
  )
}

function ScenarioCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        active ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">{title}</span>
        {active ? <Badge tone="primary">当前</Badge> : null}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </button>
  )
}
