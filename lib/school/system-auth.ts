import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { isLoopbackHost } from "./local-import-model"
import { SCHOOL_ID } from "./system-model"
import { schoolRepository } from "./system-repository"
const COOKIE="tgs-school-session"
function enabledPersona(persona:string){
  const records=schoolRepository().read().records,id=persona==="lin"?"u-lin":persona==="admin"?"u-xu":""
  const person=records.staff.profiles.find(item=>item.id===id),patch=records.staff.patches[id]
  return !!person && (patch?.status??person.status)!=="left" && (patch?.accountStatus??person.accountStatus)==="enabled"
}
export function localSchoolRequest(request:Request) {
  const host=request.headers.get("host"),origin=request.headers.get("origin")
  if (process.env.NODE_ENV!=="development" || !isLoopbackHost(host) || request.headers.get("sec-fetch-site")==="cross-site") return false
  try { return isLoopbackHost(new URL(request.url).host) && (!origin || new URL(origin).host===host && new URL(origin).protocol===new URL(request.url).protocol) } catch { return false }
}
export function schoolSession(request:Request) {
  if (!localSchoolRequest(request)) return null
  const entries=(request.headers.get("cookie")??"").split(";").map(item=>item.trim()).filter(item=>item.startsWith(COOKIE+"="))
  if (entries.length!==1) return null
  try {
    const [payload,signature]=entries[0].slice(COOKIE.length+1).split(".")
    const expected=createHmac("sha256",schoolRepository().secret()).update(payload).digest("hex")
    if (!signature || signature.length!==expected.length || !timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return null
    const session=JSON.parse(Buffer.from(payload,"base64url").toString())
    return session.school===SCHOOL_ID && ["lin","admin"].includes(session.persona) && session.expires>Date.now() && enabledPersona(session.persona) ? session : null
  } catch { return null }
}
export function issueSchoolSession(persona:string) {
  if (!["lin","admin"].includes(persona)||!enabledPersona(persona)) throw Error("当前身份无学校资料维护权限。")
  const payload=Buffer.from(JSON.stringify({school:SCHOOL_ID,persona,expires:Date.now()+12*3600000})).toString("base64url")
  const signature=createHmac("sha256",schoolRepository().secret()).update(payload).digest("hex")
  return `${COOKIE}=${payload}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`
}
