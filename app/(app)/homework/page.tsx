import { HomeworkCenter } from "@/components/mt/homework-center"
import { Suspense } from "react"

export default function HomeworkPage() {
  return (
    <Suspense>
      <HomeworkCenter />
    </Suspense>
  )
}
