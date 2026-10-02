"use client"

import { Badge, Card } from "@/components/kit"
import { BrandImage } from "@/components/school/brand-image"
import { NAV, navVisible } from "@/lib/demo/nav"
import { useDemo } from "@/lib/demo/store"
import { CURRENT_SCHOOL as S } from "@/lib/school/instance"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export default function SystemHomePage() {
  const demo = useDemo()
  const entries = NAV.filter((n) => n.href !== "/home" && navVisible(n, demo.scenario, demo.persona))

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="学校身份"
        className="relative isolate overflow-hidden rounded-2xl bg-sidebar text-sidebar-foreground"
      >
        <BrandImage
          src={S.brand.campus}
          alt={`${S.nameZh}校园`}
          className="absolute inset-0 -z-10 size-full object-cover"
          fallbackClassName="absolute right-4 top-4 text-sidebar-foreground/60"
          fallbackLabel="校园图片未上传"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-sidebar via-sidebar/70 to-sidebar/20" aria-hidden />
        <div className="flex min-h-72 flex-col justify-end gap-5 p-6 md:min-h-80 md:p-10">
          <BrandImage
            src={S.brand.logoWhite}
            alt={`${S.nameZh} Logo`}
            className="h-14 w-auto self-start object-contain md:h-16"
            fallbackClassName="h-14 w-40 self-start rounded-lg border border-dashed border-white/30 text-sidebar-foreground/70"
            fallbackLabel="白色 Logo 未上传"
          />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-sidebar-primary md:text-4xl">
              {S.nameZh}
            </h1>
            <p className="text-pretty text-base text-sidebar-foreground md:text-lg">{S.nameEn}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-sidebar-primary px-2 py-1 font-mono font-semibold tracking-wider text-sidebar-primary-foreground">
              {S.code}
            </span>
            <span className="text-sidebar-foreground/80">学校代码 · 本实例独立部署</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <TextBlock title="学校简介" text={S.intro.text} placeholder={S.intro.placeholder} />
          <TextBlock title="学校历史" text={S.history.text} placeholder={S.history.placeholder} />

          <Card className="p-5">
            <SectionTitle title="发展历程" hint="时间线 · Milestones" placeholder />
            <ol className="mt-4 flex flex-col">
              {S.milestones.map((m, i) => (
                <li key={m.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={
                        m.placeholder
                          ? "mt-1.5 size-2.5 rounded-full border-2 border-input bg-card"
                          : "mt-1.5 size-2.5 rounded-full bg-primary"
                      }
                      aria-hidden
                    />
                    {i < S.milestones.length - 1 ? <span className="w-px flex-1 bg-border" aria-hidden /> : null}
                  </div>
                  <div className="flex flex-col gap-1 pb-5">
                    <p className="text-xs text-muted-foreground">{m.period}</p>
                    <p className={m.placeholder ? "text-sm font-medium text-muted-foreground" : "text-sm font-medium"}>
                      {m.title}
                    </p>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{m.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5">
            <SectionTitle title="重要事件" hint="大事件" placeholder />
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {S.events.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 rounded-lg border border-dashed border-input p-3">
                  <p className="text-sm font-medium text-muted-foreground">{e.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{e.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4 p-5">
            <BrandImage
              src={S.brand.logoRed}
              alt={`${S.nameZh} Logo（红色）`}
              className="h-12 w-auto self-start object-contain"
              fallbackClassName="h-12 w-36 self-start rounded-lg border border-dashed border-input text-muted-foreground"
              fallbackLabel="红色 Logo 未上传"
            />
            <dl className="flex flex-col gap-2.5 text-[13px]">
              <Row label="中文名称" value={S.nameZh} />
              <Row label="英文名称" value={S.nameEn} />
              <Row label="学校代码" value={<span className="font-mono font-semibold">{S.code}</span>} />
              <Row label="部署方式" value="单校独立实例" />
            </dl>
            <p className="text-xs leading-relaxed text-muted-foreground">
              学校代码属于本实例配置，后续学生与教职工编号将以此为前缀。
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">进入业务</h2>
            <nav aria-label="业务模块" className="mt-3 flex flex-col">
              {entries.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="group flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] transition-colors hover:bg-muted"
                >
                  {n.label}
                  <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </nav>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function SectionTitle({ title, hint, placeholder }: { title: string; hint?: string; placeholder?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      {placeholder ? (
        <Badge tone="neutral" className="ml-auto">
          原型占位
        </Badge>
      ) : null}
    </div>
  )
}

function TextBlock({ title, text, placeholder }: { title: string; text: string; placeholder: boolean }) {
  return (
    <Card className="p-5">
      <SectionTitle title={title} placeholder={placeholder} />
      <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">{text}</p>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}
