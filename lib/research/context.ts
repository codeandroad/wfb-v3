"use client"

import { PERSONAS } from "@/lib/demo/nav"
import { useDemo } from "@/lib/demo/store"
import { useMt } from "@/lib/mt/store"
import { dateOfClock } from "@/lib/mt/model"
import { useStaffList } from "@/lib/school/staff-store"
import { useCatalog } from "@/lib/school/catalog-store"
import { schoolPeriodMinutes, useResearch, researchCommand, type Actor, type Command } from "./store"

export function useResearchContext() {
  const demo = useDemo()
  const mt = useMt()
  const people = useStaffList(dateOfClock(mt.biz.clock))
  const state = useResearch()
  const catalog = useCatalog()
  const staff = PERSONAS[demo.persona].staffId
  const person = people.find(p => p.id === staff)
  const actor: Actor = { staff,date: dateOfClock(mt.biz.clock),enabled: mt.ready && demo.scenario !== "parent" && !!person && person.status !== "left" && person.accountStatus === "enabled" }
  return { state,actor,people,catalog,period: schoolPeriodMinutes(),ready: mt.ready,command: (action: Command) => researchCommand(actor,action) }
}
