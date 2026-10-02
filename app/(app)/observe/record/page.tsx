"use client"

import { Suspense } from "react"
import { RecordEditor } from "@/components/observe/record-editor"

export default function RecordPage() {
  return (
    <Suspense fallback={null}>
      <RecordEditor />
    </Suspense>
  )
}
