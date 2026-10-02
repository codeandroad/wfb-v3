import type { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"
import { MtProvider } from "@/lib/mt/store"
import { SharedScheduleProviders } from "@/lib/schedule/app-providers"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <MtProvider>
      <SharedScheduleProviders>
        <AppShell>{children}</AppShell>
      </SharedScheduleProviders>
    </MtProvider>
  )
}
