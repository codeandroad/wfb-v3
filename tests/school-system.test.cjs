const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module'),test=require('node:test'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename,load=Module._load
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,...args)}
Module._load=function(request,...args){if(request==='server-only')return {};return load.call(this,request,...args)}
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file)
const {createSchoolRepository,SchoolConflict}=require('../lib/school/system-repository.ts'),repositoryModule=require('../lib/school/system-repository.ts')
const {foundationSeed}=require('../lib/school/foundation-model.ts'),{STAFF}=require('../lib/demo/staff.ts')
const {DatabaseSync}=require('node:sqlite')
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wfb-school-system-test-'))
const fixture=()=>({foundation:structuredClone(foundationSeed),staff:{profiles:structuredClone(STAFF),patches:{},numberClaims:[]}})
let serial=0,repo
const originalEnv=process.env.NODE_ENV,realFetch=global.fetch
function clean(){repo=createSchoolRepository(path.join(dir,`${++serial}.sqlite`));repo.initialize(fixture());repositoryModule.schoolRepository=()=>repo;process.env.NODE_ENV='development'}
test.beforeEach(clean)
test.after(()=>{process.env.NODE_ENV=originalEnv;global.fetch=realFetch;Module._load=load;Module._resolveFilename=resolve;fs.rmSync(dir,{recursive:true,force:true})})

test('a second repository and restarted process read the same committed records without an import source',()=>{
 const a=repo.read(),records=structuredClone(a.records);records.foundation.departments[0].name='合成统一学校部门';repo.save(a.revision,records)
 const second=createSchoolRepository(path.join(dir,`${serial}.sqlite`));assert.equal(second.read().records.foundation.departments[0].name,'合成统一学校部门')
 assert.equal(second.initialize(fixture()).records.foundation.departments[0].name,'合成统一学校部门')
})
test('CAS rejects a stale browser without overwriting another browser and keeps IDs',()=>{
 const a=repo.read(),b=repo.read();a.records.foundation.departments[0].name='合成浏览器甲';repo.save(a.revision,a.records)
 b.records.foundation.places[0].name='合成浏览器乙';assert.throws(()=>repo.save(b.revision,b.records),SchoolConflict)
 assert.equal(repo.read().records.foundation.departments[0].name,'合成浏览器甲')
 const next=repo.read();next.records.foundation.places[0].name='合成浏览器乙';repo.save(next.revision,next.records)
 assert.equal(repo.read().records.foundation.places[0].name,'合成浏览器乙')
})
test('legacy migration merges one-sided changes, saves its receipt and is idempotent',()=>{
 const legacy=fixture();legacy.foundation.departments[0].name='合成既有浏览器修改'
 const remote=repo.read();remote.records.foundation.places[0].status='inactive';repo.save(remote.revision,remote.records)
 const result=repo.migrate('synthetic-browser-one',legacy)
 assert.equal(result.records.foundation.departments[0].name,'合成既有浏览器修改');assert.equal(result.records.foundation.places[0].status,'inactive')
 assert.equal(repo.migrate('synthetic-browser-one',legacy).revision,result.revision)
 const untouched=repo.migrate('synthetic-browser-two',fixture());assert.equal(untouched.records.foundation.departments[0].name,'合成既有浏览器修改')
})
test('migration conflicts preserve the database and the complete legacy payload for recovery',()=>{
 const legacy=fixture();legacy.foundation.departments[0].name='合成旧窗口改名'
 const remote=repo.read();remote.records.foundation.departments[0].name='合成其他窗口改名';repo.save(remote.revision,remote.records)
 assert.throws(()=>repo.migrate('synthetic-browser-conflict',legacy),SchoolConflict)
 assert.equal(repo.read().records.foundation.departments[0].name,'合成其他窗口改名')
 const db=new DatabaseSync(path.join(dir,`${serial}.sqlite`));const saved=db.prepare('SELECT payload,conflicts FROM school_migrations').get();db.close()
 assert.equal(JSON.parse(saved.payload).foundation.departments[0].name,'合成旧窗口改名');assert(JSON.parse(saved.conflicts).length>0)
})
test('server validation prevents deletion, role edits and duplicate employee numbers atomically',()=>{
 for(const change of [r=>r.staff.profiles.pop(),r=>r.staff.profiles[0].systemRoles.push('forged'),r=>r.foundation.places.pop(),r=>{r.staff.patches[STAFF[0].id]={employeeNo:'SYNTHETIC-DUPLICATE'};r.staff.patches[STAFF[1].id]={employeeNo:'SYNTHETIC-DUPLICATE'}}]){
  const before=repo.read(),after=structuredClone(before.records);change(after);assert.throws(()=>repo.save(before.revision,after));assert.deepEqual(repo.read(),before)
 }
})
test('current and historical employee numbers stay committed together and remain unavailable to others',()=>{
 const before=repo.read();before.records.staff.patches[STAFF[0].id]={employeeNo:'TG2601E997'};before.records.staff.numberClaims.push({schoolId:'teensen-genesis-school',type:'E',no:'TG2601E997',owner:STAFF[0].id});repo.save(before.revision,before.records)
 const clear=repo.read();clear.records.staff.patches[STAFF[0].id].employeeNo='';repo.save(clear.revision,clear.records)
 const another=repo.read();another.records.staff.patches[STAFF[1].id]={employeeNo:'TG2601E997'};assert.throws(()=>repo.save(another.revision,another.records),/工号/)
})
const request=(path,options={})=>new Request('http://localhost:3109'+path,{...options,headers:{host:'localhost:3109',origin:'http://localhost:3109',...options.headers}})
test('signed sessions isolate school data and reject missing, forged, cross-origin and production access',async()=>{
 const {POST:login}=require('../app/api/school/session/route.ts'),{GET}=require('../app/api/school/records/route.ts')
 assert.equal((await GET(request('/api/school/records'))).status,401)
 assert.equal((await login(request('/api/school/session',{method:'POST',body:JSON.stringify({persona:'zhou'})}))).status,403)
 const signed=await login(request('/api/school/session',{method:'POST',body:JSON.stringify({persona:'lin'})}));assert.equal(signed.status,204)
 const cookie=signed.headers.get('set-cookie').split(';')[0];assert(signed.headers.get('set-cookie').includes('HttpOnly'))
 assert.equal((await GET(request('/api/school/records',{headers:{cookie}}))).status,200)
 assert.equal((await GET(request('/api/school/records',{headers:{cookie:cookie+'x'}}))).status,401)
 assert.equal((await GET(request('/api/school/records',{headers:{cookie,origin:'http://evil.invalid'}}))).status,401)
 process.env.NODE_ENV='production';assert.equal((await GET(request('/api/school/records',{headers:{cookie}}))).status,401)
})
test('two independent cookie jars obtain the same database records with no browser import state',async()=>{
 const {POST:login}=require('../app/api/school/session/route.ts'),{GET,POST}=require('../app/api/school/records/route.ts')
 const cookies=[];for(let i=0;i<2;i++){const response=await login(request('/api/school/session',{method:'POST',body:JSON.stringify({persona:'lin'})}));cookies.push(response.headers.get('set-cookie').split(';')[0])}
 const first=await (await GET(request('/api/school/records',{headers:{cookie:cookies[0]}}))).json();first.records.foundation.places[0].name='合成跨浏览器场所'
 const response=await POST(request('/api/school/records',{method:'POST',headers:{cookie:cookies[0]},body:JSON.stringify({action:'save',revision:first.revision,records:first.records})}));assert.equal(response.status,200)
 const second=await (await GET(request('/api/school/records',{headers:{cookie:cookies[1]}}))).json();assert.equal(second.records.foundation.places[0].name,'合成跨浏览器场所')
})
function browser(){const local=new Map(),session=new Map(),storage=m=>({get length(){return m.size},key:i=>[...m.keys()][i]??null,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});global.window={localStorage:storage(local),sessionStorage:storage(session),addEventListener(){},removeEventListener(){}};return local}
async function client(setup){
 browser();setup?.(window);for(const file of Object.keys(require.cache))if(file.startsWith(path.join(root,'lib/school/'))&&!file.endsWith('system-repository.ts')&&!file.endsWith('system-auth.ts'))delete require.cache[file]
 const client=require('../lib/school/system-client.ts'),foundation=require('../lib/school/foundation-store.ts')
 global.fetch=async(url,options={})=>{
  if(url.endsWith('session'))return new Response(null,{status:204})
  if(!options.body)return Response.json(repo.read())
  const body=JSON.parse(options.body);try{return Response.json(body.action==='migrate'?repo.migrate(body.browserId,body.records):repo.save(body.revision,body.records))}catch(error){return Response.json({error:error.message},{status:409})}
 }
 await client.connectSchoolSystem('lin');return {client,foundation}
}
test('a failed server save leaves no changed cache or committed database and preserves retry',async()=>{
 const {client:c,foundation:f}=await client(),before=structuredClone(f.getFoundation()),rev=repo.read().revision
 const success=global.fetch;global.fetch=async()=>Response.json({error:'合成服务器保存失败'},{status:503})
 await assert.rejects(c.commitSchoolChange(()=>f.updateFoundationItems('departments',rows=>rows.map((row,i)=>i?row:{...row,name:'不得本地假保存'}))),/保存失败/)
 assert.deepEqual(f.getFoundation(),before);assert.equal(repo.read().revision,rev)
 global.fetch=success;await c.commitSchoolChange(()=>f.updateFoundationItems('departments',rows=>rows.map((row,i)=>i?row:{...row,name:'合成重试成功'})))
 assert.equal(repo.read().records.foundation.departments[0].name,'合成重试成功')
})
test('an in-flight save keeps the previous cache visible until the database acknowledges success',async()=>{
 const {client:c,foundation:f}=await client(),before=structuredClone(f.getFoundation()),success=global.fetch
 let release;global.fetch=(url,options)=>new Promise(resolve=>{release=()=>resolve(success(url,options))})
 const saved=c.commitSchoolChange(()=>f.updateFoundationItems('departments',rows=>rows.map((row,i)=>i?row:{...row,name:'合成等待确认'})))
 assert.deepEqual(f.getFoundation(),before);release();await saved;assert.equal(f.getFoundation().departments[0].name,'合成等待确认')
})

test('failed creates and thrown staged actions release provisional employee numbers before a retry',async()=>{
 const {client:c}=await client(),staff=require('../lib/school/staff-store.ts'),numbers=require('../lib/school/person-no.ts')
 const person={id:'synthetic-failed-create',name:'合成失败重试人员',employeeNo:'TG2601E992',department:'合成部门',jobTitle:'合成职务',gender:'未透露',phone:'',email:'',status:'active',accountStatus:'none',systemRoles:[],duties:[],history:[]}
 const success=global.fetch;global.fetch=async()=>Response.json({error:'合成服务器失败'},{status:503})
 await assert.rejects(c.commitSchoolChange(()=>staff.createStaff(person)),/失败/)
 assert.equal(staff.getStaffList().some(row=>row.id===person.id),false);assert.equal(numbers.isIssued(person.employeeNo,'E'),false)
 await assert.rejects(c.commitSchoolChange(()=>{staff.createStaff(person);throw Error('合成提交前失败')}),/失败/)
 assert.equal(numbers.isIssued(person.employeeNo,'E'),false)
 global.fetch=success;await c.commitSchoolChange(()=>staff.createStaff(person));assert.equal(repo.read().records.staff.profiles.some(row=>row.id===person.id),true)
})
test('profile edits cannot activate an account and inactive identities cannot obtain new sessions',async()=>{
 const state=repo.read();state.records.staff.patches[STAFF[7].id]={accountStatus:'enabled'}
 assert.throws(()=>repo.save(state.revision,state.records),/账号/)
 const disable=repo.read();disable.records.staff.patches['u-lin']={accountStatus:'disabled'};repo.save(disable.revision,disable.records)
 const {POST:login}=require('../app/api/school/session/route.ts');assert.equal((await login(request('/api/school/session',{method:'POST',body:JSON.stringify({persona:'lin'})}))).status,403)
})

test('legacy current and historical employee claims migrate into the shared database for a fresh browser',async()=>{
 const owner=STAFF[0].id
 const {client:c}=await client(win=>{
  win.sessionStorage.setItem('tgs-proto:staff-patches:v1',JSON.stringify({[owner]:{employeeNo:'TG2601E998'}}))
  win.sessionStorage.setItem('tgs-proto:number-claims:v2',JSON.stringify([
   {schoolId:'teensen-genesis-school',type:'E',no:'TG2601E997',owner,yyyymm:'202601',serial:'997'},
   {schoolId:'teensen-genesis-school',type:'E',no:'TG2601E998',owner,yyyymm:'202601',serial:'998'}]))
 })
 assert.equal(repo.read().records.staff.patches[owner].employeeNo,'TG2601E998')
 assert(repo.read().records.staff.numberClaims.some(claim=>claim.no==='TG2601E997'&&claim.owner===owner))
 c.disconnectSchoolSystem();await client()
 const numbers=require('../lib/school/person-no.ts')
 assert.equal(numbers.isIssued('TG2601E997','E'),true);assert.equal(numbers.isIssued('TG2601E998','E'),true)
})
test('the database retains past numbers even when a caller omits all historical claims',()=>{
 const first=repo.read();first.records.staff.numberClaims=[];first.records.staff.patches[STAFF[0].id]={employeeNo:'TG2601E996'}
 repo.save(first.revision,first.records)
 const clear=repo.read();clear.records.staff.numberClaims=[];clear.records.staff.patches[STAFF[0].id].employeeNo='';repo.save(clear.revision,clear.records)
 const another=repo.read();another.records.staff.numberClaims=[];another.records.staff.patches[STAFF[1].id]={employeeNo:'TG2601E996'}
 assert.throws(()=>repo.save(another.revision,another.records),/工号/)
 assert(repo.read().records.staff.numberClaims.some(claim=>claim.no==='TG2601E996'&&claim.owner===STAFF[0].id))
})
test('a confirmed server save remains successful when both browser caches reject writes',async()=>{
 const {client:c,foundation:f}=await client(),count=repo.read().records.staff.profiles.length
 for(const storage of [window.localStorage,window.sessionStorage])for(const method of ['setItem','removeItem'])storage[method]=()=>{throw new DOMException('synthetic quota','QuotaExceededError')}
 await c.commitSchoolChange(()=>f.updateFoundationItems('departments',rows=>rows.map((row,i)=>i?row:{...row,name:'合成缓存不可写仍保存'})))
 assert.equal(f.getFoundation().departments[0].name,'合成缓存不可写仍保存')
 assert.equal(repo.read().records.foundation.departments[0].name,'合成缓存不可写仍保存')
 await c.commitSchoolChange(()=>f.updateFoundationItems('places',rows=>rows.map((row,i)=>i?row:{...row,name:'合成再次保存'})))
 await c.refreshSchoolSystem();assert.equal(f.getFoundation().places[0].name,'合成再次保存')
 c.disconnectSchoolSystem();const fresh=await client()
 assert.equal(fresh.foundation.getFoundation().departments[0].name,'合成缓存不可写仍保存')
 assert.equal(fresh.foundation.getFoundation().places[0].name,'合成再次保存');assert.equal(repo.read().records.staff.profiles.length,count)
})
