"use client"

import { Badge, Checkbox, Field, Segmented, Select, Sheet, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { fmtClock, WEEKS } from "@/lib/timetable/data"
import { useTimetable } from "@/lib/timetable/store"
import { useDemo } from "@/lib/demo/store"
import { type Persona } from "@/lib/demo/nav"
import { FlaskConical, RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const PERSONA_LABEL: Record<Persona, string> = {
  admin: "教务管理员",
  lin: "示例林老师",
  zhou: "示例周老师",
  chen: "示例陈老师",
}

export function TimetableDemoBar() {
  const [open, setOpen] = useState(false)
  const tt = useTimetable()
  const { persona } = useDemo()
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px]">
        <Badge tone="neutral">原型演示</Badge>
        <span className="text-muted-foreground">
          当前身份 <strong className="text-foreground">{PERSONA_LABEL[persona]}</strong>
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground">
          演示时钟 <strong className="text-foreground">{fmtClock(tt.clock)}</strong>
        </span>
        <Button variant="outline" size="xs" className="ml-auto" onClick={() => setOpen(true)}>
          <FlaskConical className="size-3.5" />
          演示控制
        </Button>
      </div>
      <TimetableDemoSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function TimetableDemoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tt = useTimetable()
  const { persona, setPersona } = useDemo()
  const router = useRouter()
  const { push } = useToast()

  return (
    <Sheet open={open} onClose={onClose} title="课表原型演示控制" desc="切换演示人物、演示时钟与故障注入。仅为原型测试，不是产品角色/权限切换。">
      <div className="space-y-6">
        <section className="rounded-lg border border-[#e6d4a8] bg-[#fbf7ee] p-3 text-[12px] leading-relaxed text-[#7a5514]">
          这里的人物切换是<strong>浏览器内合成投影</strong>，用于验证不同视角；不代表已实现生产身份安全。
        </section>

        <div className="space-y-2">
          <p className="text-[13px] font-medium">演示人物</p>
          <div className="grid grid-cols-2 gap-2">
            {(["admin", "lin", "zhou", "chen"] as Persona[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPersona(p)
                  if (p === "admin") router.push("/timetable")
                  else router.push("/timetable/my")
                  push(`已切换为：${PERSONA_LABEL[p]}`)
                  onClose()
                }}
                aria-pressed={persona === p}
                className={`rounded-lg border p-2.5 text-left text-[13px] transition-colors ${
                  persona === p ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <span className="font-medium">{PERSONA_LABEL[p]}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {p === "admin" ? "课表中心（教务）" : "我的课表（教师）"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Field label="演示时钟（切换到某周并推进）">
          <Select
            value={tt.weekStart}
            onChange={(e) => {
              const w = WEEKS.find((x) => x.start === e.target.value)!
              // 推进到该周周一 09:00，用于演示未来生效
              tt.advanceClockTo(w.start)
              push(`演示时钟推进到第${w.no}周（${w.start}）`)
            }}
          >
            {WEEKS.map((w) => (
              <option key={w.start} value={w.start}>
                第{w.no}周 · {w.start} – {w.end}
              </option>
            ))}
          </Select>
        </Field>

        <div className="space-y-2">
          <p className="text-[13px] font-medium">故障注入</p>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Checkbox
              checked={tt.faults.teacherCurrentLoad}
              onChange={() => tt.toggleFault("teacherCurrentLoad")}
              label="教师当前读取失败（不得用学校版冒充）"
            />
            <Checkbox
              checked={tt.faults.notifyFail}
              onChange={() => tt.toggleFault("notifyFail")}
              label="通知处理失败（发布仍成功，课表页仍可更新）"
            />
            <Checkbox
              checked={tt.faults.adoptFail}
              onChange={() => tt.toggleFault("adoptFail")}
              label="采用失败（保留旧使用版，可重试）"
            />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              tt.reset()
              push("已恢复课表原型初始状态")
            }}
          >
            <RotateCcw className="size-3.5" />
            恢复初始状态
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
