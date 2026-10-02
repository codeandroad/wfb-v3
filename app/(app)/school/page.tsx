import { SchoolHub } from "@/components/school/school-hub"

export default async function SchoolPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  return <SchoolHub initialTab={tab} />
}
