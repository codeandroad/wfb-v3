// Explicit operator import; never loaded by a page or the application startup.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename,load=Module._load
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(root,request.slice(2)):request,...args)}
Module._load=function(request,...args){if(request==='server-only')return {};return load.call(this,request,...args)}
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file)
const {validateLocalSchoolImport}=require('../lib/school/local-import-model.ts')
const {foundationSeed,mergeFoundationState}=require('../lib/school/foundation-model.ts')
const {STAFF}=require('../lib/demo/staff.ts')
const {schoolRepository}=require('../lib/school/system-repository.ts')
const bundle=validateLocalSchoolImport(JSON.parse(fs.readFileSync(path.join(root,'.local-artifacts/private-school-import/current.json'),'utf8')))
const records={foundation:mergeFoundationState(foundationSeed,bundle),staff:{profiles:[...STAFF,...bundle.staff],patches:{},numberClaims:[]}}
const saved=schoolRepository().initialize(records)
console.log(JSON.stringify({initialized:true,revision:saved.revision,staff:saved.records.staff.profiles.length,departments:saved.records.foundation.departments.length,places:saved.records.foundation.places.length}))
