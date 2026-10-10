export type ResearchGroup = {
  id: string
  name: string
  kind: "research_group"
  department: "教学部"
  subject: string
  active: boolean
}

export const RESEARCH_GROUPS: ResearchGroup[] = [
  { id: "math", name: "数学教研组", kind: "research_group", department: "教学部", subject: "S001", active: true },
  { id: "physics", name: "物理教研组", kind: "research_group", department: "教学部", subject: "S002", active: true },
  { id: "english", name: "英语教研组", kind: "research_group", department: "教学部", subject: "", active: true },
  { id: "chemistry", name: "化学教研组", kind: "research_group", department: "教学部", subject: "", active: true },
  { id: "computer-science", name: "计算机教研组", kind: "research_group", department: "教学部", subject: "", active: true },
  { id: "economics", name: "经济教研组", kind: "research_group", department: "教学部", subject: "", active: true },
  { id: "business", name: "商务教研组", kind: "research_group", department: "教学部", subject: "", active: true },
]

export function researchGroupName(groups: ResearchGroup[], id: string) {
  return groups.find(group => group.id === id)?.name ?? id
}
