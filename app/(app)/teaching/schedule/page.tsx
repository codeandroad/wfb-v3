import { redirect } from "next/navigation"

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") q.set(k, v)
  }
  const v = q.get("view")
  if (v !== "lessons" && v !== "days") q.set("view", "lessons")
  redirect(`/teaching?${q.toString()}`)
}
