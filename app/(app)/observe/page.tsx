"use client"

import { Suspense } from "react"
import { ObserveHub } from "@/components/observe/observe-hub"

export default function ObservePage() {
  return (
    <Suspense fallback={null}>
      <ObserveHub />
    </Suspense>
  )
}
