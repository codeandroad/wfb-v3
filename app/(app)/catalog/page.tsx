import { CatalogPanel } from "@/components/school/catalog-panel"
import { CURRENT_TERM_LABEL } from "@/lib/demo/school"

export default function CatalogPage() {
  return (
    <div>
      <div className="mb-4">
        <p className="text-[13px] font-medium text-muted-foreground">课程管理 · {CURRENT_TERM_LABEL}</p>
        <h1 className="mt-1 text-[22px] font-semibold leading-tight text-foreground">课程目录</h1>
      </div>
      <CatalogPanel />
    </div>
  )
}
