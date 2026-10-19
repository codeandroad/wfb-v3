import {resolveSelection} from './selection'
import {canReadDocument,canReadSourceFile,canRetainItem,canUseAccess,emptyDocument,emptyItem,referenceFor,scopeValid,validateDocument,type Actor,type CatalogState,type Document,type Item,type ResearchState} from './model'
/** Export exactly the content the current actor may retain; historical/draft sharing cannot enlarge access. */
export function exportSourceDocument(state:ResearchState,actor:Actor,doc:Document):Document {
 const current=state.documents.find(d=>d.id===doc.id)
 if(!current||!canReadDocument(state,actor,current)||current.restricted||current.copyPolicy!=='retain')throw Error('当前来源不允许导出留存。')
 const out=structuredClone(doc),items=doc.items.filter(i=>canRetainItem(state,actor,i,doc.owner)),ids=new Set(items.map(i=>i.id))
 out.items=items.map(i=>({...structuredClone(i),parentId:i.parentId&&ids.has(i.parentId)?i.parentId:null,answer:i.answer&&state.documents.some(d=>d.id===i.answer!.documentId&&canReadDocument(state,actor,d)&&d.items.some(n=>n.id===i.answer!.itemId&&canRetainItem(state,actor,n,d.owner)))?i.answer:null}))
 out.files=doc.files.filter(f=>f.allowCopy!==false&&canReadSourceFile(state,actor,current,f)).map(f=>structuredClone(f))
 out.assessments=doc.assessments.map(a=>({...a,itemIds:a.itemIds.filter(id=>ids.has(id)),...(a.layout?{layout:{...a.layout,scopeRefs:a.layout.scopeRefs.filter(r=>ids.has(r.nodeId))}}:{})}))
 return out
}
export function exportSourceMarkup<T>(state:ResearchState,actor:Actor,value:{questions:Record<string,T>;[key:string]:unknown}) {
 const ids=new Set(state.documents.filter(d=>canReadDocument(state,actor,d)&&!d.restricted&&d.copyPolicy==='retain').flatMap(d=>d.items.filter(i=>canRetainItem(state,actor,i,d.owner)).map(i=>i.id)))
 return {...value,questions:Object.fromEntries(Object.entries(value.questions).filter(([id])=>id.startsWith('rs:')?!!resolveSelection(state,actor,id):ids.has(id)))}
}
const textFields=['title','body','notes','original','translation','supplement','source','section','printedPage','filePage','question','subquestion','stem','scoring'] as const
/** Local JSON is untrusted. Rebuild ownership, references and access from current records before committing. */
export function importSourceDocuments(raw:unknown,state:ResearchState,actor:Actor,catalog:CatalogState,course:string):Document[] {
 const payload=raw&&typeof raw==='object'&&!Array.isArray(raw)&&'document' in raw?(raw as {document:unknown}).document:raw;const input=Array.isArray(payload)?payload:[payload];if(!input.length||input.length>200)throw Error('请选择1—200份结构化资料。')
 return input.map(value=>{
  if(!value||typeof value!=='object')throw Error('资源 JSON 格式无效。')
  const r=value as Document
  if(typeof r.title!=='string'||!r.title.trim()||!['大纲','计划','资源','练习组合'].includes(r.kind)||!Array.isArray(r.items)||r.items.length>5000||r.course!==course)throw Error('文件资料格式或课程不匹配，请先进入相应课程。')
  const d:Document={...emptyDocument(crypto.randomUUID(),r.kind,r.title,actor.staff,actor.staff,course,r.period??null,state.groups),...structuredClone(r),id:crypto.randomUUID(),owner:actor.staff,author:actor.staff,version:1,share:{audience:'owner' as const,groups:[],staff:[]},files:[],paperSource:undefined,archived:false,restricted:false,copyPolicy:'retain' as const}
  const oldIds=new Set(r.items.map(i=>i?.id));if(oldIds.size!==r.items.length)throw Error('文件含重复项目标识。')
  const idMap=new Map(r.items.map(i=>[i.id,crypto.randomUUID()]))
  d.items=r.items.map(i=>{
   if(!i||typeof i.id!=='string'||textFields.some(k=>i[k]!==undefined&&typeof i[k]!=='string')||!Array.isArray(i.references)||!Array.isArray(i.unitIds)||!Array.isArray(i.weeks))throw Error('资源项目字段无效。')
   const next:Item={...emptyItem(idMap.get(i.id)!),...structuredClone(i),id:idMap.get(i.id)!,parentId:i.parentId?(idMap.get(i.parentId)||i.parentId):null,answer:null}
   next.references=i.references.map(ref=>{const source=state.documents.find(d=>d.id===ref.documentId),rev=state.revisions[`${ref.documentId}@${ref.version}`]??(source?.version===ref.version?source:null),item=rev?.items.find(i=>i.id===ref.itemId);if(!source||!rev||!item||(!canReadDocument(state,actor,source)&&!state.documents.some(d=>d.owner===actor.staff&&canReadDocument(state,actor,d)&&d.items.some(i=>i.references.some(existing=>existing.documentId===ref.documentId&&existing.version===ref.version&&existing.itemId===ref.itemId)&&canRetainItem(state,actor,i,d.owner))))||source.restricted||source.copyPolicy!=='retain'||!canRetainItem(state,actor,item,source.owner))throw Error('文件引用了当前不可留存的来源；导入未写入。');return referenceFor(rev,item,actor)})
   return next
  })
  if(r.paperSource){const source=state.documents.find(s=>s.id===r.paperSource!.id);if(!source||!canReadDocument(state,actor,source)||source.restricted||source.copyPolicy!=='retain')throw Error('试卷原文件来源当前不可留存。');d.paperSource={id:source.id,version:r.paperSource.version}}
  if(!Array.isArray(d.assessments)||!Array.isArray(d.paths))throw Error('考核数据格式无效。')
  d.assessments=d.assessments.map(a=>({...a,itemIds:a.itemIds.map(id=>idMap.get(id)||id),...(a.layout?{layout:{...a.layout,scopeRefs:a.layout.scopeRefs.map(ref=>({...ref,nodeId:idMap.get(ref.nodeId)||ref.nodeId}))}}:{})}))
  if(!scopeValid(d,catalog)||d.items.some(i=>i.unitIds.some(id=>!catalog.units.some(u=>u.code===id&&u.courseCode===course))))throw Error('课程或单元关联无效。')
  validateDocument(d);return d
 })
}
