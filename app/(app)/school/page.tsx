import { SchoolHub } from "@/components/school/school-hub"

export default async function SchoolPage({ searchParams }: { searchParams: Promise<{ tab?: string; section?: string }> }) {
  const { tab, section } = await searchParams
  return <SchoolHub key={`${tab ?? "year"}:${section ?? "departments"}`} initialTab={tab} initialSection={section} />
}
