import type { StaffProfile } from "../demo/staff"
import type { DepartmentItem } from "../demo/foundation"
import type { FoundationState } from "./foundation-store"

export type FoundationScope = "imports" | "all"
type SourcePerson = Pick<StaffProfile, "sourceBatch" | "department" | "departmentAffiliations">

export function foundationPeopleCount(item: { name: string; sourceBatch?: string; referencedBy: number; sourceReferencedBy?: number }, field: "department" | "jobTitle", people: Pick<StaffProfile, "department" | "jobTitle" | "sourceBatch">[]) {
  const sourceOnly = !!item.sourceBatch && !people.some(person => person.sourceBatch === item.sourceBatch)
  return { count: sourceOnly ? item.sourceReferencedBy ?? item.referencedBy : people.filter(person => person[field] === item.name).length, sourceOnly }
}

// A source department may reuse an existing catalog ID (e.g. 教务处). Keep it
// in the imported view even for batches saved before provenance was recorded
// on deduplicated items. Source affiliations stay stable after personnel edits.
export function importedFoundationItems(state: FoundationState, people: SourcePerson[]): FoundationState {
  const sourceDepartments = new Set(people.filter(person => person.sourceBatch).flatMap(person => person.departmentAffiliations ?? [person.department]))
  return {
    departments: state.departments.filter(item => !!item.sourceBatch || sourceDepartments.has(item.name)),
    jobs: state.jobs.filter(item => !!item.sourceBatch),
    places: state.places.filter(item => !!item.sourceBatch),
  }
}

// A rename in the ordinary catalog must not depend on visiting the special
// import page first. Save the source and the new name in the same catalog write.
export function renameFoundationDepartment(item: DepartmentItem, name: string, people: SourcePerson[]): DepartmentItem {
  const sourceBatch = item.sourceBatch ?? people.find(person => person.sourceBatch && (person.departmentAffiliations ?? [person.department]).includes(item.name))?.sourceBatch
  return { ...item, name, ...(sourceBatch ? { sourceBatch } : {}) }
}

export function defaultFoundationScope(imports: FoundationState): FoundationScope {
  return imports.departments.length || imports.jobs.length || imports.places.length ? "imports" : "all"
}

export function reorderFoundationItems<T extends { id: string; order: number }>(items: T[], id: string, direction: -1 | 1, visibleIds: string[]): T[] {
  const visible = new Set(visibleIds)
  const ordered = items.filter(item => visible.has(item.id)).sort((a, b) => a.order - b.order)
  const index = ordered.findIndex(item => item.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= ordered.length) return items
  const first = ordered[index], second = ordered[target]
  return items.map(item => item.id === first.id ? { ...item, order: second.order } : item.id === second.id ? { ...item, order: first.order } : item)
}
