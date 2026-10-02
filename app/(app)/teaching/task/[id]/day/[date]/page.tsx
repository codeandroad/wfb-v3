import { DayRecordPage } from "@/components/mt/day-record"
import { Suspense } from "react"

export default async function DayPage({ params }: { params: Promise<{ id: string; date: string }> }) {
  const { id, date } = await params
  return (
    <Suspense>
      <DayRecordPage id={decodeURIComponent(id)} date={decodeURIComponent(date)} />
    </Suspense>
  )
}
