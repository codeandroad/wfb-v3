export type ResearchGroup = {
  id: string
  name: string
  kind: "research_group"
  department: string
  subject: string
  active: boolean
}

export const RESEARCH_DEPARTMENT = "教务处"

export const RESEARCH_GROUPS: ResearchGroup[] = [
  { id: "math", name: "数学教研组", kind: "research_group", department: RESEARCH_DEPARTMENT, subject: "S001", active: true },
  { id: "physics", name: "物理教研组", kind: "research_group", department: RESEARCH_DEPARTMENT, subject: "S002", active: true },
  { id: "english", name: "英语教研组", kind: "research_group", department: RESEARCH_DEPARTMENT, subject: "", active: true },
  { id: "chemistry", name: "化学教研组", kind: "research_group", department: RESEARCH_DEPARTMENT, subject: "", active: true },
  { id: "computer-science", name: "计算机教研组", kind: "research_group", department: RESEARCH_DEPARTMENT, subject: "", active: true },
  { id: "economics", name: "经济教研组", kind: "research_group", department: RESEARCH_DEPARTMENT, subject: "", active: true },
  { id: "business", name: "商务教研组", kind: "research_group", department: RESEARCH_DEPARTMENT, subject: "", active: true },
]

/** Only the previous prototype default is remapped; custom affiliations remain intact. */
export function migrateResearchGroupDepartments(groups: ResearchGroup[]): ResearchGroup[] {
  return groups.map(group => group.department === "教学部" ? { ...group, department: RESEARCH_DEPARTMENT } : group)
}

export function researchGroupName(groups: ResearchGroup[], id: string) {
  return groups.find(group => group.id === id)?.name ?? id
}
