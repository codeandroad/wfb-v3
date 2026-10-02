"use client"

import type { ReactNode } from "react"
import { useMt } from "@/lib/mt/store"
import { TimetableProvider } from "@/lib/timetable/store"
import { ScheduleBridge } from "./bridge"

/** r4：一个演示时钟、一份课表状态，同时供「我的课表」和「我的教学」使用。 */
export function SharedScheduleProviders({ children }: { children: ReactNode }) {
  const mt = useMt()
  const clock = mt.biz.clock.slice(0, 16)
  return (
    <TimetableProvider clock={clock} onClockChange={(c) => mt.setClock(`${c}:00+08:00`)}>
      <ScheduleBridge>{children}</ScheduleBridge>
    </TimetableProvider>
  )
}
