"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { MathQaDemo } from "@/components/timetable/math-qa-demo"
import { useDemo } from "@/lib/demo/store"
import { PERSONAS } from "@/lib/demo/nav"

export default function MathQaDemoPage() {
  const { persona } = useDemo()
  const router = useRouter()
  const canView = PERSONAS[persona].admin
  useEffect(() => {
    if (!canView) router.replace("/timetable/my")
  }, [canView, router])
  return canView ? <MathQaDemo /> : null
}
