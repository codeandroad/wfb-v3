"use client"

import { getResearch } from "./store"
import { useResearchContext } from "./context"
export function useResearchForm<T extends object>(key: string, initial: T) {
  const { state,actor,command } = useResearchContext()
  const stored = state.forms[`${actor.staff}|${key}`] as T | undefined
  const value = stored ? { ...initial,...stored } : initial
  const set = (patch: Partial<T>) => command({ type: "form-draft",key,value: { ...initial,...(getResearch().forms[`${actor.staff}|${key}`] as T | undefined),...patch } })
  const reset = () => command({ type: "form-draft",key,value: initial })
  const clear = () => command({ type: "form-draft",key,value: undefined })
  return { value,set,reset,clear }
}
