import { TaskListPage } from "@/components/mt/task-list"
import { Suspense } from "react"

export default function TeachingPage() {
  return (
    <Suspense>
      <TaskListPage />
    </Suspense>
  )
}
