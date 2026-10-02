"use client"

import { EmptyState, PageHeader, Segmented } from "@/components/kit"
import { moduleEnabled } from "@/lib/demo/nav"
import { useDemo } from "@/lib/demo/store"
import { PlugZap } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ImportHub } from "./workbook/import-hub"
import { useState } from "react"
import { ParentLinkImport } from "./parent-link-import"
import { PersonImport } from "./person-import"

export type ImportKind = "students" | "staff" | "parents"

const KIND_OPTIONS: { value: ImportKind; label: string }[] = [
  { value: "students", label: "学生" },
  { value: "staff", label: "教职工" },
  { value: "parents", label: "学生家长关联" },
]

export function DataImport({ initialKind }: { initialKind: ImportKind | null }) {
  const demo = useDemo()
  const router = useRouter()
  const [kind, setKind] = useState<ImportKind>(initialKind ?? "students")

  if (!moduleEnabled("data", demo.config)) {
    return (
      <div>
        <PageHeader title="数据导入" desc="演示配置 B · DATA 模块未接入" />
        <EmptyState
          tone="warning"
          icon={<PlugZap className="size-7" />}
          title="DATA 模块未接入"
          desc="当前为演示配置 B：数据模块未接入，因此没有可操作的数据导入入口。这演示了当基础数据源缺失时，系统会明确阻止相关操作，而不是给出不可用的按钮。"
        />
      </div>
    )
  }

  if (initialKind === null) return <ImportHub />

  return (
    <div>
      <Link href="/import" className="mb-3 inline-block text-[13px] text-primary hover:underline">
        返回数据导入首页
      </Link>
      <PageHeader
        title="数据导入 · 常用捷径"
        desc="批量建立学生、教职工档案，或为已有学生建立家长关联（演示，不写入真实系统）。"
        actions={
          <Segmented<ImportKind>
            ariaLabel="导入类型"
            value={kind}
            options={KIND_OPTIONS}
            onChange={(v) => {
              setKind(v)
              router.replace(`/import?type=${v}`, { scroll: false })
            }}
          />
        }
      />
      {kind === "students" ? <PersonImport key="S" type="S" /> : null}
      {kind === "staff" ? <PersonImport key="E" type="E" /> : null}
      {kind === "parents" ? <ParentLinkImport /> : null}
    </div>
  )
}
