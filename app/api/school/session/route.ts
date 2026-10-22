import { issueSchoolSession, localSchoolRequest } from "@/lib/school/system-auth"
export const runtime="nodejs"
export async function POST(request:Request) {
  if (!localSchoolRequest(request)) return new Response(null,{status:404})
  try { const body=await request.json(); const cookie=issueSchoolSession(body.persona); return new Response(null,{status:204,headers:{"Set-Cookie":cookie,"Cache-Control":"no-store"}}) }
  catch {return Response.json({error:"当前身份无法连接学校资料。"},{status:403,headers:{"Cache-Control":"no-store"}})}
}
