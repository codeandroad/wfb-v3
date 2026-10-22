"use client"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

const courseViews = new Set(["syllabus", "plans", "resources", "papers", "builder"])
const schoolTabs = new Set(["directory", "groups", "tasks", "outcomes", "syllabi"])

export function workspaceHref(params: { toString(): string }, values: Record<string,string>, path = "/research") {
  const q = new URLSearchParams(params.toString())
  Object.entries(values).forEach(([key,value]) => value ? q.set(key,value) : q.delete(key))

  // An explicit destination changes scope. Old ambiguous URLs keep their explicit
  // personal/shared scope until the caller chooses a group or another space.
  if (values.space === "personal" || values.space === "shared") q.delete("group")
  else if (values.group && !Object.hasOwn(values,"space")) q.delete("space")

  if (path === "/catalog" && q.get("tab") === "syllabi") {
    // All nested syllabus readers/editors remain inside school maintenance.
    q.set("view","syllabus")
    q.delete("group")
    q.delete("space")
  } else if (path === "/research") {
    const entersCourse = !!values.doc || !!values.course || courseViews.has(values.view)
    if (schoolTabs.has(q.get("tab") || "") || entersCourse && (!values.tab || values.tab === "courses")) {
      q.set("tab",q.get("doc") || q.get("course") || q.get("view") ? "courses" : "overview")
    }
  }
  const query = q.toString()
  return `${path}${query ? `?${query}` : ""}`
}

export function useWorkspaceNavigation(path?: string) {
  const params = useSearchParams(), router = useRouter(), pathname = usePathname()
  function navigate(values: Record<string,string>, destination?: string) {
    const target = destination ?? path ?? (pathname === "/catalog" ? "/catalog" : "/research")
    router.push(workspaceHref(params,values,target),{ scroll: false })
  }
  return { params,navigate }
}
