import type { EducationExperience, StaffProfile, WorkExperience } from "@/lib/demo/staff"

export function educationExperiencesOf(staff: Pick<StaffProfile, "id" | "educationLevel" | "educationExperiences">): EducationExperience[] {
  const items = staff.educationExperiences ?? []
  if (!staff.educationLevel || items.some((item) => item.educationLevel === staff.educationLevel)) return items
  return [...items, { id: `${staff.id}-legacy-education`, educationLevel: staff.educationLevel }]
}

export function validBackgroundDate(value: string) {
  return !value || /^(?!0000)\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(value)
}

export function workRangeInvalid(start = "", end = "") {
  if (!start || !end || !validBackgroundDate(start) || !validBackgroundDate(end)) return false
  const earliestStart = start.length === 4 ? `${start}-01` : start
  const latestEnd = end.length === 4 ? `${end}-12` : end
  return latestEnd < earliestStart
}

export function backgroundError(firstWorkAt: string, education: EducationExperience[], work: WorkExperience[]) {
  if (!validBackgroundDate(firstWorkAt) || education.some((item) => !validBackgroundDate(item.graduation ?? "")) || work.some((item) => !validBackgroundDate(item.start ?? "") || !validBackgroundDate(item.end ?? ""))) return "时间请填写真实年份或年月，如 1998 或 2014-06。"
  if (work.some((item) => workRangeInvalid(item.start, item.end))) return "结束时间不能早于开始时间，请修正对应工作经历。"
  return ""
}

export function cleanEducation(items: EducationExperience[]) {
  return items.map((item) => ({ ...item, educationLevel: item.educationLevel?.trim(), school: item.school?.trim(), major: item.major?.trim(), graduation: item.graduation?.trim() })).filter((item) => item.educationLevel || item.school || item.major || item.graduation)
}
export function cleanWork(items: WorkExperience[]) {
  return items.map((item) => ({ ...item, organization: item.organization?.trim(), role: item.role?.trim(), start: item.start?.trim(), end: item.end?.trim() })).filter((item) => item.organization || item.role || item.start || item.end)
}
