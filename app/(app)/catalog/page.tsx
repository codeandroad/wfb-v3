import { Suspense } from "react"
import { SchoolWorkspace } from "@/components/research/school-workspace"
export default function CatalogPage() { return <Suspense fallback={<p>正在加载课程管理…</p>}><SchoolWorkspace /></Suspense> }
