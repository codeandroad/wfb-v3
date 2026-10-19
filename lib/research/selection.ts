import {canReadDocument,canRetainItem,referenceFor,type ResearchState,type Actor,type Document,type Item} from './model'
export function selectionKey(doc:Pick<Document,'id'|'version'>,item:Pick<Item,'id'>){return `rs:${encodeURIComponent(doc.id)}@${doc.version}:${encodeURIComponent(item.id)}`}
export function resolveSelection(state:ResearchState,actor:Actor,key:string):{document:Document;item:Item;key:string}|null {
 const match=key.match(/^rs:([^@]+)@([1-9]\d*):(.+)$/)
 let current:Document|undefined,version:number|undefined,id:string
 try{if(match){current=state.documents.find(d=>d.id===decodeURIComponent(match[1]));version=Number(match[2]);id=decodeURIComponent(match[3])}else{const candidates=state.documents.filter(d=>d.items.some(i=>i.id===key));if(candidates.length!==1)return null;current=candidates[0];version=current.version;id=key}}catch{return null}
 if(!current||current.archived||current.restricted||current.copyPolicy!=='retain'||!canReadDocument(state,actor,current))return null
 const doc=version===current.version?current:state.revisions[`${current.id}@${version}`],item=doc?.items.find(i=>i.id===id)
 return doc&&item&&canRetainSelection(state,actor,doc,item)?{document:doc,item:selectionContent(doc,item),key}:null
}
/** A common exercise stem belongs to its saved parent; use that same version when flattening selected subquestions. */
export function selectionContent(doc:Document,item:Item):Item {
 const parent=doc.items.find(i=>i.id===item.parentId)
 return item.layout?.kind==='exercise'&&parent?.layout?.kind==='exercise'?{...item,stem:parent.body,question:parent.layout.no||parent.question,subquestion:item.layout.no.replace(/^.*\(([^)]+)\).*$/,'$1')}:item
}

export function canRetainSelection(state:ResearchState,actor:Actor,doc:Document,item:Item){const parent=doc.items.find(i=>i.id===item.parentId);return canRetainItem(state,actor,item,doc.owner)&&(!(item.layout?.kind==='exercise'&&parent?.layout?.kind==='exercise')||canRetainItem(state,actor,parent,doc.owner))}

/** Freeze the provenance of both a subquestion and the shared exercise condition it contains. */
export function selectionReferences(doc:Document,item:Item,actor:Actor){
 const parent=doc.items.find(i=>i.id===item.parentId),shared=item.layout?.kind==='exercise'&&parent?.layout?.kind==='exercise'?parent:null
 const refs=[...item.references,referenceFor(doc,item,actor),...(shared?[...shared.references,referenceFor(doc,shared,actor)]:[])]
 return [...new Map(refs.map(ref=>[`${ref.documentId}@${ref.version}:${ref.itemId}`,ref])).values()]
}
