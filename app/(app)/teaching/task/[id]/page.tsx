import { TaskWorkspacePage } from "@/components/mt/task-workspace"
import { Suspense } from "react"

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <TaskWorkspacePage id={decodeURIComponent(id)} />
    </Suspense>
  )
}
