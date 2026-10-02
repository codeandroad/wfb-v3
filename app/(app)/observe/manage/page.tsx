"use client"

import { Suspense } from "react"
import { ManageHub } from "@/components/manage/manage-hub"

export default function ManagePage() {
  return (
    <Suspense fallback={null}>
      <ManageHub />
    </Suspense>
  )
}
