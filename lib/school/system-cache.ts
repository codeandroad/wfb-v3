// A staged edit changes no browser storage and publishes no UI event before the
// database transaction succeeds. These adapters also retain standalone preview use.
let shared=false
const memory=new Map<string,string|null>()
export function enableSharedSchoolCache(){shared=true}
let stage: { values: Map<string,string|null>; notifications: Set<()=>void> } | null = null
export function schoolCacheStorage(kind:"localStorage"|"sessionStorage") {
  return {
    getItem(key:string) { const id=`${kind}:${key}`; if(stage?.values.has(id))return stage.values.get(id)!;if(memory.has(id))return memory.get(id)!;try{return window[kind].getItem(key)}catch(error){if(!shared)throw error;return null} },
    setItem(key:string,value:string) { if(stage) stage.values.set(`${kind}:${key}`,value); else {try{window[kind].setItem(key,value);memory.delete(`${kind}:${key}`)}catch(error){if(!shared)throw error;memory.set(`${kind}:${key}`,value)}} },
    removeItem(key:string) { if(stage) stage.values.set(`${kind}:${key}`,null); else {try{window[kind].removeItem(key);memory.delete(`${kind}:${key}`)}catch(error){if(!shared)throw error;memory.set(`${kind}:${key}`,null)}} },
  }
}
export function publishSchoolCache(notify:()=>void) { if(stage) stage.notifications.add(notify); else notify() }
export function stageSchoolCache<T>(action:()=>T) {
  if(stage) throw Error("另一项学校资料正在保存，请稍后重试。")
  stage={values:new Map(),notifications:new Set()}
  try{return action()} finally {stage=null}
}

export function stagedSchoolWrites(){return new Map(stage?.values??[])}
export function commitAuxiliarySchoolWrites(writes:Map<string,string|null>){
  const handled=new Set(["localStorage:tgs-proto:school-foundation:v1","localStorage:tgs-proto:staff-imported:v1","sessionStorage:tgs-proto:staff-patches:v1","sessionStorage:tgs-proto:staff-created:v1"])
  for(const [id,value] of writes){
    if(handled.has(id))continue
    const colon=id.indexOf(":"),kind=id.slice(0,colon) as "localStorage"|"sessionStorage",key=id.slice(colon+1)
    const storage=schoolCacheStorage(kind)
    if(value===null)storage.removeItem(key);else storage.setItem(key,value)
  }
}
