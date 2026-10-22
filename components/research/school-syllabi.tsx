"use client"
import { useState } from "react"
import { DutyArrangeSheet } from "@/components/school/duty-arrange-sheet"
import { manageableMaterialCourses, schoolSyllabusCourses } from "@/lib/school/course-material"
import { useResearchContext } from "@/lib/research/context"
import { useWorkspaceNavigation } from "@/lib/research/navigation"
import { CourseWorkspace } from "./course-workspace"
import { SourceRoot, SButton } from "./source-ui"

export function SchoolSyllabi() {
  const { actor, people, catalog } = useResearchContext()
  const { params } = useWorkspaceNavigation("/catalog")
  const [assigning, setAssigning] = useState(false)
  const course = catalog.courses.find(c => c.code === params.get("course") && catalog.settings[c.code]?.active)?.code || catalog.courses.find(c => catalog.settings[c.code]?.active)?.code || ""
  const grantable = manageableMaterialCourses(people, actor, catalog).includes(course)
  const maintainers = people.filter(person => schoolSyllabusCourses(people, { staff: person.id, date: actor.date, enabled: true }, catalog).includes(course))
  return <>
    <SourceRoot><div className="cw-access-notice"><div><strong>本课程维护人</strong><span>{maintainers.map(person => person.name).join("、") || "尚无有效维护人"}</span></div>{grantable && <SButton className="sm" onClick={() => setAssigning(true)}>安排大纲维护人</SButton>}<small>按“课程资料维护”职责的课程范围与任期生效。组长身份不自动取得学校大纲编辑权。</small></div></SourceRoot>
    <CourseWorkspace school/>
    {assigning && grantable && <DutyArrangeSheet key={course} open presetDuty="course_material" presetScope={course} onClose={() => setAssigning(false)}/>}
  </>
}
