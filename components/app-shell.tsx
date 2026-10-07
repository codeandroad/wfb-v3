"use client"

import { Badge, useToast } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { DemoControlButton } from "@/components/demo-control"
import { moduleEnabled, NAV, navVisible, pageTitle, PERSONAS } from "@/lib/demo/nav"
import { staffById } from "@/lib/demo/staff"
import { hasTeacherHomepage, useProfile } from "@/lib/profile/store"
import { NoticeBell } from "@/components/profile/notice-bell"
import { StaffAvatar } from "@/components/profile/staff-avatar"
import { SCHOOL_NAME } from "@/lib/demo/data"
import { CURRENT_SCHOOL } from "@/lib/school/instance"
import { BrandImage } from "@/components/school/brand-image"
import { useDemo } from "@/lib/demo/store"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Eye,
  FileSearch,
  House,
  LayoutDashboard,
  Library,
  Lock,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Upload,
  UserRound,
  Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"

const ICONS: Record<string, ReactNode> = {
  home: <House className="size-[18px]" />,
  dashboard: <LayoutDashboard className="size-[18px]" />,
  book: <BookOpen className="size-[18px]" />,
  library: <Library className="size-[18px]" />,
  clipboardList: <ClipboardList className="size-[18px]" />,
  users: <Users className="size-[18px]" />,
  clipboard: <ClipboardCheck className="size-[18px]" />,
  upload: <Upload className="size-[18px]" />,
  building: <Building2 className="size-[18px]" />,
  eye: <Eye className="size-[18px]" />,
  eyeManage: <FileSearch className="size-[18px]" />,
  timetable: <CalendarClock className="size-[18px]" />,
  myTimetable: <CalendarDays className="size-[18px]" />,
}

export function AppShell({ children }: { children: ReactNode }) {
  const demo = useDemo()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 家长场景不使用员工外壳
  useEffect(() => {
    if (demo.scenario === "parent") router.replace("/parent")
  }, [demo.scenario, router])

  const items = NAV.filter((n) => navVisible(n, demo.scenario, demo.persona))

  // 高亮最具体的匹配项：/observe/manage 命中时不同时点亮 /observe
  const activeHref = (() => {
    if (pathname === "/") return "/"
    const matches = items.filter(
      (n) => n.href !== "/" && (pathname === n.href || pathname.startsWith(n.href + "/")),
    )
    if (matches.length === 0) return pathname
    return matches.reduce((a, b) => (b.href.length > a.href.length ? b : a)).href
  })()

  return (
    <div className="flex min-h-svh bg-background">
      {/* 侧栏 */}
      <aside
        id="application-sidebar"
        aria-label="主导航侧栏"
        className={cn("sticky top-0 hidden h-svh w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground", sidebarOpen && "md:flex")}
      >
        <div className="mx-2 mt-3 mb-2 flex items-center">
          <Link
            href="/home"
            aria-label={`${CURRENT_SCHOOL.nameZh} · 进入系统主页`}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring"
          >
            <BrandImage
              src={CURRENT_SCHOOL.brand.crestRed}
              alt=""
              className="size-10 shrink-0 object-contain"
              fallbackClassName="size-10 shrink-0 rounded-lg bg-white/10 text-sidebar-foreground/70"
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-semibold text-white">{CURRENT_SCHOOL.nameZh}</p>
              <p className="truncate text-[11px] text-sidebar-foreground/70">
                {CURRENT_SCHOOL.code} · 周反馈系统
              </p>
            </div>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="折叠左侧栏"
            title="折叠左侧栏"
            aria-expanded={sidebarOpen}
            aria-controls="application-sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose />
          </Button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {items.map((item) => {
            const enabled = moduleEnabled(item.module, demo.config)
            const active = item.href === activeHref
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-white"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white",
                )}
              >
                {ICONS[item.icon]}
                <span className="flex-1">{item.label}</span>
                {!enabled ? <Lock className="size-3.5 opacity-60" aria-label="未接入" /> : null}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4">
          <div className="rounded-lg bg-white/5 p-3 text-[11px] leading-relaxed text-sidebar-foreground/70">
            交互原型 · 示例数据
            <br />
            模拟登录、权限与发布，未接入真实服务。
          </div>
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar pathname={pathname} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        <main className="flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  )
}

function TopBar({ pathname, sidebarOpen, onToggleSidebar }: { pathname: string; sidebarOpen: boolean; onToggleSidebar: () => void }) {
  const demo = useDemo()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 backdrop-blur md:px-8">
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        {!sidebarOpen ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label="展开左侧栏"
            title="展开左侧栏"
            aria-expanded={false}
            aria-controls="application-sidebar"
            onClick={onToggleSidebar}
          >
            <PanelLeftOpen />
          </Button>
        ) : null}
        <span className="hidden text-muted-foreground sm:inline">{SCHOOL_NAME}</span>
        <span className="hidden text-muted-foreground/50 sm:inline">/</span>
        <span className="truncate font-medium text-foreground">{pageTitle(pathname)}</span>
        {demo.config === "identityOnly" ? (
          <Badge tone="warning" className="ml-1 hidden sm:inline-flex">
            演示配置 B
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Badge tone="neutral" className="hidden lg:inline-flex">
          交互原型 · 示例数据
        </Badge>
        <DemoControlButton />
        <NoticeBell />
        <PersonalMenu />
      </div>
    </header>
  )
}

function PersonalMenu() {
  const demo = useDemo()
  const { push } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const profile = useProfile()
  const persona = PERSONAS[demo.persona]
  const me = staffById(persona.staffId)
  const name = me?.name ?? persona.label
  const homepage = me ? hasTeacherHomepage(me) : false
  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg border border-border bg-card py-1 pl-1 pr-2 text-[13px] transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {me ? (
          <StaffAvatar staffId={me.id} size="xs" className="size-7" />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {name.replace(/^示例/, "").slice(0, 1)}
          </span>
        )}
        <span className="hidden font-medium sm:inline">{me ? profile.displayNameOf(me.id) : name}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          <div className="px-2.5 py-2">
            <p className="text-[13px] font-semibold">{name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{persona.role}</p>
            <p className="mt-1 text-[11px] text-muted-foreground/70">同校单一账户 · 职责可叠加</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <MenuRow icon={<UserRound className="size-4" />} label="账号中心" onClick={() => go("/account")} />
          {homepage && me ? (
            <MenuRow icon={<House className="size-4" />} label="我的教师主页" onClick={() => go(`/people/${me.id}`)} />
          ) : null}
          <MenuRow
            icon={<LogOut className="size-4" />}
            label="退出登录"
            onClick={() => { setOpen(false); push("已模拟退出登录（普通退出，非安全撤销）") }}
          />
        </div>
      ) : null}
    </div>
  )
}

function MenuRow({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </button>
  )
}
