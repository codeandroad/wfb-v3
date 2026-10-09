"use client"

import { useResearchContext } from "./context"
export function useResearchForm<T extends object>(key: string, initial: T) {
  const { state,actor,command } = useResearchContext()
  const stored = state.forms[`${actor.staff}|${key}`] as T | undefined
  const value = stored ?? initial
  const set = (patch: Partial<T>) => command({ type: "form-draft",key,value: { ...value,...patch } })
  const reset = () => command({ type: "form-draft",key,value: initial })
  return { value,set,reset }
}
