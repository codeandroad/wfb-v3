import { TEACHERS, type ProjectedEntry } from "./data"
import { latestSeq, schoolTemplateFor, schoolWeekEntries } from "./store"

type SchoolSource = Parameters<typeof schoolWeekEntries>[0]

/** Include published staff without a teacher account or a current personal timetable. */
export function schoolOverviewTeacherIds(state: SchoolSource): string[] {
  return [...new Set([...TEACHERS.map(teacher => teacher.id), ...state.releases.flatMap(release => [...release.changedTeachers, ...Object.keys(release.templates)])])]
}

export function schoolOverviewEntries(state: SchoolSource, weekStart: string): ProjectedEntry[] {
  const seq = latestSeq(state)
  return schoolOverviewTeacherIds(state).flatMap(teacherId => schoolWeekEntries(state, teacherId, weekStart, seq))
}

export function schoolActivityEntries(state: SchoolSource, weekStart: string): ProjectedEntry[] {
  return schoolOverviewEntries(state, weekStart).filter(entry => entry.kind === "activity")
}

export interface SchoolActivityObject {
  name: string
  teacherIds: string[]
  rooms: string[]
}

/** Latest published templates form the directory, including activities outside the selected week. */
export function schoolActivityObjects(state: SchoolSource): SchoolActivityObject[] {
  const seq = latestSeq(state)
  const objects = new Map<string, SchoolActivityObject>()
  for (const teacherId of schoolOverviewTeacherIds(state)) {
    for (const entry of schoolTemplateFor(state, teacherId, seq)) {
      if (entry.kind !== "activity") continue
      const item = objects.get(entry.className) ?? { name: entry.className, teacherIds: [], rooms: [] }
      if (!item.teacherIds.includes(teacherId)) item.teacherIds.push(teacherId)
      if (entry.room && !item.rooms.includes(entry.room)) item.rooms.push(entry.room)
      objects.set(entry.className, item)
    }
  }
  return [...objects.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
}
