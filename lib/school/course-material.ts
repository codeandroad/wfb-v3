import { DUTY_BY_KEY, type DutyRecord, type StaffProfile } from "@/lib/demo/staff"
import type { CatalogState } from "@/lib/research/model"
import { dutyDateValid, dutyEffective, type DutyActor, type StaffDutyAssignment } from "./duty-model"

function activePerson(people: StaffProfile[], actor: DutyActor) {
  return actor.enabled ? people.find(person => person.id === actor.staff && person.status === "active" && person.accountStatus === "enabled") : undefined
}

const writableDuty = (duty: DutyRecord, actor: DutyActor) => duty.workMode === "rw" && dutyDateValid(duty.start) && (!duty.end || dutyDateValid(duty.end) && duty.end >= duty.start) && dutyEffective(duty, actor.date)

/** 课程代码是授权身份；名称、科组统筹和导航入口均不授予学校原稿维护权。 */
export function schoolSyllabusCourses(people: StaffProfile[], actor: DutyActor, catalog: CatalogState): string[] {
  const person = activePerson(people, actor)
  return [...new Set((person?.duties ?? []).filter(duty => duty.type === "course_material" && writableDuty(duty, actor)).flatMap(duty => (duty.scopeRefs ?? []).filter(ref => ref.kind === "course").map(ref => ref.id)))].filter(id => catalog.courses.some(course => course.code === id) && catalog.settings[id]?.active)
}

export function manageableMaterialCourses(people: StaffProfile[], actor: DutyActor, catalog: CatalogState, includeInactive = false): string[] {
  const person = activePerson(people, actor)
  if (!person) return []
  const courses = catalog.courses.filter(course => includeInactive || catalog.settings[course.code]?.active).map(course => course.code)
  if (person.duties.some(duty => duty.type === "school_admin" && writableDuty(duty, actor))) return courses
  const delegated = person.duties.filter(duty => duty.type === "course_material" && duty.canDelegateMaterials === true && writableDuty(duty, actor)).flatMap(duty => (duty.scopeRefs ?? []).filter(ref => ref.kind === "course").map(ref => ref.id))
  return courses.filter(id => delegated.includes(id))
}

export function createCourseMaterialDuty(id: string, staffId: string, courseIds: string[], start: string, end: string | undefined, catalog: CatalogState): StaffDutyAssignment {
  return { id, staffId, type: "course_material", scopeRefs: courseIds.map(id => ({ kind: "course", id })), scopeLabel: courseIds.map(id => { const course = catalog.courses.find(course => course.code === id); return course ? `${course.name} · ${id}` : id }).join("、"), scopeSub: "学校大纲维护；不含安排其他维护人的权限", status: "active", workMode: "rw", start, ...(end ? { end } : {}), basis: [{ role: DUTY_BY_KEY.course_material.role, config: "COURSE_MATERIAL_V2", source: "学校安排职责", assignment: courseIds.map(id => `course:${id}`).join(",") }], history: [{ date: start, text: "安排职责 · 课程资料维护" }] }
}
