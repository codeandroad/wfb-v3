import { WeekSchedulePage } from "@/components/mt/week-schedule"
import { Suspense } from "react"

export default function SchedulePage() {
  return (
    <Suspense>
      <WeekSchedulePage />
    </Suspense>
  )
}
