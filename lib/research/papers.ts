import { CATALOG_UNITS } from "@/lib/demo/school"
import fixture from "./paper-fixture.json"
import { emptyDocument, emptyItem, type Document, type Item, type ItemTopic } from "./model"

export type PaperQuestion = { id: string; subj: string; year: string; sess: string; paper: string; variant: string; q: string; marks: number | null; answer: string; qp?: string; topic?: string; topics?: ItemTopic[]; notes?: string }
export type PaperRecord = { id: string; subject: string; year: string; session: string; paper: string; variant: string; files: Record<string,string>; questions: PaperQuestion[] }
const catalog = fixture.catalog as Record<string,Record<string,Record<string,Record<string,{ variant: string; files: Record<string,string> }[]>>>>
// The source extraction includes repeated scoring methods for the same question.
// Preserve every method in one question; conflicting marks stay unset for verification.
const grouped = new Map<string,PaperQuestion[]>()
for (const q of fixture.questions as PaperQuestion[]) grouped.set(q.id,[...(grouped.get(q.id) || []),q])
export const paperQuestions: PaperQuestion[] = [...grouped.values()].map(rows => ({ ...rows[0],topics: [...new Map(rows.flatMap(q => q.topics || []).map(t => [t.id,t])).values()],marks: new Set(rows.map(r => r.marks)).size === 1 ? rows[0].marks : null,answer: [...new Set(rows.map(r => r.answer))].join("\n\n—— 同题评分方法 ——\n\n"),notes: rows.length > 1 ? "已合并同题的多种评分方法；总分需核对原评分文件。" : "" }))
function pairedFiles(subject: string,year: string,session: string,files: Record<string,string>) {
 const gt = Object.values(catalog[subject]?.[year]?.[session] || {}).flat().find(v => v.files.gt)?.files.gt
 return { ...files,...(gt && !files.gt ? { gt } : {}) }
}
export const paperRecords: PaperRecord[] = Object.entries(catalog).flatMap(([subject, years]) => Object.entries(years).flatMap(([year, sessions]) => Object.entries(sessions).flatMap(([session, papers]) => Object.entries(papers).flatMap(([paper, variants]) => variants.filter(v => paper.trim() !== "Paper" && v.variant).map(v => ({ id: `html-paper-${subject}-${year}-${session}-${paper.replace(/\s+/g, "")}-${v.variant}`, subject, year, session, paper: paper.replace("Paper ", ""), variant: v.variant, files: pairedFiles(subject,year,session,v.files), questions: paperQuestions.filter(q => q.subj === subject && q.year === year && q.sess === session && q.paper === paper.replace("Paper ", "") && q.variant === v.variant) }))))))
const paired = fixture.paired11 as { q: string; qp: string; ms: string }[]
export function paperQuestionText(q: PaperQuestion) { return q.qp || (q.subj === "9618" && q.year === "2025" && q.sess === "夏季" && q.paper === "1" && q.variant === "1" ? paired.find(item => item.q === q.q)?.qp : "") || "题干尚未整理，请核对原试卷；不以答案替代题干。" }
export function paperDocuments(): Document[] { return paperRecords.map(p => {
  const doc = emptyDocument(p.id,"资源",`CIE ${p.subject} ${p.year}${p.session} P${p.paper} V${p.variant}`,"school-paper-library","u-lin",p.subject === "9709" ? "C101" : "C501",null)
  Object.assign(doc,{ paperSource: { id: p.id,version: 1 },resourceType: "真题",examYear: p.year,session: p.session,paperCode: `${p.paper}${p.variant}`,source: "由已确认 HTML 原型的真题目录与已解析题目移植",sourceVersion: "原型资料 1",share: { audience: "school",groups: [],staff: [] },notes: "保留已登记的 QP/MS/Insert/Source 路径；原 PDF 已按内容哈希随原型导入，QP/MS 可对照阅读。题干、分值与答案需由教师核对。",unitIds: [],scope: "whole" })
  const units = CATALOG_UNITS.filter(u => u.courseCode === doc.course && u.officialCode === `${p.subject}/${p.paper.padStart(2,"0")}`).map(u => u.code)
  doc.unitIds = units; doc.scope = units.length ? "units" : "whole"
  doc.items = p.questions.map(q => ({ ...emptyItem(q.id),title: `Q${q.q}`,body: paperQuestionText(q),scoring: q.answer || "",notes: q.notes || "",topics: q.topics || [],question: q.q,subquestion: "",maxScore: typeof q.marks === "number" ? q.marks : null,source: `${p.subject} ${p.year}${p.session} P${p.paper} V${p.variant} Q${q.q}`,unitIds: units }))
  return doc
}) }
export const paperDocumentsSeed = paperDocuments()
export function findPaperQuestion(state: { documents: Document[] }, id: string): { document: Document; item: Item } | undefined { for (const document of state.documents) { const item = document.items.find(i => i.id === id); if (item && document.resourceType === "真题") return { document,item } } }
