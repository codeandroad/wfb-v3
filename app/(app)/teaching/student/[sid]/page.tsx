import { StudentProfilePage } from "@/components/mt/student-profile"
import { Suspense } from "react"

export default async function StudentPage({ params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params
  return (
    <Suspense>
      <StudentProfilePage sid={decodeURIComponent(sid)} />
    </Suspense>
  )
}
