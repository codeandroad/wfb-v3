import { DataImport, type ImportKind } from "@/components/import/data-import"

const KINDS: ImportKind[] = ["students", "staff", "parents"]

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams
  if (!KINDS.includes(type as ImportKind)) return <DataImport initialKind={null} />
  return <DataImport initialKind={type as ImportKind} />
}
