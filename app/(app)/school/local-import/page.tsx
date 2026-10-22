import { headers } from "next/headers"
import Link from "next/link"
import { readLocalSchoolImportMetadata } from "@/lib/school/local-import-server"
import { LocalSchoolImport } from "@/components/school/local-school-import"

export const dynamic = "force-dynamic"

export default async function LocalSchoolImportPage() {
  const metadata = await readLocalSchoolImportMetadata((await headers()).get("host"))
  if (!metadata) return <div className="rounded-xl border border-border bg-card p-6"><h1 className="text-lg font-semibold">本机文件核验</h1><p className="my-3 text-sm text-muted-foreground">当前没有可用的本机导入包。</p><Link href="/school?tab=foundation" className="text-primary underline">返回基础资料</Link></div>
  return <LocalSchoolImport metadata={metadata} />
}
