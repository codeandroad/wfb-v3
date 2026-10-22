"use client"
import Link from "next/link"
import { useResearchContext } from "@/lib/research/context"
import { canEditDocument, type Document } from "@/lib/research/model"
import { documentAudience, documentEditIdentity, documentOwnership, isSchoolDocument } from "@/lib/research/document-presentation"

export function SourceAccess({ document: doc, school = false, historical = false }: { document: Document; school?: boolean; historical?: boolean }) {
  const { state, actor } = useResearchContext()
  const schoolView = isSchoolDocument(doc) && !school
  const canMaintain = canEditDocument(state, actor, doc)
  return <div className="cw-access-notice" data-testid="document-access">
    <div><strong>{documentOwnership(state, actor, doc)}</strong><span>{documentAudience(doc)}</span><span>{historical ? "历史版本 · 只读" : schoolView ? "共享原稿 · 在此只读" : documentEditIdentity(state, actor, doc)}</span></div>
    {schoolView && canMaintain && <Link className="btn sm" href={`/catalog?tab=syllabi&course=${encodeURIComponent(doc.course)}&view=syllabus&sub=read&doc=${encodeURIComponent(doc.id)}`}>前往学校大纲维护</Link>}
    {!historical && !schoolView && canMaintain && <small>{isSchoolDocument(doc) ? "保存修订更新学校共享版本；原有版本保留。" : state.groups.some(group => group.id === doc.owner) ? "保存修订更新组内共享版本；个人调整请先复制。" : "修改仅影响这份个人资料，不改写来源原稿。"}</small>}
  </div>
}
