"use client"

import type { ReactNode } from "react"
import { DemoProvider } from "@/lib/demo/store"
import { TeachingProvider } from "@/lib/teaching/store"
import { ProfileProvider } from "@/lib/profile/store"
import { ToastProvider } from "@/components/kit"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DemoProvider>
      <TeachingProvider>
        <ProfileProvider>
          <ToastProvider>{children}</ToastProvider>
        </ProfileProvider>
      </TeachingProvider>
    </DemoProvider>
  )
}
