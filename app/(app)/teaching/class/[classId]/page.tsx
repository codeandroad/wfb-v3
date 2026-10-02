import { ClassDetailPage } from "@/components/mt/class-detail"
import { Suspense } from "react"

export default async function ClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params
  return (
    <Suspense>
      <ClassDetailPage classId={decodeURIComponent(classId)} />
    </Suspense>
  )
}
