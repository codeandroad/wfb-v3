import { schoolSession } from "@/lib/school/system-auth"
import { schoolRepository, SchoolConflict } from "@/lib/school/system-repository"
export const runtime="nodejs"
const headers={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff","Vary":"Cookie"}
export async function GET(request:Request) {
  if (!schoolSession(request)) return new Response(null,{status:401,headers})
  try {return Response.json(schoolRepository().read(),{headers})} catch{return Response.json({error:"学校资料暂时无法读取。"},{status:503,headers})}
}
export async function POST(request:Request) {
  if (!schoolSession(request)) return new Response(null,{status:401,headers})
  if (Number(request.headers.get("content-length")??0)>4000000) return new Response(null,{status:413,headers})
  try {
    const body=await request.json()
    const repo=schoolRepository()
    const result=body.action==="migrate" ? repo.migrate(body.browserId,body.records) : body.action==="save" && Number.isInteger(body.revision) ? repo.save(body.revision,body.records) : null
    if (!result) throw Error("请求无效。")
    return Response.json(result,{headers})
  } catch(error) {return Response.json({error:error instanceof SchoolConflict ? error.message : "学校资料未能保存；已有记录未被覆盖。"},{status:error instanceof SchoolConflict?409:400,headers})}
}
