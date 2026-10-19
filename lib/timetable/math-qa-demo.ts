import type { ProjectedEntry, Teacher } from "./data"

// Standalone display fixture: never added to school releases, teacher directories or saved schedules.
export const MATH_QA_DEMO_WEEK = "2026-10-26"
export const MATH_QA_DEMO_DATE = "2026-10-28"
export const MATH_QA_DEMO_TEACHERS: Teacher[] = [
  { id: "demo-math-qa-a", name: "演示数学教师 A", subject: "数学", hasAccount: false },
  { id: "demo-math-qa-b", name: "演示数学教师 B", subject: "数学", hasAccount: false },
  { id: "demo-math-qa-c", name: "演示数学教师 C", subject: "数学", hasAccount: false },
  { id: "demo-math-qa-d", name: "演示数学教师 D", subject: "数学", hasAccount: false },
]

const DEMO_ROOMS = ["D101", "D102", "D105", "D208"]
export const MATH_QA_DEMO_ENTRIES: ProjectedEntry[] = MATH_QA_DEMO_TEACHERS.map((teacher, i) => ({
  key: `${teacher.id}-2026-10-28`,
  teacherId: teacher.id,
  className: "数学答疑",
  subject: teacher.subject,
  kind: "activity",
  date: MATH_QA_DEMO_DATE,
  weekday: 3,
  periodId: "a3",
  room: DEMO_ROOMS[i],
  validFrom: MATH_QA_DEMO_DATE,
  validTo: MATH_QA_DEMO_DATE,
}))
