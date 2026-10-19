"use client"
import { useRouter, useSearchParams } from "next/navigation"
export function useWorkspaceNavigation(path = "/research") {
  const params = useSearchParams(), router = useRouter()
  function navigate(values: Record<string,string>) { const q = new URLSearchParams(params); Object.entries(values).forEach(([k,v]) => v ? q.set(k,v) : q.delete(k)); router.push(`${path}?${q}`,{ scroll: false }) }
  return { params,navigate }
}
